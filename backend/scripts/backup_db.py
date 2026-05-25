"""Snapshot the live SQLite DB to backend/backups/ before any
destructive operation (xls import, schema migration, reset).

The live DB lives at the repo root — not under backend/ — because
the FastAPI app is configured (``config.DB_NAME``) to use
``PROJECT_ROOT/phoenix_enterprise.db``. An earlier version of this
script pointed at ``backend/phoenix_enterprise.db`` which doesn't
exist; corrected as part of Audit Phase 4 / Wave C.
"""

import shutil
from datetime import datetime
from pathlib import Path


# backend/scripts/backup_db.py → backend → repo root
BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent
DB_PATH = PROJECT_ROOT / "phoenix_enterprise.db"
BACKUP_DIR = BACKEND_ROOT / "backups"


def run_backup(label: str | None = None) -> Path:
    """Copy the live DB to ``backend/backups/`` with a timestamped name.

    Parameters
    ----------
    label
        Optional short tag inserted between the prefix and the timestamp
        in the backup filename — e.g. ``run_backup("pre-xls-import")``
        produces ``phoenix_enterprise.pre-xls-import.20260525_153000.db``.
        Useful when the operator wants to find a specific backup later
        without grepping a long ``ls`` of dated copies.
    """
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found: {DB_PATH}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    tag = f".{label}" if label else ""
    backup_path = BACKUP_DIR / f"phoenix_enterprise{tag}.{timestamp}.db"
    shutil.copy2(DB_PATH, backup_path)
    return backup_path


if __name__ == "__main__":
    import sys
    label = sys.argv[1] if len(sys.argv) > 1 else None
    path = run_backup(label)
    print(f"Backup created: {path}")
