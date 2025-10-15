import React from 'react';
import { useTranslation } from 'react-i18next';

const Hero: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__copy">
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
        <div className="hero__visual">
          <div className="hero-orb hero-orb--1"></div>
          <div className="hero-orb hero-orb--2"></div>
          <div className="card-3d" data-tilt>
            <div className="card-3d__inner glass-panel">
              <img 
                src="/KARAHOCA-1-newPhoto.webp" 
                alt="KARAHOCA"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;