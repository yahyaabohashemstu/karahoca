import type { SupportedLanguageCode } from './language';

/**
 * URLs of the runtime Open Graph images (1200×630 PNG cards rendered by
 * the API). Pages pass them to <SEO ogImage={…}> so the og:image a crawler
 * (WhatsApp, Facebook, X, LinkedIn) samples is customised to the page's
 * language. Lives outside components/SEO.tsx so that file exports only a
 * component (Vite fast refresh requirement).
 */

/**
 * Origin of the OG image generator. Build-time env wins
 * (VITE_BACKEND_URL); otherwise production's api.karahoca.com. The
 * og:image URL must be ABSOLUTE — crawlers don't resolve relative URLs.
 */
const API_ORIGIN = (() => {
  try {
    const fromEnv = (import.meta as { env?: { VITE_BACKEND_URL?: string } }).env?.VITE_BACKEND_URL;
    if (fromEnv) return fromEnv.replace(/\/+$/, '');
  } catch { /* */ }
  return 'https://api.karahoca.com';
})();

/** Per-product OG card, one per (product, language). */
export const productOgImageUrl = (productId: string, lang: SupportedLanguageCode): string =>
  `${API_ORIGIN}/og/product/${encodeURIComponent(productId)}-${lang}.png`;

/** Per-brand OG card. Used by DioxPage / AyluxPage. */
export const brandOgImageUrl = (brand: 'DIOX' | 'AYLUX' | 'KARAHOCA', lang: SupportedLanguageCode): string =>
  `${API_ORIGIN}/og/brand/${brand}-${lang}.png`;
