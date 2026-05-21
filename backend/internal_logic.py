import hashlib
import json
import math
import sqlite3
from datetime import datetime, timezone
from typing import Any

import pandas as pd


DEFAULT_STATUS_LEXICON = [
    ("HIRED", "קליטה|גיוס|התקבל"),
    ("OFFER", "הצעת שכר|חוזה|ממתין לחתימה|הצעה"),
    ("INTERVIEW", "ראיון|מקצועי|מרכז הערכה|מנהל"),
    ("SCREEN", "טלפוני|ראשוני|HR|סינון"),
    ("REJECTED", "דחייה|הסרה|ויתור|הקפאה|נדחה"),
    ("ACTIVE", "חדש|בתהליך|ממתין"),
]

DEFAULT_INSIGHT_TEMPLATES = [
    (
        "high_sla",
        "Executive alert: {breach_percentage}% of active pipeline is above SLA. Top bottlenecks: {top_jobs}.",
        "breach_percentage >= 15",
    ),
    (
        "strong_hiring",
        "Hiring momentum is strong this month ({hired_this_month} hires). Keep interviewer capacity stable.",
        "hired_this_month >= 10",
    ),
    (
        "stable_pipeline",
        "Pipeline is stable. {sla_breaches} SLA breaches across {total_active} active candidates.",
        "True",
    ),
]


def seed_internal_logic_tables(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS status_lexicon (
            stage_code TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS etl_rule_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id TEXT,
            upload_log_id TEXT,
            affected_rows INTEGER,
            created_at TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS kpi_snapshot (
            snapshot_ts TEXT PRIMARY KEY,
            total_candidates INTEGER,
            hired_this_month INTEGER,
            avg_days INTEGER,
            sla_alerts INTEGER,
            total_active INTEGER,
            data_version TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS funnel_snapshot (
            snapshot_ts TEXT,
            stage TEXT,
            count INTEGER,
            pct INTEGER,
            data_version TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS job_health_snapshot (
            snapshot_ts TEXT,
            job_title TEXT,
            department TEXT,
            recruiter TEXT,
            active_candidates INTEGER,
            avg_days INTEGER,
            max_days INTEGER,
            sla_breaches INTEGER,
            health TEXT,
            data_version TEXT
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS query_cache (
            cache_key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            data_version TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS insight_templates (
            template_id TEXT PRIMARY KEY,
            template_text TEXT NOT NULL,
            condition_expr TEXT NOT NULL
        )
        """
    )
    cur.executemany(
        "INSERT OR IGNORE INTO status_lexicon(stage_code, pattern) VALUES (?, ?)",
        DEFAULT_STATUS_LEXICON,
    )
    cur.executemany(
        "INSERT OR IGNORE INTO insight_templates(template_id, template_text, condition_expr) VALUES (?, ?, ?)",
        DEFAULT_INSIGHT_TEMPLATES,
    )
    conn.commit()


def _safe_eval_condition(expr: str, context: dict[str, Any]) -> bool:
    allowed_names = {k: v for k, v in context.items() if isinstance(v, (int, float, bool))}
    allowed_names["True"] = True
    allowed_names["False"] = False
    try:
        return bool(eval(expr, {"__builtins__": {}}, allowed_names))
    except Exception:
        return False


def _get_status_lexicon(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    rows = conn.execute("SELECT stage_code, pattern FROM status_lexicon").fetchall()
    if not rows:
        return DEFAULT_STATUS_LEXICON
    return [(row[0], row[1]) for row in rows]


def canonicalize_statuses(df: pd.DataFrame, conn: sqlite3.Connection) -> pd.DataFrame:
    if "status" not in df.columns:
        df["stage_code"] = "ACTIVE"
        return df

    lexicon = _get_status_lexicon(conn)
    stage_codes: list[str] = []
    for raw_status in df["status"].astype(str):
        selected = "ACTIVE"
        for code, pattern in lexicon:
            if pd.Series([raw_status]).str.contains(pattern, case=False, regex=True, na=False).iloc[0]:
                selected = code
                break
        stage_codes.append(selected)
    df["stage_code"] = stage_codes
    return df


def _apply_single_rule(df: pd.DataFrame, rule: dict[str, Any]) -> int:
    col_name = str(rule.get("col_name", "")).strip()
    condition = str(rule.get("condition", "")).strip()
    action = str(rule.get("action", "")).strip()
    if not col_name or col_name not in df.columns or not condition:
        return 0

    lower_condition = condition.lower()
    if "ריקה" in condition or "empty" in lower_condition:
        mask = df[col_name].isna() | (df[col_name].astype(str).str.strip() == "")
    elif "contains:" in lower_condition:
        needle = condition.split(":", 1)[1].strip()
        mask = df[col_name].astype(str).str.contains(needle, case=False, na=False)
    elif "equals:" in lower_condition:
        needle = condition.split(":", 1)[1].strip()
        mask = df[col_name].astype(str).str.lower() == needle.lower()
    else:
        mask = df[col_name].astype(str).str.contains(condition, case=False, na=False)

    affected = int(mask.sum())
    if affected == 0:
        return 0

    if action.startswith("set:"):
        target = action.split(":", 1)[1].strip()
        df.loc[mask, col_name] = target
    elif action.startswith("prefix:"):
        target = action.split(":", 1)[1].strip()
        df.loc[mask, col_name] = target + df.loc[mask, col_name].astype(str)
    elif action == "drop":
        df.drop(index=df[mask].index, inplace=True)
    return affected


def execute_etl_rules(
    df: pd.DataFrame,
    conn: sqlite3.Connection,
    upload_log_id: str,
    *,
    auto_commit: bool = True,
) -> pd.DataFrame:
    rows = conn.execute(
        "SELECT id, col_name, condition, action, active FROM etl_rules WHERE active = 1 ORDER BY id"
    ).fetchall()
    if not rows:
        return df

    for row in rows:
        rule = {
            "id": row[0],
            "col_name": row[1],
            "condition": row[2],
            "action": row[3],
            "active": row[4],
        }
        affected_rows = _apply_single_rule(df, rule)
        if affected_rows > 0:
            conn.execute(
                """
                INSERT INTO etl_rule_audit(rule_id, upload_log_id, affected_rows, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (rule["id"], upload_log_id, affected_rows, datetime.now(timezone.utc).isoformat()),
            )
    if auto_commit:
        conn.commit()
    return df


def get_data_version(conn: sqlite3.Connection) -> str:
    table_row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ingestion_batches'"
    ).fetchone()
    if table_row:
        row = conn.execute(
            """
            SELECT COALESCE(MAX(finished_at), 'none') AS version, COALESCE(COUNT(*), 0) AS cnt
            FROM ingestion_batches
            WHERE status = 'committed'
            """
        ).fetchone()
        return f"{row[0]}::{row[1]}"
    row = conn.execute(
        "SELECT COALESCE(MAX(upload_date), 'none') AS version, COALESCE(COUNT(*), 0) AS cnt FROM data_logs"
    ).fetchone()
    return f"{row[0]}::{row[1]}"


def build_snapshots(conn: sqlite3.Connection, unified_df: pd.DataFrame) -> None:
    snapshot_ts = datetime.now(timezone.utc).isoformat()
    data_version = get_data_version(conn)
    conn.execute("DELETE FROM kpi_snapshot")
    conn.execute("DELETE FROM funnel_snapshot")
    conn.execute("DELETE FROM job_health_snapshot")

    if unified_df.empty:
        conn.execute(
            """
            INSERT INTO kpi_snapshot(snapshot_ts, total_candidates, hired_this_month, avg_days, sla_alerts, total_active, data_version)
            VALUES (?, 0, 0, 0, 0, 0, ?)
            """,
            (snapshot_ts, data_version),
        )
        conn.commit()
        return

    df = unified_df.copy()
    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    closed = "קליטה|גיוס|התקבל|דחייה|הסרה|ויתור|הקפאה|נדחה"
    df["is_active"] = ~df["status"].str.contains(closed, case=False, na=False)
    current_month = pd.Timestamp.now().month
    current_year = pd.Timestamp.now().year
    hired_this_month = int(
        len(
            df[
                (df["status"].str.contains("קליטה|גיוס|התקבל", case=False, na=False))
                & (df["start_date"].dt.month == current_month)
                & (df["start_date"].dt.year == current_year)
            ]
        )
    )
    total_active = int(df["is_active"].sum())
    avg_days = int(df["days_in_process"].mean()) if not df.empty else 0
    sla_alerts = int(len(df[(df["is_active"]) & (df["days_in_process"] > 40)]))
    total_candidates = int(len(df))

    conn.execute(
        """
        INSERT INTO kpi_snapshot(snapshot_ts, total_candidates, hired_this_month, avg_days, sla_alerts, total_active, data_version)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (snapshot_ts, total_candidates, hired_this_month, avg_days, sla_alerts, total_active, data_version),
    )

    funnel_map = [
        ("קורות חיים (Sourcing)", len(df)),
        ("סינון ראשוני / טלפוני", len(df[df["status"].str.contains("טלפוני|ראשוני|HR|מנהל|סינון", case=False, na=False)])),
        ("ראיונות (HR + מקצועי)", len(df[df["status"].str.contains("ראיון|מקצועי|מרכז הערכה|מנהל", case=False, na=False)])),
        ("הצעות שכר", len(df[df["status"].str.contains("הצעת שכר|חוזה|ממתין לחתימה|הצעה", case=False, na=False)])),
        ("קליטות בפועל", len(df[df["status"].str.contains("קליטה|גיוס|התקבל", case=False, na=False)])),
    ]
    for stage_name, count in funnel_map:
        pct = int((count / total_candidates) * 100) if total_candidates else 0
        conn.execute(
            "INSERT INTO funnel_snapshot(snapshot_ts, stage, count, pct, data_version) VALUES (?, ?, ?, ?, ?)",
            (snapshot_ts, stage_name, int(count), pct, data_version),
        )

    active_df = df[df["is_active"]]
    for job_title, group in active_df.groupby("job_title"):
        active_candidates = int(len(group))
        avg_days_job = int(group["days_in_process"].mean()) if active_candidates else 0
        max_days = int(group["days_in_process"].max()) if active_candidates else 0
        breaches = int(len(group[group["days_in_process"] > 40]))
        health = "danger" if breaches > 2 else "warning" if breaches > 0 else "good"
        department = group["department"].iloc[0] if pd.notna(group["department"].iloc[0]) else "כללי"
        recruiter = group["recruiter"].iloc[0] if pd.notna(group["recruiter"].iloc[0]) else "לא שויך"
        conn.execute(
            """
            INSERT INTO job_health_snapshot(snapshot_ts, job_title, department, recruiter, active_candidates, avg_days, max_days, sla_breaches, health, data_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                snapshot_ts,
                str(job_title),
                str(department),
                str(recruiter),
                active_candidates,
                avg_days_job,
                max_days,
                breaches,
                health,
                data_version,
            ),
        )

    conn.commit()


def cache_key(endpoint: str, params: dict[str, Any]) -> str:
    normalized = json.dumps({"endpoint": endpoint, "params": params}, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def get_cached_response(conn: sqlite3.Connection, endpoint: str, params: dict[str, Any]) -> Any | None:
    key = cache_key(endpoint, params)
    version = get_data_version(conn)
    row = conn.execute(
        "SELECT payload, data_version FROM query_cache WHERE cache_key = ?",
        (key,),
    ).fetchone()
    if not row:
        return None
    if row[1] != version:
        conn.execute("DELETE FROM query_cache WHERE cache_key = ?", (key,))
        conn.commit()
        return None
    return json.loads(row[0])


def set_cached_response(conn: sqlite3.Connection, endpoint: str, params: dict[str, Any], payload: Any) -> None:
    key = cache_key(endpoint, params)
    version = get_data_version(conn)
    conn.execute(
        """
        INSERT OR REPLACE INTO query_cache(cache_key, payload, data_version, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (key, json.dumps(payload, ensure_ascii=False), version, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()


def clear_query_cache(conn: sqlite3.Connection, *, auto_commit: bool = True) -> None:
    conn.execute("DELETE FROM query_cache")
    if auto_commit:
        conn.commit()


def compute_ghosting_risk_score(days_in_process: int, stage_code: str, department: str) -> int:
    dept_boost = 0.15 if "מכירות" in str(department) or "שירות" in str(department) else 0.0
    stage_boost = 0.25 if stage_code in {"INTERVIEW", "OFFER"} else 0.0
    x_value = (days_in_process - 14) / 8.0 + dept_boost + stage_boost
    probability = 1 / (1 + math.exp(-x_value))
    return int(min(99, max(1, round(probability * 100))))


def render_executive_insight(conn: sqlite3.Connection, context: dict[str, Any]) -> str:
    rows = conn.execute(
        "SELECT template_text, condition_expr FROM insight_templates ORDER BY template_id"
    ).fetchall()
    for template_text, condition_expr in rows:
        if _safe_eval_condition(str(condition_expr), context):
            return str(template_text).format(**context)
    return "Pipeline insight unavailable."
