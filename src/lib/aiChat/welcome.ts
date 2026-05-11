import { normalizeLanguageCode, supportedLanguageCodes, type SupportedLanguageCode } from '../../utils/language';

/**
 * Multi-lingual welcome messages for the chat widget.
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

/**
 * Multi-lingual greeting: current UI language first, then every other
 * supported language. The visitor sees the welcome in all four languages
 * at once so a Turkish or Russian visitor who landed on the Arabic page
 * (or vice-versa) still gets a greeting they can read.
 *
 * The current locale leads so users in their own language always read
 * naturally from the top — no scroll needed for the primary translation.
 */
export const getAssistantWelcomeMessage = (lang: string): string => {
  const primary = normalizeLanguageCode(lang);
  const others = supportedLanguageCodes.filter((code) => code !== primary);
  const blocks = [primary, ...others].map((code) =>
    getSingleAssistantWelcomeMessage(code),
  );
  return blocks.join('\n\n');
};
