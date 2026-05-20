# Staged Release Process

## Environments
- **Dev**: local development + feature validation.
- **Staging**: production-like validation with protected admin token.
- **Production**: live traffic.

## Promotion Flow
1. Merge to main triggers CI.
2. Deploy to staging.
3. Execute automated smoke checks:
   - `/healthz`, `/readyz`
   - protected admin endpoints with valid `X-Admin-Token`
   - `/admin/ingestion/preflight` succeeds for candidate production file
   - `/admin/ingestion/batches` returns latest committed batch
   - batch reconciliation metrics present (`rows_received`, `rows_loaded`, `rows_rejected`, `duplicate_rows`, `error_rate`)
4. Execute manual UAT for critical user journeys.
5. Approve production promotion.
6. Deploy production and monitor 30 minutes with rollback readiness.

## Required Environment Variables
- Backend:
  - `ADMIN_API_TOKEN`
  - `SESSION_UNLOCK_PIN`
- Frontend:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_ADMIN_API_TOKEN`

## Release Freeze Rules
- No schema changes after freeze without incident waiver.
- No direct DB edits in production.
- All emergency changes must include rollback instructions.
- New ingestion `schema_version` must be registered before uploading production files.
- Any ETL rule update requires a new `ingestion_rule_versions` record.
- Manual ingest SOP is mandatory: `Preflight -> Approve -> Upload -> Reconcile -> Signoff`.
