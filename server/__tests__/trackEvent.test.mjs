import { describe, expect, it } from 'vitest';
import { normaliseEvent } from '../routes/api-track.mjs';

/**
 * The route handler trusts `normaliseEvent` to drop anything malformed.
 * Pinning the validation here protects two invariants the SQL insert
 * relies on:
 *   - `event_type` is always one of the known allow-list values, so
 *     the analytics dashboard can group by type without a NULL guard.
 *   - String columns can never exceed their truncation cap, so an
 *     adversarial 10MB user-agent can't bloat the row or run the
 *     parameter binding out of bounds.
 */

describe('normaliseEvent — allow-list', () => {
  it('accepts a known event_type', () => {
    const out = normaliseEvent({ event_type: 'page_view', page_path: '/ar' });
    expect(out).not.toBeNull();
    expect(out.event_type).toBe('page_view');
    expect(out.page_path).toBe('/ar');
  });

  it('drops unknown event_type silently', () => {
    expect(normaliseEvent({ event_type: 'wat_is_dis' })).toBeNull();
  });

  it('drops events with missing event_type', () => {
    expect(normaliseEvent({ page_path: '/ar' })).toBeNull();
    expect(normaliseEvent({})).toBeNull();
    expect(normaliseEvent(null)).toBeNull();
    expect(normaliseEvent('string')).toBeNull();
  });
});

describe('normaliseEvent — string truncation', () => {
  it('truncates page_path to MAX_STRING_LEN', () => {
    const huge = '/x' + 'A'.repeat(2000);
    const out = normaliseEvent({ event_type: 'page_view', page_path: huge });
    expect(out.page_path.length).toBeLessThanOrEqual(512);
  });

  it('truncates product_id to its tighter 128-char cap', () => {
    const huge = 'p'.repeat(500);
    const out = normaliseEvent({ event_type: 'product_view', product_id: huge });
    expect(out.product_id.length).toBeLessThanOrEqual(128);
  });

  it('truncates lang to 8 chars (defensive — real codes are 2)', () => {
    const out = normaliseEvent({ event_type: 'page_view', lang: 'pt-BR-extralong' });
    expect(out.lang.length).toBeLessThanOrEqual(8);
  });

  it('nulls non-string string fields', () => {
    const out = normaliseEvent({ event_type: 'page_view', page_path: 12345, product_id: {} });
    expect(out.page_path).toBeNull();
    expect(out.product_id).toBeNull();
  });
});

describe('normaliseEvent — payload', () => {
  it('serialises a small object payload', () => {
    const out = normaliseEvent({ event_type: 'whatsapp_click', payload: { source: 'card' } });
    expect(JSON.parse(out.payload_json)).toEqual({ source: 'card' });
  });

  it('drops oversized payloads but keeps the event', () => {
    const huge = { data: 'X'.repeat(3000) };
    const out = normaliseEvent({ event_type: 'page_view', payload: huge });
    expect(out).not.toBeNull();
    expect(out.payload_json).toBeNull();
  });

  it('survives circular payloads without throwing', () => {
    const cyclic = {};
    cyclic.self = cyclic;
    let out = null;
    expect(() => { out = normaliseEvent({ event_type: 'page_view', payload: cyclic }); }).not.toThrow();
    expect(out).not.toBeNull();
    expect(out.payload_json).toBeNull();
  });

  it('drops non-object payloads silently', () => {
    const out = normaliseEvent({ event_type: 'page_view', payload: 'not-an-object' });
    expect(out.payload_json).toBeNull();
  });
});

describe('normaliseEvent — full vocabulary', () => {
  const vocab = [
    'page_view', 'language_switch', 'product_view', 'product_modal_open',
    'product_share_whatsapp', 'wishlist_add', 'wishlist_remove',
    'whatsapp_click', 'email_click', 'phone_click',
    'chat_open', 'chat_close', 'chat_message_sent',
    'chat_followup_chip_used', 'chat_continue_whatsapp',
    'search_query', 'newsletter_subscribe',
  ];

  for (const type of vocab) {
    it(`accepts '${type}'`, () => {
      const out = normaliseEvent({ event_type: type });
      expect(out).not.toBeNull();
      expect(out.event_type).toBe(type);
    });
  }
});
