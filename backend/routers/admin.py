"""Admin endpoints — config, health, rules, simple analytics.

First slice of the admin surface (B2.8a). Ten read-mostly routes that
power the admin UI's foundational tabs:

    GET    /admin/health                — data-quality health score
    GET    /admin/costs                 — demo CPH + agency cost panel
    GET    /admin/automations           — demo automation rules list
    GET    /api/admin/config            — load admin config blob
    POST   /api/admin/config            — partial-merge admin config
    GET    /api/admin/rules             — list ETL rules (seeds defaults)
    POST   /api/admin/rules             — upsert ETL rule
    DELETE /api/admin/rules/{rule_id}   — remove ETL rule
    GET    /api/admin/inbox-analytics   — demo recruiter inbox metrics
    GET    /api/admin/consumer-map      — page-by-page source-to-consumer map
    GET    /api/admin/active-schema     — active schema version + ingest types

Two later sub-routers (B2.8b for users/permissions, B2.8c for batches
/ ingestion observability / quality) will follow once the basic admin
plumbing is verified here. Endpoint bodies are reproduced verbatim
from main.py — same auth gates, same SQL, same return shapes.
"""

import json
import sqlite3

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Request

import config as shared_config
from auth import require_admin, require_dual_role
from constants import Role
from db import db_conn


router = APIRouter(tags=["admin"])


# --- Late-bound proxies to helpers still in main.py ----------------------
def _admin_config_defaults():
    from main import ADMIN_CONFIG_DEFAULTS
    return ADMIN_CONFIG_DEFAULTS


def _ingest_constants():
    from main import (
        DEFAULT_SCHEMA_VERSION,
        SUPPORTED_SCHEMA_VERSIONS,
        INGEST_HANDLERS,
    )
    return DEFAULT_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS, INGEST_HANDLERS


def _log_audit(action, status, details, user):
    from main import log_audit_action as _impl
    _impl(action=action, status=status, details=details, user=user)


# --- Routes ---------------------------------------------------------------


@router.get("/admin/health")
def get_data_health(_: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP))):
    """חישוב בריאות נתונים משוקלל על פני הטבלאות"""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM candidates")
        total_candidates = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM applications")
        total_apps = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM applications WHERE recruiter = 'לא שויך' OR recruiter IS NULL")
        missing_rec = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM jobs WHERE department = 'General' OR department IS NULL")
        missing_dept = c.fetchone()[0]

        logs_df = pd.read_sql("SELECT * FROM data_logs ORDER BY upload_date DESC LIMIT 10", conn)

        health_score = 100
        if total_apps > 0:
            health_score = max(0, int(100 - (((missing_rec + missing_dept) / (total_apps + total_candidates)) * 100)))

        missing_data = []
        if missing_rec > 0:
            missing_data.append({"field": "תהליכים ללא מגייס", "count": missing_rec})
        if missing_dept > 0:
            missing_data.append({"field": "משרות ללא שיוך מחלקתי", "count": missing_dept})

        return {
            "health_score": health_score,
            "total_records": total_apps,
            "missing_data": missing_data,
            "logs": logs_df.to_dict(orient="records")
        }
    finally:
        conn.close()


@router.get("/admin/costs")
def get_costs(_: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP))):
    """סימולציה של נתוני כספים, הסכמים ועלויות גיוס (CPH)"""
    return {
        "is_demo": True,
        "demo_note": "Demo payload - replace with live FinOps integration",
        "cph_average": "₪7,820",
        "total_spend_ytd": "₪265,000",
        "agencies": [
            {"name": "חברות השמה (טכנולוגיה)", "type": "עמלה", "value": "100%", "active": 45, "hired": 12, "est_cost": "₪180,000", "roi": "גבוה"},
            {"name": "LinkedIn Recruiter", "type": "רישיון שנתי", "value": "₪45,000", "active": 120, "hired": 8, "est_cost": "₪45,000", "roi": "בינוני"},
            {"name": "חבר מביא חבר (Referral)", "type": "בונוס הוקרה", "value": "₪3,000", "active": 80, "hired": 14, "est_cost": "₪42,000", "roi": "גבוה מאוד"},
            {"name": "קמפיינים ממומנים (Facebook/IG)", "type": "תקציב חודשי", "value": "₪2,500", "active": 210, "hired": 3, "est_cost": "₪12,500", "roi": "נמוך"}
        ]
    }


@router.get("/admin/automations")
def get_automations(_: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP))):
    """שליפת חוקי האוטומציה שמוגדרים במערכת"""
    return [
        {"id": 1, "trigger": "סטטוס = 'הצעת שכר'", "condition": "מעל 3 ימים", "action": "שלח התראה אדומה למנהל המגייס", "status": "פעיל", "is_demo": True},
        {"id": 2, "trigger": "מקור = 'חבר מביא חבר'", "condition": "מעבר לסטטוס 'קליטה'", "action": "הוצא מייל למדור שכר לתשלום בונוס", "status": "פעיל", "is_demo": True},
        {"id": 3, "trigger": "תגית 'טאלנט' נוספה", "condition": "אין אינטראקציה 14 יום", "action": "הקפץ למגייסת תזכורת (Nudge)", "status": "פעיל", "is_demo": True},
        {"id": 4, "trigger": "חטיבת טכנולוגיה", "condition": "מעל 60 ימים ב'ראיון מקצועי'", "action": "דווח כחריגת SLA חמורה", "status": "מושהה", "is_demo": True}
    ]


@router.get("/api/admin/rules")
def get_etl_rules(_: str = Depends(require_admin)):
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        df = pd.read_sql("SELECT * FROM etl_rules", conn)
        if df.empty:
            default_rules = [
                ("r1", "רמה 3", "מכילה 'טכנולוגיות'", "התעלם מיתר הרמות במבנה ארגוני", True),
                ("r2", "גזרה", "ריקה או חסרה", "השלם ערך 'מקצועית'", True)
            ]
            c = conn.cursor()
            c.executemany("INSERT INTO etl_rules VALUES (?, ?, ?, ?, ?)", default_rules)
            conn.commit()
            df = pd.read_sql("SELECT * FROM etl_rules", conn)

        return df.to_dict(orient="records")
    except Exception:
        return []
    finally:
        conn.close()


@router.post("/api/admin/rules")
def save_etl_rule(rule: dict, _: str = Depends(require_admin)):
    import uuid
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        rule_id = rule.get('id', f"r-{uuid.uuid4().hex[:6]}")
        c.execute('''INSERT OR REPLACE INTO etl_rules (id, col_name, condition, action, active)
                     VALUES (?, ?, ?, ?, ?)''',
                  (rule_id, rule['col_name'], rule['condition'], rule['action'], rule.get('active', True)))
        conn.commit()
        return {"status": "success", "id": rule_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.delete("/api/admin/rules/{rule_id}")
def delete_etl_rule(rule_id: str, _: str = Depends(require_admin)):
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        c.execute("DELETE FROM etl_rules WHERE id = ?", (rule_id,))
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()


@router.get("/api/admin/inbox-analytics")
def get_inbox_analytics(_: str = Depends(require_admin)):
    """מחזיר נתונים אמיתיים על ביצועי המגייסים בטיפול במשימות שהמערכת ייצרה"""
    return {
        "is_demo": True,
        "demo_note": "Demo analytics payload - replace with DB aggregation",
        "stats": {
            "total_tasks": 1240, "avg_close_rate": 92, "median_response_hours": 3.8, "urgent_sla_breaches": 14
        },
        "hourly_trend": [
            {"hour": '08:00', "tasks": 12}, {"hour": '10:00', "tasks": 45}, {"hour": '12:00', "tasks": 38},
            {"hour": '14:00', "tasks": 62}, {"hour": '16:00', "tasks": 55}, {"hour": '18:00', "tasks": 20}
        ],
        "task_types": [
            {"label": "סורסינג (נפח קו״ח)", "pct": 45, "count": 558, "color": "bg-orange-400"},
            {"label": "חריגות SLA (מנהלים)", "pct": 30, "count": 372, "color": "bg-blue-400"},
            {"label": "נטישה (Ghosting)", "pct": 15, "count": 186, "color": "bg-red-400"},
            {"label": "אדמיניסטרציה / Onboarding", "pct": 10, "count": 124, "color": "bg-green-400"}
        ],
        "recruiters": [
            {"name": "גיא רג'ואן", "dominant": "סורסינג ולינקדאין", "time": "1.2 שעות", "rate": "98%", "insight": "מצטיין תפעולית. זקוק לתקציב פרסום.", "color": "green"},
            {"name": "ליטל גולדפרב", "dominant": "SLA מנהלים", "time": "14.5 שעות", "rate": "62%", "insight": "חולשה בניהול ממשקים מול מנהלים.", "color": "red"},
            {"name": "מור אהרון", "dominant": "Ghosting", "time": "4.1 שעות", "rate": "89%", "insight": "עומס יתר. מנהלת 35 משרות במקביל.", "color": "orange"}
        ]
    }


@router.get("/api/admin/config")
async def get_admin_config(_: str = Depends(require_admin)):
    with db_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT value FROM system_settings WHERE key='admin_config'")
        row = c.fetchone()
    if row:
        return json.loads(row[0])
    return _admin_config_defaults()


@router.post("/api/admin/config")
async def save_admin_config(request: Request, section: str = "general", _: str = Depends(require_admin)):
    payload = await request.json()
    with db_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT value FROM system_settings WHERE key='admin_config'")
        row = c.fetchone()
        existing = json.loads(row[0]) if row else {}
        merged = {**existing, **payload}
        c.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('admin_config', ?)",
            (json.dumps(merged),)
        )
        conn.commit()
    changed_keys = list(payload.keys())
    _log_audit(
        action="ADMIN_CONFIG_UPDATE",
        status="success",
        details=f"section={section} | keys_changed={changed_keys}",
        user="admin-frontend"
    )
    timestamp = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    return {"status": "saved", "timestamp": timestamp}


@router.get("/api/admin/consumer-map")
def admin_consumer_map(_: dict = Depends(require_dual_role(Role.ADMIN))):
    return {
        "sources": [
            {"table": "candidates", "consumers": [
                {"block": "דשבורד KPI — סה\"כ מועמדים פעילים", "page": "/"},
                {"block": "Intelligence funnel", "page": "/intelligence"},
                {"block": "Cross-module search", "page": "header"},
                {"block": "Candidates list + side-panel", "page": "/candidates"},
                {"block": "Jobs — per-job candidate count", "page": "/jobs"},
            ]},
            {"table": "applications", "consumers": [
                {"block": "Candidates page stage chips", "page": "/candidates"},
                {"block": "Jobs stage breakdown", "page": "/jobs"},
                {"block": "Intelligence TTF/OAR metrics", "page": "/intelligence"},
            ]},
            {"table": "jobs", "consumers": [
                {"block": "Jobs page table + grid", "page": "/jobs"},
                {"block": "דשבורד KPI — משרות פתוחות", "page": "/"},
                {"block": "Intelligence neglect alerts", "page": "/intelligence"},
                {"block": "Side-panel job detail", "page": "/jobs"},
            ]},
            {"table": "hires", "consumers": [
                {"block": "דשבורד — קליטות החודש", "page": "/"},
                {"block": "Intelligence hires trend", "page": "/intelligence"},
            ]},
            {"table": "diversity_snapshots", "consumers": [
                {"block": "Headcount — תצוגת גיוון", "page": "/headcount"},
                {"block": "דשבורד — % גיוון", "page": "/"},
            ]},
            {"table": "headcount_snapshots", "consumers": [
                {"block": "Headcount — מטריצת תקן/בפועל", "page": "/headcount"},
                {"block": "דשבורד — סטיית תקן", "page": "/"},
            ]},
            {"table": "finops_invoices", "consumers": [
                {"block": "Budget — FinOps תפעול", "page": "/budget"},
                {"block": "דשבורד — תקציב מנוצל", "page": "/"},
            ]},
            {"table": "attrition_events", "consumers": [
                {"block": "Headcount — attrition_ytd", "page": "/headcount"},
                {"block": "Intelligence — churn alerts", "page": "/intelligence"},
            ]},
            {"table": "notifications", "consumers": [
                {"block": "BellDropdown header", "page": "all"},
                {"block": "Notification context", "page": "global"},
            ]},
        ],
    }


@router.get("/api/admin/active-schema")
def admin_active_schema():
    """Returns the current active schema version. Frontend can include it as
    `X-Schema-Version` header on uploads; backend will warn if mismatch."""
    DEFAULT_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS, INGEST_HANDLERS = _ingest_constants()
    return {
        "active_schema_version": DEFAULT_SCHEMA_VERSION,
        "supported": SUPPORTED_SCHEMA_VERSIONS,
        "ingest_types": list(INGEST_HANDLERS.keys()),
    }
