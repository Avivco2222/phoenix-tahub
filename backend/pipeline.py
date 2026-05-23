"""Unified application-pipeline read layer.

Every cross-pipeline view (candidates list, jobs page, intelligence
funnel, executive brief, drilldown) calls :func:`get_unified_data` to
produce one flat DataFrame joining ``applications`` × ``candidates`` ×
``jobs`` × ``onboarding``. The other helpers in this module derive
secondary views from that join:

* :func:`_compute_unified_stage` — maps the
  (``applications.stage_code``, ``onboarding.status``) pair to a
  single unified stage code consumed by the frontend chips
  (``UNIFIED_STAGES`` from ``constants``). Onboarding always wins
  because it represents a later funnel stage.
* :func:`_count_active_candidates_db` — direct count of all active
  candidates including those without any application row. Used by
  ``/stats`` so the headline KPI doesn't undercount when a candidate
  has been created but not yet assigned to a job.
* :func:`_get_orphan_jobs` — jobs with zero active applications.
  ``get_unified_data`` starts ``FROM applications``, so it can't see
  these — typically brand-new openings or fully-closed jobs whose
  applications got soft-deleted. The jobs listing endpoint appends
  them so the count matches the underlying ``jobs`` table.

All helpers operate on the live DB through ``shared_config.DB_NAME``.
``get_unified_data`` takes an open connection (so the caller controls
the transaction), the other two open their own.
"""

import sqlite3

import pandas as pd

import config as shared_config
from constants import UNIFIED_STAGES


def get_unified_data(conn: sqlite3.Connection) -> pd.DataFrame:
    """Flat join of applications + candidates + jobs + onboarding.

    LEFT JOIN to onboarding is keyed by ``LOWER(name)`` — that is the
    only available link, since ``candidates.id`` (internal) ≠
    ``onboarding.id``. ``onboarding_status`` and ``id_num`` are NULL
    when no onboarding record exists for the candidate.

    Filters out soft-deleted rows on all three core tables
    (``is_active=1``).
    """
    query = '''
        SELECT
            c.id as candidate_id,
            c.name as candidate_name,
            c.email,
            c.phone,
            c.source,
            j.id as job_id,
            j.job_title,
            j.department,
            a.app_id,
            a.status,
            a.recruiter,
            a.start_date,
            a.days_in_process,
            a.upload_log_id,
            COALESCE(a.stage_code, 'ACTIVE') as stage_code,
            o.id as onboarding_id,
            o.id_num as id_num,
            o.status as onboarding_status,
            o.start_date as onboarding_start_date,
            o.role as onboarding_role,
            o.manager as onboarding_manager
        FROM applications a
        JOIN candidates c ON a.candidate_id = c.id
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN onboarding o ON LOWER(o.name) = LOWER(c.name)
        WHERE COALESCE(a.is_active, 1) = 1
          AND COALESCE(c.is_active, 1) = 1
          AND COALESCE(j.is_active, 1) = 1
    '''
    return pd.read_sql(query, conn)


def _compute_unified_stage(stage_code: str | None, onboarding_status: str | None) -> str:
    """Maps (applications.stage_code, onboarding.status) to a single stage
    code that drives both the /candidates chips and the /jobs breakdown.

    Onboarding wins because it represents a later stage in the funnel:

    * onboarding ``pending``                  → ``AWAITING_START``
      (recruit accepted, hasn't started)
    * onboarding ``completed``                → ``STARTED``
      (employee actively onboarding)
    * onboarding ``cancelled`` / ``left_company`` → ``REJECTED`` (archive)

    Otherwise: fall through to ``applications.stage_code`` (uppercased,
    defaulting to ``ACTIVE``).
    """
    if onboarding_status == "completed":
        return "STARTED"
    if onboarding_status == "pending":
        return "AWAITING_START"
    if onboarding_status in ("cancelled", "left_company"):
        return "REJECTED"
    return (stage_code or "ACTIVE").upper()


def _count_active_candidates_db() -> int:
    """Count ALL active candidates directly from the candidates table,
    including those without any application record. This fixes the issue
    where ``get_unified_data`` only sees candidates linked through
    applications."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        return conn.execute(
            "SELECT COUNT(*) FROM candidates WHERE COALESCE(is_active, 1) = 1"
        ).fetchone()[0]
    finally:
        conn.close()


def _get_orphan_jobs() -> list[dict]:
    """Return jobs that have zero active applications (hence invisible in
    ``get_unified_data`` which starts ``FROM applications``). These are
    typically newly created positions or fully-closed jobs whose
    applications were soft-deleted.

    Each returned dict matches the shape produced by the main
    ``GET /api/jobs`` endpoint so consumers can simply ``.append`` to
    the summary list.
    """
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        rows = conn.execute(
            """SELECT j.id, j.job_title, j.department, j.hiring_manager,
                      j.opened_at, j.closed_at, j.close_reason, j.target_count
               FROM jobs j
               WHERE COALESCE(j.is_active, 1) = 1
                 AND j.id NOT IN (
                     SELECT DISTINCT a.job_id FROM applications a
                     WHERE COALESCE(a.is_active, 1) = 1
                 )"""
        ).fetchall()
        return [
            {
                "job_id": r[0], "job_title": r[1], "department": r[2] or "כללי",
                "recruiter": "לא שויך", "is_active": True,
                "active_candidates": 0, "total_candidates": 0,
                "avg_days": 0, "max_days": 0, "sla_breaches": 0,
                "health": "good",
                "stage_breakdown": {s: 0 for s in UNIFIED_STAGES},
                "closed_at": None, "close_reason": None,
            }
            for r in rows
        ]
    finally:
        conn.close()
