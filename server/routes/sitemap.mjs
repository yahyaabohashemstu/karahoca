import { getDb } from '../db.mjs';

const SITE_URL = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/$/, '');
const LANGS = ['ar', 'en', 'tr', 'ru'];

const escapeXml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Build hreflang <xhtml:link> alternates for a given path */
function hreflangLinks(pagePath) {
  const escaped = escapeXml(SITE_URL + pagePath);
  return [
    ...LANGS.map(l => `      <xhtml:link rel="alternate" hreflang="${l}" href="${escaped}" />`),
    `      <xhtml:link rel="alternate" hreflang="x-default" href="${escaped}" />`,
  ].join('\n');
}

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

    // All public pages (excluding utility pages like /wishlist, /unsubscribe)
    const staticPages = [
      { url: '/',           priority: '1.0', changefreq: 'weekly',  lastmod: today        },
      { url: '/diox',       priority: '0.9', changefreq: 'weekly',  lastmod: dioxLastMod  },
      { url: '/aylux',      priority: '0.9', changefreq: 'weekly',  lastmod: ayluxLastMod },
      { url: '/news',       priority: '0.8', changefreq: 'daily',   lastmod: today        },
      { url: '/about',      priority: '0.7', changefreq: 'monthly', lastmod: today        },
      { url: '/production', priority: '0.7', changefreq: 'monthly', lastmod: today        },
      { url: '/goal',       priority: '0.6', changefreq: 'monthly', lastmod: today        },
      { url: '/dryer',      priority: '0.6', changefreq: 'monthly', lastmod: today        },
      { url: '/privacy',    priority: '0.3', changefreq: 'yearly',  lastmod: today        },
      { url: '/terms',      priority: '0.3', changefreq: 'yearly',  lastmod: today        },
    ];

    // Dynamic news article routes
    const newsRows = db.prepare(
      `SELECT slug, published_at, updated_at FROM news WHERE active=1 ORDER BY published_at DESC`
    ).all();

    const staticUrls = staticPages.map(p => `
  <url>
    <loc>${escapeXml(SITE_URL + p.url)}</loc>
    <lastmod>${escapeXml(p.lastmod)}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
${hreflangLinks(p.url)}
  </url>`);

    const newsUrls = newsRows.map(n => {
      const newsPath = `/news/${n.slug}`;
      const lastmod = (n.updated_at || n.published_at || today).slice(0, 10);
      return `
  <url>
    <loc>${escapeXml(SITE_URL + newsPath)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
${hreflangLinks(newsPath)}
  </url>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...staticUrls, ...newsUrls].join('')}
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
