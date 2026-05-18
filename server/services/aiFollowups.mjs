/**
 * Follow-up suggestion chips for the AI chat.
 *
 * After every Karo reply, the chat surfaces up to 3 chips below the
 * message: small, tappable phrases the visitor can use to keep the
 * conversation going without staring at a blank input box. This
 * dramatically reduces the drop-off rate at the end of a productive
 * exchange (the visitor learned something, doesn't know what to ask
 * next, closes the chat — we want to give them a path).
 *
 * Strategy: rule-based, server-side, zero LLM cost. We re-use the
 * same SPECIFIC_CATEGORY_KEYWORDS / GENERIC_BROWSE_KEYWORDS scan
 * Karo uses to detect product intent (Phase 10), then map the matched
 * category to a hand-curated set of follow-up phrases per language.
 * If the visitor's last question matched a brand only, we use the
 * brand follow-ups. If nothing matched (a greeting, a generic
 * "what can you do?"), we fall back to a tiny generic set that
 * always reads as a sensible "what next?" prompt.
 *
 * Why not LLM-driven: an extra round-trip costs latency, money, and
 * — most importantly — predictability. The rule-based set is curated
 * by us for commercial value (every chip is a real next-step the
 * sales team would WANT the visitor to take). A model-generated set
 * drifts toward generic small-talk and occasionally makes things up.
 *
 * If the rule scan returns NOTHING (a malformed prompt or an unknown
 * intent), the function returns an empty array — the chat just
 * doesn't render the chip strip for that turn. Defensive at every
 * level.
 */

// ── Category dictionaries (mirror aiChat.mjs intent scan) ─────────────────
// We deliberately DUPLICATE the keyword arrays here (rather than
// import from aiChat.mjs) because they serve different purposes:
//   - aiChat.mjs's lists feed the search-products scorer.
//   - Our lists drive UI copy and may want different granularity
//     over time (e.g. "softener" might be its own follow-up bucket
//     while staying as part of the "laundry" search category).
// Keeping them independent lets each evolve at its own pace.

const SPECIFIC_CATEGORY_KEYWORDS = [
  // Laundry — powder / liquid / softener
  ['laundry', /\b(laundry|detergent|washing|powder)\b/i, /غسيل|مسحوق|مطري|منعّم/u, /çamaşır|deterjan|toz/iu, /стирк|порошок|стиральн/iu],
  // Dishwashing
  ['dish', /\b(dish|dishes|kitchen)\b/i, /صحون|أطباق|جلي|مطبخ/u, /bulaşık|tabak|mutfak/iu, /посуд|кухн/iu],
  // Bathroom / toilet
  ['bathroom', /\b(bathroom|toilet)\b/i, /حمام|مرحاض/u, /banyo|tuvalet/iu, /ванн|туалет/iu],
  // Glass / surfaces
  ['glass', /\b(glass|window|surface|floor)\b/i, /زجاج|أرض|سطح/u, /cam|yüzey|zemin/iu, /стекл|поверхн|пол/iu],
  // Bleach / chlorine
  ['bleach', /\b(bleach|chlorine)\b/i, /كلور|مبيّض|مبيض/u, /çamaşır suyu|klor/iu, /отбелив|хлор/iu],
  // Soap / personal
  ['soap', /\b(soap|shampoo|hand)\b/i, /صابون|شامبو/u, /sabun|şampuan/iu, /мыло|шампунь/iu],
  // Air freshener
  ['freshener', /\b(freshener|air|fragrance|deodorizer)\b/i, /معطّر|معطر|عطر|هواء/u, /oda parfümü|hava/iu, /освежитель|воздух/iu],
  // Oven
  ['oven', /\b(oven)\b/i, /فرن|أفران/u, /fırın/iu, /духовк/iu],
  // Stain remover
  ['stain', /\b(stain|spot|remover)\b/i, /بقع|مزيل/u, /leke|çıkarıcı/iu, /пятн|выводит/iu],
  // Generic gel
  ['gel', /\b(gel)\b/i, /جل/u, /jel/iu, /гель/iu],
];

const BRAND_KEYWORDS = {
  DIOX: [/diox/i, /ديوكس/u, /диокс/iu],
  AYLUX: [/aylux|eylüks|eyluks/i, /أيلوكس|إيلوكس/u, /айлюкс|илюкс/iu],
};

// ── Follow-up libraries per (category, language) ────────────────────────────
// Each value is 3 phrases — the chat renders up to that many, no more.
// Curated for commercial intent: every chip steers toward a purchase or
// contact, not toward open-ended chit-chat.

const FOLLOWUPS = {
  laundry: {
    ar: ['ما الأحجام المتوفّرة؟', 'هل لديكم مسحوق أوتوماتيك؟', 'هل تشحنون لبلدي؟'],
    en: ['What sizes do you offer?', 'Do you have automatic powder?', 'Do you ship to my country?'],
    tr: ['Hangi boyutlar var?', 'Otomatik toz var mı?', 'Ülkeme gönderim var mı?'],
    ru: ['Какие размеры есть?', 'Есть автоматический порошок?', 'Доставляете в мою страну?'],
  },
  dish: {
    ar: ['هل لديكم جل صحون؟', 'ما الفرق بين السائل والجل؟', 'ما عدد العبوات في الكرتون؟'],
    en: ['Do you have dishwashing gel?', 'What is the difference between liquid and gel?', 'How many bottles per carton?'],
    tr: ['Bulaşık jeli var mı?', 'Sıvı ve jel arasındaki fark nedir?', 'Kolide kaç adet var?'],
    ru: ['Есть гель для посуды?', 'В чём разница между жидкостью и гелем?', 'Сколько в коробке?'],
  },
  bathroom: {
    ar: ['هل المنظّف آمن للسيراميك؟', 'ما الأحجام المتوفّرة؟', 'هل لديكم منظّف فلاش؟'],
    en: ['Is the cleaner safe for ceramic?', 'What sizes do you offer?', 'Do you have a flash cleaner?'],
    tr: ['Temizleyici seramik için güvenli mi?', 'Hangi boyutlar var?', 'Flash temizleyici var mı?'],
    ru: ['Безопасно ли для керамики?', 'Какие размеры есть?', 'Есть очиститель Flash?'],
  },
  glass: {
    ar: ['هل يترك آثاراً؟', 'هل يصلح للشاشات؟', 'ما حجم العبوة؟'],
    en: ['Does it leave streaks?', 'Is it safe for screens?', 'What is the bottle size?'],
    tr: ['İz bırakıyor mu?', 'Ekranlar için güvenli mi?', 'Şişe boyutu nedir?'],
    ru: ['Оставляет ли разводы?', 'Подходит ли для экранов?', 'Какой объём?'],
  },
  bleach: {
    ar: ['ما تركيز الكلور؟', 'ما الأحجام المتوفّرة؟', 'هل يصلح للملابس البيضاء؟'],
    en: ['What is the chlorine concentration?', 'What sizes do you offer?', 'Is it safe for whites?'],
    tr: ['Klor oranı nedir?', 'Hangi boyutlar var?', 'Beyazlar için uygun mu?'],
    ru: ['Какая концентрация хлора?', 'Какие размеры есть?', 'Подходит для белого?'],
  },
  soap: {
    ar: ['ما الروائح المتوفّرة؟', 'هل يصلح للبشرة الحسّاسة؟', 'ما حجم العبوة؟'],
    en: ['What scents are available?', 'Is it safe for sensitive skin?', 'What is the bottle size?'],
    tr: ['Hangi kokular var?', 'Hassas cilt için uygun mu?', 'Şişe boyutu nedir?'],
    ru: ['Какие ароматы есть?', 'Подходит для чувствительной кожи?', 'Какой объём?'],
  },
  freshener: {
    ar: ['ما الروائح المتوفّرة؟', 'كم تدوم الرّائحة؟', 'هل يصلح للسيّارة؟'],
    en: ['What scents are available?', 'How long does the scent last?', 'Is it suitable for cars?'],
    tr: ['Hangi kokular var?', 'Koku ne kadar kalıcı?', 'Araba için uygun mu?'],
    ru: ['Какие ароматы есть?', 'Сколько держится аромат?', 'Подходит для автомобиля?'],
  },
  oven: {
    ar: ['هل ينظّف الدهون المتراكمة؟', 'هل آمن للأسطح الستانلس؟', 'ما حجم العبوة؟'],
    en: ['Does it cut through baked grease?', 'Is it safe for stainless steel?', 'What is the bottle size?'],
    tr: ['Yanmış yağı çıkarır mı?', 'Paslanmaz çelik için güvenli mi?', 'Şişe boyutu nedir?'],
    ru: ['Удаляет ли пригоревший жир?', 'Безопасно для нержавейки?', 'Какой объём?'],
  },
  stain: {
    ar: ['هل يصلح للأقمشة الملوّنة؟', 'ما الأنواع المتوفّرة؟', 'كم العبوة في الكرتون؟'],
    en: ['Is it safe for coloured fabrics?', 'What variants are available?', 'How many per carton?'],
    tr: ['Renkli kumaşlar için güvenli mi?', 'Hangi çeşitler var?', 'Kolide kaç adet?'],
    ru: ['Безопасно для цветного?', 'Какие варианты есть?', 'Сколько в коробке?'],
  },
  gel: {
    ar: ['ما الأنواع المتوفّرة؟', 'ما الفرق عن السائل؟', 'ما الأحجام المتوفّرة؟'],
    en: ['What variants are available?', 'How does it differ from liquid?', 'What sizes do you offer?'],
    tr: ['Hangi çeşitler var?', 'Sıvıdan farkı nedir?', 'Hangi boyutlar var?'],
    ru: ['Какие варианты есть?', 'Чем отличается от жидкости?', 'Какие размеры есть?'],
  },
  // Brand-specific (used when only the brand was detected, no category)
  brand_DIOX: {
    ar: ['ما هي منتجات DIOX الأكثر طلباً؟', 'ما الفرق بين DIOX و AYLUX؟', 'هل تشحنون لبلدي؟'],
    en: ['What are the most popular DIOX products?', 'What is the difference between DIOX and AYLUX?', 'Do you ship to my country?'],
    tr: ['En çok satan DIOX ürünleri hangileri?', 'DIOX ile AYLUX arasındaki fark nedir?', 'Ülkeme gönderim var mı?'],
    ru: ['Какие товары DIOX самые популярные?', 'В чём разница между DIOX и AYLUX?', 'Доставляете в мою страну?'],
  },
  brand_AYLUX: {
    ar: ['ما هي منتجات AYLUX الأكثر طلباً؟', 'ما الفرق بين AYLUX و DIOX؟', 'هل تشحنون لبلدي؟'],
    en: ['What are the most popular AYLUX products?', 'What is the difference between AYLUX and DIOX?', 'Do you ship to my country?'],
    tr: ['En çok satan AYLUX ürünleri hangileri?', 'AYLUX ile DIOX arasındaki fark nedir?', 'Ülkeme gönderim var mı?'],
    ru: ['Какие товары AYLUX самые популярные?', 'В чём разница между AYLUX и DIOX?', 'Доставляете в мою страну?'],
  },
  // Generic — when nothing else matched (greetings, capability questions, etc.)
  generic: {
    ar: ['ما هي منتجاتكم الأكثر مبيعاً؟', 'هل تشحنون لبلدي؟', 'كيف أتواصل مع المبيعات؟'],
    en: ['What are your bestsellers?', 'Do you ship to my country?', 'How do I reach sales?'],
    tr: ['En çok satanlarınız hangileri?', 'Ülkeme gönderim var mı?', 'Satışla nasıl iletişime geçerim?'],
    ru: ['Какие у вас бестселлеры?', 'Доставляете в мою страну?', 'Как связаться с отделом продаж?'],
  },
};

const normaliseLang = (lang) => {
  const code = (lang || 'ar').toLowerCase();
  return ['ar', 'en', 'tr', 'ru'].includes(code) ? code : 'ar';
};

const detectCategory = (text) => {
  if (typeof text !== 'string' || !text.trim()) return null;
  // [name, en-regex, ar-regex, tr-regex, ru-regex]
  for (const [name, en, ar, tr, ru] of SPECIFIC_CATEGORY_KEYWORDS) {
    if (en.test(text) || ar.test(text) || tr.test(text) || ru.test(text)) {
      return name;
    }
  }
  return null;
};

const detectBrand = (text) => {
  if (typeof text !== 'string') return null;
  for (const [brand, patterns] of Object.entries(BRAND_KEYWORDS)) {
    if (patterns.some((p) => p.test(text))) return brand;
  }
  return null;
};

/**
 * Resolve the right 3-chip set for a finished turn. Inputs:
 *
 *   - `lastUserText` (string): the visitor's last question. We scan it
 *     first because the visitor's INTENT is the most reliable signal.
 *
 *   - `assistantReplyText` (string, optional): Karo's reply. Used as a
 *     fallback signal — if the visitor asked "what do you have?" but
 *     Karo's reply happened to talk about soap, the soap chip set is a
 *     better fit than the generic one.
 *
 *   - `lang` (string): the chat language for this turn.
 *
 * Returns an array of 0..3 strings. Empty when nothing was confidently
 * matched AND the generic set was deliberately skipped (we'd rather
 * show nothing than a chip strip that doesn't fit). For now, generic
 * is the default fallback — so this only returns empty on a hard
 * normalisation failure.
 */
export const generateFollowups = ({ lastUserText, assistantReplyText, lang }) => {
  const code = normaliseLang(lang);

  // 1. Category from the visitor's question (preferred).
  let category = detectCategory(lastUserText);

  // 2. Category from Karo's reply (fallback) — covers the "visitor
  //    asked broadly, Karo answered narrowly" pattern.
  if (!category && assistantReplyText) {
    category = detectCategory(assistantReplyText);
  }

  // 3. Brand-only path (e.g. "tell me about DIOX") — no category yet
  //    but we have a brand, so steer toward brand-level questions.
  if (!category) {
    const brand = detectBrand(lastUserText) || detectBrand(assistantReplyText || '');
    if (brand) {
      const key = `brand_${brand}`;
      return FOLLOWUPS[key]?.[code] || FOLLOWUPS.generic[code] || [];
    }
  }

  if (category && FOLLOWUPS[category]) {
    return FOLLOWUPS[category][code] || FOLLOWUPS.generic[code] || [];
  }

  return FOLLOWUPS.generic[code] || [];
};
