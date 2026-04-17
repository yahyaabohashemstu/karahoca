import { randomBytes, timingSafeEqual } from 'node:crypto';
import { parse as parseCookieHeader, serialize as serializeCookie } from 'cookie';
import { sendJson } from './cors.mjs';

/**
 * Anonymous-session CSRF for PUBLIC POST endpoints.
 *
 * Why this exists: state-changing public endpoints (newsletter subscribe,
 * log-error, chat log, AI chat) have no session token for a classic CSRF
 * attack to steal, but they CAN still be forged cross-site from a malicious
 * tab. Modern browsers' default SameSite=Lax cookie policy already mitigates
 * that for top-level navigations; this module layers an explicit double-
 * submit token on top as defence-in-depth.
 *
 * Flow:
 *   1. Server sets `karahoca_csrf` on the very first response that reaches
 *      a browser (typically the SPA HTML shell). The cookie is NOT httpOnly
 *      (so the SPA can read it) but is SameSite=Lax + Secure-in-prod, so
 *      cross-site attacker pages cannot read OR set it.
 *   2. Client SPA reads `document.cookie`, echoes the value back as the
 *      `X-CSRF-Token` header on every mutating fetch.
 *   3. `requirePublicCsrfToken` validates the cookie and the header match
 *      using a constant-time comparator. Mismatch → 403.
 *
 * Why SameSite=Lax instead of Strict (as used for admin): Lax still blocks
 * cross-site POSTs but permits following a same-site link (e.g. a magic
 * unsubscribe URL clicked from an email) — which the admin strict cookie
 * must intentionally block and the public cookie must intentionally allow.
 */

export const PUBLIC_CSRF_COOKIE_NAME = 'karahoca_csrf';
export const PUBLIC_CSRF_HEADER_NAME = 'x-csrf-token';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

const COOKIE_OPTIONS = Object.freeze({
  httpOnly: false,
  sameSite: 'lax',
  secure: IS_PRODUCTION,
  path: '/',
  maxAge: COOKIE_MAX_AGE_SEC,
});

/** 32 bytes of entropy, base64url — cookie-safe and header-safe. */
export const generatePublicCsrfToken = () => randomBytes(32).toString('base64url');

const getRequestCookieHeader = (request) => {
  const header = request?.headers?.cookie;
  if (Array.isArray(header)) return header.join('; ');
  return typeof header === 'string' ? header : '';
};

/** Read the public CSRF cookie value from an incoming request, or '' if missing. */
export const readPublicCsrfCookie = (request) => {
  const raw = getRequestCookieHeader(request);
  if (!raw) return '';
  const cookies = parseCookieHeader(raw);
  return cookies[PUBLIC_CSRF_COOKIE_NAME] || '';
};

/**
 * Ensure the response will set-cookie a public CSRF token if the incoming
 * request doesn't already have one. Callers pass `existingHeaders` — the
 * headers object they're about to emit — and receive the same object back,
 * with `Set-Cookie` extended if applicable. Returns the effective token
 * value (existing or newly-minted) so callers that need to interpolate it
 * into the HTML response body can do so without another cookie read.
 */
export const ensurePublicCsrfCookie = (request, existingHeaders = {}) => {
  const existing = readPublicCsrfCookie(request);
  if (existing && existing.length >= 16) {
    return { token: existing, headers: existingHeaders };
  }

  const token = generatePublicCsrfToken();
  const cookieValue = serializeCookie(PUBLIC_CSRF_COOKIE_NAME, token, COOKIE_OPTIONS);

  const headers = { ...existingHeaders };
  const prior = headers['Set-Cookie'] ?? headers['set-cookie'];
  if (Array.isArray(prior)) {
    headers['Set-Cookie'] = [...prior, cookieValue];
  } else if (typeof prior === 'string' && prior.length > 0) {
    headers['Set-Cookie'] = [prior, cookieValue];
  } else {
    headers['Set-Cookie'] = cookieValue;
  }
  return { token, headers };
};

const constantTimeEquals = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

/**
 * Guard for PUBLIC state-changing endpoints. Returns `true` when the request
 * passes the CSRF check and the caller should continue; returns `false`
 * when the response has already been written (403) and the caller MUST
 * early-return.
 *
 * Does nothing on safe methods (GET / HEAD / OPTIONS). Those are emitted
 * by the body-parser layer upstream, but we keep the guard here so the
 * helper is drop-in-safe for any endpoint.
 */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const requirePublicCsrfToken = (request, response, requestOrigin) => {
  const method = (request.method || '').toUpperCase();
  if (!MUTATION_METHODS.has(method)) return true;

  const cookieValue = readPublicCsrfCookie(request);
  const headerRaw = request.headers?.[PUBLIC_CSRF_HEADER_NAME];
  const headerValue = typeof headerRaw === 'string'
    ? headerRaw.trim()
    : Array.isArray(headerRaw) && typeof headerRaw[0] === 'string'
      ? headerRaw[0].trim()
      : '';

  if (!cookieValue || !headerValue || !constantTimeEquals(cookieValue, headerValue)) {
    sendJson(
      response,
      403,
      { success: false, error: 'CSRF token missing or invalid.' },
      requestOrigin,
    );
    return false;
  }

  return true;
};
