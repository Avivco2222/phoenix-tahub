import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


DB_PATH = Path(__file__).resolve().parent.parent / "phoenix_enterprise.db"
MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def ensure_migrations_table(conn: sqlite3.Connection) -> None:
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
    conn = sqlite3.connect(DB_PATH)
    try:
        ensure_migrations_table(conn)
        already = {
            row[0]
            for row in conn.execute("SELECT filename FROM schema_migrations").fetchall()
        }
        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        for migration in migration_files:
            if migration.name in already:
                continue
            sql = migration.read_text(encoding="utf-8")
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
                (migration.name, _utcnow_iso()),
            )
            conn.commit()
            print(f"Applied migration: {migration.name}")
    finally:
        conn.close()


if __name__ == "__main__":
    apply_migrations()
