"""Job endpoints — list, candidates-by-job, bulk update, edit, soft-delete,
plus the neglect-alerts radar.

Six routes that drive the jobs view and admin job-health panel:

    GET    /api/jobs  (alias /jobs)            — summary list per title
    POST   /api/jobs/bulk-update               — close / set-status / assign
    GET    /jobs/neglect-alerts                — radar of neglected jobs
    GET    /api/jobs/{job_key}/candidates      — pipeline drilldown
    PATCH  /api/jobs/{job_id}                  — direct edit
    DELETE /api/jobs/{job_id}                  — soft delete + cascade

Auth gates preserved exactly:
  list / detail / drilldown → ADMIN | HRBP | RECRUITER | HIRING_MANAGER
  edit / delete             → ADMIN | HRBP
  bulk_update               → ADMIN
  neglect-alerts            → unauthenticated  (matches main.py behaviour;
                              the endpoint reads from cache + public data)

Endpoint bodies are reproduced verbatim from main.py — pure relocation,
zero observable API change.
"""

import json
import sqlite3

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from utils import _normalize_score, _safe_pct, _to_int
from pipeline import _compute_unified_stage, _get_orphan_jobs, get_unified_data

import config as shared_config
from audit import _create_manual_edit_batch, _record_change, bump_data_version, log_audit_action
from auth import require_admin, require_dual_role
from constants import Role, UNIFIED_STAGES
from db import db_conn
from internal_logic import get_cached_response, set_cached_response
from schemas import JobEditPayload, JobsBulkUpdatePayload


router = APIRouter(tags=["jobs"])


# --- Late-bound proxies to helpers still in main.py ----------------------












def _admin_config_defaults():
    from main import ADMIN_CONFIG_DEFAULTS
    return ADMIN_CONFIG_DEFAULTS


# --- Routes ---------------------------------------------------------------


@router.get("/api/jobs")
@router.get("/jobs")
def get_jobs(
    status: str = "all",
    department: str = "",
    search: str = "",
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER, Role.HIRING_MANAGER)),
):
    """Returns jobs (open + closed by default) with per-stage candidate breakdown.

    Query param `status`:
      - "all"    (default) — both open and closed
      - "open"   — only is_active=true
      - "closed" — only is_active=false
    """
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        df = get_unified_data(conn)
    except Exception:
        return []
    finally:
        conn.close()

    if df.empty:
        jobs_summary = []
    else:
        closed_statuses = ['קליטה', 'גיוס', 'התקבל', 'דחייה', 'הסרה', 'ויתור', 'הקפאה', 'נדחה']
        df['is_active'] = ~df['status'].astype(str).str.contains('|'.join(closed_statuses), case=False, na=False)
        df['unified_stage'] = df.apply(
            lambda row: _compute_unified_stage(row.get('stage_code'), row.get('onboarding_status')),
            axis=1,
        )

        jobs_summary = []
        for job_title, group in df.groupby('job_title'):
            # A job is "active" if at least one of its applications is still active.
            is_active = bool(group['is_active'].any())
            active_group = group[group['is_active']]

            active_candidates_count = int(len(active_group))
            total_candidates_count = int(len(group))
            avg_days = int(active_group['days_in_process'].mean()) if len(active_group) else 0
            max_days = int(active_group['days_in_process'].max()) if len(active_group) else 0
            sla_breaches = int(len(active_group[active_group['days_in_process'] > 40]))

            stage_counts = group['unified_stage'].value_counts().to_dict()
            stage_breakdown = {s: int(stage_counts.get(s, 0)) for s in UNIFIED_STAGES}

            department_name = group['department'].iloc[0] if pd.notna(group['department'].iloc[0]) else "כללי"
            recruiter = group['recruiter'].iloc[0] if pd.notna(group['recruiter'].iloc[0]) else "לא שויך"
            closed_at = None
            close_reason = None
            if not is_active:
                closed_rows = group[~group['is_active']]
                if not closed_rows.empty:
                    latest = closed_rows.sort_values('start_date', ascending=False).iloc[0]
                    closed_at = str(latest['start_date']) if pd.notna(latest['start_date']) else None
                    close_reason = str(latest['status']) if pd.notna(latest['status']) else None

            job_id_val = group['job_id'].iloc[0] if 'job_id' in group.columns and pd.notna(group['job_id'].iloc[0]) else None

            jobs_summary.append({
                "job_id": job_id_val,
                "job_title": job_title,
                "department": department_name,
                "recruiter": recruiter,
                "is_active": is_active,
                "active_candidates": active_candidates_count,
                "total_candidates": total_candidates_count,
                "avg_days": avg_days,
                "max_days": max_days,
                "sla_breaches": sla_breaches,
                "health": "danger" if sla_breaches > 2 else "warning" if sla_breaches > 0 else "good",
                "stage_breakdown": stage_breakdown,
                "closed_at": closed_at,
                "close_reason": close_reason,
            })

    status_norm = (status or "all").lower()
    if status_norm == "open":
        jobs_summary = [j for j in jobs_summary if j["is_active"]]
    elif status_norm == "closed":
        jobs_summary = [j for j in jobs_summary if not j["is_active"]]

    if department:
        jobs_summary = [j for j in jobs_summary if department.lower() in (j.get("department") or "").lower()]

    if search:
        jobs_summary = [j for j in jobs_summary
                        if search.lower() in (j.get("job_title") or "").lower()
                        or search.lower() in (j.get("department") or "").lower()]

    orphans = _get_orphan_jobs()
    known_titles = {j["job_title"] for j in jobs_summary}
    for oj in orphans:
        if oj["job_title"] not in known_titles:
            jobs_summary.append(oj)

    jobs_summary.sort(
        key=lambda x: (not x["is_active"], -x["sla_breaches"], -x["max_days"]),
    )
    return jobs_summary


@router.post("/api/jobs/bulk-update")
def bulk_update_jobs(payload: JobsBulkUpdatePayload, _: str = Depends(require_admin)):
    job_titles = [title for title in payload.job_titles if title]
    if not job_titles:
        raise HTTPException(status_code=400, detail="job_titles is required")
    conn = sqlite3.connect(shared_config.DB_NAME)
    affected = 0
    try:
        c = conn.cursor()
        placeholders = ",".join("?" for _ in job_titles)
        if payload.action == "close":
            c.execute(
                f"UPDATE applications SET status = 'הקפאה' WHERE app_id IN (SELECT a.app_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.job_title IN ({placeholders}))",
                job_titles,
            )
        elif payload.action == "set_status":
            if not payload.status:
                raise HTTPException(status_code=400, detail="status is required for set_status")
            c.execute(
                f"UPDATE applications SET status = ? WHERE app_id IN (SELECT a.app_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.job_title IN ({placeholders}))",
                [payload.status, *job_titles],
            )
        elif payload.action == "assign_recruiter":
            if not payload.recruiter:
                raise HTTPException(status_code=400, detail="recruiter is required for assign_recruiter")
            c.execute(
                f"UPDATE applications SET recruiter = ? WHERE app_id IN (SELECT a.app_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.job_title IN ({placeholders}))",
                [payload.recruiter, *job_titles],
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported action")
        affected = c.rowcount
        conn.commit()
    finally:
        conn.close()
    log_audit_action(
        "JOBS_BULK_UPDATE",
        "Warning",
        f"action={payload.action} | affected={affected}",
        "Admin",
    )
    return {"status": "success", "affected": affected}


@router.get("/jobs/neglect-alerts")
def get_neglect_alerts(limit: int = 5):
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        cache_params = {"limit": max(1, min(limit, 20))}
        cached = get_cached_response(conn, "neglect_alerts", cache_params)
        if cached is not None:
            return cached

        thresholds = _admin_config_defaults()["neglectThresholds"].copy()
        try:
            c = conn.cursor()
            c.execute("SELECT value FROM system_settings WHERE key='admin_config'")
            row = c.fetchone()
            if row and row[0]:
                admin_cfg = json.loads(row[0])
                configured = admin_cfg.get("neglectThresholds", {})
                thresholds.update(
                    {
                        "slaDaysThreshold": _to_int(configured.get("slaDaysThreshold"), thresholds["slaDaysThreshold"]),
                        "lowCandidatesThreshold": _to_int(configured.get("lowCandidatesThreshold"), thresholds["lowCandidatesThreshold"]),
                        "pendingCvThreshold": _to_int(configured.get("pendingCvThreshold"), thresholds["pendingCvThreshold"]),
                        "staleActionDaysThreshold": _to_int(configured.get("staleActionDaysThreshold"), thresholds["staleActionDaysThreshold"]),
                        "criticalScoreThreshold": _to_int(configured.get("criticalScoreThreshold"), thresholds["criticalScoreThreshold"]),
                    }
                )
        except Exception:
            pass

        df = get_unified_data(conn)
        if df.empty:
            return {
                "thresholds": thresholds,
                "summary": {
                    "total_neglected_jobs": 0,
                    "critical_jobs": 0,
                    "stale_jobs_5d": 0,
                    "recruiters_impacted": 0,
                },
                "top_jobs": [],
                "recruiter_summary": [],
                "weekly_trend": [],
            }

        df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
        df["days_in_process"] = pd.to_numeric(df["days_in_process"], errors="coerce").fillna(0).astype(int)
        closed_statuses = ['קליטה', 'גיוס', 'התקבל', 'דחייה', 'הסרה', 'ויתור', 'הקפאה', 'נדחה']
        df["is_active"] = ~df["status"].str.contains("|".join(closed_statuses), case=False, na=False)
        active_df = df[df["is_active"]].copy()
        if active_df.empty:
            return {
                "thresholds": thresholds,
                "summary": {
                    "total_neglected_jobs": 0,
                    "critical_jobs": 0,
                    "stale_jobs_5d": 0,
                    "recruiters_impacted": 0,
                },
                "top_jobs": [],
                "recruiter_summary": [],
                "weekly_trend": [],
            }

        logs_df = pd.read_sql("SELECT log_id, upload_date FROM data_logs", conn)
        if not logs_df.empty:
            logs_df["upload_date"] = pd.to_datetime(logs_df["upload_date"], errors="coerce")
            active_df = active_df.merge(logs_df[["log_id", "upload_date"]], how="left", left_on="upload_log_id", right_on="log_id")
        else:
            active_df["upload_date"] = pd.NaT

        now = pd.Timestamp.now()
        active_df["days_since_action"] = (now - active_df["upload_date"]).dt.days
        active_df["days_since_action"] = active_df["days_since_action"].fillna(active_df["days_in_process"]).clip(lower=0).astype(int)
        active_df["team_name"] = active_df["department"].fillna("General").astype(str).apply(
            lambda dep: "צוות גיוס שירות" if ("שירות" in dep or "מכירות" in dep) else ("צוות גיוס טכנולוגיה" if "R&D" in dep else "צוות גיוס מטה")
        )

        recent_cutoff = now - pd.Timedelta(days=14)
        jobs_rows = []
        for job_title, group in active_df.groupby("job_title"):
            days_open = int(group["days_in_process"].max())
            new_candidates_last_14d = int((group["start_date"] >= recent_cutoff).sum())
            pending_candidates_count = int(len(group))
            days_since_last_candidate_action = int(group["days_since_action"].min())
            recruiter_name = str(group["recruiter"].dropna().iloc[0]) if not group["recruiter"].dropna().empty else "לא שויך"
            team_name = str(group["team_name"].dropna().iloc[0]) if not group["team_name"].dropna().empty else "צוות לא משויך"
            department = str(group["department"].dropna().iloc[0]) if not group["department"].dropna().empty else "General"

            rule_a = days_open > thresholds["slaDaysThreshold"] and new_candidates_last_14d < thresholds["lowCandidatesThreshold"]
            rule_b = pending_candidates_count >= thresholds["pendingCvThreshold"] and days_since_last_candidate_action >= thresholds["staleActionDaysThreshold"]
            if not (rule_a or rule_b):
                continue

            score = (
                100
                * (
                    0.35 * _normalize_score(days_open, 30, 120)
                    + 0.30 * _normalize_score(pending_candidates_count, 10, 80)
                    + 0.25 * _normalize_score(days_since_last_candidate_action, 2, 21)
                    + 0.10 * (1 - _normalize_score(new_candidates_last_14d, 0, 20))
                )
            )
            neglect_score = int(round(min(max(score, 0), 100)))
            severity = "critical" if neglect_score >= thresholds["criticalScoreThreshold"] else ("high" if neglect_score >= 60 else "medium")

            reasons = []
            if rule_a:
                reasons.append("SLA>60+LowFlow")
            if rule_b:
                reasons.append("CV20+NoAction5d")

            jobs_rows.append(
                {
                    "job_title": str(job_title),
                    "department": department,
                    "recruiter_name": recruiter_name,
                    "team_name": team_name,
                    "days_open": days_open,
                    "new_candidates_last_14d": new_candidates_last_14d,
                    "pending_candidates_count": pending_candidates_count,
                    "days_since_last_candidate_action": days_since_last_candidate_action,
                    "neglect_reason": "+".join(reasons),
                    "neglect_score": neglect_score,
                    "severity": severity,
                }
            )

        jobs_rows.sort(
            key=lambda row: (row["neglect_score"], row["pending_candidates_count"], row["days_open"]),
            reverse=True,
        )
        top_jobs = jobs_rows[: max(1, min(limit, 20))]

        recruiters: dict[str, dict] = {}
        for row in jobs_rows:
            key = row["recruiter_name"]
            current = recruiters.get(
                key,
                {
                    "recruiter_name": key,
                    "team_name": row["team_name"],
                    "neglected_jobs": 0,
                    "critical_jobs": 0,
                    "avg_neglect_score": 0.0,
                    "_score_sum": 0,
                },
            )
            current["neglected_jobs"] += 1
            current["critical_jobs"] += 1 if row["severity"] == "critical" else 0
            current["_score_sum"] += row["neglect_score"]
            current["avg_neglect_score"] = round(current["_score_sum"] / current["neglected_jobs"], 1)
            recruiters[key] = current
        recruiter_summary = list(recruiters.values())
        for rec in recruiter_summary:
            rec.pop("_score_sum", None)
        recruiter_summary.sort(key=lambda r: (r["critical_jobs"], r["avg_neglect_score"], r["neglected_jobs"]), reverse=True)

        trend_start = now - pd.Timedelta(days=56)
        trend_df = active_df[active_df["start_date"].notna() & (active_df["start_date"] >= trend_start)].copy()
        if trend_df.empty:
            weekly_trend = []
        else:
            trend_df["week_key"] = trend_df["start_date"].dt.to_period("W").astype(str)
            weekly = trend_df.groupby("week_key").size().reset_index(name="new_openings")
            weekly_trend = [{"week": str(r["week_key"]), "new_openings": int(r["new_openings"])} for _, r in weekly.iterrows()]

        stale_jobs_5d = sum(1 for row in jobs_rows if row["days_since_last_candidate_action"] >= thresholds["staleActionDaysThreshold"])
        critical_jobs = sum(1 for row in jobs_rows if row["severity"] == "critical")
        payload = {
            "thresholds": thresholds,
            "summary": {
                "total_neglected_jobs": len(jobs_rows),
                "critical_jobs": critical_jobs,
                "stale_jobs_5d": stale_jobs_5d,
                "recruiters_impacted": len({row["recruiter_name"] for row in jobs_rows}),
                "critical_ratio_pct": _safe_pct(critical_jobs, len(jobs_rows)),
            },
            "top_jobs": top_jobs,
            "recruiter_summary": recruiter_summary,
            "weekly_trend": weekly_trend,
        }

        cache_conn = sqlite3.connect(shared_config.DB_NAME)
        try:
            set_cached_response(cache_conn, "neglect_alerts", cache_params, payload)
        finally:
            cache_conn.close()
        return payload
    except Exception:
        return {
            "thresholds": _admin_config_defaults()["neglectThresholds"],
            "summary": {
                "total_neglected_jobs": 0,
                "critical_jobs": 0,
                "stale_jobs_5d": 0,
                "recruiters_impacted": 0,
            },
            "top_jobs": [],
            "recruiter_summary": [],
            "weekly_trend": [],
        }
    finally:
        conn.close()


@router.get("/api/jobs/{job_key}/candidates")
def get_job_candidates(
    job_key: str,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER, Role.HIRING_MANAGER)),
):
    """Candidates of a single job, grouped by unified_stage. Path key matches
    by job.id (preferred) or job.job_title (fallback)."""
    with db_conn() as conn:
        try:
            df = get_unified_data(conn)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Pipeline read failed: {exc}") from exc

        if df.empty:
            return {"job": None, "by_stage": {s: [] for s in UNIFIED_STAGES}, "total": 0}

        df["unified_stage"] = df.apply(
            lambda row: _compute_unified_stage(row.get("stage_code"), row.get("onboarding_status")),
            axis=1,
        )

        key = (job_key or "").strip().lower()
        matches = df[
            (df["job_id"].astype(str).str.lower() == key)
            | (df["job_title"].astype(str).str.lower() == key)
        ]

        if matches.empty:
            return {"job": None, "by_stage": {s: [] for s in UNIFIED_STAGES}, "total": 0}

        head = matches.iloc[0]
        job_meta = {
            "job_id": head.get("job_id"),
            "job_title": head.get("job_title"),
            "department": head.get("department"),
            "recruiter": head.get("recruiter"),
        }

        by_stage: dict[str, list] = {s: [] for s in UNIFIED_STAGES}
        for _i, row in matches.iterrows():
            stage = str(row["unified_stage"])
            if stage not in by_stage:
                continue
            by_stage[stage].append({
                "candidate_id": row.get("candidate_id"),
                "candidate_name": row.get("candidate_name"),
                "email": row.get("email"),
                "phone": row.get("phone"),
                "recruiter": row.get("recruiter"),
                "days_in_process": int(row.get("days_in_process") or 0),
                "unified_stage": stage,
                "status": row.get("status"),
                "onboarding_id": row.get("onboarding_id"),
                "id_num": row.get("id_num"),
            })

    return {"job": job_meta, "by_stage": by_stage, "total": int(len(matches))}


@router.patch("/api/jobs/{job_id}")
def edit_job(
    job_id: str,
    payload: JobEditPayload,
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Direct job field editor with title+department conflict detection."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="משרה לא נמצאה")
        before = dict(row)
        updates: dict = {}

        new_title = payload.job_title if payload.job_title is not None else before["job_title"]
        new_dept = payload.department if payload.department is not None else before["department"]
        if (new_title.lower(), new_dept.lower()) != (
            before["job_title"].lower(),
            before["department"].lower(),
        ):
            conflict = conn.execute(
                "SELECT id FROM jobs WHERE LOWER(job_title)=LOWER(?) AND LOWER(department)=LOWER(?) AND id!=?",
                (new_title, new_dept, job_id),
            ).fetchone()
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "JOB_CONFLICT",
                        "message": f"משרה '{new_title}' בחטיבה '{new_dept}' כבר קיימת",
                    },
                )

        for field in (
            "job_title", "department", "hiring_manager",
            "opened_at", "closed_at", "close_reason", "target_count",
        ):
            val = getattr(payload, field, None)
            if val is not None:
                updates[field] = val

        if not updates:
            return {"status": "no_change", "job": before}

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE jobs SET {set_clause} WHERE id = ?",
            [*updates.values(), job_id],
        )
        after = dict(conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone())
        batch_id = _create_manual_edit_batch("job", job_id, user.get("email", "admin"))
        _record_change(conn, batch_id, "job", job_id, "update", before, after)
        conn.commit()
        log_audit_action(
            "JOB_EDIT", "ok",
            f"id={job_id} fields={list(updates.keys())}",
            user=user.get("email", "admin"),
        )
        bump_data_version()
        return {"status": "updated", "job": after}
    finally:
        conn.close()


@router.delete("/api/jobs/{job_id}")
def delete_job(
    job_id: str,
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Soft delete job and its associated applications."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        job = c.execute("SELECT id, job_title FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="משרה לא נמצאה")

        c.execute("UPDATE jobs SET is_active = 0 WHERE id = ?", (job_id,))
        c.execute("UPDATE applications SET is_active = 0 WHERE job_id = ?", (job_id,))

        batch_id = _create_manual_edit_batch("job", job_id, user.get("email", "admin"))
        _record_change(conn, batch_id, "job", job_id, "delete", {"id": job[0], "job_title": job[1]}, None)
        conn.commit()

        log_audit_action(
            "JOB_DELETE", "ok",
            f"id={job_id} job_title={job[1]}",
            user=user.get("email", "admin"),
        )
        bump_data_version()
        return {"status": "deleted", "job_id": job_id}
    finally:
        conn.close()
