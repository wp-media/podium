<div align="center">

<img src="dashboard/client/public/logo.svg" alt="Podium" width="160" height="160"/>

# Podium

**The conductor's vantage point for your AI orchestra.**

*Every agent, every tool call, every decision — streaming live to your browser. Zero token cost.*

---

[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-orange?style=flat-square)](https://github.com/wp-media/claude-marketplace)
[![Version](https://img.shields.io/badge/version-1.3.0-gold?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![wp-media](https://img.shields.io/badge/by-wp--media-black?style=flat-square)](https://github.com/wp-media)

</div>

---

[Maestro](https://github.com/wp-media/maestro) orchestrates your agents. **Podium** is where you stand to watch the whole performance.

When a Maestro pipeline spins up — grooming agent, backend agent, QA agent, all running in parallel — Podium captures every hook event the Claude Code harness fires and streams it to a live browser dashboard. No polling your terminal. No extra LLM calls. No config beyond a one-time hook registration.

Open the dashboard. Watch your agents work.

---

## Install

```
/plugin install podium@wp-media
/podium setup     ← registers hooks once (restart Claude Code after)
/podium start     ← opens http://localhost:4820
```

That's it. Hooks are registered globally or per-project — your call.

---

## What You Get

### Live Dashboard
The moment a session starts, a card appears. Watch agents spawn in real time, see the current tool being used, track cost accumulating, get a browser notification if something goes wrong. Two sessions running in parallel? Both on screen, side by side.

### Session Detail — the full picture
Click any session and step inside:

- **Conversation tab** — the full agent transcript, thinking blocks expanded, no truncation
- **Agents tab** — the agent tree: who spawned whom, which ones ran in parallel, leaf nodes you can click straight into their conversation
- **Timeline** — every tool call in order, filterable by type or status. An **error chip** in the header counts failures — click it to jump straight to the bad events
- **Thinking tab** — the Decision log. Extended thinking blocks extracted and grouped by agent, so you can read the reasoning chain without digging through raw output
- **Run Summary** — a 3-line digest at the top of every completed session: what ran, how long, what it cost

Annotate any session with a private sticky note (stored locally, never sent anywhere). Export it as a self-contained JSON bundle to share with a teammate or archive for later.

### Cross-Session Search
`Cmd+K` anywhere in the dashboard. Search across session names, tool outputs, summaries, error messages — across your entire history. Results link straight to the session.

### Import
Received an exported bundle from a colleague? Drop the `.json` on the Import page, preview the session before committing, then import it into your local Podium with one click.

### Activity Feed
A live stream of every tool call across every session. Filter by event type, status, or agent. Preset buttons for the most common views — **Errors only**, **Tool calls only** — and filters survive navigation within the tab.

### Workflows
Two featured charts are front and center:
- **Session Drilldown** — drill into any session's agent tree, timeline, and tool sequence
- **Error Propagation** — see where errors originate and how they cascade

Eight more analytics charts live under **Advanced Analytics**, collapsed by default so they don't clutter the view. Expand what you need; your preference is remembered.

### Analytics & Cost Tracking
Token usage broken down by model, tool call frequency, session concurrency, cost per session and per model. If a session crosses $1 in cost you get a browser notification. Same if an agent goes silent for more than 5 minutes.

### Kanban Board
Sessions grouped by status — active, completed, error, abandoned. Drag a card to move it, or just use it to get a spatial overview of where your pipelines are.

### Structured Bash Output
Podium parses tool output it recognises:
- **PHPUnit** — pass/fail counts, test count
- **PHPCS** — error + warning counts
- **`gh pr`** — extracts the PR URL and links it to the session
- **`git diff --stat`** — files changed, insertions, deletions

These show up as structured fields on the event, not buried in a wall of text.

---

## Architecture (the short version)

```
Claude Code harness
  │  fires on every hook event (zero token cost)
  ▼
~/.claude/podium/hook.mjs   ← posts JSON, exits in < 1.5 s
  │
  ▼
Express + SQLite + WebSocket  :4820
  │
  ▼
React SPA (pre-built, no build step on install)
```

Hooks run **outside the LLM turn** — they add no latency to your agent, consume no tokens, and cannot block a tool call. The JSONL transcript on disk is a backup; the live stream goes hook → server → WebSocket → browser.

Works on **macOS, Linux, and Windows**.

---

## Commands

| Command | What it does |
|---|---|
| `/podium setup` | Register Claude Code hooks (once per project, or `--global`) |
| `/podium start` | Start the dashboard server → http://localhost:4820 |
| `/podium stop` | Stop the server |
| `/podium restart` | Restart (picks up config changes) |
| `/podium status` | Health check — server, hooks, DB, WebSocket |
| `/podium logs` | Tail the server log |
| `/podium uninstall` | Remove hooks from settings.json |

---

## Local Development

```bash
cd dashboard
npm install            # server deps
cd client && npm install  # frontend deps

npm run dev            # hot-reload dev server + API proxy
```

The Vite dev server proxies `/api/*` to the Express backend on `:4820`. Override the port with `DASHBOARD_PORT=4821 npm run dev`.

---

## Releasing

```bash
./release.sh 1.3.0
```

Bumps all four `package.json` + `plugin.json` in sync, builds the client (baking the version into the bundle), commits, tags, and pushes. Then create the GitHub Release from the tag — plugin users pick it up on their next `/plugin update`.

---

## Repository Layout

```
podium/
├── .claude-plugin/plugin.json   ← Claude Code plugin manifest
├── commands/
│   ├── podium.md                ← /podium skill
│   └── podium-health.md         ← /podium-health skill
├── dashboard/
│   ├── client/                  ← React + TypeScript + Vite
│   │   └── dist/                ← pre-built SPA (committed)
│   └── server/                  ← Express + SQLite + WebSocket
├── hook.mjs                     ← fires on every Claude Code event
├── server.mjs                   ← production entrypoint
├── install.mjs                  ← hook registration
└── release.sh                   ← release automation
```

---

<div align="center">

*The orchestra plays. You conduct from the Podium.*

*Part of the [Maestro](https://github.com/wp-media/maestro) suite — Built at [WP-Media](https://wp-media.me)*

</div>
