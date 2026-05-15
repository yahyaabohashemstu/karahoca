import { readRequestBody } from '../middlewares/bodyParser.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { SECURITY_HEADERS, getClientIp, isChatRateLimited, isChatLogRateLimited } from '../middlewares/security.mjs';
import {
  generateAiReply,
  streamAiReply,
  getCachedReply,
  setCachedReply,
  tryPreflightProductSearch,
} from '../services/aiChat.mjs';
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
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token, Accept';
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
 * check → on miss, full OpenRouter call → cache → return.
 */
const handleAiChatJson = async (response, body, origin) => {
  const cachedReply = await getCachedReply(body.prompt, body.lang || 'ar');
  if (cachedReply) {
    sendJson(response, 200, { success: true, reply: cachedReply }, origin);
    return;
  }

  try {
    const promptLen = (body.prompt || '').length;
    const historyLen = Array.isArray(body.history) ? body.history.length : 0;
    logger.info(`[ai-chat] prompt length: ${promptLen} chars, history turns: ${historyLen} (json)`);
    const result = await generateAiReply({
      prompt: body.prompt,
      lang: body.lang || 'ar',
      history: body.history,
    });
    if (result?.reply) await setCachedReply(body.prompt, body.lang || 'ar', result.reply);
    sendJson(response, 200, result, origin);
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
      sendEvent('done', { reply: cachedReply, cached: true, attachments: cachedAttachments });
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
      // Cache the full reply once the stream completes. We deliberately
      // do this AFTER the model finishes — caching a partial reply (from
      // a client that disconnected mid-stream) would poison the cache.
      await setCachedReply(body.prompt, body.lang || 'ar', result.reply);
      // The terminal 'done' event includes both the final text and any
      // aggregated attachments so the client can reconcile state if it
      // missed a transient 'products' event (e.g. fast-tab-switch
      // throttling on Chrome / Safari).
      sendEvent('done', {
        reply: result.reply,
        attachments: result.attachments || {},
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
