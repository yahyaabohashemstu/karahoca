import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// The route reads an in-memory copy of the two tables it aggregates.
const mem = vi.hoisted(() => ({ db: null }));
vi.mock('../services/db.mjs', () => ({ getDb: () => mem.db }));

const { handleKaroInsights } = await import('../routes/admin-karo-insights.mjs');

/**
 * Karo Insights: the date window (both stored timestamp shapes, first
 * and last day included), the zero-filled daily series, and the
 * WhatsApp CTR, which only counts chat openers who went to WhatsApp
 * from the chat itself.
 */

const addEvent = (visitor_id, event_type, created_at, payload) =>
  mem.db.prepare('INSERT INTO visitor_events (visitor_id, event_type, payload_json, created_at) VALUES (?,?,?,?)')
    .run(visitor_id, event_type, payload ? JSON.stringify(payload) : null, created_at);

const insights = (query) => {
  const res = {
    writeHead(status) { this.status = status; },
    setHeader() {},
    end(body) { this.body = JSON.parse(body); },
  };
  handleKaroInsights({ url: `/api/admin/karo-insights?${query}` }, res, { origin: '' });
  return res;
};

beforeEach(() => {
  mem.db = new Database(':memory:');
  mem.db.exec(`
    CREATE TABLE visitor_events (
      visitor_id TEXT, event_type TEXT, page_path TEXT, product_id TEXT, lang TEXT,
      ip_country TEXT, payload_json TEXT, created_at TEXT
    );
    CREATE TABLE chat_messages (user_id TEXT, role TEXT, content TEXT, created_at TEXT);
  `);
});

describe('GET /api/admin/karo-insights', () => {
  it('includes the first and last day for both timestamp shapes', () => {
    addEvent('a', 'chat_open', '2026-10-10 00:00:05'); // first second of the first day
    addEvent('b', 'chat_open', '2026-10-12 23:59:59'); // last second of the last day
    addEvent('c', 'chat_open', '2026-10-13 00:00:00'); // the day after
    mem.db.prepare('INSERT INTO chat_messages VALUES (?,?,?,?)').run('u', 'user', 'hi', '2026-10-10T00:00:01.000Z');
    mem.db.prepare('INSERT INTO chat_messages VALUES (?,?,?,?)').run('u', 'user', 'hi', '2026-10-12T23:59:59.999Z');
    const { status, body } = insights('from=2026-10-10&to=2026-10-12');
    expect(status).toBe(200);
    expect(body.kpi).toMatchObject({ chatOpens: 2, uniqueVisitors: 2, totalMessages: 2 });
  });

  it('returns every day of the range, quiet days as 0', () => {
    addEvent('a', 'chat_open', '2026-10-10 12:00:00');
    const { body } = insights('from=2026-10-09&to=2026-10-11');
    expect(body.byDay).toEqual([
      { day: '2026-10-09', unique_visitors: 0, opens: 0 },
      { day: '2026-10-10', unique_visitors: 1, opens: 1 },
      { day: '2026-10-11', unique_visitors: 0, opens: 0 },
    ]);
  });

  it('counts only in-chat WhatsApp clicks by chat openers in the CTR', () => {
    addEvent('a', 'chat_open', '2026-10-10 10:00:00');
    addEvent('a', 'whatsapp_click', '2026-10-10 10:01:00', { source: 'chat_card' });
    addEvent('b', 'chat_open', '2026-10-10 11:00:00');
    addEvent('b', 'whatsapp_click', '2026-10-10 11:01:00', { source: 'floating_button' });
    addEvent('c', 'chat_open', '2026-10-10 12:00:00');
    addEvent('c', 'chat_continue_whatsapp', '2026-10-10 12:05:00');
    addEvent('d', 'chat_open', '2026-10-10 13:00:00');
    // Floating-button clicks from visitors who never opened the chat.
    for (const v of ['x', 'y', 'z', 'w', 'q']) {
      addEvent(v, 'whatsapp_click', '2026-10-10 14:00:00', { source: 'floating_button' });
    }
    const { body } = insights('from=2026-10-10&to=2026-10-10');
    expect(body.kpi.whatsappCtr).toBe(50);
  });

  it('rejects a reversed range with a 400', () => {
    const { status, body } = insights('from=2026-10-13&to=2026-10-12');
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});
