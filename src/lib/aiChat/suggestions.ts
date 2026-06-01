import { normalizeLanguageCode } from '../../utils/language';

/**
 * Smart suggestion generator for the chat composer.
 *
 * Extracted from the former `src/data/aiKnowledge.ts`. Pure logic — no
 * network, no I/O. Given the last user message, last bot reply, and full
 * conversation history, returns 3–4 suggestion chips tuned to the detected
 * topic and filtered to hide topics the user has already covered.
 */

/** Topic detection across the whole conversation so we can suppress
 *  suggestions the user has already explored. */
const getDiscussedTopics = (
  conversationHistory: Array<{ role: string; content: string }>,
): Set<string> => {
  const discussedTopics = new Set<string>();
  const fullConversation = conversationHistory.map((m) => m.content.toLowerCase()).join(' ');
  const topicPatterns: Record<string, RegExp> = {
    company: /من نحن|من أنت|karahoca|شركة|company|about|hakkımızda|kim/,
    diox: /diox|ديوكس/,
    aylux: /aylux|آيلوكس|ايلوكس/,
    pricing: /سعر|أسعار|price|pricing|fiyat|exw|تكلفة|cost/,
    shipping: /شحن|توصيل|delivery|shipping|kargo|teslimat/,
    contact: /تواصل|اتصال|contact|whatsapp|واتساب|email|iletişim/,
    quality: /جودة|شهادة|certificate|quality|kalite|مصنع|factory|fabrika/,
    products: /منتج|منتجات|product|ürün|cleaning|تنظيف|temizlik/,
    news: /خبر|أخبار|اخبار|مستجد|إطلاق|معرض|عقد|اتفاق|news|announcement|launch|exhibition|contract|haber|duyuru|lansman|fuar|anlaşma|новост|анонс|запуск|выстав|контракт/,
    production: /إنتاج|تصنيع|عملية|production|manufacturing|process|üretim|süreç|производ|процесс/,
  };
  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(fullConversation)) discussedTopics.add(topic);
  }
  return discussedTopics;
};

/**
 * Starter chips shown the instant the chat panel opens on a fresh
 * conversation — BEFORE the visitor has typed anything. Their whole job
 * is to teach the visitor that Karo can surface real product cards: each
 * chip is phrased as a natural browse request that the server-side
 * `detectProductIntent` heuristic reliably recognises (brand keyword
 * DIOX / AYLUX, or a generic "products / catalogue" browse word), so a
 * single tap returns inline product cards instead of a wall of text.
 *
 * Ordering rationale: the two brand-scoped prompts come first because a
 * brand-filtered result set is the most visually satisfying first
 * experience (4 cards from one line), and the open-ended "all products"
 * prompt closes the row for the visitor who doesn't yet know the brands.
 *
 * Kept deliberately short (3 chips) so the row never wraps to a second
 * line on a 320 px mobile panel.
 */
const STARTER_SUGGESTIONS_BY_LANG: Record<'ar' | 'en' | 'tr' | 'ru', string[]> = {
  ar: ['اعرض منتجات DIOX', 'اعرض منتجات AYLUX', 'ما هي منتجاتكم؟'],
  en: ['Show me DIOX products', 'Show me AYLUX products', 'What products do you offer?'],
  tr: ['DIOX ürünlerini göster', 'AYLUX ürünlerini göster', 'Hangi ürünleriniz var?'],
  ru: ['Покажите товары DIOX', 'Покажите товары AYLUX', 'Какие у вас товары?'],
};

/**
 * Returns the localised starter chips for a fresh chat. Pure lookup with
 * an Arabic fallback so an unexpected locale still yields usable chips.
 */
export const getStarterSuggestions = (language: string = 'ar'): string[] => {
  const lang = normalizeLanguageCode(language) as keyof typeof STARTER_SUGGESTIONS_BY_LANG;
  return STARTER_SUGGESTIONS_BY_LANG[lang] ?? STARTER_SUGGESTIONS_BY_LANG.ar;
};

type SuggestionMap = Record<string, string[]>;

const SUGGESTIONS_BY_LANG: Record<'ar' | 'en' | 'tr' | 'ru', SuggestionMap> = {
  ar: {
    diox: ['منتجات AYLUX', 'الأسعار والشحن', 'طلب عرض سعر'],
    aylux: ['منتجات DIOX', 'مقارنة المنتجات', 'معلومات التواصل'],
    pricing: ['شروط الشحن EXW', 'الحد الأدنى للطلب', 'التواصل للعرض'],
    products: ['معلومات الأسعار', 'الشحن والتوصيل', 'المصنع والجودة'],
    contact: ['منتجاتنا', 'أسئلة عن الأسعار', 'معلومات الشركة'],
    company: ['منتجات DIOX', 'منتجات AYLUX', 'طرق التواصل'],
    quality: ['شهادات الجودة', 'المصنع', 'المنتجات'],
    news: ['آخر الأخبار', 'الإنتاج', 'وسائل التواصل'],
    production: ['الجودة والمصنع', 'هدفنا', 'آخر الأخبار'],
    default: ['من نحن؟', 'منتجاتنا', 'آخر الأخبار', 'التواصل معنا'],
  },
  en: {
    diox: ['AYLUX Products', 'Pricing & Shipping', 'Request Quote'],
    aylux: ['DIOX Products', 'Compare Products', 'Contact Info'],
    pricing: ['EXW Shipping Terms', 'Minimum Order', 'Contact for Quote'],
    products: ['Pricing Info', 'Shipping & Delivery', 'Factory & Quality'],
    contact: ['Our Products', 'Pricing Questions', 'Company Info'],
    company: ['DIOX Products', 'AYLUX Products', 'Contact Methods'],
    quality: ['Quality Certificates', 'Factory', 'Products'],
    news: ['Latest News', 'Production', 'Contact Methods'],
    production: ['Factory & Quality', 'Our Goal', 'Latest News'],
    default: ['About Us?', 'Our Products', 'Latest News', 'Contact Us'],
  },
  tr: {
    diox: ['AYLUX Ürünleri', 'Fiyat & Kargo', 'Teklif İste'],
    aylux: ['DIOX Ürünleri', 'Ürün Karşılaştır', 'İletişim Bilgileri'],
    pricing: ['EXW Kargo Şartları', 'Minimum Sipariş', 'Teklif İçin İletişim'],
    products: ['Fiyat Bilgisi', 'Kargo & Teslimat', 'Fabrika & Kalite'],
    contact: ['Ürünlerimiz', 'Fiyat Soruları', 'Şirket Bilgisi'],
    company: ['DIOX Ürünleri', 'AYLUX Ürünleri', 'İletişim Yöntemleri'],
    quality: ['Kalite Sertifikaları', 'Fabrika', 'Ürünler'],
    news: ['Son Haberler', 'Üretim', 'İletişim Yöntemleri'],
    production: ['Fabrika & Kalite', 'Hedefimiz', 'Son Haberler'],
    default: ['Hakkımızda?', 'Ürünlerimiz', 'Son Haberler', 'Bize Ulaşın'],
  },
  ru: {
    diox: ['Продукты AYLUX', 'Цены и доставка', 'Запросить предложение'],
    aylux: ['Продукты DIOX', 'Сравнить продукты', 'Контактная информация'],
    pricing: ['Условия доставки EXW', 'Минимальный заказ', 'Связаться для предложения'],
    products: ['Информация о ценах', 'Доставка', 'Завод и качество'],
    contact: ['Наши продукты', 'Вопросы о ценах', 'Информация о компании'],
    company: ['Продукты DIOX', 'Продукты AYLUX', 'Способы связи'],
    quality: ['Сертификаты качества', 'Завод', 'Продукты'],
    news: ['Последние новости', 'Производство', 'Способы связи'],
    production: ['Завод и качество', 'Наша цель', 'Последние новости'],
    default: ['О нас?', 'Наши продукты', 'Последние новости', 'Связаться с нами'],
  },
};

const SUGGESTION_TOPIC_MAP: Record<string, string[]> = {
  // ar
  'من نحن؟': ['company'], 'منتجاتنا': ['products'], 'منتجات DIOX': ['diox'], 'منتجات AYLUX': ['aylux'],
  'الأسعار': ['pricing'], 'التواصل معنا': ['contact'], 'معلومات الأسعار': ['pricing'],
  'الشحن والتوصيل': ['shipping'], 'المصنع والجودة': ['quality'], 'طلب عرض سعر': ['pricing'],
  'معلومات التواصل': ['contact'], 'أسئلة عن الأسعار': ['pricing'], 'معلومات الشركة': ['company'],
  'طرق التواصل': ['contact'], 'شهادات الجودة': ['quality'], 'المصنع': ['quality'],
  'المنتجات': ['products'], 'آخر الأخبار': ['news'], 'الإنتاج': ['production'],
  'الجودة والمصنع': ['quality', 'production'], 'هدفنا': ['company'],
  'مقارنة المنتجات': ['diox', 'aylux'], 'شروط الشحن EXW': ['shipping'],
  'الحد الأدنى للطلب': ['pricing'], 'التواصل للعرض': ['contact', 'pricing'],
  // en
  'About Us?': ['company'], 'Our Products': ['products'], 'DIOX Products': ['diox'],
  'AYLUX Products': ['aylux'], 'Pricing': ['pricing'], 'Contact Us': ['contact'],
  'Pricing Info': ['pricing'], 'Shipping & Delivery': ['shipping'], 'Factory & Quality': ['quality'],
  'Request Quote': ['pricing'], 'Contact Info': ['contact'], 'Pricing Questions': ['pricing'],
  'Company Info': ['company'], 'Contact Methods': ['contact'], 'Quality Certificates': ['quality'],
  Factory: ['quality'], Products: ['products'], 'Latest News': ['news'], Production: ['production'],
  'Our Goal': ['company'], 'Compare Products': ['diox', 'aylux'],
  'EXW Shipping Terms': ['shipping'], 'Minimum Order': ['pricing'],
  'Contact for Quote': ['contact', 'pricing'], 'Pricing & Shipping': ['pricing', 'shipping'],
  // tr
  'Hakkımızda?': ['company'], 'Ürünlerimiz': ['products'], 'DIOX Ürünleri': ['diox'],
  'AYLUX Ürünleri': ['aylux'], 'Fiyatlandırma': ['pricing'], 'Bize Ulaşın': ['contact'],
  'Fiyat Bilgisi': ['pricing'], 'Kargo & Teslimat': ['shipping'], 'Fabrika & Kalite': ['quality'],
  'Teklif İste': ['pricing'], 'İletişim Bilgileri': ['contact'], 'Fiyat Soruları': ['pricing'],
  'Şirket Bilgisi': ['company'], 'İletişim Yöntemleri': ['contact'],
  'Kalite Sertifikaları': ['quality'], Fabrika: ['quality'], 'Ürünler': ['products'],
  'Son Haberler': ['news'], 'Üretim': ['production'], 'Hedefimiz': ['company'],
  'Ürün Karşılaştır': ['diox', 'aylux'], 'EXW Kargo Şartları': ['shipping'],
  'Minimum Sipariş': ['pricing'], 'Teklif İçin İletişim': ['contact', 'pricing'],
  'Fiyat & Kargo': ['pricing', 'shipping'],
  // ru
  'О нас?': ['company'], 'Наши продукты': ['products'], 'Продукты DIOX': ['diox'],
  'Продукты AYLUX': ['aylux'], 'Цены': ['pricing'], 'Связаться с нами': ['contact'],
  'Информация о ценах': ['pricing'], 'Доставка': ['shipping'], 'Завод и качество': ['quality'],
  'Запросить предложение': ['pricing'], 'Контактная информация': ['contact'],
  'Вопросы о ценах': ['pricing'], 'Информация о компании': ['company'],
  'Способы связи': ['contact'], 'Сертификаты качества': ['quality'],
  'Завод': ['quality'], 'Продукты': ['products'], 'Последние новости': ['news'],
  'Производство': ['production'], 'Наша цель': ['company'],
  'Сравнить продукты': ['diox', 'aylux'], 'Условия доставки EXW': ['shipping'],
  'Минимальный заказ': ['pricing'], 'Связаться для предложения': ['contact', 'pricing'],
  'Цены и доставка': ['pricing', 'shipping'],
};

/** Normalize Arabic diacritics / punctuation for substring matching. */
const normalizeForMatch = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[()[\]{}.,/#!$%^&*;:{}=_`~?"'|\\+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const generateSmartSuggestions = (
  lastUserMessage: string,
  lastBotResponse: string,
  conversationHistory: Array<{ role: string; content: string }>,
  language: string = 'ar',
): string[] => {
  const lowerMessage = normalizeForMatch(lastUserMessage);
  const lowerResponse = lastBotResponse.toLowerCase();
  const discussedTopics = getDiscussedTopics(conversationHistory);

  const lang = normalizeLanguageCode(language) as keyof typeof SUGGESTIONS_BY_LANG;
  const langSuggestions = SUGGESTIONS_BY_LANG[lang];

  // Topic-specific branches — exact keyword matches take priority over the
  // default chips so a DIOX question leads straight to AYLUX / pricing suggestions.
  if (lowerMessage.includes('diox') || lowerMessage.includes('ديوكس')) return langSuggestions.diox;
  if (lowerMessage.includes('aylux') || lowerMessage.includes('آيلوكس') || lowerMessage.includes('ايلوكس')) return langSuggestions.aylux;
  if (
    lowerMessage.includes('price') || lowerMessage.includes('سعر') ||
    lowerMessage.includes('اسعار') || lowerMessage.includes('fiyat') ||
    lowerResponse.includes('exw')
  ) return langSuggestions.pricing;
  if (lowerMessage.includes('product') || lowerMessage.includes('منتج') || lowerMessage.includes('ürün')) return langSuggestions.products;
  if (
    lowerMessage.includes('contact') || lowerMessage.includes('تواصل') ||
    lowerMessage.includes('iletişim') || lowerMessage.includes('whatsapp') ||
    lowerMessage.includes('واتساب')
  ) return langSuggestions.contact;
  if (
    lowerMessage.includes('news') || lowerMessage.includes('خبر') ||
    lowerMessage.includes('اخبار') || lowerMessage.includes('haber') ||
    lowerMessage.includes('новост')
  ) return langSuggestions.news;
  if (
    lowerMessage.includes('production') || lowerMessage.includes('انتاج') ||
    lowerMessage.includes('تصنيع') || lowerMessage.includes('üretim') ||
    lowerMessage.includes('производ')
  ) return langSuggestions.production;
  if (
    lowerMessage.includes('company') || lowerMessage.includes('شركة') ||
    lowerMessage.includes('karahoca') || lowerMessage.includes('من أنت') ||
    lowerMessage.includes('who are')
  ) return langSuggestions.company;
  if (
    lowerMessage.includes('quality') || lowerMessage.includes('جودة') ||
    lowerMessage.includes('kalite') || lowerMessage.includes('شهادة') ||
    lowerMessage.includes('certificate')
  ) return langSuggestions.quality;

  // Default chips — filtered to hide topics the user has already covered.
  let finalSuggestions = langSuggestions.default;
  finalSuggestions = finalSuggestions.filter((suggestion) => {
    const relatedTopics = SUGGESTION_TOPIC_MAP[suggestion] || [];
    return !relatedTopics.some((topic) => discussedTopics.has(topic));
  });

  if (finalSuggestions.length === 0) {
    const uniqueSuggestions = [...new Set(Object.values(langSuggestions).flat())];
    return uniqueSuggestions
      .filter((suggestion) => {
        const relatedTopics = SUGGESTION_TOPIC_MAP[suggestion] || [];
        return !relatedTopics.some((topic) => discussedTopics.has(topic));
      })
      .slice(0, 4);
  }

  return finalSuggestions;
};
