/**
 * Fix unescaped literal newlines inside JSON string values.
 * Gemini sometimes returns real \n chars inside strings instead of \\n,
 * making JSON.parse throw. This parser handles it character-by-character.
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

// ─── Gemini model fallback chain ─────────────────────────────────────────────
// If the primary model is overloaded (503) or rate-limited (429),
// we automatically fall through to the next model.
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Exponential-backoff delays between retries (ms)
const RETRY_DELAYS = [1_000, 3_000, 7_000]; // 1 s, 3 s, 7 s

const TIMEOUT_MS = 30_000; // 30 s per attempt

/**
 * Single attempt: call one Gemini model with a 30-second AbortController timeout.
 * Returns the fetch Response (may not be ok).
 */
async function callGemini(apiKey, model, prompt) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
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
 * Try every model in GEMINI_MODELS, each with up to RETRY_DELAYS.length retries.
 * Only retries on 503 (overloaded) and 429 (rate-limited).
 * For any other HTTP error, skips to the next model immediately.
 * Returns the successful fetch Response on success.
 * Throws a descriptive Error if all models and retries are exhausted.
 */
async function callGeminiWithRetry(apiKey, prompt) {
  const log = [];

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.log(`[translate] ${model} attempt ${attempt + 1} — waiting ${delay}ms`);
        await sleep(delay);
      }

      try {
        const res = await callGemini(apiKey, model, prompt);

        if (res.ok) {
          if (attempt > 0 || model !== GEMINI_MODELS[0]) {
            console.log(`[translate] success with ${model} on attempt ${attempt + 1}`);
          }
          return res; // ✅ done
        }

        const status = res.status;
        const errText = await res.text();
        log.push({ model, attempt, status, errText: errText.slice(0, 200) });
        console.warn(`[translate] ${model} attempt ${attempt + 1} → HTTP ${status}`);

        // Retriable errors: overloaded (503) or rate-limited (429)
        if (status === 503 || status === 429) {
          continue; // retry same model with delay
        }

        // Non-retriable error for this model → try next model
        break;

      } catch (err) {
        log.push({ model, attempt, error: err.message });
        console.warn(`[translate] ${model} attempt ${attempt + 1} threw: ${err.message}`);

        // Timeout (AbortError) → skip to next model immediately
        if (err.name === 'AbortError') break;

        // Network error → retry
        continue;
      }
    }
  }

  console.error('[translate] all models exhausted:', JSON.stringify(log));
  throw new Error(
    'خدمة الترجمة مشغولة حالياً. يرجى المحاولة مرة أخرى بعد لحظات. ' +
    '(Gemini service temporarily unavailable after retries on all models.)'
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handleAdminTranslate = async (req, res, { body, sendJson, origin }) => {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  if (!geminiApiKey) {
    sendJson(res, 500, { success: false, error: 'GEMINI_API_KEY is not configured.' }, origin);
    return;
  }

  const { text, sourceLang = 'ar', fields } = body;

  // Build field list using a unique separator so multi-line body doesn't confuse Gemini
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

  // Brand-name rules injected into every prompt
  const BRAND_RULES = `
BRAND NAME RULES (apply in ALL languages without exception):
- "ديوكس" → always write "DIOX" (never translate or transliterate)
- "آيلوكس" or "ايلوكس" → always write "AYLUX" (never translate or transliterate)`;

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
    // ── Call Gemini with automatic retry + model fallback ──────────────────
    const response = await callGeminiWithRetry(geminiApiKey, prompt);

    const payload = await response.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      sendJson(res, 502, { success: false, error: 'Empty response from Gemini.' }, origin);
      return;
    }

    // Strip markdown code fences if Gemini wrapped the JSON anyway
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Attempt 1: parse as-is
    try {
      const translations = JSON.parse(cleaned);
      sendJson(res, 200, { success: true, translations }, origin);
      return;
    } catch { /* fall through */ }

    // Attempt 2: fix unescaped newlines/tabs inside string values then parse
    try {
      const fixed = fixUnescapedNewlinesInJson(cleaned);
      const translations = JSON.parse(fixed);
      sendJson(res, 200, { success: true, translations }, origin);
      return;
    } catch { /* fall through */ }

    sendJson(res, 502, { success: false, error: 'Failed to parse translation response.' }, origin);

  } catch (err) {
    // callGeminiWithRetry throws a descriptive, user-friendly message
    sendJson(res, 503, { success: false, error: err.message }, origin);
  }
};
