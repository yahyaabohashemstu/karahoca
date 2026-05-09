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
        <a href={`#${aboutId}`} className="scroll-indicator" aria-label={t('brandPage.scrollDown')}>
          <span className="scroll-indicator__dot"></span>
        </a>
      </section>

      <section id={aboutId} className="section glass-section section--alt">
        <div className="section-divider"></div>
        <div className="container section__head fx-reveal">
          <h2 className="section-title">{aboutTitle}</h2>
          <p className="section-subtitle">{aboutSubtitle}</p>
        </div>
        <div className="container split">
          <div className="fx-reveal" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '18px', padding: '18px', maxHeight: '320px', overflowY: 'auto', width: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.18)' }}>
              <div className="main-heading" style={{ marginBottom: '1em' }}>{aboutMainHeading}</div>
              {aboutSections.map((section, index) => (
                <React.Fragment key={index}>
                  <div className="section-divider" style={{ width: '80%', height: '2.5px', margin: '0.5em auto 1em auto' }}></div>
                  <div className="gradient-heading" style={{ marginBottom: '1em', fontWeight: 'bold', fontSize: '1.35em', letterSpacing: '0.5px' }}>{section.title}</div>
                  <p style={{ marginBottom: '1em' }}>{section.content}</p>
                </React.Fragment>
              ))}
            </div>
            <a href="#products" className="link gradient-text" style={{ marginTop: '18px' }}>{t('brandPage.exploreProducts')}</a>
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
