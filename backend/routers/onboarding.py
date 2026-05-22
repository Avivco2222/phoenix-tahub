"""Onboarding endpoints — wizard, list, bulk-update, partial-update.

Five routes that drive the post-offer onboarding workflow:

    POST /api/onboarding/wizard            — full wizard payload
    POST /api/onboarding                   — minimal create
    GET  /api/onboarding                   — list (optional status filter)
    POST /api/onboarding/bulk-update       — bulk status change
    PUT  /api/onboarding/{ob_id}           — partial edit

All routes are gated by ``require_dual_role(ADMIN, HRBP, RECRUITER)``.
Endpoint bodies are reproduced verbatim from main.py (same SQL, same
schemas, same error handling) — pure relocation, no observable API
change.

Two helpers used only by these routes (``_normalize_onboarding_payload``
and ``_persist_onboarding_record``) moved with them so the file is
self-contained.
"""

import sqlite3
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

import config as shared_config
from auth import require_dual_role
from constants import Role
from schemas import (
    OnboardingBulkUpdatePayload,
    OnboardingPayload,
    OnboardingUpdatePayload,
)


router = APIRouter(tags=["onboarding"])


# --- Late-bound proxies to helpers still in main.py ----------------------
def _log_audit(action: str, status: str, details: str, user: str) -> None:
    from main import log_audit_action
    log_audit_action(action=action, status=status, details=details, user=user)


def _nan_safe_records(df):
    from main import _nan_safe_records as _impl
    return _impl(df)


def _bump_data_version(conn=None) -> int:
    from main import bump_data_version as _impl
    return _impl(conn)


# --- Onboarding-only helpers (moved here from main.py) -------------------
def _normalize_onboarding_payload(payload: OnboardingPayload) -> dict:
    data = payload.model_dump()
    full_name = (data.get("name") or f"{data.get('firstName', '')} {data.get('lastName', '')}").strip()
    return {
        "name": full_name,
        "id_num": data.get("id_num") or data.get("idNum") or "",
        "role": data.get("role") or data.get("jobTitle") or "",
        "department": data.get("department") or data.get("orgUnit") or "",
        "manager": data.get("manager") or "",
        "start_date": data.get("start_date") or data.get("startDate") or "",
        "base_salary": data.get("base_salary") or 0,
        "global_salary": data.get("global_salary") or 0,
        "parking": data.get("parking") if data.get("parking") is not None else (data.get("parkingType") not in (None, "", "לא")),
        "car_num": data.get("car_num") or data.get("carNum") or "",
        "referral_name": data.get("referral_name") or data.get("refName") or "",
        "referral_id": data.get("referral_id") or data.get("refEmpNum") or "",
        "diversity": data.get("diversity") or ("מוגבלות" if data.get("hasDisability") else ""),
    }


def _persist_onboarding_record(payload: OnboardingPayload) -> str:
    normalized = _normalize_onboarding_payload(payload)
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        ob_id = f"ob-{uuid.uuid4().hex[:6]}"
        c.execute(
            '''INSERT INTO onboarding
               (id, name, id_num, role, department, manager, start_date, base_salary, global_salary, parking, car_num, referral_name, referral_id, diversity, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                ob_id,
                normalized["name"],
                normalized["id_num"],
                normalized["role"],
                normalized["department"],
                normalized["manager"],
                normalized["start_date"],
                normalized["base_salary"],
                normalized["global_salary"],
                normalized["parking"],
                normalized["car_num"],
                normalized["referral_name"],
                normalized["referral_id"],
                normalized["diversity"],
                "pending",
                pd.Timestamp.now().isoformat(),
            ),
        )
        conn.commit()
        return ob_id
    finally:
        conn.close()


# --- Routes ----------------------------------------------------------------


@router.post("/api/onboarding/wizard")
async def create_onboarding_wizard(
    payload: OnboardingPayload,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    """
    מקבל את כל המידע מה-Wizard (כולל הצ'קליסט, הזכאויות והניתובים).
    שומר את הרשומה במסד הנתונים כ'ממתין לקליטה'.
    """
    ob_id = _persist_onboarding_record(payload)
    full_name = _normalize_onboarding_payload(payload)["name"] or "עובד חדש"
    _log_audit("Onboarding Wizard", "Success", f"קליטה מקיפה שוגרה עבור {full_name}", "Recruiter")
    return {"status": "success", "id": ob_id, "message": "Onboarding wizard completed"}


@router.post("/api/onboarding")
def create_onboarding(
    payload: OnboardingPayload,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    """יצירת טופס קליטה חדש - שולח 'מיילים' (לוגים) לקב"ט ו-HRO"""
    ob_id = _persist_onboarding_record(payload)
    return {"status": "success", "id": ob_id, "message": "Onboarding created and Fan-out triggered"}


@router.get("/api/onboarding")
def list_onboarding(
    status: Optional[str] = None,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        rows = pd.read_sql("SELECT * FROM onboarding ORDER BY created_at DESC", conn)
        if status:
            rows = rows[rows["status"].astype(str).str.lower() == status.lower()]
        return _nan_safe_records(rows)
    finally:
        conn.close()


@router.post("/api/onboarding/bulk-update")
def bulk_update_onboarding(
    payload: OnboardingBulkUpdatePayload,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    ids = [item for item in payload.ids if item]
    if not ids:
        raise HTTPException(status_code=400, detail="ids is required")
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        placeholders = ",".join("?" for _ in ids)
        c.execute(
            f"UPDATE onboarding SET status = ? WHERE id IN ({placeholders})",
            [payload.status, *ids],
        )
        affected = c.rowcount
        conn.commit()
    finally:
        conn.close()
    _log_audit(
        "ONBOARDING_BULK_UPDATE",
        "Warning",
        f"status={payload.status} | affected={affected}",
        "Admin",
    )
    return {"status": "success", "affected": affected}


@router.put("/api/onboarding/{ob_id}")
def update_onboarding(
    ob_id: str,
    payload: OnboardingUpdatePayload,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    """Edit onboarding form selectively"""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        data = payload.model_dump(exclude_unset=True)
        if data.get("status_only"):
            if "status" in data:
                c.execute("UPDATE onboarding SET status = ? WHERE id = ?", (data.get("status"), ob_id))
        else:
            c.execute("PRAGMA table_info(onboarding)")
            db_cols = {r[1] for r in c.fetchall()}
            updates = []
            params = []
            for k, v in data.items():
                if k in db_cols and k != "id":
                    updates.append(f"{k} = ?")
                    params.append(v)
            if updates:
                params.append(ob_id)
                c.execute(f"UPDATE onboarding SET " + ", ".join(updates) + " WHERE id = ?", params)
        conn.commit()
        _bump_data_version()
        return {"status": "success"}
    finally:
        conn.close()
