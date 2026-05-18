import { describe, it, expect } from 'vitest';
import { parseCsvRows, parseCsvObjects, stringifyCsv, formatCsvCell } from '../services/csv.mjs';

/**
 * Behaviour pins for the dependency-free CSV reader/writer used by the
 * admin product import/export flow. The parser handles the subset of
 * RFC 4180 KARAHOCA's tooling needs — anything else is a deliberate
 * non-feature (see the module header for the full list).
 */

describe('parseCsvRows', () => {
  it('parses a simple comma-separated file', () => {
    const out = parseCsvRows('a,b,c\n1,2,3\n4,5,6');
    expect(out).toEqual([['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']]);
  });

  it('handles CRLF line endings', () => {
    const out = parseCsvRows('a,b\r\n1,2\r\n3,4\r\n');
    expect(out).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('strips a UTF-8 BOM', () => {
    const out = parseCsvRows('﻿a,b\n1,2');
    expect(out[0]).toEqual(['a', 'b']);
  });

  it('respects quoted cells containing commas and newlines', () => {
    const out = parseCsvRows('a,b\n"hello, world","line1\nline2"\n');
    expect(out[1]).toEqual(['hello, world', 'line1\nline2']);
  });

  it('handles escaped quotes inside quoted cells', () => {
    const out = parseCsvRows('a\n"she said ""hi"""');
    expect(out[1][0]).toBe('she said "hi"');
  });

  it('skips empty trailing rows', () => {
    const out = parseCsvRows('a,b\n1,2\n\n');
    expect(out).toHaveLength(2);
  });
});

describe('parseCsvObjects', () => {
  it('uses the first row as keys', () => {
    const { headers, records } = parseCsvObjects('id,name\n1,Alice\n2,Bob');
    expect(headers).toEqual(['id', 'name']);
    expect(records).toEqual([{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]);
  });

  it('preserves Arabic + Russian content unchanged', () => {
    const { records } = parseCsvObjects('lang,text\nar,منظف الأرضيات\nru,средство для пола');
    expect(records[0]).toEqual({ lang: 'ar', text: 'منظف الأرضيات' });
    expect(records[1]).toEqual({ lang: 'ru', text: 'средство для пола' });
  });

  it('returns empty records when the file has only a header', () => {
    const { records } = parseCsvObjects('a,b');
    expect(records).toEqual([]);
  });
});

describe('formatCsvCell', () => {
  it('returns the value unchanged for safe content', () => {
    expect(formatCsvCell('hello')).toBe('hello');
  });

  it('wraps cells containing commas in quotes', () => {
    expect(formatCsvCell('a, b')).toBe('"a, b"');
  });

  it('doubles internal quotes', () => {
    expect(formatCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('prefixes formula-leading characters with a single quote', () => {
    expect(formatCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(formatCsvCell('+1234')).toBe("'+1234");
    expect(formatCsvCell('-name')).toBe("'-name");
    expect(formatCsvCell('@admin')).toBe("'@admin");
  });

  it('returns an empty string for null / undefined', () => {
    expect(formatCsvCell(null)).toBe('');
    expect(formatCsvCell(undefined)).toBe('');
  });
});

describe('stringifyCsv', () => {
  it('round-trips through parseCsvObjects without losing data', () => {
    const input = [
      { id: '1', name: 'Pine, Citrus & Mint', extra: 'simple' },
      { id: '2', name: 'Multi-line\nnote',    extra: '' },
    ];
    const csv = stringifyCsv(input, ['id', 'name', 'extra']);
    const { records } = parseCsvObjects(csv);
    expect(records).toEqual([
      { id: '1', name: 'Pine, Citrus & Mint', extra: 'simple' },
      { id: '2', name: 'Multi-line\nnote',    extra: '' },
    ]);
  });

  it('prefixes the file with a BOM so Excel detects UTF-8', () => {
    const csv = stringifyCsv([{ a: '1' }], ['a']);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  it('uses CRLF row terminators for cross-platform compatibility', () => {
    const csv = stringifyCsv([{ a: 1 }, { a: 2 }], ['a']);
    expect(csv).toContain('\r\n');
  });
});
