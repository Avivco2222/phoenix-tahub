"""FinOps domain payloads: invoices, vendors, categories."""

from typing import Optional

from pydantic import BaseModel


class FinopsInvoicePayload(BaseModel):
    id: str
    vendor: str
    date: str
    dueDate: Optional[str] = ""
    budgetMonth: Optional[str] = ""
    amount: float
    category: str
    subcategory: Optional[str] = ""
    status: str
    note: Optional[str] = ""
    fileUrl: Optional[str] = ""


class FinopsVendorPayload(BaseModel):
    id: str
    name: str
    defaultCategory: Optional[str] = ""
    totalPaid: Optional[float] = 0
    activeInvoices: Optional[int] = 0


class FinopsCategoryPayload(BaseModel):
    id: int
    name: str
    target: Optional[float] = 0
    previousYearSpend: Optional[float] = 0
    code: Optional[str] = ""
    notes: Optional[str] = ""
    subcategories: Optional[list[str]] = None
