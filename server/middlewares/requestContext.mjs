import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { logger as baseLogger } from '../utils/logger.mjs';

// ═══════════════════════════════════════════════════════════════════════════
// Per-request context — AsyncLocalStorage powered
// ─────────────────────────────────────────────────────────────────────────
// Why ALS: the server is hand-rolled http.createServer — there's no
// Express-style `req` object passed through every middleware. Services
// like newsletter.mjs don't receive `req` at all. With ALS, ANY module
// that runs inside a request can call `getLogger()` and receive a child
// logger bound to that request's `reqId` — no prop threading required.
//
// reqId source priority:
//   1. The caller supplied `X-Request-Id` header (useful if an upstream
//      proxy / load balancer already generated one — we propagate rather
//      than rewrite so a single trace spans multiple hops).
//   2. Otherwise: freshly generated UUID v4.
//
// We clamp the incoming value to 128 chars to prevent log-injection via
// absurdly long headers.
// ═══════════════════════════════════════════════════════════════════════════

const storage = new AsyncLocalStorage();

const MAX_INCOMING_ID_LENGTH = 128;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

const sanitizeIncomingId = (raw) => {
  if (typeof raw !== 'string') return null;
  const first = raw.split(',')[0].trim();
  if (!first || first.length > MAX_INCOMING_ID_LENGTH) return null;
  return SAFE_ID_PATTERN.test(first) ? first : null;
};

/**
 * Runs `fn` inside a new request context. Generates (or accepts from the
 * `X-Request-Id` header) a request id, attaches it to the request object,
 * echoes it back in the response, builds a child logger bound to the
 * reqId, and stores both in ALS so downstream `getLogger()` / `getReqId()`
 * calls find them automatically.
 *
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse}  response
 * @param {() => Promise<void> | void} fn
 */
export const runWithRequestContext = (request, response, fn) => {
  const incoming = sanitizeIncomingId(request.headers['x-request-id']);
  const reqId = incoming || randomUUID();

  // Mirror onto the request object so handlers that DO have a handle on
  // `req` can skip the ALS indirection.
  request.id = reqId;
  request.reqId = reqId;

  // Echo back to the client so browser consoles / ErrorBoundary / external
  // integrators can tie their errors to our server-side logs.
  try {
    response.setHeader('X-Request-Id', reqId);
  } catch {
    /* response already flushed (upgraded socket etc.) — silently ignore */
  }

  const childLogger = baseLogger.child({ reqId });
  request.log = childLogger; // pino-http compat

  return storage.run({ reqId, logger: childLogger, startedAt: Date.now() }, fn);
};

/** Returns the current request's id, or `null` if called outside a request. */
export const getReqId = () => storage.getStore()?.reqId || null;

/** Returns the child logger bound to the current request, or the base logger. */
export const getLogger = () => storage.getStore()?.logger || baseLogger;

/** Returns the millisecond timestamp when the current request started. */
export const getRequestStartedAt = () => storage.getStore()?.startedAt || null;

/** For tests / advanced callers: the raw ALS instance. */
export const requestContextStorage = storage;
