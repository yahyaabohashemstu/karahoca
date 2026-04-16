import React from 'react';
import { useTranslation } from 'react-i18next';

const Hero: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="hero">
      {/* Full-width background image */}
      <div className="hero__bg">
        <img
          src="/KARAHOCA-1-newPhoto.webp"
          alt="KARAHOCA"
          fetchPriority="high"
          className="hero__bg-img"
        />
        <div className="hero__bg-overlay" />
      </div>

      {/* Content on top */}
      <div className="container hero__content">
        <h1 className="fx-reveal hero-title">
          <span className="accent gradient-text">{t('hero.title')}</span>
        </h1>
        <p className="lead fx-reveal">{t('hero.subtitle')}</p>
        <div className="hero__cta fx-reveal">
          <a href="#brands" className="btn btn--primary btn-hover-effect">{t('hero.cta.products')}</a>
          <a href="#contact" className="btn btn--ghost btn-hover-effect">{t('hero.cta.about')}</a>
        </div>
        <ul className="hero__badges">
          <li className="chip glass-chip">{t('hero.badges.quality')}</li>
          <li className="chip glass-chip">{t('hero.badges.experience')}</li>
          <li className="chip glass-chip">{t('hero.badges.countries')}</li>
        </ul>
      </div>
    </section>
  );
};

export default Hero;
