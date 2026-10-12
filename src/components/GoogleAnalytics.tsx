import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { COOKIE_CONSENT_EVENT, getCookieConsent } from '../utils/cookieConsent';

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
        // send_page_view: false — page views are sent manually below, once
        // per navigation. With GA4's default (true) the config call sent one
        // AND the navigation effect sent another: every visit's first page
        // was counted twice.
        gtagOptions: { anonymize_ip: true, cookie_flags: 'SameSite=None;Secure', send_page_view: false },
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
  }, []);

  const sendPageView = () => {
    try {
      ReactGA.send({
        hitType: 'pageview',
        page: window.location.pathname + window.location.search,
        title: document.title,
      });
    } catch {
      // ignore — GA failures are non-critical
    }
  };

  // Listen for consent being granted in this session. The page the visitor
  // is on still needs its page view (the config call no longer sends one).
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== 'all') return;
      const wasInitialized = initializedRef.current;
      if (tryInit() && !wasInitialized) sendPageView();
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, handler);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handler);
  }, []);

  // Send page-view on each navigation (only when initialized)
  useEffect(() => {
    if (!initializedRef.current) return;
    sendPageView();
  }, [location]);

  return null;
};

export default GoogleAnalytics;
