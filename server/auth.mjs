import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'karahoca_admin_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Rate limiting (in-memory)
const loginAttempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const isRateLimited = (ip) => {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > MAX_ATTEMPTS;
};

const resetRateLimit = (ip) => {
  loginAttempts.delete(ip);
};

// ─── Auth functions ──────────────────────────────────────────────────────────

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);

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

export const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

// ─── Middleware ──────────────────────────────────────────────────────────────

/** Extract JWT from Authorization header and attach decoded payload to request */
export const requireAuth = (request) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
};

export { isRateLimited, resetRateLimit };
