// Publishing guards shared by the product, news and blog editors.
//
// Plain functions, not hooks, so the text follows the admin language via
// getCurrentAdminLang() (kept in step by AdminI18nProvider).
import { getCurrentAdminLang } from '../i18n/currentLang';

/**
 * Public pages are pre-rendered at build time. The SPA reads the API, so
 * visitors see an edit (or an unpublish / delete) at once; the HTML that
 * search engines, link previews and no-JS visitors read is rebuilt
 * automatically a few minutes after the last change (server
 * services/siteRebuild.mjs). Shown once, next to the status control.
 */
const PRERENDER_NOTES = {
  en: 'Visitors see changes right away. The copy search engines and link previews read is refreshed automatically a few minutes after your last change (status on the Dashboard).',
  ar: 'يرى الزوار التغييرات فورًا. أما نسخة محركات البحث ومعاينات الروابط فتُحدَّث تلقائيًا بعد دقائق من آخر تغيير (تظهر حالتها في لوحة التحكم).',
} as const;

/** English only; kept for callers not yet switched to prerenderNote(). */
export const PRERENDER_NOTE = PRERENDER_NOTES.en;

/** PRERENDER_NOTE in the current admin language. Call it while rendering. */
export const prerenderNote = (): string => PRERENDER_NOTES[getCurrentAdminLang()];

/**
 * "Scheduled" with a time that has already passed is released by the
 * scheduler straight away — the item goes public on save, which is easy to
 * miss when the date was set days ago and never moved. Returns false when
 * the admin cancels.
 */
export const confirmPastSchedule = (status: string | null | undefined, publishAt: string | null | undefined): boolean => {
  if (status !== 'scheduled' || !publishAt) return true;
  const at = Date.parse(publishAt);
  if (Number.isNaN(at) || at > Date.now()) return true;
  return window.confirm(
    getCurrentAdminLang() === 'ar'
      ? 'موعد النشر المجدول قد مضى، لذلك سيظهر للعموم فور حفظه.\n\nالحفظ على أي حال؟'
      : 'The scheduled time is already in the past, so this will go public as soon as it is saved.\n\nSave anyway?',
  );
};

// Callers pass the English noun; Arabic needs the word and its gender.
const NOUNS_AR: Record<string, { word: string; feminine: boolean }> = {
  article: { word: 'الخبر', feminine: false },
  post: { word: 'المقال', feminine: false },
  category: { word: 'الفئة', feminine: true },
  product: { word: 'المنتج', feminine: false },
};

// Keeps "…/slug" in reading order inside Arabic text.
const ltr = (text: string) => `\u2066${text}\u2069`;

/**
 * A live item's slug is its URL: changing it breaks every link already
 * shared or indexed. Returns false when the admin cancels.
 */
export const confirmSlugChange = (
  noun: string,
  wasLive: boolean,
  oldSlug: string | null | undefined,
  newSlug: string,
): boolean => {
  if (!wasLive || !oldSlug || oldSlug === newSlug) return true;
  if (getCurrentAdminLang() === 'ar') {
    const { word, feminine } = NOUNS_AR[noun] ?? { word: 'العنصر', feminine: false };
    return window.confirm(
      `${feminine ? 'هذه' : 'هذا'} ${word} ${feminine ? 'منشورة' : 'منشور'}. ستتوقف الروابط الحالية ${feminine ? 'إليها' : 'إليه'} (${ltr(`…/${oldSlug}`)}) عن العمل بعد تغيير الـ slug إلى «${newSlug ? ltr(newSlug) : 'يُولَّد تلقائيًا'}».\n\nالتغيير على أي حال؟`,
    );
  }
  return window.confirm(
    `This ${noun} is published. Existing links to it (…/${oldSlug}) will stop working once the slug changes to "${newSlug || '(auto-generated)'}".\n\nChange it anyway?`,
  );
};
