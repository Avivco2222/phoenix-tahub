"""Smart-ingest sheet auto-detection — :func:`_detect_sheet_type`.

The smart-ingest endpoint accepts a single multi-sheet Excel and routes
each sheet to the right per-type handler. Detection is based on:

* canonical column signatures (after alias normalization)
* sheet-name hints (e.g. "מועמדים" → ``candidates``)
* a per-type minimum-match threshold

Returns ``(file_type, confidence_0_to_1)`` or ``(None, 0.0)`` for an
unidentifiable sheet.

Also exports :data:`_FK_ORDER` — the FK-safe processing order used by
the smart-ingest dispatcher (jobs before candidates before hires, etc.)
so foreign keys resolve cleanly.
"""


# Canonical sheet names (hint only, not strict).
_SHEET_NAME_HINTS: dict[str, str] = {
    "משרות": "jobs",         "jobs": "jobs",
    "מועמדים": "candidates", "candidates": "candidates",
    "גיוסים": "hires",       "hires": "hires",
    "תקן": "headcount",      "headcount": "headcount",
    "גיוון": "diversity",    "diversity": "diversity",
    "עזיבות": "attrition",   "attrition": "attrition",
    "תקציב": "budget",       "budget": "budget",
}

# Signature columns per type — MUST be canonical (post-alias names).
_SHEET_SIGNATURES: dict[str, list[str]] = {
    "jobs":       ["job_title", "department"],
    "candidates": ["candidate_name", "email", "status"],
    "hires":      ["candidate_name", "hire_date", "salary"],
    "headcount":  ["snapshot_month", "role", "standard"],
    "diversity":  ["snapshot_month", "dimension", "bucket", "count"],
    "attrition":  ["employee_name", "leave_date"],
    "budget":     ["vendor", "amount", "category"],
}

# Minimum matched-column count required to consider a sheet a given type.
_SHEET_MIN_CONFIDENCE: dict[str, int] = {
    "jobs": 2, "candidates": 2, "hires": 2,
    "headcount": 2, "diversity": 3, "attrition": 1, "budget": 2,
}

# FK-safe processing order. Smart ingest iterates types in this order so
# parent rows exist before child rows are inserted.
_FK_ORDER: list[str] = ["jobs", "candidates", "hires", "headcount", "diversity", "attrition", "budget"]


def _detect_sheet_type(df_columns: list[str], sheet_name: str = "") -> tuple[str | None, float]:
    """Returns ``(file_type, confidence)`` after column-alias normalization.

    Returns ``(None, 0.0)`` if no type passes the minimum confidence
    threshold. Sheet-name hint can override the signature score when
    matched count ties.
    """
    col_set = {c.lower() for c in df_columns}
    best_type: str | None = None
    best_score = 0
    best_confidence = 0.0

    for file_type in _FK_ORDER:
        sig = _SHEET_SIGNATURES[file_type]
        matched = sum(1 for s in sig if s in col_set)
        if matched < _SHEET_MIN_CONFIDENCE[file_type]:
            continue
        # jobs: if email present → likely candidates, not jobs
        if file_type == "jobs" and "email" in col_set:
            continue
        if matched > best_score:
            best_score = matched
            best_type = file_type
            best_confidence = round(matched / len(sig), 2)

    # Tiebreak / override: sheet name hint
    hint = _SHEET_NAME_HINTS.get(sheet_name.strip())
    if hint:
        sig = _SHEET_SIGNATURES.get(hint, [])
        matched = sum(1 for s in sig if s in col_set)
        if matched >= _SHEET_MIN_CONFIDENCE.get(hint, 2) and matched >= best_score:
            best_type = hint
            best_confidence = round(matched / len(sig), 2) if sig else 0.0

    return best_type, best_confidence
