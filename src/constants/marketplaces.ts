/**
 * Online marketplace storefronts — single source of truth.
 *
 * Some sub-brands are sold directly to consumers through third-party
 * marketplaces. Those storefronts only ship inside one country, so the
 * "buy online" UI is gated per locale: a visitor browsing in a language
 * whose market the store does not serve never sees a button that would
 * lead to a shop they cannot order from.
 *
 *   AYLUX → Trendyol + Hepsiburada, Turkey only → shown on `/tr/aylux`.
 *
 * Every surface that renders these links (brand hero, product modal,
 * closing "online stores" band) reads from `getBrandMarketplaces()`, so
 * adding a store, changing a URL, or opening a store to another locale
 * is a one-line edit here — no component changes.
 *
 * Individual products can also link straight to their own listing: those
 * URLs live in the database (admin product form → `marketplaceLinks` in
 * the public API) and replace the store URL inside that product's modal.
 *
 * Brand keys are the ASCII functional identifiers ('AYLUX', 'DIOX'), never
 * the display wordmarks (see constants/brandNames.ts for the DİOX rule).
 */
import type { SupportedLanguageCode } from '../utils/language';

export type MarketplaceId = 'trendyol' | 'hepsiburada';

export interface MarketplaceStore {
  id: MarketplaceId;
  /** Marketplace name — a proper noun, identical in every UI language. */
  name: string;
  /** The brand's own seller storefront on that marketplace. */
  url: string;
}

interface BrandMarketplaces {
  /** UI languages whose visitors can actually order from these stores. */
  locales: readonly SupportedLanguageCode[];
  /** Render order — the first store is the first button. */
  stores: readonly MarketplaceStore[];
}

const BRAND_MARKETPLACES: Readonly<Record<string, BrandMarketplaces>> = {
  AYLUX: {
    locales: ['tr'],
    stores: [
      {
        id: 'trendyol',
        name: 'Trendyol',
        url: 'https://www.trendyol.com/sr?mid=1277496&os=1',
      },
      {
        id: 'hepsiburada',
        name: 'Hepsiburada',
        url: 'https://www.hepsiburada.com/magaza/aylux?tab=allproducts',
      },
    ],
  },
};

/** A product's own listing on each marketplace, as served by the API. */
export type MarketplaceProductLinks = Partial<Record<MarketplaceId, string>>;

const MARKETPLACE_HOSTS: Record<MarketplaceId, string> = {
  trendyol: 'trendyol.com',
  hepsiburada: 'hepsiburada.com',
};

/**
 * The product's listing URL on `id`'s marketplace, if it is a usable one.
 * The API already only serves https URLs on the marketplace's domain
 * (server/services/marketplaceLinks.mjs); this re-check keeps anything
 * else from ever becoming an href, whatever the data source.
 */
export const productListingUrl = (
  id: MarketplaceId,
  links: MarketplaceProductLinks | undefined,
): string | undefined => {
  const raw = links?.[id];
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowed = MARKETPLACE_HOSTS[id];
    return url.protocol === 'https:' && (host === allowed || host.endsWith(`.${allowed}`))
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

// Shared empty result. Returning the SAME reference for every "no stores"
// call keeps BrandPage's memo comparator from seeing a fresh array (and
// re-rendering) on each parent render.
const NO_STORES: readonly MarketplaceStore[] = [];

/**
 * Storefronts to show for `brand` to a visitor browsing in `lang`.
 * Empty when the brand has no online stores, or none serving that market.
 */
export const getBrandMarketplaces = (
  brand: string,
  lang: SupportedLanguageCode,
): readonly MarketplaceStore[] => {
  const entry = BRAND_MARKETPLACES[brand];
  return entry && entry.locales.includes(lang) ? entry.stores : NO_STORES;
};
