/**
 * "12 pieces" / "12 штук" / "4 штуки" / "4 قطع" / "12 adet" — a pack count
 * with the noun inflected for the number.
 *
 * The seed used to append one of two fixed words (`materials.pieces` /
 * `materials.pieces_plural`) chosen by hand per product, which produced
 * "12 piece" in English and "12 штука" / "4 штук" in Russian on the live
 * product cards. Russian needs three forms and English two; the choice
 * depends on the number, not on the product.
 */
const RU_FORMS = { one: 'штука', few: 'штуки', many: 'штук', other: 'штуки' };
const ruRules = new Intl.PluralRules('ru');
const enRules = new Intl.PluralRules('en');

export const pieceWord = (lang, n) => {
  switch (lang) {
    case 'en':
      return enRules.select(n) === 'one' ? 'piece' : 'pieces';
    case 'ru':
      return RU_FORMS[ruRules.select(n)] || 'штук';
    case 'tr':
      return 'adet';
    case 'ar':
    default: {
      // Arabic counted noun: plural (قطع) for 3–10, singular accusative
      // (قطعة) from 11 up — "4 قطع", "12 قطعة".
      const r = n % 100;
      return r >= 3 && r <= 10 ? 'قطع' : 'قطعة';
    }
  }
};

export const pieceCountLabel = (lang, n) => `${n} ${pieceWord(lang, n)}`;

/**
 * If `text` is exactly a generated "<n> <piece word>" label in `lang`,
 * return the correctly inflected label; otherwise return null (custom
 * admin text such as "6 × 750 ML" is left alone).
 */
const WORDS = {
  en: /^(\d+)\s+(?:piece|pieces)$/i,
  ru: /^(\d+)\s+(?:штука|штуки|штук)$/i,
};
export const correctedPieceCount = (lang, text) => {
  const re = WORDS[lang];
  if (!re || typeof text !== 'string') return null;
  const m = text.trim().match(re);
  if (!m) return null;
  const fixed = pieceCountLabel(lang, Number(m[1]));
  return fixed === text ? null : fixed;
};
