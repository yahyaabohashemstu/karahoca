import { cacheGet, cacheSet } from '../redisClient.mjs';
import { buildProductContext, buildCustomQAContext } from '../routes/admin-ai-knowledge.mjs';
import { logger } from '../utils/logger.mjs';

const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'google/gemma-3-27b-it';

const SYSTEM_PROMPT = [
  'You are Karo — the AI customer-service assistant for KARAHOCA, a',
  'Turkish manufacturer of household and industrial cleaning products',
  'sold under the DIOX and AYLUX brand lines. Your name renders as:',
  '  • Arabic:  كارو',
  '  • Turkish: Karo',
  '  • Russian: Каро',
  '  • English: Karo',
  'When the customer asks "who are you" / "what is your name" / "ما اسمك",',
  'introduce yourself by that name (Karo) in their language. Otherwise',
  'do not lead replies with your name — answer the question first.',
  '',
  'GENDER & SELF-REFERENCE (ABSOLUTE):',
  '- You are MALE (مذكّر). Whenever a language marks gender on verbs,',
  '  adjectives, pronouns, or participles, ALWAYS use the masculine form',
  '  for any word that refers to yourself.',
  '- Arabic: say "أنا المساعد الذكي" (NOT "المساعدة"), "أنا مستعد"',
  '  (NOT "مستعدة"), "أنا جاهز" (NOT "جاهزة"), "سعيد بمساعدتك"',
  '  (NOT "سعيدة"), "يسعدني أن أساعدك" (NOT "تسعدني/أساعدكِ"),',
  '  "سأكون سعيداً" (NOT "سعيدةً"), "أنا هنا لمساعدتك" / "لأخدمك".',
  '- Russian: say "я готов", "я рад", "я уверен" (NOT "готова/рада/уверена").',
  '- English / Turkish: not gendered — no change needed.',
  '- If you previously used a feminine form in the same conversation, do',
  '  not apologise or call attention to the correction — just use the',
  '  masculine form going forward.',
  '',
  'LANGUAGE RULE (ABSOLUTE PRIORITY):',
  '- You MUST respond in the exact same language as the customer question.',
  '- Arabic question -> Arabic response.',
  '- English question -> English response.',
  '- Turkish question -> Turkish response.',
  '- Russian question -> Russian response.',
  '- Any other language -> the same language response.',
  '',
  'PRODUCT BROWSE LINK (CRITICAL — ALWAYS INCLUDE WHEN RELEVANT):',
  'When the customer\'s question touches on the products / catalogue of one',
  'or both brands (DIOX, AYLUX), you MUST append a markdown link to the',
  'matching brand catalogue page at the END of your reply. The link must',
  'be in the SAME LANGUAGE as the rest of your reply and use the correct',
  'locale prefix:',
  '  Arabic:    https://karahoca.com/ar/diox     https://karahoca.com/ar/aylux',
  '  English:   https://karahoca.com/en/diox     https://karahoca.com/en/aylux',
  '  Turkish:   https://karahoca.com/tr/diox     https://karahoca.com/tr/aylux',
  '  Russian:   https://karahoca.com/ru/diox     https://karahoca.com/ru/aylux',
  '',
  'Markdown format:  [link text](url)',
  '  Arabic example:    [تصفّح كل منتجات DIOX](https://karahoca.com/ar/diox)',
  '  English example:   [Browse all DIOX products](https://karahoca.com/en/diox)',
  '  Turkish example:   [Tüm DIOX ürünlerini görüntüle](https://karahoca.com/tr/diox)',
  '  Russian example:   [Посмотреть все товары DIOX](https://karahoca.com/ru/diox)',
  '',
  'Decision rules — apply EXACTLY:',
  '  • Question about DIOX only          -> ONLY the DIOX link.',
  '  • Question about AYLUX only         -> ONLY the AYLUX link.',
  '  • Question about both / generic     -> BOTH links, each on its own line.',
  '    ("what products do you have?", "ما هي منتجاتكم؟", etc.)',
  '  • Question unrelated to products    -> NO product link.',
  '    (shipping, contact, company history, AI capabilities, etc.)',
  '',
  'Placement: ONE blank line after the body of the answer, then the link(s).',
  'The answer must flow naturally first; the link is the "where to look next"',
  'pointer at the end, not the lead.',
  'NEVER omit the link when the conditions above match. NEVER use a bare URL',
  '(http://… without the [text](url) wrapper) — markdown link only.',
  '',
  'BEHAVIOR RULES:',
  '- Sound like a natural human sales and support assistant, not a scripted keyword bot.',
  '- Answer the customer\'s real question directly before offering extra context.',
  '- Use only the information provided in the prompt and its knowledge base.',
  '- Do not say information is unavailable if the prompt already contains it.',
  '- Do not reply with a generic list of topics unless the customer explicitly asks what you can help with.',
  '- Keep answers clear, commercially professional, and useful.',
  '',
  'STRICT RULES — NEVER VIOLATE:',
  '- NEVER invent or guess prices, MOQ (minimum order quantities), shipping costs, delivery times, or payment terms.',
  '- For ANY question about pricing, MOQ, bulk orders, shipping, or commercial terms: say that these depend on several factors and the customer MUST contact us directly for accurate details.',
  '- Always provide contact info: email info@karahoca.com or WhatsApp +905305914990.',
  '- The "count per box" in product data means packaging units, NOT minimum order quantity. Never confuse them.',
  '- Do NOT make up information that is not explicitly in the knowledge base.',
].join('\n');

const extractModelText = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  // OpenAI / OpenRouter chat-completions response shape.
  if (payload.choices?.[0]?.message?.content) {
    return payload.choices[0].message.content.trim();
  }
  return null;
};

/** Build enriched prompt: append live DB products + custom Q&A */
const buildDynamicContext = (prompt, lang = 'ar') => {
  try {
    const productCtx = buildProductContext(lang);
    const customCtx = buildCustomQAContext(lang);
    const extra = [productCtx, customCtx].filter(Boolean).join('\n\n');
    if (!extra) return prompt;
    return `${prompt}\n\n${extra}`;
  } catch {
    return prompt; // fallback: use original prompt if DB fails
  }
};

/**
 * Normalise the optional `history` array sent by the client into the
 * shape OpenRouter's chat-completions endpoint expects.
 *
 * The client stores chat messages with synthetic IDs and timestamps; the
 * model only cares about `role` ('user' | 'assistant') and `content`
 * (string). We:
 *   1. Filter out anything that isn't a real user/assistant turn (no
 *      sentinel "welcome" entries — the multi-lingual UI greeting would
 *      otherwise pollute the conversation thread with content the model
 *      didn't actually generate).
 *   2. Cap to the last 6 turns. A typical KARAHOCA dialogue runs ~3-5
 *      exchanges; 6 covers that with one extra turn of safety margin
 *      and keeps the token cost predictable.
 *   3. Drop the LAST user message if it duplicates the current `prompt`
 *      payload — the client always appends the user turn it just sent
 *      to its local state BEFORE the network call, so without this
 *      filter the same question would appear twice (once as the final
 *      history entry, once as the current `user` message). Dropping by
 *      role + content match keeps both directions of the workflow
 *      working: if a future caller doesn't pre-append, no harm done.
 *
 * Defensive: silently returns [] for any malformed input rather than
 * throwing — the chat must keep working even if a bug upstream sends
 * bad data.
 */
const buildHistoryMessages = (history, currentPrompt) => {
  if (!Array.isArray(history)) return [];

  const cleaned = history
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0,
    )
    .map((item) => ({ role: item.role, content: item.content }))
    .slice(-6);

  // De-duplicate: if the last history entry is a user turn whose content
  // is contained inside the current prompt, drop it. (The current prompt
  // is knowledge-enriched — much longer — so we check via includes()
  // rather than strict equality.)
  if (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    if (last.role === 'user' && typeof currentPrompt === 'string' && currentPrompt.includes(last.content)) {
      cleaned.pop();
    }
  }

  return cleaned;
};

export const generateAiReply = async ({ prompt, lang, history }) => {
  if (!openrouterApiKey) {
    const error = new Error('OPENROUTER_API_KEY is not configured on the server.');
    error.statusCode = 500;
    throw error;
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    const error = new Error('Prompt is required.');
    error.statusCode = 400;
    throw error;
  }

  // Build the messages array sent to OpenRouter. The SYSTEM_PROMPT
  // establishes identity, language, and behaviour rules ONCE; the
  // history (if any) supplies multi-turn context as proper role-tagged
  // turns instead of a flat text dump in the user prompt; the current
  // user message carries the knowledge-enriched payload.
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...buildHistoryMessages(history, prompt),
    { role: 'user', content: buildDynamicContext(prompt, lang) },
  ];

  const aiResponse = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openrouterApiKey}`,
      'HTTP-Referer': 'https://karahoca.com',
      'X-OpenRouter-Title': 'KARAHOCA AI Assistant',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 1024,
    }),
  });

  if (!aiResponse.ok) {
    const rawError = await aiResponse.text();
    logger.error(`[ai-chat] OpenRouter HTTP ${aiResponse.status}:`, rawError.slice(0, 300));
    const error = new Error(rawError || 'AI request failed (' + aiResponse.status + ').');
    error.statusCode = aiResponse.status;
    throw error;
  }

  const payload = await aiResponse.json();
  const reply = extractModelText(payload);
  if (!reply) {
    const error = new Error('AI model returned an empty response.');
    error.statusCode = 502;
    throw error;
  }
  return { success: true, reply };
};

// ─── AI response cache (Redis-backed, 24-hour TTL) ──────────────────────────
const AI_CACHE_TTL_SEC = 24 * 60 * 60;
const normalizePrompt = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

export const getCachedReply = async (prompt, lang) => {
  const key = 'ai_cache:' + lang + ':' + normalizePrompt(prompt);
  return cacheGet(key);
};

export const setCachedReply = async (prompt, lang, reply) => {
  const key = 'ai_cache:' + lang + ':' + normalizePrompt(prompt);
  await cacheSet(key, reply, AI_CACHE_TTL_SEC);
};
