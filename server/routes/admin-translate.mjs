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

// ─── Response shape normalisation ─────────────────────────────────────────────
//
// Even with an explicit schema in the prompt, OpenRouter-routed models
// occasionally drift on the JSON keys: they may wrap field names in
// `[brackets]` (echoing the older input format), capitalise language
// keys ("Arabic", "EN"), or spell them in their native script
// ("العربية"). The frontend pipeline assumes lowercase two-letter
// codes + exact field names verbatim, so anything else silently
// produces a `{}` after the field-first transform and the EN/TR/RU
// tabs stay blank with a misleading "✓ تمت الترجمة" badge.
//
// We canonicalise here so the FE only ever sees the shape it expects.

const LANG_CODE_ALIASES = {
  // English aliases
  ar: 'ar', arabic: 'ar', 'العربية': 'ar', العربية: 'ar', العربيه: 'ar',
  en: 'en', english: 'en', eng: 'en', الانجليزية: 'en', الإنجليزية: 'en',
  tr: 'tr', turkish: 'tr', türkçe: 'tr', turkce: 'tr', التركية: 'tr',
  ru: 'ru', russian: 'ru', русский: 'ru', russkij: 'ru', الروسية: 'ru',
};

/**
 * Normalise a language key the model emitted to the canonical
 * lowercase 2-letter code. Returns `null` when the key is
 * unrecognisable so callers can drop it cleanly.
 */
const canonicaliseLangKey = (raw) => {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (LANG_CODE_ALIASES[key]) return LANG_CODE_ALIASES[key];
  // Last resort: many emissions use `ar-SA` / `en_US` etc. Take the
  // leading 2 letters.
  const short = key.slice(0, 2);
  if (['ar', 'en', 'tr', 'ru'].includes(short)) return short;
  return null;
};

/**
 * Normalise a field key the model emitted to match one of the field
 * names the caller asked for. Handles `[subject]`, `"subject "`, and
 * case differences. Returns the matched ORIGINAL field name (preserving
 * the caller's casing) so the FE's lookups by exact key still work.
 */
const canonicaliseFieldKey = (raw, requestedFields) => {
  if (typeof raw !== 'string') return null;
  // Strip any surrounding [brackets], whitespace, then lowercase for
  // a forgiving lookup. Use the ORIGINAL caller's key on success so
  // case preserves (e.g. requested 'Subject' → output 'Subject').
  const normalised = raw.replace(/^\[+|\]+$/g, '').trim().toLowerCase();
  for (const req of requestedFields) {
    if (req.toLowerCase() === normalised) return req;
  }
  return null;
};

/**
 * Walk the model's parsed JSON and rebuild it into the strict
 * `{ ar: { field1: ... }, en: ... }` shape the FE expects. Drops
 * anything that can't be canonicalised. Returns null if NOTHING was
 * salvageable — the caller can then return a real error to the FE
 * instead of a misleading-success-with-empty-strings.
 */
const normaliseTranslationsShape = (raw, requestedFields) => {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  // Allow a top-level "translations" wrapper that some models emit.
  const root = (raw.translations && typeof raw.translations === 'object')
    ? raw.translations
    : raw;

  for (const [langKey, langValue] of Object.entries(root)) {
    const lang = canonicaliseLangKey(langKey);
    if (!lang) continue;
    // Each language value should be an object of field → translated string.
    if (!langValue || typeof langValue !== 'object' || Array.isArray(langValue)) continue;
    const langBucket = {};
    for (const [fieldKey, fieldValue] of Object.entries(langValue)) {
      const canonField = requestedFields.length === 0
        ? fieldKey.replace(/^\[+|\]+$/g, '').trim()
        : canonicaliseFieldKey(fieldKey, requestedFields);
      if (!canonField) continue;
      if (typeof fieldValue !== 'string') continue;
      langBucket[canonField] = fieldValue;
    }
    if (Object.keys(langBucket).length > 0) out[lang] = langBucket;
  }

  // Refuse if NOTHING came through — the badge "✓ تمت الترجمة" with empty
  // fields is worse than a clear error message.
  if (Object.keys(out).length === 0) return null;
  return out;
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handleAdminTranslate = async (req, res, { body, sendJson, origin }) => {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';

  if (!openrouterApiKey) {
    sendJson(res, 500, { success: false, error: 'OPENROUTER_API_KEY is not configured.' }, origin);
    return;
  }

  const { text, sourceLang = 'ar', fields } = body;

  // Resolve the list of field names we'll send to the model — same set the
  // FE expects back. Filtering out empty values keeps the schema example
  // concise and stops the model from inventing translations for blank
  // inputs.
  const fieldNames = fields
    ? Object.keys(fields).filter((k) => fields[k] && String(fields[k]).trim())
    : [];

  if (fields && fieldNames.length === 0) {
    sendJson(res, 400, { success: false, error: 'No non-empty fields to translate.' }, origin);
    return;
  }

  if (!fields && (typeof text !== 'string' || !text.trim())) {
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

  // Build a CONCRETE schema example that embeds the actual field names the
  // caller asked for. Previously the schema was `{ "ar": { "field1": ... } }`
  // (placeholder names) and the input wrapped each value with `[brackets]`,
  // which led some models to either keep the brackets in the JSON keys
  // (`"[subject]"`) or use the placeholder names verbatim (`"field1"`).
  // Either way the FE's `translations.subject?.ar` lookup came back
  // `undefined` and the EN/TR/RU tabs stayed blank.
  //
  // Concrete example shape:
  //   {
  //     "ar": { "subject": "...", "body": "..." },
  //     "en": { "subject": "...", "body": "..." },
  //     ...
  //   }
  const schemaForFields = (fieldList) => {
    const fieldEntries = fieldList.map((f) => `"${f}": "..."`).join(', ');
    return [
      '{',
      `  "ar": { ${fieldEntries} },`,
      `  "en": { ${fieldEntries} },`,
      `  "tr": { ${fieldEntries} },`,
      `  "ru": { ${fieldEntries} }`,
      '}',
    ].join('\n');
  };

  const fieldsInputBlock = (fieldList) =>
    fieldList
      .map((f) => `Field name: ${f}\nSource value: ${String(fields[f]).trim()}`)
      .join('\n\n---\n\n');

  const prompt = fields
    ? `You are a professional translator for KARAHOCA cleaning products company.

Translate each field below from ${langNames[sourceLang] || sourceLang} to Arabic (ar), English (en), Turkish (tr), and Russian (ru).
${BRAND_RULES}

CRITICAL OUTPUT RULES:
- Return ONLY a raw JSON object — no markdown fences, no explanation, no extra text.
- TOP-LEVEL keys MUST be the lowercase two-letter codes: "ar", "en", "tr", "ru" (NOT "Arabic", NOT "العربية").
- INNER keys MUST be the exact field names listed below — no square brackets, no quotes inside the key, no extra whitespace.
- For the source language ("${sourceLang}"), copy the original value verbatim.
- All string values must be on a single line. Represent paragraph breaks as the escaped sequence \\n\\n, NOT literal line breaks inside the JSON string.

Fields to translate:
${fieldsInputBlock(fieldNames)}

Output exactly this JSON shape, with the same field names as keys:
${schemaForFields(fieldNames)}`
    : `You are a professional translator for KARAHOCA cleaning products company.

Translate the following text from ${langNames[sourceLang] || sourceLang} to all four languages.
Use natural, commercial language.
${BRAND_RULES}

CRITICAL OUTPUT RULES:
- Return ONLY a raw JSON object (no markdown, no explanation).
- TOP-LEVEL keys MUST be lowercase two-letter codes: "ar", "en", "tr", "ru".
- Use the escaped sequence \\n for newlines inside string values.

Text: "${text}"

Output exactly this shape:
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

    // Try parse: as-is first, then with unescaped-newline repair.
    let parsed = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        parsed = JSON.parse(fixUnescapedNewlinesInJson(cleaned));
      } catch { /* fall through */ }
    }

    if (!parsed) {
      logger.warn('[translate] failed to parse model JSON. Raw (first 400 chars):',
        rawText.slice(0, 400));
      sendJson(res, 502, { success: false, error: 'Failed to parse translation response.' }, origin);
      return;
    }

    // Normalise the parsed shape into strictly { ar/en/tr/ru → { field → val } }.
    // For free-form `text` requests there are no field names — the
    // normaliser then accepts the raw inner keys as-is (and the FE
    // routes this branch differently anyway).
    const translations = normaliseTranslationsShape(parsed, fieldNames);

    if (!translations) {
      // Parse succeeded but we couldn't recognise ANY language or field
      // keys — emit a real error rather than a false-positive success so
      // the FE shows "حاول مجدداً" instead of an empty form with a green
      // checkmark.
      logger.warn(
        '[translate] parsed JSON has no recognisable lang/field keys. Top-level keys:',
        Object.keys(parsed || {}),
        'Sample raw:',
        rawText.slice(0, 300),
      );
      sendJson(
        res,
        502,
        {
          success: false,
          error: 'الترجمة عادت بصيغة غير متوقَّعة. حاول مجدداً.',
        },
        origin,
      );
      return;
    }

    // Diagnostic: log the SHAPE of what we're returning (not the full
    // text — could be PII / long). Helps post-mortem any future drift.
    logger.info(
      `[translate] returning translations for langs=[${Object.keys(translations).join(',')}], ` +
      `fields=[${fieldNames.join(',') || 'free-form'}]`,
    );

    sendJson(res, 200, { success: true, translations }, origin);

  } catch (err) {
    // callOpenRouterWithRetry throws a descriptive, user-friendly message.
    sendJson(res, 503, { success: false, error: err.message }, origin);
  }
};
