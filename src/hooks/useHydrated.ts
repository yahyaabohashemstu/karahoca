import { startTransition, useEffect, useState, useSyncExternalStore } from 'react';
import { isPrerendering, isPrerenderedDocument } from '../utils/prerenderData';

const noopSubscribe = () => () => {};

/**
 * `false` while the prerender takes its snapshot and while the browser
 * hydrates that snapshot; `true` everywhere else (including in-app
 * navigation, where it is `true` from the first render).
 *
 * For UI INSIDE a page that depends on browser-only state or loads after
 * mount (the catalog viewer…): render its initial/placeholder form while
 * this is `false`, so the snapshot and the first hydration render agree.
 * React re-renders with `true` right after that component hydrates
 * (`useSyncExternalStore` compares the server snapshot with the client one
 * after commit — no subscription needed).
 *
 * Not for app-wide providers above the page's <Suspense>: their forced
 * re-render would reach the page before it has hydrated (React then
 * discards the HTML). Use `useHydratedTransition` there.
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(noopSubscribe, () => !isPrerendering(), () => false);

/**
 * Same contract as `useHydrated`, for components ABOVE the page's Suspense
 * boundary (e.g. WishlistProvider). The switch to `true` is a transition,
 * which React applies only after pending hydration — the documented way to
 * update a tree that is still hydrating.
 */
export const useHydratedTransition = (): boolean => {
  const [hydrated, setHydrated] = useState(() => !isPrerendering() && !isPrerenderedDocument());
  useEffect(() => {
    if (hydrated || isPrerendering()) return;
    startTransition(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
};
