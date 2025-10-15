import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className={`site-header glass-panel ${className}`}>
      <div className="container nav">
        {/* Language Switcher - Fixed on the right */}
        <div style={{ marginRight: '-5rem', marginLeft: 'auto' }}>
          <LanguageSwitcher inline />
        </div>

        {/* Main Navigation Menu - Moved towards left */}
        <nav className="menu" aria-label={t('nav.brands')} style={{ marginRight: 'auto', marginLeft: '24rem', gap: '1.5rem' }}>
          <a href="#brands" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.brands')}</a>
          <a href="#numbers" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('numbers.title')}</a>
          <a href="#about" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.about')}</a>
          <a href="#contact" className="btn btn--primary" style={{ whiteSpace: 'nowrap' }}>{t('nav.contact')}</a>
        </nav>
        
        <button 
          className="hamburger glass-button" 
          aria-label="قائمة" 
          aria-expanded={isMobileMenuOpen} 
          aria-controls="mobile-menu"
          onClick={toggleMobileMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        <Link to="/" className="brand" style={{ marginLeft: 0, marginRight: 'auto' }}>
          <img 
            src="/karahoca-logo-1-Photoroom.webp" 
            alt="KARAHOCA" 
            className="brand__logo"
            style={{ height: '64px', width: 'auto', objectFit: 'contain' }}
          />
        </Link>
      </div>
      
      <nav 
        id="mobile-menu" 
        className={`mobile-menu glass-panel ${isMobileMenuOpen ? 'mobile-menu--open' : ''}`} 
        aria-hidden={!isMobileMenuOpen}
      >
        <a href="#brands" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.brands')}</a>
        <a href="#numbers" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('numbers.title')}</a>
        <a href="#about" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.about')}</a>
        <a href="#contact" className="btn btn--primary" style={{ whiteSpace: 'nowrap' }}>{t('nav.contact')}</a>
      </nav>
    </header>
  );
};

export default Header;