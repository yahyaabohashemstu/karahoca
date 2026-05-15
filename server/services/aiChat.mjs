import { cacheGet, cacheSet } from '../redisClient.mjs';
import { buildProductContext, buildCustomQAContext } from '../routes/admin-ai-knowledge.mjs';
import { logger } from '../utils/logger.mjs';
import { TOOLS, executeTool } from './aiTools.mjs';

const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Which OpenRouter model Karo talks to.
 *
 * Configurable via the `OPENROUTER_MODEL` env var so ops can swap models
 * without a code change. The default — `google/gemma-3-27b-it` — is the
 * free tier that's been running since the original Karo launch; it
 * produces excellent Arabic and serves the catalogue well via the
 * baked-in product context.
 *
 * ── Why you might switch ─────────────────────────────────────────────
 * Gemma 3 on OpenRouter does NOT reliably emit `tool_calls` (the
 * function-calling API). The chat still works fine — the model
 * answers from the product catalogue text the server injects into
 * each user message — but the inline product cards introduced in
 * Phase 4 of the AI overhaul will NOT render because no tool is
 * actually invoked. The agent loop in `streamAiReply` detects this
 * (toolCalls.length === 0) and returns the streamed text as-is.
 *
 * For visitors to see the rich product cards, set
 * OPENROUTER_MODEL to a tool-capable model. Verified options as of
 * 2026-05:
 *
 *   google/gemini-2.0-flash-001   ~$10/mo @ 100 chats/day  (recommended)
 *   anthropic/claude-3-haiku       ~$90/mo
 *   openai/gpt-4o-mini             ~$16/mo
 *   meta-llama/llama-3.3-70b-instruct  free tier (check availability)
 *
 * The env var is read once at module load, so flipping it requires a
 * server restart (karahoca-api → Redeploy on Coolify).
 */
const AI_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it';

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
  'TOOLS YOU CAN USE:',
  '- `search_products(query, brand?, limit?)` — search the LIVE catalogue.',
  '  CALL THIS whenever the customer asks about specific products,',
  '  mentions a category (laundry, dishwashing, cleaner, etc.), or asks',
  '  "what do you have?" / "ما هي منتجاتكم؟" / similar. The tool returns',
  '  real product data from the SQLite catalogue — vastly more reliable',
  '  than recalling from your prompt context. After the tool returns,',
  '  weave the product names into a natural-language summary in the',
  '  customer\'s language. Do NOT enumerate raw URLs or IDs from the',
  '  tool result — the frontend renders rich cards from the data; you',
  '  just narrate.',
  '- If the customer asks a general question that does NOT need product',
  '  data (greeting, shipping, contact, company history), respond',
  '  directly without calling the tool.',
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
  const body = {
    model: AI_MODEL,
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

  const aiResponse = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openrouterApiKey}`,
      'HTTP-Referer': 'https://karahoca.com',
      'X-OpenRouter-Title': 'KARAHOCA AI Assistant',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!aiResponse.ok) {
    const rawError = await aiResponse.text();
    logger.error(`[ai-chat] OpenRouter HTTP ${aiResponse.status}:`, rawError.slice(0, 300));
    const error = new Error(rawError || 'AI request failed (' + aiResponse.status + ').');
    error.statusCode = aiResponse.status;
    throw error;
  }

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

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...buildHistoryMessages(history, prompt),
    { role: 'user', content: buildDynamicContext(prompt, lang) },
  ];

  // ── First pass: with tools ────────────────────────────────────────────
  const first = await callOpenRouterStream({
    messages,
    withTools: true,
    onTextChunk: onChunk,
    signal,
  });

  // No tool calls? We're done — the first pass IS the final answer.
  if (first.toolCalls.length === 0) {
    if (!first.text) {
      const error = new Error('AI model returned an empty response.');
      error.statusCode = 502;
      throw error;
    }
    return { success: true, reply: first.text, attachments: {} };
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
  const aggregatedAttachments = { products: [] };

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
    attachments: aggregatedAttachments,
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
