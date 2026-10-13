/**
 * POST /api/admin/translate with the model replaced by a stub: each target
 * language is its own request, the source language is never asked for or
 * returned (the editors used to overwrite the admin's own text with the
 * model's copy), and multi-line values come back intact.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleAdminTranslate } from '../routes/admin-translate.mjs';

const BODY_AR = '## العنوان\n\n- أولاً\n- ثانياً\n\nفقرة أخيرة.';

let prompts = [];

/** OpenAI-style reply; `reply(lang)` returns the message content for that language. */
const stubModel = (reply, finishReason = 'stop') => async (_url, init) => {
  const prompt = JSON.parse(init.body).messages[0].content;
  prompts.push(prompt);
  const lang = /exactly one top-level key, "(\w\w)"/.exec(prompt)?.[1];
  return new Response(
    JSON.stringify({ choices: [{ message: { content: reply(lang) }, finish_reason: finishReason }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

const translate = async (body) => {
  let result;
  const sendJson = (_res, status, payload) => { result = { status, payload }; };
  await handleAdminTranslate({}, {}, { body, sendJson, origin: '' });
  return result;
};

beforeEach(() => {
  prompts = [];
  process.env.OPENROUTER_API_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('handleAdminTranslate (fields)', () => {
  it('asks for each target language separately and never returns the source language', async () => {
    vi.stubGlobal('fetch', stubModel((lang) => JSON.stringify({
      [lang]: { title: `title-${lang}`, body: `## H-${lang}\n\n- one\n- two\n\nLast.` },
    })));

    const { status, payload } = await translate({ fields: { title: 'عنوان', body: BODY_AR }, sourceLang: 'ar' });

    expect(status).toBe(200);
    expect(prompts).toHaveLength(3);
    expect(Object.keys(payload.translations).sort()).toEqual(['en', 'ru', 'tr']);
    expect(payload.translations.ar).toBeUndefined();
    expect(payload.failedLangs).toEqual([]);
    // Line structure survives: list items and blank lines are still there.
    expect(payload.translations.en.body).toBe('## H-en\n\n- one\n- two\n\nLast.');
    // The source is sent as JSON, so its line breaks reach the model intact.
    expect(prompts[0]).toContain(JSON.stringify(BODY_AR));
    expect(prompts.some((p) => p.includes('"ar": {'))).toBe(false);
  });

  it('accepts a reply without the language wrapper', async () => {
    vi.stubGlobal('fetch', stubModel((lang) => JSON.stringify({ title: `t-${lang}` })));
    const { payload } = await translate({ fields: { title: 'Title' }, sourceLang: 'en' });
    expect(payload.translations).toEqual({ ar: { title: 't-ar' }, tr: { title: 't-tr' }, ru: { title: 't-ru' } });
  });

  it('reports the languages that failed instead of failing everything', async () => {
    vi.stubGlobal('fetch', stubModel((lang) => (lang === 'tr' ? 'not json at all' : JSON.stringify({ [lang]: { title: lang } }))));
    const { status, payload } = await translate({ fields: { title: 'عنوان' }, sourceLang: 'ar' });
    expect(status).toBe(200);
    expect(payload.translations).toEqual({ en: { title: 'en' }, ru: { title: 'ru' } });
    expect(payload.failedLangs).toEqual(['tr']);
  });

  it('says the text is too long when the model runs out of output tokens', async () => {
    vi.stubGlobal('fetch', stubModel(() => '{"en": {"body": "cut off', 'length'));
    const { status, payload } = await translate({ fields: { body: BODY_AR }, sourceLang: 'ar' });
    expect(status).toBe(502);
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/too long/i);
  });
});
