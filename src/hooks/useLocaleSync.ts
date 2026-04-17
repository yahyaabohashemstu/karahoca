import { useEffect, startTransition } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode, supportedLanguageCodes } from '../utils/language';

/**
 * Reconcile the active i18n language to the `:lang` URL parameter.
 *
 * Post Phase-1 refactor, the URL is the single source of truth for language.
 * This hook runs inside `LocalizedShell` and fires whenever the validated
 * `:lang` segment changes — e.g. the user clicks the language switcher,
 * navigates between `/ar/...` and `/en/...`, or follows a deep link shared
 * by another user in a different language.
 *
 * Why `startTransition`:
 *   `i18n.changeLanguage()` fans out a re-render of every component using
 *   `useTranslation()` — essentially the entire page. Marking the update
 *   as a transition keeps the current render on screen at high priority
 *   while the translated render is built at low priority, so the switch
 *   feels smooth instead of stuttering a frame on slow devices.
 *
 * Why this hook is idempotent:
 *   No-ops when the URL lang is unsupported (an outer redirect handles that)
 *   and when i18n is already on the target language (avoids a re-render).
 */
export const useLocaleSync = () => {
  const { i18n } = useTranslation();
  const { lang: rawLang } = useParams<{ lang?: string }>();

  useEffect(() => {
    if (!rawLang) return;
    if (!(supportedLanguageCodes as readonly string[]).includes(rawLang.toLowerCase())) {
      return;
    }

    const desired = normalizeLanguageCode(rawLang);
    const current = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
    if (current === desired) return;

    startTransition(() => {
      void i18n.changeLanguage(desired);
    });
  }, [rawLang, i18n]);
};
