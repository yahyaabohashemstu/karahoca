import { parse as parseCookieHeader } from 'cookie';

/**
 * Visitor identity middleware — resolves the canonical browser anchor
 * for the current request and attaches it as `req.visitorId`.
 *
 * Resolution order, with the first match winning:
 *
 *   1. `X-Visitor-Id` request header. Sent by the SPA's `apiFetch`
 *      helper on every request, including cross-subdomain calls
 *      (karahoca.com → api.karahoca.com) where the cookie may not
 *      travel because of SameSite policies or because the visitor
 *      hasn't consented to persistent storage.
 *
 *   2. `kara_visitor_id` cookie. Present for same-origin / cookie-
 *      configured deployments where the SPA and API share a parent
 *      domain. The cookie is set by the CLIENT (not the server) so
 *      its existence implies the visitor has accepted "all" on the
 *      cookie banner — i.e. it's safe to use for persistent
 *      analytics.
 *
 *   3. `null`. No identity could be resolved — the request is from a
 *      visitor in "essential cookies only" mode whose `apiFetch`
 *      didn't fire the helper (unlikely but possible from an SSR
 *      probe or curl). Callers MUST treat this as anonymous and
 *      avoid persisting analytics events tied to a missing ID.
 *
 * Validation: a syntactically valid id is 8-64 chars, ASCII-safe.
 * Anything else is treated as missing — defends against a maliciously
 * long header trying to overflow logs or break SQL parameter binding.
 */

const HEADER_NAME = 'x-visitor-id';
const COOKIE_NAME = 'kara_visitor_id';

const ID_PATTERN = /^[A-Za-z0-9_\-]{8,64}$/;

const isValidId = (value) => typeof value === 'string' && ID_PATTERN.test(value);

const readFromHeader = (req) => {
  const raw = req.headers?.[HEADER_NAME];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === 'string' ? raw : null;
};

const readFromCookie = (req) => {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  try {
    const parsed = parseCookieHeader(cookieHeader);
    return parsed[COOKIE_NAME] || null;
  } catch {
    return null;
  }
};

/**
 * Attach `req.visitorId` (string or null) to the incoming request.
 * Safe to call on every request — extremely cheap, no IO. Routes that
 * need the anchor read it directly off `req`; routes that don't
 * never touch it.
 */
export const resolveVisitorId = (req) => {
  const candidates = [readFromHeader(req), readFromCookie(req)];
  for (const candidate of candidates) {
    if (isValidId(candidate)) {
      req.visitorId = candidate;
      return candidate;
    }
  }
  req.visitorId = null;
  return null;
};
