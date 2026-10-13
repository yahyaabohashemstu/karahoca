import { getDb } from '../services/db.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { logger } from '../utils/logger.mjs';
import { resolveDayRange, fillDays } from '../utils/dateRange.mjs';

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
 * All queries are scoped to the [from, to] range supplied as
 * 'YYYY-MM-DD' days (UTC), both included. Defaults to the last 30 days
 * when missing; a malformed or reversed range is a 400.
 *
 * Data sources:
 *   - `visitor_events` (Phase A2) for chat opens, WhatsApp clicks,
 *     follow-up chip taps, country distribution, language mix.
 *   - `chat_messages` (existing) for message volume, role split,
 *     drop-off approximation.
 *
 * Defensive:
 *   - Every aggregate query is wrapped — if one section fails (e.g.
 *     a missing column on an older deploy), the rest still ships and
 *     the failure is logged with the section's name.
 *   - SQL parameters are bound, never string-interpolated.
 *   - Empty result sets are returned as empty arrays / zero values;
 *     never null / undefined / NaN, so the UI doesn't need null
 *     guards.
 */

const DEFAULT_RANGE_DAYS = 30;

// A failing section returns its empty value so the rest of the dashboard
// still renders — but it is logged: these used to swallow the error, so a
// broken query just showed as "no data" with nothing in the logs.
const safeRow = (db, section, sql, params) => {
  try { return db.prepare(sql).get(params); } catch (err) {
    logger.warn({ err, section }, '[karo-insights] section query failed');
    return null;
  }
};
const safeRows = (db, section, sql, params) => {
  try { return db.prepare(sql).all(params); } catch (err) {
    logger.warn({ err, section }, '[karo-insights] section query failed');
    return [];
  }
};

export const handleKaroInsights = (request, response, { origin }) => {
  try {
    const db = getDb();
    const searchParams = new URL(request.url || '', 'http://x').searchParams;
    const range = resolveDayRange(
      { from: searchParams.get('from'), to: searchParams.get('to') },
      { defaultDays: DEFAULT_RANGE_DAYS },
    );
    if (range.error) {
      sendJson(response, 400, { success: false, error: range.error }, origin);
      return;
    }
    const { from, to, toExclusive } = range;
    // `created_at >= @from AND created_at < @toExcl` with bare days is
    // right for both stored shapes — visitor_events' 'YYYY-MM-DD HH:MM:SS'
    // and chat_messages' ISO 'T…Z'. The old BETWEEN on 'DT00:00:00Z' /
    // 'DT23:59:59Z' dropped the first day of visitor_events (' ' < 'T').
    const params = { from, toExcl: toExclusive };

    // ── KPI #1: chat opens (unique visitors) ──────────────────────────
    const chatOpensRow = safeRow(
      db, 'chatOpens',
      `SELECT COUNT(DISTINCT visitor_id) AS unique_visitors,
              COUNT(*)                    AS total_opens
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at >= @from AND created_at < @toExcl`,
      params,
    ) || { unique_visitors: 0, total_opens: 0 };

    // ── KPI #2: messages volume (split by role) ──────────────────────
    const messagesRow = safeRow(
      db, 'messages',
      `SELECT
          COUNT(*) AS total_messages,
          SUM(CASE WHEN role = 'user'      THEN 1 ELSE 0 END) AS user_messages,
          SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS assistant_messages
         FROM chat_messages
        WHERE created_at >= @from AND created_at < @toExcl`,
      params,
    ) || { total_messages: 0, user_messages: 0, assistant_messages: 0 };

    // ── KPI #3: average messages per conversation ────────────────────
    // A "conversation" here = all messages from one user_id inside the
    // window. Good-enough proxy for "back-and-forth depth" without
    // requiring strict session boundaries (which we don't model yet).
    const avgRow = safeRow(
      db, 'avgMessagesPerConvo',
      `SELECT AVG(cnt) AS avg_messages
         FROM (
           SELECT user_id, COUNT(*) AS cnt
             FROM chat_messages
            WHERE created_at >= @from AND created_at < @toExcl
            GROUP BY user_id
         )`,
      params,
    );
    const avgMessagesPerConvo = avgRow?.avg_messages != null
      ? Math.round((avgRow.avg_messages + Number.EPSILON) * 10) / 10
      : 0;

    // ── KPI #4: WhatsApp click-through rate from chat ────────────────
    // Numerator: chat openers (in the window) who then went to WhatsApp
    // FROM THE CHAT — the in-chat product card / footer link
    // (whatsapp_click with source chat_card / chat_footer) or "continue
    // this chat on WhatsApp". It used to count every whatsapp_click,
    // including the floating button pressed by visitors who never opened
    // the chat, so the "rate" could pass 100%.
    const waCtrRow = safeRow(
      db, 'whatsappCtr',
      `WITH openers AS (
         SELECT DISTINCT visitor_id FROM visitor_events
          WHERE event_type = 'chat_open'
            AND visitor_id IS NOT NULL
            AND created_at >= @from AND created_at < @toExcl
       )
       SELECT
         (SELECT COUNT(*) FROM openers) AS opens,
         (SELECT COUNT(DISTINCT ve.visitor_id) FROM visitor_events ve
           WHERE ve.visitor_id IN (SELECT visitor_id FROM openers)
             AND ve.created_at >= @from AND ve.created_at < @toExcl
             AND (ve.event_type = 'chat_continue_whatsapp'
                  OR (ve.event_type = 'whatsapp_click'
                      AND json_extract(ve.payload_json, '$.source') IN ('chat_card', 'chat_footer')))
         ) AS clicks`,
      params,
    ) || { opens: 0, clicks: 0 };
    const whatsappCtr = waCtrRow.opens > 0
      ? Math.min(100, Math.round((waCtrRow.clicks / waCtrRow.opens) * 1000) / 10)
      : 0;

    // ── Volume over time (chats per day) ──────────────────────────────
    const byDayRows = safeRows(
      db, 'byDay',
      `SELECT
          SUBSTR(created_at, 1, 10)   AS day,
          COUNT(DISTINCT visitor_id)  AS unique_visitors,
          COUNT(*)                    AS opens
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at >= @from AND created_at < @toExcl
        GROUP BY day
        ORDER BY day ASC`,
      params,
    );
    // Every day of the range, quiet ones as 0 — otherwise the bar chart
    // closed up the gaps and a dead week looked like steady traffic.
    // SUBSTR(created_at, 1, 10) is the UTC day for both stored shapes.
    const byDay = fillDays(byDayRows, from, to, 'day', (day) => ({ day, unique_visitors: 0, opens: 0 }));

    // ── Language distribution ────────────────────────────────────────
    const byLang = safeRows(
      db, 'byLang',
      `SELECT
          COALESCE(NULLIF(lang, ''), 'unknown') AS lang,
          COUNT(*)                              AS count
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at >= @from AND created_at < @toExcl
        GROUP BY COALESCE(NULLIF(lang, ''), 'unknown')
        ORDER BY count DESC`,
      params,
    );

    // ── Top countries (from CF-IPCountry / X-Country headers) ────────
    const byCountry = safeRows(
      db, 'byCountry',
      `SELECT
          COALESCE(NULLIF(ip_country, ''), 'unknown') AS country,
          COUNT(*)                                    AS count
         FROM visitor_events
        WHERE event_type = 'chat_open'
          AND created_at >= @from AND created_at < @toExcl
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
      db, 'topProducts',
      `SELECT
          product_id,
          COUNT(*) AS hits
         FROM visitor_events
        WHERE product_id IS NOT NULL
          AND product_id <> ''
          AND created_at >= @from AND created_at < @toExcl
        GROUP BY product_id
        ORDER BY hits DESC
        LIMIT 20`,
      params,
    );

    // ── Top follow-up chips ──────────────────────────────────────────
    // The chip text lands in payload_json under `chip`. SQLite's
    // json_extract is available on a modern build_with_json1.
    const topFollowupChips = safeRows(
      db, 'topFollowupChips',
      `SELECT
          json_extract(payload_json, '$.chip') AS chip,
          COUNT(*) AS count
         FROM visitor_events
        WHERE event_type = 'chat_followup_chip_used'
          AND payload_json IS NOT NULL
          AND created_at >= @from AND created_at < @toExcl
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
      db, 'droppedConversations',
      `SELECT COUNT(*) AS dropped FROM (
         SELECT
           user_id,
           SUM(CASE WHEN role = 'user'      THEN 1 ELSE 0 END) AS u,
           SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS a
         FROM chat_messages
        WHERE created_at >= @from AND created_at < @toExcl
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
    logger.error({ err }, '[karo-insights] aggregation failed');
    sendJson(response, 500, { success: false, error: 'Insights query failed.' }, origin);
  }
};
