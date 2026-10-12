export const COOKIE_CONSENT_KEY = 'karahoca_cookie_consent';
export const COOKIE_CONSENT_EVENT = 'karahoca-cookie-consent';

export type ConsentValue = 'all' | 'essential';

export const getCookieConsent = (): ConsentValue | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === 'all' || value === 'essential' ? value : null;
  } catch {
    return null;
  }
};

export const setCookieConsent = (value: ConsentValue): void => {
  if (typeof window === 'undefined') {
    return;
  }

  // Blocked storage (SecurityError) must not stop the choice from taking
  // effect for this visit — it just won't be remembered.
  try { window.localStorage.setItem(COOKIE_CONSENT_KEY, value); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent<ConsentValue>(COOKIE_CONSENT_EVENT, { detail: value }));
};
