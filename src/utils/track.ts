/**
 * Internal analytics event queue for the KARAHOCA SPA.
 *
 * Why this exists alongside the existing `analytics.ts` (Google
 * Analytics): GA is great for marketing-level aggregates (audience,
 * acquisition, top pages) but it's an opaque external warehouse. The
 * Karo conversation dashboard (Phase C), the conversion funnel
 * (Phase G1), cohort analysis (Phase G3), and A/B variant attribution
 * (Phase G4) all need to JOIN events with our own products, chat
 * conversations, and DB users — impossible without a first-party
 * event store.
 *
 * Design pillars:
 *
 *   1. Batched. Events go into an in-memory queue and flush every 3
 *      seconds or when the queue hits 20 entries. One transaction
 *      per flush on the server side, single network round-trip.
 *
 *   2. Survives navigation. On `visibilitychange→hidden` and
 *      `pagehide` the queue is flushed using `fetch({keepalive:true})`
 *      which keeps the request alive past the page unload — unlike
 *      sendBeacon, this preserves our custom headers (CSRF + visitor
 *      id) and works with credentials cross-subdomain.
 *
 *   3. Consent-gated. Events are silently dropped when
 *      `consent !== 'all'`. The cookie-banner CTA already signs the
 *      visitor up for our own analytics the same way it signs them
 *      up for GA; no separate dialog.
 *
 *   4. Best-effort. Every error path returns silently — analytics
 *      MUST NEVER break the page. If the server returns 5xx, if the
 *      visitor's network drops mid-flush, if a stray exception fires
 *      inside the queue logic, the parent component keeps rendering
 *      and the user keeps using the site.
 *
 *   5. Type-safe vocabulary. The `EventType` union below pins the
 *      allowed event names — server-side has a matching allow-list.
 *      Drift between client and server is caught by the server's
 *      silent drop + the client's TS compiler error.
 */
import { apiFetch } from './apiFetch';
import { getCookieConsent } from './cookieConsent';

export type EventType =
  | 'page_view'
  | 'language_switch'
  | 'product_view'
  | 'product_modal_open'
  | 'product_share_whatsapp'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'whatsapp_click'
  | 'email_click'
  | 'phone_click'
  | 'chat_open'
  | 'chat_close'
  | 'chat_message_sent'
  | 'chat_followup_chip_used'
  | 'chat_continue_whatsapp'
  | 'search_query'
  | 'newsletter_subscribe';

export interface TrackEventInput {
  event_type: EventType;
  page_path?: string;
  product_id?: string;
  lang?: string;
  referrer?: string;
  payload?: Record<string, unknown>;
}

// ── Queue state ──────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 3_000;
const FLUSH_THRESHOLD = 20;

let queue: TrackEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersInstalled = false;

const isBrowser = (): boolean => typeof window !== 'undefined';

const shouldTrack = (): boolean => getCookieConsent() === 'all';

// ── Flush logic ──────────────────────────────────────────────────────────

const flushNow = async (useKeepalive = false): Promise<void> => {
  if (queue.length === 0) return;
  // Drain the queue BEFORE the network call so we don't double-send
  // if a second flush races us.
  const batch = queue.splice(0, queue.length);
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    await apiFetch('/api/track/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: useKeepalive,
    });
  } catch {
    // Network/CSRF/quota errors swallowed by design. Re-queueing a
    // failed batch risks an infinite loop on a persistent error and
    // the visitor's UX never depends on this succeeding.
  }
};

const scheduleFlush = (): void => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow(false);
  }, FLUSH_INTERVAL_MS);
};

// ── Lifecycle listeners (mount once) ─────────────────────────────────────

const installLifecycleListeners = (): void => {
  if (!isBrowser() || listenersInstalled) return;
  listenersInstalled = true;

  // The pair `visibilitychange→hidden` + `pagehide` is the modern
  // cross-browser way to detect "user is about to leave"; relying on
  // `beforeunload` alone is unreliable (some mobile browsers don't
  // fire it). Both paths use keepalive:true so the in-flight request
  // survives the page tear-down.
  const finalFlush = () => { void flushNow(true); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finalFlush();
  });
  window.addEventListener('pagehide', finalFlush);
};

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Enqueue an analytics event. Silent no-op when the visitor hasn't
 * consented to "all" cookies. Always safe to call — never throws,
 * never blocks.
 */
export const track = (event: TrackEventInput): void => {
  if (!isBrowser() || !shouldTrack()) return;
  installLifecycleListeners();
  queue.push(event);
  if (queue.length >= FLUSH_THRESHOLD) {
    void flushNow(false);
  } else {
    scheduleFlush();
  }
};

/**
 * Force-flush the current queue. Used by the e2e tests + the
 * `/admin/karo-insights` dashboard's "refresh now" affordance so an
 * operator looking at live numbers doesn't have to wait 3 seconds for
 * the next interval. Returns the in-flight fetch promise (or a
 * resolved one if the queue was empty).
 */
export const flushTrackQueue = (): Promise<void> => flushNow(false);

/**
 * Convenience builders for the most common events — they pre-fill the
 * `page_path` and `lang` defaults from `window.location` so call
 * sites stay terse. Call them whenever the corresponding action
 * fires in your component.
 */
const currentPath = (): string =>
  isBrowser() ? window.location.pathname + window.location.search : '';

const currentLang = (): string => {
  if (!isBrowser()) return 'ar';
  const segments = window.location.pathname.split('/').filter(Boolean);
  const first = segments[0]?.toLowerCase();
  return first === 'ar' || first === 'en' || first === 'tr' || first === 'ru' ? first : 'ar';
};

export const trackPageView = (extra?: Partial<TrackEventInput>): void =>
  track({
    event_type: 'page_view',
    page_path: currentPath(),
    lang: currentLang(),
    referrer: isBrowser() ? document.referrer || undefined : undefined,
    ...extra,
  });

export const trackProductView = (productId: string, extra?: Partial<TrackEventInput>): void =>
  track({
    event_type: 'product_view',
    product_id: productId,
    page_path: currentPath(),
    lang: currentLang(),
    ...extra,
  });

export const trackWhatsAppClickInternal = (
  source: 'floating_button' | 'card' | 'chat_card' | 'chat_footer' | 'custom_order',
  extra?: Partial<TrackEventInput>,
): void =>
  track({
    event_type: 'whatsapp_click',
    page_path: currentPath(),
    lang: currentLang(),
    payload: { source },
    ...extra,
  });
