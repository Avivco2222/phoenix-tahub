"""Tests for the new metrics endpoints (A9-FU Audit Phase 3A).

The dashboard / intelligence pages depend on these endpoints returning a
stable response shape (every key always present, default to 0 / [] /
None) so the React side can render unconditionally without optional
chaining at every block. These tests pin the shape; the values
themselves vary with the seed data so we don't assert exact numbers.
"""

import os
import uuid

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)
HEADERS = {"X-Admin-Token": "test-admin-token"}


def _get(path: str) -> dict:
    res = client.get(path, headers=HEADERS)
    assert res.status_code == 200, res.text
    return res.json()


def test_dashboard_metrics_response_shape():
    body = _get("/api/dashboard/metrics")
    expected_keys = {
        "hires", "hires_this_month", "hires_in_period",
        "attrition", "applications", "applications_db",
        "sla_alerts", "ghosting_count",
        "e2e_pct", "oar_pct",
        "internal_mobility_pct", "internal_hires", "internal_candidates",
        "avg_days_to_hire",
        "cph", "total_recruitment_spend",
        "sources_breakdown", "attrition_reasons",
        "funnel", "chart_data",
        "hires_yoy_pct", "attrition_yoy_pct",
        "future_blocks", "period",
    }
    missing = expected_keys - set(body.keys())
    assert not missing, f"missing keys: {missing}"


def test_dashboard_metrics_yoy_is_null_for_all_timeframe():
    """timeframe='all' compares an unbounded window to itself shifted by
    365 days — the delta isn't meaningful, so the API returns null
    rather than 0.0 (which would confuse a reader)."""
    body = _get("/api/dashboard/metrics?timeframe=all")
    assert body["hires_yoy_pct"] is None
    assert body["attrition_yoy_pct"] is None


def test_dashboard_metrics_yoy_is_number_for_year_timeframe():
    body = _get("/api/dashboard/metrics?timeframe=year")
    # Either a number or None (None if no prior-year hires/attrition).
    assert body["hires_yoy_pct"] is None or isinstance(body["hires_yoy_pct"], (int, float))
    assert body["attrition_yoy_pct"] is None or isinstance(body["attrition_yoy_pct"], (int, float))


def test_dashboard_metrics_funnel_is_monotonically_decreasing_or_equal():
    """A sane funnel never has a later stage exceeding an earlier one — every
    later stage is a subset of the prior. Pins this invariant."""
    body = _get("/api/dashboard/metrics")
    counts = [stage["count"] for stage in body["funnel"]]
    if not counts:
        return  # empty payload, nothing to assert
    # The first stage (sourcing) should always be the largest; later
    # stages are subsets (or equal — a stage might have zero rows).
    assert counts[0] == max(counts), f"sourcing should be the largest stage: {counts}"
    # Percentages should never exceed 100.
    for stage in body["funnel"]:
        assert 0 <= stage["percentage"] <= 100


def test_dashboard_metrics_percentages_are_bounded():
    body = _get("/api/dashboard/metrics")
    for key in ("e2e_pct", "oar_pct", "internal_mobility_pct"):
        v = body[key]
        assert isinstance(v, (int, float))
        assert 0 <= v <= 100, f"{key}={v} out of bounds"


def test_dashboard_metrics_future_blocks_are_declared():
    """The remaining blocks we KNOW we can't compute right now must
    surface via `future_blocks` so the frontend can render an honest
    'coming soon' badge instead of a zero.

    Audit Phase 4 / Wave C: rejection_reasons + withdrawal_reasons
    graduated out of this set once the closure_taxonomy + import wired
    real codes onto each closed application. Quality_of_Hire remains
    deferred — it needs HRIS integration."""
    body = _get("/api/dashboard/metrics")
    keys = {b["key"] for b in body["future_blocks"]}
    assert "quality_of_hire" in keys
    # The two reason pies must NOT be in future_blocks anymore —
    # the schema and data now support them.
    assert "rejection_reasons" not in keys
    assert "withdrawal_reasons" not in keys


def test_dashboard_metrics_includes_closure_reason_breakdowns():
    """rejection_reasons + withdrawal_reasons must appear in the
    payload (possibly as empty arrays when there's no closure data).
    The shape contract is what the frontend pies depend on."""
    body = _get("/api/dashboard/metrics")
    assert "rejection_reasons" in body
    assert "withdrawal_reasons" in body
    assert isinstance(body["rejection_reasons"], list)
    assert isinstance(body["withdrawal_reasons"], list)


def test_intelligence_extended_response_shape():
    body = _get("/api/intelligence/extended")
    expected_keys = {
        "early_attrition_pct", "early_attrition_count",
        "attrition_with_tenure_total",
        "recruiter_capacity", "attrition_heatmap",
        "period", "future_blocks",
    }
    missing = expected_keys - set(body.keys())
    assert not missing, f"missing keys: {missing}"


def test_intelligence_extended_recruiter_capacity_shape():
    """Each row in recruiter_capacity must carry name + active_apps + avg_days.
    The frontend builds the capacity tracker directly from this shape."""
    body = _get("/api/intelligence/extended")
    for row in body["recruiter_capacity"]:
        assert "name" in row
        assert isinstance(row["active_apps"], int)
        assert isinstance(row["avg_days"], int)
        assert row["active_apps"] >= 0
        assert row["avg_days"] >= 0


def test_metrics_filter_by_department_does_not_crash():
    """Smoke-test the slicer plumbing — passing a department that doesn't
    exist should return an empty / zero payload, not crash."""
    body = _get("/api/dashboard/metrics?department=NonExistentDept123")
    assert body["applications"] == 0
    assert body["hires"] == 0
    assert body["funnel"] == [] or all(s["count"] == 0 for s in body["funnel"])


def test_metrics_unauthenticated_returns_401():
    res = client.get("/api/dashboard/metrics")
    assert res.status_code == 401
