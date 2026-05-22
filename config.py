"""Shared configuration for the Phoenix Talent OS FastAPI backend.

Historically this module also hosted the Streamlit prototype's
brand-colour palette and CSV column mapping. The prototype was retired
in 2026-02 and removed from the repo, so this module now exposes only
the database location used by the live backend.
"""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
DB_NAME = str(PROJECT_ROOT / "phoenix_enterprise.db")
