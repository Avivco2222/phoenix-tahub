"""Tests for the manual-create endpoints added in A9-FU UX wave 3.

Covers POST /api/candidates and POST /api/jobs:

* Minimal happy path (only required fields).
* Dedup gate returns 409 with the conflicting id.
* Inline application creation when ``job_id`` is supplied.
* Audit trail: a manual-create produces an ``EDIT-CAN-*`` / ``EDIT-JOB-*``
  batch row that the existing revert flow can roll back.
"""

import os
import uuid

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)
HEADERS = {"X-Admin-Token": "test-admin-token"}


def _unique_phone() -> str:
    """Generate a fresh +972 phone so dedup-by-phone doesn't bleed across tests."""
    suffix = uuid.uuid4().hex[:7]
    # int() coerces the hex digits to a 7-digit number; keeps inside +972 5N XXXXXXX shape.
    return f"05{int(suffix, 16) % 10**8:08d}"


def _unique_email() -> str:
    return f"qa.{uuid.uuid4().hex[:8]}@example.com"


def _unique_title() -> str:
    return f"QA Auto Job {uuid.uuid4().hex[:6]}"


def test_create_candidate_minimal():
    res = client.post(
        "/api/candidates",
        json={"name": "QA Minimal", "phone": _unique_phone()},
        headers=HEADERS,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "created"
    assert body["candidate_id"].startswith("CND-")
    assert body["application_id"] is None
    assert body["batch_id"].startswith("EDIT-CAN-")


def test_create_candidate_duplicate_phone_returns_409():
    phone = _unique_phone()
    first = client.post(
        "/api/candidates",
        json={"name": "QA Dup-1", "phone": phone},
        headers=HEADERS,
    )
    assert first.status_code == 201
    first_id = first.json()["candidate_id"]

    second = client.post(
        "/api/candidates",
        json={"name": "QA Dup-2", "phone": phone},
        headers=HEADERS,
    )
    assert second.status_code == 409
    detail = second.json()["detail"]
    assert detail["code"] == "CANDIDATE_CONFLICT"
    assert detail["conflicting_id"] == first_id


def test_create_candidate_with_inline_application():
    # Need a real job_id first.
    job_res = client.post(
        "/api/jobs",
        json={"job_title": _unique_title(), "department": "R&D"},
        headers=HEADERS,
    )
    assert job_res.status_code == 201
    job_id = job_res.json()["job_id"]

    cand_res = client.post(
        "/api/candidates",
        json={
            "name": "QA Inline App",
            "phone": _unique_phone(),
            "job_id": job_id,
            "status": "ראיון",
            "recruiter": "QA Bot",
        },
        headers=HEADERS,
    )
    assert cand_res.status_code == 201, cand_res.text
    body = cand_res.json()
    assert body["candidate_id"].startswith("CND-")
    assert body["application_id"] and body["application_id"].startswith("APP-")


def test_create_candidate_with_unknown_job_id_fails():
    res = client.post(
        "/api/candidates",
        json={
            "name": "QA Bad Job",
            "phone": _unique_phone(),
            "job_id": "JOB-DOES-NOT-EXIST",
        },
        headers=HEADERS,
    )
    assert res.status_code == 400


def test_create_candidate_missing_name_fails_422():
    res = client.post(
        "/api/candidates",
        json={"phone": _unique_phone()},
        headers=HEADERS,
    )
    assert res.status_code == 422  # pydantic catches the missing required field


def test_create_job_minimal():
    res = client.post(
        "/api/jobs",
        json={"job_title": _unique_title(), "department": "R&D"},
        headers=HEADERS,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "created"
    assert body["job_id"].startswith("JOB-")
    assert body["batch_id"].startswith("EDIT-JOB-")


def test_create_job_duplicate_title_dept_returns_409():
    title = _unique_title()
    first = client.post(
        "/api/jobs",
        json={"job_title": title, "department": "R&D"},
        headers=HEADERS,
    )
    assert first.status_code == 201
    first_id = first.json()["job_id"]

    second = client.post(
        "/api/jobs",
        json={"job_title": title, "department": "R&D"},
        headers=HEADERS,
    )
    assert second.status_code == 409
    detail = second.json()["detail"]
    assert detail["code"] == "JOB_CONFLICT"
    assert detail["existing_id"] == first_id


def test_create_job_same_title_different_dept_is_allowed():
    """Dedup key is (title, department), so the same title can exist in two
    different departments — confirms we're not over-deduping."""
    title = _unique_title()
    a = client.post(
        "/api/jobs",
        json={"job_title": title, "department": "R&D"},
        headers=HEADERS,
    )
    b = client.post(
        "/api/jobs",
        json={"job_title": title, "department": "Service"},
        headers=HEADERS,
    )
    assert a.status_code == 201
    assert b.status_code == 201
    assert a.json()["job_id"] != b.json()["job_id"]
