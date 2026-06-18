---
name: podium
description: "Manage the Podium agent observer — real-time dashboard for Claude Code agents. Subcommands: setup · start · stop · restart · status · logs · uninstall. Bare `/podium` shows the subcommand reference (alias for /podium help)."
---

## How Podium works

Podium captures every Claude Code event through native hooks, stores them in
SQLite, and streams updates to the browser via WebSocket. Zero extra LLM calls.

The dashboard server runs in a **Docker container** — it is fully self-contained
and writes nothing into your project directories. The SQLite database lives in a
project-independent location (`~/.claude/podium/data/`), and Claude Code
transcripts are read from `~/.claude/` read-only. Hooks fire per-project and POST
events to `127.0.0.1:4820`, which reaches the container's published port.

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
| `COMPOSE_FILE` | `{PLUGIN_ROOT}/docker-compose.yml` |
| `DATA_DIR` | `~/.claude/podium/data` (SQLite — survives plugin updates) |
| `PORT` | `4820` (or `$PODIUM_PORT` env var if set) |

The server port is `4820` by default. If the user has set `PODIUM_PORT` in their
environment, use that value instead (it maps the host port; the container always
listens on 4820 internally). The database lives at a stable, project-independent
path that does not change between plugin version updates.

All Docker commands use `docker compose -f {COMPOSE_FILE}`, so the build context
resolves to `{PLUGIN_ROOT}` regardless of the current working directory.

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

Start the dashboard container (hooks must be set up first).

**a. Warn if hooks are missing**

```bash
node {INSTALL_SCRIPT} --check
```

Exit code 1 → hooks not installed. Warn: "Hooks not set up. Run `/podium setup`
first, then restart Claude Code." — but continue anyway.

**b. Verify Docker is available**

```bash
docker compose version >/dev/null 2>&1 && echo "ok" || echo "missing"
```

If `missing`: "Docker is required to run Podium. Install Docker Desktop, then
retry `/podium start`." — and stop.

**c. Check if already running**

```bash
curl -s --max-time 2 http://localhost:{PORT}/api/health
```

HTTP 200 → already up, skip to step f.

**d. Ensure the data directory exists**

```bash
mkdir -p {DATA_DIR}
```

This is the bind-mount target for the SQLite database, so it must exist (and be
user-owned) before the container starts.

**e. Build and start the container**

```bash
docker compose -f {COMPOSE_FILE} up -d --build
```

The first build takes 1–2 minutes (installs deps, builds the React client).
Subsequent starts are fast — Docker layer-caches everything unchanged, and
`--build` only rebuilds layers whose source changed (so plugin updates are
picked up automatically).

Wait 3 s, then verify:

```bash
curl -s --max-time 3 http://localhost:{PORT}/api/health
```

If still unreachable:

```bash
docker compose -f {COMPOSE_FILE} logs --tail 30 podium
```

Report: "Podium failed to start. See log above." and stop. **Do not check other
ports** — an unrelated process on a different port is not Podium.

**f. Show current stats**

```bash
curl -s http://localhost:{PORT}/api/stats
```

**g. Print URL**

```
Podium running -> http://localhost:{PORT}
```

---

## `/podium stop`

```bash
docker compose -f {COMPOSE_FILE} ps -q podium
```

No output → "Podium is not running."

Otherwise stop and remove the container (the database persists in `{DATA_DIR}`):

```bash
docker compose -f {COMPOSE_FILE} down
```

Confirm: "Podium stopped."

---

## `/podium restart`

Rebuild and restart in one step (picks up any plugin updates):

```bash
docker compose -f {COMPOSE_FILE} up -d --build
```

Then verify health as in `/podium start` step e, and print the URL.

---

## `/podium status`

```bash
docker compose -f {COMPOSE_FILE} ps podium
curl -s --max-time 2 http://localhost:{PORT}/api/health
```

**If not running:** "Podium is not running. Run `/podium start` to launch it."

**If running,** also fetch:

```bash
curl -s http://localhost:{PORT}/api/stats
```

Display:

```
Podium status
  Server  http://localhost:{PORT}  (container: up)
  Hooks   installed / not installed (.claude/settings.json)

  Stats
  ─────────────────────────────
  Sessions  X   Agents  X   Tool calls  X
```

---

## `/podium logs`

```bash
docker compose -f {COMPOSE_FILE} logs --tail 50 podium
```

If the container has never run: "No logs found. Has Podium been started yet?"

---

## `/podium uninstall`

```bash
node {INSTALL_SCRIPT} --uninstall
```

Confirm: "Podium hooks removed. Restart Claude Code to apply."

Does **not** stop a running container — run `/podium stop` first if needed. The
SQLite database in `{DATA_DIR}` is left untouched.

---

## `/podium` (bare) · `/podium help`

When invoked with no arguments or with `help`, print this overview and stop.
Do **not** start the server.

```
Podium — real-time agent observer for Claude Code
Zero token cost · hooks-driven · runs in Docker on port 4820

Commands
────────────────────────────────────────────────────
  /podium setup      Register Claude Code hooks (run once per project)
  /podium start      Build & start the dashboard container
  /podium stop       Stop and remove the container (data is kept)
  /podium restart    Rebuild and restart
  /podium status     Show health, hook state, and live stats
  /podium logs       Tail the container log (last 50 lines)
  /podium uninstall  Remove hooks from .claude/settings.json

Dashboard → http://localhost:4820
```

---

## Quick-reference

| Command | What it does |
|---|---|
| `/podium setup` | Register Claude Code hooks (once per project) |
| `/podium start` | Build & start the dashboard container |
| `/podium stop` | Stop and remove the container (data is kept) |
| `/podium restart` | Rebuild and restart |
| `/podium status` | Health + hooks + stats |
| `/podium logs` | Tail container log |
| `/podium uninstall` | Remove hooks from settings.json |

---

## Notes

- Hooks fire **per-project**: the hook script captures every Claude Code event
  and POSTs it to the dashboard server (port 4820 by default). Nothing is written
  into your project directory — the container's SQLite database is the single
  source of truth.
- Token cost: **zero**. Hooks execute outside the LLM turn.
- Podium is read-only — it never modifies code or project files.
- **Data location:** the SQLite database lives at `~/.claude/podium/data/`, a
  project-independent path that survives plugin updates and container rebuilds.
  Claude Code transcripts are mounted read-only from `~/.claude/`.
- **Docker required:** the server runs in a container (`docker compose`). Install
  Docker Desktop if `/podium start` reports it is missing.
- **Legacy host mode:** running `node {PLUGIN_ROOT}/server.mjs` directly still
  works for users without Docker; set `DASHBOARD_DATA_DIR=~/.claude/podium/data`
  to share the same database as the container.
