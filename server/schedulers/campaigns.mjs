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
  void dispatchDueCampaigns();
  void recoverQueuedCampaignDispatches();
  void drainQueuedCampaigns();

  const dispatchInterval = setInterval(() => {
    void dispatchDueCampaigns();
  }, DISPATCH_INTERVAL_MS);
  const queueInterval = setInterval(() => {
    void drainQueuedCampaigns();
  }, QUEUE_DRAIN_INTERVAL_MS);

  return { dispatchInterval, queueInterval };
};
