import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { normalizeLanguageCode } from '../utils/language';
import { useWishlist } from '../hooks/useWishlist';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const { items } = useWishlist();
  const wishCount = items.length;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const menuMarginLeft = currentLanguage === 'ru' ? '12rem' : '20rem';
  const isHomePage = location.pathname === '/';
  const brandsHref = isHomePage ? '#brands' : '/#brands';
  const newsHref = isHomePage ? '#news' : '/#news';
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
          <a href={newsHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.news')}</a>
          <a href={numbersHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('numbers.title')}</a>
          <a href={aboutHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.about')}</a>

          {/* Wishlist icon */}
          <Link
            to="/wishlist"
            className="nav-link header-wishlist-btn"
            aria-label="Wishlist"
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill={wishCount > 0 ? '#ef4444' : 'none'} stroke={wishCount > 0 ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.25s ease' }}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {wishCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -6,
                right: -6,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff',
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 700,
                lineHeight: 1,
                boxShadow: '0 2px 6px rgba(239,68,68,0.5)',
                animation: 'wishlist-pop 0.3s ease',
              }}>
                {wishCount > 99 ? '99+' : wishCount}
              </span>
            )}
          </Link>

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
        <a href={newsHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.news')}</a>
        <a href={numbersHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('numbers.title')}</a>
        <a href={aboutHref} className="nav-link" style={{ whiteSpace: 'nowrap' }}>{t('nav.about')}</a>
        <Link to="/wishlist" className="nav-link" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={wishCount > 0 ? '#ef4444' : 'none'} stroke={wishCount > 0 ? '#ef4444' : 'currentColor'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          {wishCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '0 6px', fontSize: '0.7rem', fontWeight: 700 }}>{wishCount}</span>}
        </Link>
        <a href="#contact" className="btn btn--primary" style={{ whiteSpace: 'nowrap' }}>{t('nav.contact')}</a>
      </nav>
    </header>
  );
};

export default Header;
