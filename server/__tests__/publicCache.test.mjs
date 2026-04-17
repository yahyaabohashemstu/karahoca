/**
 * Tests for server/services/publicCache.mjs
 * ==========================================
 * Verifies cache read/write, invalidation fan-out, and the TTL contract
 * between set/get. All backed by the in-memory fallback inside
 * redisClient.mjs (no real Redis required).
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Force Redis fallback for deterministic test behavior.
process.env.REDIS_URL = 'redis://127.0.0.1:1';

const {
  getPublicCached,
  setPublicCached,
  invalidateProductsCache,
  invalidateNewsCache,
} = await import('../services/publicCache.mjs');


describe('publicCache — basic get/set round-trip', () => {
  beforeEach(async () => {
    await invalidateProductsCache();
    await invalidateNewsCache();
  });

  it('stores and retrieves a value by namespace + parts', async () => {
    await setPublicCached('products', ['DIOX', 'en'], '{"ok":true}', 60);
    const value = await getPublicCached('products', ['DIOX', 'en']);
    expect(value).toBe('{"ok":true}');
  });

  it('distinguishes values by namespace parts (brand × lang)', async () => {
    await setPublicCached('products', ['DIOX', 'en'], '{"diox":1}', 60);
    await setPublicCached('products', ['AYLUX', 'en'], '{"aylux":1}', 60);

    expect(await getPublicCached('products', ['DIOX', 'en'])).toBe('{"diox":1}');
    expect(await getPublicCached('products', ['AYLUX', 'en'])).toBe('{"aylux":1}');
  });

  it('returns null for unknown keys', async () => {
    const value = await getPublicCached('products', ['GHOST', 'en']);
    expect(value).toBe(null);
  });

  it('ignores empty serialised values on write', async () => {
    await setPublicCached('products', ['DIOX', 'ar'], '', 60);
    const value = await getPublicCached('products', ['DIOX', 'ar']);
    expect(value).toBe(null);
  });
});

describe('publicCache — invalidation', () => {
  beforeEach(async () => {
    await invalidateProductsCache();
    await invalidateNewsCache();
  });

  it('invalidateProductsCache(brand) evicts every language for that brand', async () => {
    for (const lang of ['ar', 'en', 'tr', 'ru']) {
      await setPublicCached('products', ['DIOX', lang], `{"lang":"${lang}"}`, 60);
      await setPublicCached('products', ['AYLUX', lang], `{"lang":"${lang}"}`, 60);
    }

    await invalidateProductsCache('DIOX');
    // invalidation runs a short-TTL overwrite; give it a beat to settle.
    // invalidation is synchronous now that it uses DEL, but we still
    // await the Promise.allSettled inside the invalidator.

    for (const lang of ['ar', 'en', 'tr', 'ru']) {
      expect(await getPublicCached('products', ['DIOX', lang])).toBe(null);
      // AYLUX entries for the same languages should survive a DIOX-scoped
      // invalidation.
      expect(await getPublicCached('products', ['AYLUX', lang])).toBe(`{"lang":"${lang}"}`);
    }
  });

  it('invalidateProductsCache() with no brand evicts every brand × language', async () => {
    for (const brand of ['DIOX', 'AYLUX']) {
      for (const lang of ['ar', 'en', 'tr', 'ru']) {
        await setPublicCached('products', [brand, lang], 'x', 60);
      }
    }

    await invalidateProductsCache();
    // invalidation is synchronous now that it uses DEL, but we still
    // await the Promise.allSettled inside the invalidator.

    for (const brand of ['DIOX', 'AYLUX']) {
      for (const lang of ['ar', 'en', 'tr', 'ru']) {
        expect(await getPublicCached('products', [brand, lang])).toBe(null);
      }
    }
  });

  it('invalidateNewsCache evicts every language but leaves products alone', async () => {
    for (const lang of ['ar', 'en', 'tr', 'ru']) {
      await setPublicCached('news', [lang], 'news', 60);
    }
    await setPublicCached('products', ['DIOX', 'en'], 'prod', 60);

    await invalidateNewsCache();
    // invalidation is synchronous now that it uses DEL, but we still
    // await the Promise.allSettled inside the invalidator.

    for (const lang of ['ar', 'en', 'tr', 'ru']) {
      expect(await getPublicCached('news', [lang])).toBe(null);
    }
    expect(await getPublicCached('products', ['DIOX', 'en'])).toBe('prod');
  });
});
