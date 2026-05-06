import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { useLocalizedPath } from '../hooks/useLocalizedPath';

const AboutSection: React.FC = () => {
  const { t } = useTranslation();
  const { lp } = useLocalizedPath();

  return (
    <section id="about" className="section glass-section section--alt about-section">
      <div className="section-divider" aria-hidden="true" />
      <div className="container split about-section__split">
        <div className="fx-reveal about-section__copy">
          <span className="about-section__eyebrow">{t('about.eyebrow', { defaultValue: 'About KARAHOCA' })}</span>
          <h2 className="about-section__title">{t('about.title')}</h2>
          <p className="about-section__lead">{t('about.shortDescription')}</p>
          <Link
            to={lp('/about')}
            className="btn-premium btn-premium--primary about-section__cta"
          >
            <span className="btn-premium__label">{t('about.learnMoreButton')}</span>
            <span className="btn-premium__icon" aria-hidden="true">
              <ArrowRight size={16} weight="bold" />
            </span>
          </Link>
        </div>

        <div className="fx-up about-section__media-wrap">
          <div className="about-section__media">
            <img
              src="/KARAHOCA-2-wb.webp"
              alt={t('about.imageAlt')}
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
