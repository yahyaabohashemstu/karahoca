import { useEffect, startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode, supportedLanguageCodes } from '../utils/language';
import { splitLocalePath } from '../utils/localizedPath';

/**
 * Reconcile the active i18n language to the URL path.
 *
 * The URL is the single source of truth for language. This hook runs inside
 * `LocalizedShell` and fires whenever the first path segment changes — e.g.
 * the user clicks the language switcher, navigates between `/ar/...` and
 * `/en/...`, or follows a deep link shared by another user in a different
 * language.
 *
 * Why read from `useLocation` and not `useParams`:
 *   After the Phase-2 route-specificity fix, the route tree enumerates
 *   the four supported languages as static prefixes (`<Route path="/ar">`,
 *   `<Route path="/en">`, …) instead of using a single `<Route path="/:lang">`
 *   param. Explicit static prefixes prevent `/admin/*` from accidentally
 *   matching `/:lang/news` (which React Router scored higher, producing a
 *   bogus `/ar/admin/news` redirect). With static prefixes there is no
 *   `:lang` param to read, so we split the URL pathname ourselves.
 *
 * Why `startTransition`:
 *   `i18n.changeLanguage()` fans out a re-render of every component using
 *   `useTranslation()` — essentially the entire page. Marking the update
 *   as a transition keeps the current render on screen at high priority
 *   while the translated render is built at low priority.
 */
export const useLocaleSync = () => {
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const { lang: rawLang, hasPrefix } = splitLocalePath(pathname);

  useEffect(() => {
    if (!hasPrefix) return;
    if (!(supportedLanguageCodes as readonly string[]).includes(rawLang)) return;

    const desired = normalizeLanguageCode(rawLang);
    const current = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
    if (current === desired) return;

    startTransition(() => {
      void i18n.changeLanguage(desired);
    });
  }, [hasPrefix, rawLang, i18n]);
};
