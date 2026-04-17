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
 * any uptime monitor.
 *
 * Probes:
 *   - DB:    a trivial `SELECT 1` round-trip against better-sqlite3. If this
 *            throws OR returns an unexpected value, the DB file is missing,
 *            corrupted, locked, or the connection was closed.
 *   - Redis: read the connection flag that `redisClient.mjs` maintains via
 *            ioredis events. Redis is a non-critical dependency (we auto-
 *            fall-back to an in-memory store for rate limiting, caching,
 *            queue). Its state is reported but does NOT gate the probe.
 *
 * Status codes:
 *   - 200 OK                : DB healthy (regardless of Redis state).
 *   - 503 Service Unavailable: DB probe failed — orchestrator should treat
 *                              this container as unhealthy and reroute
 *                              traffic / restart as configured.
 *
 * Rationale for fail-closed on DB only: without the DB, every user-facing
 * read (products, news, chat log, admin) and every write is broken — serving
 * traffic is worse than being removed from the load balancer. Redis being
 * down only degrades performance, not correctness, so we stay healthy.
 */
export const handleHealth = (request, response, ctx = {}) => {
  const origin = ctx.origin || '';

  let dbOk = false;
  let dbError = null;
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 AS ok').get();
    dbOk = row?.ok === 1;
    if (!dbOk) dbError = 'sqlite returned unexpected shape';
  } catch (err) {
    dbOk = false;
    // Expose the error CLASS (e.g. "SqliteError") but not the full message —
    // health payloads are publicly reachable; we don't want to leak file
    // paths or schema hints. Class name is enough for ops triage.
    dbError = err?.name || 'unknown';
  }

  const redisOk = isRedisConnected();

  const statusCode = dbOk ? 200 : 503;
  const payload = {
    status: dbOk ? 'ok' : 'unhealthy',
    uptime: process.uptime(),
    bootedAt: new Date(bootedAt).toISOString(),
    db: dbOk,
    dbError: dbOk ? null : dbError,
    redis: redisOk,
    // Build metadata is optional; populate these via env in CI.
    commit: process.env.GIT_COMMIT || null,
    version: process.env.APP_VERSION || null,
  };

  sendJson(response, statusCode, payload, origin);
};
