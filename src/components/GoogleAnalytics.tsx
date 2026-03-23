import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

interface GoogleAnalyticsProps {
  measurementId?: string;
}

const GoogleAnalytics: React.FC<GoogleAnalyticsProps> = ({ measurementId }) => {
  const location = useLocation();

  useEffect(() => {
    const gaId = measurementId || import.meta.env.VITE_GA_MEASUREMENT_ID;

    if (!gaId || gaId === 'G-XXXXXXXXXX') {
      return;
    }

    try {
      ReactGA.initialize(gaId, {
        gaOptions: {
          debug_mode: import.meta.env.DEV,
        },
        gtagOptions: {
          anonymize_ip: true,
          cookie_flags: 'SameSite=None;Secure',
        }
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to initialize Google Analytics:', error);
      }
    }
  }, [measurementId]);

  useEffect(() => {
    const gaId = measurementId || import.meta.env.VITE_GA_MEASUREMENT_ID;

    if (!gaId || gaId === 'G-XXXXXXXXXX') {
      return;
    }

    try {
      ReactGA.send({
        hitType: 'pageview',
        page: location.pathname + location.search,
        title: document.title
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to send pageview:', error);
      }
    }
  }, [location, measurementId]);

  return null;
};

export default GoogleAnalytics;
