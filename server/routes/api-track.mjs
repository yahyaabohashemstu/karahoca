import { readRequestBody } from '../middlewares/bodyParser.mjs';
import { createJsonHeaders } from '../middlewares/cors.mjs';
import { getClientIp, isTrackEventRateLimited } from '../middlewares/security.mjs';
import { getDb } from '../services/db.mjs';
import { logger } from '../utils/logger.mjs';

/**
 * POST /api/track/event   (single event)
 * POST /api/track/events  (batch of up to MAX_BATCH events)
 *
 * Ingest endpoint for the SPA's analytics queue. Designed to be cheap,
 * fast, and impossible to misuse:
 *
 *   - Fire-and-forget: returns 204 immediately. The DB write is the
 *     only IO and it's wrapped in a transaction so a batch of 50
 *     events is one fsync, not fifty.
 *   - Validation per event: strict allow-list on `event_type`, capped
 *     string lengths, JSON payload size limit. A malformed item is
 *     dropped silently — never rejects the whole batch (we'd rather
 *     lose one event than the lot).
 *   - Visitor id resolved by the upstream `resolveVisitorId`
 *     middleware (req.visitorId) — caller's body field is ignored to
 *     prevent spoofing.
 *   - Country derived ONCE from CF-IPCountry / X-Country headers. Raw
 *     IP is NEVER persisted.
 *   - Consent: this endpoint does NOT itself check consent. The
 *     client only calls it when consent === 'all' (see
 *     src/utils/track.ts). Defensive null-tolerance on the server
 *     side preserves the contract: anonymous events still land but
 *     attribute to a null visitor.
 *
 * Wire format (single):
 *   { event_type: "page_view", page_path: "/ar/diox", lang: "ar",
 *     product_id?: "diox-soap", payload?: { ... } }
 *
 * Wire format (batch):
 *   { events: [ <event1>, <event2>, ... ] }
 */

const MAX_BATCH = 50;
const MAX_STRING_LEN = 512;
const MAX_PAYLOAD_BYTES = 2048;

// Open allow-list — extending this is intentional friction so we
// don't accidentally swallow typo'd event names from the client.
const ALLOWED_EVENT_TYPES = new Set([
  // Page lifecycle
  'page_view',
  'language_switch',
  // Product engagement
  'product_view',
  'product_modal_open',
  'product_share_whatsapp',
  // Cart / lead (future)
  'wishlist_add',
  'wishlist_remove',
  // Outbound conversions
  'whatsapp_click',
  'email_click',
  'phone_click',
  // Chat
  'chat_open',
  'chat_close',
  'chat_message_sent',
  'chat_followup_chip_used',
  'chat_continue_whatsapp',
  // Search
  'search_query',
  // Newsletter
  'newsletter_subscribe',
]);

const truncate = (value, max = MAX_STRING_LEN) =>
  typeof value === 'string' ? value.slice(0, max) : null;

const readCountryHeader = (req) => {
  const h = req.headers || {};
  // Cloudflare and most edge proxies emit one of these.
  return (
    truncate(h['cf-ipcountry'], 2) ||
    truncate(h['x-country'], 2) ||
    truncate(h['x-vercel-ip-country'], 2) ||
    null
  );
};

/**
 * Validate + canonicalise one event from a wire-format payload. Exposed
 * for unit tests; the route handler uses it internally too. Returns
 * a normalised record on success or `null` for any reason the event
 * should be dropped (unknown type, oversized strings, malformed payload).
 */
export const normaliseEvent = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const event_type = typeof raw.event_type === 'string' ? raw.event_type.trim() : '';
  if (!ALLOWED_EVENT_TYPES.has(event_type)) return null;

  // Stringify the payload once with a size cap. The catch handles
  // circular references (`JSON.stringify` throws on cycles) — drop the
  // payload in that case rather than the whole event.
  let payload_json = null;
  if (raw.payload && typeof raw.payload === 'object') {
    try {
      const candidate = JSON.stringify(raw.payload);
      if (candidate.length <= MAX_PAYLOAD_BYTES) payload_json = candidate;
    } catch { /* drop */ }
  }

  return {
    event_type,
    page_path: truncate(raw.page_path),
    product_id: truncate(raw.product_id, 128),
    lang: truncate(raw.lang, 8),
    referrer: truncate(raw.referrer),
    payload_json,
  };
};

/**
 * Insert a (possibly empty) batch of events. Wrapped in a transaction
 * so a 50-event batch is one fsync, not 50. Errors are caught and
 * logged — we never let analytics failures break the calling page.
 */
const insertEvents = (db, events, ctx) => {
  if (events.length === 0) return 0;
  const stmt = db.prepare(`
    INSERT INTO visitor_events
      (visitor_id, event_type, page_path, product_id, lang, referrer,
       user_agent, ip_country, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const txn = db.transaction((rows) => {
    for (const row of rows) {
      stmt.run(
        ctx.visitorId,
        row.event_type,
        row.page_path,
        row.product_id,
        row.lang,
        row.referrer,
        ctx.userAgent,
        ctx.country,
        row.payload_json,
      );
    }
  });
  try {
    txn(events);
    return events.length;
  } catch (err) {
    logger.error('[track] batch insert failed:', err.message || err);
    return 0;
  }
};

/**
 * Send a 204 No Content response with CORS headers intact. Analytics
 * never wants a body — the SPA fires events and never reads back.
 */
const send204 = (response, origin) => {
  if (response.headersSent || response.writableEnded) return;
  // We reuse createJsonHeaders for the CORS triplet then strip the
  // Content-Type (204 must not have one per RFC 9110).
  const headers = createJsonHeaders(origin);
  delete headers['Content-Type'];
  response.writeHead(204, headers);
  response.end();
};

export const handleTrackEvent = async (request, response, { origin }) => {
  const clientIp = getClientIp(request);
  if (await isTrackEventRateLimited(clientIp)) {
    // Silent 204 even on rate-limit. Analytics is best-effort — we
    // don't want the SPA to retry-storm.
    send204(response, origin);
    return;
  }

  let body;
  try {
    body = await readRequestBody(request);
  } catch {
    send204(response, origin);
    return;
  }

  // Accept either single-event or batch shape. Caller chooses based on
  // queue size at flush time.
  const rawList = Array.isArray(body?.events)
    ? body.events.slice(0, MAX_BATCH)
    : body && typeof body === 'object'
      ? [body]
      : [];

  const normalised = rawList.map(normaliseEvent).filter(Boolean);

  if (normalised.length === 0) {
    send204(response, origin);
    return;
  }

  const db = getDb();
  insertEvents(db, normalised, {
    visitorId: request.visitorId || null,
    userAgent: truncate(request.headers?.['user-agent']),
    country: readCountryHeader(request),
  });

  send204(response, origin);
};
