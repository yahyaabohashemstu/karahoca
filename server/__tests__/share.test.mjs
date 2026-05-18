import { describe, it, expect } from 'vitest';
import { __testInternals } from '../routes/share.mjs';

const { buildShareHtml, htmlEscape, brandPathFor } = __testInternals;

/**
 * Pure-helper tests for the interstitial share-URL handler. The DB
 * lookup + HTTP plumbing is integration territory; these tests cover
 * the HTML template that crawlers ultimately read.
 */

describe('htmlEscape', () => {
  it('escapes all five XML-sensitive characters', () => {
    expect(htmlEscape('<a> & "b" \'c\'')).toBe('&lt;a&gt; &amp; &quot;b&quot; &#39;c&#39;');
  });
  it('passes Arabic / Russian characters through unchanged', () => {
    expect(htmlEscape('منظف أرضيات')).toBe('منظف أرضيات');
    expect(htmlEscape('средство для пола')).toBe('средство для пола');
  });
});

describe('brandPathFor', () => {
  it('maps DIOX → diox', () => { expect(brandPathFor('DIOX')).toBe('diox'); });
  it('maps AYLUX → aylux', () => { expect(brandPathFor('AYLUX')).toBe('aylux'); });
  it('is case-insensitive', () => { expect(brandPathFor('dIoX')).toBe('diox'); });
  it('falls back to "home" for unknown brands', () => { expect(brandPathFor('UNKNOWN')).toBe('home'); });
});

describe('buildShareHtml', () => {
  const product = {
    id: 'diox-floor-cleaner',
    brand: 'DIOX',
    name: 'DIOX Floor Cleaner',
    description: 'Long-lasting freshness for tiled floors.',
    image: '/diox-images/floor-cleaner.webp',
  };

  it('emits well-formed OG meta', () => {
    const html = buildShareHtml({ product, lang: 'ar' });
    expect(html).toMatch(/<meta property="og:image" content="[^"]+\/og\/product\/diox-floor-cleaner-ar\.png"/);
    expect(html).toMatch(/<meta property="og:title" content="DIOX Floor Cleaner"/);
    expect(html).toMatch(/<meta property="og:type" content="product"/);
    expect(html).toMatch(/<meta property="og:image:width" content="1200"/);
    expect(html).toMatch(/<meta property="og:image:height" content="630"/);
  });

  it('points the SPA redirect at the brand-page deep-link', () => {
    const html = buildShareHtml({ product, lang: 'tr' });
    expect(html).toMatch(/https:\/\/karahoca\.com\/tr\/diox#diox-floor-cleaner/);
    // meta-refresh + JS + clickable anchor — three redirect paths.
    expect(html).toMatch(/<meta http-equiv="refresh"/);
    expect(html).toMatch(/window\.location\.replace/);
    expect(html).toMatch(/<a href=/);
  });

  it('respects RTL for Arabic', () => {
    const html = buildShareHtml({ product, lang: 'ar' });
    expect(html).toMatch(/<html lang="ar" dir="rtl">/);
    expect(html).toMatch(/og:locale" content="ar_TR"/);
  });

  it('uses LTR for English', () => {
    const html = buildShareHtml({ product, lang: 'en' });
    expect(html).toMatch(/<html lang="en" dir="ltr">/);
  });

  it('XML-escapes admin-supplied names', () => {
    const evil = { ...product, name: 'Pine & "Citrus" <special>' };
    const html = buildShareHtml({ product: evil, lang: 'en' });
    // Escaped form must be present...
    expect(html).toContain('Pine &amp; &quot;Citrus&quot; &lt;special&gt;');
    // ...and the raw <special> must NOT appear anywhere (the only ways
    // an unescaped `<special>` could leak are buggy concatenation or
    // an attribute closing prematurely).
    expect(html).not.toContain('<special>');
    expect(html).not.toContain('"Citrus"');
  });

  it('falls back to product id when name is missing', () => {
    const noName = { ...product, name: '' };
    const html = buildShareHtml({ product: noName, lang: 'en' });
    expect(html).toContain('og:title" content="diox-floor-cleaner"');
  });
});
