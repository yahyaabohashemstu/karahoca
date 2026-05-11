import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../utils/analytics';
import { normalizeLanguageCode, supportedLanguageCodes } from '../utils/language';
import { splitLocalePath } from '../utils/localizedPath';
import './LanguageSwitcher.css';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  /** Unicode flag emoji — used when no `flagImage` is set. */
  flag: string;
  /**
   * Optional image path (under /public). When set, rendered as an <img>
   * instead of the emoji. Used for languages whose preferred flag is not
   * a country emoji — e.g. Arabic is represented by the Arab League flag
   * rather than any single national flag.
   */
  flagImage?: string;
}

interface LanguageSwitcherProps {
  inline?: boolean;
}

const languages: Language[] = [
  // Arabic uses the Arab League flag (22 member states) instead of any
  // single country, so visitors from Egypt, the Levant, the Maghreb,
  // the Gulf, etc. all see a neutral pan-Arab identifier.
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦', // emoji fallback if the SVG fails to load
    flagImage: '/flags/ar-arab-league.svg',
  },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

/**
 * Render either the SVG image (preferred when `flagImage` is set) or the
 * Unicode emoji. Falls back to the emoji on `<img>` error so a misconfigured
 * static asset never leaves the switcher visually empty.
 */
const FlagGlyph: React.FC<{ language: Language; size: number }> = ({ language, size }) => {
  const [imgFailed, setImgFailed] = useState(false);
  if (language.flagImage && !imgFailed) {
    return (
      <img
        src={language.flagImage}
        alt=""
        width={size}
        height={Math.round((size * 2) / 3)}
        style={{
          width: size,
          height: 'auto',
          objectFit: 'contain',
          borderRadius: 2,
          display: 'inline-block',
          verticalAlign: 'middle',
        }}
        onError={() => setImgFailed(true)}
        draggable={false}
      />
    );
  }
  return <>{language.flag}</>;
};

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ inline = false }) => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentLanguageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);

  const currentLanguage = languages.find(lang => lang.code === currentLanguageCode) || languages[0];

  const handleLanguageChange = (nextCode: string) => {
    setIsOpen(false);

    if (!(supportedLanguageCodes as readonly string[]).includes(nextCode)) return;
    if (nextCode === currentLanguageCode) return;

    // The URL is the source of truth for language. Navigate to the same
    // logical page under the new language prefix — react-router's param
    // change cascades through `useLocaleSync`, which calls `i18n.changeLanguage`
    // inside a `startTransition` so the tree re-renders smoothly.
    const { rest } = splitLocalePath(location.pathname);
    const targetPath = `/${nextCode}${rest === '/' ? '/' : rest}`;
    navigate(`${targetPath}${location.search}${location.hash}`);

    // Persist preference so the root redirect honours it on next visit.
    try {
      window.localStorage.setItem('i18nextLng', nextCode);
    } catch {
      // localStorage may be unavailable (Safari private / strict storage);
      // the next visit will fall back to navigator.language detection.
    }

    trackEvent('Language', 'Change', nextCode);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`language-switcher ${inline ? 'language-switcher--inline' : ''}`} ref={dropdownRef}>
      <button
        className="language-switcher__button glass-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('nav.changeLanguage')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="language-switcher__flag" aria-hidden="true">
          <FlagGlyph language={currentLanguage} size={20} />
        </span>
        <span className="language-switcher__code">
          {currentLanguage.code.toUpperCase()}
        </span>
        <svg
          className={`language-switcher__arrow ${isOpen ? 'language-switcher__arrow--open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="language-switcher__dropdown glass-panel">
          {languages.map((language) => (
            <button
              key={language.code}
              className={`language-switcher__option ${
                language.code === currentLanguageCode ? 'language-switcher__option--active' : ''
              }`}
              onClick={() => handleLanguageChange(language.code)}
              aria-label={`${t('nav.changeLanguage')} ${language.nativeName}`}
            >
              <span className="language-switcher__option-flag" aria-hidden="true">
                <FlagGlyph language={language} size={22} />
              </span>
              <span className="language-switcher__option-name">
                {language.nativeName}
              </span>
              {language.code === currentLanguageCode && (
                <svg
                  className="language-switcher__check"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13.5 4L6 11.5L2.5 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
