"""Pydantic request/response schemas for the Phoenix Talent OS backend.

Originally these models lived inline in main.py (lines 296–414 and
~6643), forcing every reader to scroll past them to find route logic
and making API contract changes invisible in code review. They are now
grouped by domain — onboarding, candidates, jobs, applications, finops,
anomalies — and re-exported here for backward-compatible imports.

Existing call sites can keep using ``from schemas import X`` rather than
the more specific ``from schemas.onboarding import X`` if they prefer.
"""

from .anomalies import AnomalyReviewPayload
from .applications import ApplicationEditPayload
from .candidates import CandidateEditPayload
from .finops import (
    FinopsCategoryPayload,
    FinopsInvoicePayload,
    FinopsVendorPayload,
)
from .jobs import JobEditPayload, JobsBulkUpdatePayload
from .onboarding import (
    OnboardingBulkUpdatePayload,
    OnboardingPayload,
    OnboardingUpdatePayload,
)

__all__ = [
    "AnomalyReviewPayload",
    "ApplicationEditPayload",
    "CandidateEditPayload",
    "FinopsCategoryPayload",
    "FinopsInvoicePayload",
    "FinopsVendorPayload",
    "JobEditPayload",
    "JobsBulkUpdatePayload",
    "OnboardingBulkUpdatePayload",
    "OnboardingPayload",
    "OnboardingUpdatePayload",
]
