import React from 'react';
import { AdminIcon, type IconName } from '../components/AdminIcons';
import { common } from '../i18n/common';
import { useT } from '../i18n/core';

type ContentLang = 'ar' | 'en' | 'tr' | 'ru';

export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: IconName;
  /** Small count or marker after the label. */
  badge?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Two looks, one behaviour:
 * - "underline": switches the sections of a page (Edit / Stats, Q&A / Questions).
 * - "segmented": picks a value inside a page (period, brand, status, content
 *   language), as a compact pill group.
 */
export const Tabs = <T extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  ariaLabel,
  size = 'md',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'underline' | 'segmented';
  ariaLabel?: string;
  size?: 'sm' | 'md';
}) => (
  <div
    className={['adm-tabset', `adm-tabset-${variant}`, size === 'sm' ? 'adm-tabset-sm' : ''].filter(Boolean).join(' ')}
    role="tablist"
    aria-label={ariaLabel}
  >
    {items.map((item) => {
      const selected = item.value === value;
      return (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={selected}
          disabled={item.disabled}
          className={['adm-tabset-item', selected ? 'is-active' : ''].filter(Boolean).join(' ')}
          onClick={() => onChange(item.value)}
        >
          {item.icon && <AdminIcon name={item.icon} size="sm" />}
          <span>{item.label}</span>
          {item.badge !== undefined && item.badge !== null && <span className="adm-tabset-badge">{item.badge}</span>}
        </button>
      );
    })}
  </div>
);

/**
 * Language code chip — "AR", "EN", "TR", "RU". Replaces flag emoji, which
 * Windows renders as the letters "SA", "GB"… anyway, and flags are
 * countries, not languages.
 */
export const LangTag: React.FC<{ lang: string; className?: string }> = ({ lang, className }) => (
  <span className={['adm-lang-tag', className ?? ''].filter(Boolean).join(' ')} lang="en" dir="ltr">
    {lang.toUpperCase()}
  </span>
);

/**
 * Label of a content-language tab, the same in every editor: the code chip
 * and the language's name in the admin's language ("AR العربية", "EN English").
 */
export const LangLabel: React.FC<{ lang: ContentLang }> = ({ lang }) => {
  const tc = useT(common);
  return <><LangTag lang={lang} /> {tc(`lang_${lang}`)}</>;
};
