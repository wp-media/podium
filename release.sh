#!/usr/bin/env bash
# release.sh — bump version, build dashboard, commit, tag, and push.
#
# Usage:
#   ./release.sh 1.2.0

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: ./release.sh <version>  (e.g. ./release.sh 1.2.0)"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be semver (x.y.z), got '$VERSION'"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_JSON="$SCRIPT_DIR/.claude-plugin/plugin.json"
CLIENT_PKG="$SCRIPT_DIR/dashboard/client/package.json"
ROOT_PKG="$SCRIPT_DIR/package.json"
CLIENT_DIR="$SCRIPT_DIR/dashboard/client"

# ── Preconditions ─────────────────────────────────────────────────────────────
if ! git -C "$SCRIPT_DIR" diff --quiet || ! git -C "$SCRIPT_DIR" diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes — commit or stash them first."
  exit 1
fi

if git -C "$SCRIPT_DIR" tag --list | grep -qx "v$VERSION"; then
  echo "Error: tag v$VERSION already exists."
  exit 1
fi

echo "→ Releasing Podium v$VERSION"

# ── Bump versions ─────────────────────────────────────────────────────────────
echo "  Bumping .claude-plugin/plugin.json..."
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('$PLUGIN_JSON','utf8'));
  p.version = '$VERSION';
  fs.writeFileSync('$PLUGIN_JSON', JSON.stringify(p, null, 2) + '\n');
"

echo "  Bumping dashboard/client/package.json..."
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('$CLIENT_PKG','utf8'));
  p.version = '$VERSION';
  fs.writeFileSync('$CLIENT_PKG', JSON.stringify(p, null, 2) + '\n');
"

echo "  Bumping package.json..."
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('$ROOT_PKG','utf8'));
  p.version = '$VERSION';
  fs.writeFileSync('$ROOT_PKG', JSON.stringify(p, null, 2) + '\n');
"

# ── Build dashboard ───────────────────────────────────────────────────────────
echo "  Building dashboard client..."
npm --prefix "$CLIENT_DIR" run build

# ── Smoke test ───────────────────────────────────────────────────────────────
echo "  Running smoke test..."

# 1. dist/index.html must be the React SPA (< 300 lines), not the old inline blob
DIST_INDEX="$CLIENT_DIR/dist/index.html"
if [[ ! -f "$DIST_INDEX" ]]; then
  echo "Error: $DIST_INDEX not found — build may have failed."
  exit 1
fi
DIST_LINES=$(wc -l < "$DIST_INDEX")
if [[ "$DIST_LINES" -gt 300 ]]; then
  echo "Error: dist/index.html is $DIST_LINES lines — looks like the old inline HTML, not the compiled SPA."
  exit 1
fi
if ! grep -q 'id="root"' "$DIST_INDEX"; then
  echo "Error: dist/index.html has no <div id=\"root\"> — not a React SPA."
  exit 1
fi

# 2. server.mjs must be the thin shim, not a standalone HTTP server
if grep -q "http\.createServer" "$SCRIPT_DIR/server.mjs"; then
  echo "Error: server.mjs contains http.createServer — it looks like the old standalone server, not the shim."
  exit 1
fi
if ! grep -q "createRequire" "$SCRIPT_DIR/server.mjs"; then
  echo "Error: server.mjs does not use createRequire — it may not be delegating to the Express backend."
  exit 1
fi

# 3. Start the server briefly, verify the API responds correctly
SMOKE_DATA="$(mktemp -d)"
SMOKE_LOG="$(mktemp)"
SMOKE_PID=""

cleanup_smoke() {
  [[ -n "$SMOKE_PID" ]] && kill "$SMOKE_PID" 2>/dev/null && wait "$SMOKE_PID" 2>/dev/null || true
  rm -rf "$SMOKE_DATA" "$SMOKE_LOG"
}
trap cleanup_smoke EXIT

DASHBOARD_PORT=14820 node "$SCRIPT_DIR/server.mjs" > "$SMOKE_LOG" 2>&1 &
SMOKE_PID=$!

# Poll until the API responds (max 15 s)
SMOKE_OK=0
for i in $(seq 1 30); do
  sleep 0.5
  STATS=$(curl -s --max-time 1 http://localhost:14820/api/stats 2>/dev/null || true)
  if echo "$STATS" | grep -q '"total_sessions"'; then
    SMOKE_OK=1
    break
  fi
done

if [[ "$SMOKE_OK" -eq 0 ]]; then
  echo "Error: smoke test failed — /api/stats did not return expected JSON after 15 s."
  echo "Server log:"
  cat "$SMOKE_LOG"
  exit 1
fi

# Verify the root serves the React SPA, not raw JSON or the old inline HTML
ROOT_BODY=$(curl -s --max-time 2 http://localhost:14820/ 2>/dev/null || true)
if ! echo "$ROOT_BODY" | grep -q 'id="root"'; then
  echo "Error: smoke test failed — GET / does not serve the React SPA."
  exit 1
fi

kill "$SMOKE_PID" 2>/dev/null; wait "$SMOKE_PID" 2>/dev/null || true
SMOKE_PID=""
trap - EXIT
rm -rf "$SMOKE_DATA" "$SMOKE_LOG"
echo "  Smoke test passed."

# ── Commit ────────────────────────────────────────────────────────────────────
echo "  Staging release files..."
git -C "$SCRIPT_DIR" add \
  ".claude-plugin/plugin.json" \
  "dashboard/client/package.json" \
  "package.json"
git -C "$SCRIPT_DIR" add -f "dashboard/client/dist"

git -C "$SCRIPT_DIR" commit -m "chore: release v$VERSION"

# ── Tag ───────────────────────────────────────────────────────────────────────
echo "  Tagging v$VERSION..."
git -C "$SCRIPT_DIR" tag "v$VERSION"

# ── Push ──────────────────────────────────────────────────────────────────────
BRANCH="$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD)"
echo "  Pushing branch '$BRANCH' and tag v$VERSION..."
git -C "$SCRIPT_DIR" push origin "$BRANCH"
git -C "$SCRIPT_DIR" push origin "v$VERSION"

echo ""
echo "✓ Podium v$VERSION released."
echo "  → Create the GitHub Release at https://github.com/wp-media/podium/releases/new?tag=v$VERSION"
