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
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response

import config as shared_config
from auth import (
    IMPERSONATOR_COOKIE,
    SESSION_COOKIE,
    _decode_jwt,
    _hash_password,
    _make_session_token,
    _utcnow,
    get_session_user,
    require_admin,
    require_dual_role,
    require_session_role,
)
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


def _set_session_cookie(response, token, *, key=None):
    from main import _set_session_cookie as _impl
    if key is None:
        return _impl(response, token)
    return _impl(response, token, key=key)


def _check_inactive_recruiters():
    from main import _check_inactive_recruiters as _impl
    return _impl()


VALID_APP_TAGS = ("new", "update", "coming_soon", "none")


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


# =====================================================================
# B2.8b — Users, permissions, impersonation, apps, notifications
# =====================================================================


@router.get("/api/admin/permissions/users")
def get_permissions_users(_: dict = Depends(require_admin)):
    conn = sqlite3.connect(shared_config.DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """SELECT id, name, email, usf, personal_password, role, status, last_login, permissions_json
               FROM iam_users ORDER BY name ASC"""
        ).fetchall()
        users = []
        for row in rows:
            users.append(
                {
                    "id": row["id"],
                    "name": row["name"],
                    "email": row["email"],
                    "usf": row["usf"],
                    "personalPassword": row["personal_password"],
                    "role": row["role"],
                    "status": row["status"],
                    "lastLogin": row["last_login"],
                    "permissions": json.loads(row["permissions_json"] or "{}"),
                }
            )
        return users
    finally:
        conn.close()


@router.post("/api/admin/permissions/users")
async def save_permissions_user(request: Request, _: dict = Depends(require_admin)):
    payload = await request.json()
    user_id = str(payload.get("id") or f"u-{uuid.uuid4().hex[:8]}")
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        conn.execute(
            """INSERT OR REPLACE INTO iam_users
               (id, name, email, usf, personal_password, role, status, last_login, permissions_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                str(payload.get("name", "")),
                str(payload.get("email", "")),
                str(payload.get("usf", "")),
                str(payload.get("personalPassword", payload.get("usf", ""))),
                str(payload.get("role", "hiring_manager")),
                str(payload.get("status", "active")),
                str(payload.get("lastLogin", "טרם")),
                json.dumps(payload.get("permissions", {}), ensure_ascii=False),
                _utcnow().isoformat(),
            ),
        )
        conn.commit()
        return {
            "id": user_id,
            "name": str(payload.get("name", "")),
            "email": str(payload.get("email", "")),
            "usf": str(payload.get("usf", "")),
            "personalPassword": str(payload.get("personalPassword", payload.get("usf", ""))),
            "role": str(payload.get("role", "hiring_manager")),
            "status": str(payload.get("status", "active")),
            "lastLogin": str(payload.get("lastLogin", "טרם")),
            "permissions": payload.get("permissions", {}),
        }
    finally:
        conn.close()


@router.post("/api/admin/permissions/users/bulk-suspend")
async def bulk_suspend_users(request: Request, _: dict = Depends(require_admin)):
    payload = await request.json()
    user_ids = payload.get("user_ids", [])
    if not isinstance(user_ids, list) or not user_ids:
        raise HTTPException(status_code=400, detail="user_ids is required")
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        placeholders = ",".join("?" for _ in user_ids)
        conn.execute(
            f"UPDATE iam_users SET status='suspended', updated_at=? WHERE id IN ({placeholders})",
            (_utcnow().isoformat(), *user_ids),
        )
        conn.commit()
        return {"status": "success", "updated": len(user_ids)}
    finally:
        conn.close()


@router.get("/api/admin/users")
async def admin_list_users(_: dict = Depends(require_session_role(Role.ADMIN))):
    with db_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT id, email, full_name, role, employee_number, is_active, must_change_password, created_at, last_login_at FROM users ORDER BY created_at DESC")
        rows = c.fetchall()
    return [
        {"id": r[0], "email": r[1], "full_name": r[2], "role": r[3],
         "employee_number": r[4], "is_active": bool(r[5]),
         "must_change_password": bool(r[6]), "created_at": r[7], "last_login_at": r[8]}
        for r in rows
    ]


@router.post("/api/admin/users")
async def admin_create_user(payload: dict, admin: dict = Depends(require_session_role(Role.ADMIN))):
    email = (payload.get("email") or "").strip().lower()
    full_name = (payload.get("full_name") or "").strip()
    role = (payload.get("role") or "recruiter").strip()
    employee_number = str(payload.get("employee_number") or "").strip()

    if not email or not full_name:
        raise HTTPException(status_code=400, detail="חסרים אימייל או שם מלא")
    if role not in ("admin", "hrbp", "recruiter", "hiring_manager"):
        raise HTTPException(status_code=400, detail="תפקיד לא חוקי")
    if not employee_number or len(employee_number) < 4:
        raise HTTPException(status_code=400, detail="מספר עובד (USF) חייב לכלול לפחות 4 תווים")

    user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
    with db_conn() as conn:
        c = conn.cursor()
        try:
            c.execute(
                "INSERT INTO users (id, email, password_hash, full_name, role, employee_number, is_active, must_change_password, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)",
                (user_id, email, _hash_password(employee_number), full_name, role, employee_number, datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="משתמש עם אימייל זה כבר קיים")

    _log_audit("USER_CREATED", "ok", f"Created {email} as {role} (USF={employee_number})", user=admin.get("email", "admin"))
    return {"id": user_id, "email": email, "full_name": full_name, "role": role, "employee_number": employee_number}


@router.put("/api/admin/users/{user_id}")
async def admin_update_user(user_id: str, payload: dict, admin: dict = Depends(require_session_role(Role.ADMIN))):
    fields, values = [], []
    if "full_name" in payload:
        fields.append("full_name = ?"); values.append((payload["full_name"] or "").strip())
    if "role" in payload:
        if payload["role"] not in ("admin", "hrbp", "recruiter", "hiring_manager"):
            raise HTTPException(status_code=400, detail="תפקיד לא חוקי")
        fields.append("role = ?"); values.append(payload["role"])
    if "is_active" in payload:
        fields.append("is_active = ?"); values.append(1 if payload["is_active"] else 0)
    if not fields:
        raise HTTPException(status_code=400, detail="אין שדות לעדכון")

    values.append(user_id)
    with db_conn() as conn:
        c = conn.cursor()
        c.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="משתמש לא נמצא")
        conn.commit()
    _log_audit("USER_UPDATED", "ok", f"Updated user {user_id}", user=admin.get("email", "admin"))
    return {"status": "ok"}


@router.post("/api/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, admin: dict = Depends(require_session_role(Role.ADMIN))):
    temp_password = secrets.token_urlsafe(9)
    with db_conn() as conn:
        c = conn.cursor()
        c.execute(
            "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?",
            (_hash_password(temp_password), user_id),
        )
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="משתמש לא נמצא")
        conn.commit()
    _log_audit("PASSWORD_RESET", "ok", f"Admin reset password for {user_id}", user=admin.get("email", "admin"))
    return {"temp_password": temp_password}


@router.post("/api/admin/impersonate/{user_id}")
async def admin_impersonate(user_id: str, response: Response, admin: dict = Depends(require_session_role(Role.ADMIN))):
    if admin.get("impersonator"):
        raise HTTPException(status_code=400, detail="כבר במצב impersonation. סיימי את הסשן הנוכחי קודם.")
    with db_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT id, email, full_name, role, is_active FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
    if not row or not row[4]:
        raise HTTPException(status_code=404, detail="המשתמש לא נמצא או מושעה")

    target_id, target_email, target_name, target_role, _ = row
    original_admin_token = _make_session_token({
        "sub": admin.get("sub"), "email": admin.get("email"),
        "name": admin.get("name"), "role": admin.get("role"),
    })
    impersonation_token = _make_session_token({
        "sub": target_id, "email": target_email, "name": target_name, "role": target_role,
        "impersonator": admin.get("sub"), "impersonator_email": admin.get("email"),
    })
    _set_session_cookie(response, impersonation_token, key=SESSION_COOKIE)
    _set_session_cookie(response, original_admin_token, key=IMPERSONATOR_COOKIE)

    _log_audit("IMPERSONATION_START", "warn",
               f"Admin {admin.get('email')} impersonating {target_email}",
               user=admin.get("email", "admin"))
    return {"id": target_id, "email": target_email, "name": target_name, "role": target_role,
            "impersonator_email": admin.get("email")}


@router.post("/api/admin/stop-impersonate")
async def admin_stop_impersonate(
    response: Response,
    fnx_impersonator: Optional[str] = Cookie(default=None),
    user: dict = Depends(get_session_user),
):
    if not user.get("impersonator") or not fnx_impersonator:
        raise HTTPException(status_code=400, detail="אינך במצב impersonation")
    try:
        payload = _decode_jwt(fnx_impersonator)
    except HTTPException:
        response.delete_cookie(key=SESSION_COOKIE, path="/")
        response.delete_cookie(key=IMPERSONATOR_COOKIE, path="/")
        raise HTTPException(status_code=401, detail="טוקן ה-admin המקורי פג. יש להתחבר שוב.")

    if payload.get("role") != "admin":
        response.delete_cookie(key=SESSION_COOKIE, path="/")
        response.delete_cookie(key=IMPERSONATOR_COOKIE, path="/")
        raise HTTPException(status_code=401, detail="טוקן admin לא חוקי")

    new_token = _make_session_token({
        "sub": payload.get("sub"), "email": payload.get("email"),
        "name": payload.get("name"), "role": payload.get("role"),
    })
    _set_session_cookie(response, new_token)
    response.delete_cookie(key=IMPERSONATOR_COOKIE, path="/")

    _log_audit("IMPERSONATION_END", "ok",
               f"Admin {payload.get('email')} stopped impersonating {user.get('email')}",
               user=payload.get("email", "admin"))
    return {"id": payload.get("sub"), "email": payload.get("email"),
            "name": payload.get("name"), "role": payload.get("role")}


@router.put("/api/admin/apps/{app_id}")
async def set_app_override(app_id: str, payload: dict, admin: dict = Depends(require_session_role(Role.ADMIN))):
    """Upsert override for a single app. Body: {hidden?: bool, tag?: 'new'|'update'|'coming_soon'|'none'|null}.
    Passing tag=null clears the override (falls back to hardcoded default in registry)."""
    hidden = 1 if payload.get("hidden") else 0
    tag = payload.get("tag")
    if tag is not None and tag not in VALID_APP_TAGS:
        raise HTTPException(status_code=400, detail=f"tag must be one of {VALID_APP_TAGS} or null")

    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        existing = conn.execute("SELECT 1 FROM app_overrides WHERE app_id = ?", (app_id,)).fetchone()
        now = datetime.now(timezone.utc).isoformat()
        actor = admin.get("email", "admin")
        if existing:
            conn.execute(
                "UPDATE app_overrides SET hidden=?, tag=?, updated_at=?, updated_by=? WHERE app_id=?",
                (hidden, tag, now, actor, app_id),
            )
        else:
            conn.execute(
                "INSERT INTO app_overrides (app_id, hidden, tag, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)",
                (app_id, hidden, tag, now, actor),
            )
        conn.commit()
    finally:
        conn.close()
    _log_audit("APP_OVERRIDE", "ok", f"app={app_id} hidden={bool(hidden)} tag={tag}", user=actor)
    return {"status": "ok", "app_id": app_id, "hidden": bool(hidden), "tag": tag}


@router.post("/api/admin/notifications/send")
async def admin_send_notification(payload: dict, admin: dict = Depends(require_session_role(Role.ADMIN))):
    user_ids = payload.get("user_ids") or []
    target_group = (payload.get("target_group") or "").strip()
    message = (payload.get("message") or "").strip()
    severity = (payload.get("severity") or "info").strip()
    link = (payload.get("link") or "").strip() or None
    category = (payload.get("category") or "manual").strip()
    if not message:
        raise HTTPException(status_code=400, detail="הודעה ריקה")
    if severity not in ("info", "warning", "danger", "success", "kudos"):
        severity = "info"
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="ההודעה ארוכה מדי (עד 2000 תווים)")

    sent_at = datetime.now(timezone.utc).isoformat()
    delivered, skipped = 0, []

    _ROLE_MAP = {
        "all_recruiters": "recruiter",
        "all_admins":     "admin",
        "all_hrbp":       "hrbp",
    }

    conn = sqlite3.connect(shared_config.DB_NAME)
    c = conn.cursor()
    try:
        if target_group == "all_users":
            rows = c.execute("SELECT id FROM users WHERE is_active = 1").fetchall()
            user_ids = [r[0] for r in rows]
        elif target_group in _ROLE_MAP:
            role = _ROLE_MAP[target_group]
            rows = c.execute("SELECT id FROM users WHERE role = ? AND is_active = 1", (role,)).fetchall()
            user_ids = [r[0] for r in rows]
        elif not isinstance(user_ids, list) or not user_ids:
            raise HTTPException(status_code=400, detail="חסרים נמענים")

        for uid in user_ids:
            c.execute("SELECT id FROM users WHERE id = ? AND is_active = 1", (str(uid),))
            if not c.fetchone():
                skipped.append(str(uid)); continue
            note_id = f"NTF-{uuid.uuid4().hex[:10].upper()}"
            c.execute(
                "INSERT INTO notifications (id, user_id, message, severity, sent_by, sent_at, category, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (note_id, str(uid), message, severity, admin.get("email", "admin"), sent_at, category, link),
            )
            delivered += 1
        conn.commit()
    finally:
        conn.close()

    _log_audit("NOTIFICATION_SENT", "ok",
               f"Sent to {delivered} user(s) (severity={severity}, group={target_group or 'specific'})",
               user=admin.get("email", "admin"))
    return {"delivered": delivered, "skipped": skipped, "sent_at": sent_at}


# NOTE: Two /api/admin/notifications/history endpoints existed in main.py
# (lines ~3300 and ~3467). FastAPI registered both but the later one shadowed
# the earlier — only the detailed version was actually reachable. Preserving
# that exact behaviour: register both, with the more detailed one second so
# it wins via APIRouter's last-wins routing. The legacy first version
# remains as documented dead code for parity with main.py.


@router.get("/api/admin/notifications/history")
async def admin_notifications_history_legacy(
    limit: int = 50,
    category: Optional[str] = None,
    admin: dict = Depends(require_session_role(Role.ADMIN)),
):
    """Legacy notification-history view. Shadowed by the detailed handler below.
    Kept for parity with the duplicate registration that lived in main.py."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        sql = (
            "SELECT n.id, n.user_id, u.full_name, u.email, n.message, n.severity, "
            "n.category, n.sent_by, n.sent_at, n.read_at "
            "FROM notifications n LEFT JOIN users u ON n.user_id = u.id "
        )
        params: list = []
        if category:
            sql += "WHERE n.category = ? "
            params.append(category)
        sql += "ORDER BY n.sent_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()


@router.get("/api/admin/notifications/history")
async def admin_notification_history(
    limit: int = 100,
    category: Optional[str] = None,
    _: dict = Depends(require_session_role(Role.ADMIN)),
):
    """Admin view: notification history across all users, with read stats per message group."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    c = conn.cursor()
    try:
        sql = """
            SELECT
                n.id,
                n.message,
                n.severity,
                n.category,
                n.sent_by,
                n.sent_at,
                n.link,
                u.full_name  AS recipient_name,
                u.email      AS recipient_email,
                CASE WHEN n.read_at IS NOT NULL THEN 1 ELSE 0 END AS is_read
            FROM notifications n
            LEFT JOIN users u ON u.id = n.user_id
            WHERE 1=1
        """
        params: list = []
        if category:
            sql += " AND n.category = ?"
            params.append(category)
        sql += " ORDER BY n.sent_at DESC LIMIT ?"
        params.append(limit)
        rows = c.execute(sql, params).fetchall()
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()
    return [
        {
            "id": r[0], "message": r[1], "severity": r[2], "category": r[3] or "general",
            "sent_by": r[4], "sent_at": r[5], "link": r[6],
            "recipient_name": r[7], "recipient_email": r[8], "is_read": bool(r[9]),
        }
        for r in rows
    ]


@router.post("/api/admin/check-inactive-recruiters")
async def check_inactive_recruiters_endpoint(_: dict = Depends(require_session_role(Role.ADMIN))):
    """Admin-triggered scan. Safe to call repeatedly — dedupes within 24h."""
    return _check_inactive_recruiters()
