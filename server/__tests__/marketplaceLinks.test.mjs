import { describe, it, expect } from 'vitest';
import {
  normalizeMarketplaceUrl,
  normalizeMarketplaceUrlFields,
  publicMarketplaceLinks,
} from '../services/marketplaceLinks.mjs';

const TY = 'https://www.trendyol.com/aylux/cam-temizleyici-750-ml-p-1171990307?merchantId=1277496';
const HB = 'https://www.hepsiburada.com/yag-ve-kir-cozucu-700-ml-pm-HBC0000GGZ6YV?magaza=AYLUX';

describe('normalizeMarketplaceUrl', () => {
  it('accepts an https listing URL on the marketplace domain', () => {
    expect(normalizeMarketplaceUrl('trendyol', TY)).toBe(TY);
    expect(normalizeMarketplaceUrl('hepsiburada', HB)).toBe(HB);
  });

  it('accepts the bare domain and trims whitespace', () => {
    expect(normalizeMarketplaceUrl('trendyol', '  https://trendyol.com/x  ')).toBe('https://trendyol.com/x');
  });

  it('passes "not sent" through and turns blank into a clear', () => {
    expect(normalizeMarketplaceUrl('trendyol', undefined)).toBeUndefined();
    expect(normalizeMarketplaceUrl('trendyol', null)).toBeNull();
    expect(normalizeMarketplaceUrl('trendyol', '   ')).toBe('');
  });

  it.each([
    ['plain http', 'http://www.trendyol.com/x'],
    ['other marketplace', 'https://www.hepsiburada.com/x'],
    ['look-alike domain', 'https://trendyol.com.evil.example/x'],
    ['suffix trick', 'https://nottrendyol.com/x'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['not a URL', 'trendyol aylux cam'],
  ])('rejects %s', (_label, value) => {
    expect(() => normalizeMarketplaceUrl('trendyol', value)).toThrow(/Trendyol link/);
  });
});

describe('normalizeMarketplaceUrlFields', () => {
  it('normalises both columns in place and reports no error', () => {
    const body = { trendyol_url: ` ${TY} `, hepsiburada_url: '' };
    expect(normalizeMarketplaceUrlFields(body)).toBeNull();
    expect(body).toEqual({ trendyol_url: TY, hepsiburada_url: '' });
  });

  it('leaves fields that were not sent untouched', () => {
    const body = { name_tr: 'x' };
    expect(normalizeMarketplaceUrlFields(body)).toBeNull();
    expect(body.trendyol_url).toBeUndefined();
    expect(body.hepsiburada_url).toBeUndefined();
  });

  it('returns the message for an invalid field', () => {
    expect(normalizeMarketplaceUrlFields({ hepsiburada_url: TY })).toMatch(/Hepsiburada link must be/);
  });
});

describe('publicMarketplaceLinks', () => {
  it('maps set columns to { trendyol, hepsiburada }', () => {
    expect(publicMarketplaceLinks({ trendyol_url: TY, hepsiburada_url: HB })).toEqual({ trendyol: TY, hepsiburada: HB });
    expect(publicMarketplaceLinks({ trendyol_url: TY, hepsiburada_url: '' })).toEqual({ trendyol: TY });
  });

  it('is undefined when the product has no links', () => {
    expect(publicMarketplaceLinks({ trendyol_url: null, hepsiburada_url: '' })).toBeUndefined();
    expect(publicMarketplaceLinks({})).toBeUndefined();
  });

  it('never serves a stored value that fails validation', () => {
    expect(publicMarketplaceLinks({ trendyol_url: 'javascript:alert(1)', hepsiburada_url: HB })).toEqual({ hepsiburada: HB });
  });
});
