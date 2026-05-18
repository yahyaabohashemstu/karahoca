import { describe, it, expect } from 'vitest';
import { __testInternals } from '../services/aiDescriptionWriter.mjs';

const { buildPrompt, normalize, tryParseJson } = __testInternals;

/**
 * Pure-helper tests for the AI description writer. The network call to
 * Gemini / OpenRouter is left alone (lives behind ENV-gated API keys);
 * the helpers below cover the parsing + shape-normalisation surface
 * which is where most failure modes actually land in practice.
 */

describe('buildPrompt', () => {
  it('embeds the product name, brand, and source language', () => {
    const prompt = buildPrompt({
      name: 'DIOX Floor Cleaner',
      brand: 'DIOX',
      category: 'Surface care',
      hint: 'lavender scent',
      sourceLang: 'en',
    });
    expect(prompt).toContain('DIOX Floor Cleaner');
    expect(prompt).toContain('Brand:           DIOX');
    expect(prompt).toContain('Source language: en');
    expect(prompt).toContain('lavender scent');
  });

  it('falls back to "(none)" for missing hint', () => {
    const prompt = buildPrompt({ name: 'X', brand: 'AYLUX', sourceLang: 'ar' });
    expect(prompt).toContain('Extra notes:     (none)');
  });

  it('switches tone-of-voice copy based on brand', () => {
    const dx = buildPrompt({ name: 'X', brand: 'DIOX', sourceLang: 'ar' });
    const ax = buildPrompt({ name: 'X', brand: 'AYLUX', sourceLang: 'ar' });
    expect(dx).toMatch(/value-conscious/i);
    expect(ax).toMatch(/fragrance|premium|sensorial/i);
  });

  it('requires lowercase two-letter JSON keys', () => {
    const prompt = buildPrompt({ name: 'X', brand: 'DIOX', sourceLang: 'ar' });
    expect(prompt).toMatch(/TOP-LEVEL keys MUST be exactly: "ar", "en", "tr", "ru"/);
  });
});

describe('tryParseJson', () => {
  it('parses clean JSON', () => {
    expect(tryParseJson('{"ar":"a","en":"b"}')).toEqual({ ar: 'a', en: 'b' });
  });

  it('strips markdown code fences', () => {
    expect(tryParseJson('```json\n{"ar":"a"}\n```')).toEqual({ ar: 'a' });
  });

  it('repairs unescaped newlines inside string values', () => {
    const broken = '{"ar":"line1\nline2","en":"single"}';
    const parsed = tryParseJson(broken);
    expect(parsed?.ar).toBe('line1\nline2');
    expect(parsed?.en).toBe('single');
  });

  it('returns null for irrecoverable garbage', () => {
    expect(tryParseJson('not json at all')).toBeNull();
  });
});

describe('normalize', () => {
  it('keeps only string values under recognised language keys', () => {
    const out = normalize({
      ar: 'منظف',
      en: 'Cleaner',
      tr: 42,            // wrong type → dropped
      ru: '',            // empty → dropped
      bogus: 'whatever', // unknown lang → dropped
    });
    expect(out).toEqual({ ar: 'منظف', en: 'Cleaner' });
  });

  it('trims whitespace from accepted strings', () => {
    const out = normalize({ ar: '  منظف  ' });
    expect(out).toEqual({ ar: 'منظف' });
  });

  it('returns null when nothing usable came through', () => {
    expect(normalize({})).toBeNull();
    expect(normalize({ es: 'spanish' })).toBeNull();
    expect(normalize(null)).toBeNull();
    expect(normalize('plain string')).toBeNull();
  });
});
