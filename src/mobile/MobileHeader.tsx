import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { normalizeLanguageCode } from "../utils/language";

type Props = {
  onMenu: () => void;
};

const languages = [
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' }
];

export default function MobileHeader({ onMenu }: Props) {
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonPos, setButtonPos] = useState({ top: 0, left: 0, right: 0 });
  const currentLanguageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isArabic = currentLanguageCode === 'ar';
  
  const currentLang = languages.find(lang => lang.code === currentLanguageCode) || languages[0];
  
  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setLangOpen(false);
  };

  // حساب موقع الزر عند فتح القائمة
  useEffect(() => {
    if (langOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonPos({
        top: rect.bottom + 8, // 8px تحت الزر
        left: rect.left,
        right: window.innerWidth - rect.right
      });
    }
  }, [langOpen]);

  // إغلاق الـ dropdown عند السكرول
  useEffect(() => {
    if (langOpen) {
      const handleScroll = () => {
        setLangOpen(false);
      };
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [langOpen]);

  return (
    <header className="m-header site-header glass-panel" role="banner">
      <div className="container nav m-header__bar">
        {/* Hamburger Menu Button - على اليسار */}
        <button 
          className="hamburger glass-button" 
          aria-label={t('nav.menu')}
          aria-expanded={false}
          onClick={onMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        {/* Logo - في الوسط */}
        <Link to="/" className="brand m-brand">
          <img 
            src="/karahoca-logo-1-Photoroom.webp" 
            alt="KARAHOCA" 
            className="brand__logo"
            style={{ height: '64px', width: 'auto', objectFit: 'contain' }}
          />
        </Link>

        {/* Language Switcher - على اليمين */}
        <div className="m-lang-simple" style={{ position: 'relative', zIndex: 10 }}>
          <button
            ref={buttonRef}
            onClick={() => setLangOpen(!langOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50px',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{currentLang.flag}</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{currentLang.code.toUpperCase()}</span>
          </button>
        </div>
        
        {/* Dropdown Portal - خارج الـ header تماماً */}
        {langOpen && createPortal(
          <>
            {/* Backdrop لإغلاق الـ dropdown عند النقر خارجه */}
            <div 
              onClick={() => setLangOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 998,
                background: 'transparent'
              }}
            />
            
            {/* Dropdown - يظهر أسفل الزر خارج حدود الـ header */}
            <div style={{
              position: 'fixed',
              top: `${buttonPos.top}px`,
              left: 'auto',
              right: isArabic ? '16px' : `${Math.max(buttonPos.right, 16)}px`,
              minWidth: '160px',
              maxWidth: 'calc(100vw - 32px)',
              padding: '0.5rem',
              background: 'rgba(5, 10, 22, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',
              zIndex: 999,
              overflow: 'hidden'
            }}>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  style={{
                    display: 'flex',
                    flexDirection: isArabic ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: lang.code === currentLanguageCode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    border: 'none',
                    borderRadius: '12px',
                    color: lang.code === currentLanguageCode ? 'var(--primary)' : 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    textAlign: isArabic ? 'right' : 'left',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (lang.code !== currentLanguageCode) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (lang.code !== currentLanguageCode) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
      </div>
    </header>
  );
}
