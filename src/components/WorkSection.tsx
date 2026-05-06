import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from '@phosphor-icons/react';
import { useLocalizedPath } from '../hooks/useLocalizedPath';

/**
 * WorkSection — premium Bento layout v3.
 *
 * v3 redesign: replaced "3 equal cards in a row" (banned per design audit
 * as the most generic AI feature-row pattern) with an asymmetric Bento:
 *   row 1: 1 large feature card (Production) + 1 medium card (Goal)
 *   row 2: 1 wide card (Dryer)
 * No inline styles — every value in CSS.
 */
const WorkSection: React.FC = () => {
  const { t } = useTranslation();
  const { lp } = useLocalizedPath();

  return (
    <section id="work" className="section section--alt work-section">
      <div className="section-divider" aria-hidden="true" />

      <div className="container work-section__head">
        <span className="work-section__eyebrow">{t('work.eyebrow', { defaultValue: 'Capabilities' })}</span>
        <h2 className="work-section__title">{t('work.title')}</h2>
      </div>

      <div className="container work-bento">
        {/* Lead — large feature card with bg image */}
        <Link
          to={lp('/production')}
          aria-label={t('work.production.aria')}
          className="work-bento__card work-bento__card--lead"
        >
          <div className="work-bento__media">
            <img
              src="/KARAHOCA-4-web.webp"
              alt={t('work.production.alt')}
              loading="lazy"
              decoding="async"
            />
            <div className="work-bento__overlay" aria-hidden="true" />
          </div>
          <div className="work-bento__body">
            <span className="work-bento__kicker">{t('work.production.subtitle')}</span>
            <h3 className="work-bento__heading">{t('work.production.title')}</h3>
            <span className="work-bento__cta">
              {t('work.production.link')}
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </span>
          </div>
        </Link>

        {/* Side — medium card */}
        <Link
          to={lp('/goal')}
          aria-label={t('work.goal.aria')}
          className="work-bento__card work-bento__card--side"
        >
          <div className="work-bento__media">
            <img
              src="/KARAHOCA-2-wb.webp"
              alt={t('work.goal.alt')}
              loading="lazy"
              decoding="async"
            />
            <div className="work-bento__overlay" aria-hidden="true" />
          </div>
          <div className="work-bento__body">
            <span className="work-bento__kicker">{t('work.goal.subtitle')}</span>
            <h3 className="work-bento__heading">{t('work.goal.title')}</h3>
            <span className="work-bento__cta">
              {t('work.goal.link')}
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </span>
          </div>
        </Link>

        {/* Wide — full-row card */}
        <Link
          to={lp('/dryer')}
          aria-label={t('work.dryer.aria')}
          className="work-bento__card work-bento__card--wide"
        >
          <div className="work-bento__media">
            <img
              src="/KARAHOCA-3-wb.webp"
              alt={t('work.dryer.alt')}
              loading="lazy"
              decoding="async"
            />
            <div className="work-bento__overlay" aria-hidden="true" />
          </div>
          <div className="work-bento__body work-bento__body--wide">
            <div>
              <span className="work-bento__kicker">{t('work.dryer.subtitle')}</span>
              <h3 className="work-bento__heading">{t('work.dryer.title')}</h3>
            </div>
            <span className="work-bento__cta">
              {t('work.dryer.link')}
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default WorkSection;
