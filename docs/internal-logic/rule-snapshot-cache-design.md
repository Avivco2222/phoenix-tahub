# Rule + Snapshot + Cache Design

## Rule Engine

### Source of truth
- Table: `etl_rules`
- Audit table: `etl_rule_audit`

### Runtime
1. `/upload` loads dataframe.
2. `execute_etl_rules(df, conn, upload_log_id)` applies active rules by priority.
3. Each rule records affected rows in `etl_rule_audit`.
4. Canonical status mapping runs after rule execution.

### Supported condition/action patterns
- Condition: `empty`, `contains:<value>`, `equals:<value>`, generic contains.
- Action: `set:<value>`, `prefix:<value>`, `drop`.

## Snapshot Layer

### Tables
- `kpi_snapshot`
- `funnel_snapshot`
- `job_health_snapshot`

### Build trigger
- After successful `/upload`
- After `/admin/revert/{log_id}`

### Semantics
- Snapshot tables are fully refreshed from normalized operational data.
- `data_version` is derived from `data_logs` max upload timestamp + count.

## Query Cache

### Table
- `query_cache(cache_key, payload, data_version, created_at)`

### Key derivation
- SHA256 of `{endpoint, params}` normalized JSON.

### Invalidation
- Automatic miss when `data_version` changes.
- Full clear on upload/revert.

### Current cached endpoints
- `/stats`
- `/drilldown`
