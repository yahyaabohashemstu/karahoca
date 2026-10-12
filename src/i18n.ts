import i18n, { type BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  getLanguageDirection,
  normalizeLanguageCode,
  supportedLanguageCodes,
  type SupportedLanguageCode,
} from './utils/language';
import { splitLocalePath } from './utils/localizedPath';

// Each language is its own chunk: a visitor downloads only theirs (the four
// files together were ~190 KB of the main bundle). Switching language loads
// the new one before i18next switches — the UI stays in the old language for
// that moment instead of showing raw keys.
const loadTranslation: Record<SupportedLanguageCode, () => Promise<{ translation: Record<string, unknown> }>> = {
  ar: () => import('./locales/ar/translation.json'),
  en: () => import('./locales/en/translation.json'),
  tr: () => import('./locales/tr/translation.json'),
  ru: () => import('./locales/ru/translation.json'),
};

const lazyTranslations: BackendModule = {
  type: 'backend',
  init: () => {},
  read: (language, _namespace, callback) => {
    loadTranslation[normalizeLanguageCode(language)]()
      .then((module) => callback(null, module.translation))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), null));
  },
};

/**
 * The language of the first render. The URL's language prefix (/en/… → en)
 * is the source of truth, so the very first render is already in the page's
 * language — which is also what a prerendered page was rendered in, so
 * hydration sees the same text. Paths without a prefix (/, /admin, legacy
 * links about to be redirected) use <html lang> (the shell says "ar").
 *
 * After mount, `useLocaleSync` keeps i18n in step with the URL.
 */
const initialLanguage = (): SupportedLanguageCode => {
  if (typeof window === 'undefined') return 'ar';
  const { lang, hasPrefix } = splitLocalePath(window.location.pathname);
  return hasPrefix ? lang : normalizeLanguageCode(document.documentElement.lang);
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

/**
 * Resolves once the first language's translations are in. main.tsx waits
 * for it before rendering: a first render without them would show keys —
 * and on a prerendered page, fail to hydrate.
 */
export const i18nReady = i18n
  .use(lazyTranslations)
  .use(initReactI18next)
  .init({
    lng: initialLanguage(),
    // No fallback language: every key exists in all four files (enforced by
    // src/locales/locales.test.ts). A fallback would make i18next download
    // Arabic for every English, Turkish and Russian visitor too.
    fallbackLng: false,
    supportedLngs: [...supportedLanguageCodes],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    cleanCode: true,
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false
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
