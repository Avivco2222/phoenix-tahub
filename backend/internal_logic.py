"""Compatibility facade — the analytics engine lives in two packages now.

Historically every internal helper sat in this single 400-line module;
the engine has since been split for clarity:

* :mod:`etl.rules`           — status canonicalisation and ETL rule
                                execution (writes to status_lexicon,
                                etl_rule_audit).
* :mod:`analytics.snapshots` — KPI / funnel / job-health snapshots,
                                query cache, ghosting score, executive
                                insight rendering (writes to
                                kpi_snapshot, funnel_snapshot,
                                job_health_snapshot, query_cache,
                                insight_templates).

Existing callers (``main.py`` plus the routers/) keep importing the
same symbols from ``internal_logic`` — this file just re-exports them
so nothing has to change at call sites. New code should import from
the dedicated package directly.

``seed_internal_logic_tables`` is preserved as a single entry point
that seeds both halves in one call.
"""

import sqlite3

# Re-exports for backward compatibility -----------------------------------
from etl.rules import (
    DEFAULT_STATUS_LEXICON,
    canonicalize_statuses,
    execute_etl_rules,
    seed_etl_tables,
)
from analytics.snapshots import (
    CLOSED_STATUS_PATTERN,
    DEFAULT_INSIGHT_TEMPLATES,
    HIRED_STATUS_PATTERN,
    SLA_BREACH_DAYS_THRESHOLD,
    build_snapshots,
    cache_key,
    clear_query_cache,
    compute_ghosting_risk_score,
    get_cached_response,
    get_data_version,
    render_executive_insight,
    seed_analytics_tables,
    set_cached_response,
)


__all__ = [
    "CLOSED_STATUS_PATTERN",
    "DEFAULT_INSIGHT_TEMPLATES",
    "DEFAULT_STATUS_LEXICON",
    "HIRED_STATUS_PATTERN",
    "SLA_BREACH_DAYS_THRESHOLD",
    "build_snapshots",
    "cache_key",
    "canonicalize_statuses",
    "clear_query_cache",
    "compute_ghosting_risk_score",
    "execute_etl_rules",
    "get_cached_response",
    "get_data_version",
    "render_executive_insight",
    "seed_internal_logic_tables",
    "set_cached_response",
]


def seed_internal_logic_tables(conn: sqlite3.Connection) -> None:
    """Idempotent: seeds both the ETL tables and the analytics tables.

    Kept as a single entry point so main.py's ``init_db`` keeps a one-line
    call site. Internally it delegates to the two specialised seed
    helpers in their respective packages.
    """
    seed_etl_tables(conn)
    seed_analytics_tables(conn)
