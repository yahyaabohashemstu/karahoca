import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* ─── Partner logo placeholders ─────────────────────────────────────────────
   Replace src values with real logo paths once available, e.g. /partners/carrefour.png
   ─────────────────────────────────────────────────────────────────────────── */
const PARTNERS: { name: string; abbr: string; color: string }[] = [
  { name: 'Carrefour',  abbr: 'CF',  color: '#004E9A' },
  { name: 'Metro',      abbr: 'MT',  color: '#003087' },
  { name: 'BIM',        abbr: 'BİM', color: '#E30613' },
  { name: 'A101',       abbr: 'A101',color: '#F7941D' },
  { name: 'Migros',     abbr: 'MG',  color: '#E2001A' },
  { name: 'ŞOK',        abbr: 'ŞOK', color: '#FF6600' },
  { name: 'Watsons',    abbr: 'WT',  color: '#00A651' },
  { name: 'Gratis',     abbr: 'GR',  color: '#C8102E' },
];

/* Duplicate the list so the CSS infinite-scroll loop is seamless */
const MARQUEE_ITEMS = [...PARTNERS, ...PARTNERS];

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

        {/* Top: text + CTA */}
        <div className="brands-partner-content">
          <div className="brands-partner-text">
            <span className="brands-partner-badge">{t('customOrder.badge')}</span>
            <h3 className="brands-partner-title">{t('customOrder.title')}</h3>
            <p className="brands-partner-desc">{t('customOrder.description')}</p>
          </div>
          <a href="mailto:info@karahoca.com" className="brands-partner-cta">
            {t('customOrder.cta')} →
          </a>
        </div>

        {/* Divider */}
        <div className="brands-partner-divider" />

        {/* Bottom: scrolling partner logos */}
        <div className="brands-partner-logos">
          <p className="brands-logos-label">{t('customOrder.partnersLabel')}</p>
          <div className="brands-marquee-wrapper">
            <div className="brands-marquee-fade brands-marquee-fade--start" />
            <div className="brands-marquee">
              <div className="brands-marquee-track">
                {MARQUEE_ITEMS.map((p, i) => (
                  <div
                    key={i}
                    className="brands-logo-chip"
                    style={{ '--chip-color': p.color } as React.CSSProperties}
                    aria-label={p.name}
                  >
                    <span className="brands-logo-abbr">{p.abbr}</span>
                    <span className="brands-logo-name">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="brands-marquee-fade brands-marquee-fade--end" />
          </div>
        </div>

      </div>
    </section>
  );
};

export default BrandsSection;
