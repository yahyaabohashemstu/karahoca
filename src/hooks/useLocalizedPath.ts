import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { normalizeLanguageCode, type SupportedLanguageCode } from '../utils/language';
import { localizePath, splitLocalePath } from '../utils/localizedPath';

/**
 * Returns `{ lang, lp }` where:
 *   - `lang` is the current language derived from the URL path's first
 *     segment. Falls back to 'ar' when called outside a localised URL
 *     (e.g. inside the admin tree), matching the previous behaviour.
 *   - `lp(path)` converts a language-agnostic path like '/about' into the
 *     current language's URL ('/ar/about'). It's safe to pass paths that
 *     are already localised, external URLs, or fragment-only anchors —
 *     `localizePath` handles all those cases idempotently.
 *
 * Why `useLocation` instead of `useParams`:
 *   The route tree post-specificity-fix enumerates the supported languages
 *   as explicit static prefixes (`/ar`, `/en`, `/tr`, `/ru`) instead of a
 *   single `/:lang` param. There is no `:lang` param any more, so we read
 *   the pathname ourselves and let `splitLocalePath` validate + extract.
 *
 * This is the ONLY correct way to build internal links inside the localised
 * site tree: raw `<Link to="/about">` still works (it falls through to the
 * legacy-path redirect) but costs a double navigation and breaks canonicals
 * for deep links opened in a new tab.
 */
export const useLocalizedPath = (): {
  lang: SupportedLanguageCode;
  lp: (path: string) => string;
} => {
  const { pathname } = useLocation();
  const { lang: detected } = splitLocalePath(pathname);
  const lang = normalizeLanguageCode(detected);
  const lp = useCallback((path: string) => localizePath(lang, path), [lang]);
  return { lang, lp };
};
