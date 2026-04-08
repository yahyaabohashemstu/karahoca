import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { getCookieConsent } from './CookieConsent';

const GoogleAnalytics: React.FC = () => {
  const location = useLocation();
  const initializedRef = useRef(false);

  const tryInit = (): boolean => {
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!gaId || gaId === 'G-XXXXXXXXXX') return false;
    if (getCookieConsent() !== 'all') return false;
    if (initializedRef.current) return true;
    try {
      ReactGA.initialize(gaId, {
        gaOptions: { debug_mode: import.meta.env.DEV },
        gtagOptions: { anonymize_ip: true, cookie_flags: 'SameSite=None;Secure' },
      });
      initializedRef.current = true;
      return true;
    } catch {
      return false;
    }
  };

  // Initialize on mount if consent was already given in a previous session
  useEffect(() => {
    tryInit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for consent being granted in this session
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'all') tryInit();
    };
    window.addEventListener('karahoca-cookie-consent', handler);
    return () => window.removeEventListener('karahoca-cookie-consent', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send page-view on each navigation (only when initialized)
  useEffect(() => {
    if (!initializedRef.current) return;
    try {
      ReactGA.send({
        hitType: 'pageview',
        page: location.pathname + location.search,
        title: document.title,
      });
    } catch {
      // ignore — GA failures are non-critical
    }
  }, [location]);

  return null;
};

export default GoogleAnalytics;
