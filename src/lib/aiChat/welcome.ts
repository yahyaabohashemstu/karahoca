import { normalizeLanguageCode, type SupportedLanguageCode } from '../../utils/language';

/**
 * Bilingual welcome messages (current UI language + English) for the chat.
 *
 * Pure UI strings, NOT knowledge — they stay in the client instead of moving
 * to the DB. Small, rarely change, and must render synchronously on first
 * open without waiting for any fetch.
 */

const getSingleAssistantWelcomeMessage = (lang: SupportedLanguageCode): string => {
  switch (lang) {
    case 'en':
      return `**Welcome!** 👋

I'm the AI assistant for **KARAHOCA**.
You can ask me about our products, company, production, news, shipping, and contact details.`;
    case 'tr':
      return `**Hoş geldiniz!** 👋

Ben **KARAHOCA** için hazırlanan yapay zeka asistanıyım.
Urunlerimiz, sirketimiz, uretim, haberler, sevkiyat ve iletisim hakkinda soru sorabilirsiniz.`;
    case 'ru':
      return `**Добро пожаловать!** 👋

Я виртуальный помощник компании **KARAHOCA**.
Вы можете спросить меня о продукции, компании, производстве, новостях, доставке и способах связи.`;
    case 'ar':
    default:
      return `**مرحباً بك!** 👋

أنا المساعد الذكي لشركة **KARAHOCA**.
يمكنك سؤالي عن المنتجات، الشركة، الإنتاج، الأخبار، الشحن، ووسائل التواصل.`;
  }
};

/** Bilingual greeting: current UI language first, English appended for non-EN
 *  locales so the visitor sees both right away. */
export const getAssistantWelcomeMessage = (lang: string): string => {
  const normalised = normalizeLanguageCode(lang);
  const localised = getSingleAssistantWelcomeMessage(normalised);
  if (normalised === 'en') return localised;
  return `${localised}\n\n${getSingleAssistantWelcomeMessage('en')}`;
};
