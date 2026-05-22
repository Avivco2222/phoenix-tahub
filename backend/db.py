"""Database access helpers for the Phoenix Talent OS backend.

Thin wrappers around ``sqlite3.connect`` that:

* centralise the connection lifecycle (try/finally close)
* apply the Hebrew-safe text factory consistently
* provide the three common access patterns (read one / read many /
  write) without forcing every caller to repeat the boilerplate
* offer an explicit-transaction context manager for multi-statement
  writes that must be atomic

No ORM, no query builder. The SQL itself stays raw — these helpers
only remove the connection-management noise. Callers that still need
a raw ``sqlite3.Connection`` (long-lived loops, pandas read_sql,
manual transactions) should use the :func:`db_conn` or
:func:`db_transaction` context managers directly.

The DB path is resolved per-call from :mod:`config` so test fixtures
that switch ``PHOENIX_TEST_DB`` before importing main keep working
(see backend/conftest.py).
"""

import sqlite3
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

import config as shared_config


def _open() -> sqlite3.Connection:
    """Open a fresh SQLite connection with Hebrew-safe text decoding.

    The text factory tolerates non-UTF-8 bytes (replacing rather than
    raising), which protects the API from a single bad row crashing
    an entire SELECT response.
    """
    conn = sqlite3.connect(shared_config.DB_NAME)
    conn.text_factory = (
        lambda b: b.decode("utf-8", errors="replace") if isinstance(b, bytes) else b
    )
    return conn


# Public alias preserved for code that still grabs a raw connection
# instead of using the context-manager form. New code should prefer
# db_conn() / db_transaction().
_safe_connect = _open


@contextmanager
def db_conn() -> Iterator[sqlite3.Connection]:
    """Yield a SQLite connection; guarantee close on exit.

    Drop-in replacement for the previous helper of the same name that
    lived inline in main.py. Callers manage their own transactions
    (commit / rollback). For atomic multi-statement writes, prefer
    :func:`db_transaction`.

    Usage:
        with db_conn() as conn:
            row = conn.execute("SELECT name FROM users WHERE id = ?", (uid,)).fetchone()
    """
    conn = _open()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def db_transaction() -> Iterator[sqlite3.Connection]:
    """Yield a connection wrapped in an explicit ``BEGIN``/``COMMIT``.

    Commits on clean exit, rolls back on exception, always closes the
    connection. Use this for any write that touches more than one
    statement and must be atomic — e.g. ingestion batches, cascading
    deletes, rule audits.

    Usage:
        with db_transaction() as conn:
            conn.execute("INSERT INTO ...", (...))
            conn.execute("UPDATE ...", (...))
    """
    conn = _open()
    try:
        conn.execute("BEGIN")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_one(
    query: str, params: Sequence[Any] = ()
) -> tuple | None:
    """Run a SELECT and return its first row, or None if there are none."""
    with db_conn() as conn:
        return conn.execute(query, params).fetchone()


def fetch_all(
    query: str, params: Sequence[Any] = ()
) -> list[tuple]:
    """Run a SELECT and return every row as a list of tuples."""
    with db_conn() as conn:
        return list(conn.execute(query, params).fetchall())


def execute(
    query: str, params: Sequence[Any] = ()
) -> None:
    """Run a single write statement and commit it.

    For batched writes that must roll back together, use
    :func:`db_transaction` instead.
    """
    with db_conn() as conn:
        conn.execute(query, params)
        conn.commit()
