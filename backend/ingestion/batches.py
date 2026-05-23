"""Ingestion batch lifecycle + audit hooks.

Every persistent ingest opens an ``ingestion_batches`` row at the start
and finalises it (committed or failed) at the end. Along the way, every
row insert/update/delete is logged to ``batch_entity_changes`` for the
admin Diff modal, and rows that failed validation are stashed in
``rejected_rows`` for the Quality tab.

Public helpers:

* :func:`_create_ingest_batch`         — open a new batch (status=pending)
* :func:`_finalise_ingest_batch`       — close it (committed / failed)
                                         and compute quality_score
* :func:`_record_batch_change`         — append one insert/update/delete
                                         row to batch_entity_changes
* :func:`_persist_rejected_rows_for_batch` — bulk-insert rejected rows
* :func:`_auto_scan_after_ingest`      — trigger the anomaly scanner
                                         from inside the ingest tx
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

import config as shared_config
from auth import _utcnow

from .validation import DEFAULT_SCHEMA_VERSION


def _record_batch_change(
    conn: sqlite3.Connection,
    batch_id: str,
    entity_type: str,
    entity_id: str,
    change_type: str,
    before_obj: Optional[dict],
    after_obj: Optional[dict],
) -> None:
    """Append a single change row to ``batch_entity_changes``.

    ``before_obj`` is None on insert; ``after_obj`` is None on delete.
    Both are JSON-encoded (Hebrew-safe) before storage.
    """
    conn.execute(
        """INSERT INTO batch_entity_changes(batch_id, entity_type, entity_id, change_type, before_json, after_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            batch_id,
            entity_type,
            entity_id,
            change_type,
            json.dumps(before_obj, ensure_ascii=False) if before_obj else None,
            json.dumps(after_obj, ensure_ascii=False) if after_obj else None,
            _utcnow().isoformat(),
        ),
    )


def _create_ingest_batch(
    file_type: str,
    filename: str,
    rows_received: int,
    user_email: str,
) -> str:
    """Open a new ``ingestion_batches`` row in ``pending`` status. Returns the
    generated ``batch_id`` (e.g. ``ING-CAN-A1B2C3D4``)."""
    batch_id = f"ING-{file_type[:3].upper()}-{uuid.uuid4().hex[:8].upper()}"
    started_at = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        c.execute(
            """INSERT INTO ingestion_batches
               (batch_id, filename, schema_version, status, rows_received, rows_loaded,
                rows_rejected, duplicate_rows, quality_score, started_at)
               VALUES (?, ?, ?, 'pending', ?, 0, 0, 0, 0, ?)""",
            (batch_id, f"{file_type}::{filename}", DEFAULT_SCHEMA_VERSION, rows_received, started_at),
        )
        conn.commit()
    finally:
        conn.close()
    return batch_id


def _finalise_ingest_batch(batch_id: str, status: str, stats: dict) -> None:
    """Close ``batch_id`` with ``status`` (``committed`` / ``failed``) and
    write the aggregate counts/quality_score that drive the admin batches
    table."""
    finished_at = datetime.now(timezone.utc).isoformat()
    total = max(1, int(stats.get("received") or 1))
    loaded = int(stats.get("inserted", 0)) + int(stats.get("updated", 0))
    rejected = int(stats.get("rejected", 0))
    duplicate = int(stats.get("skipped_duplicate", 0))
    quality = int(round(((total - rejected) / total) * 100))
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        c.execute(
            """UPDATE ingestion_batches
               SET status = ?, rows_loaded = ?, rows_rejected = ?, duplicate_rows = ?,
                   quality_score = ?, finished_at = ?
               WHERE batch_id = ?""",
            (status, loaded, rejected, duplicate, quality, finished_at, batch_id),
        )
        conn.commit()
    finally:
        conn.close()


def _persist_rejected_rows_for_batch(batch_id: str, rejected_rows: list[dict]) -> None:
    """Bulk-insert ``rejected_rows`` for the Quality tab. No-op on empty input.
    Per-row insert errors are swallowed (the rejected_rows table schema may
    differ across deploys; that's fine for now)."""
    if not rejected_rows:
        return
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        for r in rejected_rows:
            try:
                conn.execute(
                    "INSERT INTO rejected_rows (batch_id, raw_row, reason_detail, created_at) VALUES (?,?,?,?)",
                    (
                        batch_id,
                        json.dumps(r.get("row", r), ensure_ascii=False, default=str),
                        "; ".join(r.get("reasons", [])),
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
            except Exception:
                pass
        conn.commit()
    finally:
        conn.close()


def _auto_scan_after_ingest(conn: sqlite3.Connection, batch_id: str) -> None:
    """Called inside the ingestion transaction BEFORE commit so the scan
    benefits from the freshly loaded data. Errors are swallowed so they
    never fail a successful upload.

    ``run_anomaly_scan`` still lives in main.py for the moment, so it's
    imported lazily to avoid a circular import at module load time.
    """
    try:
        from main import run_anomaly_scan  # late-bound on purpose
        run_anomaly_scan(conn, batch_id=batch_id)
    except Exception:
        pass
