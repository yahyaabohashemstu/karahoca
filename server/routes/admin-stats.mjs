import { getDb } from '../db.mjs';
import { publicProductWhere } from '../services/productVisibility.mjs';

export const handleAdminStats = (req, res, { sendJson, origin }) => {
  const db = getDb();
  const count = (sql, ...params) => db.prepare(sql).get(...params).c;

  // "Live" = what a visitor can see. active=1 alone also counted drafts and
  // scheduled items, so the dashboard overstated the published catalogue.
  const products = count(`SELECT COUNT(*) as c FROM products WHERE ${publicProductWhere()}`);
  const news = count("SELECT COUNT(*) as c FROM news WHERE active=1 AND status='published'");
  const blogPosts = count(
    "SELECT COUNT(*) as c FROM blog_posts WHERE active=1 AND status='published' AND datetime(published_at) <= datetime('now')",
  );
  const subscribers = count('SELECT COUNT(*) as c FROM newsletter_subscribers WHERE active=1');
  const chatUsers = count('SELECT COUNT(*) as c FROM chat_users');
  const chatMessages = count('SELECT COUNT(*) as c FROM chat_messages');

  // Messages in the last 7 days. datetime() on both sides: created_at is an
  // ISO string, and a plain text comparison against a localized legacy
  // value ("٠٩:٣٠ ص") counted every old message as recent.
  const recentMessages = count(
    "SELECT COUNT(*) as c FROM chat_messages WHERE datetime(created_at) >= datetime('now', '-7 days')",
  );

  // Last 5 chat users
  const recentUsers = db.prepare(`
    SELECT cu.id, cu.language, cu.message_count, cu.last_seen,
           (SELECT content FROM chat_messages WHERE user_id=cu.id AND role='user' ORDER BY id DESC LIMIT 1) as last_message
    FROM chat_users cu ORDER BY cu.last_seen DESC LIMIT 5
  `).all();

  sendJson(res, 200, {
    success: true,
    stats: { products, news, blogPosts, subscribers, chatUsers, chatMessages, recentMessages },
    recentUsers,
  }, origin);
};
