import shutil
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "phoenix_enterprise.db"
BACKUP_DIR = ROOT / "backups"


def run_backup() -> Path:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found: {DB_PATH}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"phoenix_enterprise_{timestamp}.db"
    shutil.copy2(DB_PATH, backup_path)
    return backup_path


if __name__ == "__main__":
    path = run_backup()
    print(f"Backup created: {path}")
