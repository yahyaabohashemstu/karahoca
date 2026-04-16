/**
 * Redis Client with Graceful Degradation
 * ========================================
 * Provides cache and rate-limiting primitives backed by Redis.
 * If Redis is unavailable (connection refused, timeout, crash), every
 * method silently falls back to an in-memory Map so the API never
 * crashes. A warning is logged once when the fallback activates.
 *
 * Env:  REDIS_URL  (default: redis://localhost:6379)
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// ─── State ──────────────────────────────────────────────────────────────────
let redis = null;
let redisAvailable = false;
let fallbackWarned = false;

// In-memory fallback stores (used ONLY when Redis is down)
const memCache = new Map();   // key → { value, expiresAt }
const memCounters = new Map(); // key → { count, expiresAt }

// ─── Initialize Redis ───────────────────────────────────────────────────────
try {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // Retry with backoff, give up after 10 attempts (then reconnect later)
      if (times > 10) return null;
      return Math.min(times * 200, 5000);
    },
    lazyConnect: false,
    enableOfflineQueue: false,
    connectTimeout: 5000,
  });

  redis.on('connect', () => {
    redisAvailable = true;
    fallbackWarned = false;
    console.log('[redis] Connected to', REDIS_URL);
  });

  redis.on('ready', () => {
    redisAvailable = true;
  });

  redis.on('error', (err) => {
    if (redisAvailable) {
      console.warn('[redis] Connection lost:', err.message);
    }
    redisAvailable = false;
    warnFallback();
  });

  redis.on('close', () => {
    redisAvailable = false;
  });

  redis.on('reconnecting', () => {
    console.log('[redis] Reconnecting...');
  });
} catch (err) {
  console.warn('[redis] Failed to initialize:', err.message);
  redisAvailable = false;
  warnFallback();
}

function warnFallback() {
  if (!fallbackWarned) {
    fallbackWarned = true;
    console.warn('[redis] Falling back to in-memory storage. Rate limits and cache will not persist across restarts.');
  }
}

// ─── Memory fallback: auto-prune expired entries every 5 min ────────────────
const pruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memCache) {
    if (now > v.expiresAt) memCache.delete(k);
  }
  for (const [k, v] of memCounters) {
    if (now > v.expiresAt) memCounters.delete(k);
  }
}, 300_000);
pruneInterval.unref();

// ─── Cache: GET / SET with TTL ──────────────────────────────────────────────

/**
 * Retrieve a cached value by key.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function cacheGet(key) {
  if (redisAvailable) {
    try {
      return await redis.get(key);
    } catch {
      // Redis command failed — fall through to memory
    }
  }
  // Memory fallback
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Store a value with a TTL (seconds).
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds
 * @returns {Promise<void>}
 */
export async function cacheSet(key, value, ttlSeconds) {
  if (redisAvailable) {
    try {
      await redis.setex(key, ttlSeconds, value);
      return;
    } catch {
      // fall through
    }
  }
  // Memory fallback
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  // Enforce cap to prevent memory exhaustion
  if (memCache.size > 1000) {
    const firstKey = memCache.keys().next().value;
    memCache.delete(firstKey);
  }
}

// ─── Rate Limiter: Atomic counter with sliding window ───────────────────────

/**
 * Check if an action is rate-limited and increment the counter atomically.
 * @param {string} key       Full Redis key (e.g., "rl:chat:192.168.1.1")
 * @param {number} limit     Max allowed requests in the window
 * @param {number} windowSec Window duration in seconds
 * @returns {Promise<boolean>} true if rate-limited (over the limit)
 */
export async function isRateLimited(key, limit, windowSec) {
  if (redisAvailable) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        // First request in this window — set expiry
        await redis.expire(key, windowSec);
      }
      return count > limit;
    } catch {
      // fall through
    }
  }
  // Memory fallback
  const now = Date.now();
  const rec = memCounters.get(key);
  if (!rec || now > rec.expiresAt) {
    // Enforce cap
    if (memCounters.size >= 10_000) {
      const firstKey = memCounters.keys().next().value;
      memCounters.delete(firstKey);
    }
    memCounters.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
    return false;
  }
  rec.count++;
  return rec.count > limit;
}

/**
 * Reset a rate-limit counter (e.g., after successful login).
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function resetRateLimit(key) {
  if (redisAvailable) {
    try {
      await redis.del(key);
      return;
    } catch {
      // fall through
    }
  }
  memCounters.delete(key);
}

/**
 * Whether Redis is currently connected.
 * Useful for health-check endpoints.
 */
export function isRedisConnected() {
  return redisAvailable;
}

export async function closeRedis() {
  clearInterval(pruneInterval);

  if (!redis) return;

  try {
    await redis.quit();
  } catch {
    try {
      redis.disconnect();
    } catch {
      // Ignore shutdown failures.
    }
  }
}
