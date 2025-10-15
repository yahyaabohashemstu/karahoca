import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import SubPageTemplate from '../components/SubPageTemplate';

const ProductionPage: React.FC = () => {
  const { t } = useTranslation();
  
  const sectionsData = [
    {
      id: 'process',
      title: t('production.sections.process.title'),
      subtitle: t('production.sections.process.subtitle'),
      isAlt: true,
      cards: [
        {
          title: t('production.sections.process.cards.sourcing.title'),
          description: t('production.sections.process.cards.sourcing.description'),
          accent: 'var(--orange)'
        },
        {
          title: t('production.sections.process.cards.mixing.title'),
          description: t('production.sections.process.cards.mixing.description'),
          accent: 'var(--blue)'
        },
        {
          title: t('production.sections.process.cards.packaging.title'),
          description: t('production.sections.process.cards.packaging.description'),
          accent: 'var(--orange)'
        }
      ]
    },
    {
      id: 'safety',
      title: t('production.sections.safety.title'),
      subtitle: '',
      splitContent: {
        title: t('production.sections.safety.title'),
        content: [
          t('production.sections.safety.content1'),
          t('production.sections.safety.content2'),
          t('production.sections.safety.content3')
        ],
        image: '/KARAHOCA-4-web.webp',
        imageAlt: t('production.sections.safety.imageAlt')
      }
    }
  ];

  return (
    <>
      <SEO
        title={t('production.seo.title')}
        description={t('production.seo.description')}
        keywords={t('production.seo.keywords')}
        ogImage="/KARAHOCA-4-web.webp"
        canonicalUrl="https://karahoca.com/production"
      />
      <SubPageTemplate
        pageClass="production-page"
        heroTitle={t('production.heroTitle')}
        heroDescription={t('production.heroDescription')}
        heroImage="/KARAHOCA-4-web.webp"
        heroImageAlt={t('production.heroImageAlt')}
        sectionsData={sectionsData}
      />
    </>
  );
};

export default ProductionPage;