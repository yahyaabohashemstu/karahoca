import ReactGA from 'react-ga4';

export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
) => {
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (gaId && gaId !== 'G-XXXXXXXXXX') {
    try {
      ReactGA.event({
        category,
        action,
        label,
        value
      });

      if (import.meta.env.DEV) {
        console.log('📊 GA Event:', { category, action, label, value });
      }
    } catch (error) {
      console.error('❌ Failed to track event:', error);
    }
  }
};

export const trackOutboundLink = (url: string, label?: string) => {
  trackEvent('Outbound Link', 'Click', label || url);
};

export const trackDownload = (filename: string) => {
  trackEvent('Download', 'File', filename);
};

export const trackWhatsAppClick = () => {
  trackEvent('Contact', 'WhatsApp Click', 'Floating Button');
};

export const trackFormSubmit = (formName: string, success: boolean) => {
  trackEvent('Form', success ? 'Submit Success' : 'Submit Error', formName);
};

export const trackProductView = (productName: string, brand: string) => {
  trackEvent('Product', 'View', `${brand} - ${productName}`);
};

export const trackProductImageOpen = (productName: string) => {
  trackEvent('Product', 'Image Open', productName);
};
