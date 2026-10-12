/**
 * Post-build prerender.
 *
 * For each target route we load the real built SPA in headless Chromium
 * (served from dist/ by a tiny local server), wait for it to render, then
 * write `document.documentElement.outerHTML` to `dist/<route>/index.html`.
 * nginx (web/nginx.conf) serves that file for the route, so crawlers and
 * link previewers (WhatsApp, Facebook, Telegram, Bing, Yandex…) get the
 * page's own title, description, canonical and content without running
 * JavaScript. The browser then HYDRATES that markup (src/main.tsx).
 *
 * Hydration has to see exactly what the snapshot shows, so:
 *   • Every API GET the page makes is answered from Node (no CORS: the API
 *     only grants credentialed CORS to the site's own origins) and the
 *     responses are embedded in the page as
 *     <script id="kh-prerender-data" type="application/json">. The data
 *     hooks use it for their FIRST render (src/utils/prerenderData.ts)
 *     and refresh in the background as usual.
 *   • `window.__KH_PRERENDER__` is set before the app boots; components that
 *     only appear after a timer or depend on the visitor (chat widget,
 *     cookie banner…) stay out of the snapshot.
 *   • Non-GET API calls (tracking, blog view counter, chat log…) are
 *     answered locally and never reach production; analytics hosts are
 *     blocked.
 *
 * dist/index.html is NOT touched: it stays the blank SPA shell that nginx
 * serves for routes without a snapshot and as the body of 404s.
 *
 * Env:
 *   SKIP_PRERENDER=1            skip entirely (exit 0)
 *   PRERENDER_API_URL           API origin for data (default: VITE_BACKEND_URL,
 *                               then https://api.karahoca.com)
 *   PUPPETEER_EXECUTABLE_PATH   system Chromium (the web Docker image uses
 *                               Debian's /usr/bin/chromium)
 *   PRERENDER_DIST              alternative dist directory (diagnostics)
 *   PRERENDER_STRICT=1          exit 1 when prerendering is broken outright
 *                               (Chromium won't start, or not one route
 *                               rendered). Off by default, so a broken
 *                               prerender never blocks a deploy. Failed
 *                               routes only warn: those URLs fall back to
 *                               the SPA shell, as before.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPrerenderServer } from './prerender-server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const distDir = path.resolve(process.env.PRERENDER_DIST || path.join(projectRoot, 'dist'));
const distIndex = path.join(distDir, 'index.html');
const dbPath = path.join(projectRoot, 'server', 'data', 'karahoca.db');
const STRICT = process.env.PRERENDER_STRICT === '1';

const API_ORIGIN = (
  process.env.PRERENDER_API_URL || process.env.VITE_BACKEND_URL || 'https://api.karahoca.com'
).trim().replace(/\/+$/, '');

// Language-agnostic slugs, expanded into `/<lang><slug>` for every language.
// wishlist / unsubscribe are per-visitor pages (noindex) — not prerendered.
const STATIC_SLUGS = ['/', '/diox', '/aylux', '/about', '/news', '/blog', '/production', '/goal', '/dryer', '/privacy', '/terms'];
const SUPPORTED_LANGS = ['ar', 'en', 'tr', 'ru'];

const joinLang = (lang, slug) => (slug === '/' ? `/${lang}/` : `/${lang}${slug}`);

const ROUTE_TIMEOUT_MS = 20_000;
const NAV_TIMEOUT_MS = 30_000;
const MAX_ARTICLES = 60; // per kind (news / blog), newest first — bounds build time
const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/i;

const ANALYTICS_HOSTS = /(google-analytics|googletagmanager|doubleclick|sentry\.io|ingest\.sentry|hotjar|clarity\.ms|facebook\.net|connect\.facebook)/i;

const fail = (msg) => {
  console.error(`[prerender] ${msg}`);
  process.exit(STRICT ? 1 : 0);
};

// ─── Preflight ──────────────────────────────────────────────────────────────
if (process.env.SKIP_PRERENDER === '1') {
  console.log('[prerender] SKIP_PRERENDER=1 — skipping.');
  process.exit(0);
}
if (!existsSync(distIndex)) fail(`${distIndex} not found — run \`vite build\` first.`);

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  fail('puppeteer is not installed (npm install --save-dev puppeteer).');
}

// ─── Article slugs (news + blog) ────────────────────────────────────────────
const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const discoverFromApi = async () => {
  const news = await fetchJson(`${API_ORIGIN}/api/news?lang=ar`);
  const blog = await fetchJson(`${API_ORIGIN}/api/blog/posts?lang=ar&limit=50&page=1`);
  let blogItems = blog.items || [];
  for (let page = 2; page <= (blog.totalPages || 1) && blogItems.length < MAX_ARTICLES; page++) {
    blogItems = blogItems.concat((await fetchJson(`${API_ORIGIN}/api/blog/posts?lang=ar&limit=50&page=${page}`)).items || []);
  }
  return {
    news: (news.items || []).map((i) => i.slug),
    blog: blogItems.map((i) => i.slug),
  };
};

// Fallback for local builds without network: the dev SQLite file.
const discoverFromDb = async () => {
  if (!existsSync(dbPath)) return { news: [], blog: [] };
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const news = db.prepare(`SELECT slug FROM news WHERE active=1 AND (status='published' OR status IS NULL) ORDER BY published_at DESC`).all();
    const blog = db.prepare(`SELECT slug FROM blog_posts WHERE active=1 AND status='published' AND datetime(published_at) <= datetime('now') ORDER BY published_at DESC`).all();
    return { news: news.map((r) => r.slug), blog: blog.map((r) => r.slug) };
  } finally {
    db.close();
  }
};

const discoverArticles = async () => {
  let found;
  try {
    found = await discoverFromApi();
    console.log(`[prerender] Article slugs from ${API_ORIGIN}`);
  } catch (e) {
    console.warn(`[prerender] API discovery failed (${e?.message}); trying the local DB.`);
    try { found = await discoverFromDb(); } catch { found = { news: [], blog: [] }; }
  }
  const clean = (list) => [...new Set(list.filter((s) => typeof s === 'string' && SLUG_RE.test(s)))].slice(0, MAX_ARTICLES);
  return { news: clean(found.news), blog: clean(found.blog) };
};

// ─── API proxy for the page ────────────────────────────────────────────────
// Answers the page's API requests from Node so CORS never applies, records
// GET bodies for embedding, and keeps every side effect away from production.
const isApiRequest = (url) => {
  try {
    const u = new URL(url);
    // Uploaded images load straight from the network (binary, no CORS
    // involved). Piping them through here as text would corrupt them, and
    // a broken image makes <ImageWithFallback> swap to its fallback URL —
    // which would then be baked into the snapshot.
    if (u.pathname.startsWith('/api/uploads/')) return false;
    return u.pathname.startsWith('/api/') && (url.startsWith(API_ORIGIN + '/') || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
};

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Visitor-Id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
});

// Endpoints whose data is per-visitor or irrelevant to the markup.
const NOT_EMBEDDED = /^\/api\/(csrf|ai\/|track\/|chat\/)/;

const installApiProxy = async (page, origin, recorded) => {
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    try {
      if (ANALYTICS_HOSTS.test(new URL(url).hostname)) return req.abort();
    } catch { /* data:/blob: URLs */ }
    if (!isApiRequest(url)) return req.continue();

    const u = new URL(url);
    const key = u.pathname + u.search;
    const method = req.method();
    if (method === 'OPTIONS') {
      return req.respond({ status: 204, headers: corsHeaders(origin), body: '' });
    }
    if (method !== 'GET' || u.pathname === '/api/csrf') {
      // Tracking, view counters, logs… stay local.
      return req.respond({ status: 200, contentType: 'application/json', headers: corsHeaders(origin), body: '{"success":true}' });
    }
    try {
      const res = await fetch(API_ORIGIN + key, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
      const body = await res.text();
      if (res.ok && !NOT_EMBEDDED.test(u.pathname) && (res.headers.get('content-type') || '').includes('json')) {
        recorded.set(key, body);
      }
      return req.respond({
        status: res.status,
        contentType: res.headers.get('content-type') || 'application/json',
        headers: corsHeaders(origin),
        body,
      });
    } catch (e) {
      console.warn(`[prerender] API ${key} failed: ${e?.message}`);
      return req.respond({ status: 503, contentType: 'application/json', headers: corsHeaders(origin), body: '{"success":false}' });
    }
  });
};

// ─── Snapshot ──────────────────────────────────────────────────────────────
// Runs in the page. Returns the full document as served HTML, made
// hydratable. React's hydrateRoot expects two things a DOM snapshot lacks
// but its own server renderer always emits:
//
//   1. Suspense boundary markers — <!--$--> … <!--/$--> around the content of
//      every <Suspense> (all lazy pages sit inside one). Without them
//      hydration fails at the first boundary ("initial UI does not match")
//      and React throws the whole page away and re-renders it.
//   2. <!-- --> between adjacent text nodes ({a}{b}): serialised HTML merges
//      them into one text node, which no longer matches.
//
// The boundaries are found by walking React's fiber tree from the root
// container (react-dom is pinned to 18.3.1 in package.json; fiber tags:
// 3 HostRoot, 4 HostPortal, 5 HostComponent, 6 HostText, 13 Suspense).
// A boundary that is showing its fallback is marked <!--$!--> ("render this
// one on the client"), which React also handles.
const snapshotScript = () => {
  document.querySelectorAll('[data-rh-restore]').forEach((el) => el.removeAttribute('data-rh-restore'));

  const container = document.getElementById('root');
  const rootKey = Object.keys(container).find((k) => k.startsWith('__reactContainer$'));
  if (!rootKey) throw new Error('React root not found on #root');

  // Elements whose content code inserts by hand after mount (e.g. an
  // inline SVG): React renders them empty, so the snapshot must too.
  container.querySelectorAll('[data-kh-client-only]').forEach((el) => el.replaceChildren());

  const HOST_PORTAL = 4;
  const HOST_COMPONENT = 5;
  const HOST_TEXT = 6;
  const SUSPENSE = 13;

  // Top-level DOM nodes a fiber renders (not descending into DOM nodes,
  // skipping portals, which render elsewhere).
  const hostNodesOf = (fiber) => {
    const out = [];
    const visit = (f) => {
      for (let c = f.child; c; c = c.sibling) {
        if (c.tag === HOST_COMPONENT || c.tag === HOST_TEXT) out.push(c.stateNode);
        else if (c.tag !== HOST_PORTAL) visit(c);
      }
    };
    visit(fiber);
    return out;
  };

  // For a boundary that renders nothing: the DOM parent it would render
  // into, and the first DOM node that follows it there (null = at the end).
  const HOST_ROOT = 3;
  const hostParentOf = (fiber) => {
    for (let f = fiber.return; f; f = f.return) {
      if (f.tag === HOST_COMPONENT) return f.stateNode;
      if (f.tag === HOST_ROOT) return f.stateNode.containerInfo;
    }
    return container;
  };
  const nextHostNodeAfter = (fiber) => {
    for (let f = fiber; f; ) {
      for (let s = f.sibling; s; s = s.sibling) {
        if (s.tag === HOST_COMPONENT || s.tag === HOST_TEXT) return s.stateNode;
        if (s.tag !== HOST_PORTAL) {
          const nodes = hostNodesOf(s);
          if (nodes.length) return nodes[0];
        }
      }
      f = f.return;
      if (!f || f.tag === HOST_COMPONENT || f.tag === HOST_ROOT) return null;
    }
    return null;
  };

  let boundaries = 0;
  const markSuspense = (fiber) => {
    if (fiber.tag === SUSPENSE) {
      const nodes = hostNodesOf(fiber).filter((n) => n && n.parentNode);
      const showingFallback = fiber.memoizedState !== null;
      const start = document.createComment(showingFallback ? '$!' : '$');
      const end = document.createComment('/$');
      if (nodes.length === 0) {
        // Renders nothing: an empty marker pair where it sits, exactly what
        // React's server renderer emits for it.
        const parent = hostParentOf(fiber);
        const before = nextHostNodeAfter(fiber);
        parent.insertBefore(start, before);
        parent.insertBefore(end, before);
      } else {
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        first.parentNode.insertBefore(start, first);
        last.parentNode.insertBefore(end, last.nextSibling);
      }
      boundaries++;
    }
    // Pre-order: an outer boundary's markers go in before its inner ones,
    // so they nest correctly around shared first/last nodes.
    for (let c = fiber.child; c; c = c.sibling) {
      if (c.tag !== HOST_PORTAL) markSuspense(c);
    }
  };
  // The container holds the HostRoot fiber it was created with; React keeps
  // two alternating trees, so that object may be the stale one. The live tree
  // is FiberRoot.current.
  markSuspense(container[rootKey].stateNode.current);

  // Separate adjacent text nodes the way React's server renderer does.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const texts = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n);
  for (const t of texts) {
    if (t.previousSibling && t.previousSibling.nodeType === Node.TEXT_NODE) {
      t.parentNode.insertBefore(document.createComment(' '), t);
    }
  }

  // Announce every script the page ran that the HTML doesn't name yet
  // (Vite links route chunks itself; the language's translation chunk is a
  // plain import()). Hydration waits for all of them; with a modulepreload
  // the browser fetches them alongside the main bundle instead of after it
  // has run.
  const announced = new Set(
    [...document.querySelectorAll('script[src], link[rel="modulepreload"]')]
      .map((el) => new URL(el.getAttribute('src') || el.getAttribute('href'), location.href).pathname),
  );
  for (const entry of performance.getEntriesByType('resource')) {
    const url = new URL(entry.name);
    if (url.origin !== location.origin || !/^\/assets\/[^/]+\.js$/.test(url.pathname) || announced.has(url.pathname)) continue;
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.crossOrigin = '';
    link.href = url.pathname;
    document.head.appendChild(link);
    announced.add(url.pathname);
  }

  document.documentElement.setAttribute('data-kh-prerendered', String(boundaries));
  return '<!doctype html>\n' + document.documentElement.outerHTML;
};

// The recorded API responses, as a JSON <script> just before </head>.
// `<` is escaped so no response body can close the script element.
const embedData = (html, recorded) => {
  if (recorded.size === 0) return html;
  const data = {};
  for (const [key, body] of recorded) {
    try { data[key] = JSON.parse(body); } catch { /* not JSON */ }
  }
  // Characters that could end the <script> element or break JS parsing are
  // written as JSON unicode escapes (built from char codes so no tooling can
  // turn the escape back into the raw character).
  const esc = (code) => String.fromCharCode(92) + 'u' + code.toString(16).padStart(4, '0');
  const unsafe = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  const json = JSON.stringify(data).replace(unsafe, (ch) => esc(ch.charCodeAt(0)));
  const tag = `<script id="kh-prerender-data" type="application/json">${json}</script>`;
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : html;
};

const writeRouteHtml = async (routePath, html) => {
  const relative = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!relative) throw new Error('refusing to overwrite dist/index.html (the SPA shell)');
  const outPath = path.join(distDir, relative, 'index.html');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  return path.relative(projectRoot, outPath);
};

const prerenderRoute = async (browser, origin, routePath) => {
  const started = Date.now();
  // One window per page. In a shared window every tab but the front one is
  // "hidden", and a hidden page never runs requestAnimationFrame — which is
  // when react-helmet-async writes <title>, description, canonical… into
  // <head>. With 4 parallel tabs, 3 snapshots out of 4 kept index.html's
  // generic head.
  const page = await browser.newPage({ type: 'window' });
  const recorded = new Map();
  const errors = [];
  try {
    await page.setViewport({ width: 1280, height: 900 });
    await page.setCacheEnabled(false);
    await page.evaluateOnNewDocument(() => { window.__KH_PRERENDER__ = true; });
    page.on('pageerror', (err) => errors.push(err.message));
    await installApiProxy(page, origin, recorded);

    await page.goto(origin + routePath, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        if (!root) return false;
        return Boolean(root.querySelector('h1, h2')) || (root.innerText || '').trim().length > 40;
      },
      { timeout: ROUTE_TIMEOUT_MS, polling: 100 },
    );
    // Let effects triggered by the last responses settle, then two frames
    // so Helmet's batched head update (next animation frame) has landed.
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const head = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      visibility: document.visibilityState,
      // Every page renders <SEO>, which always emits a canonical link;
      // index.html has none. So: present = this page's head is in place.
      canonical: document.querySelector('link[rel="canonical"][data-rh]')?.getAttribute('href') || '',
    }));
    const expected = routePath.split('/')[1];
    if (head.lang !== expected) throw new Error(`<html lang="${head.lang}">, expected "${expected}"`);
    if (head.visibility !== 'visible') throw new Error(`page is ${head.visibility} — its <head> was never updated`);
    let canonicalPath = '';
    try { canonicalPath = new URL(head.canonical).pathname; } catch { /* reported below */ }
    if (canonicalPath !== routePath) throw new Error(`canonical "${head.canonical}" — expected the page's own URL (head not updated?)`);
    if (errors.length) throw new Error(`page error: ${errors[0]}`);

    const html = embedData(await page.evaluate(snapshotScript), recorded);
    // Markup built from window.location (share links…) would carry this
    // server's address into production — hydration keeps it.
    // (Hostname only: inside an encoded URL the port's ":" reads "%3A".)
    const host = new URL(origin).hostname;
    if (html.includes(host)) throw new Error(`snapshot contains the prerender address ${host} (markup built from window.location?)`);
    const out = await writeRouteHtml(routePath, html);
    console.log(`[prerender] ✓ ${routePath.padEnd(40)} → ${out} (${Date.now() - started} ms, ${Math.round(html.length / 1024)} KB, ${recorded.size} API responses)`);
    return true;
  } catch (e) {
    console.error(`[prerender] ✗ ${routePath}: ${e?.message || e}`);
    return false;
  } finally {
    await page.close().catch(() => {});
  }
};

// ─── Main ──────────────────────────────────────────────────────────────────
const run = async () => {
  const shellHtml = await readFile(distIndex, 'utf8');
  const articles = await discoverArticles();

  const routes = [];
  for (const lang of SUPPORTED_LANGS) {
    for (const slug of STATIC_SLUGS) routes.push(joinLang(lang, slug));
    for (const slug of articles.news) routes.push(joinLang(lang, `/news/${slug}`));
    for (const slug of articles.blog) routes.push(joinLang(lang, `/blog/${slug}`));
  }
  console.log(
    `[prerender] ${routes.length} routes: ${SUPPORTED_LANGS.length} languages × (${STATIC_SLUGS.length} pages + ` +
    `${articles.news.length} news + ${articles.blog.length} blog posts)`,
  );

  const { origin, close: closeServer } = await startPrerenderServer({ rootDir: distDir, shellHtml });
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
    });
  } catch (e) {
    await closeServer();
    fail(`Chromium failed to launch: ${e?.message}`);
  }

  let ok = 0;
  let failed = 0;
  // A few pages in parallel: the work is mostly waiting on the network.
  const queue = [...routes];
  const worker = async () => {
    while (queue.length) {
      const route = queue.shift();
      if (await prerenderRoute(browser, origin, route)) ok++;
      else failed++;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  await browser.close();
  await closeServer();
  console.log(`[prerender] done: ${ok} ok, ${failed} failed`);
  if (STRICT && ok === 0) process.exit(1);
  process.exit(0);
};

run().catch((e) => fail(`fatal: ${e?.stack || e}`));
