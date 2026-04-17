import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useWishlist } from '../hooks/useWishlist';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { items } = useWishlist();
  const wishCount = items.length;
  const isHomePage = location.pathname === '/';
  const brandsHref = isHomePage ? '#brands' : '/#brands';
  const newsHref = isHomePage ? '#news' : '/#news';
  const numbersHref = isHomePage ? '#numbers' : '/#numbers';
  const aboutHref = isHomePage ? '#about' : '/about';
  const contactHref = isHomePage ? '#contact' : '/#contact';
  const wishlistLabel = t('nav.wishlist', { defaultValue: 'Wishlist' });

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((currentValue) => !currentValue);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={`site-header glass-panel ${className}`}>
      <div className="container nav">
        <Link to="/" className="brand header__brand">
          <img
            src="/karahoca-logo-1-Photoroom.webp"
            alt="KARAHOCA"
            className="brand__logo"
          />
        </Link>

        <nav className="menu header__menu" aria-label={t('nav.menu')}>
          <a href={brandsHref} className="nav-link">{t('nav.brands')}</a>
          <a href={newsHref} className="nav-link">{t('nav.news')}</a>
          <a href={numbersHref} className="nav-link">{t('numbers.title')}</a>
          <a href={aboutHref} className="nav-link">{t('nav.about')}</a>
        </nav>

        <div className="header__actions">
          <Link
            to="/wishlist"
            className="nav-link header-wishlist-btn"
            aria-label={wishlistLabel}
            title={wishlistLabel}
          >
            <svg
              className="header-wishlist-btn__icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill={wishCount > 0 ? '#ef4444' : 'none'}
              stroke={wishCount > 0 ? '#ef4444' : 'currentColor'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {wishCount > 0 && (
              <span className="header-wishlist-btn__badge">
                {wishCount > 99 ? '99+' : wishCount}
              </span>
            )}
          </Link>

          <div className="header__language">
            <LanguageSwitcher inline />
          </div>

          <a href={contactHref} className="btn btn--primary header__contact">
            {t('nav.contact')}
          </a>

          <button
            className={`hamburger glass-button ${isMobileMenuOpen ? 'is-open' : ''}`}
            aria-label={t('nav.menu')}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={toggleMobileMenu}
            type="button"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      <nav
        id="mobile-menu"
        className={`mobile-menu glass-panel ${isMobileMenuOpen ? 'is-open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <a href={brandsHref} className="nav-link" onClick={closeMobileMenu}>{t('nav.brands')}</a>
        <a href={newsHref} className="nav-link" onClick={closeMobileMenu}>{t('nav.news')}</a>
        <a href={numbersHref} className="nav-link" onClick={closeMobileMenu}>{t('numbers.title')}</a>
        <a href={aboutHref} className="nav-link" onClick={closeMobileMenu}>{t('nav.about')}</a>
        <Link to="/wishlist" className="nav-link mobile-menu__wishlist" onClick={closeMobileMenu}>
          <span>{wishlistLabel}</span>
          {wishCount > 0 && (
            <span className="mobile-menu__badge">
              {wishCount > 99 ? '99+' : wishCount}
            </span>
          )}
        </Link>
        <a href={contactHref} className="btn btn--primary header__contact-link" onClick={closeMobileMenu}>
          {t('nav.contact')}
        </a>
      </nav>
    </header>
  );
};

export default Header;
