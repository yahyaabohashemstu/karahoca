/**
 * server/routes/share.mjs — interstitial share routes that solve the
 * "SPA + crawler" problem for product / brand link sharing.
 *
 * The challenge
 * -------------
 * KARAHOCA is a single-page React app. Products live at hash deep-links
 * like `/diox#product-slug`. When a visitor shares that URL via WhatsApp,
 * the WhatsApp crawler does the following:
 *
 *   1. Strips the hash (hashes are client-side only).
 *   2. Fetches `https://karahoca.com/diox` over HTTP.
 *   3. Reads `<meta property="og:image">` from the returned HTML.
 *   4. DOES NOT execute JavaScript.
 *
 * Result: every product share shows the brand-level OG image, not the
 * actual product the visitor wanted to send to a friend.
 *
 * The fix
 * -------
 * Each product gets a dedicated server-side URL:
 *
 *   GET /share/product/{id}?lang=ar
 *
 * The API returns a tiny HTML document that:
 *
 *   - Has correct OG meta:
 *       og:image       → /og/product/{id}-{lang}.png  (= the product
 *                        photograph composited on a 1200×630 canvas)
 *       og:title       → the product's localised name
 *       og:description → the product's localised description
 *       og:type        → 'product'
 *   - Redirects a real browser to the SPA deep link via meta-refresh +
 *     JavaScript fallback. Crawlers don't follow either redirect (they
 *     stop after reading the head); browsers proceed within ~50ms.
 *
 * URL dispatch
 * ------------
 * The web nginx proxies `/share/*` to this endpoint (see web/nginx.conf)
 * so the visible URL stays on the trusted `karahoca.com` domain, but
 * the actual rendering happens on `api.karahoca.com`.
 *
 * Why we don't pre-render
 * -----------------------
 * Pre-rendering ~100 products × 4 languages × 2 brands = 800 HTML
 * shells we'd need to ship at every build. Admin edits would force a
 * rebuild every time the catalogue changes. The interstitial route is
 * fresh on every request, costs ~5ms (single SELECT + string template),
 * and never goes stale.
 */

import { getDb } from '../db.mjs';
import { logger } from '../utils/logger.mjs';

const SITE_URL = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/+$/, '');
const API_URL = (process.env.API_PUBLIC_URL || 'https://api.karahoca.com').replace(/\/+$/, '');

const SUPPORTED_LANGS = ['ar', 'en', 'tr', 'ru'];

const OG_LOCALE = { ar: 'ar_TR', en: 'en_US', tr: 'tr_TR', ru: 'ru_RU' };

/**
 * Escape an arbitrary string for safe use inside an HTML attribute or
 * text node. Belt-and-braces over the parser's natural handling — the
 * product name/description fields come from the admin panel where any
 * character is plausible.
 */
const htmlEscape = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * Map a product's brand to the canonical landing-page path. Hash-deep-link
 * navigation in the SPA expects /{lang}/{brand-slug}#{product-id}.
 */
const brandPathFor = (brand) => {
  const upper = (brand || '').toUpperCase();
  if (upper === 'DIOX') return 'diox';
  if (upper === 'AYLUX') return 'aylux';
  return 'home';
};

const buildShareHtml = ({ product, lang }) => {
  const brandSlug = brandPathFor(product.brand);
  const deepLink = `${SITE_URL}/${lang}/${brandSlug}#${product.id}`;
  const ogImageUrl = `${API_URL}/og/product/${encodeURIComponent(product.id)}-${lang}.png`;
  const title = product.name || product.id;
  const description = product.description || `${product.brand} — ${title}`;
  const ogLocale = OG_LOCALE[lang] || OG_LOCALE.ar;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- Crawlers (WhatsApp / Facebook / Twitter / LinkedIn / Telegram)
     read these tags WITHOUT executing JavaScript. The og:image points
     at our runtime OG generator which composites the actual product
     photograph onto a 1200×630 canvas. -->
<title>${htmlEscape(title)} — KARAHOCA</title>
<meta name="description" content="${htmlEscape(description)}">

<meta property="og:type" content="product">
<meta property="og:url" content="${htmlEscape(deepLink)}">
<meta property="og:title" content="${htmlEscape(title)}">
<meta property="og:description" content="${htmlEscape(description)}">
<meta property="og:image" content="${htmlEscape(ogImageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${htmlEscape(title)}">
<meta property="og:locale" content="${ogLocale}">
<meta property="og:site_name" content="KARAHOCA">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${htmlEscape(title)}">
<meta name="twitter:description" content="${htmlEscape(description)}">
<meta name="twitter:image" content="${htmlEscape(ogImageUrl)}">

<!-- Real browsers: redirect to the SPA deep-link as fast as possible.
     Belt-and-braces: meta-refresh fires immediately, the inline script
     fires in parallel for browsers that throttle 0-second refreshes,
     and a clickable link covers the truly-no-JS case (e.g. lynx). -->
<meta http-equiv="refresh" content="0; url=${htmlEscape(deepLink)}">
<link rel="canonical" href="${htmlEscape(deepLink)}">
<script>window.location.replace(${JSON.stringify(deepLink)});</script>

<style>
  body {
    margin: 0; padding: 32px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Helvetica Neue', Arial, sans-serif;
    text-align: center; color: #444;
  }
  a { color: #1a4d8f; }
</style>
</head>
<body>
  <p>${htmlEscape(title)}</p>
  <p><a href="${htmlEscape(deepLink)}">Continue to KARAHOCA →</a></p>
</body>
</html>`;
};

/**
 * GET /share/product/{id}
 *
 * Optional query: ?lang=ar|en|tr|ru (defaults to 'ar').
 */
export const handleShareProduct = (req, res, ctx) => {
  const match = ctx.url.match(/^\/share\/product\/([^/?]+)$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found.');
    return;
  }

  const id = decodeURIComponent(match[1]);
  const urlObj = new URL(req.url, 'http://localhost');
  const rawLang = (urlObj.searchParams.get('lang') || 'ar').toLowerCase();
  const lang = SUPPORTED_LANGS.includes(rawLang) ? rawLang : 'ar';

  const db = getDb();
  const product = db.prepare(`
    SELECT
      id,
      brand,
      name_${lang}        AS name,
      name_en             AS name_en,
      description_${lang} AS description,
      description_en      AS description_en,
      image
    FROM products
    WHERE id = ? AND active = 1
  `).get(id);

  if (!product) {
    // Send a redirect to the home page rather than a stark 404 — a
    // visitor who taps a stale link (e.g. a deleted product) lands
    // somewhere useful instead of staring at "Not found."
    res.writeHead(302, { Location: `${SITE_URL}/${lang}/` });
    res.end();
    return;
  }

  // English fallback for missing language fields — same convention the
  // OG image generator uses.
  const enriched = {
    ...product,
    name:        (product.name && product.name.trim())        || product.name_en        || product.id,
    description: (product.description && product.description.trim()) || product.description_en || '',
  };

  const html = buildShareHtml({ product: enriched, lang });

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    // Brief cache so a busy product page (e.g. featured in a recent
    // newsletter blast) doesn't hammer the DB. 5 minutes — short
    // enough that admin edits propagate quickly, long enough to
    // absorb the share-button burst that follows a campaign.
    'Cache-Control': 'public, max-age=300',
    // Crawlers respect this — we explicitly invite them to index the
    // OG meta so Twitter cards and FB unfurls populate without delay.
    'X-Robots-Tag': 'noindex, follow',
    'Content-Length': Buffer.byteLength(html, 'utf8'),
  });
  res.end(html);
};

// Exported for unit tests.
export const __testInternals = { buildShareHtml, htmlEscape, brandPathFor };
