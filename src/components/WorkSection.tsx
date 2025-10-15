import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const WorkSection: React.FC = () => {
  const { t } = useTranslation();
  
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
          to="/production" 
          aria-label={t('work.production.aria')}
          style={{ display: 'block', textAlign: 'center' }}
        >
          <div className="card__media" style={{ '--card-accent': 'var(--blue)', margin: 'auto' } as React.CSSProperties}>
            <img 
              src="/KARAHOCA-4-web.webp" 
              alt={t('work.production.alt')}
              style={{ 
                width: '100%', 
                height: '180px', 
                objectFit: 'cover', 
                display: 'block', 
                borderTopLeftRadius: '24px', 
                borderTopRightRadius: '24px', 
                transform: 'scale(1.4)', 
                transition: 'transform 0.3s' 
              }}
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
          to="/dryer" 
          aria-label={t('work.dryer.aria')}
          style={{ display: 'block', textAlign: 'center' }}
        >
          <div className="card__media" style={{ '--card-accent': 'var(--orange)', margin: 'auto' } as React.CSSProperties}>
            <img 
              src="/KARAHOCA-3-wb.webp" 
              alt={t('work.dryer.alt')}
              style={{ 
                width: '100%', 
                height: '180px', 
                objectFit: 'cover', 
                display: 'block', 
                borderTopLeftRadius: '24px', 
                borderTopRightRadius: '24px', 
                transform: 'scale(1.4)', 
                transition: 'transform 0.3s' 
              }}
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
          to="/goal" 
          aria-label={t('work.goal.aria')}
          style={{ display: 'block', textAlign: 'center' }}
        >
          <div className="card__media" style={{ '--card-accent': 'var(--blue)', margin: 'auto' } as React.CSSProperties}>
            <img 
              src="/KARAHOCA-2-wb.webp" 
              alt={t('work.goal.alt')}
              style={{ 
                width: '100%', 
                height: '180px', 
                objectFit: 'cover', 
                display: 'block', 
                borderTopLeftRadius: '24px', 
                borderTopRightRadius: '24px', 
                transform: 'scale(1.4)', 
                transition: 'transform 0.3s' 
              }}
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