/**
 * Tests for server/redisClient.mjs
 * =================================
 * Validates the cache and rate-limiting primitives work correctly
 * in fallback (in-memory) mode. Redis is NOT required for these tests.
 *
 * What's tested:
 * - cacheGet / cacheSet: store, retrieve, TTL expiry, key isolation
 * - isRateLimited: counter increment, threshold enforcement, window expiry
 * - resetRateLimit: counter reset after successful action
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Force Redis to be unavailable so we test the in-memory fallback path.
// We set REDIS_URL to an unreachable address BEFORE importing the module.
process.env.REDIS_URL = 'redis://127.0.0.1:1'; // port 1 will always refuse connections

const { cacheGet, cacheSet, isRateLimited, resetRateLimit } = await import('../redisClient.mjs');

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── cacheGet / cacheSet ────────────────────────────────────────────────────
describe('Cache (in-memory fallback)', () => {
  const prefix = `test_cache_${Date.now()}`;

  it('returns null for a key that was never set', async () => {
    const result = await cacheGet(`${prefix}:nonexistent`);
    expect(result).toBeNull();
  });

  it('stores and retrieves a value', async () => {
    const key = `${prefix}:greeting`;
    await cacheSet(key, 'hello world', 60);
    const result = await cacheGet(key);
    expect(result).toBe('hello world');
  });

  it('isolates keys — different keys return different values', async () => {
    await cacheSet(`${prefix}:a`, 'alpha', 60);
    await cacheSet(`${prefix}:b`, 'beta', 60);
    expect(await cacheGet(`${prefix}:a`)).toBe('alpha');
    expect(await cacheGet(`${prefix}:b`)).toBe('beta');
  });

  it('respects TTL — expired entries return null', async () => {
    const key = `${prefix}:short_lived`;
    await cacheSet(key, 'ephemeral', 1); // 1-second TTL
    // Immediately should be present
    expect(await cacheGet(key)).toBe('ephemeral');
    // After the TTL expires
    await sleep(1100);
    expect(await cacheGet(key)).toBeNull();
  });

  it('overwrites an existing key with a new value', async () => {
    const key = `${prefix}:overwrite`;
    await cacheSet(key, 'original', 60);
    await cacheSet(key, 'updated', 60);
    expect(await cacheGet(key)).toBe('updated');
  });
});

// ─── isRateLimited ──────────────────────────────────────────────────────────
describe('Rate Limiter (in-memory fallback)', () => {
  const prefix = `test_rl_${Date.now()}`;

  it('allows requests up to the limit', async () => {
    const key = `${prefix}:allow`;
    const limit = 3;
    const windowSec = 60;

    // Requests 1, 2, 3 should NOT be limited
    expect(await isRateLimited(key, limit, windowSec)).toBe(false); // 1
    expect(await isRateLimited(key, limit, windowSec)).toBe(false); // 2
    expect(await isRateLimited(key, limit, windowSec)).toBe(false); // 3
  });

  it('blocks requests exceeding the limit', async () => {
    const key = `${prefix}:block`;
    const limit = 3;
    const windowSec = 60;

    // Exhaust the limit
    await isRateLimited(key, limit, windowSec); // 1
    await isRateLimited(key, limit, windowSec); // 2
    await isRateLimited(key, limit, windowSec); // 3

    // Request 4 should be BLOCKED
    expect(await isRateLimited(key, limit, windowSec)).toBe(true);
    // Request 5 should still be blocked
    expect(await isRateLimited(key, limit, windowSec)).toBe(true);
  });

  it('isolates different keys — separate counters', async () => {
    const keyA = `${prefix}:isolated_a`;
    const keyB = `${prefix}:isolated_b`;
    const limit = 2;
    const windowSec = 60;

    // Exhaust key A
    await isRateLimited(keyA, limit, windowSec); // A: 1
    await isRateLimited(keyA, limit, windowSec); // A: 2
    expect(await isRateLimited(keyA, limit, windowSec)).toBe(true); // A: blocked

    // Key B should be unaffected
    expect(await isRateLimited(keyB, limit, windowSec)).toBe(false); // B: 1
  });

  it('resets after the window expires', async () => {
    const key = `${prefix}:expire`;
    const limit = 2;
    const windowSec = 1; // 1-second window

    // Exhaust the limit
    await isRateLimited(key, limit, windowSec); // 1
    await isRateLimited(key, limit, windowSec); // 2
    expect(await isRateLimited(key, limit, windowSec)).toBe(true); // blocked

    // Wait for window to expire
    await sleep(1100);

    // Should be allowed again
    expect(await isRateLimited(key, limit, windowSec)).toBe(false);
  });

  it('simulates the chat rate limit scenario (30 req/60s)', async () => {
    const key = `${prefix}:chat_sim`;
    const CHAT_LIMIT = 30;
    const CHAT_WINDOW_SEC = 60;

    // Fire 30 requests — all should pass
    for (let i = 0; i < CHAT_LIMIT; i++) {
      expect(await isRateLimited(key, CHAT_LIMIT, CHAT_WINDOW_SEC)).toBe(false);
    }
    // Request 31 should be blocked
    expect(await isRateLimited(key, CHAT_LIMIT, CHAT_WINDOW_SEC)).toBe(true);
  });

  it('simulates the admin login limit scenario (5 req/15min)', async () => {
    const key = `${prefix}:login_sim`;
    const LOGIN_LIMIT = 5;
    const LOGIN_WINDOW_SEC = 900; // 15 minutes

    for (let i = 0; i < LOGIN_LIMIT; i++) {
      expect(await isRateLimited(key, LOGIN_LIMIT, LOGIN_WINDOW_SEC)).toBe(false);
    }
    // Attempt 6 should be blocked
    expect(await isRateLimited(key, LOGIN_LIMIT, LOGIN_WINDOW_SEC)).toBe(true);
  });
});

// ─── resetRateLimit ─────────────────────────────────────────────────────────
describe('Rate Limit Reset', () => {
  const prefix = `test_reset_${Date.now()}`;

  it('clears the counter so requests are allowed again', async () => {
    const key = `${prefix}:clear`;
    const limit = 2;
    const windowSec = 60;

    // Exhaust the limit
    await isRateLimited(key, limit, windowSec); // 1
    await isRateLimited(key, limit, windowSec); // 2
    expect(await isRateLimited(key, limit, windowSec)).toBe(true); // blocked

    // Reset (simulates successful login clearing the lockout)
    await resetRateLimit(key);

    // Should be allowed again
    expect(await isRateLimited(key, limit, windowSec)).toBe(false);
  });

  it('is idempotent — resetting a non-existent key does not throw', async () => {
    await expect(resetRateLimit(`${prefix}:nonexistent`)).resolves.toBeUndefined();
  });
});
