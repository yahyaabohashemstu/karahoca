import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import { useWishlist } from '../hooks/useWishlist';
import { useLocalizedPath } from '../hooks/useLocalizedPath';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { lp } = useLocalizedPath();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { items } = useWishlist();
  const wishCount = items.length;

  // Home for the current language is `/<lang>/`. Compare normalised forms
  // so `/ar` and `/ar/` both count as "home" for anchor-link targeting.
  const homePath = lp('/');
  const isHomePage = useMemo(() => {
    const current = location.pathname.replace(/\/+$/, '');
    const home = homePath.replace(/\/+$/, '');
    return current === home;
  }, [location.pathname, homePath]);

  const hashLink = (hash: string) => (isHomePage ? hash : `${homePath}${hash}`);
  const brandsHref = hashLink('#brands');
  const newsHref = hashLink('#news');
  const numbersHref = hashLink('#numbers');
  const aboutHref = isHomePage ? '#about' : lp('/about');
  // Footer (`id="contact"`) is rendered on every page, so the contact link
  // is always a fragment scroll on the CURRENT page — no full reload, no
  // race with lazy-loaded home content. Previously we sent users to
  // `${homePath}#contact` from non-home pages, which triggered a full
  // navigation and the hash scroll missed because the home tree wasn't
  // mounted yet (user-visible symptom: page just "refreshed").
  const contactHref = '#contact';
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
        <Link to={lp('/')} className="brand header__brand">
          <img
            src="/karahoca-logo-1-Photoroom.webp"
            alt="KARAHOCA — قره خوجة — كاراهوكا"
            className="brand__logo"
            decoding="async"
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
            to={lp('/wishlist')}
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
        <Link to={lp('/wishlist')} className="nav-link mobile-menu__wishlist" onClick={closeMobileMenu}>
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
