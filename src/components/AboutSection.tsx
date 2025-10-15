import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const AboutSection: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section id="about" className="section glass-section section--alt">
      <div className="section-divider"></div>
      <div className="container split">
        <div 
          className="fx-reveal"
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'flex-start' 
          }}
        >
          <h2 className="section-title gradient-text">{t('about.title')}</h2>
          <p style={{ 
            fontSize: '1.3em', 
            lineHeight: '1.8', 
            marginTop: '24px',
            marginBottom: '32px',
            maxWidth: '600px'
          }}>
            {t('about.shortDescription')}
          </p>
          <Link 
            to="/about" 
            className="btn btn--primary"
            style={{ 
              fontSize: '1.2em', 
              padding: '16px 48px',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            {t('about.learnMoreButton')}
          </Link>
        </div>
        
        <div className="fx-up">
          <div className="about-media glass-media">
            <div className="blob animated-blob"></div>
            <img 
              src="/KARAHOCA-2-wb.webp" 
              alt={t('about.imageAlt')}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;