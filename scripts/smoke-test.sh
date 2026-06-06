#!/usr/bin/env bash
# scripts/smoke-test.sh — standalone smoke test for Podium.
#
# Usage:
#   bash scripts/smoke-test.sh [--port <N>]
#
# Runs 4 checks:
#   1. dist/index.html < 300 lines and has id="root"
#   2. server.mjs uses createRequire, no http.createServer
#   3. /api/stats returns JSON with total_sessions
#   4. GET / serves the React SPA (id="root")
#
# Exits 0 if all checks pass, 1 if any fail.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PORT=14820

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--port <N>]"
      exit 1
      ;;
  esac
done

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

# ── Check 1: dist/index.html < 300 lines and has id="root" ───────────────────
DIST_INDEX="$REPO_DIR/dashboard/client/dist/index.html"
if [[ ! -f "$DIST_INDEX" ]]; then
  fail "dist/index.html not found — build may have failed"
else
  DIST_LINES=$(wc -l < "$DIST_INDEX")
  if [[ "$DIST_LINES" -gt 300 ]]; then
    fail "dist/index.html is $DIST_LINES lines — looks like the old inline HTML, not the compiled SPA"
  elif ! grep -q 'id="root"' "$DIST_INDEX"; then
    fail "dist/index.html has no <div id=\"root\"> — not a React SPA"
  else
    pass "dist/index.html is $DIST_LINES lines and contains id=\"root\""
  fi
fi

# ── Check 2: server.mjs uses createRequire, no http.createServer ──────────────
SERVER_MJS="$REPO_DIR/server.mjs"
if grep -q "http\.createServer" "$SERVER_MJS"; then
  fail "server.mjs contains http.createServer — looks like the old standalone server, not the shim"
elif ! grep -q "createRequire" "$SERVER_MJS"; then
  fail "server.mjs does not use createRequire — it may not be delegating to the Express backend"
else
  pass "server.mjs uses createRequire and has no http.createServer"
fi

# ── Check 3 & 4: start server, verify API and SPA ────────────────────────────
SMOKE_DATA="$(mktemp -d)"
SMOKE_LOG="$(mktemp)"
SMOKE_PID=""

cleanup_smoke() {
  [[ -n "$SMOKE_PID" ]] && kill "$SMOKE_PID" 2>/dev/null && wait "$SMOKE_PID" 2>/dev/null || true
  rm -rf "$SMOKE_DATA" "$SMOKE_LOG"
}
trap cleanup_smoke EXIT

DASHBOARD_PORT="$PORT" node "$REPO_DIR/server.mjs" > "$SMOKE_LOG" 2>&1 &
SMOKE_PID=$!

# Poll until the API responds (max 15 s)
API_OK=0
for i in $(seq 1 30); do
  sleep 0.5
  STATS=$(curl -s --max-time 1 "http://localhost:$PORT/api/stats" 2>/dev/null || true)
  if echo "$STATS" | grep -q '"total_sessions"'; then
    API_OK=1
    break
  fi
done

if [[ "$API_OK" -eq 0 ]]; then
  fail "/api/stats did not return JSON with total_sessions after 15 s"
  echo "  Server log:"
  cat "$SMOKE_LOG" | sed 's/^/    /'
else
  pass "/api/stats returned JSON with total_sessions"
fi

# Check 4: GET / serves React SPA
ROOT_BODY=$(curl -s --max-time 2 "http://localhost:$PORT/" 2>/dev/null || true)
if ! echo "$ROOT_BODY" | grep -q 'id="root"'; then
  fail "GET / does not serve the React SPA (id=\"root\" not found)"
else
  pass "GET / serves the React SPA"
fi

kill "$SMOKE_PID" 2>/dev/null; wait "$SMOKE_PID" 2>/dev/null || true
SMOKE_PID=""
trap - EXIT
rm -rf "$SMOKE_DATA" "$SMOKE_LOG"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
