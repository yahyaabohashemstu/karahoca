/**
 * Glue between the build-time prerender (scripts/prerender.mjs) and the app.
 *
 * Production pages are prerendered snapshots that the browser HYDRATES. For
 * hydration to work, the first client render must produce exactly the
 * snapshot's markup — but the snapshot was taken after the page's API
 * calls had finished, while a fresh client render starts with nothing.
 * So the prerender embeds every API response the page used:
 *
 *   <script id="kh-prerender-data" type="application/json">
 *     { "/api/news?lang=en": { …response… }, … }
 *   </script>
 *
 * Data hooks read it for their initial state (same data → same markup), then
 * refresh from the API as usual. Pages without a snapshot have no embedded
 * data and behave exactly as before.
 */

let embedded: Record<string, unknown> | null | undefined;

const loadEmbedded = (): Record<string, unknown> | null => {
  if (embedded !== undefined) return embedded;
  embedded = null;
  if (typeof document === 'undefined') return embedded;
  const el = document.getElementById('kh-prerender-data');
  if (!el?.textContent) return embedded;
  try {
    const parsed: unknown = JSON.parse(el.textContent);
    if (parsed && typeof parsed === 'object') embedded = parsed as Record<string, unknown>;
  } catch {
    /* malformed — behave as if absent */
  }
  return embedded;
};

/**
 * The embedded response for an API path exactly as the app requests it
 * (e.g. "/api/news?lang=en"), or undefined.
 */
export const readPrerenderData = <T>(apiPath: string): T | undefined => {
  const data = loadEmbedded();
  return data && Object.prototype.hasOwnProperty.call(data, apiPath) ? (data[apiPath] as T) : undefined;
};

/**
 * True while scripts/prerender.mjs is taking the snapshot. Components that
 * only appear later (timers) or depend on the visitor stay out of it, so
 * the snapshot equals what a first client render produces.
 */
export const isPrerendering = (): boolean =>
  typeof window !== 'undefined' && (window as { __KH_PRERENDER__?: boolean }).__KH_PRERENDER__ === true;

/** True when this document is a prerendered snapshot (being hydrated). */
export const isPrerenderedDocument = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.hasAttribute('data-kh-prerendered');
