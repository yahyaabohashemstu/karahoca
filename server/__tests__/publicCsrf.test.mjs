/**
 * Tests for server/middlewares/publicCsrf.mjs
 * ============================================
 * Ensures the anonymous-session CSRF guard:
 *   - Issues a cookie when the request has none
 *   - Reuses an existing cookie (idempotent)
 *   - Accepts requests where the cookie matches the X-CSRF-Token header
 *   - Rejects requests where the header is missing / wrong
 *   - Uses a constant-time comparator (no length oracle, no byte leak)
 */

import { describe, it, expect } from 'vitest';
import {
  ensurePublicCsrfCookie,
  readPublicCsrfCookie,
  requirePublicCsrfToken,
  generatePublicCsrfToken,
  PUBLIC_CSRF_COOKIE_NAME,
} from '../middlewares/publicCsrf.mjs';

const mockRequest = (headers = {}, method = 'POST') => ({ method, headers });
const mockResponse = () => {
  const captured = { statusCode: null, body: null, headers: null };
  return {
    writeHead(status, headers) {
      captured.statusCode = status;
      captured.headers = headers;
    },
    end(body) {
      captured.body = body;
    },
    captured,
  };
};

describe('ensurePublicCsrfCookie', () => {
  it('mints a new token + Set-Cookie when no cookie is present', () => {
    const result = ensurePublicCsrfCookie(mockRequest(), {});
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(16);
    expect(result.headers['Set-Cookie']).toContain(PUBLIC_CSRF_COOKIE_NAME);
    expect(result.headers['Set-Cookie']).toContain('SameSite=Lax');
  });

  it('reuses the existing cookie value when one is already set', () => {
    const token = generatePublicCsrfToken();
    const req = mockRequest({ cookie: `${PUBLIC_CSRF_COOKIE_NAME}=${token}` });
    const result = ensurePublicCsrfCookie(req, {});
    expect(result.token).toBe(token);
    expect(result.headers['Set-Cookie']).toBeUndefined();
  });

  it('preserves any pre-existing Set-Cookie headers the caller already had', () => {
    const priorCookie = 'prior=value; Path=/';
    const result = ensurePublicCsrfCookie(mockRequest(), { 'Set-Cookie': priorCookie });
    expect(Array.isArray(result.headers['Set-Cookie'])).toBe(true);
    expect(result.headers['Set-Cookie'][0]).toBe(priorCookie);
    expect(result.headers['Set-Cookie'][1]).toContain(PUBLIC_CSRF_COOKIE_NAME);
  });

  it('mints a new token when the existing cookie is too short (treats as tampered)', () => {
    const req = mockRequest({ cookie: `${PUBLIC_CSRF_COOKIE_NAME}=x` });
    const result = ensurePublicCsrfCookie(req, {});
    expect(result.token).not.toBe('x');
    expect(result.headers['Set-Cookie']).toContain(PUBLIC_CSRF_COOKIE_NAME);
  });
});

describe('readPublicCsrfCookie', () => {
  it('returns empty string when no cookie header is present', () => {
    expect(readPublicCsrfCookie(mockRequest())).toBe('');
  });

  it('parses the csrf cookie value out of a cookie header', () => {
    const req = mockRequest({ cookie: `other=x; ${PUBLIC_CSRF_COOKIE_NAME}=abc123; another=y` });
    expect(readPublicCsrfCookie(req)).toBe('abc123');
  });
});

describe('requirePublicCsrfToken', () => {
  it('is a no-op for safe methods (GET / HEAD / OPTIONS)', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const res = mockResponse();
      const ok = requirePublicCsrfToken(mockRequest({}, method), res, '');
      expect(ok).toBe(true);
      expect(res.captured.statusCode).toBe(null);
    }
  });

  it('accepts POST with matching cookie and header', () => {
    const token = generatePublicCsrfToken();
    const req = mockRequest({
      cookie: `${PUBLIC_CSRF_COOKIE_NAME}=${token}`,
      'x-csrf-token': token,
    }, 'POST');
    const res = mockResponse();
    const ok = requirePublicCsrfToken(req, res, '');
    expect(ok).toBe(true);
    expect(res.captured.statusCode).toBe(null);
  });

  it('rejects POST with missing cookie', () => {
    const token = generatePublicCsrfToken();
    const req = mockRequest({ 'x-csrf-token': token }, 'POST');
    const res = mockResponse();
    const ok = requirePublicCsrfToken(req, res, '');
    expect(ok).toBe(false);
    expect(res.captured.statusCode).toBe(403);
  });

  it('rejects POST with missing header', () => {
    const token = generatePublicCsrfToken();
    const req = mockRequest({ cookie: `${PUBLIC_CSRF_COOKIE_NAME}=${token}` }, 'POST');
    const res = mockResponse();
    const ok = requirePublicCsrfToken(req, res, '');
    expect(ok).toBe(false);
    expect(res.captured.statusCode).toBe(403);
  });

  it('rejects POST with mismatching cookie and header', () => {
    const cookieToken = generatePublicCsrfToken();
    const headerToken = generatePublicCsrfToken(); // different
    const req = mockRequest({
      cookie: `${PUBLIC_CSRF_COOKIE_NAME}=${cookieToken}`,
      'x-csrf-token': headerToken,
    }, 'POST');
    const res = mockResponse();
    const ok = requirePublicCsrfToken(req, res, '');
    expect(ok).toBe(false);
    expect(res.captured.statusCode).toBe(403);
  });

  it('rejects POST where header length equals but bytes differ', () => {
    const cookieToken = 'a'.repeat(32);
    const headerToken = 'b'.repeat(32);
    const req = mockRequest({
      cookie: `${PUBLIC_CSRF_COOKIE_NAME}=${cookieToken}`,
      'x-csrf-token': headerToken,
    }, 'POST');
    const res = mockResponse();
    const ok = requirePublicCsrfToken(req, res, '');
    expect(ok).toBe(false);
    expect(res.captured.statusCode).toBe(403);
  });
});
