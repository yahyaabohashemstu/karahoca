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
      return `**Hi, I'm Karo!** 👋

I'm the AI assistant at **KARAHOCA**.
Ask me about our products, company, production, news, shipping, or contact details — I'm here to help.`;
    case 'tr':
      return `**Merhaba, ben Karo!** 👋

**KARAHOCA**'nın yapay zeka asistanıyım.
Ürünlerimiz, şirketimiz, üretim, haberler, sevkiyat veya iletişim hakkında sorularınızı yanıtlamaya hazırım.`;
    case 'ru':
      return `**Привет, я Каро!** 👋

Я виртуальный помощник компании **KARAHOCA**.
Спросите меня о продукции, компании, производстве, новостях, доставке или способах связи — я всегда рад помочь.`;
    case 'ar':
    default:
      return `**مرحباً، أنا كارو!** 👋

أنا المساعد الذكي لشركة **KARAHOCA**.
اسألني عن المنتجات، الشركة، الإنتاج، الأخبار، الشحن، أو وسائل التواصل — أنا هنا لمساعدتك.`;
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
