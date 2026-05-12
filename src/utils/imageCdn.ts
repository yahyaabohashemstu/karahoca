/**
 * Image-CDN helpers.
 *
 * Why this module exists
 * ──────────────────────
 * The marketing pages reference ~100 product photos served from
 * `/aylux-images/*` and `/diox-images/*` on our own origin. Each fetch
 * costs an inbound roundtrip and our nginx must compress + serve the
 * file. As traffic grows (especially Arabic-speaking users in
 * Saudi/Egypt/UAE), three constraints bite:
 *
 *   1. Origin bandwidth bills scale linearly with traffic.
 *   2. No automatic responsive-size delivery — a phone downloads the
 *      same 1200-px-wide WebP as a 27-inch monitor.
 *   3. No automatic AVIF (10–20% smaller than WebP) for supporting
 *      browsers — we'd have to pre-encode AVIFs manually.
 *
 * Migrating to an Image-CDN (Cloudflare Images, Bunny.net, imgix,
 * Cloudinary) fixes all three at the URL layer. Each provider takes a
 * SOURCE image once and serves an INFINITE variety of resize / format
 * permutations on the fly, with auto-AVIF and edge caching.
 *
 * The catch: a real migration needs an account, an API key, and
 * uploading every image. Until that's done, this module ships in a
 * "disabled" state — all functions return the original local path
 * unchanged, so deploying the code is safe.
 *
 * Activation
 * ──────────
 * Set TWO env vars at build time:
 *
 *   VITE_IMAGE_CDN_PROVIDER  = 'cloudflare' | 'bunny' | 'imgix' | 'cloudinary'
 *   VITE_IMAGE_CDN_BASE_URL  = full origin including any account prefix
 *
 * Examples per provider (URL templates documented in each builder below):
 *
 *   Cloudflare Images:
 *     VITE_IMAGE_CDN_PROVIDER=cloudflare
 *     VITE_IMAGE_CDN_BASE_URL=https://imagedelivery.net/<account-hash>
 *
 *   Bunny.net (Optimizer add-on on a storage zone):
 *     VITE_IMAGE_CDN_PROVIDER=bunny
 *     VITE_IMAGE_CDN_BASE_URL=https://<zone>.b-cdn.net
 *
 *   imgix:
 *     VITE_IMAGE_CDN_PROVIDER=imgix
 *     VITE_IMAGE_CDN_BASE_URL=https://<source>.imgix.net
 *
 *   Cloudinary:
 *     VITE_IMAGE_CDN_PROVIDER=cloudinary
 *     VITE_IMAGE_CDN_BASE_URL=https://res.cloudinary.com/<cloud-name>/image/fetch
 *
 * Rollback
 * ────────
 * Unset both env vars (or set provider to anything else). The functions
 * fall back to returning the original local URL. No code changes
 * required — every call site is shielded behind these helpers.
 */

import { toWebp } from './image';

type CdnProvider = 'cloudflare' | 'bunny' | 'imgix' | 'cloudinary' | 'none';

const PROVIDER = (import.meta.env.VITE_IMAGE_CDN_PROVIDER as CdnProvider | undefined) ?? 'none';
const BASE_URL = (import.meta.env.VITE_IMAGE_CDN_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

const isEnabled = PROVIDER !== 'none' && BASE_URL.length > 0;

/** Options accepted by every provider; each builder maps what it can. */
export interface CdnOptions {
  /** Resize target width in CSS pixels. Provider picks height to preserve aspect. */
  width?: number;
  /** Resize target height in CSS pixels. */
  height?: number;
  /** WebP / AVIF compression target, 1-100. */
  quality?: number;
  /**
   * `auto` lets the CDN pick the best format the browser accepts
   * (AVIF > WebP > JPEG). Pass an explicit format to override.
   */
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  /** Resize behaviour: contain (default), cover, fill. */
  fit?: 'contain' | 'cover' | 'fill';
}

// ─── URL builders per provider ─────────────────────────────────────────────
// Each builder takes (cleanLocalPath, opts) and returns a fully-formed URL.

const buildCloudflare = (localPath: string, opts: CdnOptions): string => {
  // Cloudflare Images URL: <base>/<image-id>/<variant>
  //   For arbitrary-origin "Cloudflare Image Resizing" mode (better fit for
  //   our use case where the image lives on our origin), the URL is:
  //
  //     https://example.com/cdn-cgi/image/<options>/<origin-url>
  //
  //   But that pattern requires Cloudflare in front of the origin AND the
  //   image-resizing product enabled. Since we may instead use Cloudflare
  //   Images (which hosts originals on Cloudflare's storage), we support
  //   the Images path layout when BASE_URL includes `imagedelivery.net`.
  const params: string[] = [];
  if (opts.width) params.push(`w=${opts.width}`);
  if (opts.height) params.push(`h=${opts.height}`);
  if (opts.quality) params.push(`q=${opts.quality}`);
  if (opts.format && opts.format !== 'auto') params.push(`f=${opts.format}`);
  if (opts.fit) params.push(`fit=${opts.fit === 'contain' ? 'scale-down' : opts.fit}`);

  const variant = params.length ? params.join(',') : 'public';
  // Local path becomes the image id; we strip the leading slash and dots.
  const imageId = encodeURIComponent(localPath.replace(/^\/+/, ''));
  return `${BASE_URL}/${imageId}/${variant}`;
};

const buildBunny = (localPath: string, opts: CdnOptions): string => {
  // Bunny.net Optimizer: append query string. Provider auto-converts to
  // AVIF/WebP when `format=auto` and the client supports it.
  const url = new URL(`${BASE_URL}${localPath}`);
  if (opts.width) url.searchParams.set('width', String(opts.width));
  if (opts.height) url.searchParams.set('height', String(opts.height));
  if (opts.quality) url.searchParams.set('quality', String(opts.quality));
  if (opts.format && opts.format !== 'auto') url.searchParams.set('format', opts.format);
  if (opts.fit) url.searchParams.set('crop_gravity', opts.fit === 'cover' ? 'center' : 'noclip');
  return url.toString();
};

const buildImgix = (localPath: string, opts: CdnOptions): string => {
  const url = new URL(`${BASE_URL}${localPath}`);
  if (opts.width) url.searchParams.set('w', String(opts.width));
  if (opts.height) url.searchParams.set('h', String(opts.height));
  if (opts.quality) url.searchParams.set('q', String(opts.quality));
  if (opts.format === 'auto' || opts.format === undefined) {
    url.searchParams.set('auto', 'format,compress');
  } else if (opts.format) {
    url.searchParams.set('fm', opts.format);
  }
  if (opts.fit) url.searchParams.set('fit', opts.fit === 'cover' ? 'crop' : 'max');
  return url.toString();
};

const buildCloudinary = (localPath: string, opts: CdnOptions): string => {
  // Cloudinary "fetch" mode pulls from our origin. URL form:
  //   <base>/<transformations>/<remote-url-encoded>
  // We assume BASE_URL already ends with `/image/fetch`.
  const transforms: string[] = [];
  if (opts.width) transforms.push(`w_${opts.width}`);
  if (opts.height) transforms.push(`h_${opts.height}`);
  if (opts.quality) transforms.push(`q_${opts.quality}`);
  transforms.push(`f_${opts.format && opts.format !== 'auto' ? opts.format : 'auto'}`);
  if (opts.fit) transforms.push(`c_${opts.fit === 'cover' ? 'fill' : 'fit'}`);
  // Cloudinary needs the absolute origin URL of the source.
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://karahoca.com';
  const sourceUrl = encodeURIComponent(`${origin}${localPath}`);
  return `${BASE_URL}/${transforms.join(',')}/${sourceUrl}`;
};

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Resolve a local image path through the configured CDN. When the CDN is
 * disabled (no env vars), returns the original path unchanged so call
 * sites are always safe to use.
 *
 * Already-absolute URLs (http://, https://, data:) are passed through
 * untouched — we never proxy externally-hosted images.
 *
 * @example
 *   cdnUrl('/aylux-images/product.webp', { width: 800 })
 *   // → 'https://<zone>.b-cdn.net/aylux-images/product.webp?width=800&format=auto'
 *   // or, if VITE_IMAGE_CDN_PROVIDER is unset:
 *   // → '/aylux-images/product.webp'
 */
export function cdnUrl(localPath: string | undefined | null, opts: CdnOptions = {}): string {
  if (!localPath) return '';
  if (localPath.startsWith('http') || localPath.startsWith('data:')) return localPath;

  // Always force WebP locally even when CDN is disabled — preserves the
  // existing toWebp() rewrite logic so downstream behaviour is identical.
  const webpPath = toWebp(localPath);
  if (!isEnabled) return webpPath;

  switch (PROVIDER) {
    case 'cloudflare': return buildCloudflare(webpPath, opts);
    case 'bunny':      return buildBunny(webpPath, opts);
    case 'imgix':      return buildImgix(webpPath, opts);
    case 'cloudinary': return buildCloudinary(webpPath, opts);
    default:           return webpPath;
  }
}

/**
 * Build a `srcset` value across the supplied widths. Each entry is a
 * tuple of `<cdnUrl> <width>w` so the browser can pick the cheapest
 * source for the user's viewport × DPR.
 *
 * @example
 *   <img
 *     src={cdnUrl(path, { width: 800 })}
 *     srcSet={cdnSrcSet(path, [400, 800, 1200])}
 *     sizes="(max-width: 768px) 100vw, 50vw"
 *   />
 */
export function cdnSrcSet(
  localPath: string | undefined | null,
  widths: number[],
  baseOpts: Omit<CdnOptions, 'width'> = {},
): string {
  if (!localPath) return '';
  return widths
    .filter((w) => Number.isFinite(w) && w > 0)
    .sort((a, b) => a - b)
    .map((w) => `${cdnUrl(localPath, { ...baseOpts, width: w })} ${w}w`)
    .join(', ');
}

/**
 * Inspect whether the CDN is currently active. Useful for analytics /
 * debugging banners. Returns `false` when env vars are absent.
 */
export function isImageCdnEnabled(): boolean {
  return isEnabled;
}

/**
 * Return the configured provider name (or 'none') for diagnostic UIs.
 */
export function imageCdnProvider(): CdnProvider {
  return isEnabled ? PROVIDER : 'none';
}
