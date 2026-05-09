import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeToggle } from '../hooks/useAnimations';

/**
 * Floating theme toggle button.
 *
 * Renders a sun in light mode and a full-disc moon (بدر) in dark mode.
 * The current mode is mirrored from `body.light-mode` so the toggle stays
 * in sync if the class is flipped from anywhere else (storage event,
 * system preference change, etc.) — the local state subscribes via a
 * MutationObserver scoped to the body's class attribute.
 */
const ThemeToggle: React.FC = () => {
  const { toggleTheme } = useThemeToggle();
  const { t } = useTranslation();

  const readMode = () =>
    typeof document !== 'undefined' &&
    document.body.classList.contains('light-mode');

  const [isLight, setIsLight] = useState<boolean>(readMode);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => setIsLight(readMode()));
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    // Re-sync immediately: `useThemeToggle()` (called above) registers its
    // own `useEffect` that toggles the `light-mode` class based on stored
    // preference. Both effects fire after render, but the theme-toggle
    // hook runs FIRST — by the time our observer is wired up the class
    // has already changed and the mutation event was missed. A direct
    // read here closes that one-frame gap so the icon picks the right
    // glyph from the very first paint after mount.
    setIsLight(readMode());
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle glass-button"
      onClick={toggleTheme}
      aria-label={t('themeToggle.label')}
      title={t('themeToggle.label')}
      aria-pressed={!isLight}
    >
      {isLight ? (
        // Light mode → sun (rays + small core)
        <svg
          className="theme-toggle__icon theme-toggle__icon--sun"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Dark mode → full moon (بدر) — solid disc with subtle craters
        <svg
          className="theme-toggle__icon theme-toggle__icon--moon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="9" r="1.4" fill="rgba(0,0,0,0.18)" />
          <circle cx="14.5" cy="13.5" r="1" fill="rgba(0,0,0,0.20)" />
          <circle cx="10" cy="14.5" r="0.7" fill="rgba(0,0,0,0.14)" />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
