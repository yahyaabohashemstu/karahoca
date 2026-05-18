import { describe, expect, it } from 'vitest';
import { generateFollowups } from '../services/aiFollowups.mjs';

/**
 * Behaviour pins for the follow-up chip generator. The chips ship on
 * every assistant turn, so a regression here would change the entire
 * chat's conversational cadence — these tests defend the four hot paths
 * (specific category, brand-only, no-signal, language coverage).
 */

describe('generateFollowups — category routing', () => {
  it('returns the laundry set when the visitor asked about powder', () => {
    const out = generateFollowups({
      lastUserText: 'أحتاج مسحوق غسيل أوتوماتيك',
      assistantReplyText: 'حسناً، لدينا...',
      lang: 'ar',
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toMatch(/الأحجام/);
  });

  it('routes "dish liquid" to the dishwashing set', () => {
    const out = generateFollowups({
      lastUserText: 'do you have dish liquid?',
      lang: 'en',
    });
    expect(out[0]).toMatch(/dish/i);
  });

  it('routes "منظف الزجاج" to the glass set, not the generic cleaner set', () => {
    const out = generateFollowups({ lastUserText: 'منظف الزجاج', lang: 'ar' });
    expect(out.join(' ')).toMatch(/الشاشات|آثار/);
  });

  it('falls back to the reply text when the user message is vague', () => {
    const out = generateFollowups({
      lastUserText: 'merhaba',
      assistantReplyText: 'AYLUX çamaşır deterjanı geniş bir...',
      lang: 'tr',
    });
    expect(out.join(' ')).toMatch(/boyut|otomatik/i);
  });
});

describe('generateFollowups — brand-only path', () => {
  it('returns DIOX brand chips when only the brand is mentioned', () => {
    const out = generateFollowups({
      lastUserText: 'tell me about DIOX',
      lang: 'en',
    });
    expect(out.some((s) => s.includes('DIOX'))).toBe(true);
  });

  it('returns AYLUX brand chips for an AYLUX brand-only query', () => {
    const out = generateFollowups({
      lastUserText: 'أيلوكس ما هي منتجاتها؟',
      lang: 'ar',
    });
    expect(out.some((s) => s.includes('AYLUX'))).toBe(true);
  });
});

describe('generateFollowups — generic fallback', () => {
  it('returns the generic set for an out-of-scope question', () => {
    const out = generateFollowups({
      lastUserText: 'كم الساعة الآن؟',
      lang: 'ar',
    });
    expect(out).toHaveLength(3);
    // Generic copy is the "bestsellers / shipping / contact" trio.
    expect(out.join(' ')).toMatch(/المبيعات|تشحنون|مبيعاً/);
  });

  it('returns the generic set when nothing was passed in', () => {
    const out = generateFollowups({ lang: 'en' });
    expect(out).toHaveLength(3);
    expect(out[0]).toMatch(/bestseller/i);
  });
});

describe('generateFollowups — language coverage', () => {
  const cases = [
    { lang: 'ar', userText: 'أحتاج صابون', sample: /البشرة|الروائح/ },
    { lang: 'en', userText: 'I need soap', sample: /scent|skin/i },
    { lang: 'tr', userText: 'sabun lazım', sample: /koku|cilt/i },
    { lang: 'ru', userText: 'нужно мыло', sample: /арома|кож/iu },
  ];
  for (const { lang, userText, sample } of cases) {
    it(`returns ${lang} copy for ${lang} input`, () => {
      const out = generateFollowups({ lastUserText: userText, lang });
      expect(out.join(' ')).toMatch(sample);
    });
  }

  it('falls back to ar when an unknown lang code is supplied', () => {
    const out = generateFollowups({ lastUserText: 'صابون', lang: 'zz' });
    expect(out[0]).toMatch(/[ا-ي]/u);
  });
});
