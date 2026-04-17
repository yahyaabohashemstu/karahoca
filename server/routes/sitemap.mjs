import { getDb } from '../services/db.mjs';
import { logger } from '../utils/logger.mjs';

/**
 * GET /sitemap.xml
 *
 * Fully dynamic, request-time sitemap. There is no static `public/sitemap.xml`
 * anymore — the file on disk (if present) is ignored by the server router.
 *
 * URL strategy (post Phase-1 refactor):
 *   Every page exists at a language-prefixed URL: /ar/..., /en/..., /tr/...,
 *   /ru/... . The root `/` is a client-side redirect to the preferred
 *   language and is intentionally NOT emitted in the sitemap (Google does
 *   not want to index redirect targets).
 *
 * hreflang strategy:
 *   Each logical page emits one <url> entry PER language, and every entry
 *   carries xhtml:link alternates pointing at all four language variants
 *   plus an `x-default` that aliases the Arabic URL (the default locale).
 *   This is the canonical pattern Google documents for multi-language sites
 *   with URL-prefixed locales (ref: developers.google.com/search/docs/
 *   specialty/international/localized-versions).
 *
 * Content coverage:
 *   - Static marketing pages (home, brands, about, production, goal, dryer,
 *     news index, privacy, terms)
 *   - Dynamic news articles (published + active)
 *   - "Product pages" — this site displays products as cards inside the
 *     /diox and /aylux brand pages (there is no /products/:id route), so
 *     the brand pages themselves ARE the product pages and get a lastmod
 *     derived from the most recent product row for that brand.
 *
 * Caching: Cache-Control max-age=3600 — sitemap regenerates hourly on edge
 *   caches. For private nginx + Node setups this just reduces DB pressure.
 */

const SUPPORTED_LANGS = Object.freeze(['ar', 'en', 'tr', 'ru']);
const DEFAULT_LANG = 'ar';

const SITE_URL = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/$/, '');

const escapeXml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** `/about` (language-agnostic slug) + `ar` → `https://karahoca.com/ar/about`. */
const localizedLoc = (pageSlug, lang) => {
  const normalizedSlug = pageSlug === '/' ? '' : pageSlug.replace(/^\/+/, '/');
  return `${SITE_URL}/${lang}${normalizedSlug}`;
};

const toIsoDate = (value) => {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/**
 * Emit one `<url>` element for a single language variant. The alternates
 * block includes every language plus `x-default` aliased to DEFAULT_LANG,
 * which is what Google recommends for sites that choose a fallback locale
 * rather than an auto-detected one.
 */
const urlEntry = ({ pageSlug, lang, priority, changefreq, lastmod }) => {
  const parts = [
    `  <url>`,
    `    <loc>${escapeXml(localizedLoc(pageSlug, lang))}</loc>`,
  ];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);

  for (const altLang of SUPPORTED_LANGS) {
    parts.push(
      `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${escapeXml(
        localizedLoc(pageSlug, altLang),
      )}" />`,
    );
  }
  parts.push(
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
      localizedLoc(pageSlug, DEFAULT_LANG),
    )}" />`,
  );

  parts.push(`  </url>`);
  return parts.join('\n');
};

/** Expand a single logical page into one <url> entry per supported language. */
const expandPage = (page) =>
  SUPPORTED_LANGS.map((lang) => urlEntry({ ...page, lang })).join('\n');

export const handleSitemap = (req, res) => {
  try {
    const db = getDb();

    // ── Authoritative "last-modified" values pulled from DB ──────────────
    // We derive lastmod from real row updates rather than `new Date()` so
    // crawlers don't get misled by a sitemap that looks fresh when nothing
    // actually changed.
    const maxProductUpdate = toIsoDate(
      db.prepare(`SELECT MAX(updated_at) AS m FROM products WHERE active=1`).get()?.m,
    );
    const maxNewsUpdate = toIsoDate(
      db.prepare(`SELECT MAX(COALESCE(updated_at, published_at)) AS m FROM news WHERE active=1`).get()?.m,
    );
    const dioxLastMod = toIsoDate(
      db.prepare(`SELECT MAX(updated_at) AS m FROM products WHERE active=1 AND brand='DIOX'`).get()?.m,
    );
    const ayluxLastMod = toIsoDate(
      db.prepare(`SELECT MAX(updated_at) AS m FROM products WHERE active=1 AND brand='AYLUX'`).get()?.m,
    );

    const homeLastMod =
      [maxProductUpdate, maxNewsUpdate].filter(Boolean).sort().slice(-1)[0] || null;

    // ── Static pages ─────────────────────────────────────────────────────
    // `pageSlug` is the language-AGNOSTIC segment. `localizedLoc` prepends
    // the /<lang>/ prefix per language at emit time. lastmod is omitted for
    // truly static pages — lying "today" every day is a worse crawl signal
    // than no signal (Google treats missing lastmod as "use your own data").
    const staticPages = [
      { pageSlug: '/',           priority: '1.0', changefreq: 'weekly',  lastmod: homeLastMod },
      { pageSlug: '/diox',       priority: '0.9', changefreq: 'weekly',  lastmod: dioxLastMod },
      { pageSlug: '/aylux',      priority: '0.9', changefreq: 'weekly',  lastmod: ayluxLastMod },
      { pageSlug: '/news',       priority: '0.8', changefreq: 'daily',   lastmod: maxNewsUpdate },
      { pageSlug: '/about',      priority: '0.7', changefreq: 'monthly', lastmod: null },
      { pageSlug: '/production', priority: '0.7', changefreq: 'monthly', lastmod: null },
      { pageSlug: '/goal',       priority: '0.6', changefreq: 'monthly', lastmod: null },
      { pageSlug: '/dryer',      priority: '0.6', changefreq: 'monthly', lastmod: null },
      { pageSlug: '/privacy',    priority: '0.3', changefreq: 'yearly',  lastmod: null },
      { pageSlug: '/terms',      priority: '0.3', changefreq: 'yearly',  lastmod: null },
    ];

    // ── Dynamic news articles ────────────────────────────────────────────
    // Only published + active rows. Slug is regex-sanitised to block any
    // row that somehow ended up with an unsafe slug (defence-in-depth
    // against downstream injection into the rendered XML).
    const newsRows = db
      .prepare(
        `SELECT slug, published_at, updated_at
         FROM news
         WHERE active=1 AND status='published'
         ORDER BY published_at DESC`,
      )
      .all();

    const newsPages = newsRows
      .filter((n) => typeof n?.slug === 'string' && /^[a-z0-9_-]+$/i.test(n.slug))
      .map((n) => ({
        pageSlug: `/news/${n.slug}`,
        priority: '0.6',
        changefreq: 'monthly',
        lastmod: toIsoDate(n.updated_at) || toIsoDate(n.published_at),
      }));

    // ── Emit ─────────────────────────────────────────────────────────────
    const allPages = [...staticPages, ...newsPages];
    const body = allPages.map(expandPage).join('\n');

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
      `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      body +
      `\n</urlset>\n`;

    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(xml);
  } catch (err) {
    logger.error({ err }, '[sitemap] generation failed');
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Sitemap generation failed');
  }
};
