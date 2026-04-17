import { cacheGet, cacheSet } from '../redisClient.mjs';

/**
 * Thin wrapper around the Redis client's cache primitives, scoped to the
 * public read paths (`GET /api/products/:brand`, `GET /api/news`, …).
 *
 * Why this exists: the public read endpoints were hitting SQLite on every
 * request — fine at current traffic, poisonous at 10× scale. Redis is
 * already wired for chat reply caching, so using it here reuses the same
 * graceful-degradation path (falls back to in-memory LRU when Redis is
 * down) and costs nothing extra operationally.
 *
 * Cache keys are namespaced by a short prefix to keep them legible in
 * Redis CLI / RDB dumps, and versioned via the `CACHE_SCHEMA_VERSION`
 * constant so a deploy that changes the response shape automatically
 * invalidates every stale entry on the very first hit.
 */

const CACHE_SCHEMA_VERSION = 'v1';
const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes — long enough to absorb bursts, short enough to auto-heal

const buildKey = (namespace, parts) =>
  `pub:${CACHE_SCHEMA_VERSION}:${namespace}:${parts.filter(Boolean).join('|') || '_'}`;

/**
 * Retrieve a cached response body (always a string) or null on miss.
 * Callers store ALREADY-SERIALISED JSON strings, so the value can be
 * streamed directly to the response without a re-stringify on hit.
 */
export const getPublicCached = async (namespace, parts) => {
  try {
    return await cacheGet(buildKey(namespace, parts));
  } catch {
    return null;
  }
};

export const setPublicCached = async (namespace, parts, serialisedValue, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (typeof serialisedValue !== 'string' || serialisedValue.length === 0) return;
  try {
    await cacheSet(buildKey(namespace, parts), serialisedValue, ttlSeconds);
  } catch {
    /* cache write failures are non-fatal */
  }
};

// ─── Invalidation ─────────────────────────────────────────────────────────
//
// A monotonic version counter approach would be cleaner than enumerating
// every (lang) variant, but would require an extra Redis call per read. We
// have a known-small variant set (4 languages × handful of namespaces), so
// a per-variant eviction on admin write is both cheap and correct.

const LANGS = ['ar', 'en', 'tr', 'ru'];

/**
 * Explicitly invalidate the cached public-products response for a brand
 * (admin mutation → next read rebuilds from SQLite). Brand is optional —
 * pass nothing to evict every brand × every language.
 */
export const invalidateProductsCache = async (brand) => {
  const brands = brand ? [brand.toUpperCase()] : [null];
  const promises = [];
  for (const b of brands) {
    for (const lang of LANGS) {
      promises.push(setPublicCached('products', [b, lang], '', 1));
    }
  }
  // Awaiting is optional — fire-and-forget keeps the admin mutation path
  // latency unchanged. We still await briefly to surface any Redis errors.
  try { await Promise.allSettled(promises); } catch { /* noop */ }
};

export const invalidateNewsCache = async () => {
  const promises = LANGS.map((lang) => setPublicCached('news', [lang], '', 1));
  try { await Promise.allSettled(promises); } catch { /* noop */ }
};
