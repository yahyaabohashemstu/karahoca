export const supportedLanguageCodes = ['ar', 'en', 'tr', 'ru'] as const;

export type SupportedLanguageCode = (typeof supportedLanguageCodes)[number];

export const normalizeLanguageCode = (
  value?: string | null
): SupportedLanguageCode => {
  if (!value) {
    return 'ar';
  }

  const normalizedValue = value.trim().toLowerCase().replace(/_/g, '-');
  const baseLanguage = normalizedValue.split('-')[0];

  if (supportedLanguageCodes.includes(baseLanguage as SupportedLanguageCode)) {
    return baseLanguage as SupportedLanguageCode;
  }

  return 'ar';
};

export const getLanguageDirection = (value?: string | null) =>
  normalizeLanguageCode(value) === 'ar' ? 'rtl' : 'ltr';
