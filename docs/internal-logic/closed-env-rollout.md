# Closed Environment Rollout Plan

## Phase 1 (Week 1) - Foundation
- Enable internal logic tables at startup:
  - `status_lexicon`
  - `etl_rule_audit`
  - snapshots + cache + templates
- Validate `/upload` with active rules and canonical mapping.
- Success criteria:
  - ingestion still passes
  - rule audit entries created

## Phase 2 (Week 2) - Deterministic Analytics
- Turn on snapshot builds post-upload and post-revert.
- Activate endpoint caching for high-frequency filtered queries.
- Success criteria:
  - stable response times under repeated calls
  - cache invalidates on new uploads

## Phase 3 (Week 3) - Risk + Insight
- Enable classical risk scoring in intelligence endpoint.
- Replace hardcoded executive insight with template engine.
- Success criteria:
  - insight text generated from conditions, not static hardcoded branch
  - risk list contains explainable deterministic scores

## Phase 4 (Week 4) - Operationalization
- Expose capability/snapshot endpoints for monitoring:
  - `/api/internal/deterministic-capabilities`
  - `/api/internal/snapshots`
- Add runbook checks in deployment QA.
- Success criteria:
  - production-like closed environment can operate without external LLM APIs

## Metrics
- p95 latency for `/stats`, `/drilldown`
- ingestion failures per upload
- SLA breach prediction hit-rate trend
- manual override rate in admin/finops operations
