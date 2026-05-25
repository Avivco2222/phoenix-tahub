"""Aggregated dashboard / intelligence metrics.

A single endpoint per consumer screen pulls every KPI that screen
needs in one round-trip, so the frontend doesn't fan out 6–10 fetches
to different routes and we can keep the cache key in one place. The
overview page (`/`) gets ``/api/dashboard/metrics``; the intelligence
page (`/intelligence`) gets ``/api/intelligence/extended``.

Design choices to be explicit about:

* **OAR (Offer Acceptance Rate)** — the DB only holds each application's
  *current* status, not a history of state transitions. Without an
  audit log of "this row used to be in 'הצעה'", we approximate the
  funnel-bottom as the union of applications currently in
  ``התקבל`` / ``הצעה`` / ``נדחה`` and divide by ``התקבל``. The number
  understates a candidate who got an offer, signed, *then* later
  re-classified to "התקבל"; it overstates when "נדחה" means
  "rejected at screening" rather than "rejected after offer". Both
  biases are documented in the user-facing tooltip.

* **Internal mobility** — driven off ``candidates.source = 'Internal'``
  (case-insensitive). Real but bounded — depends on recruiters
  populating that field.

* **CPH (Cost Per Hire)** — ``SUM(finops_invoices.amount in period) /
  COUNT(hires in period)``. Treats every invoice as a recruitment
  cost unless it's been categorised; refine via a category filter
  once we trust the category mapping.

* **Quality of Hire**, **Attrition heatmap (dept × tenure)**, and the
  **recruiter capacity** matrix are *technically* computable from the
  current schema (hires ↔ attrition_events join works for 17/17 rows
  on real data) — they are intentionally surfaced via a "future" badge
  for now because the product wants to ship them only once HRIS data
  pins down "performance score" and "team weights" properly.

All endpoints are gated by ``verify_token`` so non-authenticated
callers get 401 from a single check point, identical to the rest of
the analytics surface in this router.
"""

import sqlite3
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends

import config as shared_config
from auth import verify_token
from pipeline import get_unified_data


router = APIRouter(tags=["metrics"])


# Stage-based matchers (Audit Phase 4 / Wave C) — superseded the
# free-text regex matchers below. After the May 2026 ATS import,
# every application has a clean `stage_code` from the expanded
# UNIFIED_STAGES taxonomy, so we can match by canonical code instead
# of by Hebrew-text regex. The regex approach false-positived
# "ראיון גיוס HR" as a hire (because the status contained "גיוס"),
# inflating the headline hires KPI by 10×. Stage-code matching is
# unambiguous.
_HIRED_STAGES = {"HIRED", "AWAITING_START", "STARTED"}
_OFFER_STAGES = {"OFFER"}
_REJECTED_STAGES = {"REJECTED"}
_WITHDRAWN_STAGES = {"WITHDRAWN"}
_CLOSED_STAGES = _HIRED_STAGES | _REJECTED_STAGES | _WITHDRAWN_STAGES | {"NO_RESPONSE"}

# Legacy regex fallbacks — retained so old DBs without stage_code set
# still produce sensible (if approximate) numbers. New code should
# prefer the *_STAGES sets above.
_CLOSED_STATUSES = ['קליטה', 'גיוס', 'התקבל', 'דחייה', 'הסרה', 'ויתור', 'הקפאה', 'נדחה']
_HIRED_PATTERN = 'קליטה|גיוס|התקבל'
_OFFER_PATTERN = 'הצעה|חוזה|ממתין לחתימה'
_REJECTED_PATTERN = 'נדחה|דחייה'
_WITHDRAWN_PATTERN = 'ויתור|הסרה'


def _apply_filters(df: pd.DataFrame, timeframe: str, department: str, recruiter: str) -> pd.DataFrame:
    """Same slicer logic as `/stats` — kept consistent so the two endpoints
    agree on the cohort they're reporting on."""
    out = df.copy()
    if department != "all":
        out = out[out['department'] == department]
    if recruiter != "all":
        out = out[out['recruiter'] == recruiter]
    out['start_date'] = pd.to_datetime(out['start_date'], errors='coerce')
    if timeframe == "30days":
        out = out[out['start_date'] >= (pd.Timestamp.now() - pd.Timedelta(days=30))]
    elif timeframe == "year":
        out = out[out['start_date'].dt.year == pd.Timestamp.now().year]
    elif timeframe == "q1":
        out = out[(out['start_date'].dt.year == pd.Timestamp.now().year) & (out['start_date'].dt.quarter == 1)]
    elif timeframe == "week":
        out = out[out['start_date'] >= (pd.Timestamp.now() - pd.Timedelta(days=7))]
    return out


def _period_bounds(timeframe: str) -> tuple[str, str]:
    """Returns (start_iso, end_iso) for the timeframe to query secondary
    tables (attrition_events, finops_invoices, hires) that don't go
    through the unified-data DataFrame."""
    now = pd.Timestamp.now()
    if timeframe == "30days":
        return (now - pd.Timedelta(days=30)).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")
    if timeframe == "year":
        return f"{now.year}-01-01", f"{now.year}-12-31"
    if timeframe == "q1":
        return f"{now.year}-01-01", f"{now.year}-03-31"
    if timeframe == "week":
        return (now - pd.Timedelta(days=7)).strftime("%Y-%m-%d"), now.strftime("%Y-%m-%d")
    # "all" — effectively unbounded so future-dated demo data and
    # multi-year historical loads both get counted. Using
    # 1970/2100 instead of ±10 years keeps the SQL string-comparison
    # semantics correct (lexicographic on YYYY-MM-DD).
    return "1970-01-01", "2100-12-31"


@router.get("/api/dashboard/metrics")
def get_dashboard_metrics(
    timeframe: str = "all",
    department: str = "all",
    recruiter: str = "all",
    _: dict = Depends(verify_token),
):
    """Every KPI the home dashboard needs, in one call.

    Returns:
      * Headline counts: hires, attrition, applications, sla_alerts
      * Conversion / acceptance: e2e_pct, oar_pct, internal_mobility_pct
      * Process speed: avg_days_to_hire, ghosting_count
      * Money: cph, total_recruitment_spend
      * Distributions: candidates_by_source (LinkedIn / Referral / ...),
        attrition_reasons (top 5)
      * Funnel: counts at each stage (sourcing → screen → interview → offer → hired)
      * YoY delta: hires_yoy_pct, attrition_yoy_pct (vs same period last year)
      * Future flags: future_blocks listing what's intentionally not computed
    """
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        df_all = get_unified_data(conn)
        if df_all.empty:
            return _empty_metrics_payload()

        df = _apply_filters(df_all, timeframe, department, recruiter)
        if df.empty:
            return _empty_metrics_payload()

        # Audit Phase 4 / Wave C: prefer stage_code-based cohorts over
        # status-text regex now that every application has a clean stage
        # code from the imported ATS data. Stage codes are unambiguous;
        # the Hebrew status field still contains source-side phrasing
        # (e.g. "ראיון גיוס HR") which the legacy `קליטה|גיוס|התקבל`
        # regex would mis-classify as a hire.
        stage_series = df['stage_code'].astype(str).str.upper() if 'stage_code' in df.columns else pd.Series([], dtype=str)

        df['is_active'] = ~stage_series.isin(_CLOSED_STAGES) if len(stage_series) else \
                          ~df['status'].astype(str).str.contains('|'.join(_CLOSED_STATUSES), case=False, na=False)

        total = len(df)
        hired_df = df[stage_series.isin(_HIRED_STAGES)] if len(stage_series) else \
                   df[df['status'].astype(str).str.contains(_HIRED_PATTERN, case=False, na=False)]
        offer_df = df[stage_series.isin(_OFFER_STAGES)] if len(stage_series) else \
                   df[df['status'].astype(str).str.contains(_OFFER_PATTERN, case=False, na=False)]
        rejected_df = df[stage_series.isin(_REJECTED_STAGES)] if len(stage_series) else \
                      df[df['status'].astype(str).str.contains(_REJECTED_PATTERN, case=False, na=False)]
        withdrawn_df = df[stage_series.isin(_WITHDRAWN_STAGES)] if len(stage_series) else \
                       df[df['status'].astype(str).str.contains(_WITHDRAWN_PATTERN, case=False, na=False)]
        active_df = df[df['is_active']]

        hired_count = len(hired_df)
        offer_count = len(offer_df)
        rejected_count = len(rejected_df)

        # Current-month hires (kept for backward compat with /stats consumers).
        now = pd.Timestamp.now()
        hired_this_month = len(
            hired_df[
                (hired_df['start_date'].dt.year == now.year)
                & (hired_df['start_date'].dt.month == now.month)
            ]
        )

        # ---- Conversion / acceptance ----
        e2e_pct = round((hired_count / total) * 100, 1) if total > 0 else 0.0
        oar_denominator = hired_count + offer_count + rejected_count
        oar_pct = round((hired_count / oar_denominator) * 100, 1) if oar_denominator > 0 else 0.0

        # ---- Process speed ----
        avg_days = int(hired_df['days_in_process'].mean()) if not hired_df.empty else 0

        # SLA — adaptive threshold (mass roles vs everyone else).
        sla_alerts = int(len(
            active_df[
                (
                    (active_df['department'].astype(str).str.contains('שירות|מכירות|מוקדים', case=False, na=False))
                    & (active_df['days_in_process'] > 29)
                )
                | (
                    (~active_df['department'].astype(str).str.contains('שירות|מכירות|מוקדים', case=False, na=False))
                    & (active_df['days_in_process'] > 44)
                )
            ]
        ))

        # Real ghosting — candidates still active AND stuck > 14 days. This
        # is the "no progress" radar, distinct from SLA. We keep both KPIs
        # because they answer different operational questions.
        ghosting_count = int(len(active_df[active_df['days_in_process'] > 14]))

        # ---- Internal mobility ----
        # candidates.source = 'Internal' (case-insensitive).
        source_series = df['source'].astype(str).str.lower() if 'source' in df.columns else pd.Series(dtype=str)
        internal_candidates = int((source_series == 'internal').sum()) if len(source_series) else 0
        # Hires originating from internal source — needs the source from the candidate, not the application.
        if not hired_df.empty and 'source' in hired_df.columns:
            internal_hires = int(hired_df['source'].astype(str).str.lower().eq('internal').sum())
        else:
            internal_hires = 0
        internal_mobility_pct = round((internal_hires / hired_count) * 100, 1) if hired_count > 0 else 0.0

        # ---- Source distribution (for the StrategicSourceCards) ----
        sources_breakdown = []
        if 'source' in df.columns:
            grouped = df.groupby(df['source'].astype(str).fillna('Unknown')).size().reset_index(name='cvs')
            for _, row in grouped.iterrows():
                src = str(row['source']).strip() or "Unknown"
                src_hires = int(
                    hired_df[hired_df['source'].astype(str).str.lower() == src.lower()].shape[0]
                ) if not hired_df.empty else 0
                sources_breakdown.append({
                    "name": src, "cvs": int(row['cvs']), "hires": src_hires,
                })
            sources_breakdown.sort(key=lambda x: x['cvs'], reverse=True)

        # ---- Funnel — real counts per UNIFIED_STAGES bucket ----
        # Stage-based bucketing replaces the previous Hebrew-text regex
        # ("סינון" / "ראיון") which double-counted rows. SOURCING covers
        # both the active "applied" stage and rows that haven't yet been
        # routed; SCREEN is the CV-review step; INTERVIEW aggregates the
        # 3 specific interview codes so the funnel UI stays readable.
        if len(stage_series):
            sourcing_count = int(stage_series.eq("SOURCING").sum()) + int(stage_series.eq("ACTIVE").sum())
            screen_count = int(stage_series.eq("SCREEN").sum())
            interview_count = int(stage_series.isin({"PHONE_INTERVIEW", "HR_INTERVIEW", "MANAGER_INTERVIEW", "INTERVIEW"}).sum())
        else:
            sourcing_count = total
            screen_count = int(df['status'].astype(str).str.contains('סינון', case=False, na=False).sum())
            interview_count = int(df['status'].astype(str).str.contains('ראיון', case=False, na=False).sum())
        funnel = [
            {"stage": "קורות חיים (Sourcing)", "count": total},
            {"stage": "סינון קוח", "count": screen_count},
            {"stage": "ראיונות (טלפוני / HR / מנהל)", "count": interview_count},
            {"stage": "הצעות שכר", "count": offer_count},
            {"stage": "קליטות בארגון", "count": hired_count},
        ]
        # Percentages relative to top of funnel.
        for stage in funnel:
            stage["percentage"] = int((stage["count"] / total) * 100) if total > 0 else 0

        # ---- Chart data (monthly candidate volume) ----
        graph_df = df.copy()
        graph_df = graph_df[graph_df['start_date'].notna()]
        graph_df['month_name'] = graph_df['start_date'].dt.strftime('%b')
        graph_df['month_num'] = graph_df['start_date'].dt.month
        chart_grouped = graph_df.groupby(['month_num', 'month_name']).size().reset_index(name='candidates').sort_values('month_num')
        chart_data = [{"name": r['month_name'], "candidates": int(r['candidates'])} for _, r in chart_grouped.iterrows()]

        # ---- Money: CPH + total_spend ----
        period_start, period_end = _period_bounds(timeframe)
        try:
            spend_row = conn.execute(
                "SELECT COALESCE(SUM(amount), 0) FROM finops_invoices WHERE date >= ? AND date <= ?",
                (period_start, period_end),
            ).fetchone()
            total_spend = float(spend_row[0]) if spend_row else 0.0
        except sqlite3.OperationalError:
            total_spend = 0.0
        # Use the broader hires table for CPH so the denominator isn't limited to applications-tracked hires.
        try:
            hires_in_period_row = conn.execute(
                "SELECT COUNT(*) FROM hires WHERE hire_date >= ? AND hire_date <= ?",
                (period_start, period_end),
            ).fetchone()
            hires_in_period = int(hires_in_period_row[0]) if hires_in_period_row else 0
        except sqlite3.OperationalError:
            hires_in_period = 0
        cph = int(total_spend / hires_in_period) if hires_in_period > 0 else 0

        # ---- Attrition (real, from attrition_events) ----
        try:
            attrition_total = conn.execute(
                "SELECT COUNT(*) FROM attrition_events WHERE leave_date >= ? AND leave_date <= ?",
                (period_start, period_end),
            ).fetchone()[0]
        except sqlite3.OperationalError:
            attrition_total = 0
        try:
            reason_rows = conn.execute(
                """SELECT reason, COUNT(*) FROM attrition_events
                   WHERE leave_date >= ? AND leave_date <= ? AND reason IS NOT NULL AND reason != ''
                   GROUP BY reason ORDER BY COUNT(*) DESC LIMIT 5""",
                (period_start, period_end),
            ).fetchall()
            attrition_reasons = [{"name": r[0], "value": int(r[1])} for r in reason_rows]
        except sqlite3.OperationalError:
            attrition_reasons = []

        # ---- Rejection + withdrawal reasons (Audit Phase 4 / Wave C) ----
        # These graduated out of the "future" set once the closure
        # taxonomy and the import wired real codes onto each closed
        # application. The pies on the home dashboard now render
        # off these two arrays directly.
        try:
            rejection_reason_rows = conn.execute(
                """SELECT t.label_he, COUNT(*) FROM applications a
                   JOIN closure_taxonomy t ON t.code = a.closure_reason_code
                   WHERE a.closure_type = 'rejected'
                   GROUP BY t.label_he ORDER BY COUNT(*) DESC LIMIT 8"""
            ).fetchall()
            rejection_reasons = [{"name": r[0], "value": int(r[1])} for r in rejection_reason_rows]
        except sqlite3.OperationalError:
            rejection_reasons = []
        try:
            withdrawal_reason_rows = conn.execute(
                """SELECT t.label_he, COUNT(*) FROM applications a
                   JOIN closure_taxonomy t ON t.code = a.closure_reason_code
                   WHERE a.closure_type = 'withdrawn'
                   GROUP BY t.label_he ORDER BY COUNT(*) DESC LIMIT 8"""
            ).fetchall()
            withdrawal_reasons = [{"name": r[0], "value": int(r[1])} for r in withdrawal_reason_rows]
        except sqlite3.OperationalError:
            withdrawal_reasons = []

        # ---- YoY delta (current period vs same period last year) ----
        # Skip entirely when the current period is "all" — comparing an
        # unbounded window to itself shifted by 365d returns ~0 noise, not
        # signal, and would confuse a reader looking at the value.
        if timeframe == "all":
            hires_yoy_pct = None
            attrition_yoy_pct = None
        else:
            # Shift the period back exactly 365 days. Good enough for a quick
            # directional indicator; exact month-pairs are a later pass.
            prev_start = (pd.to_datetime(period_start) - pd.Timedelta(days=365)).strftime("%Y-%m-%d")
            prev_end = (pd.to_datetime(period_end) - pd.Timedelta(days=365)).strftime("%Y-%m-%d")
            try:
                prev_hires = conn.execute(
                    "SELECT COUNT(*) FROM hires WHERE hire_date >= ? AND hire_date <= ?",
                    (prev_start, prev_end),
                ).fetchone()[0]
            except sqlite3.OperationalError:
                prev_hires = 0
            try:
                prev_attrition = conn.execute(
                    "SELECT COUNT(*) FROM attrition_events WHERE leave_date >= ? AND leave_date <= ?",
                    (prev_start, prev_end),
                ).fetchone()[0]
            except sqlite3.OperationalError:
                prev_attrition = 0

            hires_yoy_pct = _delta_pct(hires_in_period, prev_hires)
            attrition_yoy_pct = _delta_pct(attrition_total, prev_attrition)

        return {
            # headline counts
            "hires": hired_count,
            "hires_this_month": hired_this_month,
            "hires_in_period": hires_in_period,
            "attrition": int(attrition_total),
            "applications": int(total),
            "applications_db": int(conn.execute("SELECT COUNT(*) FROM candidates WHERE COALESCE(is_active,1)=1").fetchone()[0]),
            "sla_alerts": sla_alerts,
            "ghosting_count": ghosting_count,
            # conversion / acceptance
            "e2e_pct": e2e_pct,
            "oar_pct": oar_pct,
            "internal_mobility_pct": internal_mobility_pct,
            "internal_hires": internal_hires,
            "internal_candidates": internal_candidates,
            # process speed
            "avg_days_to_hire": avg_days,
            # money
            "cph": cph,
            "total_recruitment_spend": total_spend,
            # distributions
            "sources_breakdown": sources_breakdown,
            "attrition_reasons": attrition_reasons,
            # Wave C: rejection/withdrawal reasons graduated from
            # future_blocks. Driven off applications.closure_reason_code
            # joined to closure_taxonomy.
            "rejection_reasons": rejection_reasons,
            "withdrawal_reasons": withdrawal_reasons,
            # funnel + chart
            "funnel": funnel,
            "chart_data": chart_data,
            # YoY
            "hires_yoy_pct": hires_yoy_pct,
            "attrition_yoy_pct": attrition_yoy_pct,
            # honest declaration of what we KNOW is missing right now
            "future_blocks": _future_dashboard_blocks(),
            "period": {"start": period_start, "end": period_end},
        }
    finally:
        conn.close()


@router.get("/api/intelligence/extended")
def get_intelligence_extended(
    timeframe: str = "all",
    department: str = "all",
    recruiter: str = "all",
    _: dict = Depends(verify_token),
):
    """Extra metrics for the intelligence screen that don't fit /stats:
    early attrition %, recruiter-capacity matrix (load by role-type),
    attrition heatmap (dept × tenure bucket), and a wrapped version of
    the regular dashboard metrics so the page can render off one call.

    Early attrition is computed by joining ``attrition_events`` with
    ``hires`` on candidate name (case-insensitive); the join hits 17/17
    rows on the demo data, so we treat it as reliable.
    """
    conn = sqlite3.connect(shared_config.DB_NAME)
    try:
        df = get_unified_data(conn)
        if df.empty:
            return {
                "early_attrition_pct": 0.0,
                "early_attrition_count": 0,
                "attrition_with_tenure_total": 0,
                "recruiter_capacity": [],
                "attrition_heatmap": [],
                "period": {"start": None, "end": None},
                "future_blocks": _future_intelligence(),
            }

        df = _apply_filters(df, timeframe, department, recruiter)
        period_start, period_end = _period_bounds(timeframe)

        # ---- Early attrition (< 12 months tenure) ----
        # Compute tenure in months from the SQL side so we don't have to
        # round-trip into pandas just to subtract two dates.
        try:
            attr_rows = conn.execute(
                """SELECT
                       ae.id, ae.employee_name, ae.leave_date, h.hire_date, h.department,
                       CAST(julianday(ae.leave_date) - julianday(h.hire_date) AS INTEGER) AS tenure_days
                   FROM attrition_events ae
                   LEFT JOIN hires h
                     ON LOWER(ae.employee_name) = LOWER(h.candidate_name)
                   WHERE ae.leave_date >= ? AND ae.leave_date <= ?""",
                (period_start, period_end),
            ).fetchall()
        except sqlite3.OperationalError:
            attr_rows = []

        early_count = 0
        total_attr_with_tenure = 0
        # tenure_buckets[dept] = { '0-3m': n, '3-6m': n, '6-12m': n, '1-2y': n }
        tenure_buckets: dict[str, dict[str, int]] = {}
        for row in attr_rows:
            tenure_days = row[5]
            dept = row[4] or "—"
            if tenure_days is None:
                continue
            total_attr_with_tenure += 1
            if tenure_days < 365:
                early_count += 1
            # Bucket assignment (months).
            if tenure_days < 90:
                bucket = "0-3m"
            elif tenure_days < 180:
                bucket = "3-6m"
            elif tenure_days < 365:
                bucket = "6-12m"
            elif tenure_days < 730:
                bucket = "1-2y"
            else:
                continue
            tenure_buckets.setdefault(dept, {"0-3m": 0, "3-6m": 0, "6-12m": 0, "1-2y": 0})[bucket] += 1

        early_attrition_pct = round((early_count / total_attr_with_tenure) * 100, 1) if total_attr_with_tenure > 0 else 0.0

        attrition_heatmap = [
            {"dept": dept, **buckets}
            for dept, buckets in sorted(tenure_buckets.items(), key=lambda x: x[0])
        ]

        # ---- Recruiter capacity (load count per recruiter) ----
        # Real signal: number of *active* applications a recruiter currently
        # owns. We can't separate "mass / pro / tech" without a role taxonomy,
        # so we surface the raw active-count and flag the breakdown as
        # future once role categories land in `jobs`.
        df['is_active'] = ~df['status'].astype(str).str.contains('|'.join(_CLOSED_STATUSES), case=False, na=False)
        active_df = df[df['is_active']]
        capacity_rows = []
        if not active_df.empty:
            grouped = active_df.groupby(active_df['recruiter'].fillna('לא שויך')).agg(
                active_apps=('app_id', 'count'),
                avg_days=('days_in_process', 'mean'),
            ).reset_index().sort_values('active_apps', ascending=False)
            for _, r in grouped.iterrows():
                capacity_rows.append({
                    "name": str(r['recruiter']),
                    "active_apps": int(r['active_apps']),
                    "avg_days": int(r['avg_days']) if pd.notna(r['avg_days']) else 0,
                })

        return {
            "early_attrition_pct": early_attrition_pct,
            "early_attrition_count": early_count,
            "attrition_with_tenure_total": total_attr_with_tenure,
            "recruiter_capacity": capacity_rows,
            "attrition_heatmap": attrition_heatmap,
            "period": {"start": period_start, "end": period_end},
            "future_blocks": _future_intelligence(),
        }
    finally:
        conn.close()


def _delta_pct(current: int | float, previous: int | float) -> float | None:
    """Symmetric delta with safety on zero previous. Returns None when
    the comparison isn't meaningful (no prior period data) so the UI
    can render a clean dash instead of '∞%'."""
    if previous == 0 or previous is None:
        return None
    return round(((current - previous) / previous) * 100, 1)


def _future_intelligence() -> list[dict]:
    return [
        {"key": "recruiter_role_type", "label": "סוג עומס לפי תפקיד (Mass / Pro / Tech)",
         "reason": "דורש שדה role_type ב-jobs + טאקסונומיה אחידה"},
        {"key": "heatmap_thresholds", "label": "מפת חום עם ספי השוואה",
         "reason": "מפת החום קיימת כעת כספירה גולמית; ההמרה לאחוז/השוואה לבנצ'מארק דורשת חישובי חברה היסטוריים"},
    ]


def _future_dashboard_blocks() -> list[dict]:
    """The blocks we KNOW we can't compute from the current schema —
    declared once so both the populated and empty payloads agree on
    what's intentionally deferred.

    Audit Phase 4 / Wave C: rejection_reasons + withdrawal_reasons
    graduated out of this list. The closure_taxonomy table + the
    closure_type / closure_reason_code columns + the xls importer
    together provide structured reasons end-to-end, so both pies on
    the home dashboard now render real numbers and no longer need a
    FutureBadge. Quality_of_Hire stays here — it depends on HRIS
    integration which is not yet wired up.
    """
    return [
        {"key": "quality_of_hire", "label": "איכות הגיוס",
         "reason": "דורש מקור חיצוני (HRIS) — ביצועי עובד חדש לאחר 6/12 חודשים"},
    ]


def _empty_metrics_payload() -> dict:
    """Returned when there is literally no data — keeps the response
    shape stable so the frontend doesn't have to special-case every
    field. The future_blocks list is identical to the populated payload
    so the frontend can render the 'coming soon' badges regardless of
    whether real data is present yet."""
    return {
        "hires": 0, "hires_this_month": 0, "hires_in_period": 0,
        "attrition": 0, "applications": 0, "applications_db": 0,
        "sla_alerts": 0, "ghosting_count": 0,
        "e2e_pct": 0.0, "oar_pct": 0.0,
        "internal_mobility_pct": 0.0, "internal_hires": 0, "internal_candidates": 0,
        "avg_days_to_hire": 0, "cph": 0, "total_recruitment_spend": 0.0,
        "sources_breakdown": [], "attrition_reasons": [],
        "rejection_reasons": [], "withdrawal_reasons": [],
        "funnel": [], "chart_data": [],
        "hires_yoy_pct": None, "attrition_yoy_pct": None,
        "future_blocks": _future_dashboard_blocks(),
        "period": {"start": None, "end": None},
    }
