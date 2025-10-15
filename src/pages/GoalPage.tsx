import React from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import SubPageTemplate from '../components/SubPageTemplate';

const GoalPage: React.FC = () => {
  const { t } = useTranslation();
  
  const sectionsData = [
    {
      id: 'pillars',
      title: t('goal.sections.pillars.title'),
      subtitle: t('goal.sections.pillars.subtitle'),
      isAlt: true,
      cards: [
        {
          title: t('goal.sections.pillars.innovation.title'),
          description: t('goal.sections.pillars.innovation.description'),
          accent: 'var(--orange)'
        },
        {
          title: t('goal.sections.pillars.expansion.title'),
          description: t('goal.sections.pillars.expansion.description'),
          accent: 'var(--blue)'
        },
        {
          title: t('goal.sections.pillars.quality.title'),
          description: t('goal.sections.pillars.quality.description'),
          accent: 'var(--orange)'
        }
      ]
    },
    {
      id: 'goals',
      title: t('goal.sections.goals.title'),
      subtitle: '',
      splitContent: {
        title: t('goal.sections.goals.title'),
        content: [
          t('goal.sections.goals.content1'),
          t('goal.sections.goals.content2'),
          t('goal.sections.goals.content3')
        ],
        image: '/KARAHOCA-2-wb.webp',
        imageAlt: t('goal.sections.goals.imageAlt')
      }
    }
  ];

  return (
    <>
      <SEO 
        title={t('goal.seo.title')}
        description={t('goal.seo.description')}
        keywords={t('goal.seo.keywords')}
      />
      <SubPageTemplate
        pageClass="goal-page"
        heroTitle={t('goal.heroTitle')}
        heroDescription={t('goal.heroDescription')}
        heroImage="/KARAHOCA-2-wb.webp"
        heroImageAlt={t('goal.heroImageAlt')}
        sectionsData={sectionsData}
      />
    </>
  );
};

export default GoalPage;