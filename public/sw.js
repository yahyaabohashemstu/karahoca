/**
 * Self-destroying Service Worker — kill switch for the previously-deployed PWA.
 *
 * Why this file exists
 * ────────────────────
 * Commit a5ce4ab shipped a Workbox-generated Service Worker via
 * vite-plugin-pwa. That SW registered `clientsClaim: true; skipWaiting:
 * true;` so it took control of every visitor's tab on first navigation
 * after the build was deployed. The follow-up revert removes
 * vite-plugin-pwa entirely — but browsers that already registered the
 * old SW will keep running it until something explicitly tears it down.
 *
 * Without this file, returning visitors would be served the old cached
 * assets indefinitely and never see new deploys. (The classic
 * "ghost user" problem.)
 *
 * How it works
 * ────────────
 * When the browser next checks `/sw.js` (it auto-fetches the SW
 * registration script on every navigation that matches the SW scope),
 * it will see this new content, treat it as an update, and install +
 * activate it — `skipWaiting()` ensures we don't wait for tabs to
 * close. The `activate` handler then:
 *
 *   1. Empties every `caches` entry this origin owns (workbox-precache-*,
 *      images, fonts — names don't matter, we clear them all).
 *   2. Calls `self.registration.unregister()` — the browser drops this
 *      SW from its registry. Future navigations bypass it entirely.
 *   3. Forces every open client to reload via `client.navigate(url)`,
 *      so currently-open tabs immediately switch to the fresh,
 *      no-SW behaviour instead of waiting for a manual refresh.
 *
 * The `fetch` handler is a transparent pass-through so any in-flight
 * requests during activation don't get dropped.
 *
 * How long to keep this file
 * ───────────────────────────
 * Two weeks is plenty — visitors who don't return within that window
 * had their SW evicted by the browser's storage quota anyway. After
 * that you can safely `rm public/sw.js` and the next deploy will
 * remove the file from production, returning the site to a clean
 * no-SW baseline.
 */

self.addEventListener('install', (event) => {
  // Don't wait for old tabs to close — replace the old SW immediately.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      // 1. Purge every cache this origin holds. Wildcard delete catches
      //    workbox-precache-v2, images, fonts, and any other cache name
      //    the previous SW may have created — we don't need to know
      //    their exact names.
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch (_) {
      // caches may be unavailable in private mode / very old browsers.
      // The unregister below still removes the SW; missing cache cleanup
      // just means orphaned bytes the browser will GC eventually.
    }

    try {
      // 2. Drop the SW registration. After this, fetch events stop
      //    hitting this script and the browser talks straight to the
      //    network for every request.
      await self.registration.unregister();
    } catch (_) {
      // unregister can fail if another SW update is in flight. Worst
      // case the user keeps the SW one more cycle; the next visit
      // re-runs this whole flow.
    }

    try {
      // 3. Force a reload of every open tab so they pick up the fresh,
      //    SW-free page. Without this, an open tab's React tree keeps
      //    running with whatever the SW served originally — possibly
      //    invoking endpoints that no longer exist.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (_) { /* cross-origin or detached */ }
      }
    } catch (_) {
      // matchAll can throw in unusual lifecycle states. Same fallback:
      // the next page load gets the clean version anyway.
    }
  })());
});

// Pass-through fetch — keep the wire alive while the activate handler is
// still running. After unregister completes this handler stops being
// called at all, so the cost is bounded to one activation cycle.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => new Response('', { status: 503, statusText: 'Service Unavailable' })),
  );
});
