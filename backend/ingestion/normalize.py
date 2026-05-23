"""Column-alias and frame-normalisation helpers.

The two routes through which uploaded data reaches the per-type
handlers each get their own normaliser:

* :func:`_normalize_upload_frame` runs on the **legacy** candidates
  upload path. It applies :data:`LEGACY_CANDIDATE_ALIASES`, fills in
  defaults for missing columns, normalises department names via
  :data:`DEPT_NORMALIZATION`, parses ``start_date`` and computes
  ``days_in_process``. The legacy path's canonical columns are short
  (``name``, ``email``, ``job_title``, ``recruiter``, ...).
* :func:`_apply_extra_aliases` runs on the **typed** ingestion path
  (``/api/ingest/{file_type}`` for jobs/hires/diversity/headcount/
  budget/attrition). It applies :data:`TYPED_INGEST_ALIASES` and
  exposes both ``name`` and ``candidate_name`` so downstream code on
  either side of the legacy/typed divide passes.
"""

import pandas as pd

from aliases import LEGACY_CANDIDATE_ALIASES, TYPED_INGEST_ALIASES


# Hebrew department names → canonical English buckets used by analytics.
DEPT_NORMALIZATION: dict[str, str] = {
    "מו\"פ": "R&D",
    "פיתוח": "R&D",
    "משאבי אנוש": "HR",
    "משאבי-אנוש": "HR",
    "מכירות ושירות": "Sales & Service",
    "שירות": "Sales & Service",
}


def _normalize_upload_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Legacy candidates path. Renames Hebrew columns, fills missing
    fields with defaults, normalises department, parses date and
    computes ``days_in_process``. Raises on missing ``name`` / ``job_title``."""
    df.columns = df.columns.str.strip()
    df.rename(columns=LEGACY_CANDIDATE_ALIASES, inplace=True)
    if "name" not in df.columns:
        raise Exception("חובה לכלול עמודת שם מועמד")
    if "job_title" not in df.columns:
        raise Exception("חובה לכלול עמודת שם משרה")
    if "email" not in df.columns:
        df["email"] = df["name"].apply(lambda x: f"{str(x).strip().replace(' ', '.')}@unknown.com")
    if "source" not in df.columns:
        df["source"] = "Organic / Unknown"
    if "start_date" not in df.columns:
        df["start_date"] = pd.Timestamp.now()
    if "department" not in df.columns:
        df["department"] = "General"
    if "status" not in df.columns:
        df["status"] = "חדש"
    if "recruiter" not in df.columns:
        df["recruiter"] = "לא שויך"
    for col in ["name", "email", "job_title", "status", "recruiter", "department", "source"]:
        df[col] = df[col].astype(str).str.strip()
    df["department"] = df["department"].replace(DEPT_NORMALIZATION)
    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    df["days_in_process"] = (pd.Timestamp.now() - df["start_date"]).dt.days.fillna(0).clip(lower=0).astype(int)
    return df


def _apply_extra_aliases(df: pd.DataFrame) -> pd.DataFrame:
    """Typed-ingest path. Renames Hebrew columns via :data:`TYPED_INGEST_ALIASES`
    and mirrors ``name`` ↔ ``candidate_name`` so legacy and typed consumers
    both find what they expect."""
    df.columns = [str(c).strip() for c in df.columns]
    rename = {}
    for col in df.columns:
        target = TYPED_INGEST_ALIASES.get(col)
        if target and target not in df.columns:
            rename[col] = target
    if rename:
        df = df.rename(columns=rename)
    # Compatibility shim: legacy uploads use "name" while the new typed handlers
    # work with "candidate_name". Expose both so either side of the divide
    # passes validation.
    if "candidate_name" in df.columns and "name" not in df.columns:
        df["name"] = df["candidate_name"]
    elif "name" in df.columns and "candidate_name" not in df.columns:
        df["candidate_name"] = df["name"]
    return df
