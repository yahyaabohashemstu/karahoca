/**
 * Centralised WhatsApp click-to-chat URL builders.
 *
 * Every wa.me link in the SPA goes through ONE of the builders here so
 * the message the visitor lands on always matches the active UI
 * language. Before this module existed each call-site rolled its own:
 * the floating WhatsApp button used i18n, the inline chat card was
 * hard-coded Arabic, the BrandsSection CTA had no `?text=` at all, and
 * the product-share buttons emitted raw structural text. Result: a
 * Turkish visitor tapping the home-page custom-order CTA landed on an
 * empty WhatsApp composer, a Russian visitor tapping a chat card got
 * Arabic prose, etc.
 *
 * Five context types are covered:
 *
 *   - `whatsAppGeneralInquiryUrl(lang)`
 *       Floating WhatsApp button on every page. Friendly "I'd like to
 *       ask about KARAHOCA products" opener.
 *
 *   - `whatsAppCustomOrderUrl(lang)`
 *       Private-label / custom-manufacturing CTA on the home page.
 *       Pre-fills "I'd like to inquire about a custom order".
 *
 *   - `whatsAppProductInquiryUrl(lang, product)`
 *       Inline product card inside the AI chat. Pre-fills the
 *       product name + brand + canonical URL.
 *
 *   - `whatsAppShareProductUrl(product)`
 *       Share-to-a-friend link from a brand-page product modal or
 *       the wishlist. Uses `wa.me/?text=…` (no recipient) so the
 *       visitor picks who to share with; the localised product name
 *       carries the language match implicitly.
 *
 * All builders use the same encoder that picks up where
 * `encodeURIComponent` stops: it explicitly encodes `( ) ' ! *` so a
 * stray paren in a future message copy doesn't prematurely terminate
 * the URL part of a `[text](url)` markdown link (the client's
 * `withWhatsAppLinks` rewriter scans for protected regions with
 * `[^)]+`, which would truncate at any unescaped close-paren).
 */

export const KARAHOCA_PHONE_NUMBER_E164 = '905305914990';
export const KARAHOCA_PHONE_DISPLAY = '+90 530 591 49 90';

/**
 * Public site origin used to build product-share URLs. The interstitial
 * route lives at `karahoca.com/share/product/{id}?lang=…` and is the
 * crawler-friendly link we want to drop into WhatsApp / Facebook /
 * Telegram. We hardcode the origin rather than reading window.location
 * because the share button can be tapped from a staging build where
 * the deployed share infra may not be wired up yet — better a clean
 * link to production than a broken staging interstitial.
 */
const SHARE_ORIGIN = 'https://karahoca.com';

/**
 * Build the public share URL for a product. Crawlers fetching this URL
 * see the product photograph in og:image; real browsers get redirected
 * to the SPA deep-link via meta-refresh + JS in the interstitial HTML.
 *
 * Format: https://karahoca.com/share/product/{productId}?lang={ar|en|tr|ru}
 */
export const buildProductShareUrl = (productId: string, lang: string | undefined): string => {
  const code = pickLang(lang);
  const id = encodeURIComponent(productId);
  return `${SHARE_ORIGIN}/share/product/${id}?lang=${code}`;
};

/** Languages whose copy is curated explicitly. Anything else falls back to Arabic. */
type SupportedLang = 'ar' | 'en' | 'tr' | 'ru';

const isSupported = (s: string): s is SupportedLang =>
  s === 'ar' || s === 'en' || s === 'tr' || s === 'ru';

const pickLang = (lang: string | undefined): SupportedLang => {
  const code = (lang || 'ar').toLowerCase();
  return isSupported(code) ? code : 'ar';
};

/**
 * `encodeURIComponent` leaves `( ) ' ! * ~` alone per its spec. Of those,
 * `(` and `)` are the most dangerous for us — the chat's markdown link
 * detector uses `[text](url)` where `url` is matched as `[^)]+`, so any
 * raw paren inside the URL truncates it mid-string. Belt-and-braces:
 * encode them all.
 */
const encodeWhatsAppText = (s: string): string =>
  encodeURIComponent(s).replace(
    /[()'!*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );

// ─── Message templates ────────────────────────────────────────────────────

const GENERAL_INQUIRY: Record<SupportedLang, string> = {
  ar: 'أهلاً، أودّ الاستفسار عن منتجات KARAHOCA',
  en: "Hello, I'd like to inquire about KARAHOCA products",
  tr: 'Merhaba, KARAHOCA ürünleri hakkında bilgi almak istiyorum',
  ru: 'Здравствуйте, я хотел бы узнать о продукции KARAHOCA',
};

const CUSTOM_ORDER: Record<SupportedLang, string> = {
  ar: 'أهلاً، أودّ الاستفسار عن طلب مخصّص أو تصنيع بعلامة تجاريّة خاصّة',
  en: "Hello, I'd like to inquire about a custom order or private-label manufacturing",
  tr: 'Merhaba, özel sipariş veya özel marka üretim hakkında bilgi almak istiyorum',
  ru: 'Здравствуйте, я хотел бы обсудить индивидуальный заказ или производство под собственной маркой',
};

const PRODUCT_INQUIRY: Record<
  SupportedLang,
  (name: string, brand: string, url: string) => string
> = {
  ar: (name, brand, url) => `أهلاً، أودّ الاستفسار عن ${name} (${brand})\n\n${url}`,
  en: (name, brand, url) => `Hello, I'd like to inquire about ${name} (${brand})\n\n${url}`,
  tr: (name, brand, url) =>
    `Merhaba, ${name} (${brand}) hakkında bilgi almak istiyorum\n\n${url}`,
  ru: (name, brand, url) =>
    `Здравствуйте, я хотел бы узнать о ${name} (${brand})\n\n${url}`,
};

/**
 * Header strings prefixed to a chat transcript when the visitor taps
 * "Continue this conversation on WhatsApp" at the bottom of the chat.
 * The header tells the sales agent "this is a hand-off, not a fresh
 * inquiry" so they pick up the context immediately instead of asking
 * questions Karo already answered.
 */
const CHAT_CONTINUATION_HEADER: Record<SupportedLang, string> = {
  ar: 'أهلاً، أكمل محادثتي مع المساعد Karo من الموقع:',
  en: "Hello, I'm continuing my chat with the Karo assistant from the website:",
  tr: 'Merhaba, web sitesindeki Karo asistanıyla sohbetimi devam ettiriyorum:',
  ru: 'Здравствуйте, я продолжаю разговор с ассистентом Karo с сайта:',
};

// ─── URL builders ─────────────────────────────────────────────────────────

const buildKarahocaUrl = (message: string): string =>
  `https://wa.me/${KARAHOCA_PHONE_NUMBER_E164}?text=${encodeWhatsAppText(message)}`;

export const whatsAppGeneralInquiryUrl = (lang: string | undefined): string =>
  buildKarahocaUrl(GENERAL_INQUIRY[pickLang(lang)]);

export const whatsAppCustomOrderUrl = (lang: string | undefined): string =>
  buildKarahocaUrl(CUSTOM_ORDER[pickLang(lang)]);

export const whatsAppProductInquiryUrl = (
  lang: string | undefined,
  product: { name: string; brand: string; url: string },
): string => {
  const code = pickLang(lang);
  return buildKarahocaUrl(PRODUCT_INQUIRY[code](product.name, product.brand, product.url));
};

/**
 * Hard cap on the URL-encoded text the wa.me handler accepts before it
 * silently drops the message and opens an empty composer instead.
 * Real-world testing puts the limit around ~6KB raw; we stay well under
 * to leave headroom for the URL-encoding inflation (Arabic / Russian
 * each character expands to 6-9 chars when percent-encoded).
 */
const MAX_TRANSCRIPT_CHARS = 2000;

/**
 * Continue-this-conversation URL. Takes the in-memory chat transcript
 * (a pre-formatted localised string) and wraps it with a header so the
 * sales agent picking up the WhatsApp message sees "this is a hand-off
 * from the website" before reading the back-and-forth.
 *
 * The caller is responsible for formatting the transcript itself —
 * the helper in `useChatState` strips markdown, contact footers, and
 * empty bubbles, then assembles "Customer: …" / "Karo: …" pairs.
 * This util only:
 *   1. Truncates the combined header + transcript to the wa.me-safe
 *      length (with a localised "[earlier messages omitted]" marker
 *      when the trim happens).
 *   2. Builds the URL with the canonical phone number and the paren-
 *      safe encoder shared by every wa.me helper here.
 */
export const whatsAppContinueChatUrl = (
  lang: string | undefined,
  transcript: string,
): string => {
  const code = pickLang(lang);
  const header = CHAT_CONTINUATION_HEADER[code];
  const TRIM_NOTE: Record<SupportedLang, string> = {
    ar: '\n\n[تم اقتطاع رسائل أقدم للحفاظ على طول الرسالة]\n\n',
    en: '\n\n[Older messages trimmed to fit]\n\n',
    tr: '\n\n[Eski mesajlar uzunluğa sığacak şekilde kısaltıldı]\n\n',
    ru: '\n\n[Старые сообщения сокращены]\n\n',
  };

  let body = transcript.trim();
  // Reserve space for the header + a newline + the trim note (if needed).
  const headerLen = header.length + 2;
  const usableBudget = MAX_TRANSCRIPT_CHARS - headerLen;
  if (body.length > usableBudget) {
    const note = TRIM_NOTE[code];
    const keepFromEnd = usableBudget - note.length;
    body = note + body.slice(body.length - keepFromEnd);
  }

  const full = `${header}\n\n${body}`;
  return buildKarahocaUrl(full);
};

/**
 * Share-with-a-friend URL. Opens WhatsApp WITHOUT a recipient pre-set,
 * so the visitor picks who to share with. The text body is purely
 * structural (emoji + name + description + URL) — the product name and
 * description come from a localised catalogue, so language match is
 * carried implicitly without a fixed opener template.
 */
export const whatsAppShareProductUrl = (product: {
  name: string;
  description?: string | null;
  url: string;
}): string => {
  const desc = product.description
    ? product.description.slice(0, 130) + (product.description.length > 130 ? '…' : '')
    : '';
  const text = `🧹 *${product.name}*${desc ? '\n' + desc : ''}\n\n🔗 ${product.url}`;
  return `https://wa.me/?text=${encodeWhatsAppText(text)}`;
};
