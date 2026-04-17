import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode, supportedLanguageCodes } from '../utils/language';

const LOCALSTORAGE_KEY = 'i18nextLng';

/**
 * Reconcile the active i18n language to the user's stored preference AFTER
 * React hydration completes.
 *
 * Why this exists: i18n is intentionally initialized from `<html lang="...">`
 * first (see `src/i18n.ts`) so the first client render matches the server-
 * rendered / prerendered HTML — this is what prevents hydration mismatches.
 *
 * But the user's real preference lives in localStorage (or navigator). We
 * can only safely switch to it AFTER hydration, otherwise React would compare
 * "English text" to the prerendered "Arabic text" and scream.
 */
export const useLocaleSync = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let desired: string | null = null;

    try {
      desired = window.localStorage.getItem(LOCALSTORAGE_KEY);
    } catch {
      desired = null;
    }

    if (!desired && typeof navigator !== 'undefined') {
      desired = navigator.language || null;
    }

    const normalized = normalizeLanguageCode(desired);
    if (!supportedLanguageCodes.includes(normalized)) return;

    const current = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
    if (current !== normalized) {
      void i18n.changeLanguage(normalized);
    }
  }, [i18n]);
};
