"""
Seed the initial admin user into the new `users` table.

Usage:
    cd backend
    python scripts/seed_admin.py

Reads ADMIN_EMAIL, ADMIN_USF (used as initial password), ADMIN_NAME from env.
Falls back to defaults if not set:
    ADMIN_EMAIL=admin@fnx.co.il
    ADMIN_USF=198722
    ADMIN_NAME="מנהל מערכת"

The USF is hashed with bcrypt and stored in `password_hash`. After first login
the user can change their password via /api/auth/change-password.

Idempotent: if the email already exists, prints the existing record and exits.
"""
import os
import sys
import uuid
import sqlite3
from datetime import datetime, timezone

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND_DIR)
sys.path.insert(0, os.path.dirname(_BACKEND_DIR))  # so we can import root config.py

import bcrypt  # type: ignore

# Single source of truth for the DB path (matches backend/main.py).
try:
    import config as shared_config  # type: ignore
    DB_PATH = shared_config.DB_NAME
except Exception:
    DB_PATH = os.path.join(_BACKEND_DIR, "phoenix_enterprise.db")

DEFAULT_EMAIL = "admin@fnx.co.il"
DEFAULT_USF = "198722"
DEFAULT_NAME = "מנהל מערכת"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def main() -> int:
    email = (os.getenv("ADMIN_EMAIL") or DEFAULT_EMAIL).strip().lower()
    name = (os.getenv("ADMIN_NAME") or DEFAULT_NAME).strip()
    usf = (os.getenv("ADMIN_USF") or DEFAULT_USF).strip()

    if not email or not name or len(usf) < 4:
        print("ERROR: email, name, and USF (>=4 chars) are required.")
        return 1

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Match the schema declared in main.init_db (NEW `users` table).
    c.execute(
        """CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'recruiter',
            employee_number TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            created_at TEXT,
            last_login_at TEXT
        )"""
    )

    c.execute("SELECT id, role, is_active, employee_number FROM users WHERE LOWER(email) = ?", (email,))
    existing = c.fetchone()
    if existing:
        print(f"User {email} already exists (id={existing[0]}, role={existing[1]}, "
              f"active={bool(existing[2])}, USF={existing[3]}).")
        print("To reset, delete the row manually or use /api/admin/users/{id}/reset-password.")
        conn.close()
        return 0

    user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
    c.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, employee_number, "
        "is_active, must_change_password, created_at) VALUES (?, ?, ?, ?, 'admin', ?, 1, 0, ?)",
        (user_id, email, hash_password(usf), name, usf, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()
    conn.close()

    print(f"OK Created admin user {email} (id={user_id}, USF={usf}).")
    print("Login via the Phoenix dashboard with this email and the USF as password.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
