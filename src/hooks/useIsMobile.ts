import { useCallback, useSyncExternalStore } from "react";

/**
 * Returns `true` whenever the viewport is ≤ `breakpoint` pixels wide.
 *
 * Built on `useSyncExternalStore` with the media query as the store:
 *
 *   • A fresh client render (no prerendered HTML, or in-app navigation)
 *     reads `matchMedia` synchronously — a phone gets the mobile markup on
 *     the very first render, no flash.
 *   • HYDRATING a prerendered page, React uses the server snapshot
 *     (`false`): pages are prerendered at desktop width
 *     (scripts/prerender.mjs), so the first render matches the HTML, then
 *     React immediately re-renders with the real value. A plain
 *     `useState(matchMedia…)` would hydrate a phone with `true` against
 *     desktop markup — and React does not patch mismatched attributes
 *     during hydration, so desktop-only classes/styles would stick.
 *   • Subscribes to the query's `change` event (fires only when the answer
 *     flips — not on every resize), with the legacy `addListener` for
 *     Safari ≤ 14.
 *
 * @param breakpoint Width in pixels — viewport <= breakpoint counts as
 *                   mobile. Defaults to 768 to match the documented
 *                   `--bp-md` token in tokens.css.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const query = `(max-width: ${breakpoint}px)`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    },
    [query],
  );

  const getSnapshot = () =>
    typeof window !== "undefined" && window.matchMedia(query).matches;

  // The prerendered snapshot's value: desktop.
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
