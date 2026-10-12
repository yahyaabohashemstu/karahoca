import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SEO, { brandOgImageUrl } from '../components/SEO';
import { BrandPageSchema, ProductListSchema } from '../components/SchemaOrg';
import BrandPageTemplate from '../components/BrandPage';
import {
  getAyluxCategories,
  fetchBrandCatalogFromApi,
  mergeApiWithStaticCatalog,
  type BrandCategoryData,
} from '../data/brandCatalog';
import { normalizeLanguageCode } from '../utils/language';
import { getBrandMarketplaces } from '../constants/marketplaces';

const AYLUX_LOGO_SRC = '/Aylux-logo.png.webp';
const AYLUX_LOGO_FALLBACK = '/Aylux-logo.png';

const AyluxPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  return (
    <>
      <SEO
        title={t('aylux.seo.title')}
        description={t('aylux.seo.description')}
        keywords={t('aylux.seo.keywords')}
        // Dynamic brand OG (see DioxPage for the full rationale).
        ogImage={brandOgImageUrl('AYLUX', lang)}
        canonicalUrl="https://karahoca.com/aylux"
      />
      <BrandPageSchema
        brand="AYLUX"
        description={t('aylux.seo.description')}
        image={AYLUX_LOGO_SRC}
      />
      <AyluxPageContent />
    </>
  );
};

const AyluxPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [categories, setCategories] = useState<BrandCategoryData[]>(() => getAyluxCategories(t));

  useEffect(() => {
    let cancelled = false;
    const staticCats = getAyluxCategories(t);
    fetchBrandCatalogFromApi('AYLUX', currentLang).then(apiCats => {
      if (cancelled) return;
      setCategories(
        apiCats && apiCats.length > 0 ? mergeApiWithStaticCatalog(apiCats, staticCats) : staticCats,
      );
    });
    return () => { cancelled = true; };
  }, [currentLang, t]);

  const ayluxData = {
    brandName: 'AYLUX',
    brandNameArabic: t('aylux.brandNameArabic'),
    heroTitle: t('aylux.hero.title'),
    heroDescription: t('aylux.hero.description'),
    heroImage: AYLUX_LOGO_SRC,
    heroImageFallback: AYLUX_LOGO_FALLBACK,
    heroImageAlt: t('aylux.hero.imageAlt'),
    badges: [t('aylux.hero.badge1'), t('aylux.hero.badge2'), t('aylux.hero.badge3')],
    aboutTitle: t('aylux.about.title'),
    aboutSubtitle: t('aylux.about.subtitle'),
    aboutMainHeading: t('aylux.about.mainHeading'),
    aboutSections: [
      {
        title: t('aylux.about.section1.title'),
        content: t('aylux.about.content')
      }
    ],
    productsTitle: t('aylux.productsSection.title'),
    productsSubtitle: t('aylux.productsSection.subtitle'),
    categories,
    pageClass: 'aylux-page',
    aboutId: 'about-aylux',
    // Trendyol + Hepsiburada storefronts — sold in Turkey only, so this is
    // non-empty for the Turkish UI alone (see constants/marketplaces.ts).
    marketplaces: getBrandMarketplaces('AYLUX', currentLang)
  };

  const allProducts = categories.flatMap(c =>
    c.products.map(p => ({ name: p.name, description: p.description, image: p.image, category: c.title }))
  );

  return (
    <>
      <ProductListSchema brand="AYLUX" products={allProducts} />
      <BrandPageTemplate {...ayluxData} />
    </>
  );
};

export default AyluxPage;
