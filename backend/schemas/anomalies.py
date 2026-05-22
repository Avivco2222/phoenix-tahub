"""Anomaly-review payload (dismiss / resolve)."""

from typing import Literal, Optional

from pydantic import BaseModel


class AnomalyReviewPayload(BaseModel):
    status: Literal["dismissed", "resolved", "open"]
    note: Optional[str] = None
