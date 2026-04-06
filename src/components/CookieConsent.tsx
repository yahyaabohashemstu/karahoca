import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const CONSENT_KEY = 'karahoca_cookie_consent';

export type ConsentValue = 'all' | 'essential';

export const getCookieConsent = (): ConsentValue | null => {
  try {
    const val = localStorage.getItem(CONSENT_KEY);
    if (val === 'all' || val === 'essential') return val as ConsentValue;
    return null;
  } catch {
    return null;
  }
};

const CookieConsent: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getCookieConsent() === null) {
      const timer = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = (type: ConsentValue) => {
    try {
      localStorage.setItem(CONSENT_KEY, type);
      window.dispatchEvent(new CustomEvent('karahoca-cookie-consent', { detail: type }));
    } catch {
      // localStorage may be unavailable (private mode)
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-modal="true" aria-label={t('cookie.title')}>
      <div className="cookie-banner__inner">
        <div className="cookie-banner__icon" aria-hidden="true">🍪</div>
        <div className="cookie-banner__text">
          <strong className="cookie-banner__title">{t('cookie.title')}</strong>
          <p className="cookie-banner__desc">{t('cookie.description')}</p>
        </div>
        <div className="cookie-banner__actions">
          <button
            className="cookie-banner__btn cookie-banner__btn--secondary"
            onClick={() => accept('essential')}
          >
            {t('cookie.essentialOnly')}
          </button>
          <button
            className="cookie-banner__btn cookie-banner__btn--primary"
            onClick={() => accept('all')}
          >
            {t('cookie.acceptAll')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
