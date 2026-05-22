"""Onboarding lifecycle payloads (create, partial-update, bulk-update)."""

from typing import Literal, Optional

from pydantic import BaseModel


class OnboardingPayload(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    idNum: Optional[str] = None
    startDate: Optional[str] = None
    jobTitle: Optional[str] = None
    orgUnit: Optional[str] = None
    manager: Optional[str] = None
    base_salary: Optional[float] = 0
    global_salary: Optional[float] = 0
    parkingType: Optional[str] = None
    carNum: Optional[str] = None
    refName: Optional[str] = None
    refEmpNum: Optional[str] = None
    hasDisability: Optional[bool] = False

    name: Optional[str] = None
    id_num: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    start_date: Optional[str] = None
    parking: Optional[bool] = None
    car_num: Optional[str] = None
    referral_name: Optional[str] = None
    referral_id: Optional[str] = None
    diversity: Optional[str] = None


class OnboardingUpdatePayload(BaseModel):
    status_only: Optional[bool] = False
    status: Optional[str] = None
    buddy: Optional[str] = None
    equipment_ready: Optional[bool] = None
    start_date: Optional[str] = None
    notes: Optional[str] = None
    name: Optional[str] = None
    id_num: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    manager: Optional[str] = None
    base_salary: Optional[float] = None
    global_salary: Optional[float] = None
    parking: Optional[bool] = None
    car_num: Optional[str] = None
    referral_name: Optional[str] = None
    referral_id: Optional[str] = None
    diversity: Optional[str] = None


class OnboardingBulkUpdatePayload(BaseModel):
    ids: list[str]
    status: Literal["pending", "completed", "cancelled", "left_company"]
