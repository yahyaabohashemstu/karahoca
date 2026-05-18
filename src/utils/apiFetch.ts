import { buildApiUrl } from './api';
import { getVisitorId } from './visitorIdentity';

/**
 * Thin wrapper around `fetch` that:
 *   1. Rewrites the path through `buildApiUrl` so `VITE_BACKEND_URL` is
 *      honoured exactly like the previous raw-`fetch(buildApiUrl(...))`
 *      pattern.
 *   2. Automatically attaches the `X-CSRF-Token` header for mutating
 *      requests (POST / PUT / PATCH / DELETE). The token is read from the
 *      `karahoca_csrf` cookie issued by `GET /api/csrf` on app boot
 *      (see `server/middlewares/publicCsrf.mjs` and `bootstrapCsrf` below).
 *   3. Sends cookies with `credentials: 'include'` so the CSRF cookie
 *      round-trips even when the API lives on a sibling subdomain
 *      (frontend at karahoca.com → backend at api.karahoca.com).
 *   4. Attaches the `X-Visitor-Id` header on every request so the
 *      backend can attribute the call to the originating browser even
 *      when the visitor-id cookie is cross-subdomain-blocked (api.
 *      karahoca.com vs karahoca.com) or when the storage is session-
 *      only (essential-consent visitors). See `utils/visitorIdentity`
 *      for the consent-gated storage strategy.
 *
 * Callers pass a path (e.g. `/api/newsletter/subscribe`) + standard init.
 * Return value is the raw `Response` — same contract as `fetch`.
 */

const CSRF_COOKIE_NAME = 'karahoca_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const VISITOR_HEADER_NAME = 'X-Visitor-Id';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const readCookie = (name: string): string => {
  if (typeof document === 'undefined' || !document.cookie) return '';
  for (const part of document.cookie.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    if (!rawKey) continue;
    if (rawKey.trim() !== name) continue;
    return decodeURIComponent(rest.join('=').trim());
  }
  return '';
};

export const readCsrfToken = (): string => readCookie(CSRF_COOKIE_NAME);

/**
 * Normalise a `HeadersInit` into a plain `Record<string, string>` we can
 * mutate before handing it to fetch. Avoids clobbering caller-supplied
 * headers — if the caller already sent `X-CSRF-Token`, we keep theirs.
 */
const normaliseHeaders = (input?: HeadersInit): Record<string, string> => {
  if (!input) return {};
  if (input instanceof Headers) {
    const out: Record<string, string> = {};
    input.forEach((value, key) => { out[key] = value; });
    return out;
  }
  if (Array.isArray(input)) {
    const out: Record<string, string> = {};
    for (const [key, value] of input) out[key] = value;
    return out;
  }
  return { ...input };
};

const hasHeader = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());

export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const url = buildApiUrl(path);
  const method = (init.method || 'GET').toUpperCase();
  const headers = normaliseHeaders(init.headers);

  // Attach the canonical visitor id to EVERY request (read-only too)
  // so analytics events, cohort tracking, and A/B variant assignment
  // can find the same browser across navigations. Skipped silently
  // when SSR / the helper returns the placeholder.
  if (!hasHeader(headers, VISITOR_HEADER_NAME)) {
    const visitorId = getVisitorId();
    if (visitorId && visitorId !== 'ssr-placeholder') {
      headers[VISITOR_HEADER_NAME] = visitorId;
    }
  }

  if (MUTATION_METHODS.has(method) && !hasHeader(headers, CSRF_HEADER_NAME)) {
    let token = readCsrfToken();

    // Race-condition guard: on production the cross-origin CSRF bootstrap
    // (`bootstrapCsrf` fired in main.tsx) takes ~200-500ms because of DNS +
    // TLS to api.karahoca.com. A user who opens the chat widget and submits
    // a message within that window would otherwise see 403s — the cookie
    // simply hadn't arrived yet — and the AI chat would render its
    // generic "trouble connecting" fallback. Awaiting the bootstrap
    // promise here closes the race without forcing every page mount to
    // pay the round-trip up front. Locally (cookie already in document.
    // cookie or bootstrap completed in <5 ms) this is a same-microtask
    // no-op.
    if (!token) {
      try {
        await bootstrapCsrf();
        token = readCsrfToken();
      } catch {
        /* swallow — still try the POST; server returns a clean 403 we'll
           surface to the caller. */
      }
    }

    if (token) headers[CSRF_HEADER_NAME] = token;
  }

  return fetch(url, {
    credentials: 'include',
    ...init,
    headers,
  });
};

/**
 * Seed the public CSRF cookie. Call once at app boot so the SPA has a token
 * to echo back on its first mutation. The backend `/api/csrf` endpoint
 * issues `karahoca_csrf` (SameSite=Lax) and `credentials: 'include'` on
 * the request lets the browser store the cookie even cross-subdomain.
 *
 * Best-effort: a network failure here just means the first POST will 403,
 * which the user can recover from with a retry — we don't want to gate
 * the whole UI on this.
 */
let csrfBootstrapPromise: Promise<void> | null = null;
export const bootstrapCsrf = (): Promise<void> => {
  if (csrfBootstrapPromise) return csrfBootstrapPromise;
  csrfBootstrapPromise = (async () => {
    if (readCsrfToken()) return;
    try {
      await fetch(buildApiUrl('/api/csrf'), {
        method: 'GET',
        credentials: 'include',
      });
    } catch {
      /* offline / network error — surface lazily on the first POST */
    }
  })();
  return csrfBootstrapPromise;
};
