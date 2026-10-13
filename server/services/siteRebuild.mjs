/**
 * Keeps the pre-rendered public pages in step with the content.
 *
 * The web image renders every page to static HTML at build time
 * (scripts/prerender.mjs, data from this API). Visitors' browsers then
 * fetch live data, but search engines, link previews and no-JS visitors
 * read that HTML — which only changed on the next deploy, so a new,
 * edited, unpublished or deleted product/article stayed stale there.
 *
 * Every content change marks the snapshot stale; once the admin has been
 * quiet for SITE_REBUILD_DELAY_MINUTES (default 5) — or at most 30 minutes
 * after the first unrefreshed change — the web service's deploy webhook is
 * called once, so a burst of edits costs a single rebuild.
 *
 * Env (API service):
 *   SITE_REBUILD_WEBHOOK_URL    Coolify → karahoca-web → Webhooks → Deploy
 *                               Webhook, e.g. https://<coolify>/api/v1/deploy?uuid=…&force=false
 *   SITE_REBUILD_WEBHOOK_TOKEN  Coolify API token (Keys & Tokens, "deploy"
 *                               permission), sent as "Authorization: Bearer …"
 *   SITE_REBUILD_DELAY_MINUTES  quiet period before rebuilding (default 5)
 * Without the URL nothing is called; the dashboard shows the snapshot as
 * out of date and how to switch this on.
 */
import { getDb } from './db.mjs';
import { logger } from '../utils/logger.mjs';

const MINUTE_MS = 60 * 1000;
const MAX_WAIT_MS = 30 * MINUTE_MS;
const RETRY_MS = 10 * MINUTE_MS;

const readConfig = () => {
  const delay = Number.parseInt(process.env.SITE_REBUILD_DELAY_MINUTES || '', 10);
  return {
    url: (process.env.SITE_REBUILD_WEBHOOK_URL || '').trim(),
    token: (process.env.SITE_REBUILD_WEBHOOK_TOKEN || '').trim(),
    quietMs: (Number.isFinite(delay) ? Math.min(Math.max(delay, 1), 120) : 5) * MINUTE_MS,
  };
};

let tableReady = false;
const db = () => {
  const handle = getDb();
  if (!tableReady) {
    handle.exec(`
      CREATE TABLE IF NOT EXISTS site_rebuild_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pending_since TEXT,
        last_change_at TEXT,
        last_change_reason TEXT,
        last_triggered_at TEXT,
        last_status TEXT,
        last_error TEXT,
        next_attempt_at TEXT
      )
    `);
    handle.prepare('INSERT OR IGNORE INTO site_rebuild_state(id) VALUES (1)').run();
    tableReady = true;
  }
  return handle;
};

const readState = () => db().prepare('SELECT * FROM site_rebuild_state WHERE id = 1').get();
const ms = (iso) => (iso ? Date.parse(iso) : NaN);

/** Record a change that the pre-rendered pages don't show yet. Never throws. */
export const markSiteChanged = (reason) => {
  try {
    const now = new Date().toISOString();
    db().prepare(`
      UPDATE site_rebuild_state
      SET pending_since = COALESCE(pending_since, ?), last_change_at = ?, last_change_reason = ?
      WHERE id = 1
    `).run(now, now, String(reason || 'content change').slice(0, 200));
  } catch (err) {
    logger.warn({ err }, '[site-rebuild] could not record a content change');
  }
};

/** When the next automatic rebuild is due (ms), or null when nothing is pending. */
const dueAt = (state, config) => {
  if (!state?.pending_since) return null;
  const quietDue = ms(state.last_change_at) + config.quietMs;
  const capDue = ms(state.pending_since) + MAX_WAIT_MS;
  const due = Math.min(quietDue, capDue);
  const retry = ms(state.next_attempt_at);
  return Number.isNaN(retry) ? due : Math.max(due, retry);
};

export const getSiteRebuildStatus = () => {
  const config = readConfig();
  const state = readState();
  const next = dueAt(state, config);
  return {
    configured: !!config.url,
    delayMinutes: config.quietMs / MINUTE_MS,
    pending: !!state.pending_since,
    pendingSince: state.pending_since,
    lastChangeAt: state.last_change_at,
    lastChangeReason: state.last_change_reason,
    lastTriggeredAt: state.last_triggered_at,
    lastStatus: state.last_status,
    lastError: state.last_error,
    nextRunAt: config.url && next ? new Date(next).toISOString() : null,
  };
};

let inFlight = null;

/** Call the deploy webhook now. Resolves to the new status; throws on failure. */
export const triggerSiteRebuild = async (reason = 'manual') => {
  const config = readConfig();
  if (!config.url) {
    throw Object.assign(new Error('Automatic rebuilds are not set up: SITE_REBUILD_WEBHOOK_URL is empty.'), { statusCode: 409 });
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const startedAt = new Date().toISOString();
    try {
      const response = await fetch(config.url, {
        method: 'GET',
        headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Deploy webhook answered ${response.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
      }
      // Changes made while the request was out stay pending.
      db().prepare(`
        UPDATE site_rebuild_state
        SET pending_since = CASE WHEN last_change_at <= ? THEN NULL ELSE pending_since END,
            last_triggered_at = ?, last_status = 'ok', last_error = NULL, next_attempt_at = NULL
        WHERE id = 1
      `).run(startedAt, new Date().toISOString());
      logger.info({ reason }, '[site-rebuild] web rebuild requested');
    } catch (err) {
      const message = err?.name === 'TimeoutError' ? 'Deploy webhook timed out' : (err?.message || String(err));
      db().prepare(`
        UPDATE site_rebuild_state
        SET last_status = 'error', last_error = ?, next_attempt_at = ?
        WHERE id = 1
      `).run(message.slice(0, 300), new Date(Date.now() + RETRY_MS).toISOString());
      logger.error({ err, reason }, '[site-rebuild] deploy webhook failed');
      throw Object.assign(new Error(message), { statusCode: 502 });
    }
    return getSiteRebuildStatus();
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/** Scheduler tick: rebuild once the quiet period (or the 30-minute cap) is over. */
export const processSiteRebuild = async () => {
  const config = readConfig();
  if (!config.url) return;
  const next = dueAt(readState(), config);
  if (next == null || Date.now() < next) return;
  await triggerSiteRebuild('content changed').catch(() => { /* logged; retried later */ });
};
