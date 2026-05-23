"""Analytics endpoints — dashboard KPIs, executive brief, funnel, drilldown.

Four read-only routes that power the home dashboard and the
intelligence view:

    GET /stats              — top-row KPIs (totals, hires this month, SLA)
    GET /executive-brief    — narrative summary with bottlenecks + insight
    GET /intelligence       — funnel + ghosting radar
    GET /drilldown          — month-specific candidate list

All four are gated by ``verify_token`` (any authenticated role). They
read from the unified application view (``get_unified_data``) and
write to / read from the query cache; they do NOT mutate business
data. Endpoint bodies are reproduced verbatim from main.py — same
SQL, same status-pattern regexes, same return shapes — so this is
a pure relocation with zero observable API change.
"""

import sqlite3

import pandas as pd
from fastapi import APIRouter, Depends
from pipeline import _count_active_candidates_db, get_unified_data

import config as shared_config
from auth import verify_token
from internal_logic import (
    compute_ghosting_risk_score,
    get_cached_response,
    render_executive_insight,
    set_cached_response,
)


router = APIRouter(tags=["analytics"])


@router.get("/stats")
def get_stats(
    timeframe: str = "all",
    department: str = "all",
    recruiter: str = "all",
    _: dict = Depends(verify_token),
):
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        cache_params = {"timeframe": timeframe, "department": department, "recruiter": recruiter}
        cached = get_cached_response(conn, "stats", cache_params)
        if cached is not None:
            return cached
        df = get_unified_data(conn)
        df['start_date'] = pd.to_datetime(df['start_date'])
    except Exception:
        return {"total_candidates": 0, "hired_this_month": 0, "avg_days": 0, "sla_alerts": 0, "chart_data": []}
    finally:
        conn.close()

    if df.empty:
        return {"total_candidates": 0, "hired_this_month": 0, "avg_days": 0, "sla_alerts": 0, "chart_data": []}

    # הפעלת סינונים חכמים (Slicers)
    if department != "all":
        df = df[df['department'] == department]
    if recruiter != "all":
        df = df[df['recruiter'] == recruiter]
    if timeframe == "30days":
        df = df[df['start_date'] >= (pd.Timestamp.now() - pd.Timedelta(days=30))]
    elif timeframe == "year":
        df = df[df['start_date'].dt.year == pd.Timestamp.now().year]

    closed_statuses = ['קליטה', 'גיוס', 'התקבל', 'דחייה', 'הסרה', 'ויתור', 'הקפאה', 'נדחה']
    df['is_active'] = ~df['status'].str.contains('|'.join(closed_statuses), case=False, na=False)

    recent_df = df[df['start_date'].dt.year >= (pd.Timestamp.now().year - 1)].copy() if timeframe == "all" else df.copy()

    total = len(df)
    current_month = pd.Timestamp.now().month
    hired_df = recent_df[(recent_df['status'].str.contains('קליטה|גיוס|התקבל', case=False, na=False)) & (recent_df['start_date'].dt.month == current_month)]
    hired_count = len(hired_df)

    all_hired = recent_df[recent_df['status'].str.contains('קליטה|גיוס|התקבל', case=False, na=False)]
    avg_days = int(all_hired['days_in_process'].mean()) if not all_hired.empty else 0

    # חישוב SLA אדפטיבי (לפי סוג משרה - מוקדים מול מטה/טכנולוגי)
    active_df = recent_df[recent_df['is_active']]
    sla_count = len(active_df[
        ((active_df['department'].str.contains('שירות|מכירות|מוקדים', case=False, na=False)) & (active_df['days_in_process'] > 29)) |
        ((~active_df['department'].str.contains('שירות|מכירות|מוקדים', case=False, na=False)) & (active_df['days_in_process'] > 44))
    ])

    graph_df = recent_df.copy()
    graph_df['month_name'] = graph_df['start_date'].dt.strftime('%b')
    graph_df['month_num'] = graph_df['start_date'].dt.month
    chart_data = graph_df.groupby(['month_num', 'month_name']).size().reset_index(name='candidates').sort_values('month_num')
    formatted_chart = [{"name": row['month_name'], "candidates": int(row['candidates'])} for _, row in chart_data.iterrows()]

    payload = {
        "total_candidates": total,
        "total_candidates_db": _count_active_candidates_db(),
        "hired_this_month": hired_count,
        "avg_days": avg_days,
        "sla_alerts": sla_count,
        "chart_data": formatted_chart,
    }
    cache_conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        set_cached_response(cache_conn, "stats", {"timeframe": timeframe, "department": department, "recruiter": recruiter}, payload)
    finally:
        cache_conn.close()
    return payload


@router.get("/executive-brief")
def get_executive_brief(_: dict = Depends(verify_token)):
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        df = get_unified_data(conn)
        df['start_date'] = pd.to_datetime(df['start_date'])
    except Exception:
        return {"error": "No data"}
    finally:
        conn.close()

    if df.empty:
        return {"error": "No data"}

    closed_statuses = ['קליטה', 'גיוס', 'התקבל', 'דחייה', 'הסרה', 'ויתור', 'הקפאה', 'נדחה']
    df['is_active'] = ~df['status'].str.contains('|'.join(closed_statuses), case=False, na=False)
    active_df = df[df['is_active']]

    # Metrics
    total_active = len(active_df)
    sla_breaches = len(active_df[active_df['days_in_process'] > 40])

    current_month = pd.Timestamp.now().month
    current_year = pd.Timestamp.now().year
    hired_this_month = len(df[(df['status'].str.contains('קליטה|גיוס|התקבל', case=False, na=False)) &
                              (df['start_date'].dt.month == current_month) &
                              (df['start_date'].dt.year == current_year)])

    # חישוב צווארי הבקבוק המרכזיים
    bottlenecks = []
    for job_title, group in active_df.groupby('job_title'):
        breaches = len(group[group['days_in_process'] > 40])
        if breaches > 0:
            bottlenecks.append({
                "job": job_title,
                "breaches": breaches,
                "recruiter": str(group['recruiter'].iloc[0]) if pd.notna(group['recruiter'].iloc[0]) else "לא מוגדר"
            })

    bottlenecks.sort(key=lambda x: x['breaches'], reverse=True)
    top_3 = bottlenecks[:3]

    breach_percentage = int((sla_breaches / total_active) * 100) if total_active > 0 else 0
    top_jobs = ", ".join([b["job"] for b in top_3]) if top_3 else "none"
    insight_conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        insight = render_executive_insight(
            conn=insight_conn,
            context={
                "breach_percentage": breach_percentage,
                "hired_this_month": hired_this_month,
                "sla_breaches": sla_breaches,
                "total_active": total_active,
                "top_jobs": top_jobs,
            },
        )
    finally:
        insight_conn.close()

    return {
        "date": pd.Timestamp.now().strftime("%d/%m/%Y"),
        "total_active": total_active,
        "hired_this_month": hired_this_month,
        "sla_breaches": sla_breaches,
        "top_bottlenecks": top_3,
        "insight": insight
    }


@router.get("/intelligence")
def get_intelligence(_: dict = Depends(verify_token)):
    """מנוע הפקת תובנות, משפכים, ורדאר סיכונים מהדאטה האמיתי"""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        df = get_unified_data(conn)
    except Exception:
        return {"error": "No data"}
    finally:
        conn.close()

    if df.empty:
        return {"error": "No data"}

    # --- 1. משפך המרה דינמי מבוסס נתונים אמיתיים (Real Funnel) ---
    total_candidates = len(df)

    # חיפוש טקסטואלי חכם של הסטטוסים
    cv_review = total_candidates  # כולם מתחילים פה
    phone_screen = len(df[df['status'].str.contains('טלפוני|ראשוני|ראיון HR|מנהל|סינון', case=False, na=False)])
    interviews = len(df[df['status'].str.contains('ראיון|משאבי אנוש|מקצועי|מרכז הערכה', case=False, na=False)])
    offers = len(df[df['status'].str.contains('הצעת שכר|חוזה|ממתין לחתימה|הצעה', case=False, na=False)])
    hired = len(df[df['status'].str.contains('קליטה|גיוס|התקבל', case=False, na=False)])

    # יצירת המבנה שהפרונטאנד מצפה לו
    funnel = [
        {"stage": "קורות חיים (Sourcing)", "count": cv_review, "percentage": 100},
        {"stage": "סינון ראשוני / טלפוני", "count": phone_screen, "percentage": int((phone_screen / cv_review) * 100) if cv_review > 0 else 0},
        {"stage": "ראיונות (HR + מקצועי)", "count": interviews, "percentage": int((interviews / cv_review) * 100) if cv_review > 0 else 0},
        {"stage": "הצעות שכר", "count": offers, "percentage": int((offers / cv_review) * 100) if cv_review > 0 else 0},
        {"stage": "קליטות בפועל", "count": hired, "percentage": int((hired / cv_review) * 100) if cv_review > 0 else 0}
    ]

    # --- 2. רדאר נטישה (Ghosting Predictor) אמיתי ---
    closed_statuses = ['קליטה', 'גיוס', 'התקבל', 'דחייה', 'הסרה', 'ויתור', 'הקפאה', 'נדחה']
    df['is_active'] = ~df['status'].str.contains('|'.join(closed_statuses), case=False, na=False)
    active_df = df[df['is_active']]

    # מועמדים פעילים שתקועים מעל 14 יום בלי תזוזה
    risk_df = active_df[active_df['days_in_process'] > 14].sort_values('days_in_process', ascending=False).head(8)

    ghosting_risks = []
    for _, row in risk_df.iterrows():
        prob = compute_ghosting_risk_score(
            days_in_process=int(row["days_in_process"]),
            stage_code=str(row.get("stage_code", "ACTIVE")),
            department=str(row.get("department", "")),
        )
        ghosting_risks.append({
            "candidate": row['candidate_name'],
            "job": row['job_title'],
            "days": int(row['days_in_process']),
            "risk_score": prob,
            "recruiter": row['recruiter'] if pd.notna(row['recruiter']) else "לא שויך"
        })

    baseline_days = int(active_df['days_in_process'].mean()) if not active_df.empty else 0

    return {
        "funnel": funnel,
        "ghosting_risks": ghosting_risks,
        "baseline": {
            "avg_days": baseline_days,
            "current_hires": hired
        }
    }


@router.get("/drilldown")
def get_drilldown(
    month_name: str,
    timeframe: str = "all",
    department: str = "all",
    recruiter: str = "all",
    _: dict = Depends(verify_token),
):
    """שולף את רשימת המועמדים המדויקת של חודש ספציפי (לפי חיתוכים)"""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        cache_params = {
            "month_name": month_name,
            "timeframe": timeframe,
            "department": department,
            "recruiter": recruiter,
        }
        cached = get_cached_response(conn, "drilldown", cache_params)
        if cached is not None:
            return cached
        df = get_unified_data(conn)
        df['start_date'] = pd.to_datetime(df['start_date'])
    except Exception:
        return []
    finally:
        conn.close()

    if df.empty:
        return []

    # --- מפעילים את אותם סינונים מהדשבורד הראשי ---
    if department != "all":
        df = df[df['department'] == department]
    if recruiter != "all":
        df = df[df['recruiter'] == recruiter]

    if timeframe == "30days":
        df = df[df['start_date'] >= (pd.Timestamp.now() - pd.Timedelta(days=30))]
    elif timeframe == "year":
        df = df[df['start_date'].dt.year == pd.Timestamp.now().year]

    # --- חיתוך ספציפי לחודש שנלחץ בגרף ---
    df['month_short'] = df['start_date'].dt.strftime('%b')
    df_month = df[df['month_short'] == month_name].copy()

    if df_month.empty:
        return []

    df_month = df_month.sort_values('days_in_process', ascending=False)

    records = df_month[['candidate_name', 'job_title', 'status', 'recruiter', 'days_in_process']].fillna("").to_dict(orient="records")
    cache_conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        set_cached_response(
            cache_conn,
            "drilldown",
            {"month_name": month_name, "timeframe": timeframe, "department": department, "recruiter": recruiter},
            records,
        )
    finally:
        cache_conn.close()
    return records
