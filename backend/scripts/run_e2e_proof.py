import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

import requests


BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")
ADMIN_TOKEN = os.getenv("ADMIN_API_TOKEN", "test-admin-token")


def get(path: str, headers: dict | None = None):
    resp = requests.get(f"{BASE_URL}{path}", headers=headers or {}, timeout=20)
    return resp.status_code, resp.json() if resp.content else {}


def post(path: str, headers: dict | None = None, files=None):
    resp = requests.post(f"{BASE_URL}{path}", headers=headers or {}, files=files, timeout=30)
    return resp.status_code, resp.json() if resp.content else {}


def main():
    evidence: dict = {"started_at": datetime.now(timezone.utc).isoformat()}

    reset_code, reset_body = post("/admin/reset-for-final-test", headers={"X-Admin-Token": ADMIN_TOKEN})
    evidence["reset"] = {"status_code": reset_code, "body": reset_body}

    csv_payload = (
        "שם מועמד,דוא\"ל,שם המשרה,סטטוס,מגייס,תחילת גיוס,מחלקה,מקור הגעה\n"
        "E2E User,e2e.user@example.com,Backend Engineer,חדש,מור,2026-05-08,R&D,Excel\n"
    ).encode("utf-8")
    payload_hash = hashlib.sha256(csv_payload).hexdigest()
    idem_key = f"e2e-{uuid.uuid4().hex[:8]}"
    files = {"file": ("e2e-baseline.csv", csv_payload, "text/csv")}

    preflight_code, preflight_body = post(
        "/admin/ingestion/preflight",
        headers={"X-Admin-Token": ADMIN_TOKEN, "X-Schema-Version": "1.0"},
        files=files,
    )
    evidence["preflight"] = {"status_code": preflight_code, "body": preflight_body, "local_payload_hash": payload_hash}

    upload_code, upload_body = post(
        "/upload",
        headers={
            "X-Schema-Version": "1.0",
            "X-Idempotency-Key": idem_key,
            "X-Preflight-Hash": preflight_body.get("payload_hash", ""),
        },
        files=files,
    )
    evidence["upload"] = {"status_code": upload_code, "body": upload_body}

    endpoints = ["/stats", "/jobs", "/candidates", "/intelligence"]
    evidence["api_validation"] = {}
    for ep in endpoints:
        code, body = get(ep)
        evidence["api_validation"][ep] = {"status_code": code, "body_preview": body}

    replay_code, replay_body = post(
        "/upload",
        headers={
            "X-Schema-Version": "1.0",
            "X-Idempotency-Key": idem_key,
            "X-Preflight-Hash": preflight_body.get("payload_hash", ""),
        },
        files=files,
    )
    evidence["idempotency_replay"] = {"status_code": replay_code, "body": replay_body}

    batch_id = upload_body.get("batch_id")
    rollback_code, rollback_body = post(
        f"/admin/revert-batch/{batch_id}",
        headers={"X-Admin-Token": ADMIN_TOKEN},
    )
    evidence["rollback"] = {"status_code": rollback_code, "body": rollback_body}

    batches_code, batches_body = get("/admin/ingestion/batches", headers={"X-Admin-Token": ADMIN_TOKEN})
    evidence["batch_board"] = {"status_code": batches_code, "body": batches_body}
    evidence["finished_at"] = datetime.now(timezone.utc).isoformat()

    os.makedirs("evidence", exist_ok=True)
    out_path = os.path.join("evidence", "e2e-proof-latest.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(evidence, f, ensure_ascii=False, indent=2)
    print(json.dumps({"ok": True, "evidence_path": out_path, "batch_id": batch_id}, ensure_ascii=False))


if __name__ == "__main__":
    main()
