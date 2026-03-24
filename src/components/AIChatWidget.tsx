import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import {
  assistantToneGuidelines,
  getAssistantWelcomeMessage,
  buildKnowledgeBase,
  generateSmartSuggestions,
  type KnowledgeSection,
} from '../data/aiKnowledge';
import { buildApiUrl } from '../utils/api';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  getLanguageDirection,
  normalizeLanguageCode,
  type SupportedLanguageCode,
} from '../utils/language';
import '../styles/ai-chat.css';

type MessageRole = 'user' | 'assistant';
interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

const CHAT_STORAGE_KEY = 'karahoca_ai_chat_messages';

interface UIStrings {
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
}

const getLocaleForLanguage = (lang: string) => {
  const localeMap = {
    ar: 'ar-EG',
    en: 'en-US',
    tr: 'tr-TR',
    ru: 'ru-RU',
  };

  return localeMap[normalizeLanguageCode(lang)];
};

const getUIText = (lang: string): UIStrings => {
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
        loadingLabel: 'جاري التحميل',
        connectionError: 'حدث خطأ أثناء الاتصال بالمساعد.',
        fallbackReply:
          'نواجه صعوبة في الاتصال بالمساعد الآن. يرجى مراسلتنا على البريد info@karahoca.com أو الواتساب +905305914990، وسنعمل على خدمتك فوراً.',
        noAnswerFallback:
          'لم أتمكن من العثور على إجابة دقيقة في قاعدة المعرفة الحالية. يسعدنا التواصل معكم عبر البريد info@karahoca.com أو الواتساب +905305914990.',
      };
  }
};

const formatTimestamp = (lang: string) =>
  new Date().toLocaleTimeString(getLocaleForLanguage(lang), {
    hour: '2-digit',
    minute: '2-digit',
  });

const sanitizeInput = (value: string) => value.replace(/\s+/g, ' ').trim();

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
    case 'en':
      return 'English';
    case 'tr':
      return 'Turkish';
    case 'ru':
      return 'Russian';
    case 'ar':
    default:
      return 'Arabic';
  }
};

const detectSupportedQuestionLanguage = (
  question: string
): SupportedLanguageCode | null => {
  if (ARABIC_SCRIPT_PATTERN.test(question)) {
    return 'ar';
  }

  if (CYRILLIC_SCRIPT_PATTERN.test(question)) {
    return 'ru';
  }

  if (TURKISH_LANGUAGE_PATTERN.test(question)) {
    return 'tr';
  }

  if (GERMAN_LANGUAGE_PATTERN.test(question)) {
    return null;
  }

  if (ENGLISH_LANGUAGE_PATTERN.test(question) || /[A-Za-z]/u.test(question)) {
    return 'en';
  }

  return null;
};

const inferQuestionLanguageHint = (question: string) => {
  if (ARABIC_SCRIPT_PATTERN.test(question)) {
    return 'Arabic';
  }

  if (CYRILLIC_SCRIPT_PATTERN.test(question)) {
    return 'Russian or another Cyrillic language';
  }

  if (DEVANAGARI_SCRIPT_PATTERN.test(question)) {
    return 'Hindi';
  }

  if (GERMAN_LANGUAGE_PATTERN.test(question)) {
    return 'German';
  }

  if (TURKISH_LANGUAGE_PATTERN.test(question)) {
    return 'Turkish';
  }

  if (GREEK_SCRIPT_PATTERN.test(question)) {
    return 'Greek';
  }

  if (HEBREW_SCRIPT_PATTERN.test(question)) {
    return 'Hebrew';
  }

  if (THAI_SCRIPT_PATTERN.test(question)) {
    return 'Thai';
  }

  if (HANGUL_SCRIPT_PATTERN.test(question)) {
    return 'Korean';
  }

  if (HIRAGANA_KATAKANA_PATTERN.test(question)) {
    return 'Japanese';
  }

  if (HAN_SCRIPT_PATTERN.test(question)) {
    return 'Chinese';
  }

  if (ENGLISH_LANGUAGE_PATTERN.test(question)) {
    return 'English';
  }

  return 'the customer’s exact language';
};

const isStoredChatMessage = (value: unknown): value is ChatMessage =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ChatMessage).id === 'string' &&
      ((value as ChatMessage).role === 'user' || (value as ChatMessage).role === 'assistant') &&
      typeof (value as ChatMessage).content === 'string' &&
      typeof (value as ChatMessage).timestamp === 'string'
  );

const createWelcomeMessage = (lang: string): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: getAssistantWelcomeMessage(lang),
  timestamp: formatTimestamp(lang),
});

const loadStoredMessages = () => {
  if (typeof window === 'undefined') {
    return [] as ChatMessage[];
  }

  try {
    const rawValue = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!rawValue) {
      return [] as ChatMessage[];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      return [] as ChatMessage[];
    }

    return parsedValue.filter(isStoredChatMessage);
  } catch {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    return [] as ChatMessage[];
  }
};

const persistMessagesLocally = (messages: ChatMessage[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (messages.length === 0) {
    window.localStorage.removeItem(CHAT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
};

const withWhatsAppLinks = (content: string) => {
  const whatsappUrl = 'https://wa.me/905305914990';
  const phonePattern =
    /(\+?90\s?5\d{2}\s?\d{3}\s?\d{4}|\+?905\d{9}|\+?90 530 591 4990|\+905305914990)/g;
  const protectedPattern = /!\[[^\]]*?\]\([^)]+\)|\[[^\]]+?\]\([^)]+\)|https?:\/\/[^\s)]+/g;

  const replacePhoneNumbers = (text: string) =>
    text.replace(phonePattern, (matchedPhone) => `[${matchedPhone}](${whatsappUrl})`);

  let lastIndex = 0;
  let transformedContent = '';

  for (const match of content.matchAll(protectedPattern)) {
    const matchIndex = match.index ?? 0;
    transformedContent += replacePhoneNumbers(content.slice(lastIndex, matchIndex));
    transformedContent += match[0];
    lastIndex = matchIndex + match[0].length;
  }

  transformedContent += replacePhoneNumbers(content.slice(lastIndex));

  return transformedContent;
};

const mapKnowledgeToPrompt = (
  question: string,
  history: ChatMessage[],
  knowledgeSections: KnowledgeSection[],
  websiteLanguage: SupportedLanguageCode,
  questionLanguageHint: string
) => {
  const knowledgeSummary = knowledgeSections
    .map((section, index) => `${index + 1}. ${section.title}: ${section.content}`)
    .join('\n');

  const historySnippet = history
    .slice(-6)
    .map((message) => `${message.role === 'user' ? 'Customer' : 'Assistant'}: ${message.content}`)
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
${assistantToneGuidelines}

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

const AIChatWidget: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const isRtl = getLanguageDirection(currentLang) === 'rtl';
  const isMobile = useIsMobile(768);
  const uiText = useMemo(() => getUIText(currentLang), [currentLang]);
  const fixedT = useMemo(() => i18n.getFixedT(currentLang), [i18n, currentLang]);
  const welcomeHintShownRef = useRef(false);

  const [showWelcomeHint, setShowWelcomeHint] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const storedMessages = loadStoredMessages();
    return storedMessages.length > 0 ? storedMessages : [createWelcomeMessage(currentLang)];
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen || welcomeHintShownRef.current) {
      setShowWelcomeHint(false);
      return;
    }

    const notificationTimer = window.setTimeout(() => {
      setShowWelcomeHint(true);
      welcomeHintShownRef.current = true;

      try {
        const audio = new Audio('/notification-sound.wav');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {
        // Ignore browsers that block autoplay or do not support audio.
      }
    }, 3000);

    return () => window.clearTimeout(notificationTimer);
  }, [isOpen]);

  useEffect(() => {
    const messagesToPersist = messages.filter((message) => message.id !== 'welcome');
    persistMessagesLocally(messagesToPersist);
  }, [messages]);

  useEffect(() => {
    const storedMessages = loadStoredMessages();
    if (storedMessages.length > 0) {
      return;
    }

    setMessages((previousMessages) => {
      if (
        previousMessages.length === 1 &&
        previousMessages[0]?.id === 'welcome'
      ) {
        return [createWelcomeMessage(currentLang)];
      }

      return previousMessages;
    });
  }, [currentLang]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const updateSuggestions = (
    question: string,
    assistantReply: string,
    conversationHistory: ChatMessage[],
    suggestionLanguage: string
  ) => {
    const normalizedSuggestionLanguage = normalizeLanguageCode(suggestionLanguage);

    setSuggestions(
      generateSmartSuggestions(
        question,
        assistantReply,
        conversationHistory.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        normalizedSuggestionLanguage
      )
    );
  };

  const handleSend = async (directMessage?: string) => {
    const cleanedInput = sanitizeInput(directMessage || inputValue);

    if (!cleanedInput || isLoading) {
      return;
    }

    const detectedQuestionLanguage = detectSupportedQuestionLanguage(cleanedInput);
    const questionLanguageHint = inferQuestionLanguageHint(cleanedInput);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: cleanedInput,
      timestamp: formatTimestamp(currentLang),
    };

    setMessages((previousMessages) => [...previousMessages, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setStatusMessage(null);
    setSuggestions([]);

    try {
      const knowledgeSections = buildKnowledgeBase(fixedT, cleanedInput, currentLang);
      const prompt = mapKnowledgeToPrompt(
        cleanedInput,
        [...messages, userMessage],
        knowledgeSections,
        currentLang,
        questionLanguageHint
      );
      const response = await fetch(buildApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(
          typeof errorPayload?.error === 'string'
            ? errorPayload.error
            : `Unexpected server response (${response.status})`
        );
      }

      const payload = await response.json();
      const assistantReply =
        typeof payload?.reply === 'string' ? payload.reply.trim() : '';

      if (!assistantReply) {
        setStatusMessage(uiText.noAnswerFallback);
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
      updateSuggestions(
        cleanedInput,
        replyContent,
        updatedConversation,
        detectedQuestionLanguage ?? currentLang
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Gemini request failed:', getErrorMessage(error));
      }
      const errorMessage = getErrorMessage(error);
      const isEmptyReplyError = /empty response|empty reply/i.test(errorMessage);
      setStatusMessage(isEmptyReplyError ? uiText.noAnswerFallback : uiText.fallbackReply);
      setSuggestions([]);
    } finally {
      setIsLoading(false);

      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowWelcomeHint(false);
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
      return;
    }

    setIsOpen(true);
    setShowWelcomeHint(false);
  };

  return (
    <div className="ai-assistant" aria-live="polite">
      {showWelcomeHint && (
        <div
          className="ai-assistant__welcome-hint"
          style={{
            position: 'absolute',
            bottom: isMobile ? '6px' : '8px',
            left: isRtl ? (isMobile ? '58px' : '72px') : 'auto',
            right: isRtl ? 'auto' : (isMobile ? '58px' : '72px'),
            background: 'var(--orange, #f54b1a)',
            color: '#fff',
            borderRadius: isMobile ? '16px' : '20px',
            boxShadow: '0 4px 24px rgba(10,42,94,0.10)',
            padding: isMobile ? '0.42rem 1rem' : '0.5rem 1.5rem',
            fontSize: isMobile ? '0.92rem' : '1.08rem',
            fontWeight: '500',
            zIndex: 999,
            cursor: 'pointer',
            transition: 'opacity 0.5s',
            minWidth: isMobile ? '128px' : '160px',
            maxWidth: isMobile ? '250px' : '340px',
            whiteSpace: 'nowrap',
            direction: isRtl ? 'rtl' : 'ltr',
            textAlign: isRtl ? 'right' : 'left',
            display: 'inline-block',
            lineHeight: 1.35,
          }}
          onClick={() => setShowWelcomeHint(false)}
          title={uiText.closeWelcomeHint}
        >
          {uiText.welcomeHint}
        </div>
      )}

      <button
        type="button"
        className="ai-assistant__toggle"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? uiText.closeToggleLabel : uiText.openToggleLabel}
        title={isOpen ? uiText.closeToggleLabel : uiText.openToggleLabel}
      >
        {isOpen ? '×' : '🤖'}
      </button>

      {isOpen && (
        <div className="ai-assistant__window" data-lang={currentLang}>
          <header className="ai-assistant__header">
            <div>
              <p className="ai-assistant__title">{uiText.title}</p>
              <span className="ai-assistant__subtitle">{uiText.subtitle}</span>
            </div>
            <button
              type="button"
              className="ai-assistant__close"
              onClick={handleClose}
              aria-label={uiText.closeLabel}
            >
              ×
            </button>
          </header>

          <div className="ai-assistant__messages" role="log">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`ai-assistant__message ai-assistant__message--${message.role}`}
                data-message-id={message.id}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children, ...props }) => {
                      const text = String(children);
                      const hasArabic = /[\u0600-\u06FF]/.test(text);

                      return (
                        <p
                          {...props}
                          dir={hasArabic ? 'rtl' : 'ltr'}
                          style={{ textAlign: hasArabic ? 'right' : 'left' }}
                        >
                          {children}
                        </p>
                      );
                    },
                    a: ({ ...props }) => (
                      <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#25D366',
                          textDecoration: 'underline',
                          direction: 'ltr',
                          unicodeBidi: 'plaintext',
                        }}
                      />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                <span className="ai-assistant__timestamp">{message.timestamp}</span>
              </div>
            ))}

            {isLoading && (
              <div className="ai-assistant__message ai-assistant__message--assistant">
                <div className="ai-assistant__dots" aria-label={uiText.loadingLabel}>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {suggestions.length > 0 && !isLoading && (
            <div className="ai-assistant__suggestions">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="ai-assistant__suggestion-btn"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {statusMessage && <div className="ai-assistant__status">{statusMessage}</div>}

          <div className="ai-assistant__composer">
            <textarea
              ref={inputRef}
              className="ai-assistant__input"
              placeholder={uiText.placeholder}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={uiText.inputLabel}
              disabled={isLoading}
            />
            <button
              type="button"
              className="ai-assistant__send"
              onClick={() => handleSend()}
              disabled={isLoading || !sanitizeInput(inputValue)}
            >
              {uiText.sendButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatWidget;
