import { describe, it, expect } from 'vitest';
import { __testInternals } from '../routes/admin-funnel.mjs';

const { FUNNEL_STEPS, bucketDate, addBuckets } = __testInternals;

/**
 * Pure-helper tests for the funnel + cohort analytics endpoint. The
 * SQL-touching paths are integration territory; here we cover the
 * date-bucketing math that's most likely to drift if a developer
 * tweaks the week-start convention.
 */

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
