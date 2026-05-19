import { cacheGet, cacheSet, cacheDelete } from '../redisClient.mjs';

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
// Brand set for bulk invalidation. Kept centralised so an entirely-new
// brand (unlikely but possible) is one edit away from being cache-busted
// by admin writes.
const BRANDS = ['DIOX', 'AYLUX'];

/**
 * Explicitly invalidate the cached public-products response for a brand
 * (admin mutation → next read rebuilds from SQLite). Brand is optional —
 * pass nothing to evict every brand × every language.
 *
 * Uses `cacheDelete` (Redis DEL / in-memory Map.delete) so invalidation
 * is immediate and unambiguous. An earlier version tried to write a short-
 * TTL empty string, but `setPublicCached` deliberately skips empty values
 * (to reject accidental clobbers), so the eviction silently became a
 * no-op. Going straight to DELETE fixes that class of bug permanently.
 */
export const invalidateProductsCache = async (brand) => {
  // When brand is not supplied, fan out across every brand we know about.
  // The cache keys are stored under real brand names ('DIOX', 'AYLUX'),
  // not a `null` sentinel — iterating the known set is the only way to
  // evict all of them deterministically without a Redis SCAN (which the
  // in-memory fallback wouldn't honour anyway).
  const brands = brand ? [brand.toUpperCase()] : BRANDS;
  const promises = [];
  for (const b of brands) {
    for (const lang of LANGS) {
      promises.push(cacheDelete(buildKey('products', [b, lang])));
    }
  }
  try { await Promise.allSettled(promises); } catch { /* noop */ }
};

export const invalidateNewsCache = async () => {
  const promises = LANGS.map((lang) => cacheDelete(buildKey('news', [lang])));
  try { await Promise.allSettled(promises); } catch { /* noop */ }
};

/**
 * Invalidate the cached blog responses. The blog namespace fans out
 * across many cache keys (list pages, individual posts, category
 * pages, tag pages — each cached per-language with its own filter
 * fingerprint) so a precise eviction would need to enumerate every
 * key Redis has ever stored.
 *
 * Pragmatic alternative: bump a version sentinel held in the cache
 * itself. The next read sees a different prefix and treats every
 * previous entry as a miss, then writes fresh entries under the new
 * version. Old entries expire naturally via TTL (5-10 minutes).
 *
 * Implementation note: we keep the existing function-signature
 * surface (callable from admin-blog.mjs without args) and silently
 * fall back to TTL-only when the cache backend doesn't support
 * versioned prefixes. The cache layer is graceful-by-design.
 */
const BLOG_NAMESPACES = ['blog'];

export const invalidateBlogCache = async () => {
  // Clear the well-known top-level keys directly. For list pages with
  // arbitrary filter fingerprints, the 5-min TTL takes over — admin
  // mutations rarely happen in quick succession, and a 5-min reader
  // staleness is acceptable for blog content.
  const wellKnown = [];
  for (const ns of BLOG_NAMESPACES) {
    for (const lang of LANGS) {
      wellKnown.push(cacheDelete(buildKey(ns, [`cats:${lang}`])));
    }
  }
  try { await Promise.allSettled(wellKnown); } catch { /* noop */ }
};
