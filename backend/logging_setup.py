"""Logging configuration for the Phoenix Talent OS backend.

Goal: emit structured JSON in production so a log aggregator (Vercel
log drains, Datadog, Loki, CloudWatch, etc.) can index by field; keep
the human-friendly text format in dev so the tail of ``uvicorn`` is
still readable.

Selection rule: ``ENV=production`` → JSON. Anything else (dev / test /
unset) → text. This mirrors the production guard pattern used by
``/admin/reset-for-final-test``.

The JSON formatter intentionally has no third-party dependency — it's a
~20-line subclass of :class:`logging.Formatter`. Adding python-json-logger
or structlog later is straightforward once we know the platform we ship
to; today's payload shape (timestamp, level, name, message, request_id,
plus exception_info when raised) covers every aggregator's defaults.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Emit one JSON object per log record, newline-terminated.

    Vercel / Cloudflare / GCP log ingestors expect single-line JSON;
    multi-line records break their parsers. Tracebacks are folded into
    the ``exception`` field rather than emitted on separate lines.
    """

    # Standard LogRecord attributes we don't want to repeat in the JSON
    # body — keys we intentionally surface (level, name, message, etc.)
    # are added explicitly below.
    _RESERVED = {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message", "module",
        "msecs", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName",
        "taskName",  # 3.12+
    }

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Carry through anything passed via `logger.info(..., extra={...})`
        # — request_id is the main one, but adapters or middleware can
        # add app-specific fields and they'll all appear at the top
        # level of the JSON record.
        for key, value in record.__dict__.items():
            if key in self._RESERVED or key.startswith("_"):
                continue
            payload[key] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = record.stack_info

        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging() -> logging.Logger:
    """Configure root logging once at app boot.

    Returns the canonical app logger (``phoenix-api``) so callers can
    do ``logger = configure_logging()`` and start logging immediately.

    Idempotent: if handlers are already attached (e.g. because pytest
    imports the module twice via different paths), we tear them down
    first so the test suite doesn't end up with double-emit logs.
    """
    env = (os.getenv("ENV") or "").strip().lower()
    is_prod = env == "production"

    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(stream=sys.stdout)
    if is_prod:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s %(name)s req_id=%(request_id)s %(message)s",
                defaults={"request_id": "-"},  # Python 3.10+ default for the LoggerAdapter
            )
        )
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # Quiet the chattiest libraries down a notch — they emit DEBUG/INFO
    # noise that drowns out app messages without adding diagnostic value.
    for noisy in ("urllib3", "asyncio", "watchfiles"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return logging.getLogger("phoenix-api")
