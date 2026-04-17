/**
 * Application entry point.
 *
 * Responsibilities (only):
 *   1. Boot the database & schedulers.
 *   2. Construct the HTTP server.
 *   3. Route-dispatch to modular handlers under ./routes/*.
 *   4. Graceful shutdown.
 *
 * All business logic lives in ./services/*, all cross-cutting concerns in
 * ./middlewares/*, all endpoints in ./routes/*. This file does NOT import
 * better-sqlite3, ioredis, or any provider SDK directly.
 */
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Routes
import { handleAiChat, handleChatLogRoute } from './routes/api-chat.mjs';
import { handleNewsletterSubscribe, handleNewsletterUnsubscribe } from './routes/api-newsletter.mjs';
import { handleLogError, handleUpload, handleEmailOpen, handleEmailClick } from './routes/api-misc.mjs';
import { handleAdminRoutes } from './routes/api-admin.mjs';
import { serveStaticOrSpa } from './routes/static-spa.mjs';
import { handleSitemap } from './routes/sitemap.mjs';
import { handlePublicProducts, handlePublicNews } from './routes/public-data.mjs';
import { handleHealth } from './routes/api-health.mjs';

// Schedulers
import { startNewsScheduler } from './schedulers/news.mjs';
import { startCampaignSchedulers } from './schedulers/campaigns.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, 'data');
const port = Number.parseInt(process.env.PORT || '5000', 10);

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
    // Placed first so it has the lowest latency and never hits rate limits.
    if (request.method === 'GET' && url === '/api/health') {
      handleHealth(request, response, ctx);
      return;
    }

    // ── Public API ───────────────────────────────────────────────────────
    if (request.method === 'POST' && url === '/api/ai/chat') {
      await handleAiChat(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/newsletter/subscribe') {
      await handleNewsletterSubscribe(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/newsletter/unsubscribe') {
      await handleNewsletterUnsubscribe(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/log-error') {
      await handleLogError(request, response, ctx);
      return;
    }
    if (request.method === 'POST' && url === '/api/chat/log') {
      await handleChatLogRoute(request, response, ctx);
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
      handlePublicProducts(request, response, ctx);
      return;
    }
    if (request.method === 'GET' && url === '/api/news') {
      handlePublicNews(request, response, ctx);
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

    // ── SPA / static fallback ────────────────────────────────────────────
    if (request.method === 'GET') {
      const served = await serveStaticOrSpa(request, response, ctx);
      if (served) return;
    }

    sendJson(response, 404, { success: false, error: 'Route not found.' }, requestOrigin);
  } catch (error) {
    handleServerError(request, response, error, requestOrigin);
  }
};

// ─── Boot ───────────────────────────────────────────────────────────────────
await mkdir(dataDirectory, { recursive: true });
initDb();

const server = createServer(handleRequest);

const newsInterval = startNewsScheduler();
const { dispatchInterval: campaignInterval, queueInterval: campaignQueueInterval } = startCampaignSchedulers();
const backupInterval = startAutoBackup();

server.listen(port, () => {
  console.log('KARAHOCA API server listening on http://localhost:' + port);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`[server] ${signal} received — shutting down gracefully.`);
  clearInterval(newsInterval);
  clearInterval(campaignInterval);
  clearInterval(campaignQueueInterval);
  if (backupInterval) clearInterval(backupInterval);
  server.close(async () => {
    await closeRedis();
    console.log('[server] HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 5s if server.close hangs
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT',  () => { void shutdown('SIGINT'); });
