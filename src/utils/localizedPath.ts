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
 * Extract the base language tag from a BCP-47-ish locale string WITHOUT
 * `normalizeLanguageCode`'s "fallback to 'ar' on anything unrecognised"
 * bias. Returns the lowercased base code (e.g. `'fr-FR'` → `'fr'`) when
 * the input parses, or `null` otherwise.
 *
 * Why a private helper instead of reusing `normalizeLanguageCode`:
 *   `normalizeLanguageCode` is used everywhere in the app as a *defensive*
 *   normaliser — it accepts any input and always returns a valid supported
 *   code, defaulting to 'ar' when nothing matches. That's the right shape
 *   for "I trust nothing, give me a guaranteed-supported code", but it
 *   sabotages language *detection*. In a detection loop the previous
 *   implementation would coerce 'fr-FR' → 'ar' and short-circuit the
 *   loop because 'ar' is in the supported set. The fix is to first
 *   extract the raw code with no bias, then check membership ourselves.
 */
const SUPPORTED: readonly string[] = supportedLanguageCodes;

const extractBaseLanguageTag = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const base = trimmed.toLowerCase().replace(/_/g, '-').split('-')[0];
  return base || null;
};

/**
 * Detect preferred language from the environment. Used by the root redirect
 * when the URL has no language prefix.
 *
 * Order (most authoritative first):
 *   1. Explicit user-choice key (`karahoca_lang_choice`) — set ONLY by the
 *      LanguageSwitcher when the visitor manually picks a language.
 *   2. `navigator.languages[]` — the operating-system / browser language
 *      preference list, ordered by user priority. We walk every entry,
 *      not just the first, so an `['fr-FR', 'en-US']` user lands on
 *      English instead of being forced to Arabic just because French
 *      isn't supported.
 *   3. DEFAULT_LANG fallback (Arabic) — reached only when NONE of the
 *      browser-preferred languages map to a supported locale.
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
    const base = extractBaseLanguageTag(stored);
    if (base && SUPPORTED.includes(base)) {
      return base as SupportedLanguageCode;
    }
  } catch {
    // localStorage may throw in private-mode Safari / strict cookie policies.
  }

  // 2. Browser / OS language preferences in priority order. The previous
  // implementation funneled each entry through `normalizeLanguageCode`,
  // which silently coerced unsupported locales to 'ar' — that 'ar' then
  // satisfied the supportedLanguageCodes.includes() check and returned
  // immediately, never giving the visitor's SECOND or THIRD preferred
  // language a chance. Now we extract the base tag with no bias and
  // explicitly check support; only a real match returns early.
  if (typeof navigator !== 'undefined') {
    const candidates: readonly string[] =
      Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : [];

    for (const candidate of candidates) {
      const base = extractBaseLanguageTag(candidate);
      if (base && SUPPORTED.includes(base)) {
        return base as SupportedLanguageCode;
      }
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
    // Same explicit base-tag extraction as `detectPreferredLang` so we
    // never accidentally persist a coerced-to-'ar' value for an unsupported
    // input. If the caller passes something we don't support we silently
    // drop the write — better than corrupting the user-choice slot.
    const base = extractBaseLanguageTag(lang);
    if (!base || !SUPPORTED.includes(base)) return;
    window.localStorage.setItem(USER_LANG_CHOICE_KEY, base);
  } catch {
    /* private-mode storage rejection — ignore */
  }
};
