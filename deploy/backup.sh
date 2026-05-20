#!/usr/bin/env bash
# Phoenix Talent OS — SQLite nightly backup
# Cron:  0 2 * * *  /opt/phoenix/deploy/backup.sh
# Uses sqlite3 .backup (consistent snapshot, safe while app is running).
set -euo pipefail

DB="${PHOENIX_DB:-/opt/phoenix/backend/phoenix_enterprise.db}"
DEST="${PHOENIX_BACKUP_DIR:-/var/backups/phoenix}"
RETAIN_DAYS="${PHOENIX_BACKUP_RETAIN_DAYS:-7}"

STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$DEST"

sqlite3 "$DB" ".backup '$DEST/db_$STAMP.db'"
gzip -9 "$DEST/db_$STAMP.db"

find "$DEST" -name "db_*.db.gz" -mtime +"$RETAIN_DAYS" -delete

echo "OK: $DEST/db_$STAMP.db.gz"
