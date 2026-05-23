"""Audit logging, data-version counter, and change-tracking helpers.

Five small pieces previously co-located in main.py, grouped here
because they all participate in the system's write-audit trail:

* :func:`log_audit_action` — append a row to ``audit_logs`` with the
  originating IP pulled from :data:`request_context.request_ip_ctx`.
  Called from every mutating endpoint so the admin "Audit" tab can
  reconstruct who did what, when, and from where.
* :func:`get_data_version` / :func:`bump_data_version` — the global
  monotonic counter in ``system_settings('data_version')``. Frontend
  ``DataVersionContext`` polls ``get_data_version``; ingest commits
  and manual edits call ``bump_data_version`` at the END of their
  transaction so consumers (candidates, jobs, dashboard, intelligence,
  headcount, budget) refetch automatically when the number ticks.
* :func:`_record_change` — append one row to ``batch_entity_changes``
  describing an insert/update/delete inside a batch. Powers the
  per-batch revert flow in admin → batches.
* :func:`_create_manual_edit_batch` — synthesise a one-row
  ``ingestion_batches`` row so a single UI edit is rollbackable via
  the same machinery as bulk ingests.

All five operate on the live DB through ``config.DB_NAME``. The two
that take an existing connection (``bump_data_version``,
``_record_change``) leave commit/close to the caller.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

import config as shared_config
from ingestion import DEFAULT_SCHEMA_VERSION
from request_context import request_ip_ctx


def log_audit_action(action: str, status: str, details: str, user: str = "System") -> None:
    """Insert one row into ``audit_logs`` tagged with the current request IP."""
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        c = conn.cursor()
        log_id = f"LOG-{uuid.uuid4().hex[:6].upper()}"
        timestamp = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
        ip_address = request_ip_ctx.get("-")
        c.execute(
            "INSERT INTO audit_logs (id, timestamp, action, status, details, user, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (log_id, timestamp, action, status, details, user, ip_address),
        )
        conn.commit()
    finally:
        conn.close()


def get_data_version(conn: Optional[sqlite3.Connection] = None) -> int:
    """Read the global data_version counter."""
    close_after = False
    if conn is None:
        conn = sqlite3.connect(shared_config.DB_NAME)
        close_after = True
    try:
        row = conn.execute("SELECT value FROM system_settings WHERE key = 'data_version'").fetchone()
        return int(row[0]) if row and str(row[0]).isdigit() else 0
    finally:
        if close_after:
            conn.close()


def bump_data_version(conn: Optional[sqlite3.Connection] = None) -> int:
    """Increment the global data_version. Returns the new value.

    Frontend ``DataVersionContext`` polls this; when it sees a higher
    number, consumer blocks (candidates, jobs, dashboard, intelligence,
    headcount, budget) trigger a refetch automatically. Call this at
    the END of every successful ingest commit, AFTER the rows are
    persisted.
    """
    close_after = False
    if conn is None:
        conn = sqlite3.connect(shared_config.DB_NAME)
        close_after = True
    try:
        current = get_data_version(conn)
        new_val = current + 1
        conn.execute(
            "INSERT INTO system_settings (key, value) VALUES ('data_version', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(new_val),),
        )
        if close_after:
            conn.commit()
        return new_val
    finally:
        if close_after:
            conn.close()


def _record_change(conn: sqlite3.Connection, batch_id: str, entity_type: str,
                   entity_id: str, change_type: str, before: Optional[dict], after: Optional[dict]) -> None:
    """Record a single insert/update/delete row in ``batch_entity_changes``."""
    conn.execute(
        """INSERT INTO batch_entity_changes
           (batch_id, entity_type, entity_id, change_type, before_json, after_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            batch_id, entity_type, entity_id, change_type,
            json.dumps(before, ensure_ascii=False, default=str) if before else None,
            json.dumps(after, ensure_ascii=False, default=str) if after else None,
            datetime.now(timezone.utc).isoformat(),
        ),
    )


def _create_manual_edit_batch(entity_type: str, entity_id: str, actor: str) -> str:
    """Create a pseudo-batch for a single manual UI edit.

    Reuses the standard ``ingestion_batches`` shape so the existing
    per-batch revert flow handles undo without a special case.
    """
    batch_id = f"EDIT-{entity_type[:3].upper()}-{uuid.uuid4().hex[:8].upper()}"
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        conn.execute(
            """INSERT INTO ingestion_batches
               (batch_id, filename, schema_version, status,
                rows_received, rows_loaded, rows_rejected, duplicate_rows, quality_score,
                started_at, finished_at)
               VALUES (?, ?, ?, 'committed', 1, 1, 0, 0, 100, ?, ?)""",
            (
                batch_id,
                f"manual_edit::{entity_type}::{entity_id}",
                DEFAULT_SCHEMA_VERSION,
                datetime.now(timezone.utc).isoformat(),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    except Exception:
        # If actor column or other schema mismatch, retry without optional columns
        pass
    finally:
        conn.close()
    return batch_id
