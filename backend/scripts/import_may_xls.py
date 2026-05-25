"""One-time importer for the user's May 2026 ATS export.

Loads ``ריכוז נתונים חודש מאי סינון שלילות.xls`` (6,149 rows) and
populates the live DB with the real recruitment dataset, replacing
the synthetic 50/20/50 demo seed.

This script is destructive. It MUST:
1. Take a labelled backup via ``backup_db.run_backup("pre-xls-import")``
   before touching anything.
2. Run in a single transaction so a mid-import crash leaves the DB
   in the original state (the backup is the belt + this is the
   braces).
3. Print a summary of what was created / skipped before exiting so
   the operator can sanity-check counts against the source file.

Mapping (verified against the source file's distinct values during
the audit; see commit `3bf6cd4` / `88d6482` for the schema additions
this script relies on):

  Source column           → Target column
  ─────────────────────────────────────────────────────────────
  שם מועמד                → candidates.name
                            (no phone/email in source — every row
                             is created with both NULL, surfacing
                             on the "missing dedup key" panel of
                             the בקרת איכות screen)
  שם המשרה + קוד משרה     → jobs.job_title + jobs.id
                            (קוד משרה is the natural primary key in
                             the source; we adopt it verbatim)
  רמה 3                    → jobs.department
  מנהל קשרי לקוחות         → jobs.hiring_manager
  גזרה                     → jobs.role_type
  מצב שיוך למשרה           → applications.stage_code (+ closure_*
                             when the cell encodes a closure)
  סיבה                     → applications.closure_reason_code
                            (via _REASON_MAP — taxonomy seeded in
                             closure_taxonomy by init_db)
  מגייס                    → applications.recruiter
  תחילת גיוס               → applications.start_date

Usage:
    python -m scripts.import_may_xls --xls "<path>" [--dry-run]
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

# Make backend/ importable when run as a script.
_HERE = Path(__file__).resolve().parent
_BACKEND = _HERE.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import config as shared_config  # noqa: E402
from scripts.backup_db import run_backup  # noqa: E402


# ──────────────────────────────────────────────────────────────────
# 1. STAGE MAPPING  (Hebrew label → UNIFIED_STAGES code + optional
#                     closure_type + closure_stage)
# ──────────────────────────────────────────────────────────────────
# Each entry resolves a value from the source's "מצב שיוך למשרה"
# column to:
#   stage_code     — the candidate's CURRENT position in the funnel.
#                    For closures this becomes REJECTED or WITHDRAWN.
#   closure_type   — 'rejected' / 'withdrawn' / None.
#   closure_stage  — for closures, WHERE in the funnel the closure
#                    happened (UNIFIED_STAGES code), distinct from the
#                    terminal stage_code.
_STAGE_MAP: dict[str, dict[str, str | None]] = {
    # ─── Active funnel ───────────────────────────────────────
    "הגיש מועמדות למשרה":              {"stage": "SOURCING",          "closure_type": None, "closure_stage": None},
    'ספק הגיש קו"ח למשרה':              {"stage": "SOURCING",          "closure_type": None, "closure_stage": None},
    "ראיון טלפוני":                     {"stage": "PHONE_INTERVIEW",   "closure_type": None, "closure_stage": None},
    "ראיון גיוס HR":                    {"stage": "HR_INTERVIEW",      "closure_type": None, "closure_stage": None},
    "ראיון גיוס HR + מנהל":             {"stage": "HR_INTERVIEW",      "closure_type": None, "closure_stage": None},
    "ראיון מנהל מקצועי":                {"stage": "MANAGER_INTERVIEW", "closure_type": None, "closure_stage": None},
    "זימון לראיון גיוס מקוון":          {"stage": "HR_INTERVIEW",      "closure_type": None, "closure_stage": None},
    "זימון לראיון גיוס פרונטלי":        {"stage": "HR_INTERVIEW",      "closure_type": None, "closure_stage": None},
    "זימון לראיון גיוס  smart":         {"stage": "HR_INTERVIEW",      "closure_type": None, "closure_stage": None},
    "זימון לראיון מנהל מקצועי":         {"stage": "MANAGER_INTERVIEW", "closure_type": None, "closure_stage": None},
    "מבדקים":                           {"stage": "TESTS",             "closure_type": None, "closure_stage": None},
    "בדיקת ממליצים":                   {"stage": "REFERENCES",        "closure_type": None, "closure_stage": None},
    "הצעה למועמד":                      {"stage": "OFFER",             "closure_type": None, "closure_stage": None},
    "הצעת חוזה":                        {"stage": "OFFER",             "closure_type": None, "closure_stage": None},
    "יועסקו":                           {"stage": "HIRED",             "closure_type": None, "closure_stage": None},
    "ניוד פנימי-יועסקו":               {"stage": "HIRED",             "closure_type": None, "closure_stage": None},
    "אין מענה לאחר מס' נסיונות":      {"stage": "NO_RESPONSE",       "closure_type": None, "closure_stage": None},
    "סגירת / ביטול משרה":              {"stage": "ACTIVE",            "closure_type": None, "closure_stage": None},  # job-level

    # ─── Org-initiated closures (שלילה-) ─────────────────────
    "שלילה- סינון קוח":                {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "SCREEN"},
    "שלילה- ריאיון טלפוני":             {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "PHONE_INTERVIEW"},
    "שלילה- ריאיון HR":                 {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "HR_INTERVIEW"},
    "שלילה- ריאיון מנהל מגייס":        {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "MANAGER_INTERVIEW"},
    "שלילה- מבדקים":                    {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "TESTS"},
    "שלילה- בדיקת ממליצים":            {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "REFERENCES"},
    "שלילה- הצעה למועמד":              {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "OFFER"},
    "שלילה- הצעת חוזה":                {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "OFFER"},
    "שלילה- זימון לריאיון HR":         {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "HR_INTERVIEW"},
    "שלילה- זימון לריאיון מנהל מגייס": {"stage": "REJECTED", "closure_type": "rejected", "closure_stage": "MANAGER_INTERVIEW"},

    # ─── Candidate-initiated closures (הסרת מועמדות-) ────────
    "הסרת מועמדות- ריאיון טלפוני":     {"stage": "WITHDRAWN", "closure_type": "withdrawn", "closure_stage": "PHONE_INTERVIEW"},
    "הסרת מועמדות- זימון לריאיון HR":  {"stage": "WITHDRAWN", "closure_type": "withdrawn", "closure_stage": "HR_INTERVIEW"},
    "הסרת מועמדות- זימון לריאיון מנהל מגייס": {"stage": "WITHDRAWN", "closure_type": "withdrawn", "closure_stage": "MANAGER_INTERVIEW"},
    "הסרת מועמדות- מבדקים":            {"stage": "WITHDRAWN", "closure_type": "withdrawn", "closure_stage": "TESTS"},
    "הסרת מועמדות- ריאיון מנהל מגייס":  {"stage": "WITHDRAWN", "closure_type": "withdrawn", "closure_stage": "MANAGER_INTERVIEW"},
    "הסרת מועמדות- הצעה למועמד":       {"stage": "WITHDRAWN", "closure_type": "withdrawn", "closure_stage": "OFFER"},
}

# ──────────────────────────────────────────────────────────────────
# 2. REASON MAPPING (סיבה → closure_taxonomy.code)
# ──────────────────────────────────────────────────────────────────
# Map the free-text reason values in the source to the structured
# codes seeded in closure_taxonomy by init_db. The source has a
# couple of typographic variants ("התאמה אישיותיות" vs "התאמה
# אישיותית") which we normalise to the same code.
_REASON_MAP: dict[str, str] = {
    "UQ":                                  "UQ",
    "OQ":                                  "OQ",
    "היסטוריה תהליכית":                  "PROCESS_HISTORY",
    "טכני- ניתוב לתפקיד אחר":          "TECH_ROUTED_OTHER",
    "התאמה אישיותיות":                  "PERSONALITY_FIT",   # plural typo in source
    "התאמה אישיותית":                   "PERSONALITY_FIT",   # canonical form
    "יציבות תעסוקתית":                  "JOB_STABILITY",
    "כישורים":                           "SKILLS_GAP",
    "מדיניות קרבה משפחתית":            "FAMILY_PROXIMITY_POLICY",
    "טכני- משרה נסגרה / בוטלה":     "TECH_JOB_CLOSED",
    "אי הגעה לריאיון":                    "NO_SHOW",
    "המלצה שלילית":                      "BAD_REFERENCE",
    "המועמד לא הציג ממליצים":           "NO_REFERENCES",
    # candidate-initiated
    "ציפיות שכר":                        "SALARY_EXPECTATIONS",
    "לא מעוניין/ת בתפקיד":              "NOT_INTERESTED",
    "קבלה למשרה אחרת":                  "ANOTHER_OFFER",
    "מיקום המשרה":                       "JOB_LOCATION",
    "היקף המשרה":                        "JOB_SCOPE",
    "תנאי העסקה":                       "WORK_CONDITIONS",
    # bot
    "BOT- מיקום משרה":                 "BOT_JOB_LOCATION",
    "BOT- היקף משרה":                  "BOT_JOB_SCOPE",
    "BOT- חוסר מוכוונות":              "BOT_NO_ORIENTATION",
    # catch-all
    "other":                              "REJECTED_OTHER",  # default; overridden if closure_type='withdrawn'
}


# ──────────────────────────────────────────────────────────────────
# 3. HELPERS
# ──────────────────────────────────────────────────────────────────

def _norm(v: Any) -> str | None:
    """Treat NaN / empty string / 'nan' as None."""
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = str(v).strip()
    if not s or s.lower() in {"nan", "none", "null", "n/a"}:
        return None
    return s


def _iso(v: Any) -> str | None:
    """Coerce date-ish cell to ISO date string, or None."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, str):
        s = v.strip()
        return s or None
    try:
        return pd.Timestamp(v).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def _stage_lookup(raw: str | None) -> dict[str, str | None]:
    """Resolve "מצב שיוך למשרה" → stage dict. Unknown values fall
    through to ACTIVE so the row still imports cleanly."""
    if raw is None:
        return {"stage": "ACTIVE", "closure_type": None, "closure_stage": None}
    return _STAGE_MAP.get(raw.strip(), {"stage": "ACTIVE", "closure_type": None, "closure_stage": None})


def _reason_lookup(raw: str | None, closure_type: str | None) -> str | None:
    """Map "סיבה" → closure_taxonomy.code, respecting closure_type for
    the catch-all "other" value (rejected → REJECTED_OTHER, withdrawn
    → WITHDRAWN_OTHER)."""
    if raw is None:
        return None
    s = raw.strip()
    if s.lower() == "other":
        return "WITHDRAWN_OTHER" if closure_type == "withdrawn" else "REJECTED_OTHER"
    return _REASON_MAP.get(s)


# ──────────────────────────────────────────────────────────────────
# 4. MAIN
# ──────────────────────────────────────────────────────────────────

def import_xls(xls_path: Path, dry_run: bool = False) -> dict[str, int]:
    """Import the xls into the live DB. Returns counts."""
    print(f"[import] reading {xls_path}")
    df = pd.read_excel(xls_path, sheet_name="Sheet1", engine="xlrd")
    print(f"[import]   source rows: {len(df)}")

    # Backup first — even in dry-run we want to know the backup path
    # works, so we always create one and report it.
    backup_path = run_backup("pre-xls-import")
    print(f"[import] backup created at: {backup_path}")

    conn = sqlite3.connect(shared_config.DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        if not dry_run:
            # Wipe demo data. Order matters because of FKs (applications
            # before candidates / jobs).
            for table in (
                "applications", "candidates", "jobs",
                "hires", "attrition_events", "headcount_snapshots",
                "diversity_snapshots", "batch_entity_changes",
                "ingestion_batches", "data_logs", "rejected_rows",
            ):
                conn.execute(f"DELETE FROM {table}")
            print("[import] demo tables truncated")

        # ── Build dedup maps ────────────────────────────────────
        jobs_seen: dict[str, str] = {}        # key=job_code → jobs.id
        candidates_seen: dict[str, str] = {}  # key=name.lower() → candidates.id

        stats = {
            "rows_total": len(df),
            "jobs_inserted": 0,
            "candidates_inserted": 0,
            "applications_inserted": 0,
            "closures_rejected": 0,
            "closures_withdrawn": 0,
            "rows_skipped": 0,
            "reasons_resolved": 0,
            "reasons_unmapped": 0,
        }

        for _, row in df.iterrows():
            cand_name = _norm(row.get("שם מועמד"))
            job_title = _norm(row.get("שם המשרה"))
            job_code  = _norm(row.get("קוד משרה"))

            # Need at minimum a candidate name + job identity to map this
            # to an application. Skip rows that lack either.
            if not cand_name or (not job_title and not job_code):
                stats["rows_skipped"] += 1
                continue

            # ── Job upsert ───────────────────────────────────
            # The schema enforces UNIQUE(LOWER(job_title), LOWER(department)).
            # The source has 6 cases where two distinct קוד משרה values
            # share the same (title, dept) pair — typically duplicate
            # openings for the same role. Treat those as the same job
            # (first one wins) so the unique index isn't violated.
            job_key = (job_code or job_title or "").strip()
            if job_key not in jobs_seen:
                department = _norm(row.get("רמה 3"))
                hiring_manager = _norm(row.get("מנהל קשרי לקוחות"))
                role_type = _norm(row.get("גזרה"))
                opened_at = _iso(row.get("תחילת גיוס"))
                resolved_job_id: str | None = None
                if not dry_run:
                    try:
                        candidate_job_id = job_code or f"JOB-{uuid.uuid4().hex[:10].upper()}"
                        conn.execute(
                            "INSERT INTO jobs (id, job_title, department, hiring_manager, role_type, opened_at) "
                            "VALUES (?, ?, ?, ?, ?, ?)",
                            (candidate_job_id, job_title or job_code, department, hiring_manager, role_type, opened_at),
                        )
                        resolved_job_id = candidate_job_id
                        stats["jobs_inserted"] += 1
                    except sqlite3.IntegrityError:
                        # Lookup the existing row that triggered the
                        # unique violation and reuse its id.
                        existing = conn.execute(
                            "SELECT id FROM jobs WHERE LOWER(job_title)=LOWER(?) AND LOWER(IFNULL(department,''))=LOWER(IFNULL(?,''))",
                            (job_title or job_code, department),
                        ).fetchone()
                        if existing:
                            resolved_job_id = existing[0]
                            stats.setdefault("jobs_reused_on_conflict", 0)
                            stats["jobs_reused_on_conflict"] += 1
                        else:
                            # Last-resort: skip this row rather than abort the import
                            stats["rows_skipped"] += 1
                            continue
                else:
                    resolved_job_id = job_code or f"JOB-{uuid.uuid4().hex[:10].upper()}"
                    stats["jobs_inserted"] += 1
                jobs_seen[job_key] = resolved_job_id

            # ── Candidate upsert ─────────────────────────────
            cand_key = cand_name.lower()
            if cand_key not in candidates_seen:
                cand_id = f"CND-{uuid.uuid4().hex[:12].upper()}"
                # Phone + email left NULL on purpose — source has no
                # such columns. These rows surface in the quality
                # screen as "missing dedup key" so admin can enrich.
                if not dry_run:
                    conn.execute(
                        "INSERT INTO candidates (id, name) VALUES (?, ?)",
                        (cand_id, cand_name),
                    )
                candidates_seen[cand_key] = cand_id
                stats["candidates_inserted"] += 1

            # ── Application ──────────────────────────────────
            stage_info = _stage_lookup(_norm(row.get("מצב שיוך למשרה")))
            stage_code = stage_info["stage"]
            closure_type = stage_info["closure_type"]
            closure_stage = stage_info["closure_stage"]
            reason_raw = _norm(row.get("סיבה"))
            reason_code = _reason_lookup(reason_raw, closure_type)
            if reason_raw and not reason_code:
                stats["reasons_unmapped"] += 1
            elif reason_code:
                stats["reasons_resolved"] += 1

            captured_by = None
            if reason_code and reason_code.startswith("BOT_"):
                captured_by = "bot"
            elif closure_type:
                captured_by = "recruiter"

            app_id = f"APP-{uuid.uuid4().hex[:10].upper()}"
            recruiter = _norm(row.get("מגייס"))
            start_date = _iso(row.get("תחילת גיוס"))
            if not dry_run:
                conn.execute(
                    """INSERT INTO applications
                       (app_id, candidate_id, job_id, status, recruiter, start_date,
                        days_in_process, stage_code,
                        closure_type, closure_stage, closure_reason_code, captured_by)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        app_id, candidates_seen[cand_key], jobs_seen[job_key],
                        _norm(row.get("מצב שיוך למשרה")),
                        recruiter, start_date, 0, stage_code,
                        closure_type, closure_stage, reason_code, captured_by,
                    ),
                )
            stats["applications_inserted"] += 1
            if closure_type == "rejected":
                stats["closures_rejected"] += 1
            elif closure_type == "withdrawn":
                stats["closures_withdrawn"] += 1

        if not dry_run:
            conn.commit()
            print("[import] committed")
        else:
            conn.rollback()
            print("[import] dry-run — no changes committed")

        return stats
    finally:
        conn.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--xls", required=True, help="Path to the .xls source file")
    p.add_argument("--dry-run", action="store_true", help="Parse + log without committing")
    args = p.parse_args()

    xls = Path(args.xls)
    if not xls.exists():
        print(f"FILE NOT FOUND: {xls}", file=sys.stderr)
        sys.exit(2)

    stats = import_xls(xls, dry_run=args.dry_run)
    print("\n=== IMPORT SUMMARY ===")
    for k, v in stats.items():
        print(f"  {k:30s} {v:>6}")
