"""SQL migration runner for the Phoenix Talent OS backend.

Discovers every ``*.sql`` file under ``backend/migrations/`` in
lexicographic order and applies the ones that have not yet been recorded
in the ``schema_migrations`` audit table. Each successful application
inserts a row capturing the filename and a UTC ISO timestamp, which
makes subsequent runs idempotent.

Invocation::

    python backend/scripts/migrate.py

The script is intentionally free of FastAPI / project imports so it can
be run from any deployment context (CI, systemd one-shot unit, manual
shell on the VM) without bringing up the application.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path


# --- Filesystem layout ---------------------------------------------------
# All paths are resolved relative to this file so the script works the
# same whether it is run via `python backend/scripts/migrate.py` or
# `python -m backend.scripts.migrate`.
BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
DB_PATH: Path = BACKEND_DIR / "phoenix_enterprise.db"
MIGRATIONS_DIR: Path = BACKEND_DIR / "migrations"


def _utcnow_iso() -> str:
    """Return the current UTC time as a naive ISO 8601 string.

    The ``tzinfo`` is stripped so the output matches the legacy
    ``datetime.utcnow().isoformat()`` format used elsewhere in the
    database (no ``+00:00`` suffix). This keeps existing string-based
    comparisons against historical rows working.

    Returns:
        Timestamp in ``YYYY-MM-DDTHH:MM:SS.ffffff`` form (no offset).
    """
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def ensure_migrations_table(conn: sqlite3.Connection) -> None:
    """Create the ``schema_migrations`` audit table if it does not exist.

    The table is the runner's source of truth for which migrations have
    already been applied. ``filename`` is ``UNIQUE`` so reapplying the
    same migration is impossible even if the in-memory ``applied``
    bookkeeping in :func:`apply_migrations` were ever skipped.

    Args:
        conn: Open SQLite connection. Will be committed before return.
    """
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT UNIQUE NOT NULL,
          applied_at TEXT NOT NULL
        )
        """
    )
    conn.commit()


def apply_migrations() -> None:
    """Apply every unapplied migration in ``MIGRATIONS_DIR`` in order.

    Behaviour:
        1. Connect to :data:`DB_PATH` and ensure the audit table exists.
        2. Load the set of already-applied filenames.
        3. Iterate the directory's ``*.sql`` files sorted
           lexicographically (which is also chronological because the
           filename convention is ``NNN_*.sql``).
        4. For each new file: run the script, then record the filename
           and current UTC timestamp in ``schema_migrations`` and commit.

    The function never rolls back previously-applied migrations and
    prints a single ``Applied migration: <name>`` line per new file. If
    a migration script fails, the exception propagates and the partial
    transaction for that file is *not* committed — the script can be
    fixed and the runner re-invoked.
    """
    conn = sqlite3.connect(DB_PATH)
    try:
        ensure_migrations_table(conn)

        applied_filenames: set[str] = {
            applied_row[0]
            for applied_row in conn.execute(
                "SELECT filename FROM schema_migrations"
            ).fetchall()
        }

        migration_files: list[Path] = sorted(MIGRATIONS_DIR.glob("*.sql"))
        for migration_path in migration_files:
            if migration_path.name in applied_filenames:
                continue
            migration_sql: str = migration_path.read_text(encoding="utf-8")
            conn.executescript(migration_sql)
            conn.execute(
                "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
                (migration_path.name, _utcnow_iso()),
            )
            conn.commit()
            print(f"Applied migration: {migration_path.name}")
    finally:
        conn.close()


if __name__ == "__main__":
    apply_migrations()
