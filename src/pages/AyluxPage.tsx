import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { BrandPageSchema } from '../components/SchemaOrg';
import BrandPageTemplate from '../components/BrandPageTemplate';
import { getAyluxCategories, fetchBrandCatalogFromApi, type BrandCategoryData } from '../data/brandCatalog';
import { normalizeLanguageCode } from '../utils/language';

const AyluxPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('aylux.seo.title')}
        description={t('aylux.seo.description')}
        keywords={t('aylux.seo.keywords')}
        ogImage="/Aylux-logo.png.webp"
        canonicalUrl="https://karahoca.com/aylux"
      />
      <BrandPageSchema
        brand="AYLUX"
        description={t('aylux.seo.description')}
        image="/Aylux-logo.png.webp"
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
    fetchBrandCatalogFromApi('AYLUX', currentLang).then(apiCats => {
      if (cancelled) return;
      if (apiCats && apiCats.length > 0) {
        setCategories(apiCats);
      } else {
        setCategories(getAyluxCategories(t));
      }
    });
    return () => { cancelled = true; };
  }, [currentLang]);

  const ayluxData = {
    brandName: 'AYLUX',
    brandNameArabic: t('aylux.brandNameArabic'),
    heroTitle: t('aylux.hero.title'),
    heroDescription: t('aylux.hero.description'),
    heroImage: '/Aylux-logo.png.webp',
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

  return <BrandPageTemplate {...ayluxData} />;
};

export default AyluxPage;
