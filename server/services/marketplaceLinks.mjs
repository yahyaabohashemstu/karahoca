/**
 * Per-product marketplace listing URLs.
 *
 * Each product can point at its own listing on the brand's Trendyol and
 * Hepsiburada stores (columns `products.trendyol_url` / `hepsiburada_url`,
 * editable in the admin product form). The site's "buy online" buttons
 * open that listing; a product without one falls back to the store page
 * (src/constants/marketplaces.ts).
 *
 * The URLs end up as `href`s on the public site, so they are validated on
 * the way in (admin save) AND on the way out (public API): only https URLs
 * on the marketplace's own domain are ever stored or served — a typo or a
 * pasted `javascript:` can't become a live link.
 */

export const MARKETPLACE_URL_COLUMNS = Object.freeze({
  trendyol: 'trendyol_url',
  hepsiburada: 'hepsiburada_url',
});

const MARKETPLACE_HOSTS = Object.freeze({
  trendyol: 'trendyol.com',
  hepsiburada: 'hepsiburada.com',
});

const MARKETPLACE_LABELS = Object.freeze({
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
});

const isMarketplaceHost = (marketplace, hostname) => {
  const host = MARKETPLACE_HOSTS[marketplace];
  const h = hostname.toLowerCase();
  return h === host || h.endsWith(`.${host}`);
};

/**
 * Admin input → value to store. `undefined` / `null` mean "not sent" and
 * pass through (the field is left untouched); an empty string clears the
 * link. Anything else must be an https URL on that marketplace's domain,
 * otherwise this throws an Error whose message is safe to show the admin.
 */
export const normalizeMarketplaceUrl = (marketplace, value) => {
  if (value === undefined || value === null) return value;
  const raw = String(value).trim();
  if (!raw) return '';

  const label = MARKETPLACE_LABELS[marketplace];
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} link is not a valid URL.`);
  }
  if (url.protocol !== 'https:' || !isMarketplaceHost(marketplace, url.hostname)) {
    throw new Error(`${label} link must be an https:// address on ${MARKETPLACE_HOSTS[marketplace]}.`);
  }
  return url.toString();
};

/**
 * Normalise both URL fields of an admin request body in place. Returns an
 * error message for the first invalid field, or null when all are fine.
 */
export const normalizeMarketplaceUrlFields = (body) => {
  for (const [marketplace, column] of Object.entries(MARKETPLACE_URL_COLUMNS)) {
    try {
      body[column] = normalizeMarketplaceUrl(marketplace, body[column]);
    } catch (error) {
      return error.message;
    }
  }
  return null;
};

/**
 * DB row → public `marketplaceLinks` ({ trendyol?, hepsiburada? }), or
 * undefined when the product has none. Values failing validation are
 * dropped rather than served.
 */
export const publicMarketplaceLinks = (row) => {
  const links = {};
  for (const [marketplace, column] of Object.entries(MARKETPLACE_URL_COLUMNS)) {
    try {
      const url = normalizeMarketplaceUrl(marketplace, row[column]);
      if (url) links[marketplace] = url;
    } catch { /* invalid stored value — never served */ }
  }
  return Object.keys(links).length > 0 ? links : undefined;
};
