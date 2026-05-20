# Risk Scoring + Template Insight Spec

## Risk Scoring (Classical)

### Function
- `compute_ghosting_risk_score(days_in_process, stage_code, department)`

### Inputs
- `days_in_process` (int)
- `stage_code` (canonical status)
- `department` (string)

### Logic
- Logistic-like score from:
  - recency delay (`days_in_process`)
  - stage boost (`INTERVIEW`/`OFFER`)
  - department boost (`מכירות`/`שירות`)

### Output
- Integer probability-like score in range `1..99`.

## Template Insight Engine

### Table
- `insight_templates(template_id, template_text, condition_expr)`

### Runtime
- `render_executive_insight(conn, context)` loads templates and picks first matching condition.
- Conditions are evaluated with restricted safe context (numeric/boolean only).

### Default templates
- `high_sla`: breach-focused alert
- `strong_hiring`: positive hiring momentum
- `stable_pipeline`: baseline fallback

### Context variables
- `breach_percentage`
- `hired_this_month`
- `sla_breaches`
- `total_active`
- `top_jobs`
