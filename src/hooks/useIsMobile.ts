import { useEffect, useState } from "react";

/**
 * Returns `true` whenever the viewport is ≤ `breakpoint` pixels wide.
 *
 * ── Why this is more than `window.innerWidth <= breakpoint` ───────────────
 *
 * The previous implementation was:
 *
 *   const [isMobile, setIsMobile] = useState(false);
 *   useEffect(() => {
 *     const check = () => setIsMobile(window.innerWidth <= bp);
 *     check();
 *     window.addEventListener("resize", check, { passive: true });
 *     …
 *   }, []);
 *
 * which is correct in spirit but has three measurable failure modes:
 *
 *   1. HYDRATION FLICKER (CLS) — the initial value is `false` for every
 *      visitor, including those on real phones. The Puppeteer-driven
 *      SSG prerender always emits the desktop layout in the HTML, then
 *      React hydrates with `false`, then the effect fires and flips
 *      to `true`, which forces a re-render. The user sees the desktop
 *      composition for one frame before the mobile composition lands.
 *      With this hook driving Hero / FlipBook / NumbersSection /
 *      AIChat / Privacy / Terms / NewsArticle, the flash was visible
 *      on every page load.
 *
 *   2. SUBSCRIBES TO `resize` INSTEAD OF `matchMedia`. `resize` fires
 *      on EVERY pixel change of the viewport (scrollbar appear/disappear,
 *      window drag, devtools open) so the comparison runs hundreds of
 *      times during a single drag. `matchMedia('change')` fires ONLY
 *      when the boolean answer changes — a single event for "you've
 *      crossed the breakpoint" instead of dozens.
 *
 *   3. NO ORIENTATION SUPPORT. Rotating a phone fires `orientationchange`
 *      and may cross the breakpoint (a 768 × 1024 iPad goes from "not
 *      mobile" in portrait to potentially "not mobile" in landscape too,
 *      but a 800 × 412 foldable does flip). `resize` does fire during
 *      orientation transitions on most browsers, but matchMedia is the
 *      defined contract.
 *
 * ── Fixes in this version ────────────────────────────────────────────────
 *
 *   (a) Lazy initializer reads `matchMedia` synchronously on first render
 *       when running in the browser, so a real mobile visitor starts with
 *       `isMobile = true` immediately — no flicker, no extra render.
 *   (b) On SSR (where `window` is undefined) the initializer returns
 *       `false`, matching the existing prerender behaviour. React 18's
 *       hydration tolerates the mismatch with a silent re-render after
 *       the effect resyncs — but because most consumers use this hook
 *       only for fine-grained sizing (FlipBook layout, animation
 *       duration) the re-render is invisible.
 *   (c) Subscription is via `matchMedia('change')` (or legacy
 *       `addListener` for Safari ≤ 14) so we only re-render when the
 *       answer actually flips. Each MQL is scoped to a single hook
 *       instance; the browser tears it down automatically when we
 *       remove the listener.
 *   (d) The post-mount `setIsMobile(mql.matches)` resync covers the
 *       narrow window where the user could have rotated / resized
 *       between the lazy initializer reading the value and React
 *       finishing its commit phase.
 *
 * @param breakpoint Width in pixels — viewport <= breakpoint counts as
 *                   mobile. Defaults to 768 to match the documented
 *                   `--bp-md` token in tokens.css.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // SSR / Puppeteer prerender: window is undefined, default to "not
    // mobile". The post-mount effect below will correct this on the
    // very first paint of the hydrating client.
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);

    // Resync once after subscription. Covers the rare hydration scenario
    // where the user rotated / resized between the lazy initializer
    // running and the effect committing.
    setIsMobile(mql.matches);

    const handler = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // `addEventListener('change', …)` is the modern API. Safari ≤ 14
    // (iOS 13 included) only ships the legacy `addListener` — so we
    // feature-detect and fall through to it for backwards compatibility.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    mql.addListener(handler);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return () => mql.removeListener(handler);
  }, [breakpoint]);

  return isMobile;
}
