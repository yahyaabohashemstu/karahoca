import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/track';

/**
 * Fire a `page_view` analytics event on every successful client-side
 * route navigation, plus once on first mount for the initial entry.
 *
 * Why a hook and not an inline useEffect inside LocalizedShell:
 *   - Keeps the shell focused on layout/locale concerns.
 *   - Makes the tracking behaviour test-discoverable (any test that
 *     mounts the hook can spy on `track()`).
 *   - Centralises the "ignore the same path twice in a row" guard so
 *     React strict-mode's double-effect doesn't double-count the
 *     initial paint and so a hash-only change (`#foo` → `#bar`) on the
 *     same page registers the visitor's hash-deep-link interaction
 *     while skipping no-op renders.
 *
 * Hash-aware: distinguishes `/ar/diox` from `/ar/diox#diox-soap`. The
 * brand-page deep links use hashes to drive the product modal, and we
 * want each modal open to count separately.
 */
export const usePageViewTracking = (): void => {
  const location = useLocation();
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${location.pathname}${location.search}${location.hash}`;
    if (lastSentRef.current === key) return;
    lastSentRef.current = key;
    trackPageView();
  }, [location.pathname, location.search, location.hash]);
};
