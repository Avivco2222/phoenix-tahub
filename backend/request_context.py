"""Per-request context primitives shared across modules.

Currently exposes a single :class:`contextvars.ContextVar` —
``request_ip_ctx`` — populated by the FastAPI request-logging
middleware in ``main.py`` and consumed by :func:`audit.log_audit_action`
so audit rows record the originating client IP.

This module exists to break what would otherwise be a circular import:
``audit.py`` needs the ContextVar to populate IP on its inserts, but
``main.py`` (which sets the var) also needs to import ``audit`` for
the audit helper. Keeping the var in a leaf module both sides import
from sidesteps that cycle.
"""

from contextvars import ContextVar

request_ip_ctx: ContextVar[str] = ContextVar("request_ip", default="-")
