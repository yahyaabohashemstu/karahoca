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
 *
 * The X-Visitor-Id header is OPT-IN via a new `withVisitorId: true` init
 * option. Originally apiFetch auto-attached it on every request, which
 * meant a deploy window where the new frontend went live before the new
 * backend would BREAK CORS preflight (the old backend's Access-Control-
 * Allow-Headers didn't list X-Visitor-Id, so the browser blocked the
 * actual request and the chat showed its fallback "Karo is having
 * trouble connecting…" message). Making it opt-in scopes the header to
 * endpoints that need it (new tracking + welcome-recognition routes)
 * without changing the preflight footprint of long-lived routes
 * (chat, newsletter, log-error, etc.). On those long-lived routes the
 * visitor identity still rides cookies on same-site / same-domain
 * deployments — and analytics ride a separate endpoint that DOES opt
 * into the header.
 *
 * Callers pass a path (e.g. `/api/newsletter/subscribe`) + standard init.
 * Return value is the raw `Response` — same contract as `fetch`.
 */

const CSRF_COOKIE_NAME = 'karahoca_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const VISITOR_HEADER_NAME = 'X-Visitor-Id';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Init augmentation: when `withVisitorId` is true, apiFetch attaches
 * the X-Visitor-Id header (resolved via the consent-gated identity
 * helper). Defaults to false — see the rationale above.
 */
type ApiFetchInit = RequestInit & { withVisitorId?: boolean };

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

export const apiFetch = async (path: string, init: ApiFetchInit = {}): Promise<Response> => {
  const url = buildApiUrl(path);
  const method = (init.method || 'GET').toUpperCase();
  const { withVisitorId, ...restInit } = init;
  const headers = normaliseHeaders(restInit.headers);

  // OPT-IN visitor-id header — only attached when the caller explicitly
  // asks (e.g. /api/track/events, /api/ai/welcome). Keeps the CORS
  // preflight surface of every OTHER endpoint identical to its pre-
  // visitor-identity-era footprint, so a partial deploy where the
  // frontend ships before the backend cannot break long-lived
  // routes like the chat.
  if (withVisitorId && !hasHeader(headers, VISITOR_HEADER_NAME)) {
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
    ...restInit,
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
