/**
 * server/services/aiDescriptionWriter.mjs — generate a polished
 * commercial product description in all four KARAHOCA languages from
 * a brief.
 *
 * Why a dedicated service (and not just a prompt slapped on the
 * existing translate handler):
 *
 *   - The translator is "preserve meaning, switch language." This is
 *     "synthesise marketing copy from a sparse brief", a very
 *     different prompt shape — the system asks for tone, length, and
 *     audience guidance the translator doesn't need.
 *
 *   - Single round-trip. Generating once in the source language then
 *     translating four times would burn ~5 LLM calls. By asking the
 *     model to emit all four languages directly we pay once and get
 *     consistent terminology across languages (the AR, EN, TR, RU
 *     descriptions are guaranteed to reference the same selling
 *     points, since they're authored together).
 *
 *   - Provider chain reuse. We piggyback on the same Gemini → OpenRouter
 *     pipeline aiChat.mjs uses for the visitor-facing assistant; that
 *     module already handles 429 / 503 retries, model fallback, and
 *     timeout budgets, so we don't reinvent the resilience layer.
 *
 * Failure modes:
 *
 *   - Both Gemini and OpenRouter unavailable → the route surfaces a
 *     503 with the user-friendly message the chain returned.
 *   - Model returns invalid JSON → we try a forgiving re-parse, then
 *     surface a 502 so the admin sees "غير متوقعة" rather than a
 *     truncated description being silently saved.
 *   - Model omits one or more languages → we keep what's there, the
 *     admin can fill the gap manually or re-run.
 */

import { logger } from '../utils/logger.mjs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-001';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it';

const SUPPORTED_LANGS = ['ar', 'en', 'tr', 'ru'];

const LANG_LABELS = {
  ar: 'العربية (Arabic)',
  en: 'English',
  tr: 'Türkçe (Turkish)',
  ru: 'Русский (Russian)',
};

const TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build the prompt sent to the LLM. We commit hard to a strict output
 * shape because every escape hatch we leave (markdown, prose preface,
 * field-name drift) costs the admin one more retry — and the audit
 * log shows them every retry.
 */
const buildPrompt = ({ name, brand, category, hint, sourceLang }) => {
  const audience = brand === 'AYLUX'
    ? 'discerning households who care about fragrance, packaging, and a premium experience'
    : 'value-conscious shoppers and professional cleaners who care about effectiveness, dilution ratio, and durability';
  const tone = brand === 'AYLUX'
    ? 'warm, elegant, sensorial — short descriptive sentences, lifestyle framing'
    : 'confident, technical, practical — concrete use-cases, ingredients-or-effect first';

  return `You are a senior copywriter for KARAHOCA, a Turkish manufacturer of household and industrial cleaning products. KARAHOCA sells two brands:
  - DIOX (mass-market and professional)
  - AYLUX (premium, fragrance-led)

You write multi-language product descriptions that ship straight to a public catalogue and a WhatsApp share message. Length target: 2 to 3 short sentences (about 35-60 words per language). Avoid bullet points; flow naturally.

Brief from the admin:
  Brand:           ${brand}
  Product name:    ${name}
  Category:        ${category || '(not specified — infer from the name)'}
  Source language: ${sourceLang} (${LANG_LABELS[sourceLang] || sourceLang})
  Extra notes:     ${hint ? hint.trim() : '(none)'}

Target audience: ${audience}.
Tone of voice:    ${tone}.

Brand-name handling rules (strict):
  - Arabic:  DIOX → "ديوكس",  AYLUX → "آيلوكس"
  - Other languages: keep brand names in Latin uppercase (DIOX, AYLUX).
  - Never invent product features or certifications.
  - Never claim regulatory approval, "100% natural", or medical benefits.

CRITICAL OUTPUT RULES:
  - Return ONLY a raw JSON object — no markdown fences, no preface, no trailing prose.
  - TOP-LEVEL keys MUST be exactly: "ar", "en", "tr", "ru" (lowercase, two letters).
  - Each value is the polished description string for that language.
  - Use "\\n\\n" (escaped) for paragraph breaks if you really need one — single paragraph preferred.

Output exactly:
{"ar":"...","en":"...","tr":"...","ru":"..."}`;
};

/**
 * Fix unescaped newlines inside JSON string values. The translator
 * helper has the same routine — duplicated here to keep the
 * description writer free of cross-module imports beyond the logger.
 */
const fixUnescapedNewlines = (str) => {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) { escaped = false; out += ch; continue; }
    if (ch === '\\') { escaped = true; out += ch; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString && ch === '\n') { out += '\\n'; continue; }
    if (inString && ch === '\r') { out += '\\r'; continue; }
    if (inString && ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }
  return out;
};

const stripCodeFences = (s) => s
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

const tryParseJson = (rawText) => {
  const cleaned = stripCodeFences(rawText);
  try { return JSON.parse(cleaned); } catch { /* */ }
  try { return JSON.parse(fixUnescapedNewlines(cleaned)); } catch { /* */ }
  return null;
};

/**
 * Normalise the parsed JSON into `{ ar, en, tr, ru }` of plain
 * strings. Drops anything that isn't a string under a recognised
 * language key. Returns `null` if NOTHING came through (caller emits
 * a real error rather than silently saving blanks).
 */
const normalize = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;
  const out = {};
  for (const lang of SUPPORTED_LANGS) {
    const v = parsed[lang];
    if (typeof v === 'string' && v.trim()) out[lang] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
};

const callOpenAiCompatible = async ({ endpoint, apiKey, model, prompt, extraHeaders = {} }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.55, // marketing copy needs some life but not chaos
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Walk the provider chain: Gemini first, OpenRouter as fallback. The
 * SAME pattern aiChat.mjs uses for the visitor-facing assistant — see
 * that module for the full rationale (Gemini = paid quota,
 * OpenRouter = free-tier failover).
 */
const callProviderChain = async (prompt) => {
  const errors = [];

  if (GEMINI_API_KEY) {
    try {
      const res = await callOpenAiCompatible({
        endpoint: GEMINI_ENDPOINT,
        apiKey: GEMINI_API_KEY,
        model: GEMINI_MODEL,
        prompt,
      });
      if (res.ok) return await res.json();
      errors.push(`Gemini ${res.status}`);
      // 429 from Gemini → fall through to OpenRouter immediately.
      // 503 → wait 1s then try OpenRouter (Gemini outages tend to be
      //         long enough that re-trying twice is worse than just
      //         switching).
      if (res.status === 503) await sleep(1000);
    } catch (err) {
      errors.push(`Gemini error: ${err.message}`);
    }
  } else {
    errors.push('GEMINI_API_KEY missing');
  }

  if (OPENROUTER_API_KEY) {
    try {
      const res = await callOpenAiCompatible({
        endpoint: OPENROUTER_ENDPOINT,
        apiKey: OPENROUTER_API_KEY,
        model: OPENROUTER_MODEL,
        prompt,
        extraHeaders: {
          'HTTP-Referer': process.env.SITE_URL || 'https://karahoca.com',
          'X-Title': 'KARAHOCA Admin Description Writer',
        },
      });
      if (res.ok) return await res.json();
      errors.push(`OpenRouter ${res.status}`);
    } catch (err) {
      errors.push(`OpenRouter error: ${err.message}`);
    }
  } else {
    errors.push('OPENROUTER_API_KEY missing');
  }

  logger.warn({ errors }, '[aiDescription] all providers exhausted');
  const err = new Error(
    'خدمة الذكاء الاصطناعي غير متاحة حالياً. حاول بعد لحظات. ' +
    `(All AI providers failed: ${errors.join(' → ')})`,
  );
  err.code = 'AI_PROVIDERS_UNAVAILABLE';
  throw err;
};

/**
 * Public entry point. Validates the brief, calls the model, parses the
 * JSON, and returns `{ ar, en, tr, ru }`. Throws on transport / parse
 * failures so the route handler can map them to HTTP status codes.
 */
export const generateProductDescriptions = async ({ name, brand, category, hint, sourceLang = 'ar' }) => {
  if (!name || !String(name).trim()) {
    const e = new Error('Product name is required.');
    e.code = 'VALIDATION';
    throw e;
  }
  if (!['DIOX', 'AYLUX'].includes(brand)) {
    const e = new Error('Brand must be DIOX or AYLUX.');
    e.code = 'VALIDATION';
    throw e;
  }
  if (!SUPPORTED_LANGS.includes(sourceLang)) {
    const e = new Error(`sourceLang must be one of: ${SUPPORTED_LANGS.join(', ')}.`);
    e.code = 'VALIDATION';
    throw e;
  }

  const prompt = buildPrompt({ name, brand, category, hint, sourceLang });
  const payload = await callProviderChain(prompt);
  const rawText = payload?.choices?.[0]?.message?.content?.trim();
  if (!rawText) {
    const e = new Error('AI returned an empty response.');
    e.code = 'EMPTY_RESPONSE';
    throw e;
  }
  const parsed = tryParseJson(rawText);
  if (!parsed) {
    logger.warn({ sample: rawText.slice(0, 200) }, '[aiDescription] could not parse model JSON');
    const e = new Error('AI response was not valid JSON.');
    e.code = 'PARSE_FAILED';
    throw e;
  }
  const descriptions = normalize(parsed);
  if (!descriptions) {
    logger.warn({ topKeys: Object.keys(parsed) }, '[aiDescription] no recognised language keys');
    const e = new Error('AI response did not contain any recognised language keys.');
    e.code = 'SHAPE_FAILED';
    throw e;
  }
  return descriptions;
};

// Exposed for unit tests.
export const __testInternals = {
  buildPrompt,
  normalize,
  tryParseJson,
};
