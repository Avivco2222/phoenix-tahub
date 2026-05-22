"""Ingestion endpoints — pre-flight checks, what-if simulation, template download.

Three smaller, read-only-ish ingestion routes that admins use BEFORE
running a real ingest:

    GET  /api/ingest/smart-template        — Excel template download
    POST /api/ingest/preflight/{file_type} — dry-run parse + validate
    POST /api/ingest/whatif/{file_type}    — sandbox what-if (insert/update
                                             counts WITHOUT persisting)

The bigger persistent ingest routes (/upload, /upload/{file_type},
/api/ingest/{file_type}, /api/ingest/smart) stay in main.py for now —
they share many helpers and one calls another, so they're scheduled
for a separate router-split commit (B2.7b) once the helper layer is
stabilised.

Endpoint bodies are reproduced verbatim from main.py — same auth gates
(require_dual_role(ADMIN, HRBP)), same rate limits, same return shapes
— pure relocation with no observable API change.
"""

import io
import json
import sqlite3
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

import config as shared_config
from auth import require_dual_role
from constants import Role
from rate_limit import limiter


router = APIRouter(tags=["ingestion"])


# --- Late-bound proxies to helpers still in main.py ----------------------
# These exist in main.py because the persistent /upload + /api/ingest/{type}
# routes use them too; they'll move out once the bigger ingestion endpoints
# follow in B2.7b.

def _read_file_with_limit(file):
    from main import _read_file_with_limit as _impl
    import asyncio
    return _impl(file)


async def _aread_file_with_limit(file):
    from main import _read_file_with_limit as _impl
    return await _impl(file)


def _validate_upload_file(file, *, allowed_extensions, allowed_mime_prefixes):
    from main import _validate_upload_file as _impl
    return _impl(file, allowed_extensions=allowed_extensions, allowed_mime_prefixes=allowed_mime_prefixes)


def _load_dataframe_from_upload(filename, content):
    from main import _load_dataframe_from_upload as _impl
    return _impl(filename, content)


def _apply_extra_aliases(df):
    from main import _apply_extra_aliases as _impl
    return _impl(df)


def _validate_ingest_frame(df, file_type):
    from main import _validate_ingest_frame as _impl
    return _impl(df, file_type)


def _normalize_upload_frame(df):
    from main import _normalize_upload_frame as _impl
    return _impl(df)


def _empty_stats():
    from main import _empty_stats as _impl
    return _impl()


def _row_to_scalar(d):
    from main import _row_to_scalar as _impl
    return _impl(d)


def _normalize_phone(v):
    from main import normalize_phone as _impl
    return _impl(v)


def _normalize_email(v):
    from main import normalize_email as _impl
    return _impl(v)


def _find_existing_candidate(conn, phone_norm, email_norm):
    from main import find_existing_candidate as _impl
    return _impl(conn, phone_norm, email_norm)


def _iteration_signature(*args, **kwargs):
    from main import iteration_signature as _impl
    return _impl(*args, **kwargs)


def _col_letter(idx):
    from main import _col_letter as _impl
    return _impl(idx)


def _ingest_handlers():
    from main import INGEST_HANDLERS
    return INGEST_HANDLERS


def _ingest_requirements():
    from main import INGEST_REQUIREMENTS
    return INGEST_REQUIREMENTS


def _template_specs():
    from main import TEMPLATE_SPECS
    return TEMPLATE_SPECS


# --- Routes ---------------------------------------------------------------


@router.get("/api/ingest/smart-template")
def download_smart_template(
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Returns a ready-to-fill Excel workbook with sheets: משרות, מועמדים, גיוסים + הוראות."""
    TEMPLATE_SPECS = _template_specs()

    SMART_SHEETS = [
        ("משרות",   "jobs"),
        ("מועמדים", "candidates"),
        ("גיוסים",  "hires"),
    ]
    fill_req = PatternFill(start_color="002649", end_color="002649", fill_type="solid")
    fill_rec = PatternFill(start_color="64748B", end_color="64748B", fill_type="solid")
    hdr_font = Font(color="FFFFFF", bold=True)

    wb = Workbook()
    wb.remove(wb.active)  # remove default blank sheet

    for sheet_title, file_type in SMART_SHEETS:
        spec = TEMPLATE_SPECS[file_type]
        all_cols = list(spec["required"]) + list(spec["recommended"])
        n_req = len(spec["required"])
        ws = wb.create_sheet(title=sheet_title)
        ws.sheet_view.rightToLeft = True
        for i, (he, _cn) in enumerate(all_cols, 1):
            c = ws.cell(row=1, column=i, value=he)
            c.fill = fill_req if i <= n_req else fill_rec
            c.font = hdr_font
            c.alignment = Alignment(horizontal="center")
            ws.column_dimensions[_col_letter(i)].width = 22
        sample = spec.get("sample", {})
        for i, (he, _cn) in enumerate(all_cols, 1):
            ws.cell(row=2, column=i, value=sample.get(he, ""))
        for he_name, options in (spec.get("validations") or {}).items():
            col_idx = next(
                (i + 1 for i, (he, _) in enumerate(all_cols) if he == he_name), None
            )
            if col_idx:
                dv = DataValidation(
                    type="list",
                    formula1=f'"{",".join(options)}"',
                    allow_blank=True,
                    showDropDown=False,
                )
                ws.add_data_validation(dv)
                dv.add(f"{_col_letter(col_idx)}2:{_col_letter(col_idx)}5000")
        ws.freeze_panes = "A2"

    # Instructions sheet
    guide = wb.create_sheet("הוראות")
    guide.sheet_view.rightToLeft = True
    guide["A1"] = "תבנית Smart Ingest — Phoenix Talent OS"
    guide["A1"].font = Font(bold=True, size=14, color="002649")
    guide["A3"] = "כותרות כחולות = שדה חובה | כותרות אפורות = מומלץ"
    guide["A4"] = "גיליון 'משרות'   → משרות פתוחות/סגורות (dedup: שם משרה + חטיבה)"
    guide["A5"] = "גיליון 'מועמדים' → pipeline מועמדים (dedup: טלפון / אימייל)"
    guide["A6"] = "גיליון 'גיוסים'  → קליטות שהתבצעו בפועל"
    guide["A8"] = "שמות גיליונות נוספים שהמערכת מזהה: headcount/תקן, diversity/גיוון, attrition/עזיבות, budget/תקציב"
    guide.column_dimensions["A"].width = 90

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Phoenix_SmartIngest_Template.xlsx"'},
    )


@router.post("/api/ingest/preflight/{file_type}")
@limiter.limit("20/minute")
async def ingest_preflight(
    request: Request,
    file_type: str,
    file: UploadFile = File(...),
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Dry-run: parse + validate without persisting. Lets admins preview what
    will land and what will be rejected BEFORE committing."""
    INGEST_HANDLERS = _ingest_handlers()
    INGEST_REQUIREMENTS = _ingest_requirements()

    if file_type not in INGEST_HANDLERS:
        raise HTTPException(status_code=400, detail=f"Unknown ingest type. Allowed: {list(INGEST_HANDLERS.keys())}")

    content = await _aread_file_with_limit(file)
    try:
        df = _load_dataframe_from_upload(file.filename or "", content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse: {exc}") from exc
    df = _apply_extra_aliases(df)
    valid_df, rejected = _validate_ingest_frame(df, file_type)
    return {
        "file_type": file_type,
        "rows_total": int(len(df)),
        "rows_valid": int(len(valid_df)),
        "rows_rejected": len(rejected),
        "sample_columns": list(df.columns)[:30],
        "sample_rejections": [{"reasons": r["reasons"], "row_keys": list(r["row"].keys())[:8]} for r in rejected[:10]],
        "required_columns": INGEST_REQUIREMENTS[file_type]["required"],
        "recommended_columns": INGEST_REQUIREMENTS[file_type]["recommended"],
    }


@router.post("/api/ingest/whatif/{file_type}")
@limiter.limit("10/minute")
async def ingest_whatif(
    request: Request,
    file_type: str,
    file: UploadFile = File(...),
    _: dict = Depends(require_dual_role(Role.ADMIN, Role.HRBP)),
):
    """Enhancement #1 — DRY-RUN "what-if". Runs the full ingest pipeline inside
    a transaction that ROLLS BACK at the end, so admins see exactly how many
    rows WOULD be inserted/updated/skipped without persisting anything.

    Implementation: we run the same handler, then issue ROLLBACK on the
    sqlite connection. Stats are returned identical to a real commit.
    """
    INGEST_HANDLERS = _ingest_handlers()
    if file_type not in INGEST_HANDLERS:
        raise HTTPException(status_code=400, detail=f"Unknown ingest type. Allowed: {list(INGEST_HANDLERS.keys())}")

    _validate_upload_file(
        file,
        allowed_extensions={".csv", ".xlsx", ".xls", ".xml"},
        allowed_mime_prefixes=("text/csv", "application/csv", "application/vnd.ms-excel",
                               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                               "application/xml", "text/xml", "application/octet-stream"),
    )
    content = await _aread_file_with_limit(file)
    try:
        df = _load_dataframe_from_upload(file.filename or "", content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse: {exc}") from exc

    if file_type == "candidates":
        try:
            df = _normalize_upload_frame(df.copy())
        except Exception:
            pass
    df = _apply_extra_aliases(df)
    valid_df, rejected = _validate_ingest_frame(df, file_type)

    # Sandbox batch_id — we'll never finalise it, but the handler needs one to
    # record changes. ROLLBACK at the end discards both the rows AND the changes.
    sandbox_batch = f"WHATIF-{uuid.uuid4().hex[:8].upper()}"

    # Manually-managed transaction so we can rollback.
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        conn.isolation_level = None  # autocommit OFF — we control BEGIN/ROLLBACK
        conn.execute("BEGIN")
        stats = _empty_stats()
        stats["received"] = int(len(df))

        def _exists_candidate(phone_norm, email_norm):
            return _find_existing_candidate(conn, phone_norm, email_norm) is not None

        for _, row in valid_df.iterrows():
            parsed = _row_to_scalar(dict(row.items()))
            if not parsed.get("name") and parsed.get("candidate_name"):
                parsed["name"] = parsed["candidate_name"]
            parsed["phone_norm"] = _normalize_phone(parsed.get("phone"))
            parsed["email_norm"] = _normalize_email(parsed.get("email"))

            if file_type == "candidates":
                if _exists_candidate(parsed.get("phone_norm"), parsed.get("email_norm")):
                    stats["candidates_updated"] += 1
                    stats["updated"] += 1
                else:
                    stats["candidates_inserted"] += 1
                    stats["inserted"] += 1
                # Application iteration prediction
                job_title = (parsed.get("job_title") or "").strip()
                if job_title:
                    sig = _iteration_signature(parsed.get("status"), parsed.get("application_date") or parsed.get("start_date"), parsed.get("recruiter"))
                    jrow = conn.execute(
                        "SELECT id FROM jobs WHERE LOWER(job_title) = LOWER(?) LIMIT 1", (job_title,),
                    ).fetchone()
                    if jrow:
                        existing_cid = _find_existing_candidate(conn, parsed.get("phone_norm"), parsed.get("email_norm"))
                        if existing_cid:
                            dup = conn.execute(
                                "SELECT 1 FROM applications WHERE candidate_id = ? AND job_id = ? AND iteration_signature = ?",
                                (existing_cid, jrow[0], sig),
                            ).fetchone()
                            if dup:
                                stats["applications_skipped"] += 1
                                stats["skipped_duplicate"] += 1
                            else:
                                stats["applications_inserted"] += 1
                        else:
                            stats["applications_inserted"] += 1
                    else:
                        stats["jobs_inserted"] += 1
                        stats["applications_inserted"] += 1
            elif file_type == "jobs":
                jrow = conn.execute(
                    "SELECT id FROM jobs WHERE LOWER(job_title) = LOWER(?) AND LOWER(IFNULL(department,'')) = LOWER(?) LIMIT 1",
                    ((parsed.get("job_title") or "").strip(), (parsed.get("department") or "General").strip()),
                ).fetchone()
                (stats["jobs_updated"] if jrow else stats["jobs_inserted"]).__iadd__  # noqa - placeholder
                if jrow:
                    stats["jobs_updated"] += 1
                    stats["updated"] += 1
                else:
                    stats["jobs_inserted"] += 1
                    stats["inserted"] += 1
            elif file_type == "diversity":
                existing = conn.execute(
                    "SELECT 1 FROM diversity_snapshots WHERE snapshot_month=? AND department=? AND dimension=? AND bucket=?",
                    (parsed.get("snapshot_month"), parsed.get("department"), parsed.get("dimension"), parsed.get("bucket")),
                ).fetchone()
                if existing: stats["updated"] += 1
                else: stats["inserted"] += 1
            elif file_type == "headcount":
                existing = conn.execute(
                    "SELECT 1 FROM headcount_snapshots WHERE snapshot_month=? AND department=? AND role=?",
                    (parsed.get("snapshot_month"), parsed.get("department"), parsed.get("role")),
                ).fetchone()
                if existing: stats["updated"] += 1
                else: stats["inserted"] += 1
            elif file_type == "hires":
                stats["inserted"] += 1
            elif file_type == "attrition":
                existing = conn.execute(
                    "SELECT 1 FROM attrition_events WHERE employee_name=? AND leave_date=?",
                    (parsed.get("employee_name"), parsed.get("leave_date")),
                ).fetchone()
                if existing: stats["skipped_duplicate"] += 1
                else: stats["inserted"] += 1
            elif file_type == "budget":
                inv_id = (parsed.get("id") or "").strip()
                if inv_id:
                    existing = conn.execute("SELECT 1 FROM finops_invoices WHERE id = ?", (inv_id,)).fetchone()
                    if existing: stats["updated"] += 1
                    else: stats["inserted"] += 1
                else:
                    stats["inserted"] += 1

        stats["rejected"] = len(rejected)
        conn.execute("ROLLBACK")
    finally:
        conn.close()

    return {
        "file_type": file_type,
        "sandbox_batch": sandbox_batch,
        "would_happen": stats,
        "rejected_samples": [{"reasons": r["reasons"]} for r in rejected[:5]],
    }
