import { getDb } from '../db.mjs';

export const handleAdminStats = (req, res, { sendJson, origin }) => {
  const db = getDb();

  const products = db.prepare('SELECT COUNT(*) as c FROM products WHERE active=1').get().c;
  const news = db.prepare('SELECT COUNT(*) as c FROM news WHERE active=1').get().c;
  const subscribers = db.prepare('SELECT COUNT(*) as c FROM newsletter_subscribers WHERE active=1').get().c;
  const chatUsers = db.prepare('SELECT COUNT(*) as c FROM chat_users').get().c;
  const chatMessages = db.prepare('SELECT COUNT(*) as c FROM chat_messages').get().c;

  // Messages in the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const recentMessages = db.prepare(
    "SELECT COUNT(*) as c FROM chat_messages WHERE created_at > ?"
  ).get(weekAgo).c;

  // Last 5 chat users
  const recentUsers = db.prepare(`
    SELECT cu.id, cu.language, cu.message_count, cu.last_seen,
           (SELECT content FROM chat_messages WHERE user_id=cu.id AND role='user' ORDER BY id DESC LIMIT 1) as last_message
    FROM chat_users cu ORDER BY cu.last_seen DESC LIMIT 5
  `).all();

  sendJson(res, 200, {
    success: true,
    stats: { products, news, subscribers, chatUsers, chatMessages, recentMessages },
    recentUsers,
  }, origin);
};
