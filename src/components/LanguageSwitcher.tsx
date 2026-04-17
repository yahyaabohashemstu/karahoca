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
  flag: string;
}

interface LanguageSwitcherProps {
  inline?: boolean;
}

const languages: Language[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

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
          {currentLanguage.flag}
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
                {language.flag}
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
