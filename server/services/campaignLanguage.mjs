/**
 * Which language each newsletter subscriber receives a campaign in.
 *
 * Subscribers store the site language they signed up from (ar/en/tr/ru,
 * or NULL for those who signed up before it was recorded). A campaign may
 * be written in any subset of the four languages; a language counts only
 * when it has BOTH a subject and a body.
 *
 * Mirrored for the editor's audience preview in
 * src/admin/utils/campaignLanguage.ts — keep the two in step.
 */

export const CAMPAIGN_LANGS = ['ar', 'en', 'tr', 'ru'];

// Closest language when a subscriber's own isn't written: English is the
// shared second language of the TR/RU audience, Arabic the site default.
const FALLBACK_CHAIN = {
  ar: ['ar', 'en', 'tr', 'ru'],
  en: ['en', 'ar', 'tr', 'ru'],
  tr: ['tr', 'en', 'ar', 'ru'],
  ru: ['ru', 'en', 'ar', 'tr'],
};

const hasText = (value) => !!String(value ?? '').trim();

/** 'ar' | 'en' | 'tr' | 'ru' | null — anything else is "unknown". */
export const normaliseSubscriberLang = (value) => {
  const lang = String(value ?? '').trim().toLowerCase().slice(0, 2);
  return CAMPAIGN_LANGS.includes(lang) ? lang : null;
};

/** Languages with both a subject and a body, in ar/en/tr/ru order. */
export const availableLanguages = (campaign) =>
  CAMPAIGN_LANGS.filter((l) => hasText(campaign?.[`subject_${l}`]) && hasText(campaign?.[`body_${l}`]));

/**
 * The language a subscriber gets, or null when the campaign has no
 * complete language at all. Unknown-language subscribers get the first
 * available language (Arabic when written — the site default).
 */
export const languageForSubscriber = (campaign, subscriberLang, available = availableLanguages(campaign)) => {
  if (!available.length) return null;
  const chain = FALLBACK_CHAIN[normaliseSubscriberLang(subscriberLang)] ?? available;
  return chain.find((l) => available.includes(l)) ?? available[0];
};

/** Languages started but not finished (a subject without a body or vice versa). */
export const incompleteLanguages = (campaign) =>
  CAMPAIGN_LANGS.filter((l) => hasText(campaign?.[`subject_${l}`]) !== hasText(campaign?.[`body_${l}`]));
