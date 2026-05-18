import { SECURITY_HEADERS } from './security.mjs';

const isProduction = process.env.NODE_ENV === 'production';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const explicitOriginCandidates = [
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim()),
  process.env.SITE_URL || '',
  process.env.FRONTEND_URL || '',
  process.env.PUBLIC_SITE_URL || '',
  process.env.PUBLIC_APP_URL || '',
  process.env.APP_URL || '',
]
  .map((origin) => trimTrailingSlash(origin))
  .filter(Boolean);

const configuredAllowedOrigins = new Set(explicitOriginCandidates);
const localDevelopmentOrigins = new Set([
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export const createJsonHeaders = (requestOrigin = '', extraHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...SECURITY_HEADERS,
    ...extraHeaders,
  };
  if (requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    // X-CSRF-Token is sent by the SPA on every mutating request (see
    // `apiFetch` + `requirePublicCsrfToken`). Without it on this allow-list,
    // the browser's CORS preflight rejects the actual POST with the cryptic
    // "Failed to fetch" — so the AI chat (and every other mutating public
    // endpoint reached cross-origin from localhost:5173 → :5000 in dev,
    // or karahoca.com → api.karahoca.com in prod) silently 403s before
    // hitting the server. curl bypasses preflight, which is why server-side
    // smoke tests passed while the browser failed.
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token, X-Visitor-Id';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    // Tell browsers they can cache the preflight result for 24h so we don't
    // pay the OPTIONS round-trip on every chat message.
    headers['Access-Control-Max-Age'] = '86400';
    headers.Vary = 'Origin';
  }
  return headers;
};

export const sendJson = (response, statusCode, payload, requestOrigin = '', extraHeaders = {}) => {
  response.writeHead(statusCode, createJsonHeaders(requestOrigin, extraHeaders));
  response.end(JSON.stringify(payload));
};

export const getRequestOrigin = (request) => {
  const origin = request.headers.origin;
  return typeof origin === 'string' ? trimTrailingSlash(origin) : '';
};

export const getRequestHostOrigin = (request) => {
  // Prefer X-Forwarded-Host set by reverse proxies (Traefik / Nginx / Coolify)
  // so that origin comparison works correctly in production behind a proxy.
  const forwardedHost = request.headers['x-forwarded-host'];
  const host =
    typeof forwardedHost === 'string' && forwardedHost.trim()
      ? forwardedHost.split(',')[0].trim()
      : typeof request.headers.host === 'string'
        ? request.headers.host.trim()
        : '';
  if (!host) return '';
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.trim().length > 0
      ? forwardedProto.split(',')[0].trim()
      : request.socket.encrypted
        ? 'https'
        : 'http';
  return protocol + '://' + host;
};

const isCoolifySiblingOrigin = (requestOrigin, requestHostOrigin) => {
  try {
    const originUrl = new URL(requestOrigin);
    const hostUrl = new URL(requestHostOrigin);
    if (originUrl.protocol !== hostUrl.protocol) return false;

    const originHost = originUrl.hostname.toLowerCase();
    const hostHost = hostUrl.hostname.toLowerCase();
    if (!originHost.includes('.coolify.') || !hostHost.includes('.coolify.')) return false;

    const originParts = originHost.split('.').filter(Boolean);
    const hostParts = hostHost.split('.').filter(Boolean);
    if (originParts.length < 4 || hostParts.length < 4) return false;

    return originParts.slice(1).join('.') === hostParts.slice(1).join('.');
  } catch {
    return false;
  }
};

export const isOriginAllowed = (requestOrigin, requestHostOrigin) => {
  if (!requestOrigin) return !isProduction;
  return (
    requestOrigin === requestHostOrigin ||
    configuredAllowedOrigins.has(requestOrigin) ||
    (isProduction && isCoolifySiblingOrigin(requestOrigin, requestHostOrigin)) ||
    (!isProduction && localDevelopmentOrigins.has(requestOrigin))
  );
};
