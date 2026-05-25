"""Schema invariants for the closure-tracking columns + taxonomy
(Audit Phase 4 / Wave A).

We don't test data values — values churn as the user edits the
taxonomy. We test STRUCTURE: that the right columns exist, the right
constraints fire, the seed completed, and the schema is idempotent
under repeat init_db calls (so a deploy that re-runs init_db doesn't
duplicate seed rows or break ALTER TABLE).
"""

import os
import sqlite3

os.environ.setdefault("ADMIN_API_TOKEN", "test-admin-token")
os.environ.setdefault("SESSION_UNLOCK_PIN", "246810")

from fastapi.testclient import TestClient

from main import app, init_db, DB_PATH


client = TestClient(app)


def _cols(table: str) -> set[str]:
    conn = sqlite3.connect(DB_PATH)
    try:
        return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    finally:
        conn.close()


def test_applications_has_closure_columns():
    cols = _cols("applications")
    expected = {"closure_type", "closure_stage", "closure_reason_code", "captured_by"}
    assert expected <= cols, f"missing: {expected - cols}"


def test_jobs_has_role_type_column():
    assert "role_type" in _cols("jobs")


def test_closure_taxonomy_table_exists_and_seeded():
    conn = sqlite3.connect(DB_PATH)
    try:
        # Table exists with the right shape
        cols = {r[1] for r in conn.execute("PRAGMA table_info(closure_taxonomy)").fetchall()}
        expected = {"code", "label_he", "closure_type", "sort_order", "is_active", "captured_by_default"}
        assert expected <= cols, f"missing taxonomy cols: {expected - cols}"

        # Seed populated both halves
        rejected = conn.execute(
            "SELECT COUNT(*) FROM closure_taxonomy WHERE closure_type='rejected'"
        ).fetchone()[0]
        withdrawn = conn.execute(
            "SELECT COUNT(*) FROM closure_taxonomy WHERE closure_type='withdrawn'"
        ).fetchone()[0]
        assert rejected >= 5, f"rejected reasons should be ≥ 5 from seed, got {rejected}"
        assert withdrawn >= 5, f"withdrawn reasons should be ≥ 5 from seed, got {withdrawn}"

        # CHECK constraint enforces the closure_type domain
        try:
            conn.execute(
                "INSERT INTO closure_taxonomy (code, label_he, closure_type, sort_order) "
                "VALUES ('BOGUS_TEST', 'test', 'invalid_value', 1)"
            )
            raise AssertionError("CHECK constraint should have rejected 'invalid_value'")
        except sqlite3.IntegrityError:
            pass  # expected — constraint fired
    finally:
        conn.close()


def test_closure_taxonomy_keeps_bot_variants_separate():
    """The user explicitly chose to keep BOT-prefixed reasons as
    distinct rows (not merged) so we can later analyse bot-vs-human
    capture rates. This test pins that decision."""
    conn = sqlite3.connect(DB_PATH)
    try:
        bot_rows = conn.execute(
            "SELECT code FROM closure_taxonomy WHERE captured_by_default='bot'"
        ).fetchall()
        assert len(bot_rows) >= 2, f"expected ≥ 2 BOT-prefixed seed rows, got {len(bot_rows)}"
        codes = {r[0] for r in bot_rows}
        # The codes start with BOT_ by convention so they're easy to filter in BI tools
        for code in codes:
            assert code.startswith("BOT_"), f"bot reason '{code}' should start with BOT_"
    finally:
        conn.close()


def test_init_db_is_idempotent_for_closure_schema():
    """Running init_db twice must not duplicate seed rows nor crash on
    the ALTER TABLE for already-existing columns. This is how deploys
    re-converge after a hotfix re-import."""
    conn = sqlite3.connect(DB_PATH)
    try:
        count_before = conn.execute("SELECT COUNT(*) FROM closure_taxonomy").fetchone()[0]
    finally:
        conn.close()

    init_db()
    init_db()  # third run for good measure

    conn = sqlite3.connect(DB_PATH)
    try:
        count_after = conn.execute("SELECT COUNT(*) FROM closure_taxonomy").fetchone()[0]
        assert count_after == count_before, (
            f"closure_taxonomy seed must be idempotent; before={count_before} after={count_after}"
        )
    finally:
        conn.close()


def test_applications_closure_columns_accept_nulls():
    """Backward compat: every existing row should be able to keep its
    closure_* columns NULL. The schema migration must not have added a
    NOT NULL constraint that would invalidate existing rows."""
    conn = sqlite3.connect(DB_PATH)
    try:
        # Inserting an application with all closure_* NULL must succeed
        conn.execute(
            "INSERT INTO applications (app_id, candidate_id, job_id, status) "
            "VALUES ('APP-SCHEMA-TEST', 'CND-SCHEMA-TEST', 'JOB-SCHEMA-TEST', 'חדש')"
        )
        conn.commit()
        row = conn.execute(
            "SELECT closure_type, closure_stage, closure_reason_code, captured_by "
            "FROM applications WHERE app_id='APP-SCHEMA-TEST'"
        ).fetchone()
        assert row == (None, None, None, None)
    finally:
        # Clean up the test row so subsequent tests aren't affected
        try:
            conn.execute("DELETE FROM applications WHERE app_id='APP-SCHEMA-TEST'")
            conn.commit()
        except Exception:
            pass
        conn.close()
