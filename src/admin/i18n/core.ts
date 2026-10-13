import { createContext, useContext, useMemo } from 'react';

/**
 * Admin UI language — Arabic by default, English available.
 *
 * Kept apart from the public site's i18next instance on purpose: the site
 * language follows the URL prefix (/ar/, /en/…), which /admin doesn't
 * have, and switching one must not switch the other.
 *
 * Strings live next to the component that shows them:
 *
 *   const messages = defineMessages({
 *     en: { title: 'Products', saved: 'Saved {name}' },
 *     ar: { title: 'المنتجات', saved: 'تم حفظ {name}' },
 *   });
 *   const t = useT(messages);
 *   t('title'); t('saved', { name });
 *
 * `defineMessages` makes a key missing from either language a type error.
 * Counted text uses a plural object and `t.plural(key, count)`, which also
 * exposes the count as {n}:
 *   en: { items: { one: '{n} item', other: '{n} items' } }
 *   ar: { items: { zero: 'لا عناصر', one: 'عنصر واحد', two: 'عنصران',
 *                  few: '{n} عناصر', many: '{n} عنصرًا', other: '{n} عنصر' } }
 */

export type AdminLang = 'ar' | 'en';

export const ADMIN_LANG_STORAGE_KEY = 'karahoca-admin-lang';

export const readStoredAdminLang = (): AdminLang => {
  try {
    const stored = window.localStorage.getItem(ADMIN_LANG_STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    // Storage blocked: default below.
  }
  return 'ar';
};

export interface AdminLangContextValue {
  lang: AdminLang;
  dir: 'rtl' | 'ltr';
  setLang: (lang: AdminLang) => void;
}

export const AdminLangContext = createContext<AdminLangContextValue>({
  lang: 'ar',
  dir: 'rtl',
  setLang: () => {},
});

export const useAdminLang = () => useContext(AdminLangContext);

// ─── Messages ────────────────────────────────────────────────────────────────

type PluralForms = { other: string; zero?: string; one?: string; two?: string; few?: string; many?: string };
export type Message = string | PluralForms;
type MessageTable = Record<string, Message>;

/** Both languages, with the same keys (enforced by the types). */
export const defineMessages = <T extends MessageTable>(
  messages: { en: T; ar: { [K in keyof T]: Message } },
) => messages;

export type Vars = Record<string, string | number | null | undefined>;

const interpolate = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match)) : text;

const pluralRules: Record<AdminLang, Intl.PluralRules> = {
  ar: new Intl.PluralRules('ar'),
  en: new Intl.PluralRules('en'),
};

const pick = (message: Message, lang: AdminLang, count?: number): string => {
  if (typeof message === 'string') return message;
  if (count === undefined) return message.other;
  if (count === 0 && message.zero) return message.zero;
  const form = pluralRules[lang].select(count) as keyof PluralForms;
  return message[form] ?? message.other;
};

// Numbers in messages: Western digits with separators in both languages,
// matching the rest of the admin (fmtNumber).
const formatVars = (vars?: Vars): Vars | undefined => {
  if (!vars) return vars;
  const out: Vars = {};
  for (const [key, value] of Object.entries(vars)) {
    out[key] = typeof value === 'number' ? value.toLocaleString('en-US') : value;
  }
  return out;
};

export interface Translate<K> {
  (key: K, vars?: Vars): string;
  /** Plural-aware form for `count`, which is also available as {n}. */
  plural: (key: K, count: number, vars?: Vars) => string;
  lang: AdminLang;
}

export const useT = <T extends MessageTable>(messages: { en: T; ar: { [K in keyof T]: Message } }): Translate<keyof T> => {
  const { lang } = useAdminLang();
  return useMemo(() => {
    const table = messages[lang] as Record<keyof T, Message>;
    const t = ((key: keyof T, vars?: Vars) => interpolate(pick(table[key], lang), formatVars(vars))) as Translate<keyof T>;
    t.plural = (key, count, vars) => interpolate(pick(table[key], lang, count), formatVars({ n: count, ...vars }));
    t.lang = lang;
    return t;
  }, [messages, lang]);
};
