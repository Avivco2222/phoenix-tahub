"""Project-wide constants.

Centralising the role taxonomy here gives the IDE / static checkers a
chance to catch typos at parse time (``Role.HRPB`` is a ``NameError``,
``"hrpb"`` is a silent runtime auth bypass). Because ``Role`` inherits
from ``str``, every enum member is interchangeable with its underlying
string literal — comparisons against role values read from the DB or
JWT continue to work without further code changes:

    >>> Role.ADMIN == "admin"
    True
    >>> "admin" in (Role.ADMIN, Role.HRBP)
    True
"""

from enum import Enum


class Role(str, Enum):
    """User roles recognised by the auth layer."""

    ADMIN = "admin"
    HRBP = "hrbp"
    RECRUITER = "recruiter"
    HIRING_MANAGER = "hiring_manager"
    STANDARD = "standard"


# Canonical unified pipeline stages used by every cross-pipeline view
# (candidates list, job detail, snapshots, frontend chips).
UNIFIED_STAGES: list[str] = [
    "ACTIVE",
    "SCREEN",
    "INTERVIEW",
    "OFFER",
    "HIRED",
    "AWAITING_START",
    "STARTED",
    "REJECTED",
]
