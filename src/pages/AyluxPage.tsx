import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import BrandPageTemplate from '../components/BrandPageTemplate';
import { getAyluxCategories } from '../data/brandCatalog';

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
      <AyluxPageContent />
    </>
  );
};

const AyluxPageContent: React.FC = () => {
  const { t } = useTranslation();
  
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
    categories: getAyluxCategories(t),
    pageClass: 'aylux-page',
    aboutId: 'about-aylux'
  };

  return <BrandPageTemplate {...ayluxData} />;
};

export default AyluxPage;
