"""In-app notification emission and the inactive-recruiter scanner.

Three layers:

* :func:`_emit_notification` — atomic insert into ``notifications``,
  respecting the recipient's per-category opt-out in
  ``user_notification_preferences``. Returns ``False`` when suppressed
  so callers can avoid double-counting. The connection is passed in;
  caller commits.
* :func:`_is_on_cooldown` / :func:`_set_cooldown` — dedup gate keyed on
  ``notification_cooldowns(user_id, tag)``. Lives separately from the
  notifications inbox so deleting a notification does NOT reset its
  cooldown — required so users can't "undo" their dedup window by
  clearing their inbox.
* :func:`_check_inactive_recruiters` — scheduled scanner: any active
  recruiter who hasn't logged in for ``threshold_days`` (default 3)
  gets a personal warning, and every admin gets a heads-up about her.
  Both notification paths share the same 24h cooldown so re-running
  the scanner doesn't spam. Designed to be invoked from the admin
  cron route in ``routers/admin.py``.

The cooldown helpers swallow ``OperationalError`` (table missing) so
first-boot failures degrade to "always emit" rather than crashing the
scanner.
"""

import logging
import sqlite3
from datetime import datetime, timedelta, timezone

import config as shared_config


logger = logging.getLogger("phoenix-api")

# Cooldown tag prefix for the inactive-recruiter notifier — kept stable
# so historical cooldown rows continue to suppress new emits across
# deploys. Changing this would re-spam everyone once.
_INACTIVE_TAG = "INACTIVE_RECRUITER_3D"


def _is_on_cooldown(conn, user_id: str, tag: str, hours: int = 24) -> bool:
    """Return True if this (user, tag) was already emitted within ``hours``.

    Uses ``notification_cooldowns`` (not the inbox) so user deletion
    does NOT reset the dedup clock. Missing-table errors fall back to
    "not on cooldown" rather than crashing the scanner.
    """
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        row = conn.execute(
            "SELECT last_emitted_at FROM notification_cooldowns WHERE user_id=? AND tag=? AND last_emitted_at > ?",
            (user_id, tag, cutoff),
        ).fetchone()
        return row is not None
    except Exception:
        return False  # table missing or other transient error → allow emit


def _set_cooldown(conn, user_id: str, tag: str) -> None:
    """Record that (user, tag) was just emitted. Upsert into cooldowns table.
    Non-fatal — if the table is missing we log and continue."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """INSERT INTO notification_cooldowns (user_id, tag, last_emitted_at) VALUES (?, ?, ?)
               ON CONFLICT(user_id, tag) DO UPDATE SET last_emitted_at = excluded.last_emitted_at""",
            (user_id, tag, now),
        )
    except Exception as exc:
        logger.warning("_set_cooldown failed (non-fatal): %s", exc)


def _emit_notification(
    conn,
    user_id: str,
    message: str,
    severity: str = "info",
    sent_by: str | None = None,
    category: str = "general",
    link: str | None = None,
    *,
    sent_at: str | None = None,
) -> bool:
    """Insert a notification row, respecting the user's category preference.

    Returns ``True`` if inserted, ``False`` if suppressed by opt-out.
    ``conn`` must already be open; caller commits.
    """
    import uuid  # local import keeps module top clean (uuid only used here)

    if not user_id:
        return False
    # Check preference: if the user explicitly opted out, skip.
    pref = conn.execute(
        "SELECT enabled FROM user_notification_preferences WHERE user_id = ? AND category = ?",
        (user_id, category),
    ).fetchone()
    if pref is not None and not pref[0]:
        return False  # user opted out
    _at = sent_at or datetime.now(timezone.utc).isoformat()
    note_id = f"NTF-{uuid.uuid4().hex[:10].upper()}"
    conn.execute(
        "INSERT INTO notifications (id, user_id, message, severity, sent_by, sent_at, category, link) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (note_id, user_id, message, severity, sent_by, _at, category, link),
    )
    return True


def _check_inactive_recruiters(threshold_days: int = 3, dedupe_hours: int = 24) -> dict:
    """Scan recruiter accounts and notify on inactivity.

    Returns ``{flagged: [...], emitted: int}``. Notifies both the
    recruiter herself and every admin, gated by a per-pair cooldown
    so re-running the scanner doesn't spam.
    """
    threshold_iso = (datetime.now(timezone.utc) - timedelta(days=threshold_days)).isoformat()
    sent_at = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(shared_config.DB_NAME)
    c = conn.cursor()
    flagged: list = []
    emitted = 0
    try:
        c.execute(
            "SELECT id, full_name, email, last_login_at FROM users "
            "WHERE role='recruiter' AND is_active=1 AND (last_login_at IS NULL OR last_login_at < ?)",
            (threshold_iso,),
        )
        recruiters = c.fetchall()

        c.execute("SELECT id FROM users WHERE role='admin' AND is_active=1")
        admin_ids = [row[0] for row in c.fetchall()]

        for rec_id, full_name, email, last_login in recruiters:
            recruiter_label = full_name or email
            # Dedup: use cooldown table (not notifications inbox) so user
            # deletion does NOT reset the 24h clock.
            cooldown_tag = f"{_INACTIVE_TAG}:{rec_id}"
            if _is_on_cooldown(conn, rec_id, cooldown_tag, hours=dedupe_hours):
                continue

            user_msg = (
                "לא נכנסת למערכת מעולם — יש להתחבר כדי להתחיל לעבוד."
                if not last_login else
                "לא נכנסת למערכת מעל 3 ימים. נוכחותך הרציפה נדרשת כדי לעמוד ב-SLA ולשמור על חוויית מועמד."
            )

            # Notify the recruiter herself
            _emit_notification(
                conn, user_id=rec_id, message=user_msg,
                severity="warning", sent_by="system:" + _INACTIVE_TAG,
                category="inactivity", link=None, sent_at=sent_at,
            )
            emitted += 1

            # Notify every admin (use admin-scoped cooldown key)
            admin_link = "/admin?group=settings&sub=permissions"
            for admin_id in admin_ids:
                admin_cooldown_tag = f"{_INACTIVE_TAG}:{rec_id}:admin:{admin_id}"
                if _is_on_cooldown(conn, admin_id, admin_cooldown_tag, hours=dedupe_hours):
                    continue
                admin_msg = (
                    f"⚠️ {recruiter_label} (מגייסת) טרם התחברה למערכת."
                    if not last_login else
                    f"⚠️ {recruiter_label} (מגייסת) לא נכנסה למערכת מעל 3 ימים. כניסה אחרונה: {last_login}."
                )
                _emit_notification(
                    conn, user_id=admin_id, message=admin_msg,
                    severity="warning", sent_by="system:" + _INACTIVE_TAG,
                    category="inactivity", link=admin_link, sent_at=sent_at,
                )
                _set_cooldown(conn, admin_id, admin_cooldown_tag)
                emitted += 1

            # Set cooldown AFTER emitting (so partial failures don't lock out next run)
            _set_cooldown(conn, rec_id, cooldown_tag)
            flagged.append({"id": rec_id, "name": recruiter_label, "last_login_at": last_login})

        conn.commit()
    finally:
        conn.close()
    return {"flagged": flagged, "emitted": emitted}
