import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../utils/apiFetch';
import { trackChatOpen, trackChatClose } from '../utils/analytics';
import {
  getLanguageDirection,
  normalizeLanguageCode,
  type SupportedLanguageCode,
} from '../utils/language';
import {
  buildKnowledgeBase,
  generateSmartSuggestions,
  getAssistantWelcomeMessage,
  getCachedAiContext,
  loadAiContext,
} from '../lib/aiChat';

// ─── Types ────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

/**
 * Visible-hint identifier. The chat widget shows up to four contextual
 * teaser bubbles that rotate over time so a returning visitor doesn't keep
 * seeing the same nudge. Each value here maps to a row in `hints` and a
 * trigger condition in the hint-sequence effect.
 */
export type ChatHintKey = 'initial' | 'productSearch' | 'contactTeam' | 'stillHere';

export interface ChatUIStrings {
  title: string;
  subtitle: string;
  placeholder: string;
  sendButton: string;
  closeLabel: string;
  openToggleLabel: string;
  closeToggleLabel: string;
  inputLabel: string;
  /** Legacy single-string field — kept as an alias for hints.initial so any
   *  external consumer importing it still compiles. New code should read
   *  `hints[key]` instead. */
  welcomeHint: string;
  closeWelcomeHint: string;
  /** Online-presence pill rendered next to the floating toggle button. */
  onlineLabel: string;
  /** Localised hint text keyed by trigger condition. */
  hints: Record<ChatHintKey, string>;
  /** Exit-intent modal copy. Shown once per session when the visitor is
   *  about to leave (desktop: mouse to top edge; mobile: rapid scroll up
   *  from depth). */
  exitIntent: {
    title: string;
    body: string;
    accept: string;
    dismiss: string;
  };
  loadingLabel: string;
  connectionError: string;
  fallbackReply: string;
  noAnswerFallback: string;
  privacyNotice: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const CHAT_STORAGE_KEY = 'karahoca_ai_chat_messages';
const USER_ID_KEY = 'karahoca_user_id';
const MAX_STORED_MESSAGES = 100;
// Sticky flag: set to '1' the moment the visitor clicks the exit-intent
// popup's primary CTA. Survives reloads, tab close, and future visits — so
// once accepted, the popup never reappears in this browser. Cleared only
// by a manual localStorage purge.
const EXIT_INTENT_ACCEPTED_KEY = 'karahoca_ai_exit_intent_accepted';

// ─── Helpers (module-level — no React involvement) ────────────────────────

const getOrCreateUserId = (): string => {
  if (typeof window === 'undefined') return 'unknown';
  let id = window.localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `uid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
};

// ─── Persistent log queue ────────────────────────────────────────────────
//
// Every customer/assistant message MUST eventually land in the admin Chat
// History — even when sent during a connectivity blip, a CSRF-cookie race
// on first paint, a rate-limit 429, a 5xx, or while the user is navigating
// away mid-reply. The previous fire-and-forget log dropped ALL of these
// silently (only a dev-mode console.warn surfaced anything; production
// users never noticed and the operator's chat-history dashboard ran on
// incomplete data).
//
// New model: every send enqueues to localStorage, THEN tries to drain.
// Failures leave entries in the queue. Successes pop them. The queue is
// re-drained on:
//   • app boot               (covers in-flight messages lost to a refresh)
//   • visibilitychange       (covers backgrounded tabs that come back)
//   • `online` event         (covers offline → online transitions)
//   • each new send          (rolling drain — every interaction retries)
//
// 500-entry hard cap (~500 KB) bounds storage; the oldest entries are
// dropped silently if the queue grows past that. Two consecutive failures
// for the same head entry blacklist it (so a malformed payload can't
// permanently block the queue) — those go straight to console.warn in
// dev and Sentry in prod when DSN is set.

const LOG_QUEUE_KEY = 'karahoca_chat_log_queue';
const MAX_QUEUE_SIZE = 500;
const MAX_ATTEMPTS_PER_ENTRY = 6;
const LOG_TIMEOUT_MS = 15_000;

interface QueuedLogEntry {
  userId: string;
  sessionId: string;
  messages: ChatMessage[];
  language: string;
  attempts: number;
  queuedAt: number;
}

const readLogQueue = (): QueuedLogEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOG_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is QueuedLogEntry =>
        e && typeof e === 'object' &&
        typeof e.userId === 'string' &&
        typeof e.language === 'string' &&
        Array.isArray(e.messages) && e.messages.length > 0,
    );
  } catch {
    return [];
  }
};

const writeLogQueue = (entries: QueuedLogEntry[]): void => {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = entries.slice(-MAX_QUEUE_SIZE);
    window.localStorage.setItem(LOG_QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    /* private mode / quota — silently fail; in-memory only for this tab */
  }
};

const postChatLogOnce = async (entry: QueuedLogEntry): Promise<boolean> => {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), LOG_TIMEOUT_MS);
  try {
    const response = await apiFetch('/api/chat/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: entry.userId,
        sessionId: entry.sessionId,
        messages: entry.messages,
        language: entry.language,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(tid);
  }
};

// Drain coordinator. A single in-flight flush at a time so we don't pile
// up parallel POSTs that hammer the rate-limit. Calls to `flushLogQueue`
// while a flush is already running return immediately — the running flush
// will pick up any newly-enqueued entries naturally on its next loop pass.
let flushInFlight = false;
const flushLogQueue = async (): Promise<void> => {
  if (flushInFlight) return;
  flushInFlight = true;
  try {
    // Loop until the queue is empty or the head entry refuses to send.
    // We re-read the queue each iteration so concurrent enqueues during
    // a slow POST don't get lost on next-iteration writes.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queue = readLogQueue();
      if (queue.length === 0) return;
      const head = queue[0];
      const ok = await postChatLogOnce(head);
      const fresh = readLogQueue();
      if (ok) {
        // Drop the head from the FRESH queue (might differ from the one
        // we sampled at loop start if other entries were enqueued during
        // the POST). Find the exact entry by `queuedAt` so we don't
        // accidentally remove a sibling enqueued mid-flight.
        const idx = fresh.findIndex(e => e.queuedAt === head.queuedAt);
        const next = idx >= 0 ? [...fresh.slice(0, idx), ...fresh.slice(idx + 1)] : fresh;
        writeLogQueue(next);
        continue;
      }
      // Failure: increment attempts. Beyond MAX_ATTEMPTS_PER_ENTRY we
      // drop the entry to keep a malformed payload from blocking the
      // queue forever — dev console.warn captures the lost batch so a
      // developer can manually reconstruct if needed.
      const idx = fresh.findIndex(e => e.queuedAt === head.queuedAt);
      if (idx < 0) return; // Already dropped by another flusher.
      const updated = { ...head, attempts: head.attempts + 1 };
      if (updated.attempts >= MAX_ATTEMPTS_PER_ENTRY) {
        if (import.meta.env.DEV) {
          console.warn('[chat-log] giving up on entry after retries:', updated);
        }
        const next = [...fresh.slice(0, idx), ...fresh.slice(idx + 1)];
        writeLogQueue(next);
        return; // Stop — the next flush opportunity will resume.
      }
      const next = [...fresh.slice(0, idx), updated, ...fresh.slice(idx + 1)];
      writeLogQueue(next);
      return; // Wait for the next trigger (visibility / online / new send).
    }
  } finally {
    flushInFlight = false;
  }
};

/**
 * Enqueue a fresh batch of messages for the admin Chat History and kick
 * the drainer. Fire-and-forget at the call site — the helper itself
 * never throws. The actual POST is retried on every later flush
 * opportunity until it lands.
 */
const logChatToServer = (
  userId: string,
  sessionId: string,
  messages: ChatMessage[],
  language: string,
): void => {
  if (!messages.length) return;
  if (typeof window === 'undefined') return;
  const entry: QueuedLogEntry = {
    userId,
    sessionId,
    // Strip non-essentials so the queued JSON stays small. Server only
    // reads `role`, `content`, and (optionally) `timestamp`.
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
    language,
    attempts: 0,
    // Date.now() + a sub-millisecond suffix so two enqueues in the same
    // tick get distinct identifiers (used as the dedupe key when we
    // splice the head out after a successful POST).
    queuedAt: Date.now() + Math.random(),
  };
  const existing = readLogQueue();
  writeLogQueue([...existing, entry]);
  void flushLogQueue();
};

const getLocaleForLanguage = (lang: string) => {
  const localeMap = {
    ar: 'ar-EG',
    en: 'en-US',
    tr: 'tr-TR',
    ru: 'ru-RU',
  } as const;
  return localeMap[normalizeLanguageCode(lang)];
};

const formatTimestamp = (lang: string) =>
  new Date().toLocaleTimeString(getLocaleForLanguage(lang), {
    hour: '2-digit',
    minute: '2-digit',
  });

const sanitizeInput = (value: string) =>
  value.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);

// ─── Language detection (for the LLM prompt) ──────────────────────────────

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/u;
const CYRILLIC_SCRIPT_PATTERN = /[\u0400-\u04FF]/u;
const DEVANAGARI_SCRIPT_PATTERN = /[\u0900-\u097F]/u;
const GREEK_SCRIPT_PATTERN = /[\u0370-\u03FF]/u;
const HEBREW_SCRIPT_PATTERN = /[\u0590-\u05FF]/u;
const THAI_SCRIPT_PATTERN = /[\u0E00-\u0E7F]/u;
const HANGUL_SCRIPT_PATTERN = /[\uAC00-\uD7AF]/u;
const HIRAGANA_KATAKANA_PATTERN = /[\u3040-\u30FF]/u;
const HAN_SCRIPT_PATTERN = /[\u4E00-\u9FFF]/u;
// Turkish dictionary — covers common short words AND product-related vocab.
// Matches happen on word boundaries; the special-character class catches any
// truly-Turkish text (Latin letters with diacritics absent from English).
const TURKISH_LANGUAGE_PATTERN =
  /[çğıöşüÇĞİÖŞÜ]|\b(merhaba|selam|ben|sen|biz|siz|bu|şu|kim|kimsin|kimsiniz|kimsiniz|nasıl|nasil|niçin|nicin|nedir|ne|ne\s+demek|var|yok|evet|hayır|hayir|tamam|teşekkür|teşekkurler|tesekkur|tesekkurler|lütfen|lutfen|hoş\s*geldin|hoş\s*geldiniz|günaydın|gunaydin|merhabalar|iyi|kötü|kotu|güzel|guzel|ürün|ürünler|urun|urunler|fiyat|fiyatlar|fiyatlandırma|fiyatlandirma|haber|haberler|iletişim|iletisim|kargo|kargoya|üretim|uretim|hedef|hedefimiz|temizlik|şirket|sirket|nasıl|nasil|teslimat|fabrika|kalite|sertifika|sertifikalar|sipariş|siparis|ödeme|odeme|satın\s+al|satin\s+al|stoklu|stoksuz)\b/iu;
const GERMAN_LANGUAGE_PATTERN =
  /[äöüßÄÖÜ]|\b(hallo|danke|bitte|preis|preise|produkt|produkte|nachricht|neuigkeit|lieferung|unternehmen|kontakt|wie|was|und|über)\b/iu;
const ENGLISH_LANGUAGE_PATTERN =
  /\b(hello|hi|hey|what|how|why|when|where|who|price|prices|product|products|news|contact|company|about|shipping|delivery|factory|quality|quote|thanks|please|the|and|with|for|from|are|you|your|our|order|sample|samples)\b/iu;

const getLanguageLabel = (lang: SupportedLanguageCode) => {
  switch (lang) {
    case 'en': return 'English';
    case 'tr': return 'Turkish';
    case 'ru': return 'Russian';
    case 'ar':
    default:   return 'Arabic';
  }
};

/**
 * Pick the most likely supported language for the customer's message. The
 * order is critical: we check Arabic and Cyrillic FIRST (script-based, near
 * 100% precision), then Turkish (mixed script + keyword), then English
 * (keyword only). German is detected just to *exclude* it from the English
 * fallback so a German question doesn't get misclassified.
 *
 * Returns `null` when we genuinely can't tell — callers fall back to the UI
 * language. We deliberately do NOT treat "any Latin character = English",
 * because Turkish words like "kimsin", "selam", or "evet" share the Latin
 * alphabet and previously got routed to English suggestions / English-hint
 * prompts, which biased the AI away from Turkish replies.
 */
const detectSupportedQuestionLanguage = (question: string): SupportedLanguageCode | null => {
  if (ARABIC_SCRIPT_PATTERN.test(question)) return 'ar';
  if (CYRILLIC_SCRIPT_PATTERN.test(question)) return 'ru';
  if (TURKISH_LANGUAGE_PATTERN.test(question)) return 'tr';
  if (GERMAN_LANGUAGE_PATTERN.test(question)) return null;
  if (ENGLISH_LANGUAGE_PATTERN.test(question)) return 'en';
  return null;
};

const inferQuestionLanguageHint = (question: string) => {
  if (ARABIC_SCRIPT_PATTERN.test(question)) return 'Arabic';
  if (CYRILLIC_SCRIPT_PATTERN.test(question)) return 'Russian or another Cyrillic language';
  if (DEVANAGARI_SCRIPT_PATTERN.test(question)) return 'Hindi';
  if (GERMAN_LANGUAGE_PATTERN.test(question)) return 'German';
  if (TURKISH_LANGUAGE_PATTERN.test(question)) return 'Turkish';
  if (GREEK_SCRIPT_PATTERN.test(question)) return 'Greek';
  if (HEBREW_SCRIPT_PATTERN.test(question)) return 'Hebrew';
  if (THAI_SCRIPT_PATTERN.test(question)) return 'Thai';
  if (HANGUL_SCRIPT_PATTERN.test(question)) return 'Korean';
  if (HIRAGANA_KATAKANA_PATTERN.test(question)) return 'Japanese';
  if (HAN_SCRIPT_PATTERN.test(question)) return 'Chinese';
  if (ENGLISH_LANGUAGE_PATTERN.test(question)) return 'English';
  return 'the customer\u2019s exact language';
};

// ─── UI strings per language ──────────────────────────────────────────────

const getUIText = (lang: string): ChatUIStrings => {
  switch (normalizeLanguageCode(lang)) {
    case 'tr':
      return {
        title: 'Karo — KARAHOCA Asistanı',
        subtitle: 'Sorularınızı yanıtlamaya hazır',
        placeholder: "Karo'ya sorunuzu yazın…",
        sendButton: 'Gönder',
        closeLabel: 'Sohbet penceresini kapat',
        openToggleLabel: "Yapay zeka asistanı Karo'yu aç",
        closeToggleLabel: "Karo'yu kapat",
        inputLabel: "Karo'ya mesaj giriş alanı",
        welcomeHint: 'Bir sorunuz mu var?',
        closeWelcomeHint: 'Karşılama mesajını kapat',
        onlineLabel: 'Karo şu anda çevrimiçi',
        hints: {
          initial: 'Bir sorunuz mu var?',
          productSearch: 'Belirli bir ürün mü arıyorsunuz?',
          contactTeam: 'Ekibimizle şimdi iletişime geçin',
          stillHere: 'Aradığınızı buldunuz mu?',
        },
        exitIntent: {
          title: 'Gitmeden önce…',
          body: "Aradığınızı buldunuz mu? Karo ile sohbet edin — saniyeler içinde yanıt alın.",
          accept: 'Evet, sohbete başla',
          dismiss: 'Hayır, teşekkürler',
        },
        loadingLabel: 'Yükleniyor',
        connectionError: "Karo'ya bağlanırken bir hata oluştu.",
        fallbackReply:
          "Karo şu anda bağlanmakta zorlanıyor. Lütfen bize info@karahoca.com adresinden veya +905305914990 WhatsApp hattından ulaşın.",
        noAnswerFallback:
          'Mevcut bilgi tabanında net bir yanıt bulamadım. Bize info@karahoca.com e-posta adresinden veya +905305914990 WhatsApp hattından ulaşabilirsiniz.',
        privacyNotice: "Karo ile sohbetler hizmet kalitesini artırmak amacıyla kaydedilmektedir. Silme talebi: info@karahoca.com",
      };
    case 'ru':
      return {
        title: 'Каро — помощник KARAHOCA',
        subtitle: 'Готов ответить на ваши вопросы',
        placeholder: 'Задайте Каро вопрос…',
        sendButton: 'Отправить',
        closeLabel: 'Закрыть окно чата',
        openToggleLabel: 'Открыть помощника Каро',
        closeToggleLabel: 'Закрыть Каро',
        inputLabel: 'Поле ввода вопроса для Каро',
        welcomeHint: 'Есть вопрос?',
        closeWelcomeHint: 'Закрыть приветственное сообщение',
        onlineLabel: 'Каро сейчас онлайн',
        hints: {
          initial: 'Есть вопрос?',
          productSearch: 'Ищете определённый продукт?',
          contactTeam: 'Свяжитесь с нашей командой',
          stillHere: 'Нашли то, что искали?',
        },
        exitIntent: {
          title: 'Прежде чем уйти…',
          body: 'Нашли то, что искали? Поговорите с Каро — ответ за секунды.',
          accept: 'Да, начать чат',
          dismiss: 'Нет, спасибо',
        },
        loadingLabel: 'Загрузка',
        connectionError: 'Произошла ошибка при подключении к Каро.',
        fallbackReply:
          'Каро не может подключиться прямо сейчас. Пожалуйста, свяжитесь с нами по адресу info@karahoca.com или через WhatsApp +905305914990.',
        noAnswerFallback:
          'Я не нашёл точный ответ в текущей базе знаний. Вы можете связаться с нами по адресу info@karahoca.com или через WhatsApp +905305914990.',
        privacyNotice: 'Беседы с Каро записываются для улучшения сервиса. Запрос на удаление: info@karahoca.com',
      };
    case 'en':
      return {
        title: 'Karo — KARAHOCA Assistant',
        subtitle: 'Ready to answer your inquiries',
        placeholder: 'Ask Karo anything…',
        sendButton: 'Send',
        closeLabel: 'Close chat window',
        openToggleLabel: 'Open Karo, the AI assistant',
        closeToggleLabel: 'Close Karo',
        inputLabel: 'Message input for Karo',
        welcomeHint: 'Have a question?',
        closeWelcomeHint: 'Close welcome message',
        onlineLabel: 'Karo is online',
        hints: {
          initial: 'Have a question?',
          productSearch: 'Looking for a specific product?',
          contactTeam: 'Talk to our team now',
          stillHere: "Found what you're looking for?",
        },
        exitIntent: {
          title: 'Before you go…',
          body: "Found what you're looking for? Chat with Karo — replies in seconds.",
          accept: 'Yes, start chatting',
          dismiss: 'No, thanks',
        },
        loadingLabel: 'Loading',
        connectionError: 'There was an error while connecting to Karo.',
        fallbackReply:
          "Karo is having trouble connecting right now. Please contact us at info@karahoca.com or via WhatsApp at +905305914990.",
        noAnswerFallback:
          "I couldn't find a precise answer in my current knowledge base. You can contact us at info@karahoca.com or via WhatsApp at +905305914990.",
        privacyNotice: 'Conversations with Karo are recorded to improve our service. Deletion requests: info@karahoca.com',
      };
    case 'ar':
    default:
      return {
        title: 'كارو — مساعد KARAHOCA',
        subtitle: 'جاهز للإجابة على استفساراتكم',
        placeholder: 'اكتب سؤالك لكارو هنا...',
        sendButton: 'إرسال',
        closeLabel: 'إغلاق نافذة المحادثة',
        openToggleLabel: 'فتح المساعد كارو',
        closeToggleLabel: 'إغلاق المساعد كارو',
        inputLabel: 'حقل إدخال سؤال لكارو',
        welcomeHint: 'هل لديك سؤال؟',
        closeWelcomeHint: 'إغلاق الرسالة الترحيبية',
        onlineLabel: 'كارو متاح الآن',
        hints: {
          initial: 'هل لديك سؤال؟',
          productSearch: 'هل تبحث عن منتج معيّن؟',
          contactTeam: 'تواصل مع فريقنا الآن',
          stillHere: 'هل وجدت ما تبحث عنه؟',
        },
        exitIntent: {
          title: 'قبل أن تغادر…',
          body: 'هل وجدت ما تبحث عنه؟ تحدّث مع كارو مباشرة، يجاوبك خلال ثوان.',
          accept: 'نعم، أبدأ المحادثة',
          dismiss: 'لا، شكراً',
        },
        loadingLabel: 'جارِالتحميل',
        connectionError: 'حدث خطأ أثناء الاتصال بكارو.',
        fallbackReply:
          'كارو يواجه صعوبة في الاتصال الآن. يرجى مراسلتنا على البريد info@karahoca.com أو الواتساب +905305914990، وسنعمل على خدمتك فوراً.',
        noAnswerFallback:
          'لم أتمكن من العثور على إجابة دقيقة في قاعدة المعرفة الحالية. يسعدنا التواصل معكم عبر البريد info@karahoca.com أو الواتساب +905305914990.',
        privacyNotice: '🔒 محادثاتك مسجّلة لتحسين الخدمة. لطلب الحذف: info@karahoca.com',
      };
  }
};

// ─── Persistence helpers ──────────────────────────────────────────────────

const isStoredChatMessage = (value: unknown): value is ChatMessage =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ChatMessage).id === 'string' &&
      ((value as ChatMessage).role === 'user' || (value as ChatMessage).role === 'assistant') &&
      typeof (value as ChatMessage).content === 'string' &&
      typeof (value as ChatMessage).timestamp === 'string',
  );

const loadStoredMessages = (): ChatMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      return [];
    }
    return parsed.filter(isStoredChatMessage);
  } catch {
    try { window.localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* noop */ }
    return [];
  }
};

const persistMessagesLocally = (messages: ChatMessage[]) => {
  if (typeof window === 'undefined') return;
  if (messages.length === 0) {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    return;
  }
  try {
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      try { window.localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* noop */ }
    }
  }
};

/**
 * Returns true when this browser has previously engaged with the chat in a
 * way that should permanently suppress the exit-intent popup:
 *
 *   1. The visitor has at least one persisted chat message (i.e. they have
 *      already talked to Karo — now or in a past session). We deliberately
 *      use `loadStoredMessages()` (which already filters/validates) rather
 *      than a raw key check so a malformed payload from an older version
 *      doesn't accidentally count as "engaged".
 *   2. The visitor has previously clicked the popup's "Yes, start chatting"
 *      CTA, which writes EXIT_INTENT_ACCEPTED_KEY to localStorage.
 *
 * EITHER path qualifies — only one needs to be true. Wrapped in try/catch
 * so a browser with localStorage disabled (private mode, strict cookie
 * policy, quota exhaustion) falls through to "treat as a fresh visitor"
 * instead of crashing the hook on import.
 *
 * SSR-safe: returns `false` when `window` is undefined so Puppeteer-driven
 * prerender never tries to read storage and never silently disables the
 * popup in the static HTML.
 */
const hasUserPreviouslyEngagedWithChat = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(EXIT_INTENT_ACCEPTED_KEY) === '1') {
      return true;
    }
    if (loadStoredMessages().length > 0) {
      return true;
    }
  } catch {
    /* localStorage unavailable — behave as a fresh visitor. */
  }
  return false;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
};

// ─── Post-processing: phone numbers → WhatsApp links ──────────────────────

const withWhatsAppLinks = (content: string) => {
  const whatsappUrl = 'https://wa.me/905305914990';
  const phonePattern = /(\+?90\s?5\d{2}\s?\d{3}\s?\d{4}|\+?905\d{9}|\+?90 530 591 4990|\+905305914990)/g;
  const protectedPattern = /!\[[^\]]*?\]\([^)]+\)|\[[^\]]+?\]\([^)]+\)|https?:\/\/[^\s)]+/g;

  const replacePhones = (text: string) =>
    text.replace(phonePattern, (matched) => `[${matched}](${whatsappUrl})`);

  let lastIndex = 0;
  let out = '';
  for (const match of content.matchAll(protectedPattern)) {
    const matchIndex = match.index ?? 0;
    out += replacePhones(content.slice(lastIndex, matchIndex));
    out += match[0];
    lastIndex = matchIndex + match[0].length;
  }
  out += replacePhones(content.slice(lastIndex));
  return out;
};

// ─── Prompt construction ──────────────────────────────────────────────────

const mapKnowledgeToPrompt = (
  question: string,
  history: ChatMessage[],
  knowledgeSections: ReturnType<typeof buildKnowledgeBase>,
  websiteLanguage: SupportedLanguageCode,
  questionLanguageHint: string,
  toneGuidelines: string,
) => {
  const knowledgeSummary = knowledgeSections
    .map((section, index) => `${index + 1}. ${section.title}: ${section.content}`)
    .join('\n');
  const historySnippet = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `SYSTEM INSTRUCTIONS (HIGHEST PRIORITY):
You are Karo (Arabic: كارو, Russian: Каро) — the AI customer-service
assistant for KARAHOCA, the Turkish cleaning-products manufacturer
behind the DIOX and AYLUX brands. Always introduce yourself as Karo
when the customer asks who you are. Speak warmly and professionally,
like a knowledgeable sales-and-support representative.

CRITICAL LANGUAGE RULE:
1. Detect the language of the customer's question first
2. Respond in the exact same language
3. Do not mix languages in a single answer
4. The website interface language is currently ${getLanguageLabel(websiteLanguage)}, but you MUST ignore it when choosing your reply language
5. The customer appears to be writing in ${questionLanguageHint}
6. You are NOT limited to the website languages; if the question is in German, Hindi, or any other language, reply in that same language

Assistant Tone Guidelines:
${toneGuidelines}

Website Knowledge Rules:
- The knowledge base below is built from the actual KARAHOCA website content, including products, company pages, production, goals, dryer information, news, and contact details
- The sections are already ranked so the most relevant context for this question appears first
- If the customer asks about products, variants, sizes, materials, counts, or comparisons, answer from the website catalog first
- If the customer asks about company history, milestones, values, production, goals, dryer capability, news, newsletter, or contact details, answer from the matching site sections below
- Do not say information is unavailable if it already appears in the website knowledge below
- If the customer asks for broad comparisons or broad site summaries, provide the concrete facts already present in the knowledge base before asking a follow-up question
- Do not reply with a generic list of topics unless the customer explicitly asks what you can help with
- Answer like an experienced human sales and support representative for KARAHOCA

Knowledge Base (translate when needed):
${knowledgeSummary}

Recent Conversation History:
${historySnippet || 'No previous conversation.'}

Customer Question: ${question}

Respond using only the knowledge base above and match the customer's language exactly.`;
};

const createWelcomeMessage = (lang: string): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: getAssistantWelcomeMessage(lang),
  timestamp: formatTimestamp(lang),
});

// ─── The hook ─────────────────────────────────────────────────────────────

export interface UseChatStateResult {
  /** Resolved language code (ar/en/tr/ru) of the active UI. */
  currentLang: SupportedLanguageCode;
  /** UI direction derived from currentLang. */
  isRtl: boolean;
  /** Per-language UI strings. */
  uiText: ChatUIStrings;
  /** Panel open state. */
  isOpen: boolean;
  /**
   * Which contextual hint should be visible right now, or `null` to hide.
   * Rotates over time and on scroll-depth events; resets when the user
   * opens the chat (interactedRef latches forever afterwards).
   */
  currentHintKey: ChatHintKey | null;
  /** True iff `currentHintKey` is non-null. Convenience for legacy markup. */
  showWelcomeHint: boolean;
  /** Whether the exit-intent modal should be visible. */
  showExitIntent: boolean;
  /** Displayed message list (includes the synthetic 'welcome' entry). */
  messages: ChatMessage[];
  /** Current textarea draft. */
  inputValue: string;
  /** Whether a send is in flight. */
  isLoading: boolean;
  /** Transient status message (errors, retry hints). */
  statusMessage: string | null;
  /** Smart-suggestion chips for the current conversation state. */
  suggestions: string[];
  /** Imperatively open the panel. */
  openChat: () => void;
  /** Imperatively close the panel. */
  closeChat: () => void;
  /** Dismiss the currently-visible hint (it won't reappear this session). */
  dismissWelcomeHint: () => void;
  /** Accept the exit-intent prompt: closes the modal and opens the chat. */
  acceptExitIntent: () => void;
  /** Dismiss the exit-intent prompt: closes it permanently for the session. */
  dismissExitIntent: () => void;
  /** Replace the textarea draft. */
  setInputValue: (value: string) => void;
  /** Submit the current draft (or an override). */
  handleSend: (override?: string) => Promise<void>;
  /** Click a suggestion chip (sends its text as a message). */
  handleSuggestionClick: (suggestion: string) => void;
  /** Ref for the `<textarea>` — the hook focuses it on open / after send. */
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Ref for the scroll-anchor element at the bottom of the message list. */
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

interface UseChatStateOptions {
  initiallyOpen?: boolean;
}

export const useChatState = ({ initiallyOpen = false }: UseChatStateOptions = {}): UseChatStateResult => {
  const { i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isRtl = getLanguageDirection(currentLang) === 'rtl';
  const uiText = useMemo(() => getUIText(currentLang), [currentLang]);
  const fixedT = useMemo(() => i18n.getFixedT(currentLang), [i18n, currentLang]);

  // Hint sequencing — replaces the single-shot "welcome hint" with a four-
  // stage rotation: initial → productSearch → contactTeam (time-based) plus
  // a scroll-depth trigger for `stillHere`. Once the user interacts (opens
  // the panel), `interactedRef` latches and no further hints are shown.
  const interactedRef = useRef(false);
  const dismissedHintsRef = useRef<Set<ChatHintKey>>(new Set());
  const [currentHintKey, setCurrentHintKey] = useState<ChatHintKey | null>(null);
  // Exit-intent: shown at most once per session when the visitor signals
  // they're about to leave (desktop mouse to top edge / mobile rapid up-scroll).
  //
  // Pre-latch the "already shown" guard to TRUE for any visitor who has
  // chatted in a prior session or accepted the popup before — they have
  // already engaged with Karo and don't need a second invitation. Brand-new
  // visitors keep the initial `false`, leaving the detection effect below
  // free to flip the ref on real intent. The detection useEffect short-
  // circuits on `exitIntentShownRef.current` BEFORE attaching listeners,
  // so a `true` initial value means no mouseleave/scroll handlers ever
  // register for that visitor — zero overhead for the engaged-cohort path.
  const exitIntentShownRef = useRef(hasUserPreviouslyEngagedWithChat());
  const [showExitIntent, setShowExitIntent] = useState(false);
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadStoredMessages();
    return stored.length > 0 ? stored : [createWelcomeMessage(currentLang)];
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusIdRef = useRef(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const userIdRef = useRef<string>(getOrCreateUserId());
  const sessionIdRef = useRef<string>(`sess-${Date.now()}`);
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);
  const sendLockRef = useRef(false);

  // Preload the AI context (DB-backed base sections + tone guidelines) on
  // first mount so the first send has it already cached. Failure is a no-op
  // thanks to `loadAiContext`'s internal fallback.
  useEffect(() => {
    void loadAiContext();
  }, []);

  // ── Chat-log queue drainer ─────────────────────────────────────────────
  //
  // Hooks the persistent log queue into the document lifecycle so any
  // batches that failed their initial POST eventually catch up:
  //
  //   • Mount               → drain anything queued by a previous tab/session
  //                            (e.g. the user refreshed mid-conversation).
  //   • `online` event      → drain on connectivity recovery.
  //   • `visibilitychange`  → drain when the tab regains visibility (mobile
  //                            users who background the browser, return
  //                            later, expect their queued logs to land).
  //
  // The drainer is idempotent and serialises itself internally, so adding
  // multiple triggers can't double-fire.
  useEffect(() => {
    void flushLogQueue();
    const onOnline = () => { void flushLogQueue(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flushLogQueue();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Close the panel on Escape (only while open, so we don't swallow Escape
  // from sibling modals).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // ── Hint sequence ──────────────────────────────────────────────────────
  //
  // While the chat panel is closed AND the visitor hasn't interacted yet,
  // walk through four contextual nudges:
  //
  //   t =   3 s →  'initial'        ("Have a question?")
  //   t =  60 s →  'productSearch'  ("Looking for a specific product?")
  //   t = 120 s →  'contactTeam'    ("Talk to our team now")
  //   scroll ≥ 60 % → 'stillHere'   ("Found what you're looking for?")
  //
  // Each hint auto-hides after 8 s. The notification chime plays once on
  // the very first hint of the session (autoplay policy permitting); we
  // deliberately don't replay it on every rotation — that crossed the line
  // from "helpful nudge" into "annoying ping".
  useEffect(() => {
    if (isOpen || interactedRef.current) {
      setCurrentHintKey(null);
      return;
    }

    let autoHideTimer: number | null = null;
    let firstHintFired = false;
    const HINT_VISIBLE_MS = 8000;

    const playChime = () => {
      try {
        if (!notifAudioRef.current) {
          notifAudioRef.current = new Audio('/notification-sound.mp3');
          notifAudioRef.current.volume = 0.5;
        }
        notifAudioRef.current.currentTime = 0;
        notifAudioRef.current.play().catch(() => {});
      } catch { /* autoplay blocked */ }
    };

    const showHint = (key: ChatHintKey) => {
      if (interactedRef.current) return;
      if (dismissedHintsRef.current.has(key)) return;
      setCurrentHintKey(key);
      if (!firstHintFired) {
        playChime();
        firstHintFired = true;
      }
      if (autoHideTimer) window.clearTimeout(autoHideTimer);
      autoHideTimer = window.setTimeout(() => {
        setCurrentHintKey((prev) => (prev === key ? null : prev));
      }, HINT_VISIBLE_MS);
    };

    const timers: number[] = [];
    timers.push(window.setTimeout(() => showHint('initial'), 3_000));
    timers.push(window.setTimeout(() => showHint('productSearch'), 60_000));
    timers.push(window.setTimeout(() => showHint('contactTeam'), 120_000));

    // Scroll trigger — fires once when the page reaches the 60 % depth mark.
    let scrollFired = false;
    const onScroll = () => {
      if (scrollFired) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = window.scrollY / max;
      if (pct >= 0.6) {
        scrollFired = true;
        showHint('stillHere');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      for (const t of timers) window.clearTimeout(t);
      if (autoHideTimer) window.clearTimeout(autoHideTimer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isOpen]);

  // ── Exit-intent detection ──────────────────────────────────────────────
  //
  // Fires at most once per session. Desktop: pointer leaves the viewport
  // through the top edge — a strong "I'm about to close this tab" signal.
  // Mobile: a rapid upward fling from a deep-scroll position, which is the
  // closest equivalent (mouseleave doesn't exist for touch).
  useEffect(() => {
    if (isOpen || exitIntentShownRef.current || interactedRef.current) return;

    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

    const trigger = () => {
      if (exitIntentShownRef.current || interactedRef.current) return;
      exitIntentShownRef.current = true;
      setShowExitIntent(true);
      // Showing the exit-intent counts as "engaged enough" — stop the
      // hint rotation so we don't pile two nudges on top of each other.
      setCurrentHintKey(null);
    };

    if (!isTouch) {
      const onMouseLeave = (e: MouseEvent) => {
        // Only the top edge counts; leaving sideways or downward is
        // usually just window-switching, not intent to close.
        if (e.clientY <= 8) trigger();
      };
      document.documentElement.addEventListener('mouseleave', onMouseLeave);
      return () => document.documentElement.removeEventListener('mouseleave', onMouseLeave);
    }

    // Mobile: track scroll velocity. Trigger when the visitor is past
    // 40 % page depth and flicks up >= 300 px in <= 700 ms.
    let lastY = window.scrollY;
    let lastT = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const currentY = window.scrollY;
      const dy = lastY - currentY; // > 0 → scrolling up
      const dt = now - lastT;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? currentY / max : 0;
      if (pct > 0.4 && dy >= 300 && dt <= 700) trigger();
      lastY = currentY;
      lastT = now;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  // Persist messages to localStorage (excluding the synthetic welcome entry).
  useEffect(() => {
    const toPersist = messages.filter((m) => m.id !== 'welcome');
    persistMessagesLocally(toPersist);
  }, [messages]);

  // When the UI language changes and the user has NO stored conversation,
  // refresh the welcome message to match the new language.
  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) return;
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === 'welcome') {
        return [createWelcomeMessage(currentLang)];
      }
      return prev;
    });
  }, [currentLang]);

  // Focus the textarea on open.
  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  // Keep the scroll anchor in view whenever messages/loading state changes.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const updateSuggestions = useCallback(
    (
      question: string,
      assistantReply: string,
      conversationHistory: ChatMessage[],
      suggestionLanguage: string,
    ) => {
      const normalized = normalizeLanguageCode(suggestionLanguage);
      setSuggestions(
        generateSmartSuggestions(
          question,
          assistantReply,
          conversationHistory.map((m) => ({ role: m.role, content: m.content })),
          normalized,
        ),
      );
    },
    [],
  );

  const handleSend = useCallback(
    async (directMessage?: string) => {
      const cleaned = sanitizeInput(directMessage || inputValue);
      if (!cleaned || isLoading || sendLockRef.current) return;
      sendLockRef.current = true;

      const detectedQuestionLanguage = detectSupportedQuestionLanguage(cleaned);
      const questionLanguageHint = inferQuestionLanguageHint(cleaned);
      // The effective reply language: question language if we detected one,
      // otherwise fall back to the UI language. Used for the AI prompt, the
      // cache key, and the suggestion chips so all three stay in lock-step.
      const replyLang: SupportedLanguageCode = detectedQuestionLanguage ?? currentLang;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: cleaned,
        timestamp: formatTimestamp(currentLang),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);
      setStatusMessage(null);
      setSuggestions([]);

      // ── Persist the user message IMMEDIATELY, before calling the AI ──
      //
      // The previous implementation only logged after a successful AI
      // reply. That meant any failure mode in the AI request path
      // (network error, 5xx, timeout, empty reply, user navigates away
      // mid-flight) silently dropped the user's question from the admin
      // Chat History. Now the user's input is queued the instant we
      // commit it to the visible message list, so even if everything
      // downstream collapses, the question survives.
      logChatToServer(
        userIdRef.current,
        sessionIdRef.current,
        [userMessage],
        replyLang,
      );

      try {
        // Ensure AI context is ready; falls back to in-memory cache / inline
        // defaults if the network is down.
        const aiContext = await loadAiContext();
        const knowledgeSections = buildKnowledgeBase(fixedT, cleaned, currentLang);
        // History sent to the AI excludes the synthetic 'welcome' bubble —
        // it's a multi-lingual UI greeting, NOT a real exchange, and would
        // bias the model towards the UI language even when the customer
        // typed in a different one.
        const historyForAi = [...messages, userMessage].filter((m) => m.id !== 'welcome');
        const prompt = mapKnowledgeToPrompt(
          cleaned,
          historyForAi,
          knowledgeSections,
          currentLang,
          questionLanguageHint,
          aiContext.toneGuidelines,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120_000);
        let response: Response;
        try {
          response = await apiFetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, lang: replyLang }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          throw new Error(
            typeof errorPayload?.error === 'string'
              ? errorPayload.error
              : `Unexpected server response (${response.status})`,
          );
        }

        const payload = await response.json();
        const assistantReply = typeof payload?.reply === 'string' ? payload.reply.trim() : '';

        if (!assistantReply) {
          // AI returned an empty body. Show the fallback to the user AND
          // log it as a synthetic assistant turn so the admin Chat
          // History reflects what the customer actually experienced.
          const sid = ++statusIdRef.current;
          setStatusMessage(uiText.noAnswerFallback);
          setTimeout(() => { if (statusIdRef.current === sid) setStatusMessage(null); }, 8000);
          logChatToServer(
            userIdRef.current,
            sessionIdRef.current,
            [{
              id: `assistant-fallback-${Date.now()}`,
              role: 'assistant',
              content: uiText.noAnswerFallback,
              timestamp: formatTimestamp(replyLang),
            }],
            replyLang,
          );
          return;
        }

        const replyContent = withWhatsAppLinks(assistantReply);
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          timestamp: formatTimestamp(replyLang),
        };

        const updatedConversation = [...messages, userMessage, assistantMessage];
        setMessages(updatedConversation);
        // Log ONLY the assistant message — the user message was already
        // queued above. Keeping them as separate batches means even if
        // one log POST fails the other still lands on its own.
        logChatToServer(
          userIdRef.current,
          sessionIdRef.current,
          [assistantMessage],
          replyLang,
        );
        updateSuggestions(
          cleaned,
          replyContent,
          updatedConversation,
          replyLang,
        );
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('AI chat request failed:', getErrorMessage(error));
        }
        const errMsg =
          error instanceof Error && error.name === 'AbortError'
            ? uiText.fallbackReply
            : /empty response|empty reply/i.test(getErrorMessage(error))
              ? uiText.noAnswerFallback
              : uiText.fallbackReply;
        const sid = ++statusIdRef.current;
        setStatusMessage(errMsg);
        setSuggestions([]);
        setTimeout(() => { if (statusIdRef.current === sid) setStatusMessage(null); }, 8000);
        // Log the fallback as if the assistant said it — the admin needs
        // to see "this customer asked X, and we responded with the
        // connection-error fallback". Otherwise the row in chat_messages
        // for the user's question would be a dead-end with no reply.
        logChatToServer(
          userIdRef.current,
          sessionIdRef.current,
          [{
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            content: errMsg,
            timestamp: formatTimestamp(replyLang),
          }],
          replyLang,
        );
      } finally {
        setIsLoading(false);
        sendLockRef.current = false;
        window.setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [currentLang, fixedT, inputValue, isLoading, messages, uiText, updateSuggestions],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      void handleSend(suggestion);
    },
    [handleSend],
  );

  const openChat = useCallback(() => {
    setIsOpen(true);
    // First open of the session is the signal we wanted — kill all the
    // attention-grabbing affordances so we never nag the same visitor twice.
    interactedRef.current = true;
    setCurrentHintKey(null);
    setShowExitIntent(false);
    trackChatOpen();
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    // Keep `interactedRef` latched — closing the panel ≠ "I want to be
    // nudged again". A returning visitor on a new tab gets a fresh session.
    setCurrentHintKey(null);
    trackChatClose();
  }, []);

  const dismissWelcomeHint = useCallback(() => {
    setCurrentHintKey((prev) => {
      if (prev) dismissedHintsRef.current.add(prev);
      return null;
    });
  }, []);

  const acceptExitIntent = useCallback(() => {
    setShowExitIntent(false);
    // Sticky cross-session suppression: once the visitor has explicitly
    // chosen to start chatting from the exit-intent prompt, the popup must
    // never reappear for this browser — even after a full page reload,
    // tab close, or weeks-later return visit. The in-memory
    // `exitIntentShownRef` below blocks the rest of this session; the
    // localStorage flag blocks every future one. If localStorage is
    // unavailable (private mode, quota, disabled), we still get session-
    // level suppression via the ref, which is the strict minimum required
    // to avoid double-prompting in the same page-view.
    try {
      window.localStorage.setItem(EXIT_INTENT_ACCEPTED_KEY, '1');
    } catch {
      /* private mode / quota / disabled — session ref still suppresses reshow this tab. */
    }
    // Open the panel and latch — accepting the prompt is the strongest
    // engagement signal we get; cementing interactedRef stops any rotation
    // from firing before the panel finishes mounting.
    setIsOpen(true);
    interactedRef.current = true;
    setCurrentHintKey(null);
    trackChatOpen();
  }, []);

  const dismissExitIntent = useCallback(() => {
    setShowExitIntent(false);
  }, []);

  // getCachedAiContext() is invoked inside buildKnowledgeBase; keep the
  // import live here so tree-shaking doesn't drop the module.
  void getCachedAiContext;

  return {
    currentLang,
    isRtl,
    uiText,
    isOpen,
    currentHintKey,
    showWelcomeHint: currentHintKey !== null,
    showExitIntent,
    messages,
    inputValue,
    isLoading,
    statusMessage,
    suggestions,
    openChat,
    closeChat,
    dismissWelcomeHint,
    acceptExitIntent,
    dismissExitIntent,
    setInputValue,
    handleSend,
    handleSuggestionClick,
    inputRef,
    messagesEndRef,
  };
};
