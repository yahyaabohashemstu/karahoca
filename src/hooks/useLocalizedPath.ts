import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { normalizeLanguageCode, type SupportedLanguageCode } from '../utils/language';
import { localizePath } from '../utils/localizedPath';

/**
 * Returns `{ lang, lp }` where:
 *   - `lang` is the validated language code of the current route match
 *     (falls back to 'ar' when called outside a `/:lang/...` match, e.g.
 *     in the admin tree).
 *   - `lp(path)` converts a language-agnostic path like '/about' into the
 *     current language's URL ('/ar/about'). It's safe to pass paths that
 *     are already localised, external URLs, or fragment-only anchors —
 *     `localizePath` handles all those cases idempotently.
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
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang = normalizeLanguageCode(paramLang);
  const lp = useCallback((path: string) => localizePath(lang, path), [lang]);
  return { lang, lp };
};
