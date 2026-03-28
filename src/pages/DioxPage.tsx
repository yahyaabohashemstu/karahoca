import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import { BrandPageSchema } from '../components/SchemaOrg';
import BrandPageTemplate from '../components/BrandPageTemplate';
import { getDioxCategories, fetchBrandCatalogFromApi, type BrandCategoryData } from '../data/brandCatalog';
import { normalizeLanguageCode } from '../utils/language';

const DioxPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <SEO
        title={t('diox.seo.title')}
        description={t('diox.seo.description')}
        keywords={t('diox.seo.keywords')}
        ogImage="/Diox-logo.png.webp"
        canonicalUrl="https://karahoca.com/diox"
      />
      <BrandPageSchema
        brand="DIOX"
        description={t('diox.seo.description')}
        image="/Diox-logo.png.webp"
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
    fetchBrandCatalogFromApi('DIOX', currentLang).then(apiCats => {
      if (cancelled) return;
      if (apiCats && apiCats.length > 0) {
        setCategories(apiCats);
      } else {
        setCategories(getDioxCategories(t));
      }
    });
    return () => { cancelled = true; };
  }, [currentLang]);

  const dioxData = {
    brandName: 'DIOX',
    brandNameArabic: t('diox.brandNameArabic'),
    heroTitle: t('diox.hero.title'),
    heroDescription: t('diox.hero.description'),
    heroImage: '/Diox-logo.png.webp',
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
    flipbookUrl: 'https://heyzine.com/flip-book/962ea2a11d.html'
  };

  return <BrandPageTemplate {...dioxData} />;
};

export default DioxPage;
