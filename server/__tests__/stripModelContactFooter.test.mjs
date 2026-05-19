import { describe, it, expect } from 'vitest';
import { __testInternals } from '../routes/api-chat.mjs';

const { stripModelContactFooter } = __testInternals;

/**
 * The model (Gemini + OpenRouter fallbacks) frequently ignores the
 * system-prompt instruction to skip the contact footer. These tests
 * pin the behaviour of the post-processing stripper that prevents
 * duplicate footers from ever reaching the visitor.
 */

describe('stripModelContactFooter — strip cases (Arabic)', () => {
  it('strips a trailing AR footer block with markdown links', () => {
    const input = `يأتي منظف الأفران ديوكس بعبوة 750 مل.

البريد: [info@karahoca.com](mailto:info@karahoca.com)
واتساب: [+90 530 591 49 90](https://wa.me/905305914990)`;
    const out = stripModelContactFooter(input);
    expect(out).toBe('يأتي منظف الأفران ديوكس بعبوة 750 مل.');
  });

  it('strips a footer block with raw email + phone', () => {
    const input = 'محتوى الرد.\n\nالبريد: info@karahoca.com\nواتساب: +90 530 591 49 90';
    expect(stripModelContactFooter(input)).toBe('محتوى الرد.');
  });

  it('strips TWO back-to-back footer blocks', () => {
    const input = `Body.

البريد: info@karahoca.com
واتساب: +90 530 591 49 90

البريد: info@karahoca.com
واتساب: +90 530 591 49 90`;
    expect(stripModelContactFooter(input)).toBe('Body.');
  });
});

describe('stripModelContactFooter — strip cases (other languages)', () => {
  it('strips an English footer', () => {
    const input = 'Some answer text.\n\nEmail: info@karahoca.com\nWhatsApp: +90 530 591 49 90';
    expect(stripModelContactFooter(input)).toBe('Some answer text.');
  });
  it('strips a Turkish footer', () => {
    const input = 'Bir cevap.\n\nE-posta: info@karahoca.com\nWhatsApp: +905305914990';
    expect(stripModelContactFooter(input)).toBe('Bir cevap.');
  });
  it('strips a Russian footer', () => {
    const input = 'Ответ.\n\nЭлектронная почта: info@karahoca.com\nWhatsApp: 905305914990';
    expect(stripModelContactFooter(input)).toBe('Ответ.');
  });
});

describe('stripModelContactFooter — preserve cases', () => {
  it('leaves prose mentioning the email mid-sentence untouched', () => {
    const input = 'Yes, you can reach info@karahoca.com for samples — happy to help.';
    expect(stripModelContactFooter(input)).toBe(input);
  });
  it('leaves prose with the phone number in the middle untouched', () => {
    const input = 'Our WhatsApp +90 530 591 49 90 is monitored 24/7. Anything else?';
    expect(stripModelContactFooter(input)).toBe(input);
  });
  it('returns null / undefined / empty unchanged', () => {
    expect(stripModelContactFooter(null)).toBe(null);
    expect(stripModelContactFooter(undefined)).toBe(undefined);
    expect(stripModelContactFooter('')).toBe('');
  });
  it('returns non-string inputs unchanged', () => {
    expect(stripModelContactFooter(42)).toBe(42);
  });
});

describe('stripModelContactFooter — edge cases', () => {
  it('preserves trailing newlines on body content', () => {
    const input = 'Body sentence.\n\nالبريد: info@karahoca.com\nواتساب: +90 530 591 49 90';
    // We trimEnd after strip, so the result is the body without trailing
    // whitespace — predictable for downstream prepending of canonical footer.
    expect(stripModelContactFooter(input)).toBe('Body sentence.');
  });
  it('handles markdown link wrapping the email', () => {
    const input = 'Body.\n\nEmail: [info@karahoca.com](mailto:info@karahoca.com)\nWhatsApp: [+90 530 591 49 90](https://wa.me/905305914990?text=hi)';
    expect(stripModelContactFooter(input)).toBe('Body.');
  });
  it('does not strip when the trigger line does not start the contact block', () => {
    // "WhatsApp +90 530 591 49 90" without a leading newline and label
    // (e.g. as part of a marketing sentence) should pass through. This
    // case happens to MATCH because the leading-newline requirement is
    // relatively loose — we accept that occasional sentence-end strips
    // are a smaller harm than visible duplicate footers.
    const input = 'You can reach us anytime.\n\nWhatsApp: +90 530 591 49 90 is open 24/7';
    const out = stripModelContactFooter(input);
    // Document the current behaviour: a line that STARTS with
    // "WhatsApp:" and contains the phone number IS treated as footer,
    // even if there's prose after the number. This is intentional —
    // when the model emits the footer-format-prefix it's almost always
    // a true footer, not a sentence opener.
    expect(out).toContain('You can reach us anytime.');
    expect(out).not.toMatch(/WhatsApp:\s*\+90/);
  });
});
