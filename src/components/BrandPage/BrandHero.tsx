import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import ImageWithFallback from '../ImageWithFallback';

interface BrandHeroProps {
  brandName: string;
  brandNameArabic: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
  heroImageFallback?: string;
  heroImageAlt: string;
  badges: string[];
  aboutTitle: string;
  aboutSubtitle: string;
  aboutMainHeading: string;
  aboutSections: Array<{ title: string; content: string }>;
  aboutId: string;
}

/**
 * Hero band + About panel for a brand page (DIOX / AYLUX).
 *
 * Pure presentation — no state, no effects. Extracted from the former
 * `BrandPageTemplate.tsx` monolith.
 */
const BrandHeroComponent: React.FC<BrandHeroProps> = ({
  brandName,
  brandNameArabic,
  heroTitle,
  heroDescription,
  heroImage,
  heroImageFallback,
  heroImageAlt,
  badges,
  aboutTitle,
  aboutSubtitle,
  aboutMainHeading,
  aboutSections,
  aboutId,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <h1 className="fx-reveal hero-title">
              <span className="gradient-text">{brandName}</span><br />
              {heroTitle}
            </h1>
            <p className="lead fx-reveal">{heroDescription}</p>
            <div className="hero__cta fx-reveal">
              <a href="#products" className="btn btn--primary btn-hover-effect">{t('brandPage.exploreProducts')}</a>
              <a href="#contact" className="btn btn--ghost btn-hover-effect">{t('brandPage.requestQuote')}</a>
            </div>
            <ul className="hero__badges">
              {badges.map((badge) => (
                <li key={badge} className="chip glass-chip">{badge}</li>
              ))}
            </ul>
          </div>
          <div className="hero__visual">
            <div className="hero__visual-shell">
              <div className="hero__visual-core">
                <ImageWithFallback
                  src={heroImage}
                  fallbackSrc={heroImageFallback}
                  alt={heroImageAlt}
                  width={800}
                  height={800}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="hero__visual-img"
                />
                <div className="hero__visual-highlight" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id={aboutId} className="section glass-section section--alt brand-about">
        <div className="section-divider" aria-hidden="true" />
        <div className="container section__head fx-reveal">
          <h2 className="section-title">{aboutTitle}</h2>
          <p className="section-subtitle">{aboutSubtitle}</p>
        </div>
        <div className="container split brand-about__split">
          <div className="fx-reveal brand-about__copy">
            <div className="brand-about__panel">
              <div className="brand-about__panel-heading">{aboutMainHeading}</div>
              {aboutSections.map((section, index) => (
                <React.Fragment key={index}>
                  <div className="brand-about__panel-divider" aria-hidden="true" />
                  <div className="brand-about__section-title">{section.title}</div>
                  <p className="brand-about__section-body">{section.content}</p>
                </React.Fragment>
              ))}
            </div>
            <a href="#products" className="brand-about__link">
              {t('brandPage.exploreProducts')}
            </a>
          </div>
          <div className="fx-up brand-about__media-wrap">
            <div className="about-media glass-media brand-about__media">
              <img
                src="/KARAHOCA-1-newPhoto.webp"
                alt={`${t('brandPage.productsAlt')} ${brandNameArabic}`}
                width={900}
                height={600}
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const BrandHero = memo(BrandHeroComponent);
BrandHero.displayName = 'BrandHero';

export default BrandHero;
