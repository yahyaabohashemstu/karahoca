import { createRequire } from 'node:module';
import { parse as parseCookieHeader, serialize as serializeCookie } from 'cookie';
import { isRateLimited as redisIsRateLimited, resetRateLimit as redisResetRateLimit } from './redisClient.mjs';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const DEFAULT_JWT_SECRET = 'karahoca_admin_secret_change_in_production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // 24-hour session (override via env)
const isProduction = process.env.NODE_ENV === 'production';
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

// Warn on startup if JWT_SECRET is weak
if (JWT_SECRET === DEFAULT_JWT_SECRET) {
  if (isProduction) {
    console.error('[auth] CRITICAL: JWT_SECRET is set to the default value in production! Set a strong unique secret in your environment variables.');
  } else {
    console.warn('[auth] WARNING: Using default JWT_SECRET. Set JWT_SECRET in your .env file before deploying to production.');
  }
}

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
  if (isProduction && JWT_SECRET === DEFAULT_JWT_SECRET) {
    return 'JWT_SECRET must be set to a non-default value in production.';
  }
  return null;
};

export const verifyLogin = (username, password) => {
  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';

  if (!expectedHash) {
    console.warn('[auth] ADMIN_PASSWORD_HASH not set. Admin login disabled.');
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
