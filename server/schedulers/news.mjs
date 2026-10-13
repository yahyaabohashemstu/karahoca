import { getDb } from '../services/db.mjs';
import { invalidateBlogCache, invalidateNewsCache, invalidateProductsCache } from '../services/publicCache.mjs';
import { logger } from '../utils/logger.mjs';
import { markSiteChanged, processSiteRebuild } from '../services/siteRebuild.mjs';

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
      logger.info(`[news-scheduler] Published ${result.changes} scheduled article(s).`);
      // Without this the cached /api/news JSON kept serving the old list
      // until its TTL ran out.
      void invalidateNewsCache();
      markSiteChanged('scheduled news published');
    }
  } catch (e) {
    logger.error({ err: e }, '[news-scheduler] error');
  }
};

/**
 * Phase D5 sibling of publishDueNewsArticles — promotes scheduled
 * products to published once their publish_at passes. Runs in the
 * same minute-tick interval so the catalogue and the news feed share
 * a single timer (cheaper than two intervals; no cron coordination
 * needed).
 *
 * Note: the public read query in public-data.mjs ALSO inlines the
 * `(status='scheduled' AND publish_at <= now)` clause as an SLA
 * guard — a visitor refreshing exactly at publish_at sees the new
 * product even if the scheduler hasn't ticked yet. This UPDATE is
 * opportunistic cleanup that flips the status so admin views, OG
 * image cache, and the cached JSON layer don't have to keep
 * re-evaluating the time predicate.
 */
const publishDueProducts = () => {
  try {
    const db = getDb();
    // First gather the brands that will flip — we need them for the
    // public-cache invalidation pass AFTER the UPDATE commits.
    const dueBrands = db.prepare(`
      SELECT DISTINCT brand FROM products
      WHERE status='scheduled'
        AND publish_at IS NOT NULL
        AND datetime(publish_at) <= datetime('now')
        AND active=1
    `).all().map((r) => r.brand);
    const result = db.prepare(`
      UPDATE products
      SET status='published', updated_at=datetime('now')
      WHERE status='scheduled'
        AND publish_at IS NOT NULL
        AND datetime(publish_at) <= datetime('now')
        AND active=1
    `).run();
    if (result.changes > 0) {
      logger.info(`[product-scheduler] Published ${result.changes} scheduled product(s) across ${dueBrands.length} brand(s).`);
      // Bust the public products JSON cache for each affected brand so
      // the next visitor read picks up the newly-revealed products.
      for (const brand of dueBrands) void invalidateProductsCache(brand);
      markSiteChanged('scheduled products published');
    }
  } catch (e) {
    logger.error({ err: e }, '[product-scheduler] error');
  }
};

/**
 * Blog posts saved as 'scheduled' were never promoted: the public blog
 * queries only show status='published', and nothing flipped the status,
 * so a scheduled post stayed invisible forever. published_at takes the
 * scheduled time so the post sorts as new rather than by its draft date.
 */
const publishDueBlogPosts = () => {
  try {
    const db = getDb();
    const result = db.prepare(`
      UPDATE blog_posts
      SET status='published', published_at=publish_at, updated_at=datetime('now')
      WHERE status='scheduled'
        AND publish_at IS NOT NULL
        AND datetime(publish_at) <= datetime('now')
        AND active=1
    `).run();
    if (result.changes > 0) {
      logger.info(`[blog-scheduler] Published ${result.changes} scheduled post(s).`);
      void invalidateBlogCache();
      markSiteChanged('scheduled blog posts published');
    }
  } catch (e) {
    logger.error({ err: e }, '[blog-scheduler] error');
  }
};

const tick = () => {
  publishDueNewsArticles();
  publishDueProducts();
  publishDueBlogPosts();
  // Same minute timer: refresh the pre-rendered pages once edits settle.
  processSiteRebuild().catch((err) => logger.error({ err }, '[site-rebuild] tick failed'));
};

/**
 * Runs an immediate pass, then ticks every minute. Returns the interval
 * handle so the caller can `clearInterval()` during graceful shutdown.
 */
export const startNewsScheduler = () => {
  tick();
  return setInterval(tick, INTERVAL_MS);
};
