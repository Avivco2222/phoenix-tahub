"""Ingestion plumbing — file IO, validation, normalization, batches, templates.

This package owns the helpers that turn a raw uploaded CSV/Excel/XML
into rows the per-type handlers in ``main.py`` can persist. The handlers
themselves (``_ingest_candidates`` / ``_ingest_jobs`` / ...) and the
``INGEST_HANDLERS`` dict stay in main.py for now — they are tightly
coupled to the DB and warrant a dedicated commit.

Public surface (re-exported here for convenience):

* :mod:`ingestion.files`       — upload validation, byte reading,
                                  DataFrame parsing, XML parsing,
                                  upload size limits
* :mod:`ingestion.normalize`   — column alias application + frame
                                  normalisation (legacy + typed paths)
* :mod:`ingestion.validation`  — required-column checks, schema
                                  contract loading, dedup candidate
                                  matching
* :mod:`ingestion.batches`     — ``ingestion_batches`` lifecycle
                                  (create / finalise) plus
                                  ``batch_entity_changes`` audit and
                                  rejected-rows persistence
* :mod:`ingestion.detect`      — sheet-type auto-detection (smart
                                  ingest) and the FK-safe processing
                                  order
* :mod:`ingestion.templates`   — per-file-type Excel template specs
"""

from .files import (
    MAX_UPLOAD_BYTES,
    MAX_UPLOAD_MB,
    _load_dataframe_from_upload,
    _parse_xml_to_dataframe,
    _read_file_with_limit,
    _validate_upload_file,
)
from .normalize import (
    DEPT_NORMALIZATION,
    _apply_extra_aliases,
    _normalize_upload_frame,
)
from .validation import (
    CONTRACTS_DIR,
    DEFAULT_SCHEMA_VERSION,
    INGEST_REQUIREMENTS,
    MAX_ERROR_RATE,
    SUPPORTED_SCHEMA_VERSIONS,
    _load_schema_contract,
    _validate_ingest_frame,
    _validate_schema_contract,
    find_existing_candidate,
)
from .batches import (
    _auto_scan_after_ingest,
    _create_ingest_batch,
    _finalise_ingest_batch,
    _persist_rejected_rows_for_batch,
    _record_batch_change,
)
from .detect import _FK_ORDER, _detect_sheet_type
from .templates import TEMPLATE_SPECS
from .handlers import (
    INGEST_HANDLERS,
    _ingest_attrition,
    _ingest_budget,
    _ingest_candidates,
    _ingest_diversity,
    _ingest_headcount,
    _ingest_hires,
    _ingest_jobs,
    insert_candidate,
    merge_candidate,
)


__all__ = [
    # files
    "MAX_UPLOAD_BYTES", "MAX_UPLOAD_MB",
    "_load_dataframe_from_upload", "_parse_xml_to_dataframe",
    "_read_file_with_limit", "_validate_upload_file",
    # normalize
    "DEPT_NORMALIZATION", "_apply_extra_aliases", "_normalize_upload_frame",
    # validation
    "CONTRACTS_DIR", "DEFAULT_SCHEMA_VERSION", "INGEST_REQUIREMENTS",
    "MAX_ERROR_RATE", "SUPPORTED_SCHEMA_VERSIONS",
    "_load_schema_contract", "_validate_ingest_frame",
    "_validate_schema_contract", "find_existing_candidate",
    # batches
    "_auto_scan_after_ingest", "_create_ingest_batch",
    "_finalise_ingest_batch", "_persist_rejected_rows_for_batch",
    "_record_batch_change",
    # detect
    "_FK_ORDER", "_detect_sheet_type",
    # templates
    "TEMPLATE_SPECS",
    # handlers
    "INGEST_HANDLERS",
    "_ingest_attrition", "_ingest_budget", "_ingest_candidates",
    "_ingest_diversity", "_ingest_headcount", "_ingest_hires", "_ingest_jobs",
    "insert_candidate", "merge_candidate",
]
