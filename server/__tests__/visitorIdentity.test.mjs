import { describe, expect, it, beforeEach } from 'vitest';
import { resolveVisitorId } from '../middlewares/visitorIdentity.mjs';

/**
 * `resolveVisitorId` is a tiny header/cookie resolver but it sits on the
 * hot path of every request — these tests pin its behaviour so future
 * refactors don't silently lose visitor attribution.
 */

const fakeReq = (overrides = {}) => ({
  headers: {},
  ...overrides,
});

describe('resolveVisitorId — header wins over cookie', () => {
  it('reads X-Visitor-Id from headers (lowercase, Node convention)', () => {
    const req = fakeReq({ headers: { 'x-visitor-id': 'abcd1234efgh5678' } });
    const id = resolveVisitorId(req);
    expect(id).toBe('abcd1234efgh5678');
    expect(req.visitorId).toBe('abcd1234efgh5678');
  });

  it('reads from kara_visitor_id cookie when the header is missing', () => {
    const req = fakeReq({
      headers: { cookie: 'kara_visitor_id=cookie-value-here; foo=bar' },
    });
    const id = resolveVisitorId(req);
    expect(id).toBe('cookie-value-here');
  });

  it('prefers the header over the cookie when both are present', () => {
    const req = fakeReq({
      headers: {
        'x-visitor-id': 'header-id-wins-1234',
        cookie: 'kara_visitor_id=cookie-loses; another=val',
      },
    });
    const id = resolveVisitorId(req);
    expect(id).toBe('header-id-wins-1234');
  });
});

describe('resolveVisitorId — validation', () => {
  beforeEach(() => {
    // no shared state; each test builds its own req
  });

  it('rejects values shorter than 8 chars', () => {
    const req = fakeReq({ headers: { 'x-visitor-id': 'short' } });
    expect(resolveVisitorId(req)).toBe(null);
    expect(req.visitorId).toBe(null);
  });

  it('rejects values longer than 64 chars', () => {
    const longId = 'a'.repeat(65);
    const req = fakeReq({ headers: { 'x-visitor-id': longId } });
    expect(resolveVisitorId(req)).toBe(null);
  });

  it('rejects values with non-alphanumeric / hyphen / underscore chars (SQL-injection defence)', () => {
    const malicious = "abc';DROP TABLE--";
    const req = fakeReq({ headers: { 'x-visitor-id': malicious } });
    expect(resolveVisitorId(req)).toBe(null);
  });

  it('accepts UUID v4 format (8-4-4-4-12 with hyphens)', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const req = fakeReq({ headers: { 'x-visitor-id': uuid } });
    expect(resolveVisitorId(req)).toBe(uuid);
  });

  it('falls through to cookie when the header is malformed', () => {
    const req = fakeReq({
      headers: {
        'x-visitor-id': 'bad!chars!',
        cookie: 'kara_visitor_id=550e8400-e29b-41d4-a716-446655440000',
      },
    });
    expect(resolveVisitorId(req)).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('resolveVisitorId — anonymous fallback', () => {
  it('returns null and attaches null when nothing is present', () => {
    const req = fakeReq();
    expect(resolveVisitorId(req)).toBe(null);
    expect(req.visitorId).toBe(null);
  });

  it('returns null when only an unrelated cookie is set', () => {
    const req = fakeReq({ headers: { cookie: 'session=abc; karahoca_csrf=xyz' } });
    expect(resolveVisitorId(req)).toBe(null);
  });

  it('survives a corrupted cookie header without throwing', () => {
    const req = fakeReq({ headers: { cookie: '%%%==garbage' } });
    expect(() => resolveVisitorId(req)).not.toThrow();
  });
});
