"""Candidate endpoints — list, detail, create, stage advance, edit, soft-delete.

Six routes that drive the candidates view + side panel:

    GET    /api/candidates                   (alias /candidates)
    GET    /api/candidates/{candidate_key}
    POST   /api/candidates                   — manual create + inline application
    PATCH  /api/candidates/{candidate_key}/stage
    PATCH  /api/candidates/{candidate_id}
    DELETE /api/candidates/{candidate_id}

Auth gates:
- list, detail, stage, create: ADMIN | HRBP | RECRUITER | HIRING_MANAGER
- edit, delete:                ADMIN | HRBP

POST /api/candidates was added in A9-FU UX wave 3 so a recruiter can
add one person via a form instead of downloading an Excel template,
filling one row, and uploading. It reuses the same dedup / insert
primitives that the Excel ingest handlers use (insert_candidate +
find_existing_candidate) so behaviour and audit trail match the bulk
path exactly.
"""

import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from utils import _nan_safe_records, iteration_signature, mask_value, normalize_email, normalize_phone
from ingestion import find_existing_candidate, insert_candidate
from pipeline import _compute_unified_stage, get_unified_data
from typing import Optional

import config as shared_config
from audit import _create_manual_edit_batch, _record_change, bump_data_version, log_audit_action
from auth import require_dual_role
from constants import Role, UNIFIED_STAGES
from db import db_conn
from schemas import CandidateCreatePayload, CandidateEditPayload


router = APIRouter(tags=["candidates"])


# --- Late-bound proxies to helpers still in main.py ----------------------












# --- Routes ---------------------------------------------------------------


@router.get("/api/candidates")
@router.get("/candidates")
def get_candidates(
    page: int = 1,
    limit: int = 50,
    search: str = "",
    sort_by: str = "days_in_process",
    sort_dir: str = "desc",
    stage: str = "",
    recruiter: str = "",
    dept: str = "",
    job_id: str = "",
    days_min: Optional[int] = None,
    days_max: Optional[int] = None,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER, Role.HIRING_MANAGER)),
):
    """Unified pipeline + onboarding view.

    Returns rows with `unified_stage` (SCREEN/INTERVIEW/OFFER/HIRED/AWAITING_START/STARTED/REJECTED)
    plus an aggregation `total_by_stage` covering ALL rows (pre-filtering by `stage`)
    so frontend chips show real counts even after filtering.
    """
    offset = (page - 1) * limit
    conn = sqlite3.connect(shared_config.DB_NAME)

    try:
        df = get_unified_data(conn)
    except Exception:
        return {"data": [], "page": page, "total": 0, "total_by_stage": {s: 0 for s in UNIFIED_STAGES}}
    finally:
        conn.close()

    if df.empty:
        return {"data": [], "page": page, "total": 0, "total_by_stage": {s: 0 for s in UNIFIED_STAGES}}

    # Compute unified_stage once on the whole frame (used by the chips count too).
    df["unified_stage"] = df.apply(
        lambda row: _compute_unified_stage(row.get("stage_code"), row.get("onboarding_status")),
        axis=1,
    )

    # Apply non-stage filters first so chip counts reflect the user's other choices.
    if search:
        mask = (
            df["candidate_name"].astype(str).str.contains(search, case=False, na=False)
            | df["job_title"].astype(str).str.contains(search, case=False, na=False)
            | df["recruiter"].astype(str).str.contains(search, case=False, na=False)
        )
        df = df[mask]
    if recruiter:
        df = df[df["recruiter"].astype(str).str.contains(recruiter, case=False, na=False)]
    if dept:
        df = df[df["department"].astype(str).str.contains(dept, case=False, na=False)]
    if job_id:
        df = df[df["job_id"].astype(str) == str(job_id)]
    if days_min is not None:
        df = df[df["days_in_process"].fillna(0).astype(int) >= int(days_min)]
    if days_max is not None:
        df = df[df["days_in_process"].fillna(0).astype(int) <= int(days_max)]

    # Compute chip counts BEFORE the stage filter — so users still see how
    # many candidates are in each stage given their other filters.
    counts = df["unified_stage"].value_counts().to_dict()
    total_by_stage = {s: int(counts.get(s, 0)) for s in UNIFIED_STAGES}
    total_by_stage["ALL"] = int(len(df))

    # Now apply the stage filter for the actual page payload.
    if stage:
        df = df[df["unified_stage"] == stage.upper()]

    # Sort — accept both legacy and new sort keys.
    valid_columns = {
        "candidate_name": "candidate_name",
        "job_title": "job_title",
        "status": "status",
        "recruiter": "recruiter",
        "days_in_process": "days_in_process",
        "department": "department",
        "unified_stage": "unified_stage",
    }
    safe_sort_col = valid_columns.get(sort_by, "days_in_process")
    ascending = sort_dir.lower() == "asc"
    df = df.sort_values(safe_sort_col, ascending=ascending)

    total = len(df)
    df_page = df.iloc[offset:offset + limit]
    return {
        "data": _nan_safe_records(df_page),
        "page": page,
        "total": total,
        "total_by_stage": total_by_stage,
    }


@router.get("/api/candidates/{candidate_key}")
def get_candidate_detail(
    candidate_key: str,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER, Role.HIRING_MANAGER)),
):
    """Detail view for a single candidate. The path key matches by
    candidate.id, candidate name (LOWER), or onboarding.id_num — whichever
    hits first. Returns the row from the unified frame plus the matching
    onboarding record (if any) and the latest 10 audit log lines.
    """
    with db_conn() as conn:
        try:
            df = get_unified_data(conn)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Pipeline read failed: {exc}") from exc

        if df.empty:
            raise HTTPException(status_code=404, detail="המועמד לא נמצא")

        df["unified_stage"] = df.apply(
            lambda row: _compute_unified_stage(row.get("stage_code"), row.get("onboarding_status")),
            axis=1,
        )

        key = (candidate_key or "").strip().lower()
        matches = df[
            (df["candidate_id"].astype(str).str.lower() == key)
            | (df["candidate_name"].astype(str).str.lower() == key)
            | (df["id_num"].astype(str).str.lower() == key)
        ]

        if matches.empty:
            raise HTTPException(status_code=404, detail="המועמד לא נמצא")

        # Pick the most recent application row for this candidate.
        candidate_row = matches.sort_values("start_date", ascending=False).iloc[0].to_dict()

        # Onboarding (full record) if linked.
        onboarding = None
        if candidate_row.get("onboarding_id"):
            c = conn.cursor()
            c.execute("SELECT * FROM onboarding WHERE id = ?", (candidate_row["onboarding_id"],))
            cols = [d[0] for d in c.description]
            row = c.fetchone()
            if row:
                onboarding = dict(zip(cols, row))

        # Recent audit logs that mention this candidate (best-effort).
        audit_logs: list[dict] = []
        name = candidate_row.get("candidate_name", "")
        if name:
            try:
                c = conn.cursor()
                c.execute(
                    "SELECT id, timestamp, action, status, details, user FROM audit_logs "
                    "WHERE details LIKE ? ORDER BY timestamp DESC LIMIT 10",
                    (f"%{name}%",),
                )
                audit_logs = [
                    {"id": r[0], "timestamp": r[1], "action": r[2], "status": r[3], "details": r[4], "user": r[5]}
                    for r in c.fetchall()
                ]
            except sqlite3.OperationalError:
                audit_logs = []

    return {
        "candidate": candidate_row,
        "onboarding": onboarding,
        "audit_logs": audit_logs,
    }


@router.post("/api/candidates", status_code=201)
def create_candidate(
    payload: CandidateCreatePayload,
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    """Create one candidate, with an optional inline application row.

    Mirrors the candidate-ingest path so behaviour is identical to a
    single-row Excel upload:

    * Normalises phone / email and masks them with the same helpers
      (``normalize_phone`` / ``normalize_email`` / ``mask_value``) so
      the resulting ``phone_norm`` / ``email_norm`` columns match what
      the Excel pipeline would produce.
    * Dedup via ``find_existing_candidate`` — if a candidate with the
      same masked phone or email already exists, returns **409** with
      ``conflicting_id`` and ``conflicting_name``. The UI uses that to
      offer "add a job to the existing candidate" instead of forcing a
      duplicate. Same shape as the PATCH conflict response below.
    * Creates a per-edit audit batch (``EDIT-CAN-*``) via
      ``_create_manual_edit_batch`` and records the insert in
      ``batch_entity_changes`` so the existing revert flow works on
      manually-created candidates too.
    * Bumps the global data_version so the frontend re-fetches its
      candidates list automatically.

    If ``job_id`` is provided, an ``applications`` row is also inserted
    in the same transaction (this is the 90% case — recruiter creates
    a candidate they just interviewed for a specific job).
    """
    actor = user.get("email", "user")

    # Step 1: normalise + mask exactly like the ingest path does.
    raw_phone_norm = normalize_phone(payload.phone)
    raw_email_norm = normalize_email(payload.email)
    parsed = {
        "name": payload.name.strip(),
        "phone": mask_value(payload.phone),
        "email": mask_value(payload.email),
        "phone_norm": mask_value(raw_phone_norm),
        "email_norm": mask_value(raw_email_norm),
        "source": payload.source,
        "notes": payload.notes,
        "linkedin": payload.linkedin,
        "cv_url": payload.cv_url,
    }

    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        # Step 2: dedup gate — refuse if phone or email collides.
        existing_id = find_existing_candidate(conn, parsed["phone_norm"], parsed["email_norm"])
        if existing_id:
            row = conn.execute(
                "SELECT id, name FROM candidates WHERE id = ?", (existing_id,)
            ).fetchone()
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "CANDIDATE_CONFLICT",
                    "message": f"מועמד עם טלפון/אימייל זה כבר קיים: {row[1] if row else existing_id}",
                    "conflicting_id": existing_id,
                    "conflicting_name": row[1] if row else None,
                },
            )

        # Step 3: insert candidate using the shared primitive so the audit
        # trail matches the ingest path bit-for-bit.
        batch_id = _create_manual_edit_batch("candidate", "new", actor)
        candidate_id = insert_candidate(conn, parsed, batch_id)
        _record_change(conn, batch_id, "candidate", candidate_id, "insert", None, parsed)

        # Step 4: optional inline application.
        application_id: Optional[str] = None
        if payload.job_id:
            # Verify the job exists so we fail fast with a clean message
            # rather than dropping a dangling application.
            jrow = conn.execute("SELECT id FROM jobs WHERE id = ?", (payload.job_id,)).fetchone()
            if not jrow:
                conn.rollback()
                raise HTTPException(status_code=400, detail=f"job_id לא נמצא: {payload.job_id}")
            now_iso = datetime.now(timezone.utc).isoformat()
            sig = iteration_signature(payload.status, now_iso, payload.recruiter)
            application_id = f"APP-{uuid.uuid4().hex[:10].upper()}"
            conn.execute(
                """INSERT INTO applications
                   (app_id, candidate_id, job_id, status, recruiter, start_date,
                    days_in_process, stage_code, iteration_signature, application_date, batch_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    application_id, candidate_id, payload.job_id,
                    payload.status, payload.recruiter,
                    now_iso, 0,
                    "ACTIVE",  # the runtime status lexicon recomputes this when /candidates is read
                    sig, now_iso, batch_id,
                ),
            )
            _record_change(conn, batch_id, "application", application_id, "insert", None, {
                "candidate_id": candidate_id, "job_id": payload.job_id,
                "status": payload.status, "recruiter": payload.recruiter,
                "iteration_signature": sig,
            })

        conn.commit()
    finally:
        conn.close()

    log_audit_action(
        "CANDIDATE_CREATE", "ok",
        f"id={candidate_id} job_id={payload.job_id or '-'} batch={batch_id}",
        user=actor,
    )
    bump_data_version()
    return {
        "status": "created",
        "candidate_id": candidate_id,
        "application_id": application_id,
        "batch_id": batch_id,
    }


@router.get("/api/taxonomy/closure-reasons")
def list_closure_reasons(
    closure_type: str | None = None,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER, Role.HIRING_MANAGER)),
):
    """Return the active closure-reason taxonomy.

    The stage-change UI calls this to populate the dropdown a recruiter
    sees when she moves a candidate into REJECTED or WITHDRAWN. Filter
    by ``closure_type=rejected|withdrawn`` to get just the half you
    need for one dropdown.

    Inactive rows (``is_active=0``) are never returned — admin can hide
    a reason without code changes by flipping that flag, and existing
    PATCH requests carrying the old code will be rejected with
    ``CLOSURE_REASON_INACTIVE``.
    """
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        sql = ("SELECT code, label_he, closure_type, sort_order, captured_by_default "
               "FROM closure_taxonomy WHERE is_active = 1")
        params: list = []
        if closure_type:
            sql += " AND closure_type = ?"
            params.append(closure_type.strip().lower())
        sql += " ORDER BY closure_type, sort_order"
        rows = conn.execute(sql, params).fetchall()
        return [
            {
                "code": r[0], "label_he": r[1], "closure_type": r[2],
                "sort_order": r[3], "captured_by_default": r[4],
            }
            for r in rows
        ]
    finally:
        conn.close()


@router.patch("/api/candidates/{candidate_key}/stage")
def advance_candidate_stage(
    candidate_key: str,
    payload: dict,
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER, Role.HIRING_MANAGER)),
):
    """Advance (or change) a candidate's stage.

    Body:
        stage_code           (str)  — new UNIFIED_STAGES value
        notes                (str, optional) — free-text reason / comment
        closure_reason_code  (str)  — REQUIRED when stage_code is REJECTED
                                       or WITHDRAWN; one of
                                       closure_taxonomy.code
        closure_stage        (str, optional) — funnel stage at which the
                                       closure happened (defaults to the
                                       current stage if omitted)
        captured_by          (str, optional) — 'recruiter' / 'bot' /
                                       'system'; auto-defaulted from the
                                       taxonomy entry's
                                       captured_by_default when omitted

    Audit Phase 4 / Wave D enforces that closures carry a structured
    reason — the dashboard pies + the בקרת איכות screen depend on it.
    """
    stage_code = (payload.get("stage_code") or "").strip().upper()
    notes = (payload.get("notes") or "").strip()
    closure_reason_code = (payload.get("closure_reason_code") or "").strip().upper()
    closure_stage = (payload.get("closure_stage") or "").strip().upper() or None
    captured_by = (payload.get("captured_by") or "").strip().lower() or None

    if stage_code not in UNIFIED_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"stage_code חייב להיות אחד מ: {', '.join(UNIFIED_STAGES)}"
        )

    # Closure enforcement: rejecting or withdrawing requires a reason.
    # Validate against the live taxonomy so the frontend can edit /
    # add reasons without a code change here.
    closure_type: str | None = None
    if stage_code in {"REJECTED", "WITHDRAWN"}:
        if not closure_reason_code:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "CLOSURE_REASON_REQUIRED",
                    "message": "מעבר ל-REJECTED או WITHDRAWN דורש closure_reason_code מתוך closure_taxonomy.",
                    "stage_code": stage_code,
                },
            )
        # Look up the taxonomy entry so we can fill closure_type +
        # captured_by_default authoritatively, and to reject codes that
        # don't match the closure_type implied by the stage.
        expected_closure_type = "rejected" if stage_code == "REJECTED" else "withdrawn"
        check_conn = sqlite3.connect(shared_config.DB_NAME)
        try:
            row = check_conn.execute(
                "SELECT closure_type, captured_by_default, is_active FROM closure_taxonomy WHERE code = ?",
                (closure_reason_code,),
            ).fetchone()
        finally:
            check_conn.close()
        if not row:
            raise HTTPException(
                status_code=400,
                detail={"code": "CLOSURE_REASON_NOT_FOUND",
                        "message": f"closure_reason_code '{closure_reason_code}' לא קיים ב-closure_taxonomy."},
            )
        if int(row[2] or 0) == 0:
            raise HTTPException(
                status_code=400,
                detail={"code": "CLOSURE_REASON_INACTIVE",
                        "message": f"closure_reason_code '{closure_reason_code}' מסומן כלא פעיל."},
            )
        if row[0] != expected_closure_type:
            raise HTTPException(
                status_code=400,
                detail={"code": "CLOSURE_REASON_TYPE_MISMATCH",
                        "message": f"הסיבה '{closure_reason_code}' היא מסוג '{row[0]}' אבל השלב {stage_code} דורש מסוג '{expected_closure_type}'."},
            )
        closure_type = expected_closure_type
        if not captured_by:
            captured_by = row[1] or "recruiter"  # default captured_by from the taxonomy

    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        # Resolve candidate key → application row
        df = get_unified_data(conn)
        if df.empty:
            raise HTTPException(status_code=404, detail="המועמד לא נמצא")

        key = (candidate_key or "").strip().lower()
        matches = df[
            (df["candidate_id"].astype(str).str.lower() == key)
            | (df["candidate_name"].astype(str).str.lower() == key)
            | (df["id_num"].astype(str).str.lower() == key)
        ]
        if matches.empty:
            raise HTTPException(status_code=404, detail="המועמד לא נמצא")

        row = matches.sort_values("start_date", ascending=False).iloc[0]
        app_id = row.get("app_id") or row.get("candidate_id")
        candidate_name = row.get("candidate_name", "")
        old_stage = row.get("stage_code", "")

        c = conn.cursor()

        # Map UNIFIED_STAGES back to a Hebrew status label for display.
        # Updated in Audit Phase 4 / Wave B to cover the 7 new stages that
        # mirror the real ATS terminology (PHONE_INTERVIEW, HR_INTERVIEW,
        # MANAGER_INTERVIEW, TESTS, REFERENCES, WITHDRAWN, NO_RESPONSE,
        # SOURCING). Unknown codes fall back to the stage_code itself via
        # the .get(stage_code, stage_code) lookup below.
        STAGE_TO_STATUS = {
            "ACTIVE":            "פעיל",
            "SOURCING":          "הגיש מועמדות",
            "SCREEN":            "סינון",
            "PHONE_INTERVIEW":   "ראיון טלפוני",
            "HR_INTERVIEW":      "ראיון HR",
            "MANAGER_INTERVIEW": "ראיון מנהל מקצועי",
            "INTERVIEW":         "ראיון",
            "TESTS":             "מבדקים",
            "REFERENCES":        "בדיקת ממליצים",
            "OFFER":             "הצעה",
            "HIRED":             "גיוס",
            "AWAITING_START":    "ממתין לקליטה",
            "STARTED":           "קליטה",
            "REJECTED":          "דחייה",
            "WITHDRAWN":         "הסרת מועמדות",
            "NO_RESPONSE":       "אין מענה",
        }
        new_status = STAGE_TO_STATUS.get(stage_code, stage_code)
        now_iso = datetime.now(timezone.utc).isoformat()

        # When the transition is a closure, also persist the structured
        # closure fields. When it's NOT a closure (e.g. moving from
        # REJECTED back to ACTIVE — happens when an admin un-archives a
        # candidate), clear those columns so we don't keep stale data.
        if closure_type:
            effective_closure_stage = closure_stage or old_stage or "ACTIVE"
        else:
            effective_closure_stage = None

        # Try updating applications table first.
        # Note: `applications` doesn't have an `updated_at` column —
        # the previous version of this UPDATE included it and was
        # silently failing every call (caught by the bare except).
        # Audit Phase 4 / Wave D removes the phantom column and adds a
        # passing test that pins this behaviour.
        updated = 0
        try:
            c.execute(
                """UPDATE applications
                   SET stage_code = ?, status = ?,
                       closure_type = ?, closure_stage = ?,
                       closure_reason_code = ?, captured_by = ?
                   WHERE app_id = ?""",
                (
                    stage_code, new_status,
                    closure_type, effective_closure_stage,
                    closure_reason_code or None, captured_by,
                    str(app_id),
                ),
            )
            updated = c.rowcount
        except Exception:
            pass

        # Fallback: update candidates table if applications didn't work
        # (older rows / candidate-level stage tracking). The closure
        # columns live only on applications, so we don't try to set
        # them here.
        if not updated:
            try:
                c.execute(
                    "UPDATE candidates SET stage_code = ?, status = ? WHERE id = ?",
                    (stage_code, new_status, str(app_id))
                )
                updated = c.rowcount
            except Exception:
                pass

        if not updated:
            raise HTTPException(status_code=404, detail="לא ניתן לעדכן — מועמד לא נמצא ב-DB")

        # Log stage transition to audit_logs
        details = f"Stage changed: {old_stage} → {stage_code}"
        if notes:
            details += f" | {notes}"
        try:
            c.execute(
                "INSERT INTO audit_logs (id, timestamp, action, status, details, user) VALUES (?,?,?,?,?,?)",
                (str(uuid.uuid4()), now_iso, "STAGE_CHANGE", "info", f"{candidate_name}: {details}", user.get("email", "system"))
            )
        except Exception:
            pass  # audit log failure should not block the update

        conn.commit()
    finally:
        conn.close()

    log_audit_action("STAGE_CHANGE", "info", f"{candidate_name}: {old_stage}→{stage_code}", user.get("email"))
    return {
        "status": "ok",
        "candidate": candidate_key,
        "old_stage": old_stage,
        "new_stage": stage_code,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.patch("/api/candidates/{candidate_id}")
def edit_candidate(
    candidate_id: str,
    payload: CandidateEditPayload,
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Direct candidate field editor with phone/email conflict detection."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="מועמד לא נמצא")
        before = dict(row)
        updates: dict = {}

        if payload.phone is not None:
            new_norm = normalize_phone(payload.phone)
            masked_new_norm = mask_value(new_norm)
            if masked_new_norm and masked_new_norm != before.get("phone_norm"):
                conflict = conn.execute(
                    "SELECT id, name FROM candidates WHERE phone_norm = ? AND id != ?",
                    (masked_new_norm, candidate_id),
                ).fetchone()
                if conflict:
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "code": "PHONE_CONFLICT",
                            "message": f"הטלפון כבר שייך ל-{conflict['name']}",
                            "conflicting_id": conflict["id"],
                            "conflicting_name": conflict["name"],
                        },
                    )
            updates["phone"] = mask_value(payload.phone)
            updates["phone_norm"] = masked_new_norm

        if payload.email is not None:
            new_email_norm = normalize_email(payload.email)
            masked_new_email_norm = mask_value(new_email_norm)
            if masked_new_email_norm and masked_new_email_norm != before.get("email_norm"):
                conflict = conn.execute(
                    "SELECT id, name FROM candidates WHERE email_norm = ? AND id != ?",
                    (masked_new_email_norm, candidate_id),
                ).fetchone()
                if conflict:
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "code": "EMAIL_CONFLICT",
                            "message": f"האימייל כבר שייך ל-{conflict['name']}",
                            "conflicting_id": conflict["id"],
                            "conflicting_name": conflict["name"],
                        },
                    )
            updates["email"] = mask_value(payload.email)
            updates["email_norm"] = masked_new_email_norm

        for field in ("name", "source", "notes", "linkedin", "cv_url"):
            val = getattr(payload, field, None)
            if val is not None:
                updates[field] = val

        if not updates:
            return {"status": "no_change", "candidate": before}

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE candidates SET {set_clause} WHERE id = ?",
            [*updates.values(), candidate_id],
        )
        after = dict(
            conn.execute("SELECT * FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        )
        batch_id = _create_manual_edit_batch("candidate", candidate_id, user.get("email", "admin"))
        _record_change(conn, batch_id, "candidate", candidate_id, "update", before, after)
        conn.commit()
        log_audit_action(
            "CANDIDATE_EDIT", "ok",
            f"id={candidate_id} fields={list(updates.keys())}",
            user=user.get("email", "admin"),
        )
        bump_data_version()
        return {"status": "updated", "candidate": after}
    finally:
        conn.close()


@router.delete("/api/candidates/{candidate_id}")
def delete_candidate(
    candidate_id: str,
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Soft delete candidate and their associated applications."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        cand = c.execute("SELECT id, name FROM candidates WHERE id = ?", (candidate_id,)).fetchone()
        if not cand:
            raise HTTPException(status_code=404, detail="מועמד לא נמצא")

        c.execute("UPDATE candidates SET is_active = 0 WHERE id = ?", (candidate_id,))
        c.execute("UPDATE applications SET is_active = 0 WHERE candidate_id = ?", (candidate_id,))

        batch_id = _create_manual_edit_batch("candidate", candidate_id, user.get("email", "admin"))
        _record_change(conn, batch_id, "candidate", candidate_id, "delete", {"id": cand[0], "name": cand[1]}, None)
        conn.commit()

        log_audit_action(
            "CANDIDATE_DELETE", "ok",
            f"id={candidate_id} name={cand[1]}",
            user=user.get("email", "admin"),
        )
        bump_data_version()
        return {"status": "deleted", "candidate_id": candidate_id}
    finally:
        conn.close()
