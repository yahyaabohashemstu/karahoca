import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { __testInternals } from '../routes/admin-funnel.mjs';
import { resolveDayRange } from '../utils/dateRange.mjs';

// The SQL paths run against an in-memory visitor_events table.
const mem = vi.hoisted(() => ({ db: null }));
vi.mock('../db.mjs', () => ({ getDb: () => mem.db }));

const { FUNNEL_STEPS, bucketDate, addBuckets, computeFunnel, computeCohorts } = __testInternals;

/**
 * Tests for the funnel + cohort analytics endpoint: the date-bucketing
 * math that's most likely to drift if a developer tweaks the week-start
 * convention, plus the date-window and cohort-membership rules against
 * a seeded in-memory table.
 */

const freshDb = () => {
  mem.db = new Database(':memory:');
  mem.db.exec(`CREATE TABLE visitor_events (
    visitor_id TEXT, event_type TEXT, lang TEXT, payload_json TEXT, created_at TEXT
  )`);
};
const addEvent = (visitor_id, created_at, event_type = 'page_view', lang = 'ar') =>
  mem.db.prepare('INSERT INTO visitor_events (visitor_id, event_type, lang, created_at) VALUES (?,?,?,?)')
    .run(visitor_id, event_type, lang, created_at);

describe('FUNNEL_STEPS', () => {
  it('preserves the canonical KARAHOCA conversion order', () => {
    expect(FUNNEL_STEPS.map((s) => s.key)).toEqual([
      'page_view',
      'product_view',
      'chat_open',
      'chat_message_sent',
      'whatsapp_click',
    ]);
  });
});

describe('bucketDate (week)', () => {
  it('rolls back to the Monday of the same week', () => {
    // 2024-05-15 is a Wednesday → the bucket should be 2024-05-13.
    expect(bucketDate('2024-05-15T10:23:00Z', 'week')).toBe('2024-05-13');
  });
  it('keeps Monday as-is', () => {
    expect(bucketDate('2024-05-13T00:00:00Z', 'week')).toBe('2024-05-13');
  });
  it('rolls Sunday back to the PREVIOUS Monday (ISO 8601)', () => {
    // 2024-05-19 is a Sunday → bucket = 2024-05-13.
    expect(bucketDate('2024-05-19T23:59:00Z', 'week')).toBe('2024-05-13');
  });
  it('rejects garbage input', () => {
    expect(bucketDate('not a date', 'week')).toBeNull();
  });
  it('reads the SQLite space-separated timestamp as UTC', () => {
    // Monday 00:30 UTC — read as local time east of UTC it was Sunday.
    expect(bucketDate('2024-05-13 00:30:00', 'week')).toBe('2024-05-13');
    expect(bucketDate('2024-05-31 23:30:00', 'month')).toBe('2024-05-01');
  });
});

describe('bucketDate (month)', () => {
  it('rolls back to the first of the month', () => {
    expect(bucketDate('2024-05-15T10:23:00Z', 'month')).toBe('2024-05-01');
  });
  it('keeps the 1st as-is', () => {
    expect(bucketDate('2024-05-01T00:00:00Z', 'month')).toBe('2024-05-01');
  });
});

describe('addBuckets', () => {
  it('moves forward by N weeks when bucket=week', () => {
    expect(addBuckets('2024-05-13', 'week', 3)).toBe('2024-06-03');
  });
  it('moves backward by N weeks when n is negative', () => {
    expect(addBuckets('2024-05-13', 'week', -2)).toBe('2024-04-29');
  });
  it('moves forward by N months when bucket=month', () => {
    expect(addBuckets('2024-05-01', 'month', 2)).toBe('2024-07-01');
  });
  it('handles year boundaries for months', () => {
    expect(addBuckets('2024-11-01', 'month', 3)).toBe('2025-02-01');
  });
});

describe('computeFunnel date window', () => {
  beforeEach(freshDb);

  it('counts the whole of the last day, so From = To = today is not empty', () => {
    addEvent('v1', '2026-10-13 21:15:00');
    addEvent('v1', '2026-10-13 21:16:00', 'product_view');
    addEvent('v2', '2026-10-13 08:00:00');
    addEvent('v3', '2026-10-12 23:59:59'); // the day before
    addEvent('v4', '2026-10-14 00:00:00'); // the day after
    const range = resolveDayRange({ from: '2026-10-13', to: '2026-10-13' });
    const funnel = computeFunnel({ ...range, lang: null });
    expect(funnel[0]).toMatchObject({ key: 'page_view', visitors: 2 });
    expect(funnel[1]).toMatchObject({ key: 'product_view', visitors: 1, conversionFromStart: 50 });
  });
});

describe('computeCohorts', () => {
  beforeEach(freshDb);
  // Wednesday — the current week bucket is Monday 2026-10-12.
  const now = new Date('2026-10-14T12:00:00Z');

  it("builds cohorts from each visitor's first-ever event, not the first one in the window", () => {
    addEvent('old', '2026-03-02 10:00:00');  // first seen months ago…
    addEvent('old', '2026-10-06 10:00:00');  // …so this visit is a return, not a new cohort member
    addEvent('new', '2026-10-06 11:00:00');
    addEvent('new', '2026-10-13 11:00:00');
    const cohorts = computeCohorts({ bucket: 'week', periods: 4, lang: null, now });
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0]).toMatchObject({ cohort: '2026-10-05', size: 1 });
    expect(cohorts[0].retention[0]).toMatchObject({ returners: 1, pct: 100 });
    expect(cohorts[0].retention[1]).toMatchObject({ label: '2026-10-12', returners: 1, pct: 100 });
  });

  it('sends null for buckets that have not started yet, and 0 for a real zero', () => {
    addEvent('a', '2026-09-29 10:00:00');
    const [cohort] = computeCohorts({ bucket: 'week', periods: 4, lang: null, now });
    expect(cohort.cohort).toBe('2026-09-28');
    expect(cohort.retention.map((r) => r.pct)).toEqual([100, 0, 0, null]);
    expect(cohort.retention[3].returners).toBeNull();
  });

  it('filters by the language of the first event and keeps W+0 at 100%', () => {
    addEvent('ar-visitor', '2026-10-06 10:00:00', 'page_view', 'ar');
    addEvent('ar-visitor', '2026-10-13 10:00:00', 'page_view', 'en');
    addEvent('en-visitor', '2026-10-06 10:00:00', 'page_view', 'en');
    const [cohort] = computeCohorts({ bucket: 'week', periods: 2, lang: 'ar', now });
    expect(cohort).toMatchObject({ cohort: '2026-10-05', size: 1 });
    expect(cohort.retention.map((r) => r.pct)).toEqual([100, 100]);
  });
});
