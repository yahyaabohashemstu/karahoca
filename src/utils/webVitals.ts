/**
 * Real-User Monitoring of Core Web Vitals.
 *
 * Reports the five metrics Google uses for ranking + UX scoring:
 *
 *   LCP — Largest Contentful Paint   (loading)
 *   INP — Interaction to Next Paint  (interactivity, replaces FID)
 *   CLS — Cumulative Layout Shift    (visual stability)
 *   FCP — First Contentful Paint     (perceived load)
 *   TTFB — Time To First Byte        (server / CDN responsiveness)
 *
 * Why this exists
 * ───────────────
 * Lighthouse / PageSpeed Insights synthetic scores do NOT reflect what
 * real users see — Google's CrUX dataset and ranking signal both use
 * field data (RUM). To know whether our optimisations actually help real
 * visitors, we need to measure those same metrics in production and ship
 * them somewhere we can graph. The cheapest sink is the Google Analytics
 * 4 property already wired into this app — events appear under
 * "web_vitals" and can be charted by metric/route/device with no
 * additional infrastructure.
 *
 * Privacy & cost
 * ──────────────
 * • Respects the same cookie-consent gate as `analytics.ts` — events drop
 *   silently if the user hasn't accepted analytics cookies.
 * • Reports each metric AT MOST ONCE per page load (the web-vitals
 *   library handles this — we just consume its callbacks).
 * • Bundle cost: web-vitals is ~3 KB gzipped and lazy-loaded after first
 *   paint to avoid blocking render.
 *
 * Reversibility
 * ─────────────
 * To disable: comment out the `void initWebVitals()` call in main.tsx,
 * or set `VITE_WEB_VITALS=0` in the environment.
 */

import { getCookieConsent } from './cookieConsent';

// GA4 docs recommend rounding to integer for ms metrics, leaving CLS as
// 4-decimal float (since CLS values are very small).
const roundForGA = (name: string, value: number): number =>
  name === 'CLS' ? Math.round(value * 10000) / 10000 : Math.round(value);

/**
 * Fire-and-forget reporter. Called by web-vitals once per metric.
 *
 * We send via `gtag('event', ...)` directly rather than ReactGA so the
 * payload exactly matches Google's recommended schema:
 *
 *   {
 *     name: 'LCP',
 *     value: 2456,
 *     metric_id: 'v3-1234567890-...',
 *     metric_value: 2456,
 *     metric_rating: 'good' | 'needs-improvement' | 'poor',
 *     metric_delta: 2456,
 *     navigation_type: 'navigate' | 'reload' | 'back-forward' | 'prerender',
 *   }
 *
 * That schema is what the official Google Analytics → Looker Studio
 * web-vitals dashboard template consumes; matching it gives us a free
 * dashboard out of the box.
 */
type Metric = {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: string;
};

const sendToGA = (metric: Metric): void => {
  // Don't even check window.gtag if consent is missing — the function
  // won't exist in that case (GA never initialised), and we want zero
  // side effects pre-consent.
  if (getCookieConsent() !== 'all') return;

  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;

  try {
    gtag('event', metric.name, {
      // Standard params — matches the Looker Studio template.
      value: roundForGA(metric.name, metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_rating: metric.rating,
      metric_delta: metric.delta,
      navigation_type: metric.navigationType,
      // Custom: which route the metric was measured on. Useful for
      // pinpointing slow routes (e.g. /dryer LCP > 4s).
      page_path: window.location.pathname,
    });
  } catch {
    // GA failures must never break the page. Silent.
  }
};

/**
 * Boot the web-vitals listeners. Idempotent — calling twice is a no-op
 * (the lib's own onXxx APIs only register once per page load).
 */
export const initWebVitals = async (): Promise<void> => {
  // Hard kill switch via env var. `VITE_WEB_VITALS=0` disables all RUM.
  if (import.meta.env.VITE_WEB_VITALS === '0') return;

  // Defer the import so it lands AFTER initial paint — the metrics we
  // care about (LCP, FCP) are measured by the browser's PerformanceObserver
  // independent of when our library boots. Lazy import keeps the
  // critical-path bundle smaller.
  try {
    const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');
    onCLS(sendToGA);
    onFCP(sendToGA);
    onINP(sendToGA);
    onLCP(sendToGA);
    onTTFB(sendToGA);
  } catch {
    // web-vitals failed to load (network, CSP, very old browser). Don't
    // crash — RUM is observability, not functionality.
  }
};
