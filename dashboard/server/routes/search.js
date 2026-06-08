/**
 * @file Express router for full-text search across sessions and events.
 * GET /api/search?q=<query>&limit=20&offset=0
 *
 * Searches sessions by name/cwd and events by summary/tool_name/data using
 * SQLite LIKE queries. Returns up to 20 sessions + 20 events, combined and
 * sorted by recency.
 */

const { Router } = require("express");
const { db, stmts } = require("../db");

const router = Router();

const MAX_PER_TYPE = 20;
const HIGHLIGHT_WINDOW = 100; // chars of context around the match

/**
 * Extract a ~HIGHLIGHT_WINDOW-char snippet around the first occurrence of
 * `query` (case-insensitive) in `text`. Returns null if no match found.
 * @param {string|null} text
 * @param {string} query
 * @returns {string|null}
 */
function buildHighlight(text, query) {
  if (!text || !query) return null;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - Math.floor(HIGHLIGHT_WINDOW / 2));
  const end = Math.min(text.length, idx + query.length + Math.floor(HIGHLIGHT_WINDOW / 2));
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}

// GET /api/search?q=<query>&limit=20&offset=0
router.get("/", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    return res.json({ results: [], total: 0 });
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || MAX_PER_TYPE, MAX_PER_TYPE);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const pattern = `%${q}%`;

  // ── Session search ──────────────────────────────────────────────────────
  const sessionRows = db
    .prepare(
      `SELECT s.id, s.name, s.cwd, s.status, s.started_at, s.updated_at
       FROM sessions s
       WHERE s.name LIKE ? OR s.cwd LIKE ?
       ORDER BY s.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(pattern, pattern, limit, offset);

  const sessionCountRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM sessions WHERE name LIKE ? OR cwd LIKE ?`
    )
    .get(pattern, pattern);
  const sessionTotal = sessionCountRow ? sessionCountRow.c : 0;

  // Fetch costs for matched sessions in bulk
  let sessionCosts = {};
  if (sessionRows.length > 0) {
    const ids = sessionRows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const tokenRows = db
      .prepare(
        `SELECT session_id, model,
           input_tokens + baseline_input as input_tokens,
           output_tokens + baseline_output as output_tokens,
           cache_read_tokens + baseline_cache_read as cache_read_tokens,
           cache_write_tokens + baseline_cache_write as cache_write_tokens
         FROM token_usage WHERE session_id IN (${placeholders})`
      )
      .all(...ids);
    const rules = stmts.listPricing.all();
    // Group by session
    const bySession = {};
    for (const t of tokenRows) {
      if (!bySession[t.session_id]) bySession[t.session_id] = [];
      bySession[t.session_id].push(t);
    }
    for (const [sid, tokens] of Object.entries(bySession)) {
      let cost = 0;
      for (const t of tokens) {
        const rule = rules.find(
          (r) => t.model && t.model.toLowerCase().startsWith(r.model_pattern.replace(/%$/, "").toLowerCase())
        );
        if (!rule) continue;
        cost +=
          (t.input_tokens / 1_000_000) * rule.input_per_mtok +
          (t.output_tokens / 1_000_000) * rule.output_per_mtok +
          (t.cache_read_tokens / 1_000_000) * rule.cache_read_per_mtok +
          (t.cache_write_tokens / 1_000_000) * rule.cache_write_per_mtok;
      }
      sessionCosts[sid] = cost;
    }
  }

  const sessionResults = sessionRows.map((s) => ({
    type: "session",
    session_id: s.id,
    session_name: s.name,
    cwd: s.cwd,
    status: s.status,
    cost: sessionCosts[s.id] || 0,
    started_at: s.started_at,
    highlight:
      buildHighlight(s.name, q) ||
      buildHighlight(s.cwd, q) ||
      s.name ||
      s.cwd,
    _sort_key: s.updated_at || s.started_at || "",
  }));

  // ── Event search ────────────────────────────────────────────────────────
  const eventRows = db
    .prepare(
      `SELECT e.id, e.session_id, e.event_type, e.tool_name, e.summary, e.created_at,
              s.name as session_name
       FROM events e
       LEFT JOIN sessions s ON s.id = e.session_id
       WHERE e.summary LIKE ? OR e.tool_name LIKE ? OR e.data LIKE ?
       ORDER BY e.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(pattern, pattern, pattern, limit, offset);

  const eventCountRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM events
       WHERE summary LIKE ? OR tool_name LIKE ? OR data LIKE ?`
    )
    .get(pattern, pattern, pattern);
  const eventTotal = eventCountRow ? eventCountRow.c : 0;

  const eventResults = eventRows.map((e) => ({
    type: "event",
    session_id: e.session_id,
    session_name: e.session_name,
    event_id: e.id,
    event_type: e.event_type,
    tool_name: e.tool_name,
    summary: e.summary,
    created_at: e.created_at,
    _sort_key: e.created_at || "",
  }));

  // ── Combine and sort by recency ─────────────────────────────────────────
  const combined = [...sessionResults, ...eventResults];
  combined.sort((a, b) => {
    // Descending: newer first
    if (a._sort_key > b._sort_key) return -1;
    if (a._sort_key < b._sort_key) return 1;
    return 0;
  });

  // Strip internal sort key before returning
  for (const r of combined) {
    delete r._sort_key;
  }

  const total = sessionTotal + eventTotal;

  res.json({ results: combined, total });
});

module.exports = router;
