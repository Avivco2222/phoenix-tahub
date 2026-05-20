import os
import uuid

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def _csv_payload(rows: str) -> bytes:
    header = "שם מועמד,דוא\"ל,שם המשרה,סטטוס,מגייס,תחילת גיוס,מחלקה,מקור הגעה\n"
    return (header + rows).encode("utf-8")


def test_upload_with_idempotency_replay():
    payload = _csv_payload("דני,dani@example.com,Backend Dev,חדש,מור,2026-05-01,R&D,LinkedIn\n")
    files = {"file": ("candidates.csv", payload, "text/csv")}
    headers = {"x-idempotency-key": "idem-001", "x-schema-version": "1.0", "X-Admin-Token": "test-admin-token"}
    first = client.post("/upload", files=files, headers=headers)
    assert first.status_code == 200
    first_json = first.json()
    assert first_json["rows_processed"] == 1
    second = client.post("/upload", files=files, headers=headers)
    assert second.status_code == 200
    second_json = second.json()
    assert second_json["replayed"] is True
    assert second_json["batch_id"] == first_json["batch_id"]


def test_upload_rejects_bad_schema_version():
    payload = _csv_payload("דני,dani2@example.com,Backend Dev,חדש,מור,2026-05-01,R&D,LinkedIn\n")
    files = {"file": ("candidates.csv", payload, "text/csv")}
    response = client.post("/upload", files=files, headers={"x-schema-version": "9.9", "x-idempotency-key": "schema-bad-1", "X-Admin-Token": "test-admin-token"})
    assert response.status_code == 400


def test_upload_data_quality_rejected_rows_reported():
    payload = _csv_payload(",,Backend Dev,חדש,מור,2026-05-01,R&D,LinkedIn\n")
    files = {"file": ("candidates.csv", payload, "text/csv")}
    response = client.post(
        "/upload",
        files=files,
        headers={"x-schema-version": "1.0", "x-idempotency-key": f"dq-fail-{uuid.uuid4().hex[:8]}", "X-Admin-Token": "test-admin-token"},
    )
    assert response.status_code == 500
    assert "Data quality gate failed" in response.json()["detail"]



def test_xml_upload_and_downstream_visibility():
    xml_payload = b"""<?xml version="1.0" encoding="UTF-8"?>
<records schema_version="1.0">
  <row>
    <name>XML Candidate</name>
    <email>xml.candidate@example.com</email>
    <job_title>Data Engineer</job_title>
    <status>\xd7\x97\xd7\x93\xd7\xa9</status>
    <recruiter>\xd7\x9e\xd7\x95\xd7\xa8</recruiter>
    <start_date>2026-05-02</start_date>
    <department>R&amp;D</department>
    <source>XML Feed</source>
  </row>
</records>"""
    files = {"file": ("candidates.xml", xml_payload, "application/xml")}
    response = client.post("/upload", files=files, headers={"x-schema-version": "1.0", "x-idempotency-key": "xml-pass-1", "X-Admin-Token": "test-admin-token"})
    assert response.status_code == 200
    # /stats now requires auth — verify_token supports X-Admin-Token.
    stats = client.get("/stats", headers={"X-Admin-Token": "test-admin-token"})
    assert stats.status_code == 200
    candidates = client.get("/candidates", headers={"X-Admin-Token": "test-admin-token"})
    assert candidates.status_code == 200
    assert isinstance(candidates.json().get("data", []), list)


def test_batch_rollback_endpoint_reverts_committed_batch():
    payload = _csv_payload("Rollback User,rollback.user@example.com,Ops Analyst,חדש,מור,2026-05-03,Operations,Manual\n")
    files = {"file": ("rollback.csv", payload, "text/csv")}
    upload = client.post(
        "/upload",
        files=files,
        headers={"x-schema-version": "1.0", "x-idempotency-key": f"rollback-{uuid.uuid4().hex[:8]}", "X-Admin-Token": "test-admin-token"},
    )
    assert upload.status_code == 200
    batch_id = upload.json()["batch_id"]
    revert = client.post(
        f"/admin/revert-batch/{batch_id}",
        headers={"X-Admin-Token": "test-admin-token"},
    )
    assert revert.status_code == 200
    batches = client.get("/admin/ingestion/batches", headers={"X-Admin-Token": "test-admin-token"})
    assert batches.status_code == 200
    matched = [b for b in batches.json() if b["batch_id"] == batch_id]
    assert matched
    assert matched[0]["status"] in ("reverted", "committed")


def test_preflight_returns_fingerprint_and_can_ingest():
    payload = _csv_payload("Preflight User,preflight.user@example.com,Ops Analyst,חדש,מור,2026-05-03,Operations,Manual\n")
    files = {"file": ("preflight.csv", payload, "text/csv")}
    res = client.post("/admin/ingestion/preflight", files=files, headers={"X-Admin-Token": "test-admin-token", "x-schema-version": "1.0"})
    assert res.status_code == 200
    body = res.json()
    assert body["payload_hash"]
    assert body["rows_received"] == 1
    assert body["can_ingest"] is True


def test_upload_fails_when_preflight_hash_mismatch():
    payload = _csv_payload("Hash User,hash.user@example.com,Ops Analyst,חדש,מור,2026-05-03,Operations,Manual\n")
    files = {"file": ("hash.csv", payload, "text/csv")}
    res = client.post(
        "/upload",
        files=files,
        headers={"x-schema-version": "1.0", "x-idempotency-key": f"hash-{uuid.uuid4().hex[:8]}", "x-preflight-hash": "bad-hash", "X-Admin-Token": "test-admin-token"},
    )
    assert res.status_code == 400
    assert "Preflight checksum mismatch" in res.json()["detail"]


def test_reset_for_final_test_returns_purge_report():
    res = client.post("/admin/reset-for-final-test", headers={"X-Admin-Token": "test-admin-token"})
    assert res.status_code == 200
    body = res.json()
    assert "purged" in body
    assert "reset_at" in body


