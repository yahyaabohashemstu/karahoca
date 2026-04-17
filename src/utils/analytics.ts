import ReactGA from 'react-ga4';
import { getCookieConsent } from './cookieConsent';

/**
 * Core event emitter — respects cookie consent.
 * Events are silently dropped if the user hasn't accepted analytics cookies.
 */
export const trackEvent = (
  category: string,
  action: string,
  label?: string,
  value?: number
): void => {
  if (getCookieConsent() !== 'all') return;

  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!gaId || gaId === 'G-XXXXXXXXXX') return;

  try {
    ReactGA.event({ category, action, label, value });
  } catch {
    // GA errors are non-critical — fail silently in production
    if (import.meta.env.DEV) {
      console.warn(`[analytics] Failed to track: ${category} / ${action}`);
    }
  }
};

// ── Contact & Engagement ─────────────────────────────────────────────────────

/** WhatsApp button clicked (floating button or inline link) */
export const trackWhatsAppClick = (source: 'floating_button' | 'footer' | 'inline' = 'floating_button'): void => {
  trackEvent('Contact', 'WhatsApp Click', source);
};

/** AI chat widget opened */
export const trackChatOpen = (): void => {
  trackEvent('Engagement', 'Chat Open', 'AI Assistant');
};

/** AI chat widget closed */
export const trackChatClose = (): void => {
  trackEvent('Engagement', 'Chat Close', 'AI Assistant');
};

/** User sent a message in the AI chat */
export const trackChatMessage = (): void => {
  trackEvent('Engagement', 'Chat Message Sent', 'AI Assistant');
};

// ── Forms ────────────────────────────────────────────────────────────────────

/** Generic form submission */
export const trackFormSubmit = (formName: string, success: boolean): void => {
  trackEvent('Form', success ? 'Submit Success' : 'Submit Error', formName);
};

/** Newsletter subscription (more specific than trackFormSubmit) */
export const trackNewsletterSubscription = (language: string): void => {
  trackEvent('Newsletter', 'Subscribe', language);
};

// ── Downloads ────────────────────────────────────────────────────────────────

/** Product catalog PDF download triggered */
export const trackCatalogDownload = (language: string): void => {
  trackEvent('Download', 'Catalog PDF', language);
};

/** Generic file download */
export const trackDownload = (filename: string): void => {
  trackEvent('Download', 'File', filename);
};

// ── Products ─────────────────────────────────────────────────────────────────

export const trackProductView = (productName: string, brand: string): void => {
  trackEvent('Product', 'View', `${brand} — ${productName}`);
};

export const trackProductImageOpen = (productName: string): void => {
  trackEvent('Product', 'Image Open', productName);
};

// ── Navigation ───────────────────────────────────────────────────────────────

export const trackOutboundLink = (url: string, label?: string): void => {
  trackEvent('Outbound Link', 'Click', label || url);
};
