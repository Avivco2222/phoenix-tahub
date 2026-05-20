import sqlite3
from datetime import datetime, timezone

DB_PATH = "phoenix_enterprise.db"


def run_reset() -> dict:
    purge_tables = [
        "applications",
        "candidates",
        "jobs",
        "data_logs",
        "ingestion_batches",
        "rejected_rows",
        "batch_entity_changes",
        "batch_snapshots_state",
        "stg_applications",
        "etl_rule_audit",
        "kpi_snapshot",
        "funnel_snapshot",
        "job_health_snapshot",
        "query_cache",
    ]
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    report = {"purged": {}, "reset_at": datetime.now(timezone.utc).isoformat()}
    try:
        c.execute("BEGIN")
        for table in purge_tables:
            try:
                count = c.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                c.execute(f"DELETE FROM {table}")
                report["purged"][table] = int(count)
            except sqlite3.OperationalError:
                report["purged"][table] = 0
        conn.commit()
        return report
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    result = run_reset()
    print(result)
