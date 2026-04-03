const geminiEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
    if (escaped) {
      escaped = false;
      result += ch;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString && ch === '\n') { result += '\\n'; continue; }
    if (inString && ch === '\r') { result += '\\r'; continue; }
    if (inString && ch === '\t') { result += '\\t'; continue; }
    result += ch;
  }
  return result;
}

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

  const prompt = fields
    ? `You are a professional translator for KARAHOCA cleaning products company.

Translate each labeled field below from ${langNames[sourceLang] || sourceLang} to Arabic (ar), English (en), Turkish (tr), and Russian (ru).
Fields are separated by <<<NEXT_FIELD>>> markers. Keep the [fieldname] labels exactly as they appear.

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

CRITICAL: Return ONLY a raw JSON object (no markdown, no explanation). Use \\n for newlines inside strings.

Text: "${textToTranslate}"

{"ar":"...","en":"...","tr":"...","ru":"..."}`;

  try {
    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      sendJson(res, 502, { success: false, error: `Gemini error: ${err}` }, origin);
      return;
    }

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
    } catch { /* fall through to attempt 2 */ }

    // Attempt 2: fix unescaped newlines/tabs inside string values then parse
    try {
      const fixed = fixUnescapedNewlinesInJson(cleaned);
      const translations = JSON.parse(fixed);
      sendJson(res, 200, { success: true, translations }, origin);
      return;
    } catch { /* fall through to error */ }

    sendJson(res, 502, { success: false, error: 'Failed to parse translation response.' }, origin);
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message }, origin);
  }
};
