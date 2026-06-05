---
name: podium
description: "Manage the Podium agent observer — real-time dashboard for Claude Code agents. Subcommands: setup · start · stop · restart · status · logs · uninstall. Bare `/podium` shows the subcommand reference (alias for /podium help)."
---

## How Podium works

Podium captures every Claude Code event through native hooks, stores them in
SQLite, and streams updates to the browser via WebSocket. Zero extra LLM calls.

## Resolve the Podium plugin root

This skill lives at `{podium_plugin_root}/commands/podium.md`. Resolve the
plugin root by finding `hook.mjs` in the Claude Code plugins cache:

```bash
find ~/.claude/plugins/cache/wp-media/podium -name "hook.mjs" 2>/dev/null | sort -V | tail -1
```

Strip `/hook.mjs` from the result — that prefix is `{podium_plugin_root}`.

Derived paths (hold these for every subcommand):

| Variable | Path |
|---|---|
| `PLUGIN_ROOT` | resolved above |
| `INSTALL_SCRIPT` | `{PLUGIN_ROOT}/install.mjs` |
| `HOOK_SCRIPT` | `{PLUGIN_ROOT}/hook.mjs` |
| `SERVER_SCRIPT` | `{PLUGIN_ROOT}/server.mjs` |
| `DASHBOARD_ROOT` | `{PLUGIN_ROOT}/dashboard` |
| `PORT` | detected below |
| `LOG_FILE` | `{PLUGIN_ROOT}/.podium/server.log` (fallback: `/tmp/podium/server.log`) |

Detect the port the server will actually bind to (avoids stale-cache mismatches):

```bash
PORT=$(node -e "const t=require('fs').readFileSync('{SERVER_SCRIPT}','utf8');const m=t.match(/port:\s*(\d+)/);process.stdout.write(m?.[1]??'4820')" 2>/dev/null || echo "4820")
```

If `PORT` is not `4820`, warn: "Cached server.mjs uses port `{PORT}` (expected 4820). The plugin cache may be stale — consider reinstalling."

---

## `/podium setup`

First-time wiring of Claude Code hooks. Run once per project (or globally).

**a. Register hooks**

```bash
node {INSTALL_SCRIPT}
```

Registers `hook.mjs` in `.claude/settings.json` for all Claude Code hook events.

**b. Optional: install globally** (all projects on this machine)

```bash
node {INSTALL_SCRIPT} --global
```

**c. Confirm**

```
Podium hooks registered in .claude/settings.json
  -> Restart Claude Code to activate, then run /podium start
```

---

## `/podium start`

Start the dashboard server (hooks must be set up first).

**a. Warn if hooks are missing**

```bash
node {INSTALL_SCRIPT} --check
```

Exit code 1 → hooks not installed. Warn: "Hooks not set up. Run `/podium setup`
first, then restart Claude Code." — but continue anyway.

**b. Check if already running**

```bash
curl -s --max-time 2 http://localhost:{PORT}/health
```

HTTP 200 → already up, skip to step e.

**c. First-time setup (if node_modules missing)**

```bash
ls {DASHBOARD_ROOT}/node_modules/.bin 2>/dev/null && echo "ok" || echo "missing"
```

If missing:

```bash
cd {DASHBOARD_ROOT} && npm install 2>&1 | tail -5
```

Takes 1–2 minutes on first run. The `dist/` directory is pre-built — no build
step needed.

**d. Start server in background**

```bash
mkdir -p "$(dirname {LOG_FILE})" && node {SERVER_SCRIPT} >> {LOG_FILE} 2>&1 &
```

Wait 2 s, then verify:

```bash
curl -s --max-time 2 http://localhost:{PORT}/health
```

If still unreachable:

```bash
tail -20 {LOG_FILE}
```

Report: "Podium failed to start. See log above." and stop. **Do not check other ports** — an unrelated process on a different port is not Podium.

**e. Show current stats**

```bash
curl -s http://localhost:{PORT}/api/stats
```

**f. Print URL**

```
Podium running -> http://localhost:{PORT}
```

---

## `/podium stop`

```bash
lsof -ti:{PORT} 2>/dev/null || fuser {PORT}/tcp 2>/dev/null
```

No output → "Podium is not running."

Otherwise:

```bash
kill $(lsof -ti:{PORT} 2>/dev/null) 2>/dev/null || fuser -k {PORT}/tcp 2>/dev/null || true
```

Confirm: "Podium stopped."

---

## `/podium restart`

Run `/podium stop`, wait 1 s, then run `/podium start`.

---

## `/podium status`

```bash
curl -s --max-time 2 http://localhost:{PORT}/health
```

**If not running:** "Podium is not running. Run `/podium start` to launch it."

**If running,** also fetch:

```bash
curl -s http://localhost:{PORT}/api/stats
```

Display:

```
Podium status
  Server  http://localhost:{PORT}  uptime Xm Xs
  Hooks   installed / not installed (.claude/settings.json)

  Stats
  ─────────────────────────────
  Sessions  X   Agents  X   Tool calls  X
```

---

## `/podium logs`

```bash
tail -n 50 {LOG_FILE}
```

If the file doesn't exist: "No log file found. Has Podium been started yet?"

---

## `/podium uninstall`

```bash
node {INSTALL_SCRIPT} --uninstall
```

Confirm: "Podium hooks removed. Restart Claude Code to apply."

Does **not** stop a running server — run `/podium stop` first if needed.

---

## `/podium` (bare) · `/podium help`

When invoked with no arguments or with `help`, print this overview and stop.
Do **not** start the server.

```
Podium — real-time agent observer for Claude Code
Zero token cost · hooks-driven · pre-built SPA on port 4820

Commands
────────────────────────────────────────────────────
  /podium setup      Register Claude Code hooks (run once per project)
  /podium start      Start the dashboard server
  /podium stop       Stop the server
  /podium restart    Stop, then start
  /podium status     Show health, hook state, and live stats
  /podium logs       Tail the server log (last 50 lines)
  /podium uninstall  Remove hooks from .claude/settings.json

Dashboard → http://localhost:4820
```

---

## Quick-reference

| Command | What it does |
|---|---|
| `/podium setup` | Register Claude Code hooks (once per project) |
| `/podium start` | Start the dashboard server |
| `/podium stop` | Stop the server |
| `/podium restart` | Stop then start |
| `/podium status` | Health + hooks + stats |
| `/podium logs` | Tail server log |
| `/podium uninstall` | Remove hooks from settings.json |

---

## Notes

- Hooks fire **per-project**: the hook script captures every Claude Code event
  and POSTs it to the dashboard server (port 4820 by default).
- Token cost: **zero**. Hooks execute outside the LLM turn.
- Podium is read-only — it never modifies code or project files.
- The dashboard is served as a pre-built SPA (`dist/` is committed).
- Requires Node 18+. Run `npm install` inside `{DASHBOARD_ROOT}` before first use.
- **Linux:** `better-sqlite3` requires native compilation. If `npm install` fails:
  `sudo apt-get install -y python3 make g++` then retry.
- **Linux:** `lsof` may not be installed. `/podium stop` falls back to `fuser -k {PORT}/tcp`.
