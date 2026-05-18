/**
 * Build a plain-text transcript of a Karo conversation, ready to drop
 * into a WhatsApp message body. The visitor's "Continue on WhatsApp"
 * tap relies on this — the more readable the transcript the more
 * useful the hand-off for the sales agent picking up the chat.
 *
 * Transformations applied to each message:
 *
 *   1. Welcome bubble + still-streaming bubbles are skipped — the
 *      welcome is a UI greeting, not a real turn, and a streaming
 *      reply hasn't finished yet.
 *
 *   2. Assistant messages have their auto-appended contact footer
 *      (Phase 11) stripped. The agent's own WhatsApp number / email
 *      inside a WhatsApp message reads as noise.
 *
 *   3. Markdown is reduced to plain text:
 *      - `[label](url)` → `label`
 *      - `**bold**`     → `bold`
 *      - leading `#` headers and stray asterisks are removed.
 *      Plain prose stays as-is so the transcript reads naturally.
 *
 *   4. Each surviving message is prefixed with a localised role
 *      label (Me / Karo) and joined by a blank line. The result
 *      reads as a script.
 */
import type { ChatMessage } from '../hooks/useChatState';

type Lang = 'ar' | 'en' | 'tr' | 'ru';

const isSupported = (s: string): s is Lang =>
  s === 'ar' || s === 'en' || s === 'tr' || s === 'ru';

const pickLang = (lang: string | undefined): Lang => {
  const code = (lang || 'ar').toLowerCase();
  return isSupported(code) ? code : 'ar';
};

const ROLE_LABELS: Record<Lang, { me: string; karo: string }> = {
  ar: { me: 'أنا', karo: 'Karo' },
  en: { me: 'Me', karo: 'Karo' },
  tr: { me: 'Ben', karo: 'Karo' },
  ru: { me: 'Я', karo: 'Karo' },
};

/**
 * Regex matching the contact footer block the server auto-appends to
 * every assistant reply (see server/routes/api-chat.mjs → buildContactBlock).
 * Anything from the localised label onwards is dropped from the
 * transcript. Multi-line dot-all because the footer has a newline
 * between the two link lines.
 */
const CONTACT_FOOTER_PATTERNS: RegExp[] = [
  /\n+\s*البريد\s*:[\s\S]*$/u,
  /\n+\s*Email\s*:[\s\S]*$/iu,
  /\n+\s*E-?posta\s*:[\s\S]*$/iu,
  /\n+\s*Электронная\s*почта\s*:[\s\S]*$/iu,
];

const stripContactFooter = (text: string): string => {
  let out = text;
  for (const pattern of CONTACT_FOOTER_PATTERNS) {
    out = out.replace(pattern, '');
  }
  return out;
};

const stripMarkdown = (text: string): string =>
  text
    // Markdown link: `[label](url)` → `label`. Lazy match on the URL
    // group so a link inside a sentence doesn't gobble until the next ).
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Bold / italic asterisks
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Headings: drop the # prefix, keep the text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    // Blockquote markers
    .replace(/^\s*>\s?/gm, '')
    // Code fences (rare in chat, kept as plain text)
    .replace(/```[a-z]*\n/gi, '')
    .replace(/```/g, '')
    // Collapse runs of 3+ blank lines to a single blank line.
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Per-message normalisation. Returns null when the message should
 * be excluded from the transcript (welcome, streaming, empty after
 * stripping).
 */
const formatMessage = (
  message: ChatMessage,
  labels: { me: string; karo: string },
): string | null => {
  // Skip the synthetic welcome bubble (UI greeting, not a real exchange).
  if (message.id === 'welcome') return null;
  // Skip in-flight streaming messages — they're not finished.
  if (message.streaming === true) return null;

  const role = message.role === 'user' ? labels.me : labels.karo;
  let body = message.content || '';

  if (message.role === 'assistant') {
    body = stripContactFooter(body);
  }
  body = stripMarkdown(body);

  if (!body) return null;
  return `${role}: ${body}`;
};

export const buildChatTranscript = (
  messages: ChatMessage[],
  lang: string | undefined,
): string => {
  const labels = ROLE_LABELS[pickLang(lang)];
  const lines: string[] = [];
  for (const message of messages) {
    const formatted = formatMessage(message, labels);
    if (formatted) lines.push(formatted);
  }
  return lines.join('\n\n');
};
