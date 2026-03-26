import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { getLanguageDirection, normalizeLanguageCode } from '../utils/language';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
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
  noindex = false
}) => {
  const { i18n } = useTranslation();
  const siteUrl = 'https://karahoca.com'; // تحديث بالدومين الفعلي
  const language = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const direction = getLanguageDirection(language);
  const ogLocaleMap: Record<string, string> = {
    ar: 'ar_TR',
    en: 'en_US',
    tr: 'tr_TR',
    ru: 'ru_RU'
  };
  const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`;
  const fullCanonicalUrl = canonicalUrl || `${siteUrl}${typeof window !== 'undefined' ? window.location.pathname : ''}`;
  const ogLocale = ogLocaleMap[language] || ogLocaleMap.ar;

  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const SUPPORTED_LANGS = ['ar', 'en', 'tr', 'ru'];
  const alternateLocales: Record<string, string> = { ar: 'ar_SA', en: 'en_US', tr: 'tr_TR', ru: 'ru_RU' };

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {!noindex && <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />}
      {noindex  && <meta name="robots" content="noindex, nofollow" />}

      {/* Canonical URL */}
      <link rel="canonical" href={fullCanonicalUrl} />

      {/* hreflang — all 4 languages + x-default */}
      {SUPPORTED_LANGS.map(lang => (
        <link key={lang} rel="alternate" hreflang={lang} href={`${siteUrl}${pagePath}`} />
      ))}
      <link rel="alternate" hreflang="x-default" href={`${siteUrl}${pagePath}`} />

      {/* Open Graph / Facebook */}
      <meta property="og:type"              content={ogType} />
      <meta property="og:url"               content={fullCanonicalUrl} />
      <meta property="og:title"             content={title} />
      <meta property="og:description"       content={description} />
      <meta property="og:image"             content={fullImageUrl} />
      <meta property="og:image:width"       content="1200" />
      <meta property="og:image:height"      content="630" />
      <meta property="og:image:alt"         content={title} />
      <meta property="og:locale"            content={ogLocale} />
      <meta property="og:site_name"         content="KARAHOCA" />
      {/* Alternate OG locales */}
      {SUPPORTED_LANGS.filter(l => l !== language).map(l => (
        <meta key={l} property="og:locale:alternate" content={alternateLocales[l] || l} />
      ))}

      {/* Twitter */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:site"        content="@karahoca" />
      <meta name="twitter:url"         content={fullCanonicalUrl} />
      <meta name="twitter:title"       content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={fullImageUrl} />
      <meta name="twitter:image:alt"   content={title} />

      {/* Additional Meta Tags */}
      <meta name="author"       content="KARAHOCA" />
      <meta name="copyright"    content="KARAHOCA" />
      <meta name="viewport"     content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Language" content={language} />
      <meta name="theme-color"  content="#0f1117" />

      {/* Language and Direction */}
      <html lang={language} dir={direction} />
    </Helmet>
  );
};

export default SEO;
