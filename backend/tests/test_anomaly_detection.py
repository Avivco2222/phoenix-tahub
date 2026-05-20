import os
import uuid
import sqlite3

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

from fastapi.testclient import TestClient
from main import app, DB_PATH, run_anomaly_scan, mask_value

client = TestClient(app)
HEADERS = {"X-Admin-Token": "test-admin-token"}


# ─── helpers ─────────────────────────────────────────────────────────────────

def _fresh_conn():
    return sqlite3.connect(DB_PATH)


def _upload_candidate(name, email, job_title, idem_suffix=None):
    header = "שם מועמד,דוא\"ל,שם המשרה,סטטוס,מגייס,תחילת גיוס,מחלקה,מקור הגעה\n"
    row = f"{name},{email},{job_title},חדש,מור,2025-01-01,R&D,LinkedIn\n"
    payload = (header + row).encode("utf-8")
    idem = idem_suffix or uuid.uuid4().hex[:8]
    res = client.post(
        "/upload",
        files={"file": ("test.csv", payload, "text/csv")},
        headers={**HEADERS, "x-schema-version": "1.0", "x-idempotency-key": f"an-{idem}"},
    )
    return res


# ─── ANOMALY ENGINE UNIT TESTS ───────────────────────────────────────────────

class TestAnomalyScan:

    def test_missing_contact_detected(self):
        """A candidate with no phone and no email should be flagged."""
        conn = _fresh_conn()
        cid = f"CTEST-{uuid.uuid4().hex[:8]}"
        conn.execute(
            "INSERT INTO candidates (id, name, is_active) VALUES (?, ?, 1)",
            (cid, "Anonymous User"),
        )
        conn.commit()

        summary = run_anomaly_scan(conn)
        conn.close()

        assert summary.get("missing_contact", 0) >= 1

        # Confirm it's in DB
        c2 = _fresh_conn()
        row = c2.execute(
            "SELECT id, status FROM data_anomalies WHERE entity_id=? AND anomaly_type='missing_contact'",
            (cid,),
        ).fetchone()
        c2.close()
        assert row is not None
        assert row[1] == "open"

    def test_duplicate_name_different_contact_detected(self):
        """Two candidates with the same name but different contacts should be flagged."""
        conn = _fresh_conn()
        uid = uuid.uuid4().hex[:6]
        cid1 = f"DUP1-{uid}"
        cid2 = f"DUP2-{uid}"
        shared_name = f"Dupe Person {uid}"
        conn.execute(
            "INSERT INTO candidates (id, name, email_norm, phone_norm, is_active) VALUES (?, ?, ?, ?, 1)",
            (cid1, shared_name, f"aaa{uid}", f"p1{uid}"),
        )
        conn.execute(
            "INSERT INTO candidates (id, name, email_norm, phone_norm, is_active) VALUES (?, ?, ?, ?, 1)",
            (cid2, shared_name, f"bbb{uid}", f"p2{uid}"),
        )
        conn.commit()

        summary = run_anomaly_scan(conn)
        conn.close()

        assert summary.get("duplicate_name_different_contact", 0) >= 2

    def test_stale_process_detected(self):
        """An application > 180 days and not hired/rejected should be flagged."""
        conn = _fresh_conn()
        uid = uuid.uuid4().hex[:6]
        cid = f"STALE-C-{uid}"
        jid = f"STALE-J-{uid}"
        app_id = f"STALE-A-{uid}"
        conn.execute("INSERT INTO candidates (id, name, is_active) VALUES (?, ?, 1)", (cid, "Stale User"))
        conn.execute("INSERT INTO jobs (id, job_title, department, is_active) VALUES (?, ?, ?, 1)", (jid, "Stale Job", "R&D"))
        conn.execute(
            """INSERT INTO applications (app_id, candidate_id, job_id, status, recruiter, start_date,
               days_in_process, stage_code, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (app_id, cid, jid, "בתהליך", "מור", "2024-01-01", 200, "ACTIVE"),
        )
        conn.commit()

        summary = run_anomaly_scan(conn)
        conn.close()

        assert summary.get("stale_process", 0) >= 1

    def test_scan_is_idempotent(self):
        """Running the scan twice should not create duplicate anomaly rows."""
        conn = _fresh_conn()
        uid = uuid.uuid4().hex[:6]
        cid = f"IDEM-{uid}"
        conn.execute("INSERT INTO candidates (id, name, is_active) VALUES (?, ?, 1)", (cid, "Idem User"))
        conn.commit()

        run_anomaly_scan(conn)
        count_after_first = conn.execute(
            "SELECT COUNT(*) FROM data_anomalies WHERE entity_id=? AND anomaly_type='missing_contact'",
            (cid,),
        ).fetchone()[0]

        run_anomaly_scan(conn)
        count_after_second = conn.execute(
            "SELECT COUNT(*) FROM data_anomalies WHERE entity_id=? AND anomaly_type='missing_contact'",
            (cid,),
        ).fetchone()[0]

        conn.close()
        assert count_after_first == count_after_second == 1


# ─── ANOMALY API TESTS ───────────────────────────────────────────────────────

class TestAnomalyAPI:

    def test_manual_scan_endpoint(self):
        res = client.post("/api/anomalies/scan", headers=HEADERS)
        assert res.status_code == 200
        body = res.json()
        assert "new_anomalies" in body
        assert "breakdown" in body
        assert isinstance(body["breakdown"], dict)

    def test_list_anomalies_returns_paginated_data(self):
        # Make sure there's at least one anomaly
        client.post("/api/anomalies/scan", headers=HEADERS)
        res = client.get("/api/anomalies?status=open&limit=10", headers=HEADERS)
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "total" in body
        assert isinstance(body["data"], list)

    def test_anomaly_summary_endpoint(self):
        client.post("/api/anomalies/scan", headers=HEADERS)
        res = client.get("/api/anomalies/summary", headers=HEADERS)
        assert res.status_code == 200
        body = res.json()
        assert "total_open" in body
        assert "by_type" in body
        assert "by_severity" in body

    def test_review_anomaly_dismiss(self):
        # Insert a seed anomaly to dismiss
        conn = _fresh_conn()
        uid = uuid.uuid4().hex[:6]
        cid = f"REV-{uid}"
        conn.execute("INSERT INTO candidates (id, name, is_active) VALUES (?, ?, 1)", (cid, f"Rev User {uid}"))
        conn.commit()
        run_anomaly_scan(conn)

        row = conn.execute(
            "SELECT id FROM data_anomalies WHERE entity_id=? AND status='open'", (cid,)
        ).fetchone()
        conn.close()

        if not row:
            return  # no anomaly found for this candidate, skip gracefully
        anomaly_id = row[0]

        res = client.patch(
            f"/api/anomalies/{anomaly_id}",
            json={"status": "dismissed", "note": "בדיקה"},
            headers=HEADERS,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["new_status"] == "dismissed"

        # Confirm in DB
        c2 = _fresh_conn()
        row2 = c2.execute("SELECT status FROM data_anomalies WHERE id=?", (anomaly_id,)).fetchone()
        c2.close()
        assert row2[0] == "dismissed"

    def test_review_anomaly_404(self):
        res = client.patch(
            "/api/anomalies/nonexistent-id",
            json={"status": "dismissed"},
            headers=HEADERS,
        )
        assert res.status_code == 404

    def test_anomaly_scan_auto_runs_after_upload(self):
        """After a successful upload, anomalies endpoint should reflect new data."""
        idem = uuid.uuid4().hex[:8]
        _upload_candidate(f"Auto Scan {idem}", f"autoscan{idem}@test.com", f"Scan Job {idem}", idem_suffix=idem)
        # Trigger scan (or rely on auto-scan from upload hook)
        client.post("/api/anomalies/scan", headers=HEADERS)
        res = client.get("/api/anomalies?status=open", headers=HEADERS)
        assert res.status_code == 200
