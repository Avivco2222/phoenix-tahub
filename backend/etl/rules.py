"""ETL rule execution + status canonicalisation.

Owns the deterministic data-cleaning passes that run during ingestion:

* Hebrew free-text → canonical ``stage_code`` mapping (HIRED, OFFER,
  INTERVIEW, SCREEN, REJECTED, ACTIVE) driven by a lexicon table.
* Admin-defined ETL rules (set/prefix/drop on column matches) with a
  per-rule audit trail.

All public helpers operate on an open :class:`sqlite3.Connection` and a
:class:`~pandas.DataFrame`. The module is import-safe (no side effects
on import).
"""

import sqlite3
from datetime import datetime, timezone
from typing import Any

import pandas as pd


DEFAULT_STATUS_LEXICON: list[tuple[str, str]] = [
    ("HIRED", "קליטה|גיוס|התקבל"),
    ("OFFER", "הצעת שכר|חוזה|ממתין לחתימה|הצעה"),
    ("INTERVIEW", "ראיון|מקצועי|מרכז הערכה|מנהל"),
    ("SCREEN", "טלפוני|ראשוני|HR|סינון"),
    ("REJECTED", "דחייה|הסרה|ויתור|הקפאה|נדחה"),
    ("ACTIVE", "חדש|בתהליך|ממתין"),
]


def seed_etl_tables(conn: sqlite3.Connection) -> None:
    """Create the status_lexicon + etl_rule_audit tables and seed defaults.

    Idempotent: re-running on an already-seeded DB is a no-op (uses
    ``INSERT OR IGNORE`` on the lexicon).
    """
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS status_lexicon (
            stage_code TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS etl_rule_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id TEXT,
            upload_log_id TEXT,
            affected_rows INTEGER,
            created_at TEXT
        )
        """
    )
    cur.executemany(
        "INSERT OR IGNORE INTO status_lexicon(stage_code, pattern) VALUES (?, ?)",
        DEFAULT_STATUS_LEXICON,
    )
    conn.commit()


def _get_status_lexicon(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    rows = conn.execute("SELECT stage_code, pattern FROM status_lexicon").fetchall()
    if not rows:
        return DEFAULT_STATUS_LEXICON
    return [(row[0], row[1]) for row in rows]


def canonicalize_statuses(df: pd.DataFrame, conn: sqlite3.Connection) -> pd.DataFrame:
    """Add a ``stage_code`` column derived from ``status`` via the lexicon."""
    if "status" not in df.columns:
        df["stage_code"] = "ACTIVE"
        return df

    lexicon = _get_status_lexicon(conn)
    stage_codes: list[str] = []
    for raw_status in df["status"].astype(str):
        selected = "ACTIVE"
        for code, pattern in lexicon:
            if pd.Series([raw_status]).str.contains(pattern, case=False, regex=True, na=False).iloc[0]:
                selected = code
                break
        stage_codes.append(selected)
    df["stage_code"] = stage_codes
    return df


def _apply_single_rule(df: pd.DataFrame, rule: dict[str, Any]) -> int:
    col_name = str(rule.get("col_name", "")).strip()
    condition = str(rule.get("condition", "")).strip()
    action = str(rule.get("action", "")).strip()
    if not col_name or col_name not in df.columns or not condition:
        return 0

    lower_condition = condition.lower()
    if "ריקה" in condition or "empty" in lower_condition:
        mask = df[col_name].isna() | (df[col_name].astype(str).str.strip() == "")
    elif "contains:" in lower_condition:
        needle = condition.split(":", 1)[1].strip()
        mask = df[col_name].astype(str).str.contains(needle, case=False, na=False)
    elif "equals:" in lower_condition:
        needle = condition.split(":", 1)[1].strip()
        mask = df[col_name].astype(str).str.lower() == needle.lower()
    else:
        mask = df[col_name].astype(str).str.contains(condition, case=False, na=False)

    affected = int(mask.sum())
    if affected == 0:
        return 0

    if action.startswith("set:"):
        target = action.split(":", 1)[1].strip()
        df.loc[mask, col_name] = target
    elif action.startswith("prefix:"):
        target = action.split(":", 1)[1].strip()
        df.loc[mask, col_name] = target + df.loc[mask, col_name].astype(str)
    elif action == "drop":
        df.drop(index=df[mask].index, inplace=True)
    return affected


def execute_etl_rules(
    df: pd.DataFrame,
    conn: sqlite3.Connection,
    upload_log_id: str,
    *,
    auto_commit: bool = True,
) -> pd.DataFrame:
    """Apply every active row in ``etl_rules`` to ``df``, recording an audit
    row for each rule that affected at least one row.
    """
    rows = conn.execute(
        "SELECT id, col_name, condition, action, active FROM etl_rules WHERE active = 1 ORDER BY id"
    ).fetchall()
    if not rows:
        return df

    for row in rows:
        rule = {
            "id": row[0],
            "col_name": row[1],
            "condition": row[2],
            "action": row[3],
            "active": row[4],
        }
        affected_rows = _apply_single_rule(df, rule)
        if affected_rows > 0:
            conn.execute(
                """
                INSERT INTO etl_rule_audit(rule_id, upload_log_id, affected_rows, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (rule["id"], upload_log_id, affected_rows, datetime.now(timezone.utc).isoformat()),
            )
    if auto_commit:
        conn.commit()
    return df
