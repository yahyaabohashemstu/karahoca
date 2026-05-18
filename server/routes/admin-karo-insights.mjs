import { getDb } from '../services/db.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { logger } from '../utils/logger.mjs';

/**
 * GET /api/admin/karo-insights
 *
 * Returns an aggregated JSON snapshot of every metric the Karo
 * Insights dashboard wants to render. ONE round-trip, ONE state
 * update on the client side — important because the admin panel is
 * occasionally opened on slow connections (an operator on the road
 * checking conversations from their phone), and a per-section fetch
 * cascade would feel sluggish.
 *
 * All queries are scoped to the [from, to] range supplied as ISO
 * dates. Defaults to the last 30 days when missing.
 *
 * Data sources:
 *   - `visitor_events` (Phase A2) for chat opens, WhatsApp clicks,
 *     follow-up chip taps, country distribution, language mix.
 *   - `chat_messages` (existing) for message volume, role split,
 *     drop-off approximation.
 *
 * Defensive:
 *   - Every aggregate query is wrapped — if one section fails (e.g.
 *     a missing column on an older deploy), the rest still ships.
 *   - SQL parameters are bound, never string-interpolated.
 *   - Empty result sets are returned as empty arrays / zero values;
 *     never null / undefined / NaN, so the UI doesn't need null
 *     guards.
 */

const DEFAULT_RANGE_DAYS = 30;

/**
 * Normalise & validate the date range from the request URL. Returns
 * ISO 8601 strings safe to bind directly into SQLite's `datetime()`.
 * Anything malformed falls back to "last N days" so the dashboard
 * always has SOMETHING to show.
 */
const resolveRange = (url) => {
  const params = new URL(url, 'http://x').searchParams;
  const toRaw = params.get('to');
  const fromRaw = params.get('from');

  const isValidDateString = (s) =>
    typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const to = isValidDateString(toRaw) ? `${toRaw}T23:59:59Z` : new Date().toISOString();
  const from = (() => {
    if (isValidDateString(fromRaw)) return `${fromRaw}T00:00:00Z`;
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - DEFAULT_RANGE_DAYS);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  return { from, to };
};

const safeRow = (db, sql, params) => {
  try { return db.prepare(sql).get(params); } catch { return null; }
};
const safeRows = (db, sql, params) => {
  try { return db.prepare(sql).all(params); } catch { return []; }
};

export const handleKaroInsights = (request, response, { origin }) => {
  try {
    const db = getDb();
    const { from, to } = resolveRange(request.url || '');
    const params = { from, to };

    // ── KPI #1: chat opens (unique visitors) ──────────────────────────
    const chatOpensRow = safeRow(
      db,
      `SELECT COUNT(DISTINCT visitor_id) AS unique_visitors,
              COUNT(*)                    AS total_opens
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at BETWEEN @from AND @to`,
      params,
    ) || { unique_visitors: 0, total_opens: 0 };

    // ── KPI #2: messages volume (split by role) ──────────────────────
    const messagesRow = safeRow(
      db,
      `SELECT
          COUNT(*) AS total_messages,
          SUM(CASE WHEN role = 'user'      THEN 1 ELSE 0 END) AS user_messages,
          SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS assistant_messages
         FROM chat_messages
        WHERE created_at BETWEEN @from AND @to`,
      params,
    ) || { total_messages: 0, user_messages: 0, assistant_messages: 0 };

    // ── KPI #3: average messages per conversation ────────────────────
    // A "conversation" here = all messages from one user_id inside the
    // window. Good-enough proxy for "back-and-forth depth" without
    // requiring strict session boundaries (which we don't model yet).
    const avgRow = safeRow(
      db,
      `SELECT AVG(cnt) AS avg_messages
         FROM (
           SELECT user_id, COUNT(*) AS cnt
             FROM chat_messages
            WHERE created_at BETWEEN @from AND @to
            GROUP BY user_id
         )`,
      params,
    );
    const avgMessagesPerConvo = avgRow?.avg_messages != null
      ? Math.round((avgRow.avg_messages + Number.EPSILON) * 10) / 10
      : 0;

    // ── KPI #4: WhatsApp click-through rate from chat ────────────────
    // Numerator: unique visitors who clicked any WhatsApp link with
    // source ∈ {chat_card, chat_footer} (the in-chat affordances we
    // care about — the floating button is a separate funnel).
    const waCtrRow = safeRow(
      db,
      `SELECT
         (SELECT COUNT(DISTINCT visitor_id) FROM visitor_events
            WHERE event_type = 'chat_open' AND created_at BETWEEN @from AND @to) AS opens,
         (SELECT COUNT(DISTINCT visitor_id) FROM visitor_events
            WHERE event_type IN ('whatsapp_click','chat_continue_whatsapp')
              AND created_at BETWEEN @from AND @to) AS clicks`,
      params,
    ) || { opens: 0, clicks: 0 };
    const whatsappCtr = waCtrRow.opens > 0
      ? Math.round((waCtrRow.clicks / waCtrRow.opens) * 1000) / 10
      : 0;

    // ── Volume over time (chats per day) ──────────────────────────────
    const byDay = safeRows(
      db,
      `SELECT
          SUBSTR(created_at, 1, 10)   AS day,
          COUNT(DISTINCT visitor_id)  AS unique_visitors,
          COUNT(*)                    AS opens
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at BETWEEN @from AND @to
        GROUP BY day
        ORDER BY day ASC`,
      params,
    );

    // ── Language distribution ────────────────────────────────────────
    const byLang = safeRows(
      db,
      `SELECT
          COALESCE(NULLIF(lang, ''), 'unknown') AS lang,
          COUNT(*)                              AS count
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at BETWEEN @from AND @to
        GROUP BY COALESCE(NULLIF(lang, ''), 'unknown')
        ORDER BY count DESC`,
      params,
    );

    // ── Top countries (from CF-IPCountry / X-Country headers) ────────
    const byCountry = safeRows(
      db,
      `SELECT
          COALESCE(NULLIF(ip_country, ''), 'unknown') AS country,
          COUNT(*)                                    AS count
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at BETWEEN @from AND @to
        GROUP BY COALESCE(NULLIF(ip_country, ''), 'unknown')
        ORDER BY count DESC
        LIMIT 15`,
      params,
    );

    // ── Top products inquired about ──────────────────────────────────
    // Any event with product_id set counts; the dashboard groups by id
    // and the UI can map the id to the localised product name client-
    // side using its existing product list.
    const topProducts = safeRows(
      db,
      `SELECT
          product_id,
          COUNT(*) AS hits
         FROM visitor_events
        WHERE product_id IS NOT NULL
          AND product_id <> ''
          AND created_at BETWEEN @from AND @to
        GROUP BY product_id
        ORDER BY hits DESC
        LIMIT 20`,
      params,
    );

    // ── Top follow-up chips ──────────────────────────────────────────
    // The chip text lands in payload_json under `chip`. SQLite's
    // json_extract is available on a modern build_with_json1.
    const topFollowupChips = safeRows(
      db,
      `SELECT
          json_extract(payload_json, '$.chip') AS chip,
          COUNT(*) AS count
         FROM visitor_events
        WHERE event_type = 'chat_followup_chip_used'
          AND payload_json IS NOT NULL
          AND created_at BETWEEN @from AND @to
        GROUP BY chip
        ORDER BY count DESC
        LIMIT 15`,
      params,
    );

    // ── Recent unanswered turns ──────────────────────────────────────
    // Approximation: visitor sent at least one user message but the
    // conversation has more user messages than assistant messages
    // (Karo missed at least one). Useful as a starting point for the
    // operator to spot-fix.
    const droppedConversations = safeRow(
      db,
      `SELECT COUNT(*) AS dropped FROM (
         SELECT
           user_id,
           SUM(CASE WHEN role = 'user'      THEN 1 ELSE 0 END) AS u,
           SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS a
         FROM chat_messages
        WHERE created_at BETWEEN @from AND @to
        GROUP BY user_id
        HAVING u > a
      )`,
      params,
    )?.dropped || 0;

    sendJson(response, 200, {
      success: true,
      range: { from, to },
      kpi: {
        chatOpens: chatOpensRow.total_opens || 0,
        uniqueVisitors: chatOpensRow.unique_visitors || 0,
        totalMessages: messagesRow.total_messages || 0,
        userMessages: messagesRow.user_messages || 0,
        assistantMessages: messagesRow.assistant_messages || 0,
        avgMessagesPerConvo,
        whatsappCtr,
        droppedConversations,
      },
      byDay,
      byLang,
      byCountry,
      topProducts,
      topFollowupChips,
    }, origin);
  } catch (err) {
    logger.error('[karo-insights] aggregation failed:', err.message || err);
    sendJson(response, 500, { success: false, error: 'Insights query failed.' }, origin);
  }
};
