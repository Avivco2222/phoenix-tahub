# Excel Upload Template v1

## Required worksheet
- Sheet name: `DATA`
- First row must be headers only.
- No merged cells, no formulas in input columns.

## Canonical columns (required)
1. `name`
2. `email`
3. `job_title`
4. `status`
5. `recruiter`
6. `start_date` (`YYYY-MM-DD`)
7. `department`
8. `source`

## Recommended validations
- `email`: must include `@`.
- `start_date`: date format only.
- `status`: controlled list per recruiting process policy.
- Duplicate check before upload: `email + job_title`.

## Versioning
- Upload header `X-Schema-Version: 1.0`.
- Any future schema update must be registered in `ingestion_schema_versions`.
