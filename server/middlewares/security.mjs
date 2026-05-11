import { isRateLimited as redisIsRateLimited } from '../redisClient.mjs';

// ─── Content Security Policy ────────────────────────────────────────────────
// script-src:            'self' + googletagmanager only (NO unsafe-inline).
// script-src-attr 'none' blocks onclick="..." etc.
// style-src-elem:        'self' + fonts.googleapis (NO unsafe-inline <style>).
// style-src-attr:        'unsafe-inline' — required for React's style={{}} prop.
// connect-src:           'self' plus https: for GA / fonts. Tightened where possible.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' https://www.googletagmanager.com https://static.hotjar.com https://script.hotjar.com",
  "script-src-attr 'none'",
  "style-src-elem 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://vars.hotjar.com",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0', // modern browsers: disabled; CSP supersedes (MDN guidance)
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Content-Security-Policy': CSP_DIRECTIVES,
});

// ─── Client IP extraction (proxy-aware) ─────────────────────────────────────
// Behind Coolify/Traefik, x-forwarded-for is set. We take the LEFTMOST entry,
// which is the original client. A misconfigured proxy chain could let a
// spoofed header through — we trust the reverse-proxy perimeter.
export const getClientIp = (request) => {
  const xff = request?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return request?.socket?.remoteAddress || 'unknown';
};

// ─── Per-endpoint rate limiters ─────────────────────────────────────────────
// Redis-backed with in-memory fallback (see ../redisClient.mjs).
const makeLimiter = (keyPrefix, limit, windowSec) => (ip) =>
  redisIsRateLimited(`${keyPrefix}:${ip}`, limit, windowSec);

export const isChatRateLimited = makeLimiter('rl:chat', 30, 60);
export const isUnsubRateLimited = makeLimiter('rl:unsub', 10, 5 * 60);
export const isNewsletterSubRateLimited = makeLimiter('rl:news-sub', 3, 60 * 60);
export const isLogErrorRateLimited = makeLimiter('rl:log-err', 10, 60);
// /api/chat/log fires once per assistant reply — a single visitor can
// legitimately accumulate ~20-40 entries during an active 5-minute Q&A
// burst. The previous 20/min ceiling silently dropped a third of those
// because each batch hit at the tail of a rapid back-and-forth (visitor
// fires Q, gets A, fires Q again, sometimes 3 in 10 seconds). 60 req/min
// gives us a 3x safety margin while still rate-shielding against a
// scripted log-flood attempting to bloat the DB.
export const isChatLogRateLimited = makeLimiter('rl:chat-log', 60, 60);

// /api/health itself is a mutation-free probe but unlimited probes are a
// cheap amplification vector (/health currently returns DB + Redis state).
// 120 req/min per IP is generous enough for legitimate uptime monitors
// hitting every few seconds and tight enough to shut down floods.
export const isHealthRateLimited = makeLimiter('rl:health', 120, 60);
