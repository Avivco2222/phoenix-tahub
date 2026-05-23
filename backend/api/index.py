"""Vercel Python runtime entry point.

The Vercel Python runtime expects an ASGI app exposed as ``app`` (or a
WSGI app as ``app`` — FastAPI is ASGI, so the runtime auto-detects that
from the framework's interface).

This file is a one-line shim: import the real FastAPI app from
``backend/main.py`` and re-export it. Keeping the shim separate from
main.py means local ``uvicorn main:app`` (port 8010) and Vercel's
serverless invocation share the exact same FastAPI instance — no
risk of the two paths drifting.

The matching ``backend/vercel.json`` declares this as the only function
and rewrites every incoming path to ``/api/index`` so FastAPI sees the
original URL (with `request.url.path`) intact.
"""

# main.py lives one directory up; Python's import resolution from the
# api/ subdirectory needs the parent on sys.path. We add it explicitly
# rather than relying on PYTHONPATH being set in the build environment.
import os
import sys

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from main import app  # noqa: E402  (sys.path mutation above must run first)

__all__ = ["app"]
