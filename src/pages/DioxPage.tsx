import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import BrandPageTemplate from '../components/BrandPageTemplate';
import { getDioxCategories } from '../data/brandCatalog';

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
      <DioxPageContent />
    </>
  );
};

const DioxPageContent: React.FC = () => {
  const { t } = useTranslation();
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
    categories: getDioxCategories(t),
    contactId: 'contact-diox',
    aboutId: 'about-diox',
    pageClass: 'diox-page'
  };

  return <BrandPageTemplate {...dioxData} />;
};

export default DioxPage;




