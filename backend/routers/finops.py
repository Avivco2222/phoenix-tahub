"""FinOps endpoints — invoices, vendors, categories.

Six routes that drive the admin FinOps tab:

    GET    /api/finops/data                — full dataset (cats/vendors/invoices)
    POST   /api/finops/upload_invoice      — stash a PDF/image, return stub data
    POST   /api/finops/save_invoice        — upsert one invoice row
    DELETE /api/finops/invoice/{id}        — remove invoice
    POST   /api/finops/save_vendor         — upsert one vendor row
    POST   /api/finops/save_categories     — replace the whole category set

All routes are gated by ``require_dual_role(ADMIN, HRBP)``. Endpoint
bodies are reproduced verbatim from main.py (same SQL, same error
handling, same return shapes) — this is a pure relocation with no
observable API change.
"""

import json
import os
import sqlite3
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, File, Request, UploadFile

import config as shared_config
from auth import require_dual_role
from constants import Role
from rate_limit import limiter
from schemas import (
    FinopsCategoryPayload,
    FinopsInvoicePayload,
    FinopsVendorPayload,
)


router = APIRouter(tags=["finops"])


# --- Late-bound proxies to file-upload helpers still in main.py -----------
# These two functions are shared with other routers (ingestion, etc.) and
# stay in main.py until their own extraction commit. The lazy import here
# avoids a circular import at module load.
def _validate_upload_file(file, *, allowed_extensions, allowed_mime_prefixes):
    from main import _validate_upload_file as _impl
    return _impl(
        file,
        allowed_extensions=allowed_extensions,
        allowed_mime_prefixes=allowed_mime_prefixes,
    )


async def _read_file_with_limit(file):
    from main import _read_file_with_limit as _impl
    return await _impl(file)


@router.get("/api/finops/data")
def get_finops_data(_: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP))):
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        categories_df = pd.read_sql("SELECT * FROM finops_categories", conn)
        categories = categories_df.to_dict(orient="records")
        for cat in categories:
            cat['subcategories'] = json.loads(cat['subcategories']) if cat['subcategories'] else []

        vendors_df = pd.read_sql("SELECT * FROM finops_vendors", conn)
        invoices_df = pd.read_sql("SELECT * FROM finops_invoices ORDER BY date DESC", conn)

        return {
            "categories": categories,
            "vendors": vendors_df.to_dict(orient="records"),
            "invoices": invoices_df.to_dict(orient="records")
        }
    except Exception as e:
        return {"error": str(e), "categories": [], "vendors": [], "invoices": []}
    finally:
        conn.close()


@router.post("/api/finops/upload_invoice")
@limiter.limit("10/minute")
async def upload_invoice(
    request: Request,
    file: UploadFile = File(...),
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """מקבל קובץ PDF/תמונה של חשבונית, שומר אותו ומחזיר נתונים ראשוניים"""
    _validate_upload_file(
        file,
        allowed_extensions={".pdf", ".png", ".jpg", ".jpeg", ".webp"},
        allowed_mime_prefixes=("application/pdf", "image/"),
    )
    content = await _read_file_with_limit(file)
    os.makedirs("uploads/invoices", exist_ok=True)
    file_path = f"uploads/invoices/{uuid.uuid4().hex[:8]}_{file.filename}"

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    extracted_data = {
        "id": f"INV-{uuid.uuid4().hex[:6].upper()}",
        "vendor": "ספק לא מזוהה (זיהוי AI)",
        "amount": 0,
        "date": pd.Timestamp.now().strftime("%d/%m/%Y"),
        "category": "כללי למיפוי",
        "subcategory": "אחר",
        "status": "ממתין למיפוי",
        "file_url": file_path
    }

    return {"message": "Invoice processed", "extracted_data": extracted_data}


@router.post("/api/finops/save_invoice")
def save_invoice(
    invoice: FinopsInvoicePayload,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    conn = sqlite3.connect(shared_config.DB_NAME)
    c = conn.cursor()
    try:
        payload = invoice.model_dump()
        c.execute('''INSERT OR REPLACE INTO finops_invoices
                     (id, vendor, date, due_date, budget_month, amount, category, subcategory, status, note, file_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                 (payload['id'], payload['vendor'], payload['date'], payload.get('dueDate', ''),
                  payload.get('budgetMonth', ''), payload['amount'], payload['category'],
                  payload.get('subcategory', ''), payload['status'], payload.get('note', ''), payload.get('fileUrl', '')))
        conn.commit()
        return {"message": "Invoice saved"}
    finally:
        conn.close()


@router.delete("/api/finops/invoice/{invoice_id}")
def delete_invoice(
    invoice_id: str,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    conn = sqlite3.connect(shared_config.DB_NAME)
    c = conn.cursor()
    try:
        c.execute("DELETE FROM finops_invoices WHERE id = ?", (invoice_id,))
        conn.commit()
        return {"message": "Deleted"}
    finally:
        conn.close()


@router.post("/api/finops/save_vendor")
def save_vendor(
    vendor: FinopsVendorPayload,
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    conn = sqlite3.connect(shared_config.DB_NAME)
    c = conn.cursor()
    try:
        payload = vendor.model_dump()
        c.execute('''INSERT OR REPLACE INTO finops_vendors (id, name, default_category, total_paid, active_invoices)
                     VALUES (?, ?, ?, ?, ?)''',
                 (payload['id'], payload['name'], payload.get('defaultCategory', ''), payload.get('totalPaid', 0), payload.get('activeInvoices', 0)))
        conn.commit()
        return {"message": "Vendor saved"}
    finally:
        conn.close()


@router.post("/api/finops/save_categories")
def save_categories(
    categories: list[FinopsCategoryPayload],
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    conn = sqlite3.connect(shared_config.DB_NAME)
    c = conn.cursor()
    try:
        c.execute("DELETE FROM finops_categories")
        for cat_model in categories:
            cat = cat_model.model_dump()
            subs = json.dumps(cat.get('subcategories', []) or [])
            c.execute('''INSERT INTO finops_categories (id, name, target, previous_year_spend, code, notes, subcategories)
                         VALUES (?, ?, ?, ?, ?, ?, ?)''',
                      (cat['id'], cat['name'], cat.get('target', 0), cat.get('previousYearSpend', 0), cat.get('code', ''), cat.get('notes', ''), subs))
        conn.commit()
        return {"message": "Categories synced"}
    finally:
        conn.close()
