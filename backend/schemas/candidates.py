"""Candidate-edit payload."""

from typing import Optional

from pydantic import BaseModel


class CandidateEditPayload(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    linkedin: Optional[str] = None
    cv_url: Optional[str] = None
