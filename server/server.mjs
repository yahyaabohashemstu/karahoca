/**
 * Application entry point.
 *
 * Responsibilities (only):
 *   1. Init Sentry (if DSN present) — MUST happen before any route module
 *      does real work, so unhandled exceptions during boot are captured.
 *   2. Boot the database & schedulers.
 *   3. Construct the HTTP server and wrap every request in:
 *      - Sentry's request-scope span (if enabled)
 *      - AsyncLocalStorage request-context (reqId, child logger)
 *      - pino-http auto-logging (start / end / duration)
 *   4. Dispatch to modular route handlers under ./routes/*.
 *   5. Graceful shutdown.
 *
 * All business logic lives in ./services/*, all cross-cutting concerns in
 * ./middlewares/*, all endpoints in ./routes/*. This file does NOT import
 * better-sqlite3, ioredis, or any provider SDK directly.
 */
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pinoHttp from 'pino-http';

// Logging / request context
import { logger, logStartup } from './utils/logger.mjs';
import { runWithRequestContext } from './middlewares/requestContext.mjs';

// Services
import { initDb } from './services/db.mjs';
import { closeRedis } from './redisClient.mjs';
import { startAutoBackup } from './backup.mjs';

// Middlewares
import {
  createJsonHeaders,
  getRequestOrigin,
  getRequestHostOrigin,
  isOriginAllowed,
  sendJson,
} from './middlewares/cors.mjs';
import { handleServerError } from './middlewares/errorHandler.mjs';
import { requirePublicCsrfToken } from './middlewares/publicCsrf.mjs';

// Routes
import { handleAiChat, handleChatLogRoute, handleAiWelcome } from './routes/api-chat.mjs';
import { handleTrackEvent } from './routes/api-track.mjs';
import { handleNewsletterSubscribe, handleNewsletterUnsubscribe } from './routes/api-newsletter.mjs';
import { handleLogError, handleUpload, handleEmailOpen, handleEmailClick } from './routes/api-misc.mjs';
import { handleAdminRoutes } from './routes/api-admin.mjs';
import { handleSitemap } from './routes/sitemap.mjs';
import { handleProductOg, handleBrandOg } from './routes/og.mjs';
import { ensurePublicCsrfCookie } from './middlewares/publicCsrf.mjs';
import { resolveVisitorId } from './middlewares/visitorIdentity.mjs';
import { handlePublicProducts, handlePublicNews } from './routes/public-data.mjs';
import { handleHealth } from './routes/api-health.mjs';
import { handleAiContext } from './routes/api-ai-context.mjs';

// Schedulers
import { startNewsScheduler } from './schedulers/news.mjs';
import { startCampaignSchedulers } from './schedulers/campaigns.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, 'data');
const port = Number.parseInt(process.env.PORT || '5000', 10);

// ─── Sentry (optional) ──────────────────────────────────────────────────────
// Gated behind SENTRY_DSN so absence is a no-op. Exposed on a well-known
// global so errorHandler.mjs can `captureException` without creating an
// import cycle or paying to load @sentry/node when telemetry is disabled.
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || undefined,
      tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: Number.parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0'),
    });
    globalThis.__karahocaSentry = Sentry;
    logger.info({ environment: process.env.NODE_ENV }, '[sentry] node SDK initialized');
  } catch (e) {
    logger.warn({ err: e }, '[sentry] failed to initialize — continuing without telemetry');
  }
} else {
  logger.debug('[sentry] SENTRY_DSN not set — telemetry disabled');
}

// ─── pino-http (request lifecycle logging) ─────────────────────────────────
// Emits a line at req start and another at res finish with status + duration.
// `genReqId` reads our ALS-populated `req.id` first (set by
// runWithRequestContext) so log lines stay correlated end-to-end.
const httpLog = pinoHttp({
  logger,
  genReqId: (req) => req.id, // already populated by runWithRequestContext
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: logger.levels ? undefined : undefined, // inherit from base logger
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} → ${res.statusCode} (${err?.message || 'error'})`,
});

// ─── Request handler ────────────────────────────────────────────────────────
const handleRequest = async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { success: false, error: 'Missing request URL.' });
    return;
  }

  const requestOrigin = getRequestOrigin(request);
  const requestHostOrigin = getRequestHostOrigin(request);
  const originAllowed = isOriginAllowed(requestOrigin, requestHostOrigin);
  const url = request.url.split('?')[0];
  // Existing admin route handlers (admin-auth.mjs, admin-*.mjs) destructure
  // `sendJson` from ctx — keep it there so they continue to work without a
  // call-site sweep. Importing sendJson from middlewares/cors.mjs directly
  // is the new preferred style.
  const ctx = { origin: requestOrigin, url, sendJson };

  // CORS preflight
  if (request.method === 'OPTIONS') {
    if (!originAllowed) {
      sendJson(response, 403, { success: false, error: 'Origin is not allowed.' });
      return;
    }
    response.writeHead(204, createJsonHeaders(requestOrigin));
    response.end();
    return;
  }

  // Block cross-origin writes from disallowed origins.
  if (
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') &&
    !originAllowed
  ) {
    sendJson(response, 403, { success: false, error: 'Origin is not allowed.' }, requestOrigin);
    return;
  }

  try {
    // ── Health probe (Coolify / Docker HEALTHCHECK / uptime monitors) ───
    // Placed first so it has the lowest latency; internally rate-limited
    // so unbounded probes don't become an amplification channel.
    if (request.method === 'GET' && url === '/api/health') {
      await handleHealth(request, response, ctx);
      return;
    }

    // ── Public API ───────────────────────────────────────────────────────
    // State-changing public routes are gated by double-submit CSRF (public
    // cookie issued by the SPA fallback handler). GET endpoints (product
    // catalog, news, sitemap, etc.) skip this check — they are safe reads.
    //
    // EXCEPTION: /api/ai/chat. The CSRF cookie is host-only (api.karahoca.com)
    // and SOME browsers (Safari ITP, Brave, Firefox-Enhanced-Tracking,
    // Chrome with third-party cookies disabled) silently block setting it
    // when the document is on karahoca.com — there is no signal back to
    // the SPA, the cookie just never appears in document.cookie. Result:
    // the chat widget would 403 on first message for every such visitor.
    // Setting `Domain=.karahoca.com` (via COOKIE_DOMAIN env var) fixes it
    // for most cases, but third-party-cookie-blocking users still lose.
    //
    // The endpoint is anonymous, has no privileged session, and is rate-
    // limited (30 req/min per IP). The Origin allow-list (enforced above
    // via originAllowed for POST/PUT/DELETE) already blocks cross-site
    // forgery from foreign sites — CSRF protection here is redundant
    // defence against an attack vector the Origin check already kills.
    // So we exempt it: every visitor gets to chat, no cookie dance needed.
    if (request.method === 'POST' && url === '/api/ai/chat') {
      await handleAiChat(request, response, ctx);
      return;
    }
    if (request.method === 'GET' && url === '/api/ai/context') {
      handleAiContext(request, response, ctx);
      return;
    }
    // Returning-visitor recognition. Read-only, soft-authenticated by
    // the X-Visitor-Id header (only the original browser holds the
    // cookie). The handler is null-safe when the header is missing.
    if (request.method === 'GET' && url.startsWith('/api/ai/welcome')) {
      handleAiWelcome(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/newsletter/subscribe') {
      if (!requirePublicCsrfToken(request, response, requestOrigin)) return;
      await handleNewsletterSubscribe(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/newsletter/unsubscribe') {
      // Unsubscribe is deliberately exempt from CSRF: the unsubscribe
      // token itself is an unguessable server-issued secret delivered via
      // email, so possession of the token IS the authorization. Requiring
      // an additional CSRF token would break one-click unsubscribe links.
      await handleNewsletterUnsubscribe(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/log-error') {
      if (!requirePublicCsrfToken(request, response, requestOrigin)) return;
      await handleLogError(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/chat/log') {
      if (!requirePublicCsrfToken(request, response, requestOrigin)) return;
      await handleChatLogRoute(request, response, ctx);
      return;
    }
    // Visitor analytics ingest. Two URLs, same handler — the SPA picks
    // /events for batch flushes and /event for synchronous single-shot
    // beacons (e.g. last-event-before-unload via sendBeacon). CSRF
    // required: same defence-in-depth as the chat log.
    if (request.method === 'POST' && (url === '/api/track/event' || url === '/api/track/events')) {
      if (!requirePublicCsrfToken(request, response, requestOrigin)) return;
      await handleTrackEvent(request, response, ctx);
      return;
    }
    if (request.method === 'GET' && url.startsWith('/api/uploads/')) {
      await handleUpload(request, response, ctx);
      return;
    }
    if (request.method === 'GET' && url === '/api/email/open') {
      handleEmailOpen(request, response);
      return;
    }
    if (request.method === 'GET' && url.startsWith('/api/email/click')) {
      handleEmailClick(request, response);
      return;
    }
    if (request.method === 'GET' && url.startsWith('/api/products/')) {
      await handlePublicProducts(request, response, ctx);
      return;
    }
    if (request.method === 'GET' && url === '/api/news') {
      await handlePublicNews(request, response, ctx);
      return;
    }

    // ── Admin API (login/logout public, rest auth-gated) ─────────────────
    if (url === '/api/admin/login' || url === '/api/admin/logout' || url.startsWith('/api/admin/')) {
      const handled = await handleAdminRoutes(request, response, ctx);
      if (handled) return;
    }

    // ── SEO ──────────────────────────────────────────────────────────────
    if (request.method === 'GET' && url === '/sitemap.xml') {
      handleSitemap(request, response);
      return;
    }
    // Per-product / per-brand OG (Open Graph) share cards.
    // GET /og/product/{id}-{lang}.png and /og/brand/{brand}-{lang}.png.
    // Both are anonymous, image/png responses cached at the CDN for 30 d.
    if (request.method === 'GET' && url.startsWith('/og/product/')) {
      await handleProductOg(request, response, ctx);
      return;
    }
    if (request.method === 'GET' && url.startsWith('/og/brand/')) {
      await handleBrandOg(request, response, ctx);
      return;
    }

    // ── CSRF cookie issuer ──────────────────────────────────────────────
    // Replaces the SPA-HTML cookie seeding now that the frontend is served
    // by a separate nginx image. The SPA hits this on boot (with
    // credentials:'include') so that its first POST has a token to echo.
    if (request.method === 'GET' && url === '/api/csrf') {
      const baseHeaders = createJsonHeaders(requestOrigin);
      const { token, headers } = ensurePublicCsrfCookie(request, baseHeaders);
      response.writeHead(200, headers);
      response.end(JSON.stringify({ success: true, token }));
      return;
    }

    sendJson(response, 404, { success: false, error: 'Route not found.' }, requestOrigin);
  } catch (error) {
    handleServerError(request, response, error, requestOrigin);
  }
};

// ─── Boot ───────────────────────────────────────────────────────────────────
await mkdir(dataDirectory, { recursive: true });
initDb();

const server = createServer((req, res) => {
  // 1. Install reqId + child logger (AsyncLocalStorage). Everything below
  //    runs inside that context — any getLogger() call downstream resolves
  //    to this request's child logger.
  runWithRequestContext(req, res, () => {
    // 2. pino-http wires req.log + auto-emits start/end lines.
    httpLog(req, res);
    // 3. Resolve the visitor anchor (header > cookie > null) and attach
    //    it to `req` before any route runs. Routes that care read
    //    `req.visitorId`; routes that don't are unaffected. Cheap O(1).
    resolveVisitorId(req);
    // 4. Hand off to the router. Async errors propagate to handleServerError
    //    via the try/catch in handleRequest().
    void handleRequest(req, res);
  });
});

const newsInterval = startNewsScheduler();
const { dispatchInterval: campaignInterval, queueInterval: campaignQueueInterval } = startCampaignSchedulers();
const backupInterval = startAutoBackup();

server.listen(port, () => {
  logStartup({ port });
  logger.info({ port }, `KARAHOCA API server listening on http://localhost:${port}`);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info({ signal }, '[server] signal received — shutting down gracefully');
  clearInterval(newsInterval);
  clearInterval(campaignInterval);
  clearInterval(campaignQueueInterval);
  if (backupInterval) clearInterval(backupInterval);

  // Flush Sentry before we exit, so the final error (if any) is recorded.
  const sentry = globalThis.__karahocaSentry;
  if (sentry && typeof sentry.close === 'function') {
    try { await sentry.close(2000); } catch { /* best-effort */ }
  }

  server.close(async () => {
    await closeRedis();
    logger.info('[server] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s if server.close hangs
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT',  () => { void shutdown('SIGINT'); });

// Catch-all for unhandled promise rejections — these bypass try/catch and
// would otherwise crash the process silently. We log + forward to Sentry.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, '[process] unhandledRejection');
  const sentry = globalThis.__karahocaSentry;
  if (sentry && typeof sentry.captureException === 'function') {
    try { sentry.captureException(reason); } catch { /* */ }
  }
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '[process] uncaughtException');
  const sentry = globalThis.__karahocaSentry;
  if (sentry && typeof sentry.captureException === 'function') {
    try { sentry.captureException(err); } catch { /* */ }
  }
  // Exit on uncaughtException — the process state is untrusted. Coolify
  // restarts the container; pino-http last line will already be flushed.
  setTimeout(() => process.exit(1), 1000).unref();
});
