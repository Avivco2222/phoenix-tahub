# Deterministic Capability Map (No LLM)

## Backend
- `backend/main.py` `/upload`: ETL ingestion, normalization, upsert, now with internal rule execution and canonical status mapping.
- `backend/main.py` `/stats`, `/drilldown`: deterministic analytics with SQLite-backed cache invalidated by data version.
- `backend/main.py` `/executive-brief`: template-driven insight generation (condition-based) using internal metrics.
- `backend/main.py` `/intelligence`: deterministic funnel and ghosting risk scoring.
- `backend/main.py` `/api/internal/deterministic-capabilities`: capability inventory endpoint.
- `backend/main.py` `/api/internal/snapshots`: exposes latest precomputed snapshots.

## Internal Logic Layer
- `backend/internal_logic.py`:
  - ETL rule engine: `execute_etl_rules`
  - Status canonicalization: `canonicalize_statuses`
  - Precompute snapshots: `build_snapshots`
  - Query cache: `get_cached_response` / `set_cached_response`
  - Classical risk score: `compute_ghosting_risk_score`
  - Template insight engine: `render_executive_insight`

## Frontend Surfaces already compatible with deterministic mode
- `phoenix-dashboard/src/app/intelligence/page.tsx`
- `phoenix-dashboard/src/app/admin/page.tsx`
- `phoenix-dashboard/src/app/budget/page.tsx`
- `phoenix-dashboard/src/app/ai-hub/components/ReportsGenerator.tsx`

These modules consume numeric/status endpoints and can run in closed environments without external model APIs.
