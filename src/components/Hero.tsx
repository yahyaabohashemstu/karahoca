import React from 'react';
import { useTranslation } from 'react-i18next';

const Hero: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = (i18n.resolvedLanguage || i18n.language || '').startsWith('ar');

  return (
    <section className="hero">
      <div className="container hero__grid">
        <div className="hero__copy">
          <h1 className="fx-reveal hero-title">
            <span className="accent gradient-text">{t('hero.title')}</span>
          </h1>
          {/* Brand-name eyebrow visible to Arabic visitors above the lead.
              Carries BOTH the most-searched Arabic transliteration
              ("قره خوجة") and the modern phonetic form ("كاراهوكا") so
              the homepage's primary text content carries the variants
              search engines need to associate the URL with each query.
              Rendered as semantic <p> with role="text" so screen readers
              announce it once, and aria-label maps the dot to a comma
              for natural reading. */}
          {isArabic && (
            <p
              className="fx-reveal hero-brand-line"
              aria-label="كاراهوكا، قره خوجة"
            >
              <span aria-hidden="true">كاراهوكا · قره خوجة · KARAHOCA</span>
            </p>
          )}
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
              {/* No inline `object-fit` — main.css handles BOTH breakpoints:
                  • Desktop  → `.card-3d__inner img { object-fit: cover }`   (image fills the card, no whitespace)
                  • Mobile   → `@media (max-width: 768px) { ... object-fit: contain }`   (so the brand wordmark stays visible inside the 180-px-tall mobile crop)
                  An inline `style={{ objectFit: ... }}` would override BOTH rules
                  with the same value, killing one of the two desired behaviours. */}
              <img
                src="/KARAHOCA-1-newPhoto.webp"
                alt="KARAHOCA"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;