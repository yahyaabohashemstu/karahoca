import { getDb } from '../services/db.mjs';
import { isRedisConnected } from '../redisClient.mjs';
import { sendJson } from '../middlewares/cors.mjs';

// Track process start time once. `process.uptime()` already returns seconds
// since the Node process started, but we cache the wall-clock timestamp so
// the health payload can expose both pieces of info if we ever need to.
const bootedAt = Date.now();

/**
 * GET /api/health
 *
 * Liveness + readiness probe consumed by Coolify / Docker HEALTHCHECK /
 * any uptime monitor. Checks:
 *   - DB: a trivial `SELECT 1` round-trip. If this throws, the DB file is
 *     missing, corrupted, or the connection was closed.
 *   - Redis: we don't open a new connection per probe — just read the
 *     connection flag that `redisClient.mjs` maintains via ioredis events.
 *     `false` is OK (app auto-falls-back to in-memory) but visible so
 *     dashboards can alert on extended Redis outages.
 *
 * Always returns 200 OK so the container stays "healthy" even if Redis is
 * temporarily degraded (the in-memory fallback keeps the API serving).
 * If you want Coolify to fail the probe on DB loss, change the final
 * status code to 503 when `db === false`.
 */
export const handleHealth = (request, response, ctx = {}) => {
  const origin = ctx.origin || '';

  let dbOk = false;
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 AS ok').get();
    dbOk = row?.ok === 1;
  } catch {
    dbOk = false;
  }

  const redisOk = isRedisConnected();

  const payload = {
    status: dbOk ? 'ok' : 'degraded',
    uptime: process.uptime(),
    bootedAt: new Date(bootedAt).toISOString(),
    db: dbOk,
    redis: redisOk,
    // Build metadata is optional; populate these via env in CI.
    commit: process.env.GIT_COMMIT || null,
    version: process.env.APP_VERSION || null,
  };

  sendJson(response, 200, payload, origin);
};
