"""Shared configuration for the Phoenix Talent OS FastAPI backend.

Historically this module also hosted the Streamlit prototype's
brand-colour palette and CSV column mapping. The prototype was retired
in 2026-02 and removed from the repo, so this module now exposes only
the database location used by the live backend.

The SQLite file lives at the repository root for historical reasons
(it predates the backend/ split), so PROJECT_ROOT walks one level up
from this file's location (backend/config.py → repo root).
"""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_NAME = str(PROJECT_ROOT / "phoenix_enterprise.db")
