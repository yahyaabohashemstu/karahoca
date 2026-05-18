/**
 * server/routes/admin-funnel.mjs — conversion funnel + search-terms
 * aggregation for the admin analytics suite (Phase G1 + G2).
 *
 * The funnel models the canonical KARAHOCA conversion path:
 *
 *   1. page_view              landed on the site
 *   2. product_view           opened a product (card or modal)
 *   3. chat_open              tapped Karo
 *   4. chat_message_sent      actually engaged in conversation
 *   5. whatsapp_click         clicked through to WhatsApp
 *
 * We count UNIQUE visitors per step — not raw events — because
 * "100k page-views, 50 chats" tells you ~nothing without knowing
 * how many DISTINCT people are responsible for the 50 chats. The
 * unique-visitor metric is the one any growth analyst will want.
 *
 * Steps are strictly ordered: a visitor counts at step N if they
 * have at least one event of EACH preceding step within the same
 * window. This rejects "skipped" sessions (e.g. a returning visitor
 * who already-knows-the-WhatsApp-number going straight to whatsapp_click
 * via a bookmarked link) — those would inflate the bottom of the
 * funnel and make the drop-off math meaningless.
 *
 * Why one route module for both G1 (funnel) and G2 (search terms):
 * they share the same date-range parsing + visitor_events read path,
 * and the admin UI binds them under a single "Analytics deep-dive"
 * page so the round-trip happens together.
 */

import { getDb } from '../db.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse `from` / `to` query params. Falls back to "last 30 days" when
 * missing — the most-common admin lens. Returns ISO strings (SQLite
 * compares them lexicographically when both are in 'YYYY-MM-DD' format
 * or full ISO).
 */
const parseRange = (urlObj) => {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromParam = urlObj.searchParams.get('from');
  const toParam = urlObj.searchParams.get('to');
  const from = fromParam || defaultFrom.toISOString().slice(0, 10);
  const to = toParam || now.toISOString();
  return { from, to };
};

// ─── G1: Funnel ──────────────────────────────────────────────────────────────

/**
 * Funnel definition. The order MATTERS — the SQL below counts unique
 * visitors who reached step N by joining on visitor_id with the
 * previous steps. Add a new step here and it's automatically picked
 * up by the dashboard. Removing one breaks any historical bookmarked
 * URL with `step=` segments — change with care.
 */
const FUNNEL_STEPS = [
  { key: 'page_view',         label: 'Visited the site',     icon: '🌐' },
  { key: 'product_view',      label: 'Viewed a product',     icon: '🛒' },
  { key: 'chat_open',         label: 'Opened Karo chat',     icon: '💬' },
  { key: 'chat_message_sent', label: 'Sent a chat message',  icon: '✉️' },
  { key: 'whatsapp_click',    label: 'Clicked WhatsApp',     icon: '📱' },
];

const computeFunnel = ({ from, to, lang }) => {
  const db = getDb();
  // Sub-query for each step builds the set of visitor_ids that have
  // performed that event_type in the window. We start with the broadest
  // step (page_view) and successively INNER JOIN to narrow.
  const langClause = lang ? `AND lang=?` : '';
  const baseParams = lang ? [from, to, lang] : [from, to];

  // Build the CTEs dynamically so adding a step doesn't require code
  // changes to the SQL template.
  const ctes = FUNNEL_STEPS.map((s, i) => {
    const alias = `v${i}`;
    return `${alias} AS (
      SELECT DISTINCT visitor_id
      FROM visitor_events
      WHERE visitor_id IS NOT NULL
        AND event_type = '${s.key}'
        AND created_at >= ?
        AND created_at <= ?
        ${langClause}
    )`;
  });

  // Selects: each step's count is INTERSECT of all preceding steps'
  // visitor sets. SQLite supports INTERSECT natively; we emit one row
  // per step.
  const selects = FUNNEL_STEPS.map((s, i) => {
    if (i === 0) return `SELECT '${s.key}' AS step_key, COUNT(*) AS visitors FROM v0`;
    const intersect = FUNNEL_STEPS.slice(0, i + 1)
      .map((_, j) => `SELECT visitor_id FROM v${j}`)
      .join(' INTERSECT ');
    return `SELECT '${s.key}' AS step_key, COUNT(*) AS visitors FROM (${intersect})`;
  });

  const sql = `WITH ${ctes.join(', ')}\n${selects.join('\nUNION ALL ')}`;

  // The query needs the (from, to) bind pair (and optional lang) per CTE.
  const params = FUNNEL_STEPS.flatMap(() => baseParams);
  const rows = db.prepare(sql).all(...params);
  const byKey = new Map(rows.map((r) => [r.step_key, r.visitors]));

  // Assemble the response with absolute counts + per-step drop-off
  // (relative to previous step) + per-step conversion (relative to
  // step 1). Both are useful — drop-off catches the leaky pipe,
  // conversion shows the end-to-end yield.
  const result = [];
  let prev = null;
  let first = null;
  for (const s of FUNNEL_STEPS) {
    const count = byKey.get(s.key) ?? 0;
    if (first == null) first = count;
    const drop = prev != null && prev > 0 ? Math.round(((prev - count) / prev) * 1000) / 10 : 0;
    const conv = first > 0 ? Math.round((count / first) * 1000) / 10 : 0;
    result.push({
      key: s.key,
      label: s.label,
      icon: s.icon,
      visitors: count,
      dropFromPrev: drop,    // % lost since the previous step
      conversionFromStart: conv, // % of step 1 that reached this step
    });
    prev = count;
  }
  return result;
};

// ─── G2: Search terms ────────────────────────────────────────────────────────

/**
 * Aggregate the `search_query` events into a leaderboard of the most
 * common visitor questions. The query string lives in payload_json.q,
 * normalised here to NFKC + trim + collapsed whitespace so "  منظف "
 * and "منظف  " roll up together. Min-length 2 weeds out one-char
 * "test" noise that visitors generate while figuring out the search
 * input on first focus.
 */
const computeSearchTerms = ({ from, to, lang, limit = 50 }) => {
  const db = getDb();
  const langClause = lang ? `AND lang=?` : '';
  const baseParams = lang ? [from, to, lang] : [from, to];
  const rows = db.prepare(`
    SELECT payload_json, lang
    FROM visitor_events
    WHERE event_type='search_query'
      AND created_at >= ?
      AND created_at <= ?
      ${langClause}
  `).all(...baseParams);

  const counts = new Map();
  for (const row of rows) {
    let q = null;
    try {
      const parsed = JSON.parse(row.payload_json || '{}');
      q = typeof parsed.q === 'string' ? parsed.q : null;
    } catch { /* malformed payload — skip */ }
    if (!q) continue;
    const normalised = q.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalised.length < 2) continue;
    const key = normalised;
    if (!counts.has(key)) counts.set(key, { term: normalised, count: 0, langs: new Map() });
    const bucket = counts.get(key);
    bucket.count += 1;
    if (row.lang) bucket.langs.set(row.lang, (bucket.langs.get(row.lang) || 0) + 1);
  }

  const top = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((b) => ({
      term: b.term,
      count: b.count,
      // Most-common language for this term — useful to spot Russian-
      // speaking visitors searching for a product whose Russian
      // translation is missing.
      topLang: [...b.langs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }));
  return top;
};

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/funnel?from=…&to=…&lang=…
 *
 * Returns both G1 + G2 in one payload so the dashboard only does one
 * round-trip per filter change. The two queries scan the same table
 * with the same date predicate — sharing the trip is cheap.
 */
export const handleAdminFunnel = (req, res, { sendJson, origin }) => {
  const urlObj = new URL(req.url, 'http://localhost');
  const { from, to } = parseRange(urlObj);
  const lang = urlObj.searchParams.get('lang') || null;
  const funnel = computeFunnel({ from, to, lang });
  const searchTerms = computeSearchTerms({ from, to, lang });
  sendJson(res, 200, { success: true, range: { from, to }, lang, funnel, searchTerms }, origin);
};

// Exposed for unit testing.
export const __testInternals = { FUNNEL_STEPS };
