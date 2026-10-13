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

// Per attempt. A long article's Russian translation is several thousand
// output tokens; at typical OpenRouter speeds that took longer than the
// old 30 s, so long bodies timed out on every model.
const TIMEOUT_MS = 90_000;

/**
 * Single attempt: call one OpenRouter model with a TIMEOUT_MS
 * AbortController timeout. Returns the fetch Response (may not be ok).
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
  // The admin UI is English (TranslationHelper maps "unavailable" to its
  // "service is busy" message).
  const err = new Error(
    'The translation service is busy right now. Please try again in a moment. ' +
    '(OpenRouter translation service temporarily unavailable after retries on all models.)'
  );
  err.status = 503;
  throw err;
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
// tabs stay blank with a misleading "✓ Translated" badge.
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

  // Refuse if NOTHING came through — the badge "✓ Translated" with empty
  // fields is worse than a clear error message.
  if (Object.keys(out).length === 0) return null;
  return out;
};

// ─── Main handler ─────────────────────────────────────────────────────────────

const ALL_LANGS = ['ar', 'en', 'tr', 'ru'];
const LANG_NAMES = { ar: 'Arabic (العربية)', en: 'English', tr: 'Turkish (Türkçe)', ru: 'Russian (Русский)' };

// Brand-name rules injected into every prompt.
const BRAND_RULES = `
BRAND NAME RULES (must be followed exactly per language):
- In Arabic (ar):  "ديوكس" → "ديوكس"  |  "آيلوكس"/"ايلوكس" → "آيلوكس"
- In English (en): "ديوكس" → "DIOX"    |  "آيلوكس"/"ايلوكس" → "AYLUX"
- In Turkish (tr): "ديوكس" → "DIOX"    |  "آيلوكس"/"ايلوكس" → "AYLUX"
- In Russian (ru): "ديوكس" → "DIOX"    |  "آيلوكس"/"ايلوكس" → "AYLUX"`;

/**
 * One model call → parsed JSON. Throws with a `status` (502 / 503) the
 * handler can pass on. `finish_reason: "length"` is reported as its own
 * error: a cut-off reply is invalid JSON, which used to surface as a vague
 * "failed to parse" for every long article.
 */
async function requestJson(apiKey, prompt) {
  const response = await callOpenRouterWithRetry(apiKey, prompt);
  const payload = await response.json();
  // OpenRouter / OpenAI-compatible response shape.
  const choice = payload?.choices?.[0];
  const rawText = choice?.message?.content?.trim();
  const fail = (message) => Object.assign(new Error(message), { status: 502 });

  if (!rawText) throw fail('Empty response from translation service.');
  if (choice?.finish_reason === 'length') {
    throw fail('The text is too long to translate in one go. Translate it in shorter parts.');
  }

  // Strip markdown code fences if the model wrapped the JSON anyway.
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Try parse: as-is first, then with unescaped-newline repair.
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(fixUnescapedNewlinesInJson(cleaned));
    } catch { /* fall through */ }
  }
  logger.warn('[translate] failed to parse model JSON. Raw (first 400 chars):', rawText.slice(0, 400));
  throw fail('Failed to parse translation response.');
}

/**
 * Translate every field into ONE target language. Each language gets its
 * own request: asking for all four in one reply ran long articles past the
 * model's output budget (the reply was cut off and nothing was saved), and
 * the source language was echoed back too — the editors then overwrote
 * what the admin had typed with the model's reflowed copy of it.
 */
async function translateFieldsInto(apiKey, lang, sourceLang, source, fieldNames) {
  const prompt = `You are a professional translator for KARAHOCA cleaning products company.

Translate every value of the JSON object below from ${LANG_NAMES[sourceLang] || sourceLang} into ${LANG_NAMES[lang]}.
Use natural, commercial language.
${BRAND_RULES}

CRITICAL OUTPUT RULES:
- Return ONLY a raw JSON object — no markdown fences, no explanation, no extra text.
- The object has exactly one top-level key, "${lang}", whose value is an object with EXACTLY the same keys as the input (no square brackets, no extra whitespace).
- Translate each value completely and keep its layout: every line break and blank line, and every markdown marker (#, -, *, **, >, numbered lists, [text](url)), stays where it is in the source. Do not translate URLs.
- Inside JSON strings, write line breaks as \\n (standard JSON escaping).

Input (JSON):
${JSON.stringify(source, null, 2)}

Output exactly this shape:
{ "${lang}": { ${fieldNames.map((f) => `"${f}": "..."`).join(', ')} } }`;

  const parsed = await requestJson(apiKey, prompt);
  // Normally { "<lang>": { field: value } }; some models drop the wrapper
  // and return the field object itself.
  const wrapped = normaliseTranslationsShape(parsed, fieldNames)?.[lang];
  const values = wrapped || normaliseTranslationsShape({ [lang]: parsed }, fieldNames)?.[lang];
  if (!values) {
    logger.warn(`[translate] ${lang}: no recognisable field keys. Top-level keys:`, Object.keys(parsed || {}));
    throw Object.assign(new Error('The translation came back in an unexpected format. Please try again.'), { status: 502 });
  }
  return values;
}

export const handleAdminTranslate = async (req, res, { body, sendJson, origin }) => {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';

  if (!openrouterApiKey) {
    sendJson(res, 500, { success: false, error: 'OPENROUTER_API_KEY is not configured.' }, origin);
    return;
  }

  const { text, sourceLang = 'ar', fields } = body;

  // Resolve the list of field names we'll send to the model — same set the
  // FE expects back. Filtering out empty values keeps the prompt concise
  // and stops the model from inventing translations for blank inputs.
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

  if (fields) {
    // The source goes in as JSON so multi-line values (markdown bodies)
    // arrive intact and unambiguous — the old "Source value: …" blocks
    // separated by "---" collided with markdown rules in the body.
    const source = Object.fromEntries(fieldNames.map((f) => [f, String(fields[f]).trim()]));
    const targets = ALL_LANGS.filter((l) => l !== sourceLang);
    const settled = await Promise.allSettled(
      targets.map((lang) => translateFieldsInto(openrouterApiKey, lang, sourceLang, source, fieldNames)),
    );

    const translations = {};
    const failedLangs = [];
    const errors = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') translations[targets[i]] = r.value;
      else {
        failedLangs.push(targets[i]);
        errors.push(r.reason);
        logger.warn(`[translate] ${targets[i]} failed: ${r.reason?.message}`);
      }
    });

    if (failedLangs.length === targets.length) {
      // Nothing usable: a real error, not a success with empty fields.
      const first = errors[0];
      sendJson(res, first?.status || 503, { success: false, error: first?.message || 'Translation failed.' }, origin);
      return;
    }

    // Diagnostic: log the SHAPE of what we're returning (not the full
    // text — could be PII / long). Helps post-mortem any future drift.
    logger.info(
      `[translate] returning translations for langs=[${Object.keys(translations).join(',')}], ` +
      `failed=[${failedLangs.join(',')}], fields=[${fieldNames.join(',')}]`,
    );
    // The source language is never returned; failedLangs lets the editor
    // say which language still needs a retry.
    sendJson(res, 200, { success: true, translations, failedLangs }, origin);
    return;
  }

  // ── Free-form text (no field names) ──────────────────────────────────────
  const prompt = `You are a professional translator for KARAHOCA cleaning products company.

Translate the following text from ${LANG_NAMES[sourceLang] || sourceLang} to all four languages.
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
    const parsed = await requestJson(openrouterApiKey, prompt);
    // For free-form `text` requests there are no field names — the
    // normaliser then accepts the raw inner keys as-is.
    const translations = normaliseTranslationsShape(parsed, fieldNames);

    if (!translations) {
      // Parse succeeded but we couldn't recognise ANY language keys —
      // emit a real error rather than a false-positive success.
      logger.warn(
        '[translate] parsed JSON has no recognisable lang/field keys. Top-level keys:',
        Object.keys(parsed || {}),
      );
      sendJson(res, 502, { success: false, error: 'The translation came back in an unexpected format. Please try again.' }, origin);
      return;
    }

    logger.info(`[translate] returning translations for langs=[${Object.keys(translations).join(',')}], fields=[free-form]`);
    sendJson(res, 200, { success: true, translations }, origin);
  } catch (err) {
    // callOpenRouterWithRetry / requestJson throw descriptive messages.
    sendJson(res, err.status || 503, { success: false, error: err.message }, origin);
  }
};
