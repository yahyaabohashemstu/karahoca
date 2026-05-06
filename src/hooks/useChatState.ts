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

export interface ChatUIStrings {
  title: string;
  subtitle: string;
  placeholder: string;
  sendButton: string;
  closeLabel: string;
  openToggleLabel: string;
  closeToggleLabel: string;
  inputLabel: string;
  welcomeHint: string;
  closeWelcomeHint: string;
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

const logChatToServer = (
  userId: string,
  sessionId: string,
  messages: ChatMessage[],
  language: string,
): void => {
  if (!messages.length) return;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 5000);
  const payload = { userId, sessionId, messages, language };
  apiFetch('/api/chat/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).catch(() => {}).finally(() => clearTimeout(tid));
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
const TURKISH_LANGUAGE_PATTERN =
  /[çğıöşüÇĞİÖŞÜ]|\b(merhaba|urun|ürün|fiyat|haber|iletisim|iletişim|kargo|uretim|üretim|hedef|temizlik|sirket|şirket|nedir|nasil|nasıl|teslimat|fabrika)\b/iu;
const GERMAN_LANGUAGE_PATTERN =
  /[äöüßÄÖÜ]|\b(hallo|danke|bitte|preis|preise|produkt|produkte|nachricht|neuigkeit|lieferung|unternehmen|kontakt|wie|was|und|über)\b/iu;
const ENGLISH_LANGUAGE_PATTERN =
  /\b(hello|hi|what|how|price|prices|product|products|news|contact|company|about|shipping|delivery|factory|quality|quote|thanks)\b/iu;

const getLanguageLabel = (lang: SupportedLanguageCode) => {
  switch (lang) {
    case 'en': return 'English';
    case 'tr': return 'Turkish';
    case 'ru': return 'Russian';
    case 'ar':
    default:   return 'Arabic';
  }
};

const detectSupportedQuestionLanguage = (question: string): SupportedLanguageCode | null => {
  if (ARABIC_SCRIPT_PATTERN.test(question)) return 'ar';
  if (CYRILLIC_SCRIPT_PATTERN.test(question)) return 'ru';
  if (TURKISH_LANGUAGE_PATTERN.test(question)) return 'tr';
  if (GERMAN_LANGUAGE_PATTERN.test(question)) return null;
  if (ENGLISH_LANGUAGE_PATTERN.test(question) || /[A-Za-z]/u.test(question)) return 'en';
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
        title: 'KARAHOCA Asistani',
        subtitle: 'Sorularinizi yanitlamaya hazir',
        placeholder: 'Sorunuzu buraya yazin...',
        sendButton: 'Gonder',
        closeLabel: 'Sohbet penceresini kapat',
        openToggleLabel: 'Yapay zeka asistanini ac',
        closeToggleLabel: 'Yapay zeka asistanini kapat',
        inputLabel: 'Asistana soru giris alani',
        welcomeHint: 'Bir sorunuz mu var?',
        closeWelcomeHint: 'Karsilama mesajini kapat',
        loadingLabel: 'Yukleniyor',
        connectionError: 'Asistana baglanirken bir hata olustu.',
        fallbackReply:
          'Su anda asistana baglanmakta zorlaniyoruz. Lutfen bize info@karahoca.com adresinden veya +905305914990 WhatsApp hattindan ulasin.',
        noAnswerFallback:
          'Mevcut bilgi tabaninda net bir yanit bulamadim. Bize info@karahoca.com e-posta adresinden veya +905305914990 WhatsApp hattindan ulasabilirsiniz.',
        privacyNotice: 'Sohbetler hizmet kalitesini artırmak amacıyla kaydedilmektedir. Silme talebi: info@karahoca.com',
      };
    case 'ru':
      return {
        title: 'Помощник KARAHOCA',
        subtitle: 'Готов ответить на ваши вопросы',
        placeholder: 'Введите ваш вопрос здесь...',
        sendButton: 'Отправить',
        closeLabel: 'Закрыть окно чата',
        openToggleLabel: 'Открыть помощника',
        closeToggleLabel: 'Закрыть помощника',
        inputLabel: 'Поле ввода вопроса для помощника',
        welcomeHint: 'Есть вопрос?',
        closeWelcomeHint: 'Закрыть приветственное сообщение',
        loadingLabel: 'Загрузка',
        connectionError: 'Произошла ошибка при подключении к помощнику.',
        fallbackReply:
          'Сейчас мы не можем подключиться к помощнику. Пожалуйста, свяжитесь с нами по адресу info@karahoca.com или через WhatsApp +905305914990.',
        noAnswerFallback:
          'Я не смог найти точный ответ в текущей базе знаний. Вы можете связаться с нами по адресу info@karahoca.com или через WhatsApp +905305914990.',
        privacyNotice: 'Сообщения записываются для улучшения сервиса. Запрос на удаление: info@karahoca.com',
      };
    case 'en':
      return {
        title: 'KARAHOCA Assistant',
        subtitle: 'Ready to answer your inquiries',
        placeholder: 'Type your question here...',
        sendButton: 'Send',
        closeLabel: 'Close chat window',
        openToggleLabel: 'Open the AI assistant',
        closeToggleLabel: 'Close the AI assistant',
        inputLabel: 'Question input field for assistant',
        welcomeHint: 'Have a question?',
        closeWelcomeHint: 'Close welcome message',
        loadingLabel: 'Loading',
        connectionError: 'There was an error while connecting to the assistant.',
        fallbackReply:
          'We are having trouble connecting to the assistant right now. Please contact us at info@karahoca.com or via WhatsApp at +905305914990.',
        noAnswerFallback:
          'I could not find a precise answer in the current knowledge base. You can contact us at info@karahoca.com or via WhatsApp at +905305914990.',
        privacyNotice: 'Conversations are recorded to improve our service. Deletion requests: info@karahoca.com',
      };
    case 'ar':
    default:
      return {
        title: 'مساعد KARAHOCA',
        subtitle: 'جاهز للإجابة على استفساراتكم',
        placeholder: 'اكتب سؤالك هنا...',
        sendButton: 'إرسال',
        closeLabel: 'إغلاق نافذة المحادثة',
        openToggleLabel: 'فتح المساعد الذكي',
        closeToggleLabel: 'إغلاق المساعد الذكي',
        inputLabel: 'حقل إدخال سؤال للمساعد',
        welcomeHint: 'هل لديك سؤال؟',
        closeWelcomeHint: 'إغلاق الرسالة الترحيبية',
        loadingLabel: 'جارِالتحميل',
        connectionError: 'حدث خطأ أثناء الاتصال بالمساعد.',
        fallbackReply:
          'نواجه صعوبة في الاتصال بالمساعد الآن. يرجى مراسلتنا على البريد info@karahoca.com أو الواتساب +905305914990، وسنعمل على خدمتك فوراً.',
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
You are a helpful customer service assistant for KARAHOCA company.

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
  /** Welcome-hint bubble visibility. */
  showWelcomeHint: boolean;
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
  /** Dismiss the welcome-hint bubble. */
  dismissWelcomeHint: () => void;
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

  const welcomeHintShownRef = useRef(false);
  const [showWelcomeHint, setShowWelcomeHint] = useState(false);
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

  // Show the welcome-hint bubble 3 s after mount if the panel is still closed
  // and we haven't shown it yet this session.
  useEffect(() => {
    if (isOpen || welcomeHintShownRef.current) {
      setShowWelcomeHint(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowWelcomeHint(true);
      welcomeHintShownRef.current = true;
      try {
        if (!notifAudioRef.current) {
          notifAudioRef.current = new Audio('/notification-sound.mp3');
          notifAudioRef.current.volume = 0.5;
        }
        notifAudioRef.current.currentTime = 0;
        notifAudioRef.current.play().catch(() => {});
      } catch {
        /* autoplay blocked — ignore */
      }
    }, 3000);
    return () => window.clearTimeout(timer);
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

      try {
        // Ensure AI context is ready; falls back to in-memory cache / inline
        // defaults if the network is down.
        const aiContext = await loadAiContext();
        const knowledgeSections = buildKnowledgeBase(fixedT, cleaned, currentLang);
        const prompt = mapKnowledgeToPrompt(
          cleaned,
          [...messages, userMessage],
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
            body: JSON.stringify({ prompt, lang: currentLang }),
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
          const sid = ++statusIdRef.current;
          setStatusMessage(uiText.noAnswerFallback);
          setTimeout(() => { if (statusIdRef.current === sid) setStatusMessage(null); }, 8000);
          return;
        }

        const replyContent = withWhatsAppLinks(assistantReply);
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          timestamp: formatTimestamp(currentLang),
        };

        const updatedConversation = [...messages, userMessage, assistantMessage];
        setMessages(updatedConversation);
        logChatToServer(
          userIdRef.current,
          sessionIdRef.current,
          [userMessage, assistantMessage],
          detectedQuestionLanguage ?? currentLang,
        );
        updateSuggestions(
          cleaned,
          replyContent,
          updatedConversation,
          detectedQuestionLanguage ?? currentLang,
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
    setShowWelcomeHint(false);
    trackChatOpen();
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setShowWelcomeHint(false);
    trackChatClose();
  }, []);

  const dismissWelcomeHint = useCallback(() => {
    setShowWelcomeHint(false);
  }, []);

  // getCachedAiContext() is invoked inside buildKnowledgeBase; keep the
  // import live here so tree-shaking doesn't drop the module.
  void getCachedAiContext;

  return {
    currentLang,
    isRtl,
    uiText,
    isOpen,
    showWelcomeHint,
    messages,
    inputValue,
    isLoading,
    statusMessage,
    suggestions,
    openChat,
    closeChat,
    dismissWelcomeHint,
    setInputValue,
    handleSend,
    handleSuggestionClick,
    inputRef,
    messagesEndRef,
  };
};
