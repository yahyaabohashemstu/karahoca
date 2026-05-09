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
            {/* Fix for Issue #12: <br /> in <h1> replaced with semantic spans
                that get `display: block` from `.hero-title__brand/__line`.
                Same visual layout, valid HTML, no forced line break. */}
            <h1 className="fx-reveal hero-title">
              <span className="gradient-text hero-title__brand">{brandName}</span>
              <span className="hero-title__line">{heroTitle}</span>
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
            <div className="hero-orb hero-orb--1"></div>
            <div className="hero-orb hero-orb--2"></div>
            <div className="card-3d" data-tilt="true">
              <div className="card-3d__inner glass-panel">
                <ImageWithFallback
                  src={heroImage}
                  fallbackSrc={heroImageFallback}
                  alt={heroImageAlt}
                  width={800}
                  height={800}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id={aboutId} className="section glass-section section--alt">
        <div className="section-divider"></div>
        <div className="container section__head fx-reveal">
          <h2 className="section-title">{aboutTitle}</h2>
          <p className="section-subtitle">{aboutSubtitle}</p>
        </div>
        <div className="container split">
          {/* Fix for Issue #9: every inline style replaced with token-driven
              CSS classes (`.about-split__copy`, `.about-content-panel`,
              `.about-content-panel__*`, `.about-explore-link`). Spacing,
              radius, glass surface, border, shadow now flow from tokens. */}
          <div className="fx-reveal about-split__copy">
            <div className="about-content-panel">
              <div className="main-heading about-content-panel__heading">{aboutMainHeading}</div>
              {aboutSections.map((section, index) => (
                <React.Fragment key={index}>
                  <div className="section-divider about-content-panel__divider"></div>
                  <div className="gradient-heading about-content-panel__subtitle">{section.title}</div>
                  <p className="about-content-panel__text">{section.content}</p>
                </React.Fragment>
              ))}
            </div>
            <a href="#products" className="link gradient-text about-explore-link">{t('brandPage.exploreProducts')}</a>
          </div>
          <div className="fx-up">
            <div className="about-media glass-media">
              <div className="animated-blob blob"></div>
              <div className="animated-blob blob--alt"></div>
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
