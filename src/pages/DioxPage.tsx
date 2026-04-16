import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { BrandPageSchema, ProductListSchema } from '../components/SchemaOrg';
import BrandPageTemplate from '../components/BrandPageTemplate';
import { getDioxCategories, fetchBrandCatalogFromApi, type BrandCategoryData } from '../data/brandCatalog';
import { normalizeLanguageCode } from '../utils/language';

const DIOX_LOGO_SRC = '/Diox-logo.png.webp';
const DIOX_LOGO_FALLBACK = '/Diox-logo.png.png';

const DioxPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('diox.seo.title')}
        description={t('diox.seo.description')}
        keywords={t('diox.seo.keywords')}
        ogImage={DIOX_LOGO_SRC}
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
  const { t, i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const [categories, setCategories] = useState<BrandCategoryData[]>(() => getDioxCategories(t));

  useEffect(() => {
    let cancelled = false;
    const staticCats = getDioxCategories(t);
    fetchBrandCatalogFromApi('DIOX', currentLang).then(apiCats => {
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

  const dioxData = {
    brandName: 'DIOX',
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
    catalogImages: Array.from({ length: 18 }, (_, i) =>
      `/Catalog/diox-pages/page-${String(i + 1).padStart(2, '0')}.webp`
    ),
    pdfUrl: '/Catalog/DIOX-KATALOG.pdf'
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
