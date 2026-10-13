// The admin language for code outside React (date formatting, API error
// messages). AdminI18nProvider keeps it in step with its state.
import type { AdminLang } from './core';

let current: AdminLang = 'ar';

export const setCurrentAdminLang = (lang: AdminLang) => {
  current = lang;
};

export const getCurrentAdminLang = (): AdminLang => current;
