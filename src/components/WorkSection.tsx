import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalizedPath } from '../hooks/useLocalizedPath';

/**
 * Style contract shared by every WorkSection banner.
 *
 * ─ Why we override `.card__media` inline ────────────────────────────────────
 * `.card__media` is defined in main.css as a 2 rem-padded slot whose original
 * job was to hold an 80 × 80 product ICON with a drop-shadow and a small
 * hover-tilt. WorkSection re-uses the same class for full-width BANNER
 * imagery, which makes the inherited 2 rem padding actively hostile — the
 * image is pushed 32 px inward from every edge of the card, leaving a
 * visible border of background that breaks the "image fills the top of the
 * card" composition.
 *
 * Earlier the file compensated with `transform: scale(1.4)` on the <img>,
 * which visually re-extended the photo back to the card's edges but spilled
 * the picture OUTSIDE the rounded frame on the left/right and pushed the
 * cropped focal point off-centre. (See the user-reported screenshot from
 * the mobile audit follow-up: visible image bleed past the rounded card
 * edges on every Work card.)
 *
 * The clean fix is to:
 *   1.  Zero out the padding on `.card__media` for THIS use only.
 *   2.  Apply `overflow: hidden` + the matching `borderTopLeftRadius /
 *       borderTopRightRadius` on the slot itself, so the rounded mask now
 *       belongs to the FRAME and the image inherits the clip naturally.
 *   3.  Drop the static `scale(1.4)` — `object-fit: cover` on a banner-
 *       sized image already fills the frame edge-to-edge, no zoom needed.
 *   4.  Keep a subtle `transition: transform` so the existing
 *       `.glass-card:hover .card__media img { transform: scale(1.1) … }`
 *       rule in main.css still animates from a calm 1.0 baseline (was
 *       starting from 1.4, which made hover shrink the image — backwards).
 *
 * Visual outcome: the photo fills the top of the card precisely up to the
 * rounded corners, no bleed, no awkward zoom; on hover it gently scales
 * up by 10 % (clipped to the frame thanks to the new overflow:hidden).
 */
const mediaSlotStyle: React.CSSProperties = {
  margin: 'auto',
  padding: 0,
  overflow: 'hidden',
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
};

const mediaImageStyle: React.CSSProperties = {
  width: '100%',
  height: '200px',
  objectFit: 'cover',
  display: 'block',
  transition: 'transform 0.4s ease',
};

const WorkSection: React.FC = () => {
  const { t } = useTranslation();
  const { lp } = useLocalizedPath();

  return (
    <section id="work" className="section glass-section section--alt">
      <div className="section-divider"></div>
      <div className="container work__head fx-reveal">
        <div className="work__title">
          <h2 className="section-title">{t('work.title')}</h2>
        </div>
      </div>
      <div className="container work__grid">
        <Link
          className="card glass-card fx-up"
          to={lp('/production')}
          aria-label={t('work.production.aria')}
          style={{ display: 'block', textAlign: 'center' }}
        >
          <div className="card__media" style={{ ...mediaSlotStyle, '--card-accent': 'var(--blue)' } as React.CSSProperties}>
            <img
              src="/KARAHOCA-4-web.webp"
              alt={t('work.production.alt')}
              loading="lazy"
              decoding="async"
              style={mediaImageStyle}
            />
            <div className="card-glow"></div>
          </div>
          <div className="card__body">
            <h4 style={{ marginBottom: '12px', fontSize: '2em', fontWeight: 900, letterSpacing: '1px' }}>
              {t('work.production.title')}
            </h4>
            <div style={{ marginBottom: '12px', fontSize: '1.35em', fontWeight: 500 }}>
              {t('work.production.subtitle')}
            </div>
            <span className="link gradient-text">{t('work.production.link')}</span>
          </div>
        </Link>

        <Link
          className="card glass-card fx-up"
          to={lp('/dryer')}
          aria-label={t('work.dryer.aria')}
          style={{ display: 'block', textAlign: 'center' }}
        >
          <div className="card__media" style={{ ...mediaSlotStyle, '--card-accent': 'var(--orange)' } as React.CSSProperties}>
            <img
              src="/KARAHOCA-3-wb.webp"
              alt={t('work.dryer.alt')}
              loading="lazy"
              decoding="async"
              style={mediaImageStyle}
            />
            <div className="card-glow"></div>
          </div>
          <div className="card__body">
            <h4 style={{ marginBottom: '12px', fontSize: '2em', fontWeight: 900, letterSpacing: '1px' }}>
              {t('work.dryer.title')}
            </h4>
            <div style={{ marginBottom: '12px', fontSize: '1.35em', fontWeight: 500 }}>
              {t('work.dryer.subtitle')}
            </div>
            <span className="link gradient-text">{t('work.dryer.link')}</span>
          </div>
        </Link>

        <Link
          className="card glass-card fx-up"
          to={lp('/goal')}
          aria-label={t('work.goal.aria')}
          style={{ display: 'block', textAlign: 'center' }}
        >
          <div className="card__media" style={{ ...mediaSlotStyle, '--card-accent': 'var(--blue)' } as React.CSSProperties}>
            <img
              src="/KARAHOCA-2-wb.webp"
              alt={t('work.goal.alt')}
              loading="lazy"
              decoding="async"
              style={mediaImageStyle}
            />
            <div className="card-glow"></div>
          </div>
          <div className="card__body">
            <h4 style={{ marginBottom: '12px', fontSize: '2em', fontWeight: 900, letterSpacing: '1px' }}>
              {t('work.goal.title')}
            </h4>
            <div style={{ marginBottom: '12px', fontSize: '1.35em', fontWeight: 500 }}>
              {t('work.goal.subtitle')}
            </div>
            <span className="link gradient-text">{t('work.goal.link')}</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default WorkSection;