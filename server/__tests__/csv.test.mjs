import { describe, it, expect } from 'vitest';
import {
  parseCsvRows, parseCsvObjects, stringifyCsv, formatCsvCell,
  detectDelimiter, stripFormulaGuard, hasEncodingDamage,
} from '../services/csv.mjs';

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

  // Excel in a Turkish / Russian locale saves "CSV" with semicolons.
  it('reads a semicolon-separated file', () => {
    const out = parseCsvRows('\uFEFFid;name;note\r\n1;Temizleyici;"a; b"\r\n2;"1,5 L";x\r\n');
    expect(out).toEqual([['id', 'name', 'note'], ['1', 'Temizleyici', 'a; b'], ['2', '1,5 L', 'x']]);
  });

  it('keeps commas as the delimiter when the header uses them', () => {
    const out = parseCsvRows('a,b\n"x;y",2');
    expect(out).toEqual([['a', 'b'], ['x;y', '2']]);
  });

  it('honours an explicit delimiter', () => {
    expect(parseCsvRows('a;b,c', { delimiter: ',' })).toEqual([['a;b', 'c']]);
  });
});

describe('detectDelimiter', () => {
  it('picks whichever of , and ; the header line uses', () => {
    expect(detectDelimiter('id,brand,name\n1;2;3')).toBe(',');
    expect(detectDelimiter('id;brand;name\n1,2,3')).toBe(';');
  });

  it('ignores delimiters inside quoted header cells', () => {
    expect(detectDelimiter('"a;b;c",d,e')).toBe(',');
  });

  it('defaults to a comma for a single-column file', () => {
    expect(detectDelimiter('name\nfoo')).toBe(',');
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

  // Excel leaves ",,,," rows for cells that were once touched.
  it('skips rows whose cells are all blank and reports the original row numbers', () => {
    const { records, rowNumbers } = parseCsvObjects('id,name\r\n1,A\r\n,\r\n , \r\n2,B\r\n,,\r\n');
    expect(records).toEqual([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
    expect(rowNumbers).toEqual([2, 5]);
  });

  it('parses a semicolon file into objects', () => {
    const { records } = parseCsvObjects('id;name_tr\n7;Yüzey temizleyici');
    expect(records).toEqual([{ id: '7', name_tr: 'Yüzey temizleyici' }]);
  });
});

describe('stripFormulaGuard', () => {
  it('undoes the export guard so a round trip is lossless', () => {
    for (const value of ['- Removes grease', '=SUM(A1)', '+90 212 000', '@home', '\tindented']) {
      expect(stripFormulaGuard(formatCsvCell(value).replace(/^"|"$/g, ''))).toBe(value);
    }
  });

  it('leaves other leading apostrophes alone', () => {
    expect(stripFormulaGuard("'quoted'")).toBe("'quoted'");
    expect(stripFormulaGuard("it's fine")).toBe("it's fine");
    expect(stripFormulaGuard('')).toBe('');
  });

  it('survives stringify → parse for a whole record', () => {
    const csv = stringifyCsv([{ id: 'x', description_en: '- Removes grease\n- Safe on tiles' }], ['id', 'description_en']);
    const { records } = parseCsvObjects(csv);
    expect(stripFormulaGuard(records[0].description_en)).toBe('- Removes grease\n- Safe on tiles');
  });
});

describe('hasEncodingDamage', () => {
  it('flags text that was not UTF-8 (U+FFFD replacement characters)', () => {
    expect(hasEncodingDamage('id,name_tr\n1,Y\uFFFDzey')).toBe(true);
  });

  it('accepts clean UTF-8 text in every site language', () => {
    expect(hasEncodingDamage('ar,tr,ru\nمنظف,Yüzey,средство')).toBe(false);
    expect(hasEncodingDamage(undefined)).toBe(false);
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
