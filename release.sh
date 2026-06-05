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

# ── Build dashboard ───────────────────────────────────────────────────────────
echo "  Building dashboard client..."
npm --prefix "$CLIENT_DIR" run build

# ── Commit ────────────────────────────────────────────────────────────────────
echo "  Staging release files..."
git -C "$SCRIPT_DIR" add \
  ".claude-plugin/plugin.json" \
  "dashboard/client/package.json" \
  "dashboard/client/dist"

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
