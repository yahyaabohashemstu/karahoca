import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { BrandPageSchema, ProductListSchema } from '../components/SchemaOrg';
import BrandPageTemplate from '../components/BrandPageTemplate';
import { getAyluxCategories, fetchBrandCatalogFromApi, type BrandCategoryData } from '../data/brandCatalog';
import { normalizeLanguageCode } from '../utils/language';

const AYLUX_LOGO_SRC = '/Aylux-logo.png.webp';
const AYLUX_LOGO_FALLBACK = '/Aylux-logo.png';

const AyluxPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('aylux.seo.title')}
        description={t('aylux.seo.description')}
        keywords={t('aylux.seo.keywords')}
        ogImage={AYLUX_LOGO_SRC}
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
      if (apiCats && apiCats.length > 0) {
        // Merge: preserve gift & static fields missing from API
        const merged = apiCats.map((apiCat, ci) => ({
          ...apiCat,
          products: apiCat.products.map((apiProd, pi) => {
            const staticProd = staticCats[ci]?.products[pi];
            const gift = apiProd.details?.gift ?? staticProd?.details?.gift;
            return {
              ...apiProd,
              details: { ...apiProd.details, ...(gift ? { gift } : {}) },
            };
          }),
        }));
        setCategories(merged);
      } else {
        setCategories(staticCats);
      }
    });
    return () => { cancelled = true; };
  }, [currentLang]);

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
    aboutId: 'about-aylux'
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
