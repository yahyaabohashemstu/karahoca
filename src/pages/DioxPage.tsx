import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { brandOgImageUrl } from '../utils/ogImageUrls';
import { BrandPageSchema, ProductListSchema } from '../components/SchemaOrg';
import BrandPageTemplate from '../components/BrandPage';
import { useBrandCategories } from '../hooks/useBrandCategories';
import { normalizeLanguageCode } from '../utils/language';
import { catalogPdfUrl, catalogPageImages } from '../utils/catalogUrls';

const DIOX_LOGO_SRC = '/Diox-logo.png.webp';
const DIOX_LOGO_FALLBACK = '/Diox-logo.png.png';

const DioxPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  return (
    <>
      <SEO
        title={t('diox.seo.title')}
        description={t('diox.seo.description')}
        keywords={t('diox.seo.keywords')}
        // Use the runtime-generated brand OG card (1200×630, localised
        // to the visitor's current language). Crawlers fetch this at
        // share-time so the WhatsApp / Facebook unfurl is bespoke
        // instead of a logo on white. Falls back to the static logo
        // path when the API is unreachable — handled by SEO.tsx which
        // emits the full absolute URL.
        ogImage={brandOgImageUrl('DIOX', lang)}
        canonicalUrl="https://karahoca.com/diox"
      />
      <BrandPageSchema
        brand="DIOX"
        description={t('diox.seo.description')}
        image={DIOX_LOGO_SRC}
      />
      <DioxPageContent />
    </>
  );
};

const DioxPageContent: React.FC = () => {
  const { t } = useTranslation();
  const categories = useBrandCategories('DIOX');

  const dioxData = {
    // Display wordmark — the Turkish dotted-İ form. This flows into the
    // hero H1, the catalog header, and the FlipBook chrome. All FUNCTIONAL
    // "DIOX" identifiers below (OG image key, schema brand, API fetch,
    // catalog paths, PDF filename) stay ASCII.
    brandName: 'DİOX',
    brandNameArabic: t('diox.brandNameArabic'),
    heroTitle: t('diox.hero.title'),
    heroDescription: t('diox.hero.description'),
    heroImage: DIOX_LOGO_SRC,
    heroImageFallback: DIOX_LOGO_FALLBACK,
    heroImageAlt: t('diox.hero.imageAlt'),
    badges: [t('diox.hero.badge1'), t('diox.hero.badge2'), t('diox.hero.badge3')],
    aboutTitle: t('diox.about.title'),
    aboutSubtitle: t('diox.about.subtitle'),
    aboutMainHeading: t('diox.about.mainHeading'),
    aboutSections: [
      {
        title: t('diox.about.section1.title'),
        content: t('diox.about.content')
      }
    ],
    productsTitle: t('diox.productsSection.title'),
    productsSubtitle: t('diox.productsSection.subtitle'),
    categories,
    contactId: 'contact-diox',
    aboutId: 'about-diox',
    pageClass: 'diox-page',
    catalogImages: catalogPageImages('diox', 18),
    pdfUrl: catalogPdfUrl('DIOX-KATALOG.pdf')
  };

  const allProducts = categories.flatMap(c =>
    c.products.map(p => ({ name: p.name, description: p.description, image: p.image, category: c.title }))
  );

  return (
    <>
      <ProductListSchema brand="DIOX" products={allProducts} />
      <BrandPageTemplate {...dioxData} />
    </>
  );
};

export default DioxPage;
