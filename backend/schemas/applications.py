"""Application (= candidate-on-job assignment) edit payload."""

from typing import Optional

from pydantic import BaseModel


class ApplicationEditPayload(BaseModel):
    status: Optional[str] = None
    stage_code: Optional[str] = None
    recruiter: Optional[str] = None
    application_date: Optional[str] = None
    days_in_process: Optional[int] = None
