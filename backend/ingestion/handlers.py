"""Per-file-type ingest handlers and their dispatch dict.

Seven handlers cover the seven ingestible file types — see
:data:`INGEST_HANDLERS` at the bottom. Each handler:

1. Opens its own ``sqlite3`` connection on the live DB
   (``config.DB_NAME``).
2. Iterates the validated, alias-normalised DataFrame row-by-row.
3. Performs dedup / upsert / insert with the type's natural key.
4. Calls :func:`audit._record_change` for every insert/update/delete
   so the per-batch revert flow can roll changes back.
5. Returns a stats dict in the shape produced by :func:`utils._empty_stats`.

The candidate path additionally calls
:func:`merge_candidate` / :func:`insert_candidate` (private to this
module) — they own the case-insensitive upsert logic and the
``_nullify_empty`` coercion that prevents empty-string collisions on
the UNIQUE(email) constraint.

Behavior is preserved verbatim from the original main.py defs — same
SQL, same column lists, same exception handling.
"""

import sqlite3
import uuid
from datetime import datetime, timezone

import pandas as pd

import config as shared_config
from audit import _record_change
from utils import (
    _empty_stats,
    _row_to_scalar,
    iteration_signature,
    mask_value,
    normalize_email,
    normalize_phone,
)

from .batches import _auto_scan_after_ingest
from .validation import find_existing_candidate


# ---------------------------------------------------------------------------
# Candidate upsert primitives (used only by _ingest_candidates / _ingest_hires
# / _ingest_attrition through ``find_existing_candidate``)
# ---------------------------------------------------------------------------


def merge_candidate(conn: sqlite3.Connection, candidate_id: str, parsed: dict) -> dict:
    """Upsert merge: writes only NON-EMPTY incoming values to the candidate
    row. Preserves prior data when the upload is missing a field. Returns
    a ``{before, after}`` dict for the audit trail.
    """
    cols = ["name", "email", "phone", "email_norm", "phone_norm", "source", "linkedin", "cv_url", "notes"]
    c = conn.cursor()
    before_row = c.execute(
        f"SELECT {', '.join(cols)} FROM candidates WHERE id = ?", (candidate_id,)
    ).fetchone()
    before = dict(zip(cols, before_row)) if before_row else {}

    sets, vals = [], []
    for col in cols:
        v = parsed.get(col)
        if isinstance(v, str):
            v = v.strip()
        if v not in (None, "", []):
            sets.append(f"{col} = ?")
            vals.append(v)
    # Always touch last_seen_at to reflect "this candidate was seen in an upload now".
    sets.append("last_seen_at = ?")
    vals.append(datetime.now(timezone.utc).isoformat())
    vals.append(candidate_id)
    c.execute(f"UPDATE candidates SET {', '.join(sets)} WHERE id = ?", vals)
    after_row = c.execute(
        f"SELECT {', '.join(cols)} FROM candidates WHERE id = ?", (candidate_id,)
    ).fetchone()
    after = dict(zip(cols, after_row)) if after_row else {}
    return {"before": before, "after": after}


def _nullify_empty(v):
    """Coerce empty/blank/'nan' strings to None so SQLite UNIQUE doesn't treat
    them as collisions. ``_normalize_upload_frame`` astype(str) turns NaN into
    the literal string "nan" — without nullifying that, two candidate rows
    with missing email both end up with email='nan' and collide.

    SQLite treats NULL as distinct from any other NULL, so multiple rows with
    empty contact fields can coexist.
    """
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        if not s or s.lower() in ("nan", "none", "null", "n/a", "-"):
            return None
        return s
    return v


def insert_candidate(conn: sqlite3.Connection, parsed: dict, batch_id: str) -> str:
    """Insert a brand-new candidate row. Generates a UUID-style id. Returns id.
    Empty contact fields are stored as NULL — important for the UNIQUE(email)
    constraint on ``candidates``.
    """
    candidate_id = f"CND-{uuid.uuid4().hex[:12].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    c = conn.cursor()
    c.execute(
        """INSERT INTO candidates
           (id, name, email, email_norm, phone, phone_norm, source, linkedin, cv_url, notes,
            first_ingested_batch, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            candidate_id,
            (parsed.get("name") or "").strip() or "ללא שם",
            _nullify_empty(parsed.get("email")),
            _nullify_empty(parsed.get("email_norm")),
            _nullify_empty(parsed.get("phone")),
            _nullify_empty(parsed.get("phone_norm")),
            _nullify_empty(parsed.get("source")),
            _nullify_empty(parsed.get("linkedin")),
            _nullify_empty(parsed.get("cv_url")),
            _nullify_empty(parsed.get("notes")),
            batch_id,
            now,
        ),
    )
    return candidate_id


# ---------------------------------------------------------------------------
# Per-type handlers
# ---------------------------------------------------------------------------


def _ingest_candidates(df: pd.DataFrame, batch_id: str) -> dict:
    """Candidates + jobs + applications (the recruiter ATS funnel).
    Each input row is a "candidate seen on a job at a given iteration".
    """
    stats = _empty_stats()
    stats["received"] = int(len(df))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for _, row in df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            # Accept either alias for the candidate's display name.
            if not parsed.get("name") and parsed.get("candidate_name"):
                parsed["name"] = parsed["candidate_name"]
            # Normalise contact fields.
            raw_phone_norm = normalize_phone(parsed.get("phone"))
            raw_email_norm = normalize_email(parsed.get("email"))

            parsed["phone_norm"] = mask_value(raw_phone_norm)
            parsed["email_norm"] = mask_value(raw_email_norm)
            parsed["phone"] = mask_value(parsed.get("phone"))
            parsed["email"] = mask_value(parsed.get("email"))

            # ---- Candidate dedup/merge ----
            existing_cid = find_existing_candidate(conn, parsed.get("phone_norm"), parsed.get("email_norm"))
            if existing_cid:
                change = merge_candidate(conn, existing_cid, parsed)
                _record_change(conn, batch_id, "candidate", existing_cid, "update", change["before"], change["after"])
                stats["updated"] += 1
                stats["candidates_updated"] += 1
                candidate_id = existing_cid
            else:
                candidate_id = insert_candidate(conn, parsed, batch_id)
                _record_change(conn, batch_id, "candidate", candidate_id, "insert", None, parsed)
                stats["inserted"] += 1
                stats["candidates_inserted"] += 1

            # ---- Job upsert by (job_title, department), case-insensitive ----
            job_title = (parsed.get("job_title") or "").strip()
            dept = (parsed.get("department") or "").strip() or "General"
            job_id = None
            if job_title:
                jrow = conn.execute(
                    "SELECT id FROM jobs WHERE LOWER(job_title) = LOWER(?) AND LOWER(IFNULL(department,'')) = LOWER(?) LIMIT 1",
                    (job_title, dept),
                ).fetchone()
                if jrow:
                    job_id = jrow[0]
                else:
                    job_id = f"JOB-{uuid.uuid4().hex[:10].upper()}"
                    conn.execute(
                        "INSERT INTO jobs (id, job_title, department, hiring_manager, first_ingested_batch, opened_at) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (job_id, job_title, dept, parsed.get("hiring_manager"), batch_id, datetime.now(timezone.utc).isoformat()),
                    )
                    stats["jobs_inserted"] += 1

            # ---- Application iteration (skip exact duplicates) ----
            if candidate_id and job_id:
                sig = iteration_signature(
                    parsed.get("status"), parsed.get("application_date") or parsed.get("start_date"),
                    parsed.get("recruiter"),
                )
                dup = conn.execute(
                    "SELECT app_id FROM applications WHERE candidate_id = ? AND job_id = ? AND iteration_signature = ?",
                    (candidate_id, job_id, sig),
                ).fetchone()
                if dup:
                    stats["skipped_duplicate"] += 1
                    stats["applications_skipped"] += 1
                else:
                    app_id = f"APP-{uuid.uuid4().hex[:10].upper()}"
                    stats["applications_inserted"] += 1
                    days = int(parsed.get("days_in_process") or 0) if parsed.get("days_in_process") is not None else 0
                    conn.execute(
                        """INSERT INTO applications
                           (app_id, candidate_id, job_id, status, recruiter, start_date,
                            days_in_process, stage_code, iteration_signature, application_date, batch_id)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            app_id, candidate_id, job_id,
                            parsed.get("status"), parsed.get("recruiter"),
                            parsed.get("start_date"), days,
                            "ACTIVE",  # canonicalize_statuses will recompute via the lexicon when /candidates is read
                            sig, parsed.get("application_date"), batch_id,
                        ),
                    )
                    _record_change(conn, batch_id, "application", app_id, "insert", None, {
                        "candidate_id": candidate_id, "job_id": job_id, "status": parsed.get("status"),
                        "recruiter": parsed.get("recruiter"), "iteration_signature": sig,
                    })

        _auto_scan_after_ingest(conn, batch_id)
        conn.commit()
    finally:
        conn.close()
    return stats


def _ingest_jobs(df: pd.DataFrame, batch_id: str) -> dict:
    """Pure jobs upsert — no candidate/application side effects."""
    stats = _empty_stats()
    stats["received"] = int(len(df))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for _, row in df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            job_title = (parsed.get("job_title") or "").strip()
            dept = (parsed.get("department") or "").strip() or "General"
            if not job_title:
                stats["rejected"] += 1
                continue
            jrow = conn.execute(
                "SELECT id, job_title, department, hiring_manager, opened_at, closed_at, close_reason, target_count "
                "FROM jobs WHERE LOWER(job_title) = LOWER(?) AND LOWER(IFNULL(department,'')) = LOWER(?) LIMIT 1",
                (job_title, dept),
            ).fetchone()
            if jrow:
                before = {"id": jrow[0], "job_title": jrow[1], "department": jrow[2], "hiring_manager": jrow[3],
                          "opened_at": jrow[4], "closed_at": jrow[5], "close_reason": jrow[6], "target_count": jrow[7]}
                sets, vals = [], []
                for c, k in [("hiring_manager", "hiring_manager"), ("opened_at", "opened_at"),
                             ("closed_at", "closed_at"), ("close_reason", "close_reason"),
                             ("target_count", "target_count")]:
                    v = parsed.get(k)
                    if isinstance(v, str): v = v.strip()
                    if v not in (None, "", []):
                        sets.append(f"{c} = ?")
                        vals.append(v)
                if sets:
                    vals.append(jrow[0])
                    conn.execute(f"UPDATE jobs SET {', '.join(sets)} WHERE id = ?", vals)
                    after = {**before, **{k.split('=')[0].strip(): v for k, v in zip(sets, vals[:-1])}}
                    _record_change(conn, batch_id, "job", jrow[0], "update", before, after)
                    stats["updated"] += 1
                else:
                    stats["skipped_duplicate"] += 1
            else:
                jid = f"JOB-{uuid.uuid4().hex[:10].upper()}"
                conn.execute(
                    """INSERT INTO jobs (id, job_title, department, hiring_manager, opened_at, closed_at,
                                          close_reason, target_count, first_ingested_batch)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (jid, job_title, dept, parsed.get("hiring_manager"),
                     parsed.get("opened_at") or datetime.now(timezone.utc).isoformat(),
                     parsed.get("closed_at"), parsed.get("close_reason"),
                     int(parsed.get("target_count") or 1), batch_id),
                )
                _record_change(conn, batch_id, "job", jid, "insert", None, parsed)
                stats["inserted"] += 1
        conn.commit()
    finally:
        conn.close()
    return stats


def _ingest_hires(df: pd.DataFrame, batch_id: str) -> dict:
    stats = _empty_stats()
    stats["received"] = int(len(df))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for _, row in df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            cand_name = (parsed.get("candidate_name") or "").strip()
            job_title = (parsed.get("job_title") or "").strip()
            hire_date = (parsed.get("hire_date") or "").strip()
            if not cand_name or not job_title or not hire_date:
                stats["rejected"] += 1
                continue
            # Resolve candidate (by phone/email if present, else name match — best effort).
            phone_norm = normalize_phone(parsed.get("phone"))
            email_norm = normalize_email(parsed.get("email"))
            cid = find_existing_candidate(conn, phone_norm, email_norm)
            if not cid:
                cr = conn.execute("SELECT id FROM candidates WHERE LOWER(name) = LOWER(?) LIMIT 1", (cand_name,)).fetchone()
                cid = cr[0] if cr else None
            # Resolve job.
            jrow = conn.execute("SELECT id FROM jobs WHERE LOWER(job_title) = LOWER(?) LIMIT 1", (job_title,)).fetchone()
            jid = jrow[0] if jrow else None
            # Dedup by natural key.
            existing = conn.execute(
                "SELECT id FROM hires WHERE IFNULL(candidate_id,'') = IFNULL(?,'') AND IFNULL(job_id,'') = IFNULL(?,'') AND hire_date = ? LIMIT 1",
                (cid, jid, hire_date),
            ).fetchone()
            if existing:
                stats["skipped_duplicate"] += 1
                continue
            hid = f"HIR-{uuid.uuid4().hex[:10].upper()}"
            conn.execute(
                """INSERT INTO hires (id, candidate_id, job_id, candidate_name, job_title, hire_date,
                                       salary, department, manager, referral_name, is_diversity, batch_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    hid, cid, jid, cand_name, job_title, hire_date,
                    float(parsed.get("salary") or 0) or None,
                    parsed.get("department"), parsed.get("manager"), parsed.get("referral_name"),
                    1 if parsed.get("is_diversity") else 0,
                    batch_id, datetime.now(timezone.utc).isoformat(),
                ),
            )
            _record_change(conn, batch_id, "hire", hid, "insert", None, parsed)
            stats["inserted"] += 1
        conn.commit()
    finally:
        conn.close()
    return stats


def _ingest_diversity(df: pd.DataFrame, batch_id: str) -> dict:
    stats = _empty_stats()
    stats["received"] = int(len(df))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for _, row in df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            month = str(parsed.get("snapshot_month") or "").strip()
            dept = str(parsed.get("department") or "").strip()
            dim = str(parsed.get("dimension") or "").strip()
            bucket = str(parsed.get("bucket") or "").strip()
            try:
                count = int(parsed.get("count") or 0)
            except (TypeError, ValueError):
                count = 0
            if not (month and dept and dim and bucket):
                stats["rejected"] += 1
                continue
            existing = conn.execute(
                "SELECT id, count FROM diversity_snapshots WHERE snapshot_month=? AND department=? AND dimension=? AND bucket=?",
                (month, dept, dim, bucket),
            ).fetchone()
            if existing:
                conn.execute("UPDATE diversity_snapshots SET count=?, batch_id=? WHERE id=?",
                             (count, batch_id, existing[0]))
                _record_change(conn, batch_id, "diversity", str(existing[0]), "update",
                               {"count": existing[1]}, {"count": count})
                stats["updated"] += 1
            else:
                cur = conn.execute(
                    "INSERT INTO diversity_snapshots (snapshot_month, department, dimension, bucket, count, batch_id, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (month, dept, dim, bucket, count, batch_id, datetime.now(timezone.utc).isoformat()),
                )
                _record_change(conn, batch_id, "diversity", str(cur.lastrowid), "insert", None,
                               {"month": month, "dept": dept, "dim": dim, "bucket": bucket, "count": count})
                stats["inserted"] += 1
        conn.commit()
    finally:
        conn.close()
    return stats


def _ingest_headcount(df: pd.DataFrame, batch_id: str) -> dict:
    stats = _empty_stats()
    stats["received"] = int(len(df))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for _, row in df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            month = str(parsed.get("snapshot_month") or "").strip()
            dept = str(parsed.get("department") or "").strip()
            role = str(parsed.get("role") or "").strip()
            if not (month and dept and role):
                stats["rejected"] += 1
                continue
            standard = int(parsed.get("standard") or 0)
            current = int(parsed.get("current") or 0)
            attrition = int(parsed.get("attrition_ytd") or 0)
            hire_plan = int(parsed.get("hire_plan") or 0)
            existing = conn.execute(
                "SELECT id, standard, current FROM headcount_snapshots WHERE snapshot_month=? AND department=? AND role=?",
                (month, dept, role),
            ).fetchone()
            if existing:
                conn.execute(
                    "UPDATE headcount_snapshots SET standard=?, current=?, attrition_ytd=?, hire_plan=?, batch_id=? WHERE id=?",
                    (standard, current, attrition, hire_plan, batch_id, existing[0]),
                )
                _record_change(conn, batch_id, "headcount", str(existing[0]), "update",
                               {"standard": existing[1], "current": existing[2]},
                               {"standard": standard, "current": current})
                stats["updated"] += 1
            else:
                cur = conn.execute(
                    "INSERT INTO headcount_snapshots (snapshot_month, department, role, standard, current, attrition_ytd, hire_plan, batch_id, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (month, dept, role, standard, current, attrition, hire_plan, batch_id, datetime.now(timezone.utc).isoformat()),
                )
                _record_change(conn, batch_id, "headcount", str(cur.lastrowid), "insert", None, parsed)
                stats["inserted"] += 1
        conn.commit()
    finally:
        conn.close()
    return stats


def _ingest_attrition(df: pd.DataFrame, batch_id: str) -> dict:
    stats = _empty_stats()
    stats["received"] = int(len(df))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for _, row in df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            name = (parsed.get("employee_name") or "").strip()
            leave_date = (parsed.get("leave_date") or "").strip()
            if not (name and leave_date):
                stats["rejected"] += 1
                continue
            existing = conn.execute(
                "SELECT id FROM attrition_events WHERE employee_name=? AND leave_date=?",
                (name, leave_date),
            ).fetchone()
            if existing:
                stats["skipped_duplicate"] += 1
                continue
            # Best-effort candidate link.
            phone_norm = normalize_phone(parsed.get("phone"))
            email_norm = normalize_email(parsed.get("email"))
            cid = find_existing_candidate(conn, phone_norm, email_norm)
            aid = f"ATR-{uuid.uuid4().hex[:10].upper()}"
            conn.execute(
                """INSERT INTO attrition_events
                   (id, employee_name, candidate_id, leave_date, department, manager, last_role,
                    reason, voluntary, batch_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    aid, name, cid, leave_date,
                    parsed.get("department"), parsed.get("manager"), parsed.get("last_role"),
                    parsed.get("reason"),
                    1 if str(parsed.get("voluntary") or "").lower() in ("true", "yes", "כן", "1") else 0,
                    batch_id, datetime.now(timezone.utc).isoformat(),
                ),
            )
            _record_change(conn, batch_id, "attrition", aid, "insert", None, parsed)
            stats["inserted"] += 1
        conn.commit()
    finally:
        conn.close()
    return stats


def _ingest_budget(df: pd.DataFrame, batch_id: str) -> dict:
    """Budget = finops_invoices. Uses the existing UNIQUE(id) constraint on
    invoice id; falls back to (vendor, date, amount, category) signature when
    incoming id is missing."""
    stats = _empty_stats()
    stats["received"] = int(len(df))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for _, row in df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            inv_id = (parsed.get("id") or "").strip() or f"INV-{uuid.uuid4().hex[:8].upper()}"
            vendor = (parsed.get("vendor") or "").strip()
            date_str = (parsed.get("date") or "").strip()
            try:
                amount = float(parsed.get("amount") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            category = (parsed.get("category") or "כללי").strip()
            if not vendor or not date_str:
                stats["rejected"] += 1
                continue
            existing = conn.execute("SELECT id FROM finops_invoices WHERE id = ?", (inv_id,)).fetchone()
            if existing:
                conn.execute(
                    """UPDATE finops_invoices SET vendor=?, date=?, due_date=?, budget_month=?,
                       amount=?, category=?, subcategory=?, status=?, note=?, file_url=? WHERE id=?""",
                    (vendor, date_str, parsed.get("due_date") or "", parsed.get("budget_month") or "",
                     amount, category, parsed.get("subcategory") or "",
                     parsed.get("status") or "ממתין למיפוי", parsed.get("note") or "",
                     parsed.get("file_url") or "", inv_id),
                )
                _record_change(conn, batch_id, "invoice", inv_id, "update", None, parsed)
                stats["updated"] += 1
            else:
                conn.execute(
                    """INSERT INTO finops_invoices (id, vendor, date, due_date, budget_month, amount,
                       category, subcategory, status, note, file_url)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (inv_id, vendor, date_str, parsed.get("due_date") or "", parsed.get("budget_month") or "",
                     amount, category, parsed.get("subcategory") or "",
                     parsed.get("status") or "ממתין למיפוי", parsed.get("note") or "",
                     parsed.get("file_url") or ""),
                )
                _record_change(conn, batch_id, "invoice", inv_id, "insert", None, parsed)
                stats["inserted"] += 1
        conn.commit()
    finally:
        conn.close()
    return stats


INGEST_HANDLERS = {
    "candidates": _ingest_candidates,
    "jobs": _ingest_jobs,
    "hires": _ingest_hires,
    "diversity": _ingest_diversity,
    "headcount": _ingest_headcount,
    "budget": _ingest_budget,
    "attrition": _ingest_attrition,
}
