"""Candidate-edit + candidate-create payloads."""

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


class CandidateCreatePayload(BaseModel):
    """Body for POST /api/candidates — name is mandatory; the rest mirrors
    the Edit payload plus three optional fields that, if provided, also
    create an ``applications`` row in the same transaction. This is what
    powers the "+ candidate" button on /candidates so a recruiter can add
    one person without going through the Excel ingest path.
    """

    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    linkedin: Optional[str] = None
    cv_url: Optional[str] = None
    # Optional inline-application fields:
    job_id: Optional[str] = None
    status: Optional[str] = "חדש"
    recruiter: Optional[str] = None
