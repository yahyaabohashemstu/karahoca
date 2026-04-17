import { getDb } from '../services/db.mjs';
import { logger } from '../utils/logger.mjs';

const SITE_URL = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/$/, '');

const escapeXml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * hreflang policy:
 *
 * The site uses client-side (localStorage) language switching — ar, en, tr, ru
 * all live at the same URL. Emitting 4 hreflang alternates that all point to
 * the same `<loc>` is conflict-signal noise in Google Search Console. We emit
 * ONLY `x-default`, pointing at the same URL, which cleanly tells crawlers
 * "treat this URL as language-neutral."
 *
 * If (when) we move to URL-prefixed language routes (`/en/...`, `/ar/...`),
 * this function should emit one `<xhtml:link>` per language variant.
 */
const hreflangBlock = (pagePath) => {
  const escaped = escapeXml(SITE_URL + pagePath);
  return `      <xhtml:link rel="alternate" hreflang="x-default" href="${escaped}" />`;
};

const toIsoDate = (value) => {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const urlEntry = ({ path, priority, changefreq, lastmod }) => {
  const parts = [
    `  <url>`,
    `    <loc>${escapeXml(SITE_URL + path)}</loc>`,
  ];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push(hreflangBlock(path));
  parts.push(`  </url>`);
  return parts.join('\n');
};

export const handleSitemap = (req, res) => {
  try {
    const db = getDb();

    // ── Authoritative "last-modified" values pulled from DB ──────────────
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
    // lastmod is OMITTED for truly static pages (privacy, terms, about, etc.)
    // — lying "today" every day is a worse signal than no signal. Google
    // treats missing lastmod as "no info, use your own crawl data."
    const staticPages = [
      { path: '/',           priority: '1.0', changefreq: 'weekly',  lastmod: homeLastMod },
      { path: '/diox',       priority: '0.9', changefreq: 'weekly',  lastmod: dioxLastMod },
      { path: '/aylux',      priority: '0.9', changefreq: 'weekly',  lastmod: ayluxLastMod },
      { path: '/news',       priority: '0.8', changefreq: 'daily',   lastmod: maxNewsUpdate },
      { path: '/about',      priority: '0.7', changefreq: 'monthly', lastmod: null },
      { path: '/production', priority: '0.7', changefreq: 'monthly', lastmod: null },
      { path: '/goal',       priority: '0.6', changefreq: 'monthly', lastmod: null },
      { path: '/dryer',      priority: '0.6', changefreq: 'monthly', lastmod: null },
      { path: '/privacy',    priority: '0.3', changefreq: 'yearly',  lastmod: null },
      { path: '/terms',      priority: '0.3', changefreq: 'yearly',  lastmod: null },
    ];

    // ── Dynamic news articles ────────────────────────────────────────────
    const newsRows = db
      .prepare(
        `SELECT slug, published_at, updated_at
         FROM news
         WHERE active=1 AND status='published'
         ORDER BY published_at DESC`,
      )
      .all();

    const newsEntries = newsRows
      .filter((n) => typeof n?.slug === 'string' && n.slug.length > 0)
      .map((n) =>
        urlEntry({
          path: `/news/${n.slug}`,
          priority: '0.6',
          changefreq: 'monthly',
          lastmod: toIsoDate(n.updated_at) || toIsoDate(n.published_at),
        }),
      );

    const staticEntries = staticPages.map((p) => urlEntry(p));

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
      `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      [...staticEntries, ...newsEntries].join('\n') +
      `\n</urlset>\n`;

    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(xml);
  } catch (err) {
    logger.error('[sitemap] Error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Sitemap generation failed');
  }
};
