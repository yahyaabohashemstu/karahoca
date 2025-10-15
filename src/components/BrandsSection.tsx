import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const BrandsSection: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <section id="brands" className="section glass-section">
      <div className="section-divider"></div>
      <div className="container section__head fx-reveal">
        <h2 className="section-title">{t('brands.title')}</h2>
        <p className="section-subtitle">{t('brands.subtitle')}</p>
      </div>
      <div className="container cards">
        <Link className="card glass-card fx-up" to="/diox" aria-label="DIOX">
          <div className="card__media" style={{ '--card-accent': 'var(--blue)' } as React.CSSProperties}>
            <img 
              src="/Diox-logo.png.webp" 
              alt="DIOX"
              style={{ height: '144px', width: '144px', objectFit: 'contain' }}
            />
            <div className="card-glow"></div>
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
            <div className="card-glow"></div>
          </div>
          <div className="card__body">
            <h3>{t('brands.aylux.title')}</h3>
            <p>{t('brands.aylux.description')}</p>
            <span className="link gradient-text">{t('brands.aylux.link')}</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default BrandsSection;