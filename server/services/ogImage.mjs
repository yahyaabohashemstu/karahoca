/**
 * server/services/ogImage.mjs — runtime OG (Open Graph) image generator.
 *
 * Generates 1200×630 PNGs that social platforms (WhatsApp, Facebook,
 * Twitter, LinkedIn, Telegram) unfurl when a KARAHOCA product or brand
 * link is shared. Each (product × language) and (brand × language) gets
 * its own card so the preview a Turkish visitor sees on WhatsApp is
 * Turkish, the Arabic visitor's is Arabic, etc.
 *
 * Why a runtime generator (and not pre-rendered build-time assets):
 *
 *   - Catalogue churns. Admin can rename a product, swap its photo, edit
 *     the description — and the next share should reflect that without
 *     a rebuild + redeploy round-trip.
 *
 *   - Per-language fan-out. ~120 products × 4 languages × 2 brands is
 *     960+ images; pre-building every variant inflates the docker image
 *     and the build clock for assets that almost-never get fetched.
 *
 *   - Disk cache erases the runtime cost. We generate once, cache to
 *     `server/data/og-cache/{key}.png`, serve subsequent hits from disk.
 *     Cache key embeds the product's `updated_at` UNIX ms — any admin
 *     edit invalidates automatically without a manual flush.
 *
 * Architecture:
 *
 *   1. Build an SVG string from a localised template (RTL for Arabic,
 *      LTR for others). SVG text is shape-agnostic and renders crisply
 *      at any density — no font hinting compromises.
 *
 *   2. Hand the SVG + a real product photo to sharp. sharp composites
 *      them, applies a subtle vignette, and emits a 1200×630 PNG.
 *
 *   3. Persist to the cache directory keyed on
 *      `{kind}-{id}-{lang}-{updatedAtMs}.png`. Stale variants (older
 *      timestamp) are NOT eagerly purged — the next "products list"
 *      cron in db.mjs / a future cleanup task will handle them. For now
 *      ~960 stale files is negligible (each is ~80-120 KB).
 *
 * Failure modes (everything degrades gracefully):
 *
 *   - sharp fails to load (missing native binary, e.g. wrong arch on a
 *     dev machine) → service exports `isAvailable() === false`, the
 *     route returns 503, the SPA falls back to the static brand-logo
 *     og:image. No crash, no broken share previews — just non-bespoke.
 *
 *   - Product image URL 404s → sharp composites without the photo (the
 *     card still shows brand badge + name + description, no broken
 *     image icon).
 *
 *   - Disk cache write fails (read-only volume) → image still streams to
 *     the response; we just regenerate on every hit. Logs a warn so the
 *     ops team notices.
 *
 * Cache invalidation policy: NEVER mutate an existing cached file. To
 * "invalidate" we write a new key (because updated_at changed). Readers
 * with the old URL bookmarked or in social-platform CDNs continue to
 * see the old image until they re-crawl — which is the desired behavior:
 * shared links keep working even after an admin edit.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', 'data', 'og-cache');
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');

// Origin used to resolve product image paths that aren't under
// /api/uploads/ (e.g. /diox-images/foo.webp, served by the web nginx).
// Configurable so a staging environment can point at its own host.
const STATIC_ASSETS_ORIGIN = (process.env.SITE_URL || 'https://karahoca.com').replace(/\/+$/, '');

// Hard cap so a future "remote image" feature can't time-bomb the cache
// directory. 5 MB is generously above sharp's PNG output for 1200×630
// images (typically 80-180 KB), so the only way to hit it is a fault.
const MAX_CACHE_FILE_BYTES = 5 * 1024 * 1024;

// ─── Sharp loader — soft dependency ─────────────────────────────────────────
// We import sharp lazily so a missing/broken native binary on a dev
// machine doesn't take down `node server-bootstrap.mjs` entirely. The
// `--omit=dev` production install always has sharp; the dev fallback is
// purely for laptops where the prebuild isn't usable.

let sharpModule = null;
let sharpLoadAttempted = false;
let sharpLoadError = null;

const tryLoadSharp = async () => {
  if (sharpLoadAttempted) return sharpModule;
  sharpLoadAttempted = true;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default || mod;
  } catch (err) {
    sharpLoadError = err;
    sharpModule = null;
  }
  return sharpModule;
};

/**
 * Probe whether the OG generator can actually produce images on this
 * deployment. Routes call this to decide whether to 503 vs proceed.
 * Cheap (just reads the cached load attempt).
 */
export const isOgImageGenerationAvailable = async () => {
  await tryLoadSharp();
  return Boolean(sharpModule);
};

export const getOgImageGenerationError = () => sharpLoadError;

// ─── Cache directory bootstrap ──────────────────────────────────────────────

let cacheDirReady = false;
const ensureCacheDir = async () => {
  if (cacheDirReady) return;
  await fs.mkdir(CACHE_DIR, { recursive: true });
  cacheDirReady = true;
};

// ─── SVG template ───────────────────────────────────────────────────────────
// The SVG is hand-tuned to a 1200×630 canvas (Facebook / WhatsApp /
// Twitter all sample 1.91:1 aspect). RTL is handled by reversing the
// header strip layout and using `text-anchor="end"` for Arabic.
//
// Why SVG and not Canvas / @napi-rs/canvas: SVG composes natively with
// sharp's pipeline (no extra dep, no font hinting issues), and the
// declarative format makes copy iteration trivial — designers can tweak
// the template by editing this file alone.

const SUPPORTED_LANGS = ['ar', 'en', 'tr', 'ru'];

const BRAND_COLORS = {
  DIOX: { primary: '#1a4d8f', accent: '#3aa8d6' },
  AYLUX: { primary: '#7a3da3', accent: '#c779dd' },
  KARAHOCA: { primary: '#153d7a', accent: '#3aa8d6' },
};

const TAGLINES = {
  ar: 'منتجات تنظيف احترافية — صنع في تركيا',
  en: 'Professional cleaning products — Made in Türkiye',
  tr: 'Profesyonel temizlik ürünleri — Türkiye\'de üretilmiştir',
  ru: 'Профессиональные чистящие средства — Сделано в Турции',
};

/**
 * XML-escape a string so it's safe to embed in SVG text nodes.
 * Without this a stray `&` in a product name breaks the SVG parser
 * and the whole image fails to render. null / undefined become '' so
 * a missing-translation row doesn't emit the literal text "null".
 */
const xmlEscape = (s) => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Truncate a string to N chars with ellipsis, breaking on a word
 * boundary if possible so we don't slice through an Arabic / Russian
 * grapheme cluster in the middle. The OG template has finite width;
 * past ~60 chars the headline overruns the badge.
 */
const truncate = (s, max) => {
  if (!s) return '';
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  // If there's a sensible space within the last 25% of the budget, break
  // there — keeps full words intact.
  if (lastSpace > max * 0.75) return slice.slice(0, lastSpace) + '…';
  return slice + '…';
};

/**
 * Wrap a longer string across N lines at word boundaries. Used for the
 * product description block under the headline. We measure in approximate
 * character count (SVG has no native auto-wrap) — close enough at this
 * point size that the result looks balanced for all 4 languages.
 */
const wrapLines = (text, perLine, maxLines) => {
  if (!text) return [];
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (lines.length >= maxLines) break;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= perLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // If we ran out of lines mid-stream, suffix an ellipsis on the last
  // visible line so it's obvious the copy continues elsewhere.
  if (lines.length === maxLines && words.length > 0) {
    const lastLineWordCount = lines[maxLines - 1].split(' ').length;
    const consumedCount = lines.slice(0, maxLines - 1).reduce((sum, ln) => sum + ln.split(' ').length, 0);
    if (consumedCount + lastLineWordCount < words.length) {
      lines[maxLines - 1] = truncate(lines[maxLines - 1], perLine - 1);
      if (!lines[maxLines - 1].endsWith('…')) lines[maxLines - 1] += '…';
    }
  }
  return lines;
};

/**
 * Build the SVG body for a product card. Returns a UTF-8 string ready to
 * feed to `sharp(Buffer.from(svg))`.
 *
 * Parameters
 *   - name     localised product name (already in target language)
 *   - description  localised description (long-form, will be wrapped)
 *   - brand    'DIOX' | 'AYLUX' | 'KARAHOCA'
 *   - lang     'ar' | 'en' | 'tr' | 'ru'
 */
const buildProductSvg = ({ name, description, brand, lang }) => {
  const rtl = lang === 'ar';
  const colors = BRAND_COLORS[brand] || BRAND_COLORS.KARAHOCA;
  const tagline = TAGLINES[lang] || TAGLINES.en;
  // Headline wraps to 2 lines max, description to 3.
  const headlineLines = wrapLines(name || '', rtl ? 28 : 36, 2);
  const descLines = wrapLines(description || '', rtl ? 52 : 64, 3);
  const textAnchor = rtl ? 'end' : 'start';
  const textX = rtl ? 1120 : 80;
  const directionAttr = rtl ? 'direction="rtl"' : '';

  // Use generic system-font stack inside <text>. sharp's librsvg uses
  // fontconfig — on Alpine it falls back to whatever sans is available
  // (typically DejaVu Sans, which has full Arabic + Cyrillic coverage).
  const fontStack = "'Geist Variable','Inter','Noto Sans Arabic','Noto Sans',sans-serif";

  // Headline rendered as a stack of <tspan dy>; absolute Y per line
  // would also work but tspan-dy keeps RTL alignment correct.
  const headlineSvg = headlineLines
    .map((line, i) => {
      const dy = i === 0 ? '0' : '76';
      return `<tspan x="${textX}" dy="${dy}">${xmlEscape(line)}</tspan>`;
    })
    .join('');

  const descSvg = descLines
    .map((line, i) => {
      const dy = i === 0 ? '0' : '42';
      return `<tspan x="${textX}" dy="${dy}">${xmlEscape(line)}</tspan>`;
    })
    .join('');

  const brandBadgeX = rtl ? 1120 : 80;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630"
     xmlns="http://www.w3.org/2000/svg" ${directionAttr}>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="${colors.primary}"/>
      <stop offset="100%" stop-color="${colors.accent}"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient>
  </defs>

  <!-- Background gradient -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle vignette so white headline text reads regardless of the
       photo composite that sharp will overlay underneath. -->
  <rect width="1200" height="630" fill="url(#vignette)"/>

  <!-- Brand badge -->
  <g font-family="${fontStack}" fill="#ffffff">
    <text x="${brandBadgeX}" y="90"
          font-size="34" font-weight="800"
          letter-spacing="3"
          text-anchor="${textAnchor}">
      ${xmlEscape(brand)}
    </text>
    <text x="${brandBadgeX}" y="125"
          font-size="20" font-weight="400"
          opacity="0.85"
          text-anchor="${textAnchor}">
      ${xmlEscape(tagline)}
    </text>
  </g>

  <!-- Headline -->
  <text font-family="${fontStack}"
        fill="#ffffff"
        font-size="68"
        font-weight="800"
        text-anchor="${textAnchor}"
        y="310">
    ${headlineSvg}
  </text>

  <!-- Description -->
  <text font-family="${fontStack}"
        fill="#ffffff"
        font-size="28"
        font-weight="400"
        opacity="0.92"
        text-anchor="${textAnchor}"
        y="460">
    ${descSvg}
  </text>

  <!-- Footer URL -->
  <text font-family="${fontStack}"
        fill="#ffffff"
        font-size="22"
        font-weight="600"
        opacity="0.8"
        text-anchor="${textAnchor}"
        x="${textX}"
        y="580">
    karahoca.com
  </text>
</svg>`;
};

/**
 * Build a brand-level SVG (no product specifics — just brand + tagline).
 * Used for `/og/brand/{brand}-{lang}.png` so brand pages get their own
 * unfurl card distinct from individual products.
 */
const buildBrandSvg = ({ brand, lang }) => {
  const rtl = lang === 'ar';
  const colors = BRAND_COLORS[brand] || BRAND_COLORS.KARAHOCA;
  const tagline = TAGLINES[lang] || TAGLINES.en;
  const headline = brand;
  const subhead = {
    ar: 'علامة تجاريّة تركيّة احترافيّة',
    en: 'Professional Turkish brand',
    tr: 'Profesyonel Türk markası',
    ru: 'Профессиональный турецкий бренд',
  }[lang] || 'Professional Turkish brand';

  const fontStack = "'Geist Variable','Inter','Noto Sans Arabic','Noto Sans',sans-serif";
  const textAnchor = rtl ? 'end' : 'start';
  const textX = rtl ? 1120 : 80;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630"
     xmlns="http://www.w3.org/2000/svg" ${rtl ? 'direction="rtl"' : ''}>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="${colors.primary}"/>
      <stop offset="100%" stop-color="${colors.accent}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="${textX}" y="290" font-family="${fontStack}"
        font-size="160" font-weight="900" fill="#ffffff"
        letter-spacing="6" text-anchor="${textAnchor}">
    ${xmlEscape(headline)}
  </text>
  <text x="${textX}" y="380" font-family="${fontStack}"
        font-size="36" font-weight="500" fill="#ffffff"
        opacity="0.92" text-anchor="${textAnchor}">
    ${xmlEscape(subhead)}
  </text>
  <text x="${textX}" y="440" font-family="${fontStack}"
        font-size="26" font-weight="400" fill="#ffffff"
        opacity="0.8" text-anchor="${textAnchor}">
    ${xmlEscape(tagline)}
  </text>
  <text x="${textX}" y="580" font-family="${fontStack}"
        font-size="22" font-weight="600" fill="#ffffff"
        opacity="0.8" text-anchor="${textAnchor}">
    karahoca.com
  </text>
</svg>`;
};

// ─── Product-photo resolver ─────────────────────────────────────────────────
//
// The PRIMARY product-OG output is now the actual product photograph
// composited onto a 1200×630 canvas — that's what WhatsApp / Facebook /
// Twitter visitors see in the share preview. The designed SVG card
// (buildProductSvg above) survives as a fallback when the photo
// can't be loaded (file 404, network error, unsupported format).
//
// Photo source resolution:
//   - 'https://…'                  → HTTPS fetch (admin set a CDN URL)
//   - '/api/uploads/foo.png'       → read from server/data/uploads (local fs)
//   - '/diox-images/foo.webp' …    → HTTPS fetch from STATIC_ASSETS_ORIGIN
//                                    (those assets are served by the
//                                     separate nginx image, not the API)
//   - anything else                → treat as relative to STATIC_ASSETS_ORIGIN
//
// We cap the fetched bytes at 8 MB so a misbehaving / malicious URL
// can't blow up memory. The actual product photos in the catalogue are
// all well under 500 KB after the build-time `optimize-images` pass.

const MAX_FETCH_BYTES = 8 * 1024 * 1024;

const loadProductPhotoBuffer = async (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') {
    logger.debug('[og-photo] empty imagePath — falling back to card');
    return null;
  }
  const trimmed = imagePath.trim();
  if (!trimmed) {
    logger.debug('[og-photo] imagePath was whitespace only — falling back to card');
    return null;
  }

  // Local upload — read straight from disk to avoid a loopback HTTP
  // hop that would force the API to depend on its own public URL.
  if (trimmed.startsWith('/api/uploads/')) {
    const filename = path.basename(trimmed.replace('/api/uploads/', ''));
    // path.basename strips any '../' so a crafted path can't escape the
    // uploads directory.
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile() && stat.size > 0 && stat.size <= MAX_FETCH_BYTES) {
        logger.debug({ filename, size: stat.size }, '[og-photo] loaded from local uploads');
        return await fs.readFile(filePath);
      }
      logger.warn({ filePath, size: stat.size, isFile: stat.isFile() }, '[og-photo] local upload not usable');
    } catch (err) {
      logger.warn({ filePath, err: err.message }, '[og-photo] local upload read failed');
    }
    return null;
  }

  // Build the absolute URL we'll fetch.
  let url;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    url = trimmed;
  } else {
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    url = `${STATIC_ASSETS_ORIGIN}${withSlash}`;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      // Tag the User-Agent so we can grep our own logs for these
      // server-side image fetches and tell them apart from regular
      // visitor traffic.
      headers: { 'User-Agent': 'KARAHOCA-OG-Generator/1.0 (+https://karahoca.com)' },
    });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, '[og-photo] fetch returned non-OK status');
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > MAX_FETCH_BYTES) {
      logger.warn({ url, bytes: arrayBuf.byteLength }, '[og-photo] response too large');
      return null;
    }
    if (arrayBuf.byteLength === 0) {
      logger.warn({ url }, '[og-photo] response was empty');
      return null;
    }
    logger.debug({ url, bytes: arrayBuf.byteLength }, '[og-photo] fetched OK');
    return Buffer.from(arrayBuf);
  } catch (err) {
    logger.warn({ url, err: err.message }, '[og-photo] fetch threw');
    return null;
  }
};

/**
 * Composite the product photograph onto a clean 1200×630 white canvas
 * (the WhatsApp / Facebook / Twitter standard share ratio). The photo
 * is scaled to fit inside an inner safe area (1080×550) so a small
 * margin of white frames every side — looks intentional rather than
 * "cropped photo glued to the canvas edge".
 *
 * Uses sharp's `resize({ fit: 'contain' })` which preserves aspect
 * ratio and pads to fill, then we composite onto a true-white background
 * (sharp's default extend colour is transparent → renders black in PNG).
 *
 * Returns the PNG buffer or `null` if anything fails (the caller then
 * falls back to the designed-card SVG).
 */
const composeProductPhotoOg = async (sharp, photoBuffer) => {
  if (!photoBuffer) return null;
  try {
    // Step 1: resize the photo to fit inside the safe area while
    // keeping aspect ratio. We use `contain` with a transparent
    // extend colour so the inner photo region carries the actual
    // shape of the product (no implicit white box around it).
    const inner = await sharp(photoBuffer)
      .resize(1080, 550, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Step 2: composite the inner image centered on a 1200×630 white
    // canvas with a 60px top/bottom and 60px left/right margin
    // (1200-1080 = 120 split between left+right; 630-550 = 80
    // split between top+bottom).
    const canvas = await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: inner, gravity: 'center' }])
      .png({ quality: 92, compressionLevel: 9 })
      .toBuffer();
    return canvas;
  } catch {
    return null;
  }
};

// Exported for the test harness — same body the route consumes.
export const __testInternals = {
  buildProductSvg,
  buildBrandSvg,
  truncate,
  wrapLines,
  xmlEscape,
  loadProductPhotoBuffer,
  composeProductPhotoOg,
};

// ─── Cache key + path ───────────────────────────────────────────────────────

const sanitizeForFilename = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const buildCacheKey = ({ kind, id, lang, updatedAtMs }) => {
  const safeId = sanitizeForFilename(id);
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'ar';
  const ts = Number.isFinite(updatedAtMs) ? Math.floor(updatedAtMs) : 0;
  return `${kind}-${safeId}-${safeLang}-${ts}.png`;
};

const cachePathFor = (key) => path.join(CACHE_DIR, key);

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get (or generate) a per-product OG image. Returns a Buffer.
 *
 * Output strategy — PRODUCT PHOTO FIRST (Phase F2):
 *   The visitor's primary share-preview should be the product's own
 *   photograph, not a designed marketing card. When the photo can be
 *   loaded we composite it onto a clean 1200×630 white canvas with a
 *   small margin so WhatsApp / Facebook / Twitter previews show the
 *   actual product as a properly-framed hero image.
 *
 *   Fallback: if `imagePath` is missing OR the photo can't be fetched
 *   (404, network error, unsupported format), we fall back to the
 *   designed SVG card (gradient + brand + name + description). That
 *   way a sharing visitor always sees SOMETHING bespoke — never the
 *   generic logo placeholder.
 *
 * Pipeline:
 *   1. Compute the deterministic cache key from id + lang + updated_at.
 *   2. Cache hit → stream from disk.
 *   3. Try to load + composite the product photo. Success → cache + return.
 *   4. Photo load failed → render the designed SVG card. Cache + return.
 *
 * The caller is responsible for setting Content-Type: image/png and
 * Cache-Control headers — this function does ONE thing only.
 */
export const getProductOgImage = async ({
  id,
  name,
  description,
  brand,
  lang,
  updatedAtMs,
  imagePath, // ← NEW — the product's `image` field from DB
}) => {
  const sharp = await tryLoadSharp();
  if (!sharp) {
    const e = new Error('sharp module unavailable');
    e.code = 'SHARP_UNAVAILABLE';
    throw e;
  }

  await ensureCacheDir();

  const key = buildCacheKey({ kind: 'product', id, lang, updatedAtMs });
  const filePath = cachePathFor(key);

  // Cache hit — fast path. The key embeds updated_at so an admin edit
  // (which bumps updated_at + busts the cache file via
  // invalidateProductOgCache) forces regeneration here.
  try {
    const buf = await fs.readFile(filePath);
    if (buf.byteLength > 0 && buf.byteLength <= MAX_CACHE_FILE_BYTES) {
      return { buffer: buf, cacheKey: key, fromCache: true };
    }
  } catch {
    // Cache miss — proceed.
  }

  // Primary path: composite the actual product photograph.
  let png = null;
  let source = 'photo';
  // `reason` carries the failure mode when we couldn't load the photo.
  // Surfaces in the X-OG-Reason header so an admin debugging a missing
  // image preview can curl -I the URL and see e.g. "no-image-path" or
  // "photo-load-failed".
  let reason = '';
  if (!imagePath) {
    reason = 'no-image-path';
  } else {
    const photoBuffer = await loadProductPhotoBuffer(imagePath);
    if (!photoBuffer) {
      reason = 'photo-load-failed';
    } else {
      png = await composeProductPhotoOg(sharp, photoBuffer);
      if (!png) {
        reason = 'photo-compose-failed';
      }
    }
  }

  // Fallback path: render the designed SVG card. Same shape as the
  // pre-F2 output so existing tests still pass when imagePath is
  // omitted (or a photo fetch failed).
  if (!png) {
    source = 'card';
    logger.info(
      { reason, imagePath: imagePath ? imagePath.slice(0, 200) : null, lang },
      '[og-photo] using designed-card fallback',
    );
    const svg = buildProductSvg({ name, description, brand, lang });
    png = await sharp(Buffer.from(svg, 'utf8'))
      .resize(1200, 630, { fit: 'cover' })
      .png({ quality: 88, compressionLevel: 9, palette: false })
      .toBuffer();
  }

  // Best-effort write — failure here doesn't break the response.
  try {
    await fs.writeFile(filePath, png);
  } catch {
    /* read-only volume / disk full — continue without caching */
  }

  return { buffer: png, cacheKey: key, fromCache: false, source, reason };
};

/**
 * Get (or generate) a per-brand OG image. Same caching semantics as the
 * product variant — keyed on brand + lang (no updated_at because the
 * brand template never depends on database content).
 */
export const getBrandOgImage = async ({ brand, lang }) => {
  const sharp = await tryLoadSharp();
  if (!sharp) {
    const e = new Error('sharp module unavailable');
    e.code = 'SHARP_UNAVAILABLE';
    throw e;
  }

  await ensureCacheDir();

  // Brand cache uses a static "version" suffix so a copy edit here forces
  // regeneration on next deploy without touching the products table.
  const TEMPLATE_VERSION = 1;
  const key = buildCacheKey({ kind: 'brand', id: brand, lang, updatedAtMs: TEMPLATE_VERSION });
  const filePath = cachePathFor(key);

  try {
    const buf = await fs.readFile(filePath);
    if (buf.byteLength > 0 && buf.byteLength <= MAX_CACHE_FILE_BYTES) {
      return { buffer: buf, cacheKey: key, fromCache: true };
    }
  } catch {
    /* miss */
  }

  const svg = buildBrandSvg({ brand, lang });
  const png = await sharp(Buffer.from(svg, 'utf8'))
    .resize(1200, 630, { fit: 'cover' })
    .png({ quality: 88, compressionLevel: 9 })
    .toBuffer();

  try {
    await fs.writeFile(filePath, png);
  } catch { /* */ }

  return { buffer: png, cacheKey: key, fromCache: false };
};

/**
 * Cache invalidation helper. The admin product editor will call this on
 * save so the next share-link fetches a fresh image. Returns the count
 * of files removed (purely informational — admin doesn't need it but
 * tests assert it).
 *
 * "Invalidate" here means delete any cached file whose name starts with
 * the product's id prefix — across all 4 languages — leaving the disk
 * clean. The next request regenerates from the current DB state.
 */
export const invalidateProductOgCache = async (productId) => {
  if (!productId) return 0;
  try {
    await ensureCacheDir();
  } catch {
    return 0;
  }
  const prefix = `product-${sanitizeForFilename(productId)}-`;
  let removed = 0;
  try {
    const entries = await fs.readdir(CACHE_DIR);
    await Promise.all(
      entries
        .filter((name) => name.startsWith(prefix))
        .map(async (name) => {
          try {
            await fs.unlink(path.join(CACHE_DIR, name));
            removed += 1;
          } catch { /* */ }
        }),
    );
  } catch {
    /* cache dir missing / unreadable */
  }
  return removed;
};

export const OG_SUPPORTED_LANGS = SUPPORTED_LANGS;
export const OG_CACHE_DIR = CACHE_DIR;
