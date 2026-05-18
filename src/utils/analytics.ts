import ReactGA from 'react-ga4';
import { getCookieConsent } from './cookieConsent';
import { track } from './track';

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
//
// Every helper below fires TWO sinks:
//   1. Google Analytics (`trackEvent`) — for marketing dashboards.
//   2. The first-party event queue (`track` from utils/track) — for
//      the Karo conversation dashboard, the conversion funnel, A/B
//      attribution, and anything that needs to JOIN with our own DB.
// Both honour cookie consent independently so a visitor who accepted
// GA but disabled functional cookies (currently not possible in our
// UI but the contract should hold) still gets analytics ON THE PATH
// THE BANNER PROMISED.

/** WhatsApp button clicked (floating button or inline link) */
export const trackWhatsAppClick = (source: 'floating_button' | 'footer' | 'inline' = 'floating_button'): void => {
  trackEvent('Contact', 'WhatsApp Click', source);
  track({ event_type: 'whatsapp_click', payload: { source } });
};

/** AI chat widget opened */
export const trackChatOpen = (): void => {
  trackEvent('Engagement', 'Chat Open', 'AI Assistant');
  track({ event_type: 'chat_open' });
};

/** AI chat widget closed */
export const trackChatClose = (): void => {
  trackEvent('Engagement', 'Chat Close', 'AI Assistant');
  track({ event_type: 'chat_close' });
};

/** User sent a message in the AI chat */
export const trackChatMessage = (): void => {
  trackEvent('Engagement', 'Chat Message Sent', 'AI Assistant');
  track({ event_type: 'chat_message_sent' });
};

// ── Forms ────────────────────────────────────────────────────────────────────

/** Generic form submission */
export const trackFormSubmit = (formName: string, success: boolean): void => {
  trackEvent('Form', success ? 'Submit Success' : 'Submit Error', formName);
};

/** Newsletter subscription (more specific than trackFormSubmit) */
export const trackNewsletterSubscription = (language: string): void => {
  trackEvent('Newsletter', 'Subscribe', language);
  track({ event_type: 'newsletter_subscribe', payload: { language } });
};

// ── Downloads ────────────────────────────────────────────────────────────────
// `trackCatalogDownload` was removed alongside the orphan
// `CatalogDownloadButton` component — the only call site. The generic
// `trackDownload` stays because it may be reused by any future download
// surface (newsletter attachments, signed assets, etc.).

/** Generic file download */
export const trackDownload = (filename: string): void => {
  trackEvent('Download', 'File', filename);
};

// ── Products ─────────────────────────────────────────────────────────────────

export const trackProductView = (productName: string, brand: string, productId?: string): void => {
  trackEvent('Product', 'View', `${brand} — ${productName}`);
  track({
    event_type: 'product_view',
    product_id: productId,
    payload: { brand, product_name: productName },
  });
};

export const trackProductImageOpen = (productName: string): void => {
  trackEvent('Product', 'Image Open', productName);
  track({ event_type: 'product_modal_open', payload: { product_name: productName } });
};

// ── Navigation ───────────────────────────────────────────────────────────────

export const trackOutboundLink = (url: string, label?: string): void => {
  trackEvent('Outbound Link', 'Click', label || url);
};
