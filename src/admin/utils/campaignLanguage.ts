// Mirror of server/services/campaignLanguage.mjs for the editor's audience
// preview — keep the two in step. The server decides at send time; this
// only shows the admin what it will do.

export type CampaignLang = 'ar' | 'en' | 'tr' | 'ru';

export const CAMPAIGN_LANGS: CampaignLang[] = ['ar', 'en', 'tr', 'ru'];

const FALLBACK_CHAIN: Record<CampaignLang, CampaignLang[]> = {
  ar: ['ar', 'en', 'tr', 'ru'],
  en: ['en', 'ar', 'tr', 'ru'],
  tr: ['tr', 'en', 'ar', 'ru'],
  ru: ['ru', 'en', 'ar', 'tr'],
};

type CampaignTexts = Partial<Record<`subject_${CampaignLang}` | `body_${CampaignLang}`, string | null>>;

const hasText = (value: unknown) => typeof value === 'string' && value.trim() !== '';

export const normaliseSubscriberLang = (value: unknown): CampaignLang | null => {
  const lang = String(value ?? '').trim().toLowerCase().slice(0, 2);
  return (CAMPAIGN_LANGS as string[]).includes(lang) ? (lang as CampaignLang) : null;
};

/** Languages with both a subject and a body. */
export const availableLanguages = (campaign: CampaignTexts): CampaignLang[] =>
  CAMPAIGN_LANGS.filter((l) => hasText(campaign[`subject_${l}`]) && hasText(campaign[`body_${l}`]));

/** Started but not finished: a subject without a body or the reverse. */
export const incompleteLanguages = (campaign: CampaignTexts): CampaignLang[] =>
  CAMPAIGN_LANGS.filter((l) => hasText(campaign[`subject_${l}`]) !== hasText(campaign[`body_${l}`]));

export const languageForSubscriber = (
  campaign: CampaignTexts,
  subscriberLang: unknown,
  available: CampaignLang[] = availableLanguages(campaign),
): CampaignLang | null => {
  if (!available.length) return null;
  const own = normaliseSubscriberLang(subscriberLang);
  const chain = own ? FALLBACK_CHAIN[own] : available;
  return chain.find((l) => available.includes(l)) ?? available[0];
};
