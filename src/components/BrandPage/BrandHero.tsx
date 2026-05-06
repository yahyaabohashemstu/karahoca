import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkle } from '@phosphor-icons/react';
import PageHero from '../PageHero';

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
 * v3: now uses the unified <PageHero> primitive — same eyebrow/CTA/visual
 * paradigm as the home Hero so the user feels one consistent design language
 * across navigation. The brand name appears in the eyebrow as a microlabel.
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
      <PageHero
        sectionId="brand-hero"
        eyebrow={
          <>
            <Sparkle weight="fill" size={12} aria-hidden="true" />
            <span>{brandName}</span>
          </>
        }
        title={heroTitle}
        description={heroDescription}
        primaryAction={
          <a href="#products" className="btn-premium btn-premium--primary">
            <span className="btn-premium__label">
              {t('brandPage.exploreProducts')}
            </span>
            <span className="btn-premium__icon" aria-hidden="true">
              <ArrowRight size={16} weight="bold" />
            </span>
          </a>
        }
        tertiaryAction={
          <a href="#contact" className="btn-premium btn-premium--tertiary">
            {t('brandPage.requestQuote')}
            <span className="btn-premium__chevron" aria-hidden="true">→</span>
          </a>
        }
        chips={badges}
        image={heroImage}
        imageFallback={heroImageFallback}
        imageAlt={heroImageAlt}
        imageLCP
      />

      <section
        id={aboutId}
        className="section glass-section section--alt brand-about"
      >
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
                  <div className="brand-about__section-title">
                    {section.title}
                  </div>
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
