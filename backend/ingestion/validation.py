"""Validation + dedup helpers for the ingestion pipeline.

Owns:

* :data:`INGEST_REQUIREMENTS` — per-file-type required/recommended
  columns (the contract the frontend template builder reads from).
* :func:`_validate_ingest_frame` — checks the DataFrame against the
  requirements above and returns a (valid_df, rejected_rows) split.
* :func:`_validate_schema_contract` / :func:`_load_schema_contract` —
  contract-file-based validation used by the legacy ``/upload`` path
  (per-version JSON contract under ``backend/contracts/``).
* :func:`find_existing_candidate` — phone/email-based dedup lookup
  used by every ingest path before deciding insert-vs-update.
* Module-level constants used across the pipeline:
  :data:`SUPPORTED_SCHEMA_VERSIONS`, :data:`DEFAULT_SCHEMA_VERSION`,
  :data:`MAX_ERROR_RATE`, :data:`CONTRACTS_DIR`.
"""

import json
import os
import sqlite3
from typing import Optional

import pandas as pd
from fastapi import HTTPException


SUPPORTED_SCHEMA_VERSIONS: set[str] = {"1.0"}
DEFAULT_SCHEMA_VERSION: str = "1.0"
MAX_ERROR_RATE: float = float(os.getenv("MAX_INGEST_ERROR_RATE", "0.2"))
# ``backend/contracts/`` — JSON schema contract files live alongside this
# module's grandparent (the backend root).
CONTRACTS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "contracts")


INGEST_REQUIREMENTS: dict[str, dict] = {
    "candidates": {
        # Accept either alias: "candidate_name" (new canonical via EXTRA_HEBREW_ALIASES)
        # or "name" (legacy via _normalize_upload_frame). Validation succeeds when EITHER
        # is present — handled by _validate_ingest_frame's per-row required check below.
        "required": ["candidate_name"],
        "recommended": ["email", "phone", "job_title", "status", "recruiter"],
        "description": "מועמדים בתהליך — שורה אחת לכל איטרציית מועמד×משרה",
    },
    "jobs": {
        "required": ["job_title", "department"],
        "recommended": ["hiring_manager", "opened_at", "target_count"],
        "description": "פתיחת/סגירת משרות — שורה אחת לכל משרה",
    },
    "hires": {
        "required": ["candidate_name", "job_title", "hire_date"],
        "recommended": ["salary", "department", "manager"],
        "description": "קליטות עובדים שהתבצעו",
    },
    "diversity": {
        "required": ["snapshot_month", "department", "dimension", "bucket", "count"],
        "recommended": [],
        "description": "מדדי גיוון לפי חודש × מחלקה × ממד",
    },
    "headcount": {
        "required": ["snapshot_month", "department", "role"],
        "recommended": ["standard", "current", "attrition_ytd", "hire_plan"],
        "description": "תקן מצבה (תקן מול בפועל) לפי חודש × מחלקה × תפקיד",
    },
    "budget": {
        "required": ["id", "vendor", "date", "amount", "category"],
        "recommended": ["due_date", "budget_month", "status", "file_url"],
        "description": "חשבוניות FinOps",
    },
    "attrition": {
        "required": ["employee_name", "leave_date"],
        "recommended": ["department", "manager", "reason", "voluntary"],
        "description": "אירועי עזיבה",
    },
}


def _load_schema_contract(schema_version: str) -> dict:
    """Load and return the JSON contract for ``schema_version``."""
    candidates = [
        os.path.join(CONTRACTS_DIR, f"ingestion_schema_v{schema_version.replace('.', '_')}.json"),
        os.path.join(CONTRACTS_DIR, f"ingestion_schema_v{schema_version.split('.')[0]}.json"),
    ]
    contract_path = next((p for p in candidates if os.path.exists(p)), None)
    if not contract_path:
        raise Exception(f"Missing schema contract file for version {schema_version}")
    with open(contract_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _validate_schema_contract(df: pd.DataFrame, schema_version: str) -> None:
    """Raise when ``df`` lacks a required column declared in the contract."""
    contract = _load_schema_contract(schema_version)
    required_columns = contract.get("required_columns", [])
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise Exception(f"Schema validation failed. Missing columns: {','.join(missing)}")


def _validate_ingest_frame(df: pd.DataFrame, file_type: str) -> tuple[pd.DataFrame, list[dict]]:
    """Returns (valid_df, rejected_rows). A row is rejected when any required
    column is missing/empty. The reason is human-readable Hebrew for the
    rejected_rows admin view."""
    spec = INGEST_REQUIREMENTS.get(file_type)
    if not spec:
        raise HTTPException(status_code=400, detail=f"Unknown ingest type: {file_type}")
    required = spec["required"]
    missing_cols = [c for c in required if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"חסרות עמודות חובה לסוג '{file_type}': {', '.join(missing_cols)}",
        )

    rejected: list[dict] = []
    keep_mask: list[bool] = []
    for _, row in df.iterrows():
        problems = []
        for col in required:
            val = row.get(col)
            if val is None or (isinstance(val, str) and not val.strip()):
                problems.append(f"חסר ערך ל'{col}'")
            elif isinstance(val, float) and pd.isna(val):
                problems.append(f"חסר ערך ל'{col}'")
        if problems:
            rejected.append({"row": row.to_dict(), "reasons": problems})
            keep_mask.append(False)
        else:
            keep_mask.append(True)
    return df[keep_mask].reset_index(drop=True), rejected


def find_existing_candidate(
    conn: sqlite3.Connection,
    phone_norm: Optional[str],
    email_norm: Optional[str],
) -> Optional[str]:
    """Returns candidate.id if a row already exists matching the normalized
    phone OR email. Phone takes precedence (more unique in IL B2C). Returns
    None when nothing to match against — caller inserts a new candidate."""
    if not phone_norm and not email_norm:
        return None
    c = conn.cursor()
    if phone_norm:
        row = c.execute("SELECT id FROM candidates WHERE phone_norm = ? LIMIT 1", (phone_norm,)).fetchone()
        if row:
            return row[0]
    if email_norm:
        row = c.execute("SELECT id FROM candidates WHERE email_norm = ? LIMIT 1", (email_norm,)).fetchone()
        if row:
            return row[0]
    return None
