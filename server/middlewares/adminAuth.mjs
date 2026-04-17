import { timingSafeEqual } from 'node:crypto';
import { requireAuth, readAdminCsrfCookie, ADMIN_CSRF_HEADER_NAME } from '../auth.mjs';
import { sendJson } from './cors.mjs';

/**
 * Guard for `/api/admin/*` routes. Returns the decoded admin user payload
 * on success, or writes a 401 and returns `null` (the caller should early-
 * return in that case).
 */
export const requireAdminAuth = (request, response, requestOrigin) => {
  const user = requireAuth(request);
  if (!user || user.role !== 'admin') {
    sendJson(response, 401, { success: false, error: 'Unauthorized.' }, requestOrigin);
    return null;
  }
  return user;
};

/**
 * HTTP methods that mutate server state and therefore MUST carry a valid
 * CSRF token. GET / HEAD / OPTIONS are considered safe and exempt.
 */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Timing-safe string equality. Returns false for any length mismatch OR
 * any byte mismatch without leaking the position of the first difference.
 */
const constantTimeEquals = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || b.length === 0) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

/**
 * Double-submit CSRF guard for admin mutation endpoints.
 *
 * Expects BOTH:
 *   - a `karahoca_admin_csrf` cookie (set at login, readable by the SPA)
 *   - an `X-CSRF-Token` header carrying the SAME value (echoed by the SPA)
 *
 * Rejects with 403 on any mismatch. Returns `true` when the request passes
 * the check and the caller should continue; returns `false` when the
 * response has already been written and the caller must early-return.
 *
 * Safe methods (GET / HEAD / OPTIONS) are exempt — they don't mutate state.
 */
export const requireCsrfToken = (request, response, requestOrigin) => {
  const method = (request.method || '').toUpperCase();
  if (!MUTATION_METHODS.has(method)) {
    return true; // nothing to check on safe reads
  }

  const cookieValue = readAdminCsrfCookie(request);
  const headerValueRaw = request.headers?.[ADMIN_CSRF_HEADER_NAME];
  const headerValue =
    typeof headerValueRaw === 'string'
      ? headerValueRaw.trim()
      : Array.isArray(headerValueRaw) && typeof headerValueRaw[0] === 'string'
        ? headerValueRaw[0].trim()
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
