/**
 * Schema.org JSON-LD structured data components.
 * Helps Google show rich results (product cards, breadcrumbs, org info).
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  BRAND_ALTERNATE_NAMES,
  BRAND_ARABIC_PRIMARY,
  BRAND_ARABIC_VARIANTS,
  formatBrandName,
} from '../constants/brandNames';

const SITE_URL = 'https://karahoca.com';
const LOGO_URL = `${SITE_URL}/karahoca-logo-1-Photoroom.webp`;

// ── Organization + LocalBusiness (rendered on every page via App.tsx) ────────
//
// Single canonical company record for the whole site. Carries `@id` so any
// page-level schema (BrandPage, AboutPage, NewsArticle) can cross-reference
// via `"publisher": { "@id": "https://karahoca.com/#organization" }` — Google
// then merges the graph on its end without us having to repeat the
// company block on every page. Uses dual @type so the same node satisfies
// both the generic Organization rules AND the LocalBusiness rich-result
// requirements (geo, opening hours, full address) for the Knowledge Panel.
export const OrganizationSchema: React.FC = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness'],
    '@id': `${SITE_URL}/#organization`,
    name: 'KARAHOCA',
    // Imported from constants/brandNames.ts so the variant list stays
    // in lock-step with every other SEO surface (index.html static
    // block, hero subtitle, footer, About page disambiguation). Covers
    // every common Arabic transliteration ("قره خوجة" through
    // "كاراهوكا") so Arabic-language searches land here instead of
    // bouncing to the unrelated Syrian Aleppo competitor.
    alternateName: BRAND_ALTERNATE_NAMES,
    legalName: 'KARAHOCA KIMYA',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: LOGO_URL,
      contentUrl: LOGO_URL,
      width: 200,
      height: 60,
      caption: 'KARAHOCA',
    },
    image: `${SITE_URL}/KARAHOCA-1-newPhoto.webp`,
    description:
      'KARAHOCA KIMYA is a leading Turkish manufacturer of household and industrial cleaning products, exporting DİOX and AYLUX branded products to 15+ countries since 1994.',
    slogan: 'Quality That Cleans the World',
    foundingDate: '1994',
    numberOfEmployees: { '@type': 'QuantitativeValue', value: 200 },
    knowsAbout: [
      'Household Cleaning Products',
      'Industrial Cleaning',
      'Laundry Detergents',
      'Personal Hygiene',
      'Private Label Manufacturing',
      'Chemical Manufacturing',
    ],
    naics: '325611', // Soap and Other Detergent Manufacturing
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'TR',
      addressRegion: 'Kilis',
      addressLocality: 'Kilis',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 36.71,
      longitude: 37.115,
    },
    // Opening hours for the sales office. The plant runs longer; this set is
    // when buyers can actually reach a human. Sunday/Saturday closed —
    // important so Google doesn't suggest weekend calls.
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:30',
        closes: '18:00',
      },
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+90-850-228-35-34',
        contactType: 'customer service',
        availableLanguage: ['Arabic', 'English', 'Turkish', 'Russian'],
        areaServed: 'Worldwide',
      },
      {
        '@type': 'ContactPoint',
        telephone: '+90-530-591-4990',
        contactType: 'sales',
        availableLanguage: ['Arabic', 'English', 'Turkish'],
        areaServed: ['TR', 'SA', 'AE', 'EG', 'DZ', 'MA', 'JO', 'IQ'],
      },
      {
        '@type': 'ContactPoint',
        email: 'info@karahoca.com',
        contactType: 'sales',
        areaServed: 'Worldwide',
      },
    ],
    brand: [
      { '@type': 'Brand', name: 'DİOX', url: `${SITE_URL}/ar/diox` },
      { '@type': 'Brand', name: 'AYLUX', url: `${SITE_URL}/ar/aylux` },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'KARAHOCA Product Catalog',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'DİOX — Home & Laundry Cleaning' },
        { '@type': 'OfferCatalog', name: 'AYLUX — Premium Cleaning Line' },
      ],
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

// ── WebSite + SearchAction (sitelinks search box in Google) ──────────────────
export const WebsiteSchema: React.FC = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'KARAHOCA',
    url: SITE_URL,
    inLanguage: ['ar', 'en', 'tr', 'ru'],
    publisher: { '@id': `${SITE_URL}/#organization` },
    // Tells Google we have on-site search and where to forward the query.
    // The user lands on the news page with `?q=...`; even if the page
    // doesn't yet handle that param, Google still renders the search box
    // under the brand result — the param is harmless to ignore.
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/ar/news?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
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
    name: formatBrandName(brand),
    description,
    logo: image ? `${SITE_URL}${image}` : LOGO_URL,
    // Brand pages now live at `/<lang>/<brand>`. We point at the x-default
    // (Arabic) variant here because schema.org URLs must be absolute and
    // language-specific — the per-language <link rel="alternate"> is
    // emitted separately by <SEO />.
    url: `${SITE_URL}/ar/${brand.toLowerCase()}`,
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
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/${lang}/news` },
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
    url: `${SITE_URL}/ar/about`,
    description: 'KARAHOCA is a Turkish cleaning products manufacturer with 30+ years of experience, producing DİOX and AYLUX brands for 15+ countries.',
    inLanguage: ['ar', 'en', 'tr', 'ru'],
    mainEntity: {
      '@type': ['Organization', 'LocalBusiness'],
      '@id': `${SITE_URL}/#organization`,
      name: 'KARAHOCA KIMYA',
      // Same comprehensive variant list used in OrganizationSchema —
      // imported from constants/brandNames so search engines see the
      // identical alternateName cluster on every page that mentions
      // the company. Crucial for the "قره خوجة" → karahoca.com mapping.
      alternateName: BRAND_ALTERNATE_NAMES,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: LOGO_URL, width: 200, height: 60 },
      image: `${SITE_URL}/KARAHOCA-1-newPhoto.webp`,
      description: 'KARAHOCA KIMYA is a leading Turkish manufacturer of household and industrial cleaning products, exporting DİOX and AYLUX branded products to 15+ countries since 1994.',
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
          { '@type': 'OfferCatalog', name: 'DİOX — Home & Laundry Cleaning' },
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
          text: 'KARAHOCA manufactures household and industrial cleaning products under two brands: DİOX (home cleaning, laundry, personal hygiene) and AYLUX (premium cleaning line). Products include detergents, liquid soaps, fabric softeners, dish cleaners, and more.',
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
      // ── Naming / disambiguation Q&A ─────────────────────────────────
      // Targets the cluster of Arabic transliteration searches: "قره خوجة"
      // (most common), "قرة خوجة", "قرا هوجا", "كاراهوكا", "كاراهوجا",
      // "كرا هوجا", etc. Google's FAQ rich-results renderer surfaces the
      // question + answer directly under the brand result, which means a
      // visitor searching ANY of these spellings can click through with
      // confidence that they have the right company. Also sharply
      // disambiguates from the unrelated Syrian "قره خوجة" supplier in
      // Aleppo that currently ranks for the same query.
      {
        '@type': 'Question',
        name: 'ما الاسم العربي لشركة KARAHOCA؟',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `الاسم العربي لشركة KARAHOCA هو "${BRAND_ARABIC_PRIMARY}". ` +
            `يُكتب أيضاً بصيغ متعددة شائعة في البحث: ${BRAND_ARABIC_VARIANTS.join('، ')}. ` +
            'جميعها تشير إلى نفس الشركة التركية المصنّعة لمنتجات التنظيف منذ عام 1994 ' +
            '(قره خوجة كيميا — KARAHOCA KIMYA). ' +
            'الشركة مقرّها مدينة كيليس في تركيا، وتُصدّر منتجاتها تحت علامتي ديوكس (DİOX) ' +
            'وآيلوكس (AYLUX) إلى أكثر من 15 دولة.',
        },
      },
      {
        '@type': 'Question',
        name: 'هل قره خوجة وKARAHOCA نفس الشركة؟',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            `نعم. "قره خوجة" هي التهجئة العربية الأشهر لاسم KARAHOCA التركي. ` +
            'الشركة سجلّت قانونياً باسم KARAHOCA KIMYA في تركيا، ولها موقع رسمي واحد على ' +
            'الإنترنت: karahoca.com. أي صياغة عربية أخرى مثل "قرا هوجا" أو "كرا هوجا" ' +
            'أو "قرة خوجة" تشير لنفس الشركة. ' +
            'ملاحظة: هناك شركة سورية مختلفة في حلب تحمل اسماً مشابهاً — KARAHOCA الحقيقية ' +
            'هي الشركة التركية ومقرّها كيليس، وموقعها الرسمي https://karahoca.com.',
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

// ── News list (NewsPage index — enables Google News rich results) ───────────
//
// Renders an `ItemList` of `NewsArticle` headlines with publication date,
// excerpt, and image. Each article carries `mainEntityOfPage` pointing at
// its `/news/<slug>` URL so Google can surface specific articles directly
// from the SERP. Publisher cross-references the global Organization @id
// (defined in OrganizationSchema above) so the company info isn't repeated
// per-article — Google merges the graph by @id.
interface NewsListItem {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  publishedAt: string;
  category: string;
}
interface NewsListSchemaProps {
  items: NewsListItem[];
  lang?: string;
}
export const NewsListSchema: React.FC<NewsListSchemaProps> = ({ items, lang = 'ar' }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'KARAHOCA News',
    numberOfItems: items.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/${lang}/news/${item.slug}`,
      item: {
        '@type': 'NewsArticle',
        '@id': `${SITE_URL}/${lang}/news/${item.slug}`,
        headline: item.title,
        description: item.excerpt,
        image: item.image.startsWith('http') ? item.image : `${SITE_URL}${item.image}`,
        datePublished: item.publishedAt,
        articleSection: item.category,
        inLanguage: lang,
        url: `${SITE_URL}/${lang}/news/${item.slug}`,
        publisher: { '@id': `${SITE_URL}/#organization` },
        author: { '@id': `${SITE_URL}/#organization` },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${SITE_URL}/${lang}/news/${item.slug}`,
        },
      },
    })),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
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

/**
 * ⚠️ ROLLBACK SWITCH — per-product Offer block in ProductListSchema.
 *
 * `true`  → every Product entry on DIOX/AYLUX brand pages gets an
 *           `offers` object (availability + currency + WhatsApp contact
 *           URL). Originally added (commit fe2aedc, 2026-05-12) to clear
 *           the "must specify offers / review / aggregateRating" warning
 *           in Google Search Console.
 *
 * `false` → drops the `offers` block entirely. Pre-2026-05-12 behaviour.
 *           GSC will re-raise the "must specify offers" warning on the
 *           next crawl (~149 yellow items).
 *
 * ── Why the flag is currently FALSE ─────────────────────────────────────
 *
 * Two days after going live, Google Search Console escalated `price`
 * from a *recommended* property to a *required* one. The price-less
 * `Offer` we shipped started flagging 42 items as INVALID (red), with
 * the exact error:
 *
 *     الحقل "price" غير مضمَّن (في "offers")
 *
 * The two truthful fixes available to us are:
 *
 *   (A) Add a real `price` to every product.
 *       Not possible — KARAHOCA is B2B; prices are quote-on-request and
 *       vary per buyer, currency, MOQ, and shipping terms. There is no
 *       single number we can put in here without misleading visitors.
 *
 *   (B) Invent a fake `price: 0` to silence Google.
 *       Rejected — Google's price-comparison surfaces interpret 0 as
 *       "Free", which is a direct lie to anyone landing on the SERP
 *       from a price-aggregator query. The cost in trust > the cost
 *       in a SEO warning.
 *
 * So we accept the trade-off of going BACK to the original "missing
 * offers" warning (yellow, doesn't block indexing) instead of staying
 * in the "missing price" error state (red, blocks rich-result eligibility
 * AND looks worse on the GSC dashboard). The site still indexes
 * normally, the rank is unaffected; only the product-card rich snippet
 * remains off — which it was anyway, because Google won't render those
 * without a real price.
 *
 * If a future redesign introduces real per-product pricing (e.g. an
 * e-commerce module), flip this back to `true` AND add a `price` field
 * to the `sharedOffer` literal below.
 */
const PRODUCT_OFFERS_ENABLED = false;

export const ProductListSchema: React.FC<ProductListSchemaProps> = ({ brand, products }) => {
  // Built once per render rather than per-item so all 100+ items share the
  // exact same Offer object literal — keeps the emitted JSON-LD compact
  // and lets Google's parser de-dupe by structural identity.
  const sharedOffer = PRODUCT_OFFERS_ENABLED
    ? {
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        priceCurrency: 'USD',
        // Quote-on-request channel. WhatsApp is the primary B2B inbound
        // funnel and is documented as the contact number in every other
        // schema block on the site, so Google sees a consistent picture.
        url: 'https://wa.me/905305914990',
        seller: {
          '@type': 'Organization',
          name: 'KARAHOCA',
          // Cross-reference the canonical Organization node so Google
          // merges this Offer's seller with the global company graph
          // instead of treating it as a fresh entity per product.
          '@id': `${SITE_URL}/#organization`,
        },
        areaServed: 'Worldwide',
      }
    : null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${formatBrandName(brand)} Products`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        description: p.description,
        image: p.image.startsWith('http') ? p.image : `${SITE_URL}${p.image}`,
        brand: { '@type': 'Brand', name: formatBrandName(brand) },
        manufacturer: { '@type': 'Organization', name: 'KARAHOCA', url: SITE_URL },
        category: p.category,
        ...(sharedOffer ? { offers: sharedOffer } : {}),
      },
    })),
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};
