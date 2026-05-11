import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import {
  getLanguageDirection,
  normalizeLanguageCode,
  supportedLanguageCodes,
} from './utils/language';

import translationAR from './locales/ar/translation.json';
import translationEN from './locales/en/translation.json';
import translationTR from './locales/tr/translation.json';
import translationRU from './locales/ru/translation.json';

const resources = {
  ar: {
    translation: translationAR.translation
  },
  en: {
    translation: translationEN.translation
  },
  tr: {
    translation: translationTR.translation
  },
  ru: {
    translation: translationRU.translation
  }
};

const applyDocumentLanguage = (lng?: string | null) => {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedLanguage = normalizeLanguageCode(lng);
  const direction = getLanguageDirection(normalizedLanguage);

  document.documentElement.dir = direction;
  document.documentElement.lang = normalizedLanguage;
};

// Detection order is deliberate: `htmlTag` FIRST so the `<html lang="...">`
// value baked into the HTML shell (or a prerendered route) is authoritative
// for the very first render. This is required for hydration safety — the
// first client render MUST emit the same language the prerendered HTML
// used, or React logs a hydration mismatch.
//
// After mount, `useLocaleSync` reconciles to the user's stored preference
// (localStorage → navigator → fallback) by calling `i18n.changeLanguage()`,
// which triggers a second render — by then hydration is already complete.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    supportedLngs: [...supportedLanguageCodes],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    cleanCode: true,
    initImmediate: false, // ensure init resolves synchronously — no async chunk race before first render
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false
    },

    detection: {
      // Order: htmlTag FIRST so the very first render matches the value
      // baked into the prerendered HTML shell (required for hydration
      // safety — a mismatch logs a hydration warning AND swaps dir/RTL
      // mid-frame, which is visible flicker). After mount, `useLocaleSync`
      // takes over and reconciles to the URL prefix, which is the actual
      // source of truth for which locale the visitor is browsing.
      //
      // `caches: []` (empty) is INTENTIONAL — was previously
      // `['localStorage']`, which silently wrote 'ar' to `i18nextLng` on
      // every page load (because htmlTag detection returned 'ar' from the
      // default prerender shell). The redirect logic at `/` then read that
      // stale localStorage entry and routed every visitor to /ar/,
      // regardless of their browser language. With caching off, only the
      // LanguageSwitcher's explicit user-choice write (to a separate key,
      // see localizedPath.detectPreferredLang) is persistent.
      order: ['htmlTag', 'localStorage', 'navigator'],
      caches: [],
      lookupLocalStorage: 'i18nextLng'
    },

    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p']
    }
  })
  .then(() => {
    applyDocumentLanguage(i18n.resolvedLanguage || i18n.language);
  });

i18n.on('languageChanged', (lng) => {
  applyDocumentLanguage(lng);
});

export default i18n;
