"""
pytest sitecustomize. Without this, `pytest` (bare command, as CI runs it)
does not add the backend dir to sys.path, so `from main import app`
in test files raises ModuleNotFoundError. `python -m pytest` works by
luck because the `-m` form prepends CWD.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

for p in (BACKEND_DIR, PROJECT_ROOT):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)
