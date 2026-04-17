/**
 * Catalog asset URL helpers.
 *
 * The DIOX and AYLUX printable catalogs ship as a PDF + a directory of
 * per-page WebP images. Both currently live under `/public/Catalog/` in
 * the repo, which means they're served from the same origin as the SPA.
 * A Phase-4 operator task moves them to an R2/S3 bucket so origin
 * bandwidth stops carrying ~57 MB of catalog on every request.
 *
 * `VITE_CATALOG_BASE_URL` lets ops flip the switch without a code change:
 * point it at the CDN and both `catalogPdfUrl(…)` and
 * `catalogPageImage(…)` emit the CDN-absolute form; leave it unset and
 * everything resolves to the local `/Catalog/…` path as before.
 *
 * Accepts any absolute URL or any path starting with `/`; trailing slash
 * is normalised away so callers don't have to worry about it.
 */

const rawBase = (import.meta.env.VITE_CATALOG_BASE_URL as string | undefined)?.trim() ?? '';
const trimmedBase = rawBase.replace(/\/+$/, '');

/**
 * Resolve a catalog-relative path against the configured base URL.
 * `relative` SHOULD start with `/`. If the caller forgets, we add one
 * rather than silently munging.
 */
const resolveCatalogPath = (relative: string): string => {
  const withSlash = relative.startsWith('/') ? relative : `/${relative}`;
  if (!trimmedBase) return withSlash;
  return `${trimmedBase}${withSlash}`;
};

/**
 * Full URL for a brand's downloadable PDF catalog.
 * `brand` is lowercase here ('diox' | 'aylux') to match existing on-disk paths.
 */
export const catalogPdfUrl = (filename: string): string =>
  resolveCatalogPath(`/Catalog/${filename}`);

/**
 * Full URL for a single rendered catalog page image.
 *   catalogPageImage('diox', 1) → '/Catalog/diox-pages/page-01.webp'
 */
export const catalogPageImage = (brand: 'diox' | 'aylux', page: number): string => {
  const dirMap = {
    diox: 'diox-pages',
    aylux: 'aylux-pages',
  } as const;
  const padded = String(page).padStart(2, '0');
  return resolveCatalogPath(`/Catalog/${dirMap[brand]}/page-${padded}.webp`);
};

/**
 * Produce the full page-image array for a brand's catalog. Pages are
 * 1-indexed on disk but this helper exposes a zero-indexed count.
 */
export const catalogPageImages = (
  brand: 'diox' | 'aylux',
  pageCount: number,
): string[] =>
  Array.from({ length: pageCount }, (_, i) => catalogPageImage(brand, i + 1));

/** Whether a CDN override is currently configured. Exposed for tests / debug. */
export const isCatalogCdnEnabled = (): boolean => trimmedBase.length > 0;
