import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  // Refs used to (a) close the menu on outside-click and (b) focus-trap
  // the Tab cycle inside the open menu — see effects below.
  const mobileMenuRef = useRef<HTMLElement | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);

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
  const blogHref = lp('/blog');
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

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((currentValue) => !currentValue);
  }, []);

  // ── Mobile menu accessibility (only active while the menu is open) ───
  //
  // We add THREE behaviours here that the old hamburger lacked:
  //
  //   1. Escape key  → close the menu and return focus to the hamburger
  //                    button. Matches the WAI-ARIA disclosure pattern
  //                    and is what a keyboard-only user expects.
  //   2. Outside click → close the menu. Without this, the user has to
  //                    track down the hamburger again on a phone where
  //                    the menu obscures most of the page.
  //   3. Tab cycling → Tab from the last menu item wraps back to the
  //                    first; Shift+Tab from the first wraps to the
  //                    last. This is a LIGHTWEIGHT focus trap — we
  //                    intentionally don't pull in a third-party focus
  //                    library because the menu has a fixed tabstop set
  //                    (4 nav links + Wishlist + Contact CTA) and the
  //                    DOM order is stable. Tabbing OUT of the menu via
  //                    the hamburger is also allowed; the hamburger
  //                    isn't part of the menu's tabstop list.
  //   4. Body scroll lock — prevents the page underneath from scrolling
  //                    while the menu is open (otherwise a stray finger
  //                    drag scrolls the page behind the panel).
  //
  // Everything is scoped behind `if (!isMobileMenuOpen) return` so the
  // listeners cost zero when the menu is closed.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const menuEl = mobileMenuRef.current;

    // Auto-focus the first focusable element so screen readers and
    // keyboard users land directly inside the menu, not on the body.
    const focusables = menuEl
      ? Array.from(
          menuEl.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null) // skip display:none entries
      : [];
    focusables[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileMenu();
        // Return focus to the trigger so screen readers / keyboard
        // users continue from the affordance they actuated.
        hamburgerRef.current?.focus();
        return;
      }
      if (event.key === 'Tab' && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // Typed as the union so the same handler can wire up to both
    // `mousedown` (desktop / pointer events) and `touchstart` (early
    // mobile-tap signal — fires before the synthetic click so the menu
    // dismisses on the very first touch instead of after a click delay).
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      // Click on the menu itself → keep open.
      if (menuEl?.contains(target)) return;
      // Click on the hamburger → let its onClick toggle handle the state.
      if (hamburgerRef.current?.contains(target)) return;
      // Anything else (page background, header brand area, etc.) → close.
      closeMobileMenu();
    };

    // Body scroll lock. Restoring the original value (rather than just
    // setting it to `''`) plays nice with other components (modal, cookie
    // banner) that might set their own value.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // EventListener accepts the broader `Event` type; cast our union-
    // typed handler to satisfy both overloads. Runtime behaviour is
    // identical — TypeScript just can't narrow across the two listeners.
    const outsideListener = handleOutsideClick as EventListener;
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', outsideListener);
    document.addEventListener('touchstart', outsideListener, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', outsideListener);
      document.removeEventListener('touchstart', outsideListener);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileMenuOpen, closeMobileMenu]);

  return (
    <header className={`site-header glass-panel ${className}`}>
      <div className="container nav">
        <Link to={lp('/')} className="brand header__brand">
          <img
            src="/karahoca-logo-1-Photoroom.webp"
            alt="KARAHOCA — قره خوجة"
            className="brand__logo"
            decoding="async"
          />
        </Link>

        <nav className="menu header__menu" aria-label={t('nav.menu')}>
          <a href={brandsHref} className="nav-link">{t('nav.brands')}</a>
          <Link to={blogHref} className="nav-link nav-link--blog">
            {t('nav.blog', { defaultValue: 'Blog' })}
          </Link>
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
            ref={hamburgerRef}
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
        ref={mobileMenuRef}
        id="mobile-menu"
        className={`mobile-menu glass-panel ${isMobileMenuOpen ? 'is-open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
        aria-label={t('nav.menu')}
        /* `inert` removes the menu from the tab order AND from screen-
           reader exposure while closed — stronger than `aria-hidden`
           alone, and Safari respects it natively now. The menu's CSS
           still shows it via max-height transition; `inert` short-
           circuits the keyboard path so a Tab from outside doesn't
           accidentally land inside a visually-collapsed menu. */
        // @ts-expect-error — React types may lag the standard `inert` boolean attr.
        inert={!isMobileMenuOpen ? '' : undefined}
      >
        <a href={brandsHref} className="nav-link" onClick={closeMobileMenu}>{t('nav.brands')}</a>
        <Link to={blogHref} className="nav-link nav-link--blog" onClick={closeMobileMenu}>
          {t('nav.blog', { defaultValue: 'Blog' })}
        </Link>
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
