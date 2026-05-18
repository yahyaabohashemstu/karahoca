import { describe, expect, it } from 'vitest';
import { __testInternals } from '../services/ogImage.mjs';

const { buildProductSvg, buildBrandSvg, truncate, wrapLines, xmlEscape } = __testInternals;

/**
 * Behaviour pins for the OG image generator. We don't rasterise here — that
 * would need sharp's native binary in CI — but the SVG builder is pure-JS
 * and is the part most likely to regress (templating, XML escaping, RTL
 * handling). The route module loads sharp lazily so a missing binary
 * doesn't take down the server.
 */

describe('xmlEscape', () => {
  it('escapes the five XML special chars without touching anything else', () => {
    expect(xmlEscape('<a> & "b" \'c\'')).toBe('&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos;');
  });
  it('handles null / undefined / numbers safely', () => {
    expect(xmlEscape(null)).toBe('');
    expect(xmlEscape(undefined)).toBe('');
    expect(xmlEscape(42)).toBe('42');
  });
});

describe('truncate', () => {
  it('returns the original string when shorter than the budget', () => {
    expect(truncate('hello', 20)).toBe('hello');
  });
  it('breaks on a word boundary near the end of the budget', () => {
    const out = truncate('the quick brown fox jumps over', 18);
    // Should end at a space-broken word, no mid-word slice.
    expect(out.endsWith('…')).toBe(true);
    // The original string contains "fox jumps over" past char 18; the
    // ellipsis must drop everything from "fox" onwards, never mid-word.
    // Acceptable outputs: "the quick brown…", "the quick…", etc.
    expect(['the quick brown…', 'the quick…', 'the…']).toContain(out);
  });
});

describe('wrapLines', () => {
  it('wraps long copy across the requested number of lines', () => {
    const lines = wrapLines('the quick brown fox jumps over the lazy dog', 15, 3);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) {
      // The wrapper isn't a glyph-perfect renderer — it allows a one-word
      // overrun beyond `perLine` so we don't drop tail words. The cap that
      // matters in practice is "two short Russian/Arabic words" which
      // averages well below 25 chars; keep this as a sanity bound.
      expect(line.length).toBeLessThanOrEqual(25);
    }
  });
  it('appends an ellipsis on the last line when copy overflows', () => {
    const lines = wrapLines('one two three four five six seven eight nine ten', 8, 2);
    expect(lines[lines.length - 1]).toMatch(/…$/);
  });
  it('returns an empty array for empty input', () => {
    expect(wrapLines('', 10, 3)).toEqual([]);
    expect(wrapLines(null, 10, 3)).toEqual([]);
  });
});

describe('buildProductSvg', () => {
  it('emits a 1200x630 SVG with the product name and brand', () => {
    const svg = buildProductSvg({
      name: 'DIOX Floor Cleaner',
      description: 'Long-lasting freshness for tiled floors and laminates.',
      brand: 'DIOX',
      lang: 'en',
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('DIOX Floor Cleaner');
    expect(svg).toContain('DIOX');
    expect(svg).toContain('Professional cleaning products');
  });

  it('sets direction="rtl" for Arabic', () => {
    const svg = buildProductSvg({
      name: 'منظف أرضيات',
      description: 'منتج تنظيف احترافي',
      brand: 'DIOX',
      lang: 'ar',
    });
    expect(svg).toMatch(/direction="rtl"/);
    expect(svg).toContain('منظف أرضيات');
    expect(svg).toContain('منتجات تنظيف احترافية');
  });

  it('XML-escapes ampersands in the product name', () => {
    const svg = buildProductSvg({
      name: 'Pine & Citrus Spray',
      description: 'Two scents — one bottle',
      brand: 'AYLUX',
      lang: 'en',
    });
    expect(svg).toContain('Pine &amp; Citrus Spray');
    // En-dash should pass through unchanged (not XML-special).
    expect(svg).toContain('Two scents');
  });

  it('falls back to KARAHOCA colors for an unknown brand', () => {
    const svg = buildProductSvg({
      name: 'Generic',
      description: '',
      brand: 'UNKNOWN_BRAND',
      lang: 'en',
    });
    // KARAHOCA primary is #153d7a (defined in BRAND_COLORS fallback).
    expect(svg).toContain('#153d7a');
  });
});

describe('buildBrandSvg', () => {
  it('renders the brand name as the headline', () => {
    const svg = buildBrandSvg({ brand: 'AYLUX', lang: 'tr' });
    expect(svg).toContain('AYLUX');
    expect(svg).toContain('Profesyonel temizlik');
    expect(svg).toContain('karahoca.com');
  });
  it('uses RTL for Arabic brand cards', () => {
    const svg = buildBrandSvg({ brand: 'DIOX', lang: 'ar' });
    expect(svg).toMatch(/direction="rtl"/);
  });
});

// Pin: Node's URL constructor percent-encodes non-ASCII path bytes.
// This is what saved us from ERR_INVALID_CHAR when the API tried to
// fetch /diox-images/ديوكس سوبر جل.png. If a future refactor swaps
// `new URL()` for raw string concatenation, the runtime would 500
// again on every Arabic-named product — this test catches it early.
describe('URL constructor encoding', () => {
  it('percent-encodes Arabic path segments', () => {
    const encoded = new URL('https://karahoca.com/diox-images/ديوكس سوبر جل.png').toString();
    expect(encoded).toMatch(/%D8%AF%D9%8A%D9%88%D9%83%D8%B3/);
    // The result is pure ASCII — safe to use anywhere HTTP demands ASCII.
    expect(/^[\x20-\x7E]*$/.test(encoded)).toBe(true);
  });
  it('handles spaces correctly', () => {
    const encoded = new URL('https://example.com/has space.png').toString();
    expect(encoded).toContain('has%20space.png');
  });
});
