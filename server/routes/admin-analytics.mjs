import { getDb } from '../db.mjs';
import { addDays, fillDays, todayUtc } from '../utils/dateRange.mjs';

export const handleAdminAnalytics = (req, res, { sendJson, origin }) => {
  const db = getDb();

  // Accept ?days=30|60|90 (default 30, capped at 365)
  const urlObj = new URL(req.url, 'http://localhost');
  const rawDays = parseInt(urlObj.searchParams.get('days') || '30', 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30;

  const today = todayUtc();
  const since = addDays(today, -days);

  const dailyData = db.prepare(`
    SELECT date, metric, value FROM daily_stats
    WHERE date >= ? ORDER BY date ASC
  `).all(since);

  // Chat messages per day. GROUP BY only returns days with activity;
  // fillDays adds the quiet ones as 0 (UTC days, like date()) so the
  // trend line doesn't run straight across them.
  const chatPerDayRows = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM chat_messages
    WHERE date(created_at) >= ?
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(since);
  const chatPerDay = fillDays(chatPerDayRows, since, today, 'date', (date) => ({ date, count: 0 }));

  // Newsletter signups per day
  const newsletterPerDayRows = db.prepare(`
    SELECT date(subscribed_at) as date, COUNT(*) as count
    FROM newsletter_subscribers
    WHERE date(subscribed_at) >= ? AND active=1
    GROUP BY date(subscribed_at)
    ORDER BY date ASC
  `).all(since);
  const newsletterPerDay = fillDays(newsletterPerDayRows, since, today, 'date', (date) => ({ date, count: 0 }));

  // Everything below is ALL-TIME, not scoped to `days` (the page labels
  // it so).

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

  // Total stats summary (all-time)
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
    days,
    summary,
    chatPerDay,
    newsletterPerDay,
    langDistribution,
    topUsers,
    dailyData,
  }, origin);
};
