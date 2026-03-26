const geminiEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export const handleAdminTranslate = async (req, res, { body, sendJson, origin }) => {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

  if (!geminiApiKey) {
    sendJson(res, 500, { success: false, error: 'GEMINI_API_KEY is not configured.' }, origin);
    return;
  }

  const { text, sourceLang = 'ar', fields } = body;

  // Support translating multiple fields at once
  const textToTranslate = fields
    ? Object.entries(fields).map(([k, v]) => `[${k}]: ${v}`).join('\n')
    : text;

  if (!textToTranslate || typeof textToTranslate !== 'string' || !textToTranslate.trim()) {
    sendJson(res, 400, { success: false, error: 'Text or fields required.' }, origin);
    return;
  }

  const langNames = { ar: 'العربية', en: 'English', tr: 'Türkçe', ru: 'Русский' };
  const targetLangs = ['ar', 'en', 'tr', 'ru'].filter(l => l !== sourceLang);

  const prompt = fields
    ? `You are a professional translator for KARAHOCA cleaning products company.

Translate each labeled field below from ${langNames[sourceLang] || sourceLang} to Arabic (ar), English (en), Turkish (tr), and Russian (ru).
Keep the [fieldname] labels exactly as they are.

Input:
${textToTranslate}

Return ONLY a JSON object with this structure (no markdown, no explanation):
{
  "ar": { "field1": "...", "field2": "..." },
  "en": { "field1": "...", "field2": "..." },
  "tr": { "field1": "...", "field2": "..." },
  "ru": { "field1": "...", "field2": "..." }
}`
    : `You are a professional translator for KARAHOCA cleaning products company.

Translate the following text from ${langNames[sourceLang] || sourceLang} to all four languages.
The text is about cleaning products. Use natural, commercial language.

Text: "${textToTranslate}"

Return ONLY a JSON object (no markdown, no explanation):
{"ar":"...","en":"...","tr":"...","ru":"..."}`;

  try {
    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
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

    // Clean markdown code blocks if present
    const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    try {
      const translations = JSON.parse(cleaned);
      sendJson(res, 200, { success: true, translations }, origin);
    } catch {
      sendJson(res, 502, { success: false, error: 'Failed to parse translation response.', raw: rawText }, origin);
    }
  } catch (err) {
    sendJson(res, 500, { success: false, error: err.message }, origin);
  }
};
