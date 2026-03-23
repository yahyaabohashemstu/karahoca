import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { normalizeLanguageCode } from '../utils/language';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const menuMarginLeft = currentLanguage === 'ru' ? '12rem' : '20rem';
  const isHomePage = location.pathname === '/';
  const brandsHref = isHomePage ? '#brands' : '/#brands';
  const numbersHref = isHomePage ? '#numbers' : '/#numbers';
  const aboutHref = isHomePage ? '#about' : '/about';

  return (
    <header className={`site-header glass-panel ${className}`}>
      <div className="container nav">
        <div style={{ marginRight: '-5rem', marginLeft: 'auto' }}>
          <LanguageSwitcher inline />
        </div>

        <nav className="menu" aria-label={t('nav.menu')} style={{ marginRight: 'auto', marginLeft: menuMarginLeft, gap: '1.25rem' }}>
          <a href={brandsHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.brands')}</a>
          <Link to="/news" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.news')}</Link>
          <a href={numbersHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('numbers.title')}</a>
          <a href={aboutHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.about')}</a>
          <a href="#contact" className="btn btn--primary" style={{ whiteSpace: 'nowrap' }}>{t('nav.contact')}</a>
        </nav>

        <button
          className="hamburger glass-button"
          aria-label={t('nav.menu')}
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
        <a href={brandsHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.brands')}</a>
        <Link to="/news" className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.news')}</Link>
        <a href={numbersHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('numbers.title')}</a>
        <a href={aboutHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.about')}</a>
        <a href="#contact" className="btn btn--primary" style={{ whiteSpace: 'nowrap' }}>{t('nav.contact')}</a>
      </nav>
    </header>
  );
};

export default Header;
