/**
 * Custom Q&A language fallback (server/routes/admin-ai-knowledge.mjs): an
 * entry must reach every chat language, not only the ones it was written in.
 */
import { describe, expect, it } from 'vitest';

const { pickQaPair } = await import('../routes/admin-ai-knowledge.mjs');

const entry = (fields) => ({
  question_ar: '', question_en: '', question_tr: '', question_ru: '',
  answer_ar: '', answer_en: '', answer_tr: '', answer_ru: '',
  ...fields,
});

describe('pickQaPair', () => {
  it('uses the requested language when it has both question and answer', () => {
    const qa = entry({ question_en: 'Q en', answer_en: 'A en', question_tr: 'Q tr', answer_tr: 'A tr' });
    expect(pickQaPair(qa, 'tr')).toEqual({ q: 'Q tr', a: 'A tr' });
  });

  it('gives an Arabic-only entry to English, Turkish and Russian chats', () => {
    const qa = entry({ question_ar: 'سؤال', answer_ar: 'جواب' });
    for (const lang of ['en', 'tr', 'ru']) {
      expect(pickQaPair(qa, lang)).toEqual({ q: 'سؤال', a: 'جواب' });
    }
  });

  it('falls back ar → en → tr → ru', () => {
    const qa = entry({ question_en: 'Q en', answer_en: 'A en', question_ru: 'Q ru', answer_ru: 'A ru' });
    expect(pickQaPair(qa, 'tr')).toEqual({ q: 'Q en', a: 'A en' });
    expect(pickQaPair(entry({ question_ru: 'Q ru', answer_ru: 'A ru' }), 'ar')).toEqual({ q: 'Q ru', a: 'A ru' });
  });

  it('never pairs a question from one language with an answer from another', () => {
    const qa = entry({ question_tr: 'Q tr', answer_en: 'A en', question_ru: 'Q ru', answer_ru: 'A ru' });
    expect(pickQaPair(qa, 'tr')).toEqual({ q: 'Q ru', a: 'A ru' });
  });

  it('skips an entry with no complete pair, and blank-only text', () => {
    expect(pickQaPair(entry({ question_en: 'Q', answer_ar: 'A' }), 'en')).toBeNull();
    expect(pickQaPair(entry({ question_en: '  ', answer_en: 'A' }), 'en')).toBeNull();
  });
});
