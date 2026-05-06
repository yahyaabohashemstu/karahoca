import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkle } from '@phosphor-icons/react';
import PageHero from './PageHero';

/**
 * KARAHOCA Home Hero — uses the unified <PageHero> primitive.
 *
 * The premium v3 layout (eyebrow, button-in-button CTA, double-bezel
 * visual, spring motion) lives in `PageHero`. This component only
 * supplies the home-specific copy + actions.
 */
const Hero: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageHero
      sectionId="hero"
      eyebrow={
        <>
          <Sparkle weight="fill" size={12} aria-hidden="true" />
          <span>
            {t('hero.eyebrow', { defaultValue: 'Premium Cleaning Manufacturer' })}
          </span>
        </>
      }
      title={t('hero.title')}
      description={t('hero.subtitle')}
      primaryAction={
        <a href="#brands" className="btn-premium btn-premium--primary">
          <span className="btn-premium__label">{t('hero.cta.products')}</span>
          <span className="btn-premium__icon" aria-hidden="true">
            <ArrowRight size={16} weight="bold" />
          </span>
        </a>
      }
      tertiaryAction={
        <a href="#about" className="btn-premium btn-premium--tertiary">
          {t('hero.cta.about')}
          <span className="btn-premium__chevron" aria-hidden="true">→</span>
        </a>
      }
      chips={[
        t('hero.badges.quality'),
        t('hero.badges.experience'),
        t('hero.badges.countries'),
      ]}
      image="/KARAHOCA-1-newPhoto.webp"
      imageAlt="KARAHOCA"
      imageLCP
    />
  );
};

export default Hero;
