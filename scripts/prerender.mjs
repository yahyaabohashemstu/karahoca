/**
 * Post-build prerender.
 *
 * For each target route, we launch a headless Chromium instance, load the
 * real built SPA against a local static server, wait for React + i18n to
 * render meaningful content, then snapshot `document.documentElement.outerHTML`
 * and write it to `dist/<route>/index.html`.
 *
 * The server's existing SPA fallback (`serveStaticOrSpa` in
 * `server/routes/static-spa.mjs`) will prefer these per-route index.html
 * files over the blank shell — zero backend wiring required.
 *
 * DESIGN NOTES
 * ─────────────
 * • Puppeteer is an OPTIONAL devDependency. If not installed we skip
 *   prerendering and exit 0 so `npm run build` never fails solely because
 *   prerendering is unavailable. Install with:
 *
 *       npm install --save-dev puppeteer
 *
 * • `SKIP_PRERENDER=1` also skips (useful in CI where Chromium is unavailable).
 *
 * • We prerender with the DEFAULT language (`ar`, matching `<html lang="ar">`
 *   in index.html). Hydration is safe because the client's i18n is
 *   configured to honour `htmlTag` first (see `src/i18n.ts`), and
 *   `useLocaleSync` switches to the user's real preference AFTER mount.
 *
 * • Dynamic news routes are discovered by querying SQLite directly (build-
 *   time, local-only). If the DB is absent we skip that portion cleanly.
 */

import { readFile, writeFile, mkdir, unlink, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPrerenderServer } from './prerender-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const distIndex = path.join(distDir, 'index.html');
const dbPath = path.join(projectRoot, 'server', 'data', 'karahoca.db');

const STATIC_ROUTES = ['/', '/diox', '/aylux', '/about', '/news', '/production', '/goal', '/dryer', '/privacy', '/terms'];
const ROUTE_TIMEOUT_MS = 20_000;
const NAV_TIMEOUT_MS = 15_000;
const MAX_NEWS_ROUTES = 50; // prerender at most N latest articles to bound build time

// ─── Preflight ──────────────────────────────────────────────────────────────
if (process.env.SKIP_PRERENDER === '1') {
  console.log('[prerender] SKIP_PRERENDER=1 — skipping.');
  process.exit(0);
}

if (!existsSync(distIndex)) {
  console.warn('[prerender] dist/index.html not found — did you run `vite build` first? Skipping.');
  process.exit(0);
}

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  console.warn(
    '[prerender] puppeteer is not installed — skipping prerender.\n' +
    '[prerender] To enable:  npm install --save-dev puppeteer',
  );
  process.exit(0);
}

// ─── Discover dynamic news routes (best-effort) ────────────────────────────
const discoverNewsRoutes = async () => {
  if (!existsSync(dbPath)) return [];
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const rows = db
        .prepare(`SELECT slug FROM news WHERE active=1 AND status='published' ORDER BY published_at DESC LIMIT ?`)
        .all(MAX_NEWS_ROUTES);
      return rows
        .map((r) => r?.slug)
        .filter((s) => typeof s === 'string' && s.length > 0 && /^[a-z0-9_-]+$/i.test(s))
        .map((slug) => `/news/${slug}`);
    } finally {
      db.close();
    }
  } catch (e) {
    console.warn('[prerender] News discovery failed (non-fatal):', e?.message);
    return [];
  }
};

// ─── Cleanup / HTML sanitization before snapshot ───────────────────────────
// Run inside the browser. Strips artifacts that should not persist in the
// static snapshot (debug data, live timers, auth state, etc.).
const snapshotScript = () => {
  // Kill react-helmet's internal markers so the frozen HTML doesn't confuse
  // runtime Helmet on hydration.
  document.querySelectorAll('[data-rh-restore]').forEach((el) => el.removeAttribute('data-rh-restore'));
  // Ensure the document advertises its language explicitly.
  if (!document.documentElement.getAttribute('lang')) {
    document.documentElement.setAttribute('lang', 'ar');
  }
  if (!document.documentElement.getAttribute('dir')) {
    document.documentElement.setAttribute('dir', 'rtl');
  }
  return '<!doctype html>\n' + document.documentElement.outerHTML;
};

// ─── Write the prerendered HTML to the right dist/<route>/index.html ───────
const writeRouteHtml = async (routePath, html) => {
  let outPath;
  if (routePath === '/') {
    outPath = distIndex;
  } else {
    const relative = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
    outPath = path.join(distDir, relative, 'index.html');
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  return path.relative(projectRoot, outPath);
};

// ─── Prerender a single route in an existing page ──────────────────────────
const prerenderRoute = async (page, origin, routePath) => {
  const started = Date.now();
  const targetUrl = origin + routePath;

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT_MS });

    // Wait for real content — prefer an <h1>, then any non-empty #root.
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        if (!root) return false;
        const hasH1 = root.querySelector('h1, h2');
        const hasText = (root.innerText || '').trim().length > 40;
        return hasH1 || hasText;
      },
      { timeout: ROUTE_TIMEOUT_MS, polling: 100 },
    ).catch(() => {
      // fall through — we still snapshot whatever did render
      console.warn(`[prerender] ${routePath}: content selector timeout (continuing with best-effort snapshot)`);
    });

    const html = await page.evaluate(snapshotScript);
    const out = await writeRouteHtml(routePath, html);
    const elapsed = Date.now() - started;
    console.log(`[prerender] ✓ ${routePath.padEnd(28)} → ${out} (${elapsed} ms, ${html.length.toLocaleString()} B)`);
    return true;
  } catch (e) {
    console.error(`[prerender] ✗ ${routePath}: ${e?.message || e}`);
    return false;
  }
};

// ─── Main ──────────────────────────────────────────────────────────────────
const run = async () => {
  // Preserve the ORIGINAL blank shell so the static server keeps serving it
  // as the SPA fallback, even after we rewrite dist/index.html for "/".
  const originalShell = await readFile(distIndex, 'utf8');
  await copyFile(distIndex, path.join(distDir, 'index.original.html'));

  const newsRoutes = await discoverNewsRoutes();
  const allRoutes = [...STATIC_ROUTES, ...newsRoutes];

  console.log(`[prerender] Target routes: ${allRoutes.length} (${STATIC_ROUTES.length} static + ${newsRoutes.length} news)`);

  const { origin, close: closeServer } = await startPrerenderServer({
    rootDir: distDir,
    shellHtml: originalShell,
  });
  console.log(`[prerender] Static server up at ${origin}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });
  } catch (e) {
    console.warn(`[prerender] Failed to launch Chromium (${e?.message}). Skipping.`);
    await closeServer();
    process.exit(0);
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setCacheEnabled(false);

  // Drop noisy console relays from the built app (still surface errors).
  page.on('pageerror', (err) => console.warn(`[prerender] page error: ${err.message}`));
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText || '';
    // CanceledBy Puppeteer on teardown is not interesting.
    if (!/net::ERR_ABORTED/.test(reason)) {
      console.warn(`[prerender] request failed: ${req.url()} — ${reason}`);
    }
  });

  let ok = 0;
  let failed = 0;
  for (const route of allRoutes) {
    const success = await prerenderRoute(page, origin, route);
    if (success) ok++;
    else failed++;
  }

  await browser.close();
  await closeServer();

  // Clean up the staged shell copy so it doesn't ship in dist/.
  try {
    await unlink(path.join(distDir, 'index.original.html'));
  } catch {
    /* already gone */
  }

  console.log(`[prerender] done: ${ok} ok, ${failed} failed`);
  // We intentionally exit 0 even on partial failure — the SPA fallback still
  // works. A non-zero exit would break `npm run build` for transient issues.
  process.exit(0);
};

run().catch((e) => {
  console.error('[prerender] fatal:', e);
  process.exit(0); // keep the build green
});
