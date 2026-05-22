"""Load all demo data files into the running backend."""
import requests, json, os, sys
from pathlib import Path

BASE_URL = os.environ.get("PHOENIX_API_URL", "http://127.0.0.1:8010")
# backend/scripts/load_demo_data.py → repo root → test_data/
DATA_DIR = str(Path(__file__).resolve().parent.parent.parent / "test_data")

session = requests.Session()

# 1. Login
print("=== Logging in ===")
r = session.post(f"{BASE_URL}/api/auth/login",
                 json={"email": "admin@fnx.co.il", "password": "198722"})
if not r.ok:
    print(f"LOGIN FAILED: {r.status_code} {r.text}")
    sys.exit(1)
print(f"Logged in: {r.json()['email']} ({r.json()['role']})")

FILES = [
    ("jobs",       "02_jobs.csv"),
    ("candidates", "01_candidates.csv"),
    ("hires",      "03_hires.csv"),
    ("diversity",  "04_diversity.csv"),
    ("headcount",  "05_headcount.csv"),
    ("budget",     "06_budget.csv"),
    ("attrition",  "07_attrition.csv"),
]

results = {}
for file_type, filename in FILES:
    path = os.path.join(DATA_DIR, filename)
    print(f"\n--- Uploading {filename} as '{file_type}' ---")
    with open(path, "rb") as f:
        resp = session.post(
            f"{BASE_URL}/api/ingest/{file_type}",
            files={"file": (filename, f, "text/csv")},
        )
    if resp.ok:
        data = resp.json()
        stats = data.get("stats", {})
        print(f"  status:   {data.get('status')}")
        print(f"  batch_id: {data.get('batch_id')}")
        print(f"  received: {stats.get('received',0)}  inserted: {stats.get('inserted',0)}  "
              f"updated: {stats.get('updated',0)}  rejected: {stats.get('rejected',0)}")
        results[file_type] = {"ok": True, "stats": stats, "batch_id": data.get("batch_id")}
    else:
        print(f"  ERROR {resp.status_code}: {resp.text[:300]}")
        results[file_type] = {"ok": False, "error": resp.text[:300]}

print("\n=== Verification ===")
checks = [
    ("/api/candidates?page=1&limit=1",   "candidates"),
    ("/api/jobs?status=all",             "jobs"),
    ("/api/headcount",                   "headcount"),
    ("/api/diversity",                   "diversity"),
    ("/api/attrition",                   "attrition"),
    ("/api/admin/batches?limit=10",      "batches"),
    ("/stats",                           "dashboard stats"),
]
for endpoint, label in checks:
    r = session.get(f"{BASE_URL}{endpoint}")
    if r.ok:
        data = r.json()
        count = len(data) if isinstance(data, list) else data.get("total", data.get("total_candidates", "ok"))
        print(f"  {label}: {count}")
    else:
        print(f"  {label}: ERROR {r.status_code}")

print("\nDone.")
