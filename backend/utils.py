"""Pure utility helpers used across the backend.

Every helper here is a leaf — depends only on the standard library or
``pandas``/``numpy``, never on other backend modules. That makes the
module import-safe from any router or service without circular-import
risk.

Group / purpose:

* PII / dedup keys — :func:`mask_value`, :func:`normalize_phone`,
  :func:`normalize_email`, :func:`iteration_signature`.
* JSON-safe data normalisation — :func:`_nan_safe_records`,
  :func:`_scalar`, :func:`_row_to_scalar`, :func:`_empty_stats`.
* Misc maths/text — :func:`_safe_pct`, :func:`_to_int`,
  :func:`_normalize_score`, :func:`_col_letter`.
"""

import hashlib
import math
import re
from typing import Optional

import pandas as pd


# --- PII masking + dedup keys ---------------------------------------------


def mask_value(val) -> Optional[str]:
    """Return a 12-char SHA-256 hex digest of ``val``, or None for empty
    / sentinel values. Used to dedup candidates without storing raw PII."""
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ('nan', 'none', 'null', 'n/a', '-'):
        return None
    return hashlib.sha256(val_str.encode("utf-8")).hexdigest()[:12]


def normalize_phone(raw) -> Optional[str]:
    """Israeli mobile/landline → +972XXXXXXXXX canonical form.

    Strips non-digits, removes leading 0 / 972, returns None when the result
    isn't a plausible 9-digit IL number. Returning None means "can't dedupe
    on this field" — the caller falls back to email or inserts as new.
    """
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return None
    if digits.startswith("972"):
        digits = digits[3:]
    if digits.startswith("0"):
        digits = digits[1:]
    # IL mobile = 5XXXXXXXX (9 digits). IL landline = 2|3|4|7|8|9 + 7 digits.
    if len(digits) == 9 and digits[0] in {"5", "7"}:
        return "+972" + digits
    if len(digits) == 8 and digits[0] in {"2", "3", "4", "8", "9"}:
        return "+972" + digits
    return None


def normalize_email(raw) -> Optional[str]:
    """Lowercase + strip + basic ``@`` sanity check. None for invalid."""
    if raw is None:
        return None
    v = str(raw).strip().lower()
    if not v or "@" not in v:
        return None
    return v


def iteration_signature(status, application_date, recruiter) -> str:
    """Stable 16-char digest used in the unique index
    (candidate_id, job_id, iteration_signature). Two rows are the SAME
    iteration only if all three of status, date and recruiter match.
    Inputs may be strings, datetimes, NaN, None — anything stringifiable.
    """
    def _norm(v) -> str:
        if v is None:
            return ""
        if isinstance(v, float) and pd.isna(v):
            return ""
        return str(v).strip().lower()
    parts = [
        _norm(status),
        _norm(application_date)[:10],
        _norm(recruiter),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


# --- JSON-safe DataFrame conversions --------------------------------------


def _nan_safe_records(df: "pd.DataFrame") -> list:
    """Convert a DataFrame to a list of records, replacing NaN/inf/numpy
    types with JSON-safe values.

    Python's ``json.dumps`` raises ValueError on ``float('nan')`` and
    ``float('inf')``. pandas DataFrames frequently have NaN floats in
    numeric columns when a DB row has NULL. This utility converts them
    to ``None`` so FastAPI can serialise them as JSON null values. It
    also handles numpy scalar types (``np.int64``, ``np.float64``, …)
    that are not JSON serialisable.
    """
    try:
        import numpy as np
        _np_integer = np.integer
        _np_floating = np.floating
        _np_ndarray = np.ndarray
    except ImportError:
        _np_integer = _np_floating = _np_ndarray = type(None)  # type: ignore

    raw = df.where(df.notna(), other=None).to_dict(orient="records")

    def safe(v):
        if v is None:
            return None
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        if isinstance(v, _np_integer):
            return int(v)
        if isinstance(v, _np_floating):
            f = float(v)
            return None if (math.isnan(f) or math.isinf(f)) else f
        if isinstance(v, _np_ndarray):
            return v.tolist()
        return v

    return [{k: safe(v) for k, v in row.items()} for row in raw]


def _scalar(value):
    """Coerce ``value`` to something SQLite's parameter binding accepts.

    SQLite doesn't accept pandas Timestamps / NaT / numpy floats / etc.
    Returns ``None`` for NaN-likes, native Python types otherwise.

    IMPORTANT: pandas reads CSV columns of all-digit values as float64.
    A phone "0541234567" becomes 541234567.0 — ``str()`` of that yields
    "541234567.0", and :func:`normalize_phone` then sees 10 digits and
    bails out. To preserve dedup keys, this function narrows whole-number
    floats to ``int`` first so downstream code sees a clean numeric string.
    """
    if value is None:
        return None
    if isinstance(value, float):
        if pd.isna(value):
            return None
        if value.is_integer():
            return int(value)
        return value
    if isinstance(value, (str, int, bool, bytes)):
        return value
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    if pd.isna(value):
        return None
    return str(value)


def _row_to_scalar(parsed: dict) -> dict:
    """Apply :func:`_scalar` to every value in a parsed row. Use before INSERTs."""
    return {k: _scalar(v) for k, v in parsed.items()}


def _empty_stats() -> dict:
    """Per-batch stats. ``inserted``/``updated``/``skipped_duplicate`` are
    entity-level aggregates (kept for backwards compat with the legacy
    ingest UI); the per-entity counters below let the new admin Toast
    and Diff modal say 'X new candidates · Y new applications · Z skipped'
    precisely.
    """
    return {
        "received": 0,
        # Legacy aggregates (sum over all entity types in this batch):
        "inserted": 0, "updated": 0, "skipped_duplicate": 0,
        # Per-entity breakdown:
        "candidates_inserted": 0, "candidates_updated": 0,
        "applications_inserted": 0, "applications_skipped": 0,
        "jobs_inserted": 0, "jobs_updated": 0,
        # Pipeline outcome:
        "rejected": 0, "rejected_reasons": [],
    }


# --- Misc maths / text ----------------------------------------------------


def _safe_pct(numerator: int, denominator: int) -> float:
    """Percentage with safe divide-by-zero (returns 0.0)."""
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def _to_int(value, fallback: int) -> int:
    """Best-effort int conversion, returning ``fallback`` on TypeError/ValueError."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_score(value: float, lower: float, upper: float) -> float:
    """Clip ``value`` to ``[lower, upper]`` and rescale to ``[0, 1]``."""
    if upper <= lower:
        return 0.0
    clipped = min(max(value, lower), upper)
    return (clipped - lower) / (upper - lower)


def _col_letter(idx: int) -> str:
    """1-based column index → Excel letter (A, B, ..., Z, AA, AB, ...)."""
    s = ""
    while idx > 0:
        idx, r = divmod(idx - 1, 26)
        s = chr(65 + r) + s
    return s
