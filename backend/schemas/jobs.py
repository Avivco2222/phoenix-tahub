"""Job CRUD + bulk-update payloads.

Note on ``JobsBulkUpdatePayload``: this model historically carried a
handful of onboarding-style fields (``name``, ``manager``,
``base_salary``, etc.) that no handler reads. They are preserved
verbatim here because removing them is an API-contract change and
warrants its own commit; the practical effect today is that pydantic
silently accepts and ignores them.
"""

from typing import Literal, Optional

from pydantic import BaseModel


class JobEditPayload(BaseModel):
    job_title: Optional[str] = None
    department: Optional[str] = None
    hiring_manager: Optional[str] = None
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None
    close_reason: Optional[str] = None
    target_count: Optional[int] = None


class JobCreatePayload(BaseModel):
    """Body for POST /api/jobs. ``job_title`` and ``department`` are both
    required because the dedup key is the ``(job_title, department)`` pair —
    a job named "Backend Engineer" can legitimately exist in both R&D and
    Service, so neither alone is unique."""

    job_title: str
    department: str
    hiring_manager: Optional[str] = None
    opened_at: Optional[str] = None
    target_count: Optional[int] = 1


class JobsBulkUpdatePayload(BaseModel):
    job_titles: list[str]
    action: Literal["close", "set_status", "assign_recruiter"]
    status: Optional[str] = None
    recruiter: Optional[str] = None
    status: Optional[str] = None  # noqa - duplicate kept for parity with main.py
    name: Optional[str] = None
    id_num: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    manager: Optional[str] = None
    start_date: Optional[str] = None
    base_salary: Optional[float] = 0
    global_salary: Optional[float] = 0
    parking: Optional[bool] = None
    car_num: Optional[str] = None
    referral_name: Optional[str] = None
    referral_id: Optional[str] = None
    diversity: Optional[str] = None
