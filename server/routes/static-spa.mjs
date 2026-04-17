import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sendJson } from '../middlewares/cors.mjs';
import { getDb } from '../services/db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// routes/ is at server/routes/, so the built SPA lives at `../../dist`.
const distDir = path.join(__dirname, '..', '..', 'dist');
const spaIndex = path.join(distDir, 'index.html');

// ─── Static MIME table ──────────────────────────────────────────────────────
export const STATIC_MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.txt':  'text/plain',
  '.xml':  'application/xml',
  '.pdf':  'application/pdf',
  '.webmanifest': 'application/manifest+json',
});

// ─── Per-route SEO metadata ─────────────────────────────────────────────────
const ROUTE_META = {
  '/': {
    title: 'KARAHOCA - World-Class Cleaning Products | منظفات بجودة عالمية',
    description: 'KARAHOCA is the leading manufacturer of cleaning products in Turkey. Two brands: DIOX & AYLUX. 30+ years of experience, 200+ employees, 15+ countries.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/diox': {
    title: 'DIOX - Professional Cleaning Products | KARAHOCA',
    description: 'DIOX brand from KARAHOCA - professional cleaning products with superior power. Laundry detergents, all-purpose cleaners, liquid soap, and stain removers.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/aylux': {
    title: 'AYLUX - Premium Care Products | KARAHOCA',
    description: 'AYLUX brand from KARAHOCA - premium care products with elegant sophistication. Gel cleaners, liquid cleaners, liquid soap, and fragrances.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/about': {
    title: 'About Us - 30 Years Success Story | KARAHOCA',
    description: 'Discover KARAHOCA journey from 1995 to today. 30+ years experience, 15+ distribution countries, 2 global brands: DIOX & AYLUX.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/news': {
    title: 'News & Updates | KARAHOCA',
    description: 'Follow KARAHOCA news about new product launches, distribution agreements, exhibitions, and operational upgrades.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/production': {
    title: 'Production Process | KARAHOCA',
    description: 'Discover KARAHOCA advanced production process from raw materials to packaging with strict quality control.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/goal': {
    title: 'Our Goal | KARAHOCA',
    description: 'Learn about our goals and roadmap for continuous growth and innovation in the detergent sector.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/dryer': {
    title: 'Our Dryer | KARAHOCA',
    description: 'Discover KARAHOCA advanced dryer technology - high-capacity production with raw material manufacturing capability.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/privacy': {
    title: 'Privacy Policy | KARAHOCA',
    description: 'KARAHOCA privacy policy — how we collect, use, and protect your personal information.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/terms': {
    title: 'Terms of Service | KARAHOCA',
    description: 'KARAHOCA terms of service — rules and conditions for using our website.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
};

// Cache the raw HTML template at startup for meta injection.
let spaHtmlTemplate = '';
try {
  spaHtmlTemplate = existsSync(spaIndex) ? await readFile(spaIndex, 'utf8') : '';
} catch {
  /* dist/ may not exist during dev; SPA fallback simply becomes a no-op */
}

/** Escape HTML attribute values to prevent XSS injection. */
const escAttr = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const injectMeta = (html, routePath) => {
  let meta = ROUTE_META[routePath];

  // Dynamic news article meta from database.
  if (!meta && routePath.startsWith('/news/')) {
    try {
      const slug = routePath.replace('/news/', '');
      const db = getDb();
      const row = db
        .prepare(`SELECT title_en, excerpt_en, image FROM news WHERE slug=? AND active=1`)
        .get(slug);
      if (row) {
        meta = {
          title: `${row.title_en} | KARAHOCA`,
          description: row.excerpt_en || '',
          image: row.image || '/karahoca-logo-1-Photoroom.webp',
        };
      }
    } catch {
      /* fall back to uninjected HTML */
    }
  }

  if (!meta) return html;
  const siteUrl = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/+$/, '');
  const t = escAttr(meta.title);
  const d = escAttr(meta.description);
  const img = escAttr(`${siteUrl}${meta.image}`);
  const url = escAttr(`${siteUrl}${routePath}`);
  const ogType = routePath.startsWith('/news/') ? 'article' : 'website';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: meta.title,
    description: meta.description,
    url: `${siteUrl}${routePath}`,
    image: `${siteUrl}${meta.image}`,
    inLanguage: ['ar', 'en', 'tr', 'ru'],
    publisher: {
      '@type': 'Organization',
      name: 'KARAHOCA',
      url: siteUrl,
      logo: `${siteUrl}/cropped-karahoca-logo-s-.webp`,
    },
  }).replace(/</g, '\\u003c');

  const injectedHead = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${t}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:site_name" content="KARAHOCA">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join('\n    ');

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*">/, `<meta name="description" content="${d}">`)
    .replace('</head>', `    ${injectedHead}\n</head>`);
};

/**
 * GET /*
 * Serves any file in dist/ first; falls back to index.html (with injected
 * per-route meta) for unmatched paths so client-side routing works.
 *
 * Returns `true` if the request was handled, `false` otherwise (caller
 * should emit 404).
 */
export const serveStaticOrSpa = async (request, response, { origin, url }) => {
  if (!existsSync(distDir)) return false;

  let decodedUrl = url;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {
    decodedUrl = url;
  }

  const resolved = path.resolve(distDir, decodedUrl.replace(/^\//, ''));
  if (!resolved.startsWith(distDir + path.sep) && resolved !== distDir) {
    sendJson(response, 403, { success: false, error: 'Forbidden.' }, origin);
    return true;
  }

  const tryServeFile = async (fp) => {
    try {
      const s = await stat(fp);
      if (!s.isFile()) return false;
      const ext = path.extname(fp).toLowerCase();
      const mime = STATIC_MIME[ext] ?? 'application/octet-stream';
      const headers = { 'Content-Type': mime, 'Content-Length': String(s.size) };
      if (ext !== '.html') headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      response.writeHead(200, headers);
      createReadStream(fp).pipe(response);
      return true;
    } catch {
      return false;
    }
  };

  if (await tryServeFile(resolved)) return true;
  if (await tryServeFile(path.join(resolved, 'index.html'))) return true;

  if (spaHtmlTemplate) {
    const injected = injectMeta(spaHtmlTemplate, url.split('?')[0].split('#')[0]);
    const buf = Buffer.from(injected, 'utf8');
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(buf.length),
    });
    response.end(buf);
    return true;
  }

  return false;
};
