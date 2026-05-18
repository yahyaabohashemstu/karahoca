import { readRequestBody } from '../middlewares/bodyParser.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { SECURITY_HEADERS, getClientIp, isChatRateLimited, isChatLogRateLimited } from '../middlewares/security.mjs';
import {
  generateAiReply,
  streamAiReply,
  getCachedReply,
  setCachedReply,
  tryPreflightProductSearch,
  extractLastUserUtterance,
} from '../services/aiChat.mjs';
import { generateFollowups } from '../services/aiFollowups.mjs';
import { logUserQuestion } from './admin-ai-knowledge.mjs';
import { handleChatLog as handleChatLogLegacy } from './public-data.mjs';
import { logger } from '../utils/logger.mjs';

/**
 * Build the headers for a Server-Sent Events response.
 *
 * Three things this gets right that a naïve copy of `createJsonHeaders`
 * wouldn't:
 *   1. `Content-Type: text/event-stream` is the only correct value —
 *      anything else (e.g. application/json) makes the browser buffer
 *      the entire body before invoking the response handler, which kills
 *      the perceived-latency win of streaming.
 *   2. `Cache-Control: no-cache, no-transform` defeats both browser
 *      caches AND any intermediate proxy that might collapse chunks.
 *      `no-transform` is the important one for proxies like Cloudflare /
 *      Coolify / Traefik that might otherwise compress on the fly and
 *      stall the stream.
 *   3. `X-Accel-Buffering: no` tells nginx (the karahoca-web reverse
 *      proxy if requests are routed through it) to flush each write
 *      immediately rather than batch them. Without this, nginx waits to
 *      fill a 4-8 KB buffer before forwarding, and a slow / small
 *      response can sit in the buffer for the entire reply duration —
 *      the stream arrives all at once at the end, defeating the point.
 *   The CORS triplet (origin / credentials / vary) is preserved from
 *   `createJsonHeaders` so cross-subdomain calls (karahoca.com →
 *   api.karahoca.com) keep working with cookies attached.
 */
const createSseHeaders = (requestOrigin = '') => {
  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...SECURITY_HEADERS,
  };
  if (requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token, X-Visitor-Id, Accept';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Max-Age'] = '86400';
    headers.Vary = 'Origin';
  }
  return headers;
};

/**
 * Decide whether the client wants a streaming response. Two signals:
 *   - `Accept: text/event-stream` header (the standard / preferred one)
 *   - `?stream=1` query param (escape hatch for clients that can't set
 *     custom headers, e.g. some embedded webviews)
 */
const wantsStream = (request) => {
  const accept = request.headers?.accept || request.headers?.Accept || '';
  if (accept.includes('text/event-stream')) return true;
  const url = request.url || '';
  if (url.includes('stream=1')) return true;
  return false;
};

// ── Contact footer auto-append ──────────────────────────────────────────
//
// Every assistant reply gets a localised "email + WhatsApp" footer
// appended on the server, so the visitor always has one tap to reach
// the team — even on greeting turns, product browses, or any cached
// reply the model produced before the rule was added. We do this in
// the route layer (not the LLM prompt) for two reasons:
//
//   1. Determinism. The model used to be instructed to "always
//      include contact info" but the instruction was treated as
//      conditional ("only when the topic justifies it"). Putting the
//      contact in the SSE stream makes it impossible for a model
//      decision to suppress it.
//
//   2. Clean cache. The cache stores the model's pure reply; the
//      footer is appended on the way OUT, so updating the contact
//      format (e.g. a new WhatsApp number) doesn't require a cache
//      invalidation — every served reply rebuilds the footer.
//
// The WhatsApp link uses wa.me's `?text=` parameter so tapping it
// opens the conversation with a pre-filled message in the visitor's
// language — they just hit Send. Without `?text=`, wa.me opens an
// empty chat and the visitor has to type something cold, which
// loses ~half of intent.
const CONTACT_EMAIL = 'info@karahoca.com';
const CONTACT_WHATSAPP_NUMBER_E164 = '905305914990';
const CONTACT_WHATSAPP_DISPLAY = '+90 530 591 49 90';

// Localised pre-filled WhatsApp message. The visitor lands on
// WhatsApp with this text already typed in the composer so the very
// next action is "Send", not "what do I write?". Keep it short,
// neutral, and useful as a conversation opener — the team can
// branch from here based on what the visitor actually needs.
const WHATSAPP_PREFILLED_MESSAGES = {
  ar: 'أهلاً، أودّ الاستفسار عن منتجات KARAHOCA',
  en: "Hello, I'd like to inquire about KARAHOCA products",
  tr: 'Merhaba, KARAHOCA ürünleri hakkında bilgi almak istiyorum',
  ru: 'Здравствуйте, я хотел бы узнать о продукции KARAHOCA',
};

// `encodeURIComponent` leaves unreserved RFC-3986 marks ( ) ! * ' ~
// alone. We additionally encode the markdown-fragile ones — `(` and
// `)` would prematurely terminate the URL part of a `[…](…)` link
// when the client's `withWhatsAppLinks` regex scans for protected
// regions. Apostrophes and exclamation marks survive markdown fine
// but get encoded for paranoia.
const encodeWhatsAppText = (s) =>
  encodeURIComponent(s).replace(
    /[()'!*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );

const buildWhatsAppUrl = (lang) => {
  const code = (lang || 'ar').toLowerCase();
  const msg = WHATSAPP_PREFILLED_MESSAGES[code] || WHATSAPP_PREFILLED_MESSAGES.ar;
  return `https://wa.me/${CONTACT_WHATSAPP_NUMBER_E164}?text=${encodeWhatsAppText(msg)}`;
};

const buildContactBlock = (lang) => {
  const code = (lang || 'ar').toLowerCase();
  const email = `[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`;
  const wa = `[${CONTACT_WHATSAPP_DISPLAY}](${buildWhatsAppUrl(code)})`;
  switch (code) {
    case 'en':
      return `\n\nEmail: ${email}\nWhatsApp: ${wa}`;
    case 'tr':
      return `\n\nE-posta: ${email}\nWhatsApp: ${wa}`;
    case 'ru':
      return `\n\nЭлектронная почта: ${email}\nWhatsApp: ${wa}`;
    case 'ar':
    default:
      return `\n\nالبريد: ${email}\nواتساب: ${wa}`;
  }
};

/**
 * POST /api/ai/chat
 * Rate limit: 30 req/min per IP.
 *
 * Two response modes:
 *   - Streaming (Accept: text/event-stream): emits SSE events
 *       event: start  data: {}                            // confirms open
 *       event: chunk  data: { "text": "...delta..." }     // 0..N times
 *       event: done   data: { "reply": "<full text>" }    // terminal
 *       event: error  data: { "error": "..." }            // on failure
 *     Cache hits are streamed as a single chunk + done so the client
 *     code path stays identical regardless of cache state.
 *
 *   - JSON (default): returns the legacy `{ success, reply }` shape.
 *     Preserved so server-to-server callers and cURL smoke tests don't
 *     have to grow an SSE parser.
 *
 * Either way: Redis cache is checked first; on miss, OpenRouter is called
 * and the full text is cached for 24 h once the stream completes.
 */
export const handleAiChat = async (request, response, { origin }) => {
  const clientIp = getClientIp(request);
  if (await isChatRateLimited(clientIp)) {
    sendJson(response, 429, { success: false, error: 'Too many requests. Please slow down.' }, origin);
    return;
  }

  const body = await readRequestBody(request);

  // Fire-and-forget: silently log the last user line for knowledge-base mining.
  if (typeof body?.prompt === 'string') {
    const lastLine = body.prompt.split('\n').filter((l) => l.startsWith('User:')).pop();
    if (lastLine) {
      const q = lastLine.replace(/^User:\s*/, '').trim().slice(0, 500);
      logUserQuestion(q, body.lang || 'ar', null);
    }
  }

  const wantStream = wantsStream(request);

  if (wantStream) {
    return handleAiChatStream(response, body, origin);
  }
  return handleAiChatJson(response, body, origin);
};

/**
 * JSON response path. Identical to the pre-streaming behaviour: cache
 * check → on miss, full OpenRouter call → cache → return. The contact
 * footer is appended OUTSIDE the cache so format updates take effect
 * immediately without invalidating warm entries.
 */
const handleAiChatJson = async (response, body, origin) => {
  const lang = body.lang || 'ar';
  const cachedReply = await getCachedReply(body.prompt, lang);
  if (cachedReply) {
    sendJson(
      response,
      200,
      {
        success: true,
        reply: cachedReply + buildContactBlock(lang),
        followups: generateFollowups({
          lastUserText: extractLastUserUtterance(body.prompt),
          assistantReplyText: cachedReply,
          lang,
        }),
      },
      origin,
    );
    return;
  }

  try {
    const promptLen = (body.prompt || '').length;
    const historyLen = Array.isArray(body.history) ? body.history.length : 0;
    logger.info(`[ai-chat] prompt length: ${promptLen} chars, history turns: ${historyLen} (json)`);
    const result = await generateAiReply({
      prompt: body.prompt,
      lang,
      history: body.history,
    });
    if (result?.reply) await setCachedReply(body.prompt, lang, result.reply);
    const payload = result?.reply
      ? {
          ...result,
          reply: result.reply + buildContactBlock(lang),
          followups: generateFollowups({
            lastUserText: extractLastUserUtterance(body.prompt),
            assistantReplyText: result.reply,
            lang,
          }),
        }
      : result;
    sendJson(response, 200, payload, origin);
  } catch (aiErr) {
    logger.error('[ai-chat] generateAiReply failed:', aiErr.message || aiErr);
    sendJson(
      response,
      aiErr.statusCode || 503,
      { success: false, error: 'AI service temporarily unavailable. Please try again.' },
      origin,
    );
  }
};

/**
 * SSE streaming path.
 *
 * `sendEvent` is intentionally synchronous and tolerant of `response.write`
 * back-pressure — Node's HTTP/2-compatible response object queues writes,
 * so we don't need to await each one. We DO check `response.destroyed`
 * before every write so we stop generating tokens when the client closes
 * the socket (saves OpenRouter spend mid-reply).
 *
 * The 'start' event is sent BEFORE we touch OpenRouter so the client can
 * commit its optimistic UI (empty assistant bubble appears immediately)
 * regardless of how slow the first model token is.
 */
const handleAiChatStream = async (response, body, origin) => {
  response.writeHead(200, createSseHeaders(origin));

  const sendEvent = (eventName, data) => {
    if (response.destroyed) return false;
    response.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    // Flush every event immediately. Node's `flushHeaders` only works once,
    // but `response.flush?.()` (when present, e.g. behind compression
    // middleware) signals the wire to push the buffer downstream.
    if (typeof response.flush === 'function') response.flush();
    return true;
  };

  let aborted = false;
  const onClose = () => { aborted = true; };
  response.on('close', onClose);

  try {
    sendEvent('start', {});

    // Cache hit path: collapse into a single-chunk stream so the client
    // never has to special-case cached responses. Identical UX, just no
    // tokens spent.
    //
    // The cache stores ONLY the text reply, not the product attachments.
    // To keep the cached path visually consistent with a fresh stream,
    // we re-run the server-side preflight intent detection against the
    // current prompt and emit a `products` event if the question still
    // shows product intent. Two benefits:
    //   1. Cached visitors still see interactive cards, not just text.
    //   2. The cards reflect the LIVE catalogue — if a product was
    //      renamed / discontinued since the text was cached, the cards
    //      stay accurate even though the prose may drift slightly.
    const cachedReply = await getCachedReply(body.prompt, body.lang || 'ar');
    if (cachedReply) {
      const cachedLang = body.lang || 'ar';
      let cachedAttachments = {};
      try {
        const preflight = tryPreflightProductSearch(body.prompt, cachedLang);
        if (preflight.products.length > 0) {
          cachedAttachments = { products: preflight.products };
          sendEvent('products', { products: preflight.products });
        }
      } catch (preflightErr) {
        logger.error('[ai-chat] cache-hit preflight failed:', preflightErr.message || preflightErr);
      }
      sendEvent('chunk', { text: cachedReply });
      // Auto-append contact footer AFTER the cached body. Streamed as a
      // separate chunk so the visitor sees it slide in like the rest of
      // the response, and included in the final `done.reply` so the
      // client's terminal reconciliation matches what was streamed.
      const contactBlock = buildContactBlock(cachedLang);
      sendEvent('chunk', { text: contactBlock });
      // Follow-up chips for the cached turn. Generated from the
      // visitor's last utterance + the cached reply so the
      // suggestion strip stays contextually accurate even on a
      // 24-hour-old cache entry.
      const cachedFollowups = generateFollowups({
        lastUserText: extractLastUserUtterance(body.prompt),
        assistantReplyText: cachedReply,
        lang: cachedLang,
      });
      sendEvent('done', {
        reply: cachedReply + contactBlock,
        cached: true,
        attachments: cachedAttachments,
        followups: cachedFollowups,
      });
      response.end();
      return;
    }

    const promptLen = (body.prompt || '').length;
    const historyLen = Array.isArray(body.history) ? body.history.length : 0;
    logger.info(`[ai-chat] prompt length: ${promptLen} chars, history turns: ${historyLen} (stream)`);

    const result = await streamAiReply({
      prompt: body.prompt,
      lang: body.lang || 'ar',
      history: body.history,
      onChunk: (chunk) => {
        if (aborted) return;
        sendEvent('chunk', { text: chunk });
      },
      onToolCall: ({ name, attachments }) => {
        if (aborted) return;
        // Emit ONE 'products' event per tool invocation with the rich
        // attachment payload (each product carries id, name, brand,
        // image, weight, url, …). The frontend renders them as inline
        // cards beneath the assistant's text reply.
        // Other tool kinds in the future can emit their own custom
        // events here without breaking the contract — the client's
        // SSE parser already ignores unknown event names.
        if (name === 'search_products' && attachments?.products?.length) {
          sendEvent('products', { products: attachments.products });
        }
      },
    });

    if (!aborted && result?.reply) {
      // Cache the model's PURE reply (no contact footer) once the
      // stream completes. We deliberately do this AFTER the model
      // finishes — caching a partial reply (from a client that
      // disconnected mid-stream) would poison the cache. The cache
      // stores the model output only; the contact footer is appended
      // on the way OUT every request so format changes propagate
      // without invalidating warm entries.
      await setCachedReply(body.prompt, body.lang || 'ar', result.reply);

      // Auto-append the contact footer. Streamed as a final chunk so
      // the visitor sees it slide in at the end of the bubble, and
      // included in `done.reply` so the client's terminal
      // reconciliation matches what was streamed.
      const liveLang = body.lang || 'ar';
      const contactBlock = buildContactBlock(liveLang);
      sendEvent('chunk', { text: contactBlock });

      // Follow-up chips: rule-based 3-phrase set tailored to the
      // visitor's last question + Karo's reply. Same generator as the
      // cache-hit path so the chip strip looks identical regardless
      // of cache state.
      const liveFollowups = generateFollowups({
        lastUserText: extractLastUserUtterance(body.prompt),
        assistantReplyText: result.reply,
        lang: liveLang,
      });

      // The terminal 'done' event includes both the final text and any
      // aggregated attachments so the client can reconcile state if it
      // missed a transient 'products' event (e.g. fast-tab-switch
      // throttling on Chrome / Safari).
      sendEvent('done', {
        reply: result.reply + contactBlock,
        attachments: result.attachments || {},
        followups: liveFollowups,
      });
    }

    response.end();
  } catch (aiErr) {
    logger.error('[ai-chat] streamAiReply failed:', aiErr.message || aiErr);
    if (!response.destroyed) {
      sendEvent('error', {
        error: 'AI service temporarily unavailable. Please try again.',
        statusCode: aiErr.statusCode || 503,
      });
      response.end();
    }
  } finally {
    response.off('close', onClose);
  }
};

/**
 * POST /api/chat/log
 * Rate limit: 20 req/min per IP. Delegates the actual persistence to
 * `public-data.handleChatLog` so the on-disk schema / storage choice stays
 * co-located with the rest of the public-data handlers.
 */
export const handleChatLogRoute = async (request, response, ctx) => {
  const clientIp = getClientIp(request);
  if (await isChatLogRateLimited(clientIp)) {
    sendJson(response, 429, { success: false, error: 'Too many requests.' }, ctx.origin);
    return;
  }

  const body = await readRequestBody(request);
  if (typeof body?.userId !== 'string' || !body.userId.trim() || body.userId.length > 128) {
    sendJson(response, 400, { success: false, error: 'Invalid userId.' }, ctx.origin);
    return;
  }

  await handleChatLogLegacy(request, response, { ...ctx, body });
};
