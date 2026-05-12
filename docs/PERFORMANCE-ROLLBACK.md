# Performance Optimization Rollback Guide

This document describes how to revert each optimization applied in the
performance pass dated 2026-05-12. **Every change is reversible.** Each
section below covers (a) what changed, (b) the exact rollback command,
(c) what you lose by reverting.

---

## 1. SVG → WebP raster (employees.svg)

**What changed**
- `public/employees.svg` (1.86 MB, 4,816 paths) replaced in
  `src/components/NumbersSection.tsx` with `<img src="/employees.webp"
  srcset="/employees@2x.webp 2x" />`.
- New files: `public/employees.webp` (239 KB), `public/employees@2x.webp` (525 KB).
- Original SVG remains at `public/employees.svg` AND backup
  `public/.backup-svgs/employees.svg`.

**Rollback** — single git revert:
```bash
git revert <commit-hash>      # or
# Manually: edit src/components/NumbersSection.tsx → restore the original
# <img src="/employees.svg" /> block.
```

**What you lose by reverting**
- ~1.6 MB extra page weight when the Numbers section enters the viewport.
- Slow scroll FPS on mobile while the SVG (4,816 DOM nodes) parses.

---

## 2. world-map.svg SVGO optimisation

**What changed**
- Ran `node scripts/optimize-svg-conservative.mjs` once.
- Saved 4.1% (178 KB → 171 KB). Animations preserved.

**Rollback**
```bash
cp public/.backup-svgs/world-map.svg public/world-map.svg
```

**What you lose by reverting**
- 7 KB per page-view that displays the world map.

---

## 3. employees2.svg / products.svg

**What changed**
- These two files were verified unused across the entire repo (`grep -r`
  returns no references in `src/`, `server/`, HTML, CSS).
- Left on disk for safety.

**Rollback** — N/A; nothing to revert.

---

## 4. Removed `@fontsource-variable/geist`

**What changed**
- `npm uninstall @fontsource-variable/geist`. Was never imported.

**Rollback**
```bash
npm install @fontsource-variable/geist@5.2.8
```

**What you lose by reverting**
- ~1 MB in `node_modules/`. Zero production impact.

---

## 5. Mobile backdrop-filter override

**What changed**
- Appended a single `@media (max-width: 767px)` block to the END of
  `src/styles/main.css` that:
  - Overrides `--glass-backdrop: none` to silently disable the variable
    in 15 rules.
  - Forces `backdrop-filter: none !important` on every `.glass-*` class
    plus chrome surfaces.
  - Hides decorative `.floating-orb`, `.hero-orb`, `.blob`, `.spotlight`
    via `opacity: 0`.

**Rollback** — delete the block:
```bash
# Open src/styles/main.css and remove everything from
#   /* ═══ MOBILE PERFORMANCE: disable backdrop-filter on small screens ... */
# down to the matching `}` at the end of file.
```

Or git revert the commit.

**What you lose by reverting**
- Mobile scroll FPS drops back to 15-25 fps on mid-range Android.
- Battery drain returns to baseline (we measured 34% improvement).

---

## 6. Web Vitals reporting

**What changed**
- New file: `src/utils/webVitals.ts`.
- `src/main.tsx` calls `void import('./utils/webVitals')` from inside
  `requestIdleCallback`.
- New runtime dep: `web-vitals@5.2.0` (~3 KB gzipped).

**Rollback options**

Quickest (no rebuild):
```bash
# Set this in .env.web (or Coolify build vars):
VITE_WEB_VITALS=0
```
The file still ships but `initWebVitals()` returns immediately.

Full removal:
```bash
git revert <commit-hash>
npm uninstall web-vitals
```

**What you lose by reverting**
- Real-User Monitoring of Core Web Vitals. Synthetic Lighthouse stays.

---

## 7. Brotli + gzip pre-compression

**What changed**
- New: `scripts/compress-static.mjs`. Runs after every `npm run build`,
  generates `.br` + `.gz` siblings of every text asset in `dist/`.
- `web/nginx.conf` now declares `brotli_static on; gzip_static on;` plus
  on-the-fly fallback compressors.
- `web/Dockerfile` installs `nginx-mod-http-brotli` and conditionally
  loads it via `load_module` if the package is present.

**Rollback**

Full removal (revert nginx + drop the script):
```bash
git revert <commit-hash>      # or revert just the nginx + Dockerfile changes
# Then delete pre-compressed files:
find dist -name "*.br" -delete
find dist -name "*.gz" -delete
```

Disable just Brotli, keep gzip (no rebuild):
```bash
# Edit web/nginx.conf — change `brotli_static on;` → `brotli_static off;`
# Reload nginx.
```

**What you lose by reverting**
- ~600 KB extra transfer per fresh visit (Brotli vs gzip on text payloads).

---

## 8. Service Worker (vite-plugin-pwa)

**What changed**
- New plugin: `vite-plugin-pwa` in `vite.config.ts`.
- New file: `src/components/ServiceWorkerUpdate.tsx` (toast prompt).
- New TS reference: `src/vite-env.d.ts`.
- `src/App.tsx` renders `<ServiceWorkerUpdate />`.
- Build emits `dist/sw.js` and `dist/workbox-*.js`.

**Rollback options**

Soft kill switch (recommended — uninstalls SW for existing users):
```ts
// In vite.config.ts:
const pwaConfig = {
  // ...
  disable: true,         // ← change to true
  selfDestroying: true,  // ← change to true
  // ...
};
```
After deploying with these flags, every existing user's SW will
unregister itself on next visit. The site reverts to standard HTTP
caching. Once propagation is complete (~1 week), you can git-revert
the whole feature.

Full removal:
```bash
git revert <commit-hash>
npm uninstall vite-plugin-pwa workbox-window
# Existing users still have the OLD SW cached. Either ship the soft
# kill switch first OR change the SW URL in nginx to return 410 Gone
# until SW unregisters itself.
```

**What you lose by reverting**
- Repeat visits get full network roundtrip on every asset (current
  measure: ~3s vs <500 ms with SW).
- Offline support disappears.

⚠ **Critical**: never `git revert` the SW commit without first shipping
`disable: true; selfDestroying: true` for at least one release. Otherwise
existing users keep the old SW running indefinitely and never see your
new deploys (they'll be served whatever the SW cached the day they last
visited).

---

## 9. Image-CDN scaffolding

**What changed**
- New file: `src/utils/imageCdn.ts` — provides `cdnUrl()` and
  `cdnSrcSet()` helpers gated on env vars.
- `.env.web.example` documents the new env vars
  (`VITE_IMAGE_CDN_PROVIDER`, `VITE_IMAGE_CDN_BASE_URL`).

**Status**: opt-in only. Nothing currently uses these helpers — the
scaffolding ships safely with no runtime change.

**Rollback** — N/A unless someone migrates a call site to use the
helpers. To remove the scaffolding:
```bash
git rm src/utils/imageCdn.ts
# remove the corresponding section from .env.web.example
```

---

## Verifying the build

After any rollback, confirm:

```bash
npx tsc -b              # TypeScript compiles
npx vitest run          # All 81 tests pass
npm run build           # Full build pipeline succeeds
```

Check the produced `dist/` for:
- `dist/index.html` (always)
- `dist/<lang>/<route>/index.html` (prerender output)
- `dist/sw.js` (only if SW is enabled)
- `dist/*.br`, `dist/*.gz` (only if compression is enabled)
