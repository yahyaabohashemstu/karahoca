import { describe, it, expect } from 'vitest';
import { normalizeSlug, SLUG_MAX_LENGTH } from '../services/slug.mjs';
import { normalizeSlug as normalizeSlugClient } from '../../src/admin/utils/slug.ts';

/**
 * The slug rules for news posts, blog posts and blog categories. The admin
 * editors run a copy of the same function while the admin types; the
 * server copy is the one applied on save.
 */

describe('normalizeSlug', () => {
  it('lowercases and turns everything that is not a letter or digit into dashes', () => {
    expect(normalizeSlug('Spring Sale!')).toBe('spring-sale');
    expect(normalizeSlug('a/b?c#d')).toBe('a-b-c-d');
    expect(normalizeSlug('  --Hello   World--  ')).toBe('hello-world');
    expect(normalizeSlug('100% Natural')).toBe('100-natural');
  });

  it('keeps letters of every site language', () => {
    expect(normalizeSlug('منظف الأرضيات')).toBe('منظف-الأرضيات');
    expect(normalizeSlug('Yüzey Temizleyici Çok Güçlü')).toBe('yüzey-temizleyici-çok-güçlü');
    expect(normalizeSlug('Средство для пола')).toBe('средство-для-пола');
  });

  it('drops combining marks instead of splitting the word', () => {
    expect(normalizeSlug('مُنَظِّف')).toBe('منظف');
    expect(normalizeSlug('İstanbul')).toBe('istanbul');
  });

  it('returns an empty string when nothing usable is left (callers answer 400)', () => {
    expect(normalizeSlug('!!! ---')).toBe('');
    expect(normalizeSlug('')).toBe('');
    expect(normalizeSlug(null)).toBe('');
  });

  it(`caps the length at ${SLUG_MAX_LENGTH} characters without a trailing dash`, () => {
    const out = normalizeSlug(`${'a'.repeat(SLUG_MAX_LENGTH - 1)} bcd`);
    expect(out).toBe('a'.repeat(SLUG_MAX_LENGTH - 1));
    expect(normalizeSlug('ж'.repeat(300))).toHaveLength(SLUG_MAX_LENGTH);
  });

  it('is idempotent', () => {
    for (const s of ['Spring Sale!', 'منظف الأرضيات', 'a--b']) {
      expect(normalizeSlug(normalizeSlug(s))).toBe(normalizeSlug(s));
    }
  });
});

describe('client copy (src/admin/utils/slug.ts)', () => {
  it('produces the same slugs as the server', () => {
    for (const s of ['Spring Sale!', 'منظف الأرضيات', 'Yüzey Çok', 'Средство для пола', 'مُنَظِّف', '!!!', 'x'.repeat(200) + ' y']) {
      expect(normalizeSlugClient(s)).toBe(normalizeSlug(s));
    }
  });

  it('keeps one trailing dash while typing (partial), so "my slug" can be typed', () => {
    expect(normalizeSlugClient('my ', { partial: true })).toBe('my-');
    expect(normalizeSlugClient('my  -', { partial: true })).toBe('my-');
    expect(normalizeSlugClient('my-slug', { partial: true })).toBe('my-slug');
    expect(normalizeSlugClient(' my', { partial: true })).toBe('my');
  });
});
