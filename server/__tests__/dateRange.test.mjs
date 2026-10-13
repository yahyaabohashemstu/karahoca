import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import {
  parseDay, addDays, spanDays, eachDay, fillDays, resolveDayRange, MAX_RANGE_DAYS,
} from '../utils/dateRange.mjs';

/**
 * The admin's date filters are date-only ('YYYY-MM-DD') while stored
 * timestamps come in two TEXT shapes. These tests pin the helper's
 * validation and, against a real SQLite, the reason it exists: the
 * `>= from AND < toExclusive` pair counts the whole of both end days for
 * both shapes.
 */

const TODAY = '2026-10-13';

describe('parseDay', () => {
  it('accepts a real calendar day', () => {
    expect(parseDay('2026-10-13')).toBe('2026-10-13');
    expect(parseDay('2024-02-29')).toBe('2024-02-29');
  });
  it('rejects impossible days instead of rolling them over', () => {
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('2025-02-29')).toBeNull();
    expect(parseDay('2026-13-01')).toBeNull();
  });
  it('rejects anything that is not exactly YYYY-MM-DD', () => {
    expect(parseDay('2026-10-13T00:00:00Z')).toBeNull();
    expect(parseDay('2026-10-13 00:00:00')).toBeNull();
    expect(parseDay('13/10/2026')).toBeNull();
    expect(parseDay("2026-10-13' OR 1=1 --")).toBeNull();
    expect(parseDay('')).toBeNull();
    expect(parseDay(null)).toBeNull();
  });
});

describe('day arithmetic', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('counts both ends of a span', () => {
    expect(spanDays('2026-10-13', '2026-10-13')).toBe(1);
    expect(spanDays('2026-10-01', '2026-10-31')).toBe(31);
  });
  it('lists every day of a range', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('fillDays', () => {
  it('fills the quiet days with zeros and keeps the busy ones', () => {
    const rows = [{ date: '2026-10-11', count: 4 }, { date: '2026-10-13', count: 2 }];
    expect(fillDays(rows, '2026-10-10', '2026-10-13', 'date', (date) => ({ date, count: 0 }))).toEqual([
      { date: '2026-10-10', count: 0 },
      { date: '2026-10-11', count: 4 },
      { date: '2026-10-12', count: 0 },
      { date: '2026-10-13', count: 2 },
    ]);
  });
});

describe('resolveDayRange', () => {
  it('turns From = To into one whole day', () => {
    expect(resolveDayRange({ from: TODAY, to: TODAY }, { today: TODAY })).toEqual({
      from: TODAY, to: TODAY, toExclusive: '2026-10-14', days: 1,
    });
  });
  it('defaults to the last N days up to today', () => {
    expect(resolveDayRange({}, { defaultDays: 30, today: TODAY })).toMatchObject({
      from: '2026-09-13', to: TODAY, toExclusive: '2026-10-14',
    });
    expect(resolveDayRange({ to: '2026-01-31' }, { defaultDays: 7, today: TODAY })).toMatchObject({
      from: '2026-01-24', to: '2026-01-31',
    });
  });
  it('leaves missing bounds open when there is no default', () => {
    expect(resolveDayRange({}, { defaultDays: null, maxDays: null })).toEqual({
      from: null, to: null, toExclusive: null, days: null,
    });
    expect(resolveDayRange({ to: TODAY }, { defaultDays: null, maxDays: null })).toMatchObject({
      from: null, toExclusive: '2026-10-14',
    });
  });
  it('rejects malformed days, a reversed range and an over-long span', () => {
    expect(resolveDayRange({ from: '2026-10-13T00:00:00Z' }).error).toMatch(/from/);
    expect(resolveDayRange({ to: 'yesterday' }).error).toMatch(/to/);
    expect(resolveDayRange({ from: '2026-10-14', to: TODAY }).error).toMatch(/on or before/);
    expect(resolveDayRange({ from: '2024-01-01', to: TODAY }).error).toMatch(String(MAX_RANGE_DAYS));
    expect(resolveDayRange({ from: '2024-01-01', to: TODAY }, { maxDays: null }).error).toBeUndefined();
  });
});

describe('the bounds against both stored timestamp shapes', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE ev (created_at TEXT)');
  const insert = db.prepare('INSERT INTO ev VALUES (?)');
  for (const ts of [
    '2026-10-12 23:59:59',      // the day before — out
    '2026-10-13 00:00:00',      // SQLite datetime('now') shape — in
    '2026-10-13 23:59:59',
    '2026-10-13T00:00:00.000Z', // JS toISOString shape — in
    '2026-10-13T23:59:59.999Z',
    '2026-10-14 00:00:00',      // the day after — out
    '2026-10-14T00:00:00.000Z',
  ]) insert.run(ts);

  it('counts the whole of a single day in both shapes, and nothing else', () => {
    const { from, toExclusive } = resolveDayRange({ from: TODAY, to: TODAY });
    const { c } = db.prepare('SELECT COUNT(*) AS c FROM ev WHERE created_at >= ? AND created_at < ?').get(from, toExclusive);
    expect(c).toBe(4);
  });
});
