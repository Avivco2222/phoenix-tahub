"""Analytics layer — KPI / funnel / job-health snapshots, query cache,
ghosting score, and executive insight rendering.

All public helpers operate on an open :class:`sqlite3.Connection` and
the unified application :class:`~pandas.DataFrame` produced by
``get_unified_data`` in ``main.py``. The module is import-safe (no
side effects on import).

Centralised regex patterns reused by callers in the API layer:

* :data:`CLOSED_STATUS_PATTERN` — all "no longer active" statuses
* :data:`HIRED_STATUS_PATTERN`  — "hired" subset of the above
* :data:`SLA_BREACH_DAYS_THRESHOLD` — 40-day default for SLA alerts
"""

import hashlib
import json
import math
import sqlite3
from datetime import datetime, timezone
from typing import Any

import pandas as pd


CLOSED_STATUS_PATTERN: str = "קליטה|גיוס|התקבל|דחייה|הסרה|ויתור|הקפאה|נדחה"
HIRED_STATUS_PATTERN: str = "קליטה|גיוס|התקבל"
SLA_BREACH_DAYS_THRESHOLD: int = 40


DEFAULT_INSIGHT_TEMPLATES: list[tuple[str, str, str]] = [
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


def seed_analytics_tables(conn: sqlite3.Connection) -> None:
    """Create snapshot / cache / insight tables and seed default templates.

    Idempotent: re-running is a no-op.
    """
    cur = conn.cursor()
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
        "INSERT OR IGNORE INTO insight_templates(template_id, template_text, condition_expr) VALUES (?, ?, ?)",
        DEFAULT_INSIGHT_TEMPLATES,
    )
    conn.commit()


def _safe_eval_condition(expr: str, context: dict[str, Any]) -> bool:
    """Evaluate an insight-template condition against a numeric context.

    Only int/float/bool names from ``context`` are exposed; ``__builtins__``
    are stripped so the evaluated expression cannot reach attribute access,
    imports, or any callables. Any exception (parse error, name error,
    unsupported operator) is swallowed and yields False — so a buggy
    template never crashes the request, it just fails to match.

    Relocated verbatim from the original internal_logic.py implementation.
    Templates are admin-managed via the ``insight_templates`` table; the
    threat model assumes admin-trusted input.
    """
    allowed_names = {k: v for k, v in context.items() if isinstance(v, (int, float, bool))}
    allowed_names["True"] = True
    allowed_names["False"] = False
    try:
        return bool(eval(expr, {"__builtins__": {}}, allowed_names))  # noqa: S307
    except Exception:
        return False


def get_data_version(conn: sqlite3.Connection) -> str:
    """Content-addressed version of the live dataset — used as a cache key
    invalidator. Prefers ``ingestion_batches`` (modern) over
    ``data_logs`` (legacy)."""
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
    """Re-materialise ``kpi_snapshot``, ``funnel_snapshot`` and
    ``job_health_snapshot`` from the unified frame. Idempotent — wipes
    each table before re-inserting."""
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
    df["is_active"] = ~df["status"].str.contains(CLOSED_STATUS_PATTERN, case=False, na=False)
    current_month = pd.Timestamp.now().month
    current_year = pd.Timestamp.now().year
    hired_this_month = int(
        len(
            df[
                (df["status"].str.contains(HIRED_STATUS_PATTERN, case=False, na=False))
                & (df["start_date"].dt.month == current_month)
                & (df["start_date"].dt.year == current_year)
            ]
        )
    )
    total_active = int(df["is_active"].sum())
    avg_days = int(df["days_in_process"].mean()) if not df.empty else 0
    sla_alerts = int(len(df[(df["is_active"]) & (df["days_in_process"] > SLA_BREACH_DAYS_THRESHOLD)]))
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
        ("קליטות בפועל", len(df[df["status"].str.contains(HIRED_STATUS_PATTERN, case=False, na=False)])),
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
        breaches = int(len(group[group["days_in_process"] > SLA_BREACH_DAYS_THRESHOLD]))
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
    """Stable cache key for an ``(endpoint, params)`` pair."""
    normalized = json.dumps({"endpoint": endpoint, "params": params}, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def get_cached_response(conn: sqlite3.Connection, endpoint: str, params: dict[str, Any]) -> Any | None:
    """Return the cached payload if its stored ``data_version`` still matches
    the current DB state; otherwise delete the stale row and return None."""
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
    """Upsert a response payload into the query cache, tagged with the
    current data version."""
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
    """Wipe the entire query cache. Called after large data mutations."""
    conn.execute("DELETE FROM query_cache")
    if auto_commit:
        conn.commit()


def compute_ghosting_risk_score(days_in_process: int, stage_code: str, department: str) -> int:
    """Logistic-style ghosting probability (1-99). Higher = more likely
    to ghost / go silent. Boosts apply for sales/service departments and
    for interview/offer stages."""
    dept_boost = 0.15 if "מכירות" in str(department) or "שירות" in str(department) else 0.0
    stage_boost = 0.25 if stage_code in {"INTERVIEW", "OFFER"} else 0.0
    x_value = (days_in_process - 14) / 8.0 + dept_boost + stage_boost
    probability = 1 / (1 + math.exp(-x_value))
    return int(min(99, max(1, round(probability * 100))))


def render_executive_insight(conn: sqlite3.Connection, context: dict[str, Any]) -> str:
    """Pick the first matching insight template (ordered by template_id) and
    render it against ``context``. Returns empty string when nothing matches."""
    rows = conn.execute(
        "SELECT template_text, condition_expr FROM insight_templates ORDER BY template_id"
    ).fetchall()
    for template_text, condition_expr in rows:
        if _safe_eval_condition(str(condition_expr), context):
            return str(template_text).format(**context)
    return ""
