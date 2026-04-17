import { getDb } from '../services/db.mjs';
import {
  processQueuedCampaignDispatches,
  recoverQueuedCampaignDispatches,
  queueCampaignDispatch,
} from '../routes/admin-campaigns.mjs';
import { logger } from '../utils/logger.mjs';

const DISPATCH_INTERVAL_MS = 60 * 1000;
const QUEUE_DRAIN_INTERVAL_MS = 5 * 1000;

const dispatchDueCampaigns = async () => {
  try {
    const db = getDb();
    const due = db
      .prepare(
        `SELECT id FROM email_campaigns
         WHERE status='scheduled'
           AND scheduled_at IS NOT NULL
           AND datetime(scheduled_at) <= datetime('now')`,
      )
      .all();
    for (const { id } of due) {
      logger.info(`[scheduler] Queueing campaign #${id}`);
      await queueCampaignDispatch(id).catch((e) =>
        logger.error(`[scheduler] Campaign #${id} failed:`, e.message),
      );
    }
  } catch (e) {
    logger.error('[scheduler] error:', e.message);
  }
};

const drainQueuedCampaigns = async () => {
  try {
    await processQueuedCampaignDispatches();
  } catch (e) {
    logger.error('[campaign-queue] worker error:', e.message);
  }
};

/**
 * Fires an immediate dispatch + queue-drain + recovery pass on boot, then
 * schedules both loops. Returns an object of interval handles for shutdown.
 */
export const startCampaignSchedulers = () => {
  // Immediate-on-boot passes — each .catch'd so a rejection during startup
  // (e.g. Redis reconnect hiccup) doesn't crash the process before the
  // schedulers even begin.
  dispatchDueCampaigns().catch((err) => logger.error({ err }, '[scheduler] initial dispatch rejection'));
  recoverQueuedCampaignDispatches().catch((err) => logger.error({ err }, '[scheduler] initial recover rejection'));
  drainQueuedCampaigns().catch((err) => logger.error({ err }, '[campaign-queue] initial drain rejection'));

  // Scheduled loops — `.catch` on EVERY tick so a one-off failure (network
  // blip, transient DB lock) is logged once instead of surfacing as a silent
  // unhandledRejection + eventual process.exit(1) from our top-level guard.
  const dispatchInterval = setInterval(() => {
    dispatchDueCampaigns().catch((err) =>
      logger.error({ err }, '[scheduler] dispatch tick rejection'),
    );
  }, DISPATCH_INTERVAL_MS);
  const queueInterval = setInterval(() => {
    drainQueuedCampaigns().catch((err) =>
      logger.error({ err }, '[campaign-queue] drain tick rejection'),
    );
  }, QUEUE_DRAIN_INTERVAL_MS);

  return { dispatchInterval, queueInterval };
};
