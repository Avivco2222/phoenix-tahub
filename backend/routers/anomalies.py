"""Anomaly detection & review endpoints.

Hosts the four routes that drive the admin "Anomalies" tab:

    POST   /api/anomalies/scan          — manual full-DB scan
    GET    /api/anomalies               — paginated list with filters
    GET    /api/anomalies/summary       — counts by type / severity / status
    PATCH  /api/anomalies/{anomaly_id}  — dismiss or resolve a finding

The scan engine itself (``run_anomaly_scan``) lives in
``backend/internal_logic.py``. The auto-scan hook that fires after
each successful ingest stays in main.py for now because it is
imported by the ingestion transaction.

Endpoint bodies are reproduced verbatim from main.py — same SQL, same
auth gates, same return shape — so this commit is a pure relocation
with zero observable change to the API contract.
"""

import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

import config as shared_config
from auth import _utcnow, require_dual_role
from constants import Role
from schemas import AnomalyReviewPayload


router = APIRouter(tags=["anomalies"])


def _log_audit(action: str, status: str, details: str, user: str) -> None:
    """Late-bound proxy to main.log_audit_action — avoids a circular import."""
    from main import log_audit_action  # noqa: imported lazily on purpose

    log_audit_action(action=action, status=status, details=details, user=user)


def _run_anomaly_scan(conn: sqlite3.Connection, batch_id=None):
    """Late-bound proxy to main.run_anomaly_scan — avoids a circular import.

    The scanner is defined as a module-level function in main.py (rather
    than internal_logic.py) because it reaches into several main.py
    helpers. Importing it eagerly here would create a circular import
    when main.py loads this router.
    """
    from main import run_anomaly_scan  # noqa: imported lazily on purpose

    return run_anomaly_scan(conn, batch_id=batch_id)


@router.post("/api/anomalies/scan")
def trigger_anomaly_scan(
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Trigger a manual full-database anomaly scan."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        summary = _run_anomaly_scan(conn, batch_id=None)
        total = sum(summary.values())
        _log_audit(
            "ANOMALY_SCAN",
            "ok",
            f"new={total} breakdown={summary}",
            user=user.get("email", "admin"),
        )
        return {"status": "scanned", "new_anomalies": total, "breakdown": summary}
    finally:
        conn.close()


@router.get("/api/anomalies")
def list_anomalies(
    status: str = "open",
    entity_type: str = "",
    anomaly_type: str = "",
    severity: str = "",
    page: int = 1,
    limit: int = 50,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    """List flagged anomalies with optional filters."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        where_parts = ["1=1"]
        params: list = []
        if status:
            where_parts.append("status = ?")
            params.append(status)
        if entity_type:
            where_parts.append("entity_type = ?")
            params.append(entity_type)
        if anomaly_type:
            where_parts.append("anomaly_type = ?")
            params.append(anomaly_type)
        if severity:
            where_parts.append("severity = ?")
            params.append(severity)

        where_sql = " AND ".join(where_parts)
        total = conn.execute(
            f"SELECT COUNT(*) FROM data_anomalies WHERE {where_sql}", params
        ).fetchone()[0]
        offset = (page - 1) * limit
        rows = conn.execute(
            f"SELECT * FROM data_anomalies WHERE {where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
        data = []
        for r in rows:
            item = dict(r)
            try:
                item["meta"] = json.loads(item.get("meta_json") or "{}")
            except Exception:
                item["meta"] = {}
            data.append(item)
        return {"data": data, "total": total, "page": page}
    finally:
        conn.close()


@router.get("/api/anomalies/summary")
def anomaly_summary(
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP, Role.RECRUITER)),
):
    """Aggregated anomaly counts by type, severity, and status."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        by_type = c.execute(
            "SELECT anomaly_type, status, COUNT(*) FROM data_anomalies GROUP BY anomaly_type, status"
        ).fetchall()
        by_severity = c.execute(
            "SELECT severity, COUNT(*) FROM data_anomalies WHERE status='open' GROUP BY severity"
        ).fetchall()
        total_open = c.execute(
            "SELECT COUNT(*) FROM data_anomalies WHERE status='open'"
        ).fetchone()[0]
        return {
            "total_open": total_open,
            "by_type": [{"type": r[0], "status": r[1], "count": r[2]} for r in by_type],
            "by_severity": {r[0]: r[1] for r in by_severity},
        }
    finally:
        conn.close()


@router.patch("/api/anomalies/{anomaly_id}")
def review_anomaly(
    anomaly_id: str,
    payload: AnomalyReviewPayload,
    user: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Mark an anomaly as dismissed or resolved."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        row = conn.execute(
            "SELECT id FROM data_anomalies WHERE id=?", (anomaly_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="אנומליה לא נמצאה")
        conn.execute(
            "UPDATE data_anomalies SET status=?, reviewed_by=?, reviewed_at=? WHERE id=?",
            (payload.status, user.get("email", "admin"), _utcnow().isoformat(), anomaly_id),
        )
        conn.commit()
        _log_audit(
            "ANOMALY_REVIEW",
            "ok",
            f"id={anomaly_id} status={payload.status} note={payload.note}",
            user=user.get("email", "admin"),
        )
        return {
            "status": "updated",
            "anomaly_id": anomaly_id,
            "new_status": payload.status,
        }
    finally:
        conn.close()
