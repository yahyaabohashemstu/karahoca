import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// One in-memory database for the module's lifetime (it creates its table
// once); every test empties the state row instead.
const mem = vi.hoisted(() => ({ db: null }));
vi.mock('../services/db.mjs', () => ({ getDb: () => mem.db }));

mem.db = new Database(':memory:');
const {
  markSiteChanged,
  getSiteRebuildStatus,
  processSiteRebuild,
  triggerSiteRebuild,
} = await import('../services/siteRebuild.mjs');

const MIN = 60 * 1000;
const T0 = Date.parse('2026-10-13T10:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  getSiteRebuildStatus(); // creates the table + row
  mem.db.prepare(`UPDATE site_rebuild_state SET pending_since=NULL, last_change_at=NULL, last_change_reason=NULL,
    last_triggered_at=NULL, last_status=NULL, last_error=NULL, next_attempt_at=NULL`).run();
  process.env.SITE_REBUILD_WEBHOOK_URL = 'https://coolify.test/api/v1/deploy?uuid=web&force=false';
  process.env.SITE_REBUILD_WEBHOOK_TOKEN = 'token-123';
  delete process.env.SITE_REBUILD_DELAY_MINUTES;
  globalThis.fetch = vi.fn(async () => new Response('{"deployments":[]}', { status: 200 }));
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.SITE_REBUILD_WEBHOOK_URL;
  delete process.env.SITE_REBUILD_WEBHOOK_TOKEN;
});

describe('site rebuild debounce', () => {
  it('waits for 5 quiet minutes, then calls the webhook once with the token', async () => {
    markSiteChanged('PUT /api/admin/products/x');
    await processSiteRebuild();
    expect(fetch).not.toHaveBeenCalled();

    vi.setSystemTime(T0 + 3 * MIN);
    markSiteChanged('PUT /api/admin/news/y'); // another edit restarts the quiet period
    vi.setSystemTime(T0 + 7 * MIN);
    await processSiteRebuild();
    expect(fetch).not.toHaveBeenCalled();

    vi.setSystemTime(T0 + 8 * MIN + 1);
    await processSiteRebuild();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('uuid=web');
    expect(init.headers.Authorization).toBe('Bearer token-123');

    const status = getSiteRebuildStatus();
    expect(status.pending).toBe(false);
    expect(status.lastStatus).toBe('ok');

    await processSiteRebuild(); // nothing pending any more
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a steady stream of edits still rebuilds within 30 minutes', async () => {
    for (let m = 0; m <= 30; m += 2) {
      vi.setSystemTime(T0 + m * MIN);
      markSiteChanged('edit');
      await processSiteRebuild();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('a failed call is retried 10 minutes later and keeps the change pending', async () => {
    fetch.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    markSiteChanged('edit');
    vi.setSystemTime(T0 + 6 * MIN);
    await processSiteRebuild();
    let status = getSiteRebuildStatus();
    expect(status.pending).toBe(true);
    expect(status.lastStatus).toBe('error');
    expect(status.lastError).toContain('401');

    vi.setSystemTime(T0 + 10 * MIN);
    await processSiteRebuild();
    expect(fetch).toHaveBeenCalledTimes(1); // still backing off

    vi.setSystemTime(T0 + 16 * MIN + 1);
    await processSiteRebuild();
    expect(fetch).toHaveBeenCalledTimes(2);
    status = getSiteRebuildStatus();
    expect(status.pending).toBe(false);
  });

  it('without a webhook URL it only tracks the change', async () => {
    delete process.env.SITE_REBUILD_WEBHOOK_URL;
    markSiteChanged('edit');
    vi.setSystemTime(T0 + 60 * MIN);
    await processSiteRebuild();
    expect(fetch).not.toHaveBeenCalled();
    const status = getSiteRebuildStatus();
    expect(status.configured).toBe(false);
    expect(status.pending).toBe(true);
    await expect(triggerSiteRebuild()).rejects.toThrow(/not set up/);
  });
});
