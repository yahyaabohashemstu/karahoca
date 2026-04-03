import { getDb } from '../db.mjs';

const SITE_URL = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/$/, '');

const escapeXml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const handleSitemap = (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    // Brand pages: derive lastmod from latest product update
    const dioxLastMod = (db.prepare(
      `SELECT MAX(updated_at) AS m FROM products WHERE active=1 AND brand='DIOX'`
    ).get()?.m || today).slice(0, 10);

    const ayluxLastMod = (db.prepare(
      `SELECT MAX(updated_at) AS m FROM products WHERE active=1 AND brand='AYLUX'`
    ).get()?.m || today).slice(0, 10);

    // Static pages with dynamic lastmod for brand pages
    const staticPages = [
      { url: '/',          priority: '1.0', changefreq: 'weekly',  lastmod: today        },
      { url: '/diox',      priority: '0.9', changefreq: 'weekly',  lastmod: dioxLastMod  },
      { url: '/aylux',     priority: '0.9', changefreq: 'weekly',  lastmod: ayluxLastMod },
      { url: '/news',      priority: '0.8', changefreq: 'daily',   lastmod: today        },
      { url: '/about',     priority: '0.7', changefreq: 'monthly', lastmod: today        },
      { url: '/wishlist',  priority: '0.3', changefreq: 'never',   lastmod: today        },
    ];

    // Dynamic news slugs
    const newsRows = db.prepare(
      `SELECT slug, published_at, updated_at FROM news WHERE active=1 ORDER BY published_at DESC`
    ).all();

    const urls = [
      ...staticPages.map(p => `
  <url>
    <loc>${escapeXml(SITE_URL + p.url)}</loc>
    <lastmod>${escapeXml(p.lastmod)}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),
      ...newsRows.map(n => `
  <url>
    <loc>${escapeXml(SITE_URL + '/news#' + n.slug)}</loc>
    <lastmod>${escapeXml((n.updated_at || n.published_at || today).slice(0, 10))}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(xml);
  } catch (err) {
    console.error('[sitemap] Error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Sitemap generation failed');
  }
};
