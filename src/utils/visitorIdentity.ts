/**
 * Centralised visitor identity — the single source of truth for "who
 * is this browser?" across the AI chat, analytics events, A/B
 * experiments, and any future feature that needs a sticky per-visitor
 * anchor.
 *
 * Storage strategy is consent-gated to honour the cookie banner the
 * visitor already saw:
 *
 *   consent === 'all'         → Persistent cookie `kara_visitor_id`
 *                               (1 year) + localStorage mirror.
 *                               Survives tab close, browser restart,
 *                               even a service-worker cache purge
 *                               (re-seeded from the cookie next
 *                               visit).
 *
 *   consent === 'essential'   → sessionStorage only. The visitor
 *   or consent === null         still gets a stable ID *within* the
 *                               current session (so a single chat
 *                               conversation attributes its multi-
 *                               message turns to ONE visitor), but
 *                               the ID is regenerated next session —
 *                               no longitudinal tracking is possible.
 *
 * Legacy migration: the original chat-only ID lived in localStorage
 * under `karahoca_user_id`. We honour that value on first read so
 * existing visitors keep their conversation-history thread continuous;
 * new visitors get a fresh UUID v4.
 *
 * "Forget me": `clearVisitorId()` wipes every store (cookie + ls + ss)
 * and forces a fresh ID on the next call — exposed through the cookie-
 * consent settings UI for visitors who want to start over without
 * leaving a trail.
 */
import { getCookieConsent, COOKIE_CONSENT_EVENT } from './cookieConsent';

const COOKIE_NAME = 'kara_visitor_id';
const LOCAL_STORAGE_KEY = 'kara_visitor_id';
const SESSION_STORAGE_KEY = 'kara_visitor_id';
const LEGACY_LOCAL_STORAGE_KEY = 'karahoca_user_id';

/**
 * 1 year. Same window the cookie-consent banner uses for the consent
 * preference itself, so the identity and the consent it relies on
 * expire roughly in step.
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const isBrowser = (): boolean => typeof window !== 'undefined';

const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Defensive fallback — older Safari / embedded webviews where
  // `crypto.randomUUID` is missing. Still random enough for a visitor
  // anchor; not used for cryptographic purposes anywhere.
  return `uid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const isValidId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length >= 8 && value.length <= 64;

// ── Storage primitives ────────────────────────────────────────────────────

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined' || !document.cookie) return null;
  for (const part of document.cookie.split(';')) {
    const [rawKey, ...rest] = part.split('=');
    if (!rawKey) continue;
    if (rawKey.trim() !== name) continue;
    return decodeURIComponent(rest.join('=').trim());
  }
  return null;
};

const writeCookie = (name: string, value: string): void => {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=/`,
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    `SameSite=Lax`,
  ];
  if (secure) segments.push('Secure');
  document.cookie = segments.join('; ');
};

const deleteCookie = (name: string): void => {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const segments = [`${name}=`, 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (secure) segments.push('Secure');
  document.cookie = segments.join('; ');
};

const safeLocalStorage = {
  get(key: string): string | null {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { window.localStorage.setItem(key, value); } catch { /* quota / disabled */ }
  },
  remove(key: string): void {
    try { window.localStorage.removeItem(key); } catch { /* */ }
  },
};

const safeSessionStorage = {
  get(key: string): string | null {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { window.sessionStorage.setItem(key, value); } catch { /* */ }
  },
  remove(key: string): void {
    try { window.sessionStorage.removeItem(key); } catch { /* */ }
  },
};

// ── Read / write the canonical ID ──────────────────────────────────────────

/**
 * Resolve the existing visitor ID from whichever store currently holds
 * one, OR mint a fresh UUID v4 and persist it according to the
 * visitor's consent preference. Always returns a non-empty string —
 * the SSR / prerender path gets a deterministic placeholder so static
 * HTML doesn't bake in a real-looking but rotating value.
 */
export const getVisitorId = (): string => {
  if (!isBrowser()) return 'ssr-placeholder';

  const consent = getCookieConsent();

  // 1. Prefer the cookie when the visitor has accepted full tracking.
  //    Cookies survive the most aggressive cache invalidation, so they
  //    win over localStorage when both exist.
  if (consent === 'all') {
    const fromCookie = readCookie(COOKIE_NAME);
    if (isValidId(fromCookie)) {
      // Mirror to localStorage so the chat history remains
      // attributable even in private-browsing tabs where the cookie
      // store may be transient.
      safeLocalStorage.set(LOCAL_STORAGE_KEY, fromCookie);
      return fromCookie;
    }
  }

  // 2. Session-scoped fallback — the only store we touch when consent
  //    is essential-only or undecided. Gives the chat a stable anchor
  //    within ONE session without persisting anything.
  const fromSession = safeSessionStorage.get(SESSION_STORAGE_KEY);
  if (isValidId(fromSession)) return fromSession;

  // 3. Persistent-store back-compat — read localStorage (both the new
  //    key and the legacy `karahoca_user_id` chat-only key) so an
  //    existing visitor whose cookie was wiped (or who never opted in
  //    but had a pre-cookie chat history) doesn't lose their thread.
  if (consent === 'all') {
    const fromLs = safeLocalStorage.get(LOCAL_STORAGE_KEY)
      ?? safeLocalStorage.get(LEGACY_LOCAL_STORAGE_KEY);
    if (isValidId(fromLs)) {
      // Re-seed the cookie so future page loads find the canonical
      // store first.
      writeCookie(COOKIE_NAME, fromLs);
      return fromLs;
    }
  }

  // 4. Brand-new visitor. Mint, persist according to consent, return.
  const fresh = generateUuid();
  if (consent === 'all') {
    writeCookie(COOKIE_NAME, fresh);
    safeLocalStorage.set(LOCAL_STORAGE_KEY, fresh);
  }
  // Session storage is ALWAYS written — it's the minimum a visitor
  // needs for a coherent single-session experience, regardless of
  // their consent on persistent tracking.
  safeSessionStorage.set(SESSION_STORAGE_KEY, fresh);
  return fresh;
};

/**
 * Wipe every visitor-identity store. After this returns, the next
 * `getVisitorId()` call will mint a brand-new UUID — the visitor has
 * effectively been forgotten by the client. Server-side history
 * keyed on the OLD id remains, but no further events can be
 * attributed to it from this browser.
 *
 * Exposed for the cookie-consent settings UI ("Forget me") and for
 * the chat's "start over" affordance.
 */
export const clearVisitorId = (): void => {
  if (!isBrowser()) return;
  deleteCookie(COOKIE_NAME);
  safeLocalStorage.remove(LOCAL_STORAGE_KEY);
  safeLocalStorage.remove(LEGACY_LOCAL_STORAGE_KEY);
  safeSessionStorage.remove(SESSION_STORAGE_KEY);
};

/**
 * Re-evaluate storage placement after a consent change. Called on
 * mount and whenever the cookie-consent banner fires its custom
 * event, so:
 *
 *   - Granting `all` upgrades an essential-only session-scoped ID
 *     into a persistent cookie + localStorage entry.
 *
 *   - Downgrading from `all` back to `essential` wipes the cookie
 *     and localStorage mirror, leaving only the session-scoped copy
 *     intact for the rest of the visit.
 */
const reconcileStorageWithConsent = (): void => {
  if (!isBrowser()) return;
  const consent = getCookieConsent();
  // We deliberately re-read sessionStorage rather than calling
  // getVisitorId() here, to avoid minting a brand-new ID just because
  // the user clicked "accept" on an otherwise empty browser. The full
  // mint path is triggered the first time a real feature asks for
  // the ID.
  const sessionId = safeSessionStorage.get(SESSION_STORAGE_KEY);
  if (!isValidId(sessionId)) return;

  if (consent === 'all') {
    writeCookie(COOKIE_NAME, sessionId);
    safeLocalStorage.set(LOCAL_STORAGE_KEY, sessionId);
  } else {
    // Downgrade — strip the persistent stores. Session keeps going.
    deleteCookie(COOKIE_NAME);
    safeLocalStorage.remove(LOCAL_STORAGE_KEY);
    safeLocalStorage.remove(LEGACY_LOCAL_STORAGE_KEY);
  }
};

/**
 * Wire up the consent listener once per app load. Idempotent.
 */
let consentListenerInstalled = false;
export const installVisitorIdentityListener = (): void => {
  if (!isBrowser() || consentListenerInstalled) return;
  window.addEventListener(COOKIE_CONSENT_EVENT, reconcileStorageWithConsent);
  consentListenerInstalled = true;
  // Reconcile once on install — covers the case where the consent was
  // changed in another tab and the storage drifted.
  reconcileStorageWithConsent();
};
