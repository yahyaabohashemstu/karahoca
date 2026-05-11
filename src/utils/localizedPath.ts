import {
  normalizeLanguageCode,
  supportedLanguageCodes,
  type SupportedLanguageCode,
} from './language';

/**
 * Language-prefix routing helpers.
 *
 * The app serves every logical page at `/<lang>/...` for SEO-correct multi-
 * language indexing. These pure functions convert between the user-facing
 * language-prefixed URL and the language-agnostic slug that the routing tree
 * and content logic prefer to reason about.
 *
 * Everything here is intentionally framework-free so it can be called from
 * React render paths, router data loaders, the prerender script, server-side
 * meta injection, and tests without dragging in react-router.
 */

export const DEFAULT_LANG: SupportedLanguageCode = 'ar';

/**
 * Detect whether the first path segment is a supported language code and
 * split the pathname into `{ lang, rest }`.
 *
 * @example
 *   splitLocalePath('/en/diox')        → { lang: 'en', rest: '/diox',        hasPrefix: true  }
 *   splitLocalePath('/ar')             → { lang: 'ar', rest: '/',            hasPrefix: true  }
 *   splitLocalePath('/about')          → { lang: 'ar', rest: '/about',       hasPrefix: false }
 *   splitLocalePath('/xx/foo')         → { lang: 'ar', rest: '/xx/foo',      hasPrefix: false }
 *   splitLocalePath('/')               → { lang: 'ar', rest: '/',            hasPrefix: false }
 */
export const splitLocalePath = (pathname: string): {
  lang: SupportedLanguageCode;
  rest: string;
  hasPrefix: boolean;
} => {
  if (!pathname || typeof pathname !== 'string') {
    return { lang: DEFAULT_LANG, rest: '/', hasPrefix: false };
  }
  const match = pathname.match(/^\/([a-zA-Z]{2})(?:\/(.*))?$/);
  if (match && (supportedLanguageCodes as readonly string[]).includes(match[1].toLowerCase())) {
    const lang = match[1].toLowerCase() as SupportedLanguageCode;
    const remainder = match[2] ?? '';
    return { lang, rest: remainder ? `/${remainder}` : '/', hasPrefix: true };
  }
  return {
    lang: DEFAULT_LANG,
    rest: pathname.startsWith('/') ? pathname : `/${pathname}`,
    hasPrefix: false,
  };
};

/**
 * Produce `/<lang><path>`, stripping any pre-existing language prefix so the
 * helper is idempotent (calling it twice never produces `/ar/ar/...`).
 *
 * Passes through URLs that should never be prefixed:
 *   - fragment-only ("#section")
 *   - external ("https://...", "mailto:", "tel:")
 *   - empty / nullish input
 */
export const localizePath = (
  lang: string | null | undefined,
  path: string | null | undefined,
): string => {
  if (!path) return '/';
  if (
    path.startsWith('#') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:')
  ) {
    return path;
  }

  const safeLang = normalizeLanguageCode(lang);

  // Normalise input: ensure leading slash, strip any existing lang prefix.
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  const stripped = withSlash.replace(/^\/([a-zA-Z]{2})(?=\/|$)/, (full, code) =>
    (supportedLanguageCodes as readonly string[]).includes(code.toLowerCase()) ? '' : full,
  );
  const normalised = stripped === '' ? '/' : stripped;

  if (normalised === '/') return `/${safeLang}/`;
  return `/${safeLang}${normalised}`;
};

/** Produce the root path for a language, e.g. 'en' → '/en/'. */
export const languageRootPath = (lang: string | null | undefined): string =>
  `/${normalizeLanguageCode(lang)}/`;

/**
 * localStorage key reserved for *explicit* user-language choices made via
 * the LanguageSwitcher dropdown. Deliberately distinct from `i18nextLng`
 * (which i18next writes to automatically on htmlTag/navigator detection
 * and would shadow the visitor's true preference). With caching disabled
 * in `i18n.ts`, nothing else writes this key — so a value here is, by
 * construction, a deliberate user action.
 */
const USER_LANG_CHOICE_KEY = 'karahoca_lang_choice';

/**
 * Detect preferred language from the environment. Used by the root redirect
 * when the URL has no language prefix.
 *
 * Order (most authoritative first):
 *   1. Explicit user-choice key (`karahoca_lang_choice`) — set ONLY by the
 *      LanguageSwitcher when the visitor manually picks a language.
 *   2. `navigator.languages[]` — the operating-system / browser language
 *      preference list, ordered by user priority.
 *   3. DEFAULT_LANG fallback.
 *
 * Note on `i18nextLng`:
 *   We intentionally don't read i18next's own localStorage key here. With
 *   the historical `caches: ['localStorage']` config, i18next eagerly wrote
 *   'ar' on every page-load (because the prerendered HTML shell uses
 *   `<html lang="ar">` by default and htmlTag detection ran first). That
 *   stale write would otherwise pin every fresh visitor to Arabic
 *   regardless of their browser language. Reading from our own key
 *   sidesteps the pollution permanently.
 */
export const detectPreferredLang = (): SupportedLanguageCode => {
  if (typeof window === 'undefined') return DEFAULT_LANG;

  // 1. Explicit user choice via the switcher.
  try {
    const stored = window.localStorage.getItem(USER_LANG_CHOICE_KEY);
    if (stored) {
      const n = normalizeLanguageCode(stored);
      if ((supportedLanguageCodes as readonly string[]).includes(n)) return n;
    }
  } catch {
    // localStorage may throw in private-mode Safari / strict cookie policies.
  }

  // 2. Browser / OS language preferences in priority order.
  if (typeof navigator !== 'undefined') {
    const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
    for (const c of candidates) {
      const n = normalizeLanguageCode(c);
      if ((supportedLanguageCodes as readonly string[]).includes(n)) return n;
    }
  }

  // 3. Hard fallback when navigator gives only unsupported languages
  // (German, French, Japanese, etc.) — Arabic is the brand home locale
  // so it's the most reasonable last-resort default.
  return DEFAULT_LANG;
};

/**
 * Persist an explicit user-language choice. Called by the LanguageSwitcher
 * when the visitor picks a locale from the dropdown. Tolerates localStorage
 * being unavailable (private mode, third-party cookie blocks) — the next
 * visit just falls back to navigator detection in that case.
 */
export const rememberUserLangChoice = (lang: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const n = normalizeLanguageCode(lang);
    if (!(supportedLanguageCodes as readonly string[]).includes(n)) return;
    window.localStorage.setItem(USER_LANG_CHOICE_KEY, n);
  } catch {
    /* private-mode storage rejection — ignore */
  }
};
