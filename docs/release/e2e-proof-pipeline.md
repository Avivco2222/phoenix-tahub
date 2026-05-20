# E2E Proof Pipeline

1. Run clean reset:
   - `POST /admin/reset-for-final-test` with `X-Admin-Token`
2. Run preflight:
   - `POST /admin/ingestion/preflight` with the target file.
   - Verify `can_ingest=true`, `payload_hash`, and reconciliation indicators.
3. Approve and upload:
   - `POST /upload` with `X-Schema-Version`, `X-Idempotency-Key`, `X-Preflight-Hash`.
4. Validate downstream API:
   - `GET /stats`
   - `GET /jobs`
   - `GET /candidates`
   - `GET /intelligence`
5. Validate idempotency:
   - Replay same payload with same key/hash and verify `replayed=true` and unchanged state.
6. Validate rollback:
   - `POST /admin/revert-batch/{batch_id}`
   - Confirm batch status updates to `reverted` and KPIs return to pre-upload baseline.
7. Attach evidence:
   - preflight response JSON
   - upload response JSON
   - batch board snapshot
   - post-rollback validation snapshots
