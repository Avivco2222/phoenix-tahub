#!/usr/bin/env bash
# Phoenix Talent OS — post-deploy smoke test
# Usage: deploy/smoke.sh https://phoenix.example.com
set -euo pipefail

BASE="${1:-http://127.0.0.1:3000}"

check() {
    local path="$1"
    local label="$2"
    if curl -fsS -o /dev/null -w "%{http_code}" "$BASE$path" | grep -q "^2"; then
        echo "OK  $label  ($path)"
    else
        echo "FAIL $label ($path)"
        return 1
    fi
}

check "/healthz" "backend healthz"
check "/readyz"  "backend readyz"
check "/"        "frontend root"
check "/login"   "login page"

echo "All smoke checks passed against $BASE"
