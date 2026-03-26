import { getDb } from '../db.mjs';

export const handleAdminChats = (req, res, { sendJson, origin, url }) => {
  const db = getDb();
  const urlObj = new URL(req.url, 'http://localhost');

  // GET /api/admin/chats/:userId
  const userIdMatch = url.match(/^\/api\/admin\/chats\/([^/]+)$/);
  if (userIdMatch) {
    const userId = decodeURIComponent(userIdMatch[1]);

    if (req.method === 'GET') {
      const user = db.prepare('SELECT * FROM chat_users WHERE id=?').get(userId);
      if (!user) { sendJson(res, 404, { success: false, error: 'User not found.' }, origin); return; }

      const messages = db.prepare(`
        SELECT id, role, content, language, created_at
        FROM chat_messages WHERE user_id=? ORDER BY id ASC
      `).all(userId);

      sendJson(res, 200, { success: true, user, messages }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM chat_messages WHERE user_id=?').run(userId);
      db.prepare('DELETE FROM chat_users WHERE id=?').run(userId);
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // GET /api/admin/chats
  if (req.method === 'GET') {
    const page  = Math.max(1, parseInt(urlObj.searchParams.get('page')  || '1',  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(urlObj.searchParams.get('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;
    const lang = urlObj.searchParams.get('lang');

    let where = '';
    const params = [];
    if (lang) { where = 'WHERE language=?'; params.push(lang); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM chat_users ${where}`).get(...params).c;
    const users = db.prepare(`
      SELECT cu.*,
        (SELECT content FROM chat_messages WHERE user_id=cu.id AND role='user' ORDER BY id DESC LIMIT 1) as last_user_message,
        (SELECT created_at FROM chat_messages WHERE user_id=cu.id ORDER BY id DESC LIMIT 1) as last_message_at
      FROM chat_users cu ${where}
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    sendJson(res, 200, { success: true, users, total, page, limit }, origin);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};
