import { cacheGet, cacheSet } from '../redisClient.mjs';
import { buildProductContext, buildCustomQAContext } from '../routes/admin-ai-knowledge.mjs';
import { logger } from '../utils/logger.mjs';
import { TOOLS, executeTool, hasProductNameMatch } from './aiTools.mjs';

// ─── Chat provider configuration ────────────────────────────────────────────
//
// Karo can talk to TWO LLM providers, with automatic fallback between
// them. The chain is computed once at module load and walked top-down
// by `callChatProviderChain` on every chat turn:
//
//   1. Gemini 2.0 Flash via Google AI Studio (the OpenAI-compatible
//      endpoint at generativelanguage.googleapis.com). Free tier:
//      1,500 req/day, 15 req/min — generous enough that KARAHOCA's
//      entire daily traffic should fit. SUPPORTS tool_calls, so the
//      inline product cards (Phase 4) work natively without the
//      server-side intent fallback (which keeps working in parallel).
//
//   2. OpenRouter with whatever model `OPENROUTER_MODEL` points at
//      (default: `google/gemma-3-27b-it`, free). Used as the first
//      fallback if Gemini errors out (rate-limit, network blip,
//      configuration mistake).
//
//   3. OpenRouter with `meta-llama/llama-3.3-70b-instruct` (also
//      free). Last-resort retry against an entirely different model
//      family on the same provider — protects against a single-model
//      outage.
//
// ROLLBACK PATH: removing the `GEMINI_API_KEY` env var (and
// redeploying) takes Gemini out of the chain instantly. The chat
// reverts to the pre-Gemini OpenRouter-only behaviour without any
// code change. This is intentional — the env-var presence is the
// switch.

// ── Provider 1: Gemini direct (Google AI Studio OpenAI-compatible) ──────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-001';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// ── Provider 2-3: OpenRouter (existing, preserved) ──────────────────────
const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Which OpenRouter model Karo talks to when the chain falls back to
 * OpenRouter. Configurable via `OPENROUTER_MODEL` so ops can swap
 * without a code change; default `google/gemma-3-27b-it` (free).
 * Note: if GEMINI_API_KEY is set, this model only gets used when
 * Gemini errors out.
 */
const AI_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it';

/**
 * Build the ordered provider chain. Each entry carries the endpoint,
 * API key, model name, and a stable label for logging. Order matters:
 * the chain is walked top-down on every turn.
 */
const CHAT_PROVIDERS = (() => {
  const chain = [];
  if (GEMINI_API_KEY) {
    chain.push({
      name: `gemini:${GEMINI_MODEL}`,
      endpoint: GEMINI_ENDPOINT,
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      isOpenRouter: false,
    });
  }
  if (openrouterApiKey) {
    chain.push({
      name: `openrouter:${AI_MODEL}`,
      endpoint: OPENROUTER_ENDPOINT,
      apiKey: openrouterApiKey,
      model: AI_MODEL,
      isOpenRouter: true,
    });
    // Last-resort fallback: a different OpenRouter free model. Only
    // added when the primary OpenRouter model isn't already Llama 3.3
    // (otherwise we'd retry the same model twice).
    if (AI_MODEL !== 'meta-llama/llama-3.3-70b-instruct') {
      chain.push({
        name: 'openrouter:llama-3.3-70b',
        endpoint: OPENROUTER_ENDPOINT,
        apiKey: openrouterApiKey,
        model: 'meta-llama/llama-3.3-70b-instruct',
        isOpenRouter: true,
      });
    }
  }
  return chain;
})();

// Log the resolved chain ONCE at module load so an operator looking at
// the boot logs can confirm which providers Karo will use. Surfaces
// configuration mistakes (typo'd key, missing env var) without having
// to wait for the first chat turn.
if (CHAT_PROVIDERS.length === 0) {
  logger.warn('[ai-chat] NO chat provider configured. Set GEMINI_API_KEY and/or OPENROUTER_API_KEY.');
} else {
  logger.info(`[ai-chat] provider chain: ${CHAT_PROVIDERS.map((p) => p.name).join(' → ')}`);
}

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
  'PRODUCT CARDS — HANDLED BY THE SYSTEM, NOT BY YOU:',
  'You do NOT have any tools or functions to call. Do NOT mention',
  '"search_products", "calling a tool", or "retrieving data". The',
  'KARAHOCA system decides server-side whether to attach interactive',
  'product cards to your reply based on the visitor\'s question. If',
  'cards ARE attached, the visitor sees them as a card grid beneath',
  'your text — and you\'ll see an "[INTERNAL DIRECTIVE]" block in this',
  'prompt naming them.',
  '',
  'Your job is to NARRATE in the visitor\'s language using the product',
  'knowledge already injected into the prompt below. When the directive',
  'block IS present, reference those products naturally in your prose',
  '(e.g. "the DIOX general cleaner is great for kitchen surfaces…") —',
  'do NOT enumerate them as a bullet list (the cards do that visually)',
  'and do NOT include URLs.',
  '',
  'When the visitor\'s question is NOT about products (greetings,',
  'identity / "who are you?", brand comparisons, company history,',
  'contact, shipping, pricing), just answer the question from your',
  'general knowledge of KARAHOCA. The system will NOT attach cards in',
  'those cases and you should NOT pretend it did.',
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
  '- DO NOT include the contact email or WhatsApp number in your reply. The chat UI appends a contact footer automatically to every message. If you need to direct the customer to reach out, just say "contact us" / "تواصل معنا" / "bize ulaşın" / "свяжитесь с нами" — the address and number will appear in the footer the visitor sees.',
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

// ── Smart retry across the provider chain ──────────────────────────────────
//
// Each call walks `CHAT_PROVIDERS` top-down. Per-provider retry policy is
// tuned to the failure mode the status code most often indicates,
// because the chat is INTERACTIVE — the visitor is staring at the
// composer waiting for tokens to start streaming:
//
//   • 429 (rate-limited): on free tiers, this means a daily / minute
//     quota was hit. Won't clear in <5 s for daily, and even per-minute
//     rate limits aren't worth a retry that locks the visitor in the
//     blocking call. Skip retries on THIS provider and try the next.
//
//   • 503 (overloaded): transient upstream pressure on the model
//     provider. One quick retry after 800 ms — if it still fails the
//     chain moves on.
//
//   • Network error (DNS, TCP, TLS timeouts): one quick retry after
//     400 ms in case it was a blip. Otherwise next provider.
//
//   • Other 4xx (400, 401, 404): configuration / auth fault on THIS
//     provider — retrying won't help. Skip to next provider.
//
//   • Other 5xx: same as network — one retry, then next.
//
// Worst-case wall-clock before the visitor sees a fallback bubble (all
// three providers fail with one retry each): roughly 3-5 seconds.
const chatSleep = (ms) => new Promise((r) => setTimeout(r, ms));

const callChatProviderChain = async ({ messages, withTools, signal }) => {
  if (CHAT_PROVIDERS.length === 0) {
    const error = new Error('No chat provider configured on the server. Set GEMINI_API_KEY or OPENROUTER_API_KEY.');
    error.statusCode = 500;
    throw error;
  }

  let lastErr = null;

  for (const provider of CHAT_PROVIDERS) {
    // Per-provider attempts: at most 2 (initial + 1 retry on
    // transient errors). 429 / config-shape errors break out
    // immediately to skip to the next provider.
    let attempt = 0;
    const MAX_ATTEMPTS = 2;

    while (attempt < MAX_ATTEMPTS) {
      // Build the request body. The body is identical across providers
      // because both Gemini's OpenAI-compatible endpoint and
      // OpenRouter accept the same OpenAI chat-completions schema —
      // only the model name + endpoint differ.
      const body = {
        model: provider.model,
        messages,
        stream: true,
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 1024,
      };
      if (withTools) {
        body.tools = TOOLS;
        body.tool_choice = 'auto';
      }

      // OpenRouter wants its analytics headers (HTTP-Referer +
      // X-OpenRouter-Title for the dashboard). Gemini's OpenAI-
      // compatible endpoint ignores unknown headers but we still
      // omit them to keep the request clean.
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      };
      if (provider.isOpenRouter) {
        headers['HTTP-Referer'] = 'https://karahoca.com';
        headers['X-OpenRouter-Title'] = 'KARAHOCA AI Assistant';
      }

      try {
        const res = await fetch(provider.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        });

        if (res.ok) {
          // Log only when something interesting happened (retry or
          // fallback). The happy path on the primary provider with no
          // retries stays silent — otherwise every chat turn would
          // dump a log line.
          if (provider !== CHAT_PROVIDERS[0] || attempt > 0) {
            logger.info(`[ai-chat] using ${provider.name} (attempt ${attempt + 1})`);
          }
          return res;
        }

        const errText = await res.text();
        const truncated = errText.slice(0, 200);
        logger.warn(`[ai-chat] ${provider.name} attempt ${attempt + 1} → HTTP ${res.status}: ${truncated}`);
        lastErr = new Error(truncated || `${provider.name} HTTP ${res.status}`);
        lastErr.statusCode = res.status;

        // 429: quota exhausted (daily quota won't clear; per-minute
        // is fine but not worth blocking a visitor for 60 s). Next.
        if (res.status === 429) break;
        // 503: try once more on the same provider after a short
        // delay (transient overload).
        if (res.status === 503 && attempt < MAX_ATTEMPTS - 1) {
          attempt++;
          await chatSleep(800);
          continue;
        }
        // Anything else (400, 401, 404, 5xx other): provider config
        // problem or persistent failure — next provider.
        break;
      } catch (err) {
        // AbortError = visitor closed the chat. Propagate so the
        // route handler can wind down the SSE stream.
        if (err?.name === 'AbortError') throw err;
        logger.warn(`[ai-chat] ${provider.name} attempt ${attempt + 1} threw: ${err.message || err}`);
        lastErr = err;
        // One retry on network errors, then next provider.
        if (attempt < MAX_ATTEMPTS - 1) {
          attempt++;
          await chatSleep(400);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr || new Error('All chat providers exhausted.');
};

// ── OpenRouter streaming helper ─────────────────────────────────────────────
//
// One round-trip to OpenRouter, parsed as Server-Sent Events. Returns:
//   { text: string, toolCalls: [{ id, name, arguments }] }
//
// Why this is split out from the public streamAiReply: agent loops need
// to run this MULTIPLE times — once to find out the model wants a tool,
// once more (after executing the tool) to get the natural-language
// follow-up. Sharing the parser keeps both passes consistent.
//
// `onTextChunk` is called for each non-empty content delta. It is NOT
// called for tool-call deltas — those are accumulated silently and
// surfaced via the return value only after the stream completes. That
// matches what visitors want: "Karo is searching products…" preamble
// text streams live; the JSON arguments of the search itself stay
// invisible.
//
// Tool-call deltas arrive partial across many SSE frames — each delta
// for a given tool index appends to that index's accumulated function
// name + arguments string. We index by `tool_calls[i].index` so out-of-
// order arrival (rare but legal per spec) doesn't corrupt the buffer.
const callOpenRouterStream = async ({ messages, withTools, onTextChunk, signal }) => {
  // Provider chain + retry now lives in `callChatProviderChain` so a
  // transient failure on the primary (Gemini, if GEMINI_API_KEY is set)
  // hands off to OpenRouter automatically. By the time we read the
  // body below, the response is guaranteed to be a 2xx from SOME
  // provider in the chain.
  //
  // The function name stays `callOpenRouterStream` for backward-compat
  // with the agent loop below — it now means "stream a chat reply
  // from whichever provider responded", not specifically OpenRouter.
  const aiResponse = await callChatProviderChain({ messages, withTools, signal });

  const reader = aiResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  /** @type {Map<number, { id: string|null, name: string, arguments: string }>} */
  const toolCallAcc = new Map();

  const flushFrame = (frame) => {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6));
    if (dataLines.length === 0) return false;

    const payload = dataLines.join('\n');
    if (payload === '[DONE]') return true;

    try {
      const parsed = JSON.parse(payload);
      const delta = parsed?.choices?.[0]?.delta;
      if (!delta) return false;

      // 1. Plain text delta → emit to caller + accumulate full text.
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        fullText += delta.content;
        if (onTextChunk) onTextChunk(delta.content);
      }

      // 2. Tool-call delta → accumulate by index.
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          if (typeof tc?.index !== 'number') continue;
          const existing = toolCallAcc.get(tc.index) || { id: null, name: '', arguments: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (typeof tc.function?.arguments === 'string') {
            existing.arguments += tc.function.arguments;
          }
          toolCallAcc.set(tc.index, existing);
        }
      }
    } catch {
      // ignore — keepalive / malformed JSON
    }
    return false;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      let terminated = false;
      for (const frame of frames) {
        if (flushFrame(frame)) {
          terminated = true;
          break;
        }
      }
      if (terminated) break;
    }
  } finally {
    try { reader.releaseLock?.(); } catch { /* node fetch reader is a no-op */ }
  }

  const toolCalls = [];
  // Iterate in index order so multi-tool calls (rare) stay deterministic.
  for (const key of [...toolCallAcc.keys()].sort((a, b) => a - b)) {
    const tc = toolCallAcc.get(key);
    if (!tc || !tc.name) continue;
    toolCalls.push({
      id: tc.id || `call_${Date.now()}_${key}`,
      name: tc.name,
      arguments: tc.arguments,
    });
  }

  return { text: fullText, toolCalls };
};

/**
 * One-line fallback narration in the visitor's language, used ONLY in
 * the rare case where the model emits a `search_products` tool call
 * but no accompanying prose AND the follow-up OpenRouter call fails
 * (network blip, rate-limit, timeout). Lets us still ship the rich
 * product cards with a graceful intro instead of leaving an empty
 * bubble next to the grid. Keys mirror the four UI locales — anything
 * else gets the Arabic copy because Arabic is the primary visitor
 * language at KARAHOCA.
 */
const synthesizeProductIntro = (lang) => {
  switch ((lang || 'ar').toLowerCase()) {
    case 'en': return 'Here are some products that may interest you:';
    case 'tr': return 'İlginizi çekebilecek bazı ürünler:';
    case 'ru': return 'Вот некоторые товары, которые могут вас заинтересовать:';
    case 'ar':
    default:   return 'إليك بعض المنتجات التي قد تهمّك:';
  }
};

// ── Server-side product intent detection ────────────────────────────────────
//
// The "second invocation path" for product cards: instead of relying on the
// LLM to emit `tool_calls` (which the free Gemma 3 default doesn't do
// reliably), we detect product intent on the server BEFORE the model is
// called, run search_products ourselves, and stream the resulting cards
// straight to the visitor via the same `products` SSE event the tool path
// uses. Net effect: cards appear ~50ms after the visitor hits send,
// regardless of which model is configured.
//
// Three steps:
//   1. extractLastUserUtterance(prompt)  — pull the raw question out of
//      the multi-line, knowledge-base-enriched prompt the client builds
//      via `mapKnowledgeToPrompt`. The canonical "Customer Question:"
//      line near the end is the most reliable anchor.
//   2. detectProductIntent(text, lang)   — multilingual keyword scan over
//      brand names, category words, and generic browse phrases. Returns
//      a `{ query, brand, limit }` payload ready for the search_products
//      tool, or `null` if no intent is detected.
//   3. tryPreflightProductSearch(prompt, lang)  — public glue that
//      composes the two above + the existing `executeTool` dispatcher
//      and returns the rich attachments shape the SSE emitter expects.

/**
 * Pull the visitor's actual question out of the enriched prompt the
 * client sends. The client wraps the question with knowledge base
 * sections, history, and a "Customer Question: ..." anchor; we want
 * just the anchor's value. Falls back to the last non-empty line if
 * the anchor isn't present (defensive — future prompt template
 * changes won't break intent detection).
 */
export const extractLastUserUtterance = (prompt) => {
  if (typeof prompt !== 'string') return '';
  const match = prompt.match(/^Customer Question:\s*(.+)$/m);
  if (match && match[1]) return match[1].trim();
  const lines = prompt.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : '';
};

/**
 * Multilingual keyword sets. Coverage focuses on:
 *   - Brand names (DIOX, AYLUX) in Latin and native scripts
 *   - The cleaning categories KARAHOCA actually sells: laundry,
 *     dishwashing, surface cleaners, bathroom, soap/shampoo, bleach,
 *     softener, plus the generic "product / catalogue / sample" words
 *     visitors use when they just want to browse.
 *   - "Show me / what do you have" browse intents that don't name a
 *     specific category.
 *
 * Matching is case-insensitive substring (NOT word-boundary) — Arabic
 * doesn't space-separate inflections (e.g. "والمنظفات" should match
 * "منظف"), and likewise for Turkish suffixes and Russian word stems.
 * Substring matching errs toward false positives, which is the
 * desired bias: a visitor who sees a relevant card without asking is
 * a marginal improvement; a visitor who asks about products and sees
 * NO cards is a regression vs. the tool-call architecture.
 */
const BRAND_KEYWORDS = {
  DIOX: ['diox', 'ديوكس', 'диокс'],
  AYLUX: ['aylux', 'eylüks', 'eyluks', 'أيلوكس', 'إيلوكس', 'илюкс', 'айлюкс'],
};

// Generic browse words — vague "products / catalogue / items" mentions
// that signal the visitor wants to BROWSE rather than ask about any
// specific category. We treat these separately because using them as
// the search query would just dump every product (no name match for
// "منتج" / "products" inside concrete product names) AND the
// word-overlap scorer would return zero hits since these words don't
// appear in product names — net effect: empty result page. The
// correct response for a browse intent is to pass an empty query so
// `search_products` falls into its curated-brand-slice branch.
const GENERIC_BROWSE_KEYWORDS = [
  'product', 'products', 'catalog', 'catalogue', 'item', 'items',
  'منتج', 'منتجات', 'بضاعة', 'كتالوج', 'مواد',
  'ürün', 'urun', 'ürünler', 'urunler', 'katalog',
  'товар', 'продукт', 'продукц', 'каталог',
];

// Specific category words — descriptive product types (laundry,
// dishwashing, soap, …) the visitor uses when they actually know what
// they want. Hitting any of these flips intent into "specific" mode
// where we pass the FULL utterance to the word-overlap scorer and
// promote a primary card. The list is grouped by the cleaning
// categories KARAHOCA actually sells; expand it as the catalogue grows.
const SPECIFIC_CATEGORY_KEYWORDS = [
  // Laundry
  'laundry', 'detergent', 'washing powder', 'washing liquid',
  'غسيل', 'مسحوق', 'منظف الملابس',
  'çamaşır', 'camasir', 'deterjan',
  'стирка', 'стиральн', 'порошок',
  // Dishwashing / kitchen
  'dish', 'dishes', 'dishwashing', 'kitchen', 'plate',
  'صحون', 'أطباق', 'جلي', 'مطبخ',
  'bulaşık', 'bulasik', 'tabak', 'mutfak',
  'посуд', 'кухн',
  // Surface / general cleaner
  'cleaner', 'cleaning', 'all-purpose', 'surface', 'floor',
  'منظف', 'منظفات', 'منظّف', 'تنظيف', 'أرض', 'أرضية', 'سطح',
  'temizleyici', 'temizlik', 'zemin', 'yüzey', 'yuzey',
  'очисти', 'чистящ', 'пол', 'поверхн',
  // Bathroom / toilet
  'bathroom', 'toilet', ' wc',
  'حمام', 'مرحاض',
  'tuvalet', 'banyo',
  'туалет', 'ванн', 'санитар',
  // Soap / shampoo
  'soap', 'shampoo', 'hand wash',
  'صابون', 'شامبو',
  'sabun', 'şampuan', 'sampuan',
  'мыло', 'шампунь',
  // Bleach / softener
  'bleach', 'softener',
  'كلور', 'مبيّض', 'مبيض', 'منعّم', 'منعم',
  'çamaşır suyu', 'yumuşatıcı', 'yumusatici',
  'отбелив', 'хлор', 'кондиционер',
  // Samples / pricing-with-product (pricing alone is excluded — it could
  // be about shipping; but a sample request is unambiguously about products)
  'sample', 'samples',
  'عيّنة', 'عينة', 'عينات',
  'numune', 'örnek',
  'образец',
];

const BROWSE_PATTERNS = [
  /\bwhat (do you|products do you|kind of products) (have|offer|sell|make)/i,
  /\bshow (me|us) (your|the|some)? ?(products|catalog|catalogue)/i,
  /\b(list|browse) (your|the|all) products?/i,
  /ما هي منتجات/,
  /ما لديكم من/,
  /شو عندكم/,
  /وش عندكم/,
  /أرني .{0,15}منتج/,
  /منتج.{0,15}لديكم/,
  /hangi ürünler/i,
  /ne tür ürünler/i,
  /ürünleri göster/i,
  /какие.{0,15}товар/i,
  /какие.{0,15}продукц/i,
  /ассортимент/i,
];

/**
 * Scan a piece of text (usually the visitor's last utterance) for
 * product intent. Returns the payload for search_products if matched,
 * `null` otherwise.
 *
 * Search-query strategy:
 *   1. If a category word matched, use it as the query — the LIKE
 *      pattern in search_products will rank exact matches highest.
 *   2. Else if only a brand matched, pass the empty string + the
 *      brand filter — search_products returns the top N from that
 *      brand by display_order.
 *   3. Else (browse intent only), pass empty string + no brand —
 *      returns the top N overall by display_order.
 *
 * `limit` is hard-coded at 4 to match the visible card grid:
 *   - On desktop the auto-fill grid shows 4 cards in a row at the
 *     typical viewport.
 *   - On mobile the 2-column grid shows 4 cards in two rows without
 *     making the chat scroll for half a screen.
 */
const detectProductIntent = (rawText) => {
  if (typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (text.length === 0) return null;
  const lower = text.toLowerCase();

  let brand = null;
  for (const [b, kws] of Object.entries(BRAND_KEYWORDS)) {
    if (kws.some((kw) => lower.includes(kw))) { brand = b; break; }
  }

  // Specific intent has two evidence sources, EITHER of which is
  // sufficient:
  //
  //   1. Manual SPECIFIC_CATEGORY_KEYWORDS — high-level category words
  //      that aren't literally inside any product name (e.g. "تنظيف" /
  //      "cleaning" — products say "cleaner" not "cleaning"). We need
  //      a curated list for these because the dynamic vocabulary
  //      wouldn't include them.
  //
  //   2. hasProductNameMatch() — checks the visitor's tokens against
  //      a self-updating, Arabic-normalised blob of every active
  //      product name (any language). This covers product types the
  //      manual list might miss: gel, freshener, oven, stain remover,
  //      etc. — plus any product added to the catalogue tomorrow.
  //
  // First-match-wins inside the manual list, so a sentence containing
  // both a generic word AND a specific category (e.g. "أحتاج منتجاً
  // للحمام") still picks the specific one because the manual list
  // doesn't include generics ("منتج" lives in GENERIC_BROWSE_KEYWORDS).
  let manualCategoryHit = null;
  for (const kw of SPECIFIC_CATEGORY_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) { manualCategoryHit = kw.trim(); break; }
  }
  const dynamicHit = !manualCategoryHit && hasProductNameMatch(text);
  const specificHit = Boolean(manualCategoryHit) || dynamicHit;

  const genericHit =
    !specificHit &&
    GENERIC_BROWSE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  const browseHit =
    !specificHit && (genericHit || BROWSE_PATTERNS.some((p) => p.test(text)));

  // ── Negative signals (kill-switches for cards) ─────────────────────
  //
  // Even when a brand or generic word is mentioned, certain question
  // SHAPES are clearly not requests for product cards. Returning
  // cards on those questions clutters the chat ("who are you?" →
  // suddenly 4 product cards). We pattern-match the most common
  // non-product shapes and silently downgrade them to "no intent".
  //
  // Categories of kill-switch:
  //   • Identity questions ("who are you?", "what's your name?")
  //   • Comparisons / explanations between brands ("what's the
  //     difference between DIOX and AYLUX?")
  //   • Company history / about ("when was the company founded?",
  //     "tell me about KARAHOCA")
  //   • Contact / shipping / pricing-only questions
  //   • Greetings ("hello", "good morning", "أهلا")
  const NEGATIVE_PATTERNS = [
    // Identity
    /\b(who are you|what is your name|your name)\b/i,
    /من\s+أنت/u,
    /ما\s+اسم(?:ك|كم)/u,
    /كيف\s+حالك/u,
    /sen\s+kimsin/iu,
    /кто\s+ты/iu,
    // Comparison between brands
    /\bdifference\s+between\b/i,
    /\bcompare\b/i,
    /الفرق\s+بين/u,
    /\bvs\.?\s/i,
    // Company / brand about/history
    /\babout\s+(karahoca|the\s+company|the\s+brand)\b/i,
    /\bwho\s+(is|founded|owns)\b/i,
    /\bcompany\s+history\b/i,
    /\bwhen\s+(was\s+|did\s+).*\b(founded|established|started)\b/i,
    /(عن|من|أين)\s+(الشركة|كاراهوكا|كاراخوكا|قره\s*خوجة)/u,
    /(تاريخ|قصة|متى\s+تأسس(?:ت)?)\s/u,
    /كم\s+(عمر|سنة)/u,
    // Greetings only
    /^\s*(hi|hello|hey|good\s+(morning|evening|afternoon))[\s!.,?]*$/i,
    /^\s*(مرحبا|أهلا|أهلًا|السلام\s+عليكم|صباح\s+الخير|مساء\s+الخير)[\s!.,؟?]*$/u,
    /^\s*(merhaba|selam)[\s!.,?]*$/iu,
    /^\s*(привет|здравствуйте)[\s!.,?]*$/iu,
    // Shipping / contact / pricing without a product hook
    /\b(shipping|delivery|payment|contact|email|phone|whatsapp)\b/i,
    /(شحن|توصيل|دفع|تواصل|بريد|هاتف|واتساب)/u,
  ];

  const isNegativeShape = NEGATIVE_PATTERNS.some((p) => p.test(text));

  // Brand alone is no longer enough — a question that just mentions
  // DIOX/AYLUX without ANY product/browse signal is almost certainly
  // about the brand itself (history, comparison, identity) and not a
  // request for cards. We require category, browse intent, or a
  // generic-browse keyword that's NOT killed by a negative shape.
  if (isNegativeShape) return null;
  if (!specificHit && !browseHit) return null;

  // Query strategy:
  //   - SPECIFIC question ("مسحوق غسيل عادي", "معطّر هواء", "مزيل بقع"):
  //     pass the FULL utterance so the multi-token overlap scorer in
  //     search_products can reward products matching multiple words
  //     and pick a clear "primary" winner. The scorer ALSO normalises
  //     Arabic on its side, so diacritic differences between the
  //     visitor's spelling and the catalogue's spelling don't matter.
  //   - Browse-only ("ما هي منتجاتكم؟"): pass an empty query and let
  //     the empty-query branch in search_products return a curated
  //     brand slice (top-N by display_order). Brand filter still
  //     applies if the visitor mentioned one.
  return {
    query: specificHit ? text : '',
    brand,
    limit: 4,
  };
};

/**
 * Public glue: extract the visitor's utterance, classify intent, and
 * if matched, run search_products against the live DB and return the
 * resulting attachments shape. Returns `{ products: [] }` when no
 * intent is detected so callers can branch on length without
 * null-checking.
 *
 * Caller use cases:
 *   - `streamAiReply` calls this BEFORE the first OpenRouter request
 *     so cards stream to the visitor before the first model token.
 *   - The cache-hit branch in `api-chat` calls this so cached replies
 *     ALSO get fresh product cards (the cache only stores text).
 */
export const tryPreflightProductSearch = (prompt, lang) => {
  try {
    const utterance = extractLastUserUtterance(prompt);
    const intent = detectProductIntent(utterance);
    if (!intent) return { products: [] };
    const out = executeTool(
      'search_products',
      JSON.stringify(intent),
      lang || 'ar',
    );
    const products = out?.attachments?.products;
    if (Array.isArray(products) && products.length > 0) {
      return { products };
    }
    return { products: [] };
  } catch (err) {
    logger.error('[ai-chat] preflight product search failed:', err.message || err);
    return { products: [] };
  }
};

/**
 * Build the directive note that gets appended to SYSTEM_PROMPT for the
 * one turn where we've pre-emitted product cards. Tells the model:
 * "the visitor can already SEE these products as visual cards — narrate
 * around them, don't re-list them." Written in English because the
 * SYSTEM_PROMPT is in English and multilingual LLMs follow English
 * directives reliably even while replying in another language.
 */
const buildPreEmittedProductNote = (products) => {
  const summary = products
    .slice(0, 5)
    .map((p) => `${p.brand} ${p.name}`)
    .join(', ');
  return [
    '[INTERNAL DIRECTIVE FOR THIS TURN — do not reveal to visitor]',
    `The frontend has already rendered interactive product cards for: ${summary}.`,
    'The visitor sees each card visually with image, name, brand, weight,',
    'a "View product" link, and an "Ask on WhatsApp" button.',
    '',
    'Therefore in your reply:',
    "- Reference these products naturally in your prose (e.g. \"the DIOX",
    '  laundry powder 9 kg is ideal for...\"), and explain what makes',
    "  each one suitable for the visitor's situation.",
    '- Do NOT enumerate them as a bulleted list — the cards ARE the list.',
    '- Do NOT include their direct URLs — the cards have buttons.',
    '- Still end with the brand catalogue link as the main system',
    '  prompt instructs.',
  ].join('\n');
};

/**
 * De-duplicate a product list by id while preserving order. Used at the
 * return seam of streamAiReply so a paid tool-capable model that
 * happens to call search_products with overlapping results doesn't
 * cause double cards on the frontend.
 */
const dedupProductsById = (products) => {
  const seen = new Set();
  const out = [];
  for (const p of products) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
};

/**
 * Stream a reply token-by-token from OpenRouter, with an agent loop on top
 * of the raw streaming helper so Karo can call tools (search_products,
 * etc.) and integrate the results back into a natural-language reply.
 *
 * Flow:
 *   1. First pass: send messages + tools → OpenRouter.
 *      - If the model just generates text → relay via onChunk, return.
 *      - If the model emits tool_calls → execute each, send results
 *        back as `role: tool` messages, then do a SECOND streaming pass
 *        (no tools this time — we want a natural-language summary, not
 *        another tool call) and relay that.
 *   2. Each executed tool also fires the `onToolCall` callback so the
 *      route handler can emit an SSE 'products' event carrying the
 *      attachment payload for the frontend to render as cards. The
 *      callback is best-effort — exceptions in user code don't break
 *      the stream.
 *
 * Limit: at most ONE round of tool calls per turn. A second round
 * would imply the model is treating the tool as a multi-step interpreter,
 * which our tools (a single search_products) don't justify; we'd rather
 * the model summarise what it has than spin in a tool-call loop.
 *
 * Aborts: pass an AbortSignal in `signal`; both fetch + reader honour
 * it and propagate as an AbortError, which the caller should swallow
 * silently (the client closed the chat).
 */
export const streamAiReply = async ({ prompt, lang, history, onChunk, onToolCall, signal }) => {
  // At least ONE of (GEMINI_API_KEY, OPENROUTER_API_KEY) must be set —
  // otherwise we have no provider to route the chat through. The
  // detailed error message points the operator at both options so
  // they pick whichever fits the ops setup.
  if (CHAT_PROVIDERS.length === 0) {
    const error = new Error(
      'No chat provider configured. Set GEMINI_API_KEY (free Google AI Studio) '
      + 'and/or OPENROUTER_API_KEY on the server.',
    );
    error.statusCode = 500;
    throw error;
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    const error = new Error('Prompt is required.');
    error.statusCode = 400;
    throw error;
  }

  // ── Pre-flight: server-side product intent + retrieval ──────────────
  //
  // Why this exists: the default model (Gemma 3) does NOT reliably emit
  // tool_calls on OpenRouter, so the LLM-driven product-card path stays
  // dormant in production. To get rich cards on EVERY model regardless
  // of tool-calling support, we do our own retrieval here based on a
  // multilingual keyword scan of the visitor's question. If intent is
  // detected, we run search_products synchronously and surface the
  // products via the same `onToolCall` callback the LLM-tool path uses.
  // The route handler in turn emits a `products` SSE event, so the
  // frontend renders cards within ~50 ms of the request hitting the
  // server — usually BEFORE the first model token arrives.
  //
  // The `serverEmittedProducts` flag also disables tools on the first
  // pass so a paid tool-capable model doesn't redundantly call
  // search_products and double-emit cards.
  const preflightProducts = tryPreflightProductSearch(prompt, lang).products;
  if (preflightProducts.length > 0 && onToolCall) {
    try {
      onToolCall({
        name: 'search_products',
        args: '__server_intent__',
        attachments: { products: preflightProducts },
      });
    } catch (cbErr) {
      logger.error('[ai-chat] preflight onToolCall callback error:', cbErr.message || cbErr);
    }
  }

  // Conditional directive: only added when we DID pre-emit cards. Tells
  // the model the visitor can already see them, so the prose should be
  // narrative not enumerative.
  const systemContent = preflightProducts.length > 0
    ? `${SYSTEM_PROMPT}\n\n${buildPreEmittedProductNote(preflightProducts)}`
    : SYSTEM_PROMPT;

  const messages = [
    { role: 'system', content: systemContent },
    ...buildHistoryMessages(history, prompt),
    { role: 'user', content: buildDynamicContext(prompt, lang) },
  ];

  // Top-level accumulator so BOTH return paths (no-tool-call and
  // tool-call) can include the pre-emitted products in the final
  // attachments payload the client reconciles on the `done` event.
  const aggregatedAttachments = { products: [...preflightProducts] };

  // ── First pass ────────────────────────────────────────────────────────
  //
  // Tools are ALWAYS DISABLED for the model. Server-side
  // `tryPreflightProductSearch` is the SOLE authority on whether
  // product cards appear. Why this trade-off:
  //
  //   • We previously enabled tools whenever the preflight returned
  //     nothing, as a fallback for "questions our keyword scan
  //     missed". Worked fine on Gemma (which doesn't fire tools
  //     anyway). When we added Gemini 2.0 Flash as the primary
  //     provider, Gemini's much more aggressive tool-calling
  //     behaviour started attaching product cards to identity
  //     questions ("who are you?"), brand-comparison questions
  //     ("difference between DIOX and AYLUX?"), and other non-
  //     product turns. Visitors got cards they never asked for.
  //
  //   • Tightening the SYSTEM_PROMPT helped but Gemini still
  //     over-fires. The model treats the tool schema's presence as
  //     "this is available — use it if remotely relevant", and a
  //     brand name being mentioned in passing counts as "remotely
  //     relevant" by its standard.
  //
  //   • The deterministic preflight (intent regex + product-name
  //     dynamic match + negative kill-switches) is auditable, gives
  //     identical behaviour on Gemma and Gemini, and is easy to
  //     extend with new patterns when a real product question slips
  //     through. We trust IT, not the model.
  //
  // Net result: model receives the messages with NO `tools` array,
  // cannot emit `tool_calls`, and only narrates the answer. Cards
  // (if any) come exclusively from the preflight that already ran
  // above. The agent loop below remains in place for the rare case
  // where a future config explicitly re-enables tools — but the
  // default path never enters it.
  const first = await callOpenRouterStream({
    messages,
    withTools: false,
    onTextChunk: onChunk,
    signal,
  });

  // No tool calls? We're done — the first pass IS the final answer.
  if (first.toolCalls.length === 0) {
    if (!first.text) {
      // Empty model output but we DID pre-emit cards: synth a graceful
      // one-liner so the visitor sees an intro line above the grid
      // instead of a blank bubble.
      if (aggregatedAttachments.products.length > 0) {
        const fallback = synthesizeProductIntro(lang);
        if (onChunk) {
          try { onChunk(fallback); } catch { /* relay best-effort */ }
        }
        return {
          success: true,
          reply: fallback,
          attachments: { products: dedupProductsById(aggregatedAttachments.products) },
        };
      }
      const error = new Error('AI model returned an empty response.');
      error.statusCode = 502;
      throw error;
    }
    return {
      success: true,
      reply: first.text,
      attachments: aggregatedAttachments.products.length > 0
        ? { products: dedupProductsById(aggregatedAttachments.products) }
        : {},
    };
  }

  // ── Tool execution + second pass ──────────────────────────────────────
  //
  // The model emitted tool calls. Execute each, capture attachments
  // (rich product objects for frontend cards), and build the message
  // payload the model needs to see for its follow-up.
  //
  // OpenAI spec: the assistant turn that emitted tool_calls must be
  // included in the message history of the follow-up call, paired with
  // matching `role: tool` messages keyed by `tool_call_id`. We mirror
  // the spec exactly so OpenRouter (and any OpenAI-compatible backend)
  // is happy.

  const toolCallMessageEntries = first.toolCalls.map((tc) => ({
    id: tc.id,
    type: 'function',
    function: { name: tc.name, arguments: tc.arguments || '{}' },
  }));

  messages.push({
    role: 'assistant',
    content: first.text || null,
    tool_calls: toolCallMessageEntries,
  });

  for (const tc of first.toolCalls) {
    const { result, attachments } = executeTool(tc.name, tc.arguments, lang) || {};
    const resultStr = JSON.stringify(result ?? { error: 'No result' });

    messages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: resultStr,
    });

    // Surface to the route handler so it can emit a 'products' SSE event.
    if (attachments?.products?.length) {
      aggregatedAttachments.products.push(...attachments.products);
    }
    if (onToolCall) {
      try {
        onToolCall({ name: tc.name, args: tc.arguments, attachments: attachments || {} });
      } catch (cbErr) {
        logger.error('[ai-chat] onToolCall callback error:', cbErr.message || cbErr);
      }
    }
  }

  // Second pass: no tools (we want a summary, not another tool round).
  // We KEEP onChunk so the natural-language follow-up still streams to
  // the visitor.
  //
  // Resilience: if this second call fails (network blip, OpenRouter
  // rate-limit, model timeout, etc.) we DON'T want to nuke the whole
  // reply — the tool already executed successfully and the visitor is
  // about to see real product cards. Catch the error, log it, and fall
  // back to whatever text we gathered in the first pass. Genuine
  // cancellations (AbortError) still propagate because the visitor
  // closed the chat — pretending to succeed would be misleading.
  let second;
  try {
    second = await callOpenRouterStream({
      messages,
      withTools: false,
      onTextChunk: onChunk,
      signal,
    });
  } catch (followupErr) {
    if (followupErr?.name === 'AbortError') throw followupErr;
    logger.error(
      '[ai-chat] follow-up call after tool execution failed; falling back to first-pass text:',
      followupErr.message || followupErr,
    );
    second = { text: '', toolCalls: [] };
  }

  // Some models emit ALL text in the first pass before the tool call;
  // others wait until after. Concatenate both so the cached reply +
  // the final returned text reflect the visitor's full experience.
  let combinedText = (first.text ? first.text + '\n\n' : '') + second.text;

  // Empty-prose recovery: if NEITHER pass produced text but the tool
  // DID return products, synthesize a one-line narration so the visitor
  // doesn't see an empty bubble next to the cards. We stream it through
  // onChunk so the live UI updates the same way it does for normal
  // output — without this, the bubble would stay blank during the
  // stream and only populate when the 'done' event arrives.
  if (!combinedText.trim() && aggregatedAttachments.products.length > 0) {
    const fallback = synthesizeProductIntro(lang);
    if (onChunk) {
      try { onChunk(fallback); } catch { /* relay best-effort */ }
    }
    combinedText = fallback;
  }

  if (!combinedText.trim()) {
    const error = new Error('AI model returned an empty response after tool execution.');
    error.statusCode = 502;
    throw error;
  }

  return {
    success: true,
    reply: combinedText,
    attachments: { products: dedupProductsById(aggregatedAttachments.products) },
  };
};

/**
 * Non-streaming wrapper around `streamAiReply` — kept as a thin delegate so
 * existing callers (e.g. server-side cache pre-warm scripts, future test
 * harnesses) don't need to set up an `onChunk` handler. The body is exactly
 * the same network call; we just don't relay deltas to anyone.
 */
export const generateAiReply = async ({ prompt, lang, history }) => {
  return streamAiReply({ prompt, lang, history });
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
