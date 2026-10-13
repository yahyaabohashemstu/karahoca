import { describe, expect, it } from 'vitest';
import {
  inferUtcOffsetMinutes,
  parseDisplayTime,
  reconstructVisitorTimestamps,
} from '../services/chatTimestamps.mjs';

describe('parseDisplayTime', () => {
  it('reads the four widget locales', () => {
    expect(parseDisplayTime('٠٣:٣٧ م')).toBe(15 * 60 + 37); // ar-EG PM
    expect(parseDisplayTime('٠٩:٣٠ ص')).toBe(9 * 60 + 30); // ar-EG AM
    expect(parseDisplayTime('03:37 PM')).toBe(15 * 60 + 37); // en-US
    expect(parseDisplayTime('15:37')).toBe(15 * 60 + 37); // tr-TR / ru-RU
  });

  it('handles 12 AM / 12 PM', () => {
    expect(parseDisplayTime('12:05 AM')).toBe(5);
    expect(parseDisplayTime('12:05 PM')).toBe(12 * 60 + 5);
    expect(parseDisplayTime('١٢:٠٥ ص')).toBe(5);
    expect(parseDisplayTime('١٢:٠٥ م')).toBe(12 * 60 + 5);
  });

  it('rejects anything that is not a clock', () => {
    expect(parseDisplayTime('')).toBeNull();
    expect(parseDisplayTime('hello')).toBeNull();
    expect(parseDisplayTime('25:10')).toBeNull();
    expect(parseDisplayTime('13:10 PM')).toBeNull();
    expect(parseDisplayTime(undefined)).toBeNull();
  });
});

describe('inferUtcOffsetMinutes', () => {
  it('finds Istanbul (+3) from a local clock and a UTC instant', () => {
    expect(inferUtcOffsetMinutes(10 * 60 + 7, Date.parse('2026-04-16T07:07:50Z'))).toBe(180);
  });
  it('wraps across midnight', () => {
    // 01:30 local on the 17th = 22:30 UTC on the 16th.
    expect(inferUtcOffsetMinutes(90, Date.parse('2026-04-16T22:30:10Z'))).toBe(180);
    // 23:00 local (UTC−5) = 04:00 UTC next day.
    expect(inferUtcOffsetMinutes(23 * 60, Date.parse('2026-04-17T04:00:20Z'))).toBe(-300);
  });
});

const user = (first, last) => ({ first_seen: first, last_seen: last });

describe('reconstructVisitorTimestamps', () => {
  it('one visit: real times on the first-visit day', () => {
    const out = reconstructVisitorTimestamps(
      [
        { id: 1, created_at: '١٠:٠٧ ص' },
        { id: 2, created_at: '١٠:٠٧ ص' },
        { id: 3, created_at: '١٠:٠٩ ص' },
      ],
      user('2026-04-16T07:07:50.874Z', '2026-04-16T07:09:30.000Z'),
    );
    expect(out.get(1)).toBe('2026-04-16T07:07:00.000Z');
    expect(out.get(3)).toBe('2026-04-16T07:09:00.000Z');
  });

  it('a visit that crosses local midnight moves to the next day', () => {
    const out = reconstructVisitorTimestamps(
      [
        { id: 10, created_at: '11:58 PM' },
        { id: 11, created_at: '12:03 AM' },
      ],
      // 23:58 at UTC+3 = 20:58 UTC.
      user('2026-04-10T20:58:20.000Z', '2026-04-10T21:03:40.000Z'),
    );
    expect(out.get(10)).toBe('2026-04-10T20:58:00.000Z');
    expect(out.get(11)).toBe('2026-04-10T21:03:00.000Z');
  });

  it('a return visit days later lands after the longest pause', () => {
    const out = reconstructVisitorTimestamps(
      [
        { id: 1, created_at: '10:07' },
        { id: 2, created_at: '10:08' },
        { id: 3, created_at: '15:47' }, // same day, later
        { id: 4, created_at: '09:30' }, // two days later
        { id: 5, created_at: '09:31' },
      ],
      user('2026-04-16T07:07:30.000Z', '2026-04-18T06:31:10.000Z'),
    );
    expect(out.get(3)).toBe('2026-04-16T12:47:00.000Z');
    expect(out.get(4)).toBe('2026-04-18T06:30:00.000Z');
    expect(out.get(5)).toBe('2026-04-18T06:31:00.000Z');
  });

  it('never goes past the last visit and survives an unreadable clock', () => {
    const out = reconstructVisitorTimestamps(
      [
        { id: 1, created_at: '09:00' },
        { id: 2, created_at: '???' },
      ],
      user('2026-04-01T06:00:05.000Z', '2026-04-01T06:01:00.000Z'),
    );
    expect(out.get(1)).toBe('2026-04-01T06:00:00.000Z');
    expect(out.get(2)).toBe('2026-04-01T06:00:00.000Z');
  });

  it('nothing to anchor on → returns nothing', () => {
    expect(reconstructVisitorTimestamps([{ id: 1, created_at: 'x' }], user('', '')).size).toBe(0);
  });
});
