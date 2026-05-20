# Go-Live Checklist

## Security
- [ ] `ADMIN_API_TOKEN` configured in production secret manager.
- [ ] `SESSION_UNLOCK_PIN` configured in production secret manager.
- [ ] `NEXT_PUBLIC_ADMIN_API_TOKEN` set only in trusted admin deployment context.
- [ ] No hardcoded secrets in tracked files (`rg "222222|password\\s*=|token\\s*="` reviewed).

## Quality Gates
- [ ] Frontend CI green: lint + typecheck + tests + build.
- [ ] Backend CI green: pytest passes.
- [ ] Manual smoke test completed for admin, budget, security and onboarding flows.

## Data Safety
- [ ] Full clean reset executed: `POST /admin/reset-for-final-test` (or `python backend/scripts/reset_for_final_test.py`).
- [ ] Reset report attached to release evidence (rows deleted per table + timestamp).
- [ ] `python backend/scripts/migrate.py` executed successfully.
- [ ] Backup created via `python backend/scripts/backup_db.py`.
- [ ] Restore drill validated with `python backend/scripts/restore_db.py --from <backup-file>`.
- [ ] Preflight pass recorded for each file (`POST /admin/ingestion/preflight`) before upload approval.
- [ ] Excel/XML files validated against approved `schema_version`.
- [ ] Upload replay test passed with same `X-Idempotency-Key` and payload hash (no duplicated side effects).
- [ ] Upload checksum parity validated (`X-Preflight-Hash` == payload hash during ingest).
- [ ] Batch quality report reviewed (`rows_received`, `rows_loaded`, `rows_rejected`, `duplicate_rows`).
- [ ] At least one controlled rollback tested via `POST /admin/revert-batch/{batch_id}`.
- [ ] UI parity check passed: `page`, `jobs`, `candidates`, `headcount`, `intelligence` show live data or explicit operational error.

## Operations
- [ ] Health checks validated: `/healthz` and `/readyz`.
- [ ] Request tracing verified via `X-Request-Id` response header.
- [ ] Alerting destination validated for failed API responses.

## Release Governance
- [ ] UAT sign-off documented.
- [ ] Rollback owner and timeline confirmed.
- [ ] Rollback runbook linked in release ticket.
