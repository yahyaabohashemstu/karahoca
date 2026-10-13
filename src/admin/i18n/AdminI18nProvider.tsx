import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { setCurrentAdminLang } from './currentLang';
import {
  ADMIN_LANG_STORAGE_KEY,
  AdminLangContext,
  readStoredAdminLang,
  type AdminLang,
} from './core';

// Dates and API errors follow the admin language; set it before the first
// render so the first paint is already right.
if (typeof window !== 'undefined') setCurrentAdminLang(readStoredAdminLang());

export const AdminI18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AdminLang>(readStoredAdminLang);
  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';

  // The admin lives in the public site's document, whose <html> carries the
  // site's language, direction and title; take them over while mounted.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previous = { dir: html.dir, lang: html.lang, title: document.title };
    html.dir = dir;
    html.lang = lang;
    document.title = lang === 'ar' ? 'لوحة تحكم KARAHOCA' : 'KARAHOCA Admin';
    return () => {
      html.dir = previous.dir;
      html.lang = previous.lang;
      document.title = previous.title;
    };
  }, [lang, dir]);

  const setLang = useCallback((next: AdminLang) => {
    setCurrentAdminLang(next);
    setLangState(next);
    try {
      window.localStorage.setItem(ADMIN_LANG_STORAGE_KEY, next);
    } catch {
      // Not remembered for next time; still switches now.
    }
  }, []);

  const value = useMemo(() => ({ lang, dir, setLang }), [lang, dir, setLang]);
  return <AdminLangContext.Provider value={value}>{children}</AdminLangContext.Provider>;
};
