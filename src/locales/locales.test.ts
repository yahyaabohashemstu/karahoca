import { describe, expect, it } from 'vitest';
import ar from './ar/translation.json';
import en from './en/translation.json';
import tr from './tr/translation.json';
import ru from './ru/translation.json';

/**
 * i18n has no fallback language (src/i18n.ts — a fallback would make every
 * visitor download a second language), so a key missing from one file
 * shows up raw on that language's pages. Every key must exist in all four.
 *
 * Plurals are per language: a key like `pieceCount_few` exists only where
 * the language has that plural form (Arabic: zero one two few many other;
 * Russian: one few many other; English, Turkish: one other).
 */
const files = { ar, en, tr, ru } as const;
type Lang = keyof typeof files;

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const flatten = (node: unknown, prefix = ''): string[] =>
  node && typeof node === 'object' && !Array.isArray(node)
    ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
    : [prefix];

const keysOf = (lang: Lang) => new Set(flatten(files[lang].translation));

describe('translation files', () => {
  const langs = Object.keys(files) as Lang[];
  const all = new Set(langs.flatMap((l) => [...keysOf(l)]));
  const plain = [...all].filter((k) => !PLURAL_SUFFIX.test(k));
  const pluralBases = [...new Set([...all].filter((k) => PLURAL_SUFFIX.test(k)).map((k) => k.replace(PLURAL_SUFFIX, '')))];

  for (const lang of langs) {
    it(`${lang} has every key`, () => {
      const keys = keysOf(lang);
      expect(plain.filter((k) => !keys.has(k))).toEqual([]);
    });

    it(`${lang} has its plural forms`, () => {
      const keys = keysOf(lang);
      const forms = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
      const missing = pluralBases.flatMap((base) => forms.map((f) => `${base}_${f}`)).filter((k) => !keys.has(k));
      expect(missing).toEqual([]);
    });
  }
});
