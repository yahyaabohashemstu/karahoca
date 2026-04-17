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
      order: ['htmlTag', 'localStorage', 'navigator'],
      caches: ['localStorage'],
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
