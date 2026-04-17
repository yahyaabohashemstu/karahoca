import { buildApiUrl } from './api';

/**
 * Thin wrapper around `fetch` that:
 *   1. Rewrites the path through `buildApiUrl` so `VITE_BACKEND_URL` is
 *      honoured exactly like the previous raw-`fetch(buildApiUrl(...))`
 *      pattern.
 *   2. Automatically attaches the `X-CSRF-Token` header for mutating
 *      requests (POST / PUT / PATCH / DELETE). The token is read from the
 *      `karahoca_csrf` cookie that the server sets on every HTML response
 *      (see `server/middlewares/publicCsrf.mjs`).
 *   3. Sends cookies on same-origin requests by default so the CSRF cookie
 *      round-trips without callers having to set `credentials` themselves.
 *
 * Callers pass a path (e.g. `/api/newsletter/subscribe`) + standard init.
 * Return value is the raw `Response` — same contract as `fetch`.
 */

const CSRF_COOKIE_NAME = 'karahoca_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
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

export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const url = buildApiUrl(path);
  const method = (init.method || 'GET').toUpperCase();
  const headers = normaliseHeaders(init.headers);

  if (MUTATION_METHODS.has(method) && !hasHeader(headers, CSRF_HEADER_NAME)) {
    const token = readCsrfToken();
    if (token) headers[CSRF_HEADER_NAME] = token;
  }

  return fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers,
  });
};
