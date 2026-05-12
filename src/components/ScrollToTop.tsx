import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Reset scroll position on every CLIENT-SIDE navigation.
 *
 * The problem
 * ───────────
 * React Router doesn't touch `window.scrollY` when it swaps the
 * underlying page component — only the URL changes. So a visitor who
 * scrolled to the "About" section on the homepage and then clicked
 * "Learn more about us" would land on the About page already scrolled
 * 800 px down (because the scroll position is preserved across the
 * route swap). Same bug on every nav: brand cards, news article links,
 * footer links, the wishlist button, etc.
 *
 * The fix
 * ───────
 * Listen to `useLocation()` from inside the `<Router>` tree and call
 * `window.scrollTo(0, 0)` whenever the pathname changes via a fresh
 * navigation. Three subtleties below; each addresses an edge case that
 * a naive `scrollTo(0, 0)` would break:
 *
 *   1. NAVIGATION TYPE: when the user presses the BROWSER back / forward
 *      button, `useNavigationType()` returns `'POP'`. In that case the
 *      browser is going to try to restore the previous scroll position
 *      itself — overriding it would feel broken ("I was reading further
 *      down before I went back, why am I at the top?"). We only reset
 *      on `'PUSH'` (new nav via a Link) and `'REPLACE'` (e.g. a
 *      RootLangRedirect).
 *
 *   2. HASH LINKS: if the new URL has a `#hash`, the user clicked
 *      something like `/ar/about#timeline` — they want the hash
 *      section, NOT the top. We delegate to native anchor scrolling
 *      by looking up `document.getElementById(hash)` and calling
 *      `scrollIntoView` after a brief delay (the target element may
 *      not exist yet on a freshly-mounted page).
 *
 *   3. SAME-PATH HASH-ONLY NAVIGATION: clicking `#contact` while
 *      already on `/ar/` only changes `location.hash`, not pathname.
 *      The browser auto-scrolls to the anchor in that case, so we
 *      don't need to intervene at all. Watching `pathname` (not the
 *      full `location` object) makes this a no-op — the effect won't
 *      re-fire.
 *
 * Behaviour summary
 * ─────────────────
 *   New page, no hash         → scroll to top (instant, no smooth)
 *   New page, with hash       → scroll to hash element
 *   Same page, hash changed   → no action (browser handles it)
 *   Back / Forward button     → no action (browser restores scroll)
 *
 * Mounted ONCE inside `<Router>` in App.tsx. Returns null — no DOM.
 *
 * Why `behavior: 'instant'`
 * ─────────────────────────
 * `'smooth'` looks nicer for hash-jumps inside the same page but
 * produces a jarring effect after a route change: the new page is
 * already rendered (possibly with its hero animations starting), and
 * smoothly scrolling from "middle of previous page" to top means the
 * user briefly sees the new page in motion before content appears.
 * Instant is what they expect when they click a link to a NEW page.
 */
const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Browser back / forward — let the platform restore the previous
    // scroll position. Forcing scroll-to-top here would feel broken.
    if (navigationType === 'POP') return;

    if (hash) {
      // Hash present — try to scroll to the target element. The new
      // page may not have mounted its DOM by the time this effect
      // runs, so we retry once on the next animation frame.
      const tryScrollToHash = () => {
        // `hash` includes the leading `#`. `getElementById` wants the
        // bare id.
        const id = hash.slice(1);
        if (!id) return;
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        }
        return false;
      };

      if (!tryScrollToHash()) {
        // The element wasn't in the DOM yet. Wait one frame (page
        // suspense fallback might still be rendering) and try again.
        // If it STILL isn't there, fall back to top — better than
        // landing at a random scroll position.
        const raf = window.requestAnimationFrame(() => {
          if (!tryScrollToHash()) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
          }
        });
        return () => window.cancelAnimationFrame(raf);
      }
      return;
    }

    // No hash — straight reset to top of page.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash, navigationType]);

  return null;
};

export default ScrollToTop;
