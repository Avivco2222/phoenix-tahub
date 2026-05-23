"""File-level ingestion helpers — validation, byte reading, DataFrame parsing.

Every upload route routes through these four helpers before any
business logic runs:

1. :func:`_validate_upload_file` checks the filename extension and MIME
   prefix against a per-route allowlist (CSV / Excel / XML / PDF / …).
2. :func:`_read_file_with_limit` streams the body in 1 MiB chunks and
   enforces ``MAX_UPLOAD_BYTES`` — a 413 is raised the moment the
   limit is crossed, so a 5 GB upload doesn't actually buffer 5 GB.
3. :func:`_load_dataframe_from_upload` dispatches on the file extension
   to the right pandas reader (or the in-house XML parser).
4. :func:`_parse_xml_to_dataframe` is the XML-specific reader; it also
   enforces a schema-version match against
   :data:`ingestion.validation.SUPPORTED_SCHEMA_VERSIONS`.
"""

import io
import os
import xml.etree.ElementTree as ET

import pandas as pd
from fastapi import HTTPException, UploadFile


MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES: int = MAX_UPLOAD_MB * 1024 * 1024


async def _read_file_with_limit(file: UploadFile) -> bytes:
    """Stream-read an upload, raising HTTP 413 once ``MAX_UPLOAD_BYTES``
    is exceeded. Rewinds the file at the end so caller code can re-read.
    """
    chunks: list[bytes] = []
    total_size = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size is {MAX_UPLOAD_MB}MB",
            )
        chunks.append(chunk)
    await file.seek(0)
    return b"".join(chunks)


def _validate_upload_file(
    file: UploadFile,
    *,
    allowed_extensions: set[str],
    allowed_mime_prefixes: tuple[str, ...],
) -> None:
    """Reject uploads with the wrong extension or content type before
    we spend any time on parsing."""
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    ext = os.path.splitext(filename.lower())[1]
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")
    content_type = (file.content_type or "").lower()
    if not any(content_type.startswith(prefix) for prefix in allowed_mime_prefixes):
        raise HTTPException(status_code=400, detail=f"Unsupported MIME type: {content_type}")


def _parse_xml_to_dataframe(content: bytes) -> pd.DataFrame:
    """Parse the in-house ``<records><row>…</row></records>`` XML format."""
    from .validation import SUPPORTED_SCHEMA_VERSIONS  # avoid circular import at module load

    root = ET.fromstring(content)
    xml_schema_version = root.attrib.get("schema_version")
    if xml_schema_version and xml_schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        raise Exception(f"Unsupported XML schema_version: {xml_schema_version}")
    if root.tag != "records":
        raise Exception("XML root tag must be <records>")
    rows: list[dict] = []
    required_xml_tags = {"name", "email", "job_title", "status", "recruiter", "start_date", "department", "source"}
    for row_node in root.findall(".//row"):
        row_data = {}
        for child in list(row_node):
            row_data[child.tag] = child.text
        if row_data:
            missing = [tag for tag in required_xml_tags if tag not in row_data]
            if missing:
                raise Exception(f"XML row missing required tags: {','.join(missing)}")
            rows.append(row_data)
    if not rows:
        raise Exception("XML does not include <row> elements")
    return pd.DataFrame(rows)


def _load_dataframe_from_upload(filename: str, content: bytes) -> pd.DataFrame:
    """Dispatch on the extension to pandas / XML reader. Falls through
    encodings (UTF-8 → ISO-8859-8) before giving up — old Israeli ATS
    exports occasionally still ship Hebrew-encoded CSV.
    """
    lower_name = (filename or "").lower()
    buf = io.BytesIO(content)
    if lower_name.endswith(".xml"):
        return _parse_xml_to_dataframe(content)
    if lower_name.endswith(".xlsx") or lower_name.endswith(".xls"):
        return pd.read_excel(buf)
    try:
        return pd.read_csv(io.BytesIO(content))
    except Exception:
        try:
            return pd.read_csv(io.BytesIO(content), encoding="iso-8859-8")
        except Exception:
            return pd.read_excel(io.BytesIO(content))
