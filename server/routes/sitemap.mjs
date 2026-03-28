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

    // Static pages
    const staticPages = [
      { url: '/',        priority: '1.0', changefreq: 'weekly'  },
      { url: '/diox',   priority: '0.9', changefreq: 'weekly'  },
      { url: '/aylux',  priority: '0.9', changefreq: 'weekly'  },
      { url: '/news',   priority: '0.8', changefreq: 'daily'   },
      { url: '/about',  priority: '0.7', changefreq: 'monthly' },
    ];

    // Dynamic news slugs
    const newsRows = db.prepare(
      `SELECT slug, published_at, updated_at FROM news WHERE active=1 ORDER BY published_at DESC`
    ).all();

    const today = new Date().toISOString().slice(0, 10);

    const urls = [
      ...staticPages.map(p => `
  <url>
    <loc>${escapeXml(SITE_URL + p.url)}</loc>
    <lastmod>${today}</lastmod>
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
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Sitemap generation failed');
  }
};
