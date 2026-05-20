import os

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_endpoints():
    health = client.get("/healthz")
    ready = client.get("/readyz")
    assert health.status_code == 200
    assert ready.status_code == 200
    assert health.json()["status"] == "ok"
    assert ready.json()["status"] == "ready"


def test_unlock_rejects_wrong_password():
    response = client.post("/api/auth/unlock", json={"password": "wrong"})
    assert response.status_code == 401


def test_unlock_accepts_valid_password():
    response = client.post("/api/auth/unlock", json={"password": "246810"})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_protected_route_requires_admin_token():
    response = client.get("/api/admin/rules")
    assert response.status_code == 401

    response = client.get("/api/admin/rules", headers={"X-Admin-Token": "bad-token"})
    assert response.status_code == 401

    response = client.get("/api/admin/rules", headers={"X-Admin-Token": "test-admin-token"})
    assert response.status_code in (200, 500)


def test_revoked_tokens_persist_in_db():
    """Logout must record the revocation in the DB, not just in-memory,
    so the token stays invalid across process restarts."""
    import sqlite3
    import config as shared_config
    from main import _revoke_token_signature, _is_token_revoked, _utcnow

    sig = "test-signature-" + _utcnow().isoformat()
    exp = int(_utcnow().timestamp()) + 3600

    _revoke_token_signature(sig, exp)

    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        row = conn.execute(
            "SELECT signature, exp FROM revoked_tokens WHERE signature = ?", (sig,)
        ).fetchone()
    finally:
        conn.close()

    assert row is not None, "logout did not persist the revoked signature"
    assert row[0] == sig
    assert int(row[1]) == exp

    assert _is_token_revoked(sig, int(_utcnow().timestamp())) is True
    assert _is_token_revoked("never-revoked-sig", int(_utcnow().timestamp())) is False
