import { getDb } from '../db.mjs';

export const handleAdminAnalytics = (req, res, { sendJson, origin }) => {
  const db = getDb();

  // Last 30 days of daily_stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const dailyData = db.prepare(`
    SELECT date, metric, value FROM daily_stats
    WHERE date >= ? ORDER BY date ASC
  `).all(thirtyDaysAgo);

  // Chat messages per day (from chat_messages table)
  const chatPerDay = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM chat_messages
    WHERE date(created_at) >= ?
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(thirtyDaysAgo);

  // Newsletter signups per day
  const newsletterPerDay = db.prepare(`
    SELECT date(subscribed_at) as date, COUNT(*) as count
    FROM newsletter_subscribers
    WHERE date(subscribed_at) >= ? AND active=1
    GROUP BY date(subscribed_at)
    ORDER BY date ASC
  `).all(thirtyDaysAgo);

  // Language distribution of chat users
  const langDistribution = db.prepare(`
    SELECT language, COUNT(*) as count
    FROM chat_users
    GROUP BY language
    ORDER BY count DESC
  `).all();

  // Top active users (most messages)
  const topUsers = db.prepare(`
    SELECT id, language, message_count, last_seen
    FROM chat_users
    ORDER BY message_count DESC
    LIMIT 10
  `).all();

  // Total stats summary
  const summary = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM chat_messages) as total_messages,
      (SELECT COUNT(*) FROM chat_users) as total_users,
      (SELECT COUNT(*) FROM newsletter_subscribers WHERE active=1) as total_subscribers,
      (SELECT COUNT(*) FROM news WHERE active=1) as total_news,
      (SELECT COUNT(*) FROM products WHERE active=1) as total_products
  `).get();

  sendJson(res, 200, {
    success: true,
    summary,
    chatPerDay,
    newsletterPerDay,
    langDistribution,
    topUsers,
    dailyData,
  }, origin);
};
