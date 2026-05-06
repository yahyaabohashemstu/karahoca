import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from '@phosphor-icons/react';
import { useThemeToggle } from '../hooks/useAnimations';

/**
 * Theme toggle — premium v3.
 *
 * v3 changes vs the original:
 *   - Replaced static sun-only icon (banned cliché per design audit) with
 *     a context-aware Sun/Moon swap that mirrors the *current* theme,
 *     not what it would switch to.
 *   - Crossfade transition between icons (no rotate-180 trick).
 *   - Reads `body.light-mode` class to determine current theme reactively.
 */
const ThemeToggle: React.FC = () => {
  const { toggleTheme } = useThemeToggle();
  const { t } = useTranslation();
  const [isLight, setIsLight] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.body.classList.contains('light-mode'),
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Watch the body class for theme changes triggered elsewhere.
    const observer = new MutationObserver(() => {
      setIsLight(document.body.classList.contains('light-mode'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle glass-button"
      onClick={toggleTheme}
      aria-label={t('themeToggle.label')}
      title={t('themeToggle.label')}
      aria-pressed={isLight}
    >
      <span className={`theme-toggle__icons${isLight ? ' is-light' : ' is-dark'}`}>
        <Moon size={20} weight="duotone" className="theme-toggle__icon theme-toggle__icon--moon" />
        <Sun  size={20} weight="duotone" className="theme-toggle__icon theme-toggle__icon--sun" />
      </span>
    </button>
  );
};

export default ThemeToggle;
