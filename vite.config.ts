import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// ─── Service Worker (PWA) configuration ─────────────────────────────────────
// Why we use vite-plugin-pwa
//   - Precaches every hashed asset Vite emits (deterministic file names →
//     safe to cache forever).
//   - Generates a self-updating SW manifest with built-in version control.
//   - Exposes a Workbox `Window` API on the client so we can ship an
//     "update available" prompt without writing the SW boilerplate.
//
// Strategy
//   - Precache: all hashed `/assets/*` (immutable, named by content hash)
//   - Runtime cache (NetworkFirst):
//       /  + every prerendered HTML            → freshness wins, but works offline
//       /api/*                                  → NEVER cached; always live
//       images at the root (webp/png/...)       → CacheFirst with 30-day expiration
//
// Kill switch
//   - To uninstall the SW for ALL users, set `disable: true` below and
//     ship a release. The plugin's `selfDestroying: true` will register a
//     no-op SW that unregisters itself, then expires.
//   - To opt out of generating a SW at all (clean rollback):
//     comment out `VitePWA({...})` in the plugins array.
//
// What can break
//   - First-deploy users get a stale shell on second visit until the SW
//     finishes updating in the background. We mitigate by setting
//     `clientsClaim: true` and `skipWaiting: true` so the new SW takes
//     over IMMEDIATELY on the next navigation.
//   - If a release ships a broken SW, every user with the old SW will
//     keep serving stale cached assets forever. The kill switch above is
//     the documented escape hatch.
const pwaConfig = {
  registerType: 'autoUpdate' as const,
  injectRegister: 'auto' as const,
  // Full uninstall switch. Flip both to `true` and ship to remove the SW
  // from every existing client. Leave `false` for normal operation.
  disable: false,
  selfDestroying: false,
  workbox: {
    // Tell Workbox what files in the build output qualify for precaching.
    // STRATEGY: precache the SHELL only — JS, CSS, fonts, prerendered HTML,
    // and small UI assets (favicon, sw register helpers). Product images
    // and the world map / employees illustrations are LARGE and only
    // needed on specific pages, so they get a `runtimeCaching` rule
    // (CacheFirst, see below) — fetched on demand and cached for next
    // time, but never bulk-downloaded on first visit.
    //
    // Why this matters: if we precached every WebP under aylux-images/
    // and diox-images/ the SW would yank ~18 MB onto the user's device
    // immediately after page load — a brutal hit on mobile data. With
    // shell-only precaching the SW installs after ~2-3 MB of essentials.
    //
    // PNG/JPG are excluded because prune-dist.mjs deletes them post-build
    // when a WebP sibling exists. PDFs (Catalog) load via FlipBook and
    // shouldn't sit in the SW cache.
    globPatterns: ['**/*.{js,css,html,woff2,ico,webmanifest,json,webp,svg}'],
    globIgnores: [
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.pdf',
      '**/*.mp3',
      '**/*.mp4',
      // Big illustrations — runtime-cache only.
      'employees*.webp',
      'employees*.svg',
      'world-map.svg',
      // Product image folders — runtime-cache only.
      'aylux-images/**',
      'diox-images/**',
      'logos/**',
      'flags/**',
      // Small marketing assets that belong on home — keep precached
      // (KARAHOCA-*.webp, cropped-karahoca-*.webp, karahoca-logo-*.webp).
      // They're whitelisted by NOT appearing in this ignore list.
    ],
    // 4 MB cap per individual file. pdfjs-DhSS9SmZ.js (~445 KB) and
    // markdown vendor (~184 KB) sit comfortably under this; any future
    // mega-bundle would loudly fail the build instead of silently
    // bloating the SW.
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    // Activate the new SW immediately on next navigation; otherwise the
    // browser's default behaviour leaves the OLD SW in control until
    // every tab to the site is closed.
    clientsClaim: true,
    skipWaiting: true,
    // Don't precache the original Vite shell; prerendered HTMLs are what
    // we want served. The shell is fine as a fallback, picked up by the
    // navigateFallback below.
    navigateFallback: '/index.html',
    // Don't intercept API calls — those must stay live. Anything matching
    // these URLs bypasses the SW and goes straight to the network.
    navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
    runtimeCaching: [
      // Static images at root: Cache-First with TTL. Originals don't have
      // hash names so we expire them after 30 days to allow updates.
      {
        urlPattern: /\.(?:webp|png|jpg|jpeg|gif|svg|ico)$/i,
        handler: 'CacheFirst' as const,
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // Self-hosted Inter / future fonts.
      {
        urlPattern: /\.(?:woff2?|ttf|otf)$/i,
        handler: 'CacheFirst' as const,
        options: {
          cacheName: 'fonts',
          expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
    ],
  },
  // We already ship a hand-crafted manifest.json in /public with all
  // shortcuts, screenshots, and icon sizes the existing one declares.
  // Telling the plugin not to generate one prevents a competing
  // /manifest.webmanifest from appearing alongside our existing route.
  manifest: false as const,
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA(pwaConfig),
  ],
  server: {
    host: '0.0.0.0',  // expose to LAN — access from phone via IP
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own async chunks so they
        // only load on pages that actually use them (AIChatWidget, FlipBook).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('mdast-') || id.includes('micromark') || id.includes('unist-') || id.includes('hast-')) {
            return 'markdown';
          }
          if (id.includes('react-helmet-async')) return 'seo-vendor';
          if (id.includes('/react-dom/') || id.includes('\\react-dom\\')) return 'react-vendor';
          if (id.includes('/react/') || id.includes('\\react\\')) return 'react-vendor';
          if (id.includes('react-router')) return 'react-vendor';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n-vendor';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'esbuild',
    reportCompressedSize: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
  },
})
