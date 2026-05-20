# Rollback Runbook

## Trigger Conditions
- Production error rate above threshold for 10 consecutive minutes.
- Data corruption or failed migration.
- Authentication failures across admin routes.

## Immediate Actions (0-10 min)
1. Freeze deployments.
2. Notify incident channel and assign incident commander.
3. Capture current app logs and DB snapshot.
4. If this is pre-release validation, run `POST /admin/reset-for-final-test` to return to clean baseline before retest.

## Rollback Steps (10-30 min)
1. Redeploy previous stable frontend build.
2. Restart backend with last known-good release artifact.
3. Restore DB if needed:
   - `python backend/scripts/restore_db.py --from <backup-file>`
   - Or reset non-prod test data: `python backend/scripts/reset_for_final_test.py`
4. Prefer logical rollback by ingestion batch before full DB restore:
   - `POST /admin/revert-batch/{batch_id}` with `X-Admin-Token`
   - verify `ingestion_batches.status='reverted'`
4. Run health verification:
   - `GET /healthz`
   - `GET /readyz`
   - Admin smoke tests for protected APIs.

## Post-Rollback Validation
- Confirm authentication and protected endpoints work.
- Confirm ETL, FinOps and onboarding flows are available.
- Re-run key analytics/dashboard pages.
- Verify snapshots were rebuilt and cache invalidated after rollback.
- Compare reconciliation numbers before/after rollback from `ingestion_batches.quality_report`.
- Confirm checksum parity on next ingest cycle (`preflight payload_hash` equals upload hash).

## Post-Incident (within 24h)
- Open postmortem with timeline and root cause.
- Add prevention actions into sprint backlog.
