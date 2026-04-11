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

// ── About / Company page ─────────────────────────────────────────────────────
export const AboutPageSchema: React.FC = () => {
  const aboutPage = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About KARAHOCA',
    url: `${SITE_URL}/about`,
    description: 'KARAHOCA is a Turkish cleaning products manufacturer with 30+ years of experience, producing DIOX and AYLUX brands for 15+ countries.',
    inLanguage: ['ar', 'en', 'tr', 'ru'],
    mainEntity: {
      '@type': ['Organization', 'LocalBusiness'],
      '@id': `${SITE_URL}/#organization`,
      name: 'KARAHOCA KIMYA',
      alternateName: ['KARAHOCA', 'كاراهوجا'],
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: LOGO_URL, width: 200, height: 60 },
      image: `${SITE_URL}/KARAHOCA-1-newPhoto.webp`,
      description: 'KARAHOCA KIMYA is a leading Turkish manufacturer of household and industrial cleaning products, exporting DIOX and AYLUX branded products to 15+ countries since 1994.',
      foundingDate: '1994',
      numberOfEmployees: { '@type': 'QuantitativeValue', value: 200 },
      slogan: 'Quality That Cleans the World',
      knowsAbout: [
        'Household Cleaning Products',
        'Industrial Cleaning',
        'Laundry Detergents',
        'Personal Hygiene Products',
        'Private Label Manufacturing',
        'Chemical Manufacturing',
      ],
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'TR',
        addressLocality: 'Istanbul',
        addressRegion: 'Istanbul',
      },
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
          areaServed: 'Worldwide',
        },
      ],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'KARAHOCA Product Catalog',
        itemListElement: [
          { '@type': 'OfferCatalog', name: 'DIOX — Home & Laundry Cleaning' },
          { '@type': 'OfferCatalog', name: 'AYLUX — Premium Cleaning Line' },
        ],
      },
      sameAs: [
        'https://www.linkedin.com/company/karahoca',
        'https://wa.me/905305914990',
      ],
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What products does KARAHOCA manufacture?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'KARAHOCA manufactures household and industrial cleaning products under two brands: DIOX (home cleaning, laundry, personal hygiene) and AYLUX (premium cleaning line). Products include detergents, liquid soaps, fabric softeners, dish cleaners, and more.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does KARAHOCA offer private label manufacturing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. KARAHOCA offers full private label (white label) manufacturing services. Businesses can order products under their own brand name with custom packaging and formulations.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which countries does KARAHOCA export to?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'KARAHOCA exports to 15+ countries across the Middle East, North Africa, Europe, and Central Asia.',
        },
      },
      {
        '@type': 'Question',
        name: 'How can I contact KARAHOCA for business inquiries?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You can reach KARAHOCA via email at info@karahoca.com, by WhatsApp at +90 530 591 4990, or through the website at karahoca.com.',
        },
      },
    ],
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(aboutPage)}</script>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>
  );
};

// ── Product List (for brand pages — enables rich product results) ────────────
interface ProductItem {
  name: string;
  description: string;
  image: string;
  category: string;
}
interface ProductListSchemaProps {
  brand: 'DIOX' | 'AYLUX';
  products: ProductItem[];
}
export const ProductListSchema: React.FC<ProductListSchemaProps> = ({ brand, products }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${brand} Products`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        description: p.description,
        image: p.image.startsWith('http') ? p.image : `${SITE_URL}${p.image}`,
        brand: { '@type': 'Brand', name: brand },
        manufacturer: { '@type': 'Organization', name: 'KARAHOCA', url: SITE_URL },
        category: p.category,
      },
    })),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};
