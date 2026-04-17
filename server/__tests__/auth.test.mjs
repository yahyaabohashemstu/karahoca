/**
 * Tests for server/auth.mjs
 * ==========================
 * Validates the authentication module's security-critical functions:
 * - Login rate limiting (Redis-backed, tested via in-memory fallback)
 * - Password hashing and verification
 * - JWT token signing and verification
 * - Admin session cookie creation/clearing (HttpOnly, SameSite, Secure)
 * - requireAuth middleware (cookie-first, Bearer migration bridge)
 */

import { describe, it, expect } from 'vitest';

// Force Redis fallback for deterministic test behavior
process.env.REDIS_URL = 'redis://127.0.0.1:1';

// Set up auth env vars BEFORE importing the module
const TEST_USERNAME = 'testadmin';
const TEST_PASSWORD = 'Str0ng!Pass#2026';
process.env.JWT_SECRET = 'vitest-secret-key-at-least-32-chars-long';
process.env.JWT_EXPIRES_IN = '1h';

// We'll set ADMIN_USERNAME and ADMIN_PASSWORD_HASH after hashing
// Import auth module
const auth = await import('../auth.mjs');

// Generate a hash for our test password
const testPasswordHash = auth.hashPassword(TEST_PASSWORD);
process.env.ADMIN_USERNAME = TEST_USERNAME;
process.env.ADMIN_PASSWORD_HASH = testPasswordHash;

// ─── Password Hashing ───────────────────────────────────────────────────────
describe('Password Hashing', () => {
  it('hashPassword returns a bcrypt hash', () => {
    const hash = auth.hashPassword('test123');
    expect(hash).toMatch(/^\$2[aby]?\$/); // bcrypt prefix
    expect(hash.length).toBeGreaterThan(50);
  });

  it('hashPassword produces different hashes for the same input (salted)', () => {
    const hash1 = auth.hashPassword('same-password');
    const hash2 = auth.hashPassword('same-password');
    expect(hash1).not.toBe(hash2); // Different salts
  });
});

// ─── Login Verification ─────────────────────────────────────────────────────
describe('Login Verification', () => {
  it('accepts correct credentials', () => {
    const result = auth.verifyLogin(TEST_USERNAME, TEST_PASSWORD);
    expect(result).toBe(true);
  });

  it('rejects wrong password', () => {
    const result = auth.verifyLogin(TEST_USERNAME, 'wrong-password');
    expect(result).toBe(false);
  });

  it('rejects wrong username', () => {
    const result = auth.verifyLogin('wronguser', TEST_PASSWORD);
    expect(result).toBe(false);
  });

  it('rejects empty credentials', () => {
    expect(auth.verifyLogin('', '')).toBe(false);
    expect(auth.verifyLogin(TEST_USERNAME, '')).toBe(false);
  });
});

// ─── JWT Token Lifecycle ────────────────────────────────────────────────────
describe('JWT Token Lifecycle', () => {
  let validToken;

  it('signToken produces a valid JWT string', () => {
    validToken = auth.signToken({ username: TEST_USERNAME, role: 'admin' });
    expect(typeof validToken).toBe('string');
    // JWT has 3 base64 segments separated by dots
    expect(validToken.split('.').length).toBe(3);
  });

  it('verifyToken decodes a valid token', () => {
    const payload = auth.verifyToken(validToken);
    expect(payload).not.toBeNull();
    expect(payload.username).toBe(TEST_USERNAME);
    expect(payload.role).toBe('admin');
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
  });

  it('verifyToken returns null for a tampered token', () => {
    const tampered = validToken.slice(0, -5) + 'XXXXX';
    expect(auth.verifyToken(tampered)).toBeNull();
  });

  it('verifyToken returns null for garbage input', () => {
    expect(auth.verifyToken('not.a.jwt')).toBeNull();
    expect(auth.verifyToken('')).toBeNull();
    expect(auth.verifyToken('undefined')).toBeNull();
  });

  it('verifyToken returns null for a token signed with a different secret', async () => {
    // Manually create a token with a different secret
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const jwt = require('jsonwebtoken');
    const rogue = jwt.sign({ username: 'hacker', role: 'admin' }, 'different-secret', { expiresIn: '1h' });
    expect(auth.verifyToken(rogue)).toBeNull();
  });
});

// ─── Login Rate Limiting ────────────────────────────────────────────────────
describe('Login Rate Limiting', () => {
  // Use a unique IP per test to avoid cross-test contamination
  const testIp = `rate-test-${Date.now()}`;

  it('allows the first 5 login attempts', async () => {
    for (let i = 0; i < 5; i++) {
      const limited = await auth.isRateLimited(`${testIp}-allow`);
      expect(limited).toBe(false);
    }
  });

  it('blocks the 6th login attempt', async () => {
    const ip = `${testIp}-block`;
    // Exhaust 5 attempts
    for (let i = 0; i < 5; i++) {
      await auth.isRateLimited(ip);
    }
    // 6th should be blocked
    expect(await auth.isRateLimited(ip)).toBe(true);
  });

  it('continues blocking after the limit is hit', async () => {
    const ip = `${testIp}-persist`;
    for (let i = 0; i < 5; i++) {
      await auth.isRateLimited(ip);
    }
    // Attempts 6, 7, 8 all blocked
    expect(await auth.isRateLimited(ip)).toBe(true);
    expect(await auth.isRateLimited(ip)).toBe(true);
    expect(await auth.isRateLimited(ip)).toBe(true);
  });

  it('resetRateLimit allows access again after successful login', async () => {
    const ip = `${testIp}-reset`;
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      await auth.isRateLimited(ip);
    }
    expect(await auth.isRateLimited(ip)).toBe(true); // blocked

    // Simulate successful login clearing the lock
    await auth.resetRateLimit(ip);

    // Should be allowed again
    expect(await auth.isRateLimited(ip)).toBe(false);
  });
});

// ─── requireAuth Middleware ─────────────────────────────────────────────────
describe('requireAuth Middleware', () => {
  const buildCookieHeader = (token) => `${auth.ADMIN_SESSION_COOKIE_NAME}=${token}`;

  it('returns decoded payload for a valid admin session cookie', () => {
    const token = auth.signToken({ username: 'admin', role: 'admin' });
    const fakeRequest = {
      headers: { cookie: buildCookieHeader(token) },
    };
    const result = auth.requireAuth(fakeRequest);
    expect(result).not.toBeNull();
    expect(result.username).toBe('admin');
    expect(result.role).toBe('admin');
  });

  it('returns null when no cookie header is present', () => {
    const result = auth.requireAuth({ headers: {} });
    expect(result).toBeNull();
  });

  it('returns null when the admin session cookie is missing', () => {
    const result = auth.requireAuth({
      headers: { cookie: 'theme=dark; locale=ar' },
    });
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const { createRequire: cr } = await import('node:module');
    const req = cr(import.meta.url);
    const jwt = req('jsonwebtoken');
    const shortToken = jwt.sign(
      { username: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1s' }
    );

    // Wait for it to expire
    await new Promise((r) => setTimeout(r, 1200));

    const result = auth.requireAuth({
      headers: { cookie: buildCookieHeader(shortToken) },
    });
    expect(result).toBeNull();
  });

  it('returns null for a tampered cookie value', () => {
    const token = auth.signToken({ username: 'admin', role: 'admin' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    const result = auth.requireAuth({
      headers: { cookie: buildCookieHeader(tampered) },
    });
    expect(result).toBeNull();
  });

  it('ignores an Authorization Bearer header when a valid cookie is present', () => {
    // Cookie wins — the Bearer header must not be able to override an active cookie session.
    const cookieToken = auth.signToken({ username: 'cookie-user', role: 'admin' });
    const bearerToken = auth.signToken({ username: 'bearer-user', role: 'admin' });
    const result = auth.requireAuth({
      headers: {
        cookie: buildCookieHeader(cookieToken),
        authorization: `Bearer ${bearerToken}`,
      },
    });
    expect(result).not.toBeNull();
    expect(result.username).toBe('cookie-user');
  });

  it('falls back to Authorization Bearer when no cookie is present (migration bridge)', () => {
    const token = auth.signToken({ username: 'legacy-admin', role: 'admin' });
    const result = auth.requireAuth({
      headers: { authorization: `Bearer ${token}` },
    });
    expect(result).not.toBeNull();
    expect(result.username).toBe('legacy-admin');
  });

  it('returns null for a non-Bearer Authorization scheme when no cookie', () => {
    const result = auth.requireAuth({
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(result).toBeNull();
  });
});

// ─── Admin Session Cookies (createAdminSessionCookie / clearAdminSessionCookie) ─
describe('Admin Session Cookies', () => {
  it('ADMIN_SESSION_COOKIE_NAME is defined and non-empty', () => {
    expect(typeof auth.ADMIN_SESSION_COOKIE_NAME).toBe('string');
    expect(auth.ADMIN_SESSION_COOKIE_NAME.length).toBeGreaterThan(0);
  });

  describe('createAdminSessionCookie', () => {
    const token = 'test.jwt.token';
    const cookie = auth.createAdminSessionCookie(token);

    it('starts with the cookie name and the given token', () => {
      expect(cookie.startsWith(`${auth.ADMIN_SESSION_COOKIE_NAME}=${token}`)).toBe(true);
    });

    it('is marked HttpOnly (not accessible to JavaScript)', () => {
      expect(cookie).toMatch(/HttpOnly/i);
    });

    it('is marked SameSite=Strict (CSRF protection)', () => {
      expect(cookie).toMatch(/SameSite=Strict/i);
    });

    it('has Path=/ (applies to whole site)', () => {
      expect(cookie).toMatch(/Path=\//);
    });

    it('sets a Max-Age matching JWT_EXPIRES_IN (3600s for "1h")', () => {
      expect(cookie).toMatch(/Max-Age=3600/);
    });

    it('does NOT set Secure in non-production (allows local HTTP testing)', () => {
      expect(cookie).not.toMatch(/;\s*Secure/i);
    });
  });

  describe('clearAdminSessionCookie', () => {
    const cleared = auth.clearAdminSessionCookie();

    it('has an empty value', () => {
      expect(cleared).toMatch(new RegExp(`^${auth.ADMIN_SESSION_COOKIE_NAME}=;`));
    });

    it('sets Max-Age=0 to expire immediately', () => {
      expect(cleared).toMatch(/Max-Age=0/);
    });

    it('sets Expires to the Unix epoch (1970)', () => {
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('preserves HttpOnly and SameSite=Strict flags', () => {
      expect(cleared).toMatch(/HttpOnly/i);
      expect(cleared).toMatch(/SameSite=Strict/i);
    });
  });
});
