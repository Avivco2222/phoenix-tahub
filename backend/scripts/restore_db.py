import argparse
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "phoenix_enterprise.db"


def restore_from(backup_file: Path) -> None:
    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file does not exist: {backup_file}")
    shutil.copy2(backup_file, DB_PATH)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Restore phoenix DB from backup")
    parser.add_argument("--from", dest="backup_file", required=True, help="Path to backup DB file")
    args = parser.parse_args()
    restore_from(Path(args.backup_file))
    print(f"Restored DB from: {args.backup_file}")
