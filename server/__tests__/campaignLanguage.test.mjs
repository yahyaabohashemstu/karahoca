import { describe, expect, it } from 'vitest';
import {
  availableLanguages,
  incompleteLanguages,
  languageForSubscriber,
  normaliseSubscriberLang,
} from '../services/campaignLanguage.mjs';

const campaign = (langs) => Object.fromEntries(
  langs.flatMap((l) => [[`subject_${l}`, `Subject ${l}`], [`body_${l}`, `Body ${l}`]]),
);

describe('normaliseSubscriberLang', () => {
  it('keeps the four site languages and drops the rest', () => {
    expect(normaliseSubscriberLang('ar')).toBe('ar');
    expect(normaliseSubscriberLang('EN')).toBe('en');
    expect(normaliseSubscriberLang('tr-TR')).toBe('tr');
    expect(normaliseSubscriberLang('de')).toBeNull();
    expect(normaliseSubscriberLang(null)).toBeNull();
    expect(normaliseSubscriberLang(undefined)).toBeNull();
  });
});

describe('availableLanguages', () => {
  it('needs both subject and body', () => {
    expect(availableLanguages({ subject_ar: 'x', body_ar: 'y', subject_en: 'x', body_tr: 'y' })).toEqual(['ar']);
    expect(incompleteLanguages({ subject_ar: 'x', body_ar: 'y', subject_en: 'x', body_tr: 'y' })).toEqual(['en', 'tr']);
  });
});

describe('languageForSubscriber', () => {
  it('gives each subscriber their own language when written', () => {
    const c = campaign(['ar', 'en', 'tr', 'ru']);
    expect(languageForSubscriber(c, 'ar')).toBe('ar');
    expect(languageForSubscriber(c, 'tr')).toBe('tr');
    expect(languageForSubscriber(c, 'ru')).toBe('ru');
  });

  it('falls back to English for TR/RU, then Arabic', () => {
    expect(languageForSubscriber(campaign(['ar', 'en']), 'tr')).toBe('en');
    expect(languageForSubscriber(campaign(['ar', 'en']), 'ru')).toBe('en');
    expect(languageForSubscriber(campaign(['ar']), 'tr')).toBe('ar');
    expect(languageForSubscriber(campaign(['en']), 'ar')).toBe('en');
  });

  it('unknown-language subscribers get the first written language (Arabic first)', () => {
    expect(languageForSubscriber(campaign(['ar', 'en']), null)).toBe('ar');
    expect(languageForSubscriber(campaign(['tr', 'en']), null)).toBe('en');
  });

  it('nothing written → null', () => {
    expect(languageForSubscriber({ subject_ar: 'only a subject' }, 'ar')).toBeNull();
  });
});
