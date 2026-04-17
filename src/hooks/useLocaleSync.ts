import { useEffect, startTransition } from 'react';
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
 *
 * Why `startTransition` around the switch:
 * The language change fans out a re-render of every component using
 * `useTranslation()` — in this app that's essentially the entire tree.
 * Without a transition, React marks those updates as urgent and the main
 * thread is blocked long enough to drop frames on the first paint after
 * hydration (the "Arabic flash → English flicker" you see on returning
 * users whose stored preference differs from the prerendered default).
 *
 * `startTransition` tells React the switch is non-urgent: keep the
 * current (Arabic) render on screen while scheduling the new (English)
 * one at low priority. The user sees a smooth transition instead of a
 * stutter. When combined with React.memo on heavy components
 * (BrandPageTemplate, FlipBook, AIChatWidget) the total re-render cost
 * of the language switch drops dramatically.
 */
export const useLocaleSync = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let desired: string | null = null;

    try {
      desired = window.localStorage.getItem(LOCALSTORAGE_KEY);
    } catch {
      // Safari private mode / strict storage policies — fall through to
      // navigator.language so we still honour the user's browser locale.
      desired = null;
    }

    if (!desired && typeof navigator !== 'undefined') {
      desired = navigator.language || null;
    }

    const normalized = normalizeLanguageCode(desired);
    if (!supportedLanguageCodes.includes(normalized)) return;

    const current = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
    if (current === normalized) return;

    // `i18n.changeLanguage` is async but returns a Promise we don't need to
    // await here — its INTERNAL state updates (the reason the whole tree
    // re-renders) fire synchronously inside the function call. Those state
    // updates are what `startTransition` captures and marks as non-urgent.
    startTransition(() => {
      void i18n.changeLanguage(normalized);
    });
  }, [i18n]);
};
