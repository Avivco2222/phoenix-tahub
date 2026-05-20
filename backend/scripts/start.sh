#!/usr/bin/env bash
# Phoenix Talent OS — backend launcher
# Used by deploy/phoenix-backend.service (systemd) on the VM.
# workers=1 is intentional: SQLite + in-memory JWT blacklist do not tolerate more.
set -euo pipefail

cd "$(dirname "$0")/.."

exec uvicorn main:app \
    --host 127.0.0.1 \
    --port 8010 \
    --workers 1 \
    --proxy-headers
