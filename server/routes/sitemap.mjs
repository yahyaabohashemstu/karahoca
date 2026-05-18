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
 * Image sitemap extension:
 *   Brand pages (/diox, /aylux) and news articles emit nested <image:image>
 *   children listing every product photo / article hero. Google uses these
 *   for Google Images indexing and image-thumbnail enrichment of organic
 *   results. The `<image:title>` carries the localised product/article
 *   name so the same image URL gets four distinct titles, one per language
 *   variant of the parent <url>.
 *
 * Content coverage:
 *   - Static marketing pages (home, brands, about, production, goal, dryer,
 *     news index, privacy, terms)
 *   - Dynamic news articles (published + active) with cover image
 *   - "Product pages" — this site displays products as cards inside the
 *     /diox and /aylux brand pages (there is no /products/:id route), so
 *     the brand pages themselves ARE the product pages and get a lastmod
 *     derived from the most recent product row for that brand, plus the
 *     full gallery as image references.
 *
 * Caching: Cache-Control max-age=3600 — sitemap regenerates hourly on edge
 *   caches. For private nginx + Node setups this just reduces DB pressure.
 */

const SUPPORTED_LANGS = Object.freeze(['ar', 'en', 'tr', 'ru']);
const DEFAULT_LANG = 'ar';

const SITE_URL = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/$/, '');
// /api/uploads/* is served by the API host (api.karahoca.com), NOT by the
// frontend nginx that lives at karahoca.com. The sitemap must reference the
// canonical public URL where Googlebot will actually fetch the bytes, so
// uploaded images get the API host prefix and static images get SITE_URL.
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '') || SITE_URL;

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
 * Resolve a stored image path to a publicly-fetchable absolute URL.
 *   - already-absolute http(s):// URLs are returned unchanged
 *   - /api/uploads/<file>            → API_PUBLIC_URL + the same path
 *   - /<static>/<file>.{png,jpg}     → SITE_URL + the same path with
 *                                       extension rewritten to .webp because
 *                                       prune-dist.mjs drops the PNG in
 *                                       production when a WebP sibling exists
 *   - /<static>/<file>.webp          → SITE_URL + the same path
 * Returns null when the input is empty or unrecognisable so callers can skip.
 */
const resolveImageUrl = (raw) => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/api/uploads/')) return `${API_PUBLIC_URL}${trimmed}`;
  if (trimmed.startsWith('/')) {
    const webpised = trimmed.replace(/\.(png|jpe?g)$/i, '.webp');
    return `${SITE_URL}${webpised}`;
  }
  return null;
};

/**
 * Extract every image URL associated with a product (cover + gallery) and
 * pair it with a localised title for each supported language. Returns a
 * deduplicated array — the same URL appearing in both `image` and the
 * first gallery slot is emitted once.
 */
const productImages = (product) => {
  const urls = [];
  const seen = new Set();
  const push = (raw) => {
    const u = resolveImageUrl(raw);
    if (!u || seen.has(u)) return;
    seen.add(u);
    urls.push(u);
  };
  push(product.image);
  if (typeof product.gallery === 'string' && product.gallery.trim()) {
    try {
      const arr = JSON.parse(product.gallery);
      if (Array.isArray(arr)) for (const entry of arr) push(entry);
    } catch {
      // Gallery may legitimately be a non-JSON legacy string; ignore.
    }
  }
  const titles = {
    ar: product.name_ar || product.name_en || product.id || '',
    en: product.name_en || product.name_ar || product.id || '',
    tr: product.name_tr || product.name_en || product.name_ar || product.id || '',
    ru: product.name_ru || product.name_en || product.name_ar || product.id || '',
  };
  return urls.map((loc) => ({ loc, titles }));
};

/**
 * Emit one `<url>` element for a single language variant. The alternates
 * block includes every language plus `x-default` aliased to DEFAULT_LANG,
 * which is what Google recommends for sites that choose a fallback locale
 * rather than an auto-detected one. If `images` is supplied, every entry
 * becomes a nested <image:image> child with a localised title.
 */
const urlEntry = ({ pageSlug, lang, priority, changefreq, lastmod, images }) => {
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

  if (Array.isArray(images) && images.length > 0) {
    for (const img of images) {
      parts.push(`    <image:image>`);
      parts.push(`      <image:loc>${escapeXml(img.loc)}</image:loc>`);
      const title = img.titles?.[lang];
      if (title) parts.push(`      <image:title>${escapeXml(title)}</image:title>`);
      parts.push(`    </image:image>`);
    }
  }

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
    // The public-visibility predicate matches public-data.mjs exactly
    // so the sitemap can never advertise a URL the catalogue refuses
    // to serve. Crawlers that follow the sitemap and 404 lose trust
    // in the whole feed — this guard is the SLA.
    const PUBLIC_VISIBLE = `
      active=1
      AND (
        status='published'
        OR (status='scheduled' AND publish_at IS NOT NULL AND datetime(publish_at) <= datetime('now'))
      )
    `;
    const maxProductUpdate = toIsoDate(
      db.prepare(`SELECT MAX(updated_at) AS m FROM products WHERE ${PUBLIC_VISIBLE}`).get()?.m,
    );
    const maxNewsUpdate = toIsoDate(
      db.prepare(`SELECT MAX(COALESCE(updated_at, published_at)) AS m FROM news WHERE active=1`).get()?.m,
    );
    const dioxLastMod = toIsoDate(
      db.prepare(`SELECT MAX(updated_at) AS m FROM products WHERE ${PUBLIC_VISIBLE} AND brand='DIOX'`).get()?.m,
    );
    const ayluxLastMod = toIsoDate(
      db.prepare(`SELECT MAX(updated_at) AS m FROM products WHERE ${PUBLIC_VISIBLE} AND brand='AYLUX'`).get()?.m,
    );

    const homeLastMod =
      [maxProductUpdate, maxNewsUpdate].filter(Boolean).sort().slice(-1)[0] || null;

    // ── Product image collections (per brand) ────────────────────────────
    // Pulled once and re-used across the four language variants of each
    // brand page. Google de-duplicates internally if it sees the same image
    // URL referenced multiple times.
    const dioxRows = db
      .prepare(
        `SELECT id, name_ar, name_en, name_tr, name_ru, image, gallery
         FROM products
         WHERE ${PUBLIC_VISIBLE} AND brand='DIOX'
         ORDER BY display_order, id`,
      )
      .all();
    const ayluxRows = db
      .prepare(
        `SELECT id, name_ar, name_en, name_tr, name_ru, image, gallery
         FROM products
         WHERE ${PUBLIC_VISIBLE} AND brand='AYLUX'
         ORDER BY display_order, id`,
      )
      .all();

    const dioxImages = dioxRows.flatMap(productImages);
    const ayluxImages = ayluxRows.flatMap(productImages);

    // ── Static pages ─────────────────────────────────────────────────────
    // `pageSlug` is the language-AGNOSTIC segment. `localizedLoc` prepends
    // the /<lang>/ prefix per language at emit time. lastmod is omitted for
    // truly static pages — lying "today" every day is a worse crawl signal
    // than no signal (Google treats missing lastmod as "use your own data").
    const staticPages = [
      { pageSlug: '/',           priority: '1.0', changefreq: 'weekly',  lastmod: homeLastMod },
      { pageSlug: '/diox',       priority: '0.9', changefreq: 'weekly',  lastmod: dioxLastMod,  images: dioxImages },
      { pageSlug: '/aylux',      priority: '0.9', changefreq: 'weekly',  lastmod: ayluxLastMod, images: ayluxImages },
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
    // against downstream injection into the rendered XML). Each article
    // gets its hero image attached so Google Images can pick it up.
    const newsRows = db
      .prepare(
        `SELECT slug, image, title_ar, title_en, title_tr, title_ru,
                published_at, updated_at
         FROM news
         WHERE active=1 AND status='published'
         ORDER BY published_at DESC`,
      )
      .all();

    const newsPages = newsRows
      .filter((n) => typeof n?.slug === 'string' && /^[a-z0-9_-]+$/i.test(n.slug))
      .map((n) => {
        const heroUrl = resolveImageUrl(n.image);
        const images = heroUrl
          ? [{
              loc: heroUrl,
              titles: {
                ar: n.title_ar || n.title_en || n.slug,
                en: n.title_en || n.title_ar || n.slug,
                tr: n.title_tr || n.title_en || n.title_ar || n.slug,
                ru: n.title_ru || n.title_en || n.title_ar || n.slug,
              },
            }]
          : [];
        return {
          pageSlug: `/news/${n.slug}`,
          priority: '0.6',
          changefreq: 'monthly',
          lastmod: toIsoDate(n.updated_at) || toIsoDate(n.published_at),
          images,
        };
      });

    // ── Emit ─────────────────────────────────────────────────────────────
    const allPages = [...staticPages, ...newsPages];
    const body = allPages.map(expandPage).join('\n');

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
      `        xmlns:xhtml="http://www.w3.org/1999/xhtml"\n` +
      `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
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
