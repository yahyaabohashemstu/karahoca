import { getDb } from '../services/db.mjs';

const INTERVAL_MS = 60 * 1000;

const publishDueNewsArticles = () => {
  try {
    const db = getDb();
    const result = db.prepare(`
      UPDATE news
      SET status='published', active=1, updated_at=datetime('now')
      WHERE status='scheduled'
        AND publish_at IS NOT NULL
        AND datetime(publish_at) <= datetime('now')
        AND active=1
    `).run();
    if (result.changes > 0) {
      console.log(`[news-scheduler] Published ${result.changes} scheduled article(s).`);
    }
  } catch (e) {
    console.error('[news-scheduler] error:', e.message);
  }
};

/**
 * Runs an immediate pass, then ticks every minute. Returns the interval
 * handle so the caller can `clearInterval()` during graceful shutdown.
 */
export const startNewsScheduler = () => {
  void publishDueNewsArticles();
  return setInterval(publishDueNewsArticles, INTERVAL_MS);
};
