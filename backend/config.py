"""Shared configuration for the Phoenix Talent OS FastAPI backend.

Historically this module also hosted the Streamlit prototype's
brand-colour palette and CSV column mapping. The prototype was retired
in 2026-02 and removed from the repo, so this module now exposes only
the database location used by the live backend.

The SQLite file lives at the repository root for historical reasons
(it predates the backend/ split), so PROJECT_ROOT walks one level up
from this file's location (backend/config.py → repo root).

If the ``PHOENIX_TEST_DB`` environment variable is set (only the test
suite does this — see backend/conftest.py), DB_NAME points at that
path instead. This isolates pytest from the live database so tests
that purge/reset rows (e.g. ``POST /admin/reset-for-final-test``)
cannot wipe production data.
"""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

_test_db_override = os.environ.get("PHOENIX_TEST_DB")
if _test_db_override:
    DB_NAME = _test_db_override
else:
    DB_NAME = str(PROJECT_ROOT / "phoenix_enterprise.db")
