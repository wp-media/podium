/**
 * @file Express router for session export/import endpoints.
 * GET  /api/export/session/:id — Download a JSON bundle of a session with all agents, events, and token usage.
 * POST /api/import/session     — Import a previously-exported session bundle.
 */

const express = require("express");
const { Router } = require("express");
const { db } = require("../db");

const router = Router();

// Session exports can be many megabytes. Apply a generous limit only to the
// import endpoint — the global 1 MB cap is fine for everything else.
const IMPORT_JSON_LIMIT = "50mb";

const EXPORT_VERSION = "1.0";

// GET /api/export/session/:id
// Downloads a complete JSON bundle for the requested session.
router.get("/session/:id", (req, res) => {
  const sessionId = req.params.id;

  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  const agents = db
    .prepare("SELECT * FROM agents WHERE session_id = ? ORDER BY started_at ASC")
    .all(sessionId);

  const events = db
    .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId);

  const tokenUsage = db
    .prepare("SELECT * FROM token_usage WHERE session_id = ?")
    .all(sessionId);

  const bundle = {
    podium_export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    session,
    agents,
    events,
    token_usage: tokenUsage,
  };

  const shortId = sessionId.slice(0, 8);
  res.setHeader("Content-Disposition", `attachment; filename="podium-session-${shortId}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json(bundle);
});

// POST /api/import/session  (also reachable via POST /api/export/session)
// Accepts a JSON bundle (the format produced by GET /api/export/session/:id)
// and inserts all records using INSERT OR IGNORE (sessions, agents, events)
// and INSERT OR REPLACE (token_usage).
router.post("/session", express.json({ limit: IMPORT_JSON_LIMIT }), (req, res) => {
  const bundle = req.body;

  if (!bundle || typeof bundle !== "object") {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Request body must be a JSON object" } });
  }

  if (bundle.podium_export_version !== EXPORT_VERSION) {
    return res.status(400).json({
      error: {
        code: "UNSUPPORTED_VERSION",
        message: `Only podium_export_version "${EXPORT_VERSION}" is supported`,
      },
    });
  }

  const { session, agents = [], events = [], token_usage: tokenUsage = [] } = bundle;

  if (!session || !session.id) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "bundle.session.id is required" } });
  }

  // Build column lists dynamically from the session object so the import
  // works even if a column is missing from the export (e.g. an older export
  // that predates github_pr_url).
  const importSession = db.transaction(() => {
    // --- sessions ---
    const sessionCols = Object.keys(session);
    const sessionPlaceholders = sessionCols.map(() => "?").join(", ");
    db.prepare(
      `INSERT OR IGNORE INTO sessions (${sessionCols.join(", ")}) VALUES (${sessionPlaceholders})`
    ).run(...sessionCols.map((c) => session[c]));

    // --- agents ---
    const insertAgent = db.prepare(`
      INSERT OR IGNORE INTO agents
        (id, session_id, name, type, subagent_type, status, task, current_tool,
         started_at, ended_at, parent_agent_id, metadata, updated_at, awaiting_input_since)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const agent of agents) {
      insertAgent.run(
        agent.id ?? null,
        agent.session_id ?? session.id,
        agent.name ?? null,
        agent.type ?? "main",
        agent.subagent_type ?? null,
        agent.status ?? "completed",
        agent.task ?? null,
        agent.current_tool ?? null,
        agent.started_at ?? null,
        agent.ended_at ?? null,
        agent.parent_agent_id ?? null,
        agent.metadata ?? null,
        agent.updated_at ?? null,
        agent.awaiting_input_since ?? null
      );
    }

    // --- events ---
    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO events
        (id, session_id, agent_id, event_type, tool_name, summary, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const event of events) {
      // data may already be a string (from SQLite) or a parsed object (re-exported).
      const dataStr =
        typeof event.data === "string"
          ? event.data
          : event.data != null
          ? JSON.stringify(event.data)
          : null;
      insertEvent.run(
        event.id ?? null,
        event.session_id ?? session.id,
        event.agent_id ?? null,
        event.event_type ?? "Unknown",
        event.tool_name ?? null,
        event.summary ?? null,
        dataStr,
        event.created_at ?? null
      );
    }

    // --- token_usage ---
    const upsertToken = db.prepare(`
      INSERT OR REPLACE INTO token_usage
        (session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         baseline_input, baseline_output, baseline_cache_read, baseline_cache_write)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of tokenUsage) {
      upsertToken.run(
        t.session_id ?? session.id,
        t.model ?? "unknown",
        t.input_tokens ?? 0,
        t.output_tokens ?? 0,
        t.cache_read_tokens ?? 0,
        t.cache_write_tokens ?? 0,
        t.baseline_input ?? 0,
        t.baseline_output ?? 0,
        t.baseline_cache_read ?? 0,
        t.baseline_cache_write ?? 0
      );
    }
  });

  try {
    importSession();
  } catch (err) {
    return res.status(500).json({
      error: { code: "IMPORT_FAILED", message: err.message || "Import failed" },
    });
  }

  res.json({ ok: true, session_id: session.id });
});

module.exports = router;
