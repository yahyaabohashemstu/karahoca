import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { parse as parseCookieHeader, serialize as serializeCookie } from 'cookie';
import { isRateLimited as redisIsRateLimited, resetRateLimit as redisResetRateLimit } from './redisClient.mjs';
import { logger } from './utils/logger.mjs';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const MIN_SECRET_LENGTH = 32;
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const rawJwtSecret = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
const hasStrongSecret = rawJwtSecret.length >= MIN_SECRET_LENGTH;

if (isProduction && !hasStrongSecret) {
  logger.error(
    `[auth] FATAL: JWT_SECRET is not configured or is shorter than ${MIN_SECRET_LENGTH} characters. Refusing to start.`,
  );
  process.exit(1);
}

// Outside production (local dev / test) we synthesize a random per-process secret
// so tokens signed in one process are not accepted by another. Never persisted,
// never shipped. Production REQUIRES a real secret above.
const JWT_SECRET = hasStrongSecret
  ? rawJwtSecret
  : (() => {
      if (!isTest) {
        logger.warn(
          '[auth] JWT_SECRET is not set (dev/test). Using an ephemeral random secret for this process.',
        );
      }
      return randomBytes(48).toString('hex');
    })();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
export const ADMIN_SESSION_COOKIE_NAME = 'karahoca_admin_session';

const parseJwtExpiresInSeconds = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const directSeconds = Number.parseInt(trimmed, 10);
  if (Number.isFinite(directSeconds) && String(directSeconds) === trimmed && directSeconds > 0) {
    return directSeconds;
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) return undefined;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
};

const ADMIN_SESSION_MAX_AGE_SECONDS = parseJwtExpiresInSeconds(JWT_EXPIRES_IN);
const ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: isProduction,
  path: '/',
  ...(ADMIN_SESSION_MAX_AGE_SECONDS ? { maxAge: ADMIN_SESSION_MAX_AGE_SECONDS } : {}),
};

// ─── CSRF double-submit cookie ───────────────────────────────────────────────
// A SEPARATE cookie alongside the session JWT. Key differences vs the session
// cookie:
//   - httpOnly = FALSE   → the admin SPA reads it with document.cookie
//   - same-origin only   → browsers refuse to send cross-site, and attacker
//                          pages can't read it because of the same-origin
//                          cookie access rule
// The admin UI reads this value and echoes it back as the `X-CSRF-Token`
// header on every mutation request. The server rejects the request if the
// header is missing, if the cookie is missing, or if they don't match
// (timing-safe comparison).
//
// Cookie domain (COOKIE_DOMAIN env var): when the SPA and the API live on
// different subdomains (frontend at karahoca.com → backend at
// api.karahoca.com), the cookie MUST carry the registrable domain
// (Domain=.karahoca.com) so the SPA can read it back via document.cookie.
// Without this, the cookie is host-only on api.karahoca.com and the
// karahoca.com SPA cannot echo it as X-CSRF-Token → every mutation 403s.
// Mirrors the same env var consumed by middlewares/publicCsrf.mjs so a
// single setting covers both cookies.
export const ADMIN_CSRF_COOKIE_NAME = 'karahoca_admin_csrf';
export const ADMIN_CSRF_HEADER_NAME = 'x-csrf-token';
const ADMIN_COOKIE_DOMAIN = (process.env.COOKIE_DOMAIN || '').trim() || undefined;
const ADMIN_CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // MUST be readable by the admin SPA
  sameSite: 'strict',
  secure: isProduction,
  path: '/',
  ...(ADMIN_SESSION_MAX_AGE_SECONDS ? { maxAge: ADMIN_SESSION_MAX_AGE_SECONDS } : {}),
  ...(ADMIN_COOKIE_DOMAIN ? { domain: ADMIN_COOKIE_DOMAIN } : {}),
};

/** 32 bytes of entropy, base64url — safe in cookies and HTTP headers. */
export const generateCsrfToken = () => randomBytes(32).toString('base64url');

export const createAdminCsrfCookie = (token) =>
  serializeCookie(ADMIN_CSRF_COOKIE_NAME, token, ADMIN_CSRF_COOKIE_OPTIONS);

export const clearAdminCsrfCookie = () =>
  serializeCookie(ADMIN_CSRF_COOKIE_NAME, '', {
    ...ADMIN_CSRF_COOKIE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  });

/** Read the CSRF cookie value from an incoming request. */
export const readAdminCsrfCookie = (request) => {
  const header = request?.headers?.cookie;
  const raw = Array.isArray(header) ? header.join('; ') : typeof header === 'string' ? header : '';
  if (!raw) return '';
  const cookies = parseCookieHeader(raw);
  return cookies[ADMIN_CSRF_COOKIE_NAME] || '';
};

// ─── Rate limiting (Redis-backed, 5 attempts per 15 minutes) ────────────────
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SEC = 15 * 60; // 15 minutes

const isRateLimited = (ip) =>
  redisIsRateLimited(`rl:login:${ip}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SEC);

const resetRateLimit = (ip) =>
  redisResetRateLimit(`rl:login:${ip}`);

// ─── Auth functions ──────────────────────────────────────────────────────────

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);

export const getJwtConfigError = () => {
  // In production, startup already exits(1) if the secret is weak. This
  // remains as a belt-and-suspenders guard for any path that bypasses init.
  if (isProduction && !hasStrongSecret) {
    return 'JWT_SECRET must be set to a strong unique value in production.';
  }
  return null;
};

export const verifyLogin = (username, password) => {
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';

  if (!expectedHash) {
    logger.warn('[auth] ADMIN_PASSWORD_HASH not set. Admin login disabled.');
    return false;
  }

  if (username !== expectedUsername) return false;
  return bcrypt.compareSync(password, expectedHash);
};

export const signToken = (payload) => {
  const configError = getJwtConfigError();
  if (configError) {
    throw new Error(configError);
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
  try {
    if (getJwtConfigError()) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

export const createAdminSessionCookie = (token) =>
  serializeCookie(ADMIN_SESSION_COOKIE_NAME, token, ADMIN_SESSION_COOKIE_OPTIONS);

export const clearAdminSessionCookie = () =>
  serializeCookie(ADMIN_SESSION_COOKIE_NAME, '', {
    ...ADMIN_SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  });

// ─── Middleware ──────────────────────────────────────────────────────────────

const getRequestCookieHeader = (request) => {
  const header = request?.headers?.cookie;
  if (Array.isArray(header)) return header.join('; ');
  return typeof header === 'string' ? header : '';
};

const getLegacyBearerToken = (request) => {
  const authHeader = request?.headers?.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
};

/** Extract JWT from the admin session cookie and attach decoded payload to request */
export const requireAuth = (request) => {
  const cookieHeader = getRequestCookieHeader(request);
  if (cookieHeader) {
    const cookies = parseCookieHeader(cookieHeader);
    const sessionToken = cookies[ADMIN_SESSION_COOKIE_NAME];
    if (sessionToken) {
      return verifyToken(sessionToken);
    }
  }

  // Temporary migration bridge for pre-cookie admin clients during rollout.
  const legacyBearerToken = getLegacyBearerToken(request);
  if (!legacyBearerToken) return null;
  return verifyToken(legacyBearerToken);
};

export { isRateLimited, resetRateLimit };
