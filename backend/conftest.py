"""pytest bootstrap for the Phoenix Talent OS backend.

Two responsibilities, both must run BEFORE any test module is imported:

1. **sys.path** — `pytest` (bare command, as CI runs it) does not add
   the backend dir to sys.path, so ``from main import app`` would raise
   ModuleNotFoundError. ``python -m pytest`` worked by luck because the
   ``-m`` form prepends CWD. This module force-prepends BACKEND_DIR and
   PROJECT_ROOT so both invocation forms behave identically.

2. **Test database isolation** — the legacy test
   ``test_reset_for_final_test`` (and several ingestion tests) write
   to the database backing the FastAPI app. Without isolation, those
   writes hit the live ``phoenix_enterprise.db`` and wipe whatever
   demo data the user has loaded. We point ``backend.config.DB_NAME``
   at a per-session temp file via the ``PHOENIX_TEST_DB`` env var
   before ``main`` is imported, and tear the file down at session end.

The env var lookup happens in ``backend/config.py``; this module just
sets/unsets it.
"""

import os
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# --- 1. sys.path ---------------------------------------------------
for p in (BACKEND_DIR, PROJECT_ROOT):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)


# --- 2. Test database isolation -----------------------------------
# Allocate a temp DB file per session. The path is exported via env so
# config.py picks it up the first (and any subsequent) time it is
# imported. We deliberately set this at module import time — NOT
# inside a fixture — because test modules call ``from main import app``
# at their top level, which evaluates ``DB_PATH = shared_config.DB_NAME``
# immediately. A fixture would fire too late.
_test_db = os.environ.get("PHOENIX_TEST_DB")
if not _test_db:
    _tmp = tempfile.NamedTemporaryFile(
        prefix="phoenix_test_", suffix=".db", delete=False
    )
    _tmp.close()
    _test_db = _tmp.name
    os.environ["PHOENIX_TEST_DB"] = _test_db


def pytest_sessionfinish(session, exitstatus):
    """Clean up the temp DB after the whole test run completes."""
    path = os.environ.get("PHOENIX_TEST_DB")
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except OSError:
            pass
