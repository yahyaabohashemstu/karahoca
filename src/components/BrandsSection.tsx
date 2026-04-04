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

        {/* Inner glass card — same style as DIOX/AYLUX */}
        <div className="brands-inner-card">

          {/* Top: centered text + CTA */}
          <div className="brands-partner-content">
            <span className="brands-partner-badge">{t('customOrder.badge')}</span>
            <h3 className="brands-partner-title">{t('customOrder.title')}</h3>
            <p className="brands-partner-desc">{t('customOrder.description')}</p>
            <a
              href="https://wa.me/905305914990"
              target="_blank"
              rel="noopener noreferrer"
              className="brands-partner-cta brands-partner-cta--whatsapp"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              {t('customOrder.cta')}
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

        </div>{/* end .brands-inner-card */}

      </div>
    </section>
  );
};

export default BrandsSection;
