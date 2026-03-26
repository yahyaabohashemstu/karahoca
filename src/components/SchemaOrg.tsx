/**
 * Schema.org JSON-LD structured data components.
 * Helps Google show rich results (product cards, breadcrumbs, org info).
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://karahoca.com';
const LOGO_URL = `${SITE_URL}/karahoca-logo-1-Photoroom.webp`;

// ── Organization (render on every page) ──────────────────────────────────────
export const OrganizationSchema: React.FC = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'KARAHOCA',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: LOGO_URL,
      width: 200,
      height: 60,
    },
    description: 'Turkish manufacturer of household and industrial cleaning products. DIOX and AYLUX brands. Exporting to 15+ countries.',
    foundingDate: '1994',
    numberOfEmployees: { '@type': 'QuantitativeValue', value: 200 },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+90-530-591-4990',
        contactType: 'customer service',
        availableLanguage: ['Arabic', 'English', 'Turkish', 'Russian'],
        areaServed: 'Worldwide',
      },
      {
        '@type': 'ContactPoint',
        email: 'info@karahoca.com',
        contactType: 'sales',
      },
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'TR',
    },
    sameAs: [
      'https://www.linkedin.com/company/karahoca',
      'https://wa.me/905305914990',
    ],
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

// ── Website SearchAction ──────────────────────────────────────────────────────
export const WebsiteSchema: React.FC = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'KARAHOCA',
    url: SITE_URL,
    inLanguage: ['ar', 'en', 'tr', 'ru'],
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

// ── Product Brand Page (DIOX or AYLUX) ───────────────────────────────────────
interface ProductSchemaProps {
  brand: 'DIOX' | 'AYLUX';
  description: string;
  image?: string;
}
export const BrandPageSchema: React.FC<ProductSchemaProps> = ({ brand, description, image }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name: brand,
    description,
    logo: image ? `${SITE_URL}${image}` : LOGO_URL,
    url: `${SITE_URL}/${brand.toLowerCase()}`,
    manufacturer: {
      '@type': 'Organization',
      name: 'KARAHOCA',
      url: SITE_URL,
    },
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

// ── News Article ─────────────────────────────────────────────────────────────
interface ArticleSchemaProps {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  lang?: string;
}
export const ArticleSchema: React.FC<ArticleSchemaProps> = ({
  headline, description, image, datePublished, dateModified, lang = 'ar',
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline,
    description,
    image: image ? `${SITE_URL}${image}` : LOGO_URL,
    datePublished,
    dateModified: dateModified || datePublished,
    inLanguage: lang,
    publisher: {
      '@type': 'Organization',
      name: 'KARAHOCA',
      logo: { '@type': 'ImageObject', url: LOGO_URL },
    },
    author: { '@type': 'Organization', name: 'KARAHOCA' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/news` },
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

// ── BreadcrumbList ────────────────────────────────────────────────────────────
interface BreadcrumbProps {
  items: Array<{ name: string; url: string }>;
}
export const BreadcrumbSchema: React.FC<BreadcrumbProps> = ({ items }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

// ── About / Company page ──────────────────────────────────────────────────────
export const AboutPageSchema: React.FC = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About KARAHOCA',
    url: `${SITE_URL}/about`,
    description: 'KARAHOCA is a Turkish cleaning products manufacturer with 30+ years of experience, producing DIOX and AYLUX brands.',
    mainEntity: {
      '@type': 'Organization',
      name: 'KARAHOCA',
      foundingDate: '1994',
      numberOfEmployees: 200,
    },
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};
