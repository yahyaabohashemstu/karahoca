/**
 * Returning-visitor recognition for the AI chat.
 *
 * On every chat open the client hits `GET /api/ai/welcome` with the
 * visitor id resolved by the upstream identity middleware. If the
 * visitor has prior conversation history, we:
 *
 *   1. Pull their last few user messages from `chat_messages`.
 *   2. Run the same intent scanner Karo uses for product cards
 *      (server/services/aiChat.mjs reuses the same vocabulary) to
 *      extract the topic of their MOST RECENT user turn.
 *   3. Compute how long it has been since they last visited.
 *   4. Return a localised welcome string that references the topic
 *      so the visitor feels remembered.
 *
 * Defensive throughout: every error path returns a plain "not
 * recognised" response. We never block or break the chat experience
 * over a recognition failure — the visitor just gets the standard
 * static welcome the SPA already provides.
 *
 * Privacy:
 *   - Only fires when the upstream middleware resolved a visitor id
 *     (which itself is gated by cookie consent === 'all' on the
 *     client side — essential-only visitors have a session-scoped
 *     id that can't link conversations across sessions).
 *   - No raw chat content is returned to the client — only the
 *     CATEGORY name (a generic word like "laundry") and a day
 *     count. This is intentional: even a casual screenshot of the
 *     welcome reveals nothing the visitor wouldn't have typed
 *     themselves.
 */
import { getDb } from './db.mjs';
import { logger } from '../utils/logger.mjs';

const SUPPORTED_LANGS = new Set(['ar', 'en', 'tr', 'ru']);
const pickLang = (lang) => {
  const code = (lang || 'ar').toLowerCase();
  return SUPPORTED_LANGS.has(code) ? code : 'ar';
};

// Mirror of aiFollowups.mjs SPECIFIC_CATEGORY_KEYWORDS but tuned for
// post-hoc detection from a single user message. Same 10 categories
// so the welcome topic vocabulary matches the chip vocabulary.
const CATEGORY_PATTERNS = [
  ['laundry', /\b(laundry|detergent|washing|powder)\b/i, /غسيل|مسحوق|مطري|منعّم/u, /çamaşır|deterjan|toz/iu, /стирк|порошок|стиральн/iu],
  ['dish', /\b(dish|dishes|kitchen)\b/i, /صحون|أطباق|جلي|مطبخ/u, /bulaşık|tabak|mutfak/iu, /посуд|кухн/iu],
  ['bathroom', /\b(bathroom|toilet)\b/i, /حمام|مرحاض/u, /banyo|tuvalet/iu, /ванн|туалет/iu],
  ['glass', /\b(glass|window|surface|floor)\b/i, /زجاج|أرض|سطح/u, /cam|yüzey|zemin/iu, /стекл|поверхн|пол/iu],
  ['bleach', /\b(bleach|chlorine)\b/i, /كلور|مبيّض|مبيض/u, /çamaşır suyu|klor/iu, /отбелив|хлор/iu],
  ['soap', /\b(soap|shampoo|hand)\b/i, /صابون|شامبو/u, /sabun|şampuan/iu, /мыло|шампунь/iu],
  ['freshener', /\b(freshener|air|fragrance|deodorizer)\b/i, /معطّر|معطر|عطر|هواء/u, /oda parfümü|hava/iu, /освежитель|воздух/iu],
  ['oven', /\b(oven)\b/i, /فرن|أفران/u, /fırın/iu, /духовк/iu],
  ['stain', /\b(stain|spot|remover)\b/i, /بقع|مزيل/u, /leke|çıkarıcı/iu, /пятн|выводит/iu],
  ['gel', /\b(gel)\b/i, /جل/u, /jel/iu, /гель/iu],
];

const detectCategory = (text) => {
  if (typeof text !== 'string' || !text.trim()) return null;
  for (const [name, en, ar, tr, ru] of CATEGORY_PATTERNS) {
    if (en.test(text) || ar.test(text) || tr.test(text) || ru.test(text)) return name;
  }
  return null;
};

// Friendly noun phrase for each category in each language. Used to
// fill the {topic} placeholder of the welcome template.
const TOPIC_NOUNS = {
  laundry: { ar: 'مسحوق الغسيل', en: 'laundry products', tr: 'çamaşır ürünleri', ru: 'товары для стирки' },
  dish: { ar: 'منظفات الصحون', en: 'dishwashing products', tr: 'bulaşık ürünleri', ru: 'средства для посуды' },
  bathroom: { ar: 'منظفات الحمام', en: 'bathroom cleaners', tr: 'banyo temizleyicileri', ru: 'средства для ванной' },
  glass: { ar: 'منظف الزجاج', en: 'glass cleaner', tr: 'cam temizleyicisi', ru: 'средство для стекла' },
  bleach: { ar: 'الكلور والمبيّض', en: 'bleach and chlorine', tr: 'çamaşır suyu', ru: 'отбеливатели' },
  soap: { ar: 'الصابون والشامبو', en: 'soap and shampoo', tr: 'sabun ve şampuan', ru: 'мыло и шампунь' },
  freshener: { ar: 'معطّرات الجوّ', en: 'air fresheners', tr: 'oda parfümleri', ru: 'освежители воздуха' },
  oven: { ar: 'منظف الأفران', en: 'oven cleaner', tr: 'fırın temizleyicisi', ru: 'средство для духовки' },
  stain: { ar: 'مزيل البقع', en: 'stain remover', tr: 'leke çıkarıcı', ru: 'пятновыводитель' },
  gel: { ar: 'الجل', en: 'gel products', tr: 'jel ürünleri', ru: 'гели' },
};

// Welcome templates per language with a {topic} placeholder.
const WELCOME_TEMPLATES = {
  ar: 'أهلاً مجدّداً! آخر مرّة سألتني عن {topic}. هل ما زلت تستكشف، أم لديك سؤال جديد؟',
  en: 'Welcome back! Last time you asked about {topic}. Still exploring, or a new question?',
  tr: 'Tekrar hoş geldiniz! Geçen sefer {topic} hakkında sormuştunuz. Hâlâ araştırıyor musunuz, yoksa yeni bir sorunuz mu var?',
  ru: 'С возвращением! В прошлый раз вы спрашивали про {topic}. Продолжаете изучать или новый вопрос?',
};

// Fallback when we recognise the visitor but couldn't pin the topic
// (a casual / off-product chat). No `{topic}` substitution — just a
// warm "welcome back".
const WELCOME_NO_TOPIC = {
  ar: 'أهلاً مجدّداً! كيف يمكنني مساعدتك اليوم؟',
  en: 'Welcome back! How can I help you today?',
  tr: 'Tekrar hoş geldiniz! Bugün size nasıl yardımcı olabilirim?',
  ru: 'С возвращением! Чем могу помочь сегодня?',
};

const buildWelcomeText = (lang, category) => {
  const code = pickLang(lang);
  if (!category) return WELCOME_NO_TOPIC[code];
  const topic = TOPIC_NOUNS[category]?.[code];
  if (!topic) return WELCOME_NO_TOPIC[code];
  return WELCOME_TEMPLATES[code].replace('{topic}', topic);
};

/**
 * Look up the visitor's most recent finished conversation and produce
 * a personalised welcome line. Returns `{ isReturning: false }` for
 * unknown visitors so the caller can fall back to the static welcome
 * the SPA bundles.
 */
export const buildReturningVisitorWelcome = ({ visitorId, lang }) => {
  if (typeof visitorId !== 'string' || visitorId.length < 8) {
    return { isReturning: false };
  }
  try {
    const db = getDb();
    const lastUserTurn = db
      .prepare(
        `SELECT content, created_at FROM chat_messages
           WHERE user_id = ? AND role = 'user'
           ORDER BY created_at DESC LIMIT 1`,
      )
      .get(visitorId);

    if (!lastUserTurn) return { isReturning: false };

    const category = detectCategory(lastUserTurn.content);
    const lastSeenMs = Date.parse(lastUserTurn.created_at);
    const daysAgo = Number.isFinite(lastSeenMs)
      ? Math.max(0, Math.floor((Date.now() - lastSeenMs) / (1000 * 60 * 60 * 24)))
      : null;

    // Same-session-second guard: if the "last" turn was less than a
    // minute ago, treat the visitor as still active rather than as
    // "returning". This stops a refresh during an active chat from
    // showing the "welcome back, last time you asked about..."
    // message that would feel jarring.
    if (daysAgo === 0) {
      const secondsAgo = (Date.now() - lastSeenMs) / 1000;
      if (secondsAgo < 60) return { isReturning: false };
    }

    return {
      isReturning: true,
      lastTopicCategory: category,
      lastSeenDaysAgo: daysAgo,
      welcomeText: buildWelcomeText(lang, category),
    };
  } catch (err) {
    logger.warn('[ai-welcome] lookup failed:', err.message || err);
    return { isReturning: false };
  }
};
