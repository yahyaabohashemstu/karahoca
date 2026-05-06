import { logger } from '../utils/logger.mjs';

/**
 * Fix unescaped literal newlines inside JSON string values.
 *
 * LLMs sometimes return real `\n` characters inside string values instead
 * of `\\n`, making `JSON.parse` throw. This parser walks the response
 * character-by-character, tracking whether we're inside a string, and
 * escapes any literal newline / carriage-return / tab it finds inside one.
 */
function fixUnescapedNewlinesInJson(str) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; result += ch; continue; }
    if (ch === '\\') { escaped = true; result += ch; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString && ch === '\n') { result += '\\n'; continue; }
    if (inString && ch === '\r') { result += '\\r'; continue; }
    if (inString && ch === '\t') { result += '\\t'; continue; }
    result += ch;
  }
  return result;
}

// ─── OpenRouter model fallback chain ─────────────────────────────────────────
// All requests go through OpenRouter (https://openrouter.ai). If the primary
// model is overloaded (503), rate-limited (429), or otherwise returns an
// error, we automatically fall through to the next model.
//
// Order rationale: gemma-3-27b-it first because it matches the AI chat
// model used elsewhere on the server (consistent quality + a single
// well-understood model). The two fallbacks are open-weights models that
// OpenRouter routes to whichever provider is currently healthy.
const OPENROUTER_MODELS = [
  'google/gemma-3-27b-it',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-nemo',
];

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Exponential-backoff delays between retries (ms)
const RETRY_DELAYS = [1_000, 3_000, 7_000]; // 1 s, 3 s, 7 s

const TIMEOUT_MS = 30_000; // 30 s per attempt

/**
 * Single attempt: call one OpenRouter model with a 30-second AbortController
 * timeout. Returns the fetch Response (may not be ok).
 */
async function callOpenRouter(apiKey, model, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // Optional but recommended by OpenRouter so usage is attributable.
        'HTTP-Referer': process.env.SITE_URL || 'https://karahoca.com',
        'X-Title': 'KARAHOCA Admin Translator',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 8192,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Try every model in OPENROUTER_MODELS, each with up to RETRY_DELAYS.length
 * retries. Only retries on 503 (overloaded) and 429 (rate-limited). For any
 * other HTTP error, skips to the next model immediately. Returns the
 * successful fetch Response on success. Throws a descriptive Error if all
 * models and retries are exhausted.
 */
async function callOpenRouterWithRetry(apiKey, prompt) {
  const log = [];

  for (const model of OPENROUTER_MODELS) {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1];
        logger.info(`[translate] ${model} attempt ${attempt + 1} — waiting ${delay}ms`);
        await sleep(delay);
      }

      try {
        const res = await callOpenRouter(apiKey, model, prompt);

        if (res.ok) {
          if (attempt > 0 || model !== OPENROUTER_MODELS[0]) {
            logger.info(`[translate] success with ${model} on attempt ${attempt + 1}`);
          }
          return res; // ✅ done
        }

        const status = res.status;
        const errText = await res.text();
        log.push({ model, attempt, status, errText: errText.slice(0, 200) });
        logger.warn(`[translate] ${model} attempt ${attempt + 1} → HTTP ${status}`);

        // Retriable errors: overloaded (503) or rate-limited (429).
        if (status === 503 || status === 429) {
          continue; // retry same model with delay
        }

        // Non-retriable error for this model → try next model.
        break;

      } catch (err) {
        log.push({ model, attempt, error: err.message });
        logger.warn(`[translate] ${model} attempt ${attempt + 1} threw: ${err.message}`);

        // Timeout (AbortError) → skip to next model immediately.
        if (err.name === 'AbortError') break;

        // Network error → retry.
        continue;
      }
    }
  }

  logger.error('[translate] all models exhausted:', JSON.stringify(log));
  throw new Error(
    'خدمة الترجمة مشغولة حالياً. يرجى المحاولة مرة أخرى بعد لحظات. ' +
    '(OpenRouter translation service temporarily unavailable after retries on all models.)'
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handleAdminTranslate = async (req, res, { body, sendJson, origin }) => {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';

  if (!openrouterApiKey) {
    sendJson(res, 500, { success: false, error: 'OPENROUTER_API_KEY is not configured.' }, origin);
    return;
  }

  const { text, sourceLang = 'ar', fields } = body;

  // Build field list using a unique separator so multi-line body content
  // doesn't confuse the model.
  const FIELD_SEP = '\n<<<NEXT_FIELD>>>\n';
  const textToTranslate = fields
    ? Object.entries(fields)
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => `[${k}]: ${String(v).trim()}`)
        .join(FIELD_SEP)
    : text;

  if (!textToTranslate || typeof textToTranslate !== 'string' || !textToTranslate.trim()) {
    sendJson(res, 400, { success: false, error: 'Text or fields required.' }, origin);
    return;
  }

  const langNames = { ar: 'العربية', en: 'English', tr: 'Türkçe', ru: 'Русский' };

  // Brand-name rules injected into every prompt.
  const BRAND_RULES = `
BRAND NAME RULES (must be followed exactly per language):
- In Arabic (ar):  "ديوكس" → "ديوكس"  |  "آيلوكس"/"ايلوكس" → "آيلوكس"
- In English (en): "ديوكس" → "DIOX"    |  "آيلوكس"/"ايلوكس" → "AYLUX"
- In Turkish (tr): "ديوكس" → "DIOX"    |  "آيلوكس"/"ايلوكس" → "AYLUX"
- In Russian (ru): "ديوكس" → "DIOX"    |  "آيلوكس"/"ايلوكس" → "AYLUX"`;

  const prompt = fields
    ? `You are a professional translator for KARAHOCA cleaning products company.

Translate each labeled field below from ${langNames[sourceLang] || sourceLang} to Arabic (ar), English (en), Turkish (tr), and Russian (ru).
Fields are separated by <<<NEXT_FIELD>>> markers. Keep the [fieldname] labels exactly as they appear.
${BRAND_RULES}

CRITICAL JSON RULES:
- Return ONLY a raw JSON object — no markdown fences, no explanation, no extra text.
- All string values must be on a single line. If the original text has paragraph breaks, represent them as \\n\\n (escaped) NOT as literal newlines.
- Never put literal line-break characters inside a JSON string value.

Input:
${textToTranslate}

Required output structure:
{
  "ar": { "field1": "...", "field2": "..." },
  "en": { "field1": "...", "field2": "..." },
  "tr": { "field1": "...", "field2": "..." },
  "ru": { "field1": "...", "field2": "..." }
}`
    : `You are a professional translator for KARAHOCA cleaning products company.

Translate the following text from ${langNames[sourceLang] || sourceLang} to all four languages.
Use natural, commercial language.
${BRAND_RULES}

CRITICAL: Return ONLY a raw JSON object (no markdown, no explanation). Use \\n for newlines inside strings.

Text: "${textToTranslate}"

{"ar":"...","en":"...","tr":"...","ru":"..."}`;

  try {
    // ── Call OpenRouter with automatic retry + model fallback ──────────────
    const response = await callOpenRouterWithRetry(openrouterApiKey, prompt);

    const payload = await response.json();
    // OpenRouter / OpenAI-compatible response shape.
    const rawText = payload?.choices?.[0]?.message?.content?.trim();

    if (!rawText) {
      sendJson(res, 502, { success: false, error: 'Empty response from translation service.' }, origin);
      return;
    }

    // Strip markdown code fences if the model wrapped the JSON anyway.
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Attempt 1: parse as-is.
    try {
      const translations = JSON.parse(cleaned);
      sendJson(res, 200, { success: true, translations }, origin);
      return;
    } catch { /* fall through */ }

    // Attempt 2: fix unescaped newlines/tabs inside string values then parse.
    try {
      const fixed = fixUnescapedNewlinesInJson(cleaned);
      const translations = JSON.parse(fixed);
      sendJson(res, 200, { success: true, translations }, origin);
      return;
    } catch { /* fall through */ }

    sendJson(res, 502, { success: false, error: 'Failed to parse translation response.' }, origin);

  } catch (err) {
    // callOpenRouterWithRetry throws a descriptive, user-friendly message.
    sendJson(res, 503, { success: false, error: err.message }, origin);
  }
};
