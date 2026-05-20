import os
import uuid
import sqlite3
from fastapi.testclient import TestClient

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

from main import app, DB_PATH, mask_value

client = TestClient(app)

def test_delete_endpoints_and_onboarding():
    # 1. Ingest some test data
    header = "שם מועמד,דוא\"ל,שם המשרה,סטטוס,מגייס,תחילת גיוס,מחלקה,מקור הגעה\n"
    row = "Crud User,crud.user@example.com,Crud Developer,חדש,מור,2026-05-01,R&D,LinkedIn\n"
    payload = (header + row).encode("utf-8")
    
    files = {"file": ("crud_test.csv", payload, "text/csv")}
    headers = {
        "x-idempotency-key": f"crud-{uuid.uuid4().hex[:8]}",
        "x-schema-version": "1.0",
        "X-Admin-Token": "test-admin-token"
    }
    
    upload_res = client.post("/upload", files=files, headers=headers)
    assert upload_res.status_code == 200
    
    # 2. Verify candidate email is masked in the database
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Masked email for 'crud.user@example.com' should match mask_value('crud.user@example.com')
    expected_masked_email = mask_value('crud.user@example.com')
    
    cand = c.execute("SELECT id, name, email, is_active FROM candidates WHERE email = ?", (expected_masked_email,)).fetchone()
    assert cand is not None
    cand_id = cand[0]
    assert cand[3] == 1  # is_active should be 1
    
    # Verify job and application
    job = c.execute("SELECT id, job_title, is_active FROM jobs WHERE job_title = ?", ("Crud Developer",)).fetchone()
    assert job is not None
    job_id = job[0]
    assert job[2] == 1
    
    app_row = c.execute("SELECT app_id, is_active FROM applications WHERE candidate_id = ? AND job_id = ?", (cand_id, job_id)).fetchone()
    assert app_row is not None
    app_id = app_row[0]
    assert app_row[1] == 1
    
    # 3. Test DELETE /api/applications/{app_id}
    del_app = client.delete(f"/api/applications/{app_id}", headers={"X-Admin-Token": "test-admin-token"})
    assert del_app.status_code == 200
    
    # Verify application is inactive
    app_status = c.execute("SELECT is_active FROM applications WHERE app_id = ?", (app_id,)).fetchone()
    assert app_status[0] == 0
    
    # Re-activate application for cascade test
    c.execute("UPDATE applications SET is_active = 1 WHERE app_id = ?", (app_id,))
    conn.commit()
    
    # 4. Test DELETE /api/jobs/{job_id}
    del_job = client.delete(f"/api/jobs/{job_id}", headers={"X-Admin-Token": "test-admin-token"})
    assert del_job.status_code == 200
    
    # Verify job and application are soft-deleted
    job_status = c.execute("SELECT is_active FROM jobs WHERE id = ?", (job_id,)).fetchone()
    assert job_status[0] == 0
    app_status = c.execute("SELECT is_active FROM applications WHERE app_id = ?", (app_id,)).fetchone()
    assert app_status[0] == 0
    
    # Re-activate for candidate cascade test
    c.execute("UPDATE jobs SET is_active = 1 WHERE id = ?", (job_id,))
    c.execute("UPDATE applications SET is_active = 1 WHERE app_id = ?", (app_id,))
    conn.commit()
    
    # 5. Test DELETE /api/candidates/{cand_id}
    del_cand = client.delete(f"/api/candidates/{cand_id}", headers={"X-Admin-Token": "test-admin-token"})
    assert del_cand.status_code == 200
    
    # Verify candidate and application are soft-deleted
    cand_status = c.execute("SELECT is_active FROM candidates WHERE id = ?", (cand_id,)).fetchone()
    assert cand_status[0] == 0
    app_status = c.execute("SELECT is_active FROM applications WHERE app_id = ?", (app_id,)).fetchone()
    assert app_status[0] == 0
    
    conn.close()

def test_selective_onboarding_update():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    ob_id = f"ob-{uuid.uuid4().hex[:8]}"
    c.execute(
        "INSERT INTO onboarding (id, name, role, department, status, base_salary) VALUES (?, ?, ?, ?, ?, ?)",
        (ob_id, "Onboard Test", "Developer", "R&D", "pending", 12000.0)
    )
    conn.commit()
    
    # Update status only
    res = client.put(
        f"/api/onboarding/{ob_id}",
        json={"status_only": True, "status": "completed"},
        headers={"X-Admin-Token": "test-admin-token"}
    )
    assert res.status_code == 200
    
    row = c.execute("SELECT status, role, base_salary FROM onboarding WHERE id = ?", (ob_id,)).fetchone()
    assert row[0] == "completed"
    assert row[1] == "Developer"  # Not overridden
    assert row[2] == 12000.0      # Not overridden
    
    # Selective update other fields
    res = client.put(
        f"/api/onboarding/{ob_id}",
        json={"role": "Senior Developer"},
        headers={"X-Admin-Token": "test-admin-token"}
    )
    assert res.status_code == 200
    
    row = c.execute("SELECT status, role, base_salary FROM onboarding WHERE id = ?", (ob_id,)).fetchone()
    assert row[0] == "completed"          # Not overridden to NULL
    assert row[1] == "Senior Developer"  # Updated!
    assert row[2] == 12000.0              # Not overridden to NULL!
    
    conn.close()
