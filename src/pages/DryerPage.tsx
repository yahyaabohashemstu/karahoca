import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import SubPageTemplate from '../components/SubPageTemplate';

const DryerPage: React.FC = () => {
  const { t } = useTranslation();
  
  const sectionsData = [
    {
      id: 'pillars',
      title: t('dryer.sections.pillars.title'),
      subtitle: t('dryer.sections.pillars.subtitle'),
      isAlt: true,
      cards: [
        {
          title: t('dryer.sections.pillars.cards.capacity.title'),
          description: t('dryer.sections.pillars.cards.capacity.description'),
          accent: 'var(--orange)'
        },
        {
          title: t('dryer.sections.pillars.cards.integration.title'),
          description: t('dryer.sections.pillars.cards.integration.description'),
          accent: 'var(--blue)'
        },
        {
          title: t('dryer.sections.pillars.cards.consistency.title'),
          description: t('dryer.sections.pillars.cards.consistency.description'),
          accent: 'var(--orange)'
        }
      ]
    },
    {
      id: 'goals',
      title: t('dryer.sections.goals.title'),
      subtitle: '',
      splitContent: {
        title: t('dryer.sections.goals.title'),
        content: [
          t('dryer.sections.goals.content1'),
          t('dryer.sections.goals.content2'),
          t('dryer.sections.goals.content3')
        ],
        image: '/KARAHOCA-2-wb.webp',
        imageAlt: t('dryer.sections.goals.imageAlt')
      }
    }
  ];

  return (
    <>
      <SEO
        title={t('dryer.seo.title')}
        description={t('dryer.seo.description')}
        keywords={t('dryer.seo.keywords')}
        ogImage="/KARAHOCA-2-wb.webp"
        canonicalUrl="https://karahoca.com/dryer"
      />
      <SubPageTemplate
        pageClass="goal-page"
        heroTitle={t('dryer.heroTitle')}
        heroDescription={t('dryer.heroDescription')}
        heroImage="/KARAHOCA-2-wb.webp"
        heroImageAlt={t('dryer.heroImageAlt')}
        sectionsData={sectionsData}
      />
    </>
  );
};

export default DryerPage;