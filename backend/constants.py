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
#
# Audit Phase 4 / Wave B expanded this list from 8 to 14 stages so the
# Phoenix ATS terminology (sourced from the May 2026 export, see
# docs/METRICS_GUIDE.md) maps 1:1 onto our codes:
#
#   הגיש מועמדות למשרה / ספק הגיש קו"ח      → SOURCING (new)
#   שלילה- סינון קוח (and similar in-screen) → SCREEN
#   ראיון טלפוני                              → PHONE_INTERVIEW (new)
#   ראיון גיוס HR (+ "+ מנהל" variant)        → HR_INTERVIEW (new)
#   ראיון מנהל מקצועי / זימון לראיון מנהל    → MANAGER_INTERVIEW (new)
#   מבדקים                                    → TESTS (new)
#   בדיקת ממליצים                            → REFERENCES (new)
#   הצעה למועמד / הצעת חוזה                 → OFFER
#   יועסקו / ניוד פנימי-יועסקו               → HIRED
#   ממתין לקליטה                              → AWAITING_START
#   קליטה / בקליטה פעילה                     → STARTED
#   שלילה- *  (org-initiated closure)         → REJECTED  (closure_stage holds the specific funnel point)
#   הסרת מועמדות- *  (candidate self-removed)→ WITHDRAWN (new; closure_stage holds the specific funnel point)
#   אין מענה לאחר מס' נסיונות                → NO_RESPONSE (new)
#
# We keep INTERVIEW (no prefix) as a legacy/aggregate code so historical
# rows that pre-date the split (or rows from data sources that don't
# distinguish phone/HR/manager) still resolve to a known stage. The
# pipeline.compute_unified_stage logic prefers the specific stage when
# the source text supports it.
UNIFIED_STAGES: list[str] = [
    "ACTIVE",
    "SOURCING",
    "SCREEN",
    "PHONE_INTERVIEW",
    "HR_INTERVIEW",
    "MANAGER_INTERVIEW",
    "INTERVIEW",          # legacy/aggregate — kept for back-compat
    "TESTS",
    "REFERENCES",
    "OFFER",
    "HIRED",
    "AWAITING_START",
    "STARTED",
    "REJECTED",
    "WITHDRAWN",
    "NO_RESPONSE",
]
