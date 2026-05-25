"""Closure-reason enforcement on PATCH /api/candidates/{key}/stage
(Audit Phase 4 / Wave D).

A recruiter who moves a candidate to REJECTED or WITHDRAWN must pick
a closure_reason_code from the taxonomy. Anything else (missing
reason / wrong type / inactive code / unknown code) is rejected at
the server. The frontend's dropdown is a UX aid; this is the
contract.
"""

import os
import sqlite3
import uuid

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

import pytest
from fastapi.testclient import TestClient

from main import app, DB_PATH


client = TestClient(app)
HEADERS = {"X-Admin-Token": "test-admin-token"}


@pytest.fixture()
def seeded_application():
    """Insert one candidate + one job + one application; yield the
    candidate's id so tests can target it. Cleanup runs after the test
    regardless of pass/fail."""
    cid = f"CND-T-{uuid.uuid4().hex[:8].upper()}"
    jid = f"JOB-T-{uuid.uuid4().hex[:8].upper()}"
    aid = f"APP-T-{uuid.uuid4().hex[:8].upper()}"
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("INSERT INTO candidates (id, name) VALUES (?, ?)", (cid, "Test Closure User"))
        conn.execute(
            "INSERT INTO jobs (id, job_title, department) VALUES (?, ?, ?)",
            (jid, f"QA Closure Job {uuid.uuid4().hex[:6]}", "QA"),
        )
        conn.execute(
            "INSERT INTO applications (app_id, candidate_id, job_id, status, stage_code) "
            "VALUES (?, ?, ?, ?, ?)",
            (aid, cid, jid, "פעיל", "ACTIVE"),
        )
        conn.commit()
    finally:
        conn.close()
    yield {"candidate_id": cid, "app_id": aid, "job_id": jid}
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("DELETE FROM applications WHERE app_id = ?", (aid,))
        conn.execute("DELETE FROM jobs WHERE id = ?", (jid,))
        conn.execute("DELETE FROM candidates WHERE id = ?", (cid,))
        conn.commit()
    finally:
        conn.close()


def _patch(cid: str, body: dict) -> tuple[int, dict]:
    res = client.patch(f"/api/candidates/{cid}/stage", json=body, headers=HEADERS)
    try:
        return res.status_code, res.json()
    except Exception:
        return res.status_code, {}


# ────────────────────────────────────────────────────────────────────
# Taxonomy endpoint
# ────────────────────────────────────────────────────────────────────


def test_taxonomy_endpoint_returns_seeded_reasons():
    res = client.get("/api/taxonomy/closure-reasons", headers=HEADERS)
    assert res.status_code == 200, res.text
    items = res.json()
    assert len(items) >= 10
    codes = {r["code"] for r in items}
    # Both halves of the taxonomy must be present
    assert "UQ" in codes              # rejected
    assert "SALARY_EXPECTATIONS" in codes  # withdrawn


def test_taxonomy_endpoint_filters_by_closure_type():
    res = client.get("/api/taxonomy/closure-reasons?closure_type=rejected", headers=HEADERS)
    assert res.status_code == 200
    items = res.json()
    assert all(r["closure_type"] == "rejected" for r in items)
    assert "UQ" in {r["code"] for r in items}
    assert "SALARY_EXPECTATIONS" not in {r["code"] for r in items}


def test_taxonomy_endpoint_requires_auth():
    res = client.get("/api/taxonomy/closure-reasons")
    assert res.status_code == 401


# ────────────────────────────────────────────────────────────────────
# Closure enforcement
# ────────────────────────────────────────────────────────────────────


def test_non_closure_stage_change_does_not_require_reason(seeded_application):
    """Moving to INTERVIEW / OFFER / etc. must not demand a closure reason."""
    status, body = _patch(seeded_application["candidate_id"], {"stage_code": "PHONE_INTERVIEW"})
    assert status == 200, body


def test_reject_without_reason_returns_400(seeded_application):
    status, body = _patch(seeded_application["candidate_id"], {"stage_code": "REJECTED"})
    assert status == 400
    assert body["detail"]["code"] == "CLOSURE_REASON_REQUIRED"


def test_withdraw_without_reason_returns_400(seeded_application):
    status, body = _patch(seeded_application["candidate_id"], {"stage_code": "WITHDRAWN"})
    assert status == 400
    assert body["detail"]["code"] == "CLOSURE_REASON_REQUIRED"


def test_reject_with_valid_reason_succeeds_and_persists(seeded_application):
    status, body = _patch(
        seeded_application["candidate_id"],
        {"stage_code": "REJECTED", "closure_reason_code": "UQ"},
    )
    assert status == 200, body
    # Verify the closure columns landed in the DB
    conn = sqlite3.connect(DB_PATH)
    try:
        row = conn.execute(
            "SELECT closure_type, closure_reason_code, captured_by FROM applications WHERE app_id = ?",
            (seeded_application["app_id"],),
        ).fetchone()
    finally:
        conn.close()
    assert row[0] == "rejected"
    assert row[1] == "UQ"
    # captured_by defaulted from taxonomy (UQ has no captured_by_default → recruiter)
    assert row[2] == "recruiter"


def test_withdraw_with_bot_reason_sets_captured_by_bot(seeded_application):
    status, body = _patch(
        seeded_application["candidate_id"],
        {"stage_code": "WITHDRAWN", "closure_reason_code": "BOT_JOB_LOCATION"},
    )
    assert status == 200, body
    conn = sqlite3.connect(DB_PATH)
    try:
        row = conn.execute(
            "SELECT closure_type, captured_by FROM applications WHERE app_id = ?",
            (seeded_application["app_id"],),
        ).fetchone()
    finally:
        conn.close()
    assert row[0] == "withdrawn"
    # The taxonomy entry for BOT_* has captured_by_default='bot' so the
    # server should auto-fill that even when the client omits the field.
    assert row[1] == "bot"


def test_reject_with_unknown_reason_code_returns_400(seeded_application):
    status, body = _patch(
        seeded_application["candidate_id"],
        {"stage_code": "REJECTED", "closure_reason_code": "DOES_NOT_EXIST"},
    )
    assert status == 400
    assert body["detail"]["code"] == "CLOSURE_REASON_NOT_FOUND"


def test_reject_with_withdrawn_reason_returns_400(seeded_application):
    """Closure_type must match the stage. SALARY_EXPECTATIONS is a
    withdrawn-side reason; pairing it with stage_code=REJECTED is
    nonsensical and must be rejected so the pies don't silently get
    cross-contaminated."""
    status, body = _patch(
        seeded_application["candidate_id"],
        {"stage_code": "REJECTED", "closure_reason_code": "SALARY_EXPECTATIONS"},
    )
    assert status == 400
    assert body["detail"]["code"] == "CLOSURE_REASON_TYPE_MISMATCH"


def test_un_reject_clears_closure_columns(seeded_application):
    """Moving an application back to a non-terminal stage (e.g. admin
    un-archives) must clear closure_type / closure_reason_code so the
    row stops counting as a closure in the pies."""
    # First close it
    _patch(seeded_application["candidate_id"],
           {"stage_code": "REJECTED", "closure_reason_code": "UQ"})
    # Then un-close
    status, body = _patch(seeded_application["candidate_id"], {"stage_code": "PHONE_INTERVIEW"})
    assert status == 200, body
    conn = sqlite3.connect(DB_PATH)
    try:
        row = conn.execute(
            "SELECT closure_type, closure_reason_code, captured_by FROM applications WHERE app_id = ?",
            (seeded_application["app_id"],),
        ).fetchone()
    finally:
        conn.close()
    assert row == (None, None, None)
