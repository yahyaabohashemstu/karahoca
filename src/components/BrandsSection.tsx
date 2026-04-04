import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* ─── Real partner logos ──────────────────────────────────────────────────── */
const PARTNERS: { name: string; logo: string; featured?: boolean }[] = [
  { name: 'Altunsa',              logo: '/logos/altunsa-logo.png',    featured: true },
  { name: 'Aktürk',              logo: '/logos/akturk-logo.png'                    },
  { name: 'Moher Kimya',         logo: '/logos/moher-logo.png'                     },
  { name: 'M.O.K',              logo: '/logos/mok-logo.png'                       },
  { name: 'Dar Al Khairr',      logo: '/logos/dar-alkhairr-logo.png'              },
];

const BrandsSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section id="brands" className="section glass-section">
      <div className="section-divider" />

      {/* ── Section header ───────────────────────────────────────── */}
      <div className="container section__head fx-reveal">
        <h2 className="section-title">{t('brands.title')}</h2>
        <p className="section-subtitle">{t('brands.subtitle')}</p>
      </div>

      {/* ── Brand cards (DIOX + AYLUX) ───────────────────────────── */}
      <div className="container cards">
        <Link className="card glass-card fx-up" to="/diox" aria-label="DIOX">
          <div className="card__media" style={{ '--card-accent': 'var(--blue)' } as React.CSSProperties}>
            <img
              src="/Diox-logo.png.webp"
              alt="DIOX"
              style={{ height: '144px', width: '144px', objectFit: 'contain' }}
            />
            <div className="card-glow" />
          </div>
          <div className="card__body">
            <h3>{t('brands.diox.title')}</h3>
            <p>{t('brands.diox.description')}</p>
            <span className="link gradient-text">{t('brands.diox.link')}</span>
          </div>
        </Link>

        <Link className="card glass-card fx-up" to="/aylux" aria-label="AYLUX">
          <div className="card__media" style={{ '--card-accent': 'var(--orange)' } as React.CSSProperties}>
            <img
              src="/Aylux-logo.png.webp"
              alt="AYLUX"
              style={{ height: '144px', width: '144px', objectFit: 'contain' }}
            />
            <div className="card-glow" />
          </div>
          <div className="card__body">
            <h3>{t('brands.aylux.title')}</h3>
            <p>{t('brands.aylux.description')}</p>
            <span className="link gradient-text">{t('brands.aylux.link')}</span>
          </div>
        </Link>
      </div>

      {/* ── Custom Manufacturing + Partner Logos ─────────────────── */}
      <div className="container brands-partner-row">

        {/* Top: centered text + CTA */}
        <div className="brands-partner-content">
          <span className="brands-partner-badge">{t('customOrder.badge')}</span>
          <h3 className="brands-partner-title">{t('customOrder.title')}</h3>
          <p className="brands-partner-desc">{t('customOrder.description')}</p>
          <a href="mailto:info@karahoca.com" className="brands-partner-cta">
            {t('customOrder.cta')} →
          </a>
        </div>

        {/* Divider */}
        <div className="brands-partner-divider" />

        {/* Bottom: real partner logos */}
        <div className="brands-partner-logos">
          <p className="brands-logos-label">{t('customOrder.partnersLabel')}</p>
          <div className="brands-logos-grid">
            {PARTNERS.map((p) => (
              <div
                key={p.name}
                className={`brands-logo-card${p.featured ? ' brands-logo-card--featured' : ''}`}
                aria-label={p.name}
              >
                <img
                  src={p.logo}
                  alt={p.name}
                  className="brands-logo-img"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default BrandsSection;
