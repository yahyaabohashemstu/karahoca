import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getLanguageDirection,
  normalizeLanguageCode,
  supportedLanguageCodes,
  type SupportedLanguageCode,
} from '../utils/language';
import { splitLocalePath } from '../utils/localizedPath';

/**
 * Centralised `<head>` control. Every page should render exactly one `<SEO>`
 * element with the minimum fields; everything else — canonical, hreflang
 * alternates, Open Graph, Twitter cards, html lang/dir — is derived here.
 *
 * Canonical / hreflang strategy:
 *   Now that every page lives at `/<lang><slug>`, we can emit real hreflang
 *   alternates pointing at distinct URLs for each of the four languages
 *   plus `x-default` aliased to the Arabic variant. This is the canonical
 *   Google pattern for URL-prefixed multi-language sites — the old
 *   localStorage-switching approach made hreflang impossible, which was
 *   silently torching international SEO.
 *
 * The `canonicalUrl` prop, when provided, is expected to be LANGUAGE-AGNOSTIC
 * (e.g. `https://karahoca.com/diox`). We detect that, strip any lang prefix
 * the caller may have accidentally included, and rebuild per-language URLs
 * ourselves. That keeps the per-page SEO component honest and avoids every
 * caller having to reason about the prefix format.
 */

const SITE_URL = 'https://karahoca.com';
const DEFAULT_LANG: SupportedLanguageCode = 'ar';

const OG_LOCALE_MAP: Record<SupportedLanguageCode, string> = {
  ar: 'ar_TR',
  en: 'en_US',
  tr: 'tr_TR',
  ru: 'ru_RU',
};

/**
 * Strip a language prefix from an absolute or relative URL, returning just
 * the language-agnostic path. Used to normalise whatever the caller passed
 * as `canonicalUrl` so hreflang generation is consistent.
 */
const toLanguageAgnosticPath = (input: string | undefined, fallback: string): string => {
  if (!input) return fallback;
  try {
    const url = input.startsWith('http') ? new URL(input) : new URL(input, SITE_URL);
    const { rest } = splitLocalePath(url.pathname || '/');
    return rest || '/';
  } catch {
    return fallback;
  }
};

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  /** Absolute or language-agnostic path; lang prefix is stripped automatically. */
  canonicalUrl?: string;
  noindex?: boolean;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  ogImage = '/karahoca-logo-1-Photoroom.webp',
  ogType = 'website',
  canonicalUrl,
  noindex = false,
}) => {
  const { i18n } = useTranslation();
  const location = useLocation();

  const language = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const direction = getLanguageDirection(language);

  const pagePath = useMemo(() => {
    const fallback = location?.pathname || '/';
    return toLanguageAgnosticPath(canonicalUrl, fallback);
  }, [canonicalUrl, location?.pathname]);

  const canonicalForLang = useMemo(
    () => `${SITE_URL}/${language}${pagePath === '/' ? '/' : pagePath}`,
    [language, pagePath],
  );

  const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${SITE_URL}${ogImage}`;
  const ogLocale = OG_LOCALE_MAP[language] || OG_LOCALE_MAP[DEFAULT_LANG];

  return (
    <Helmet>
      {/* Language + direction are applied to the real <html> element, not a
          wrapper div. Native browser RTL (scrollbar side, form controls,
          document flow) only reads from <html>. */}
      <html lang={language} dir={direction} />

      {/* Basic meta */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {!noindex && (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Canonical for the currently-displayed language. */}
      <link rel="canonical" href={canonicalForLang} />

      {/* hreflang alternates — one per supported language + x-default.
          Skipped for noindex pages (wishlist, unsubscribe, 404) since
          those shouldn't participate in international routing at all. */}
      {!noindex &&
        supportedLanguageCodes.map((lang) => (
          <link
            key={`alt-${lang}`}
            rel="alternate"
            hrefLang={lang}
            href={`${SITE_URL}/${lang}${pagePath === '/' ? '/' : pagePath}`}
          />
        ))}
      {!noindex && (
        <link
          rel="alternate"
          hrefLang="x-default"
          href={`${SITE_URL}/${DEFAULT_LANG}${pagePath === '/' ? '/' : pagePath}`}
        />
      )}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalForLang} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:site_name" content="KARAHOCA" />
      {supportedLanguageCodes
        .filter((l) => l !== language)
        .map((l) => (
          <meta key={`ogalt-${l}`} property="og:locale:alternate" content={OG_LOCALE_MAP[l] || l} />
        ))}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@karahoca" />
      <meta name="twitter:url" content={canonicalForLang} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />
      <meta name="twitter:image:alt" content={title} />

      {/* Additional */}
      <meta name="author" content="KARAHOCA" />
      <meta name="copyright" content="KARAHOCA" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Language" content={language} />
      <meta name="theme-color" content="#153d7a" />
    </Helmet>
  );
};

export default SEO;
