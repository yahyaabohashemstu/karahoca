import { getDb } from '../db.mjs';

export const handleAdminNewsletter = (req, res, { sendJson, origin, url }) => {
  const db = getDb();
  const urlObj = new URL(req.url, 'http://localhost');

  // Export CSV
  if (req.method === 'GET' && url === '/api/admin/newsletter/export') {
    const subscribers = db.prepare(
      'SELECT email, subscribed_at FROM newsletter_subscribers WHERE active=1 ORDER BY subscribed_at DESC'
    ).all();

    const csv = ['email,subscribed_at', ...subscribers.map(s => `${s.email},${s.subscribed_at}`)].join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="subscribers.csv"',
    });
    res.end(csv);
    return;
  }

  if (req.method === 'GET') {
    const page  = Math.max(1, parseInt(urlObj.searchParams.get('page')  || '1',  10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(urlObj.searchParams.get('limit') || '50', 10) || 50));
    const offset = (page - 1) * limit;

    const total = db.prepare('SELECT COUNT(*) as c FROM newsletter_subscribers WHERE active=1').get().c;
    const subscribers = db.prepare(
      'SELECT email, subscribed_at FROM newsletter_subscribers WHERE active=1 ORDER BY subscribed_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    sendJson(res, 200, { success: true, subscribers, total, page, limit }, origin);
    return;
  }

  // Unsubscribe
  if (req.method === 'DELETE') {
    const emailMatch = url.match(/^\/api\/admin\/newsletter\/(.+)$/);
    if (emailMatch) {
      const email = decodeURIComponent(emailMatch[1]);
      // Validate email length and format before DB operation
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(res, 400, { success: false, error: 'Invalid email.' }, origin);
        return;
      }
      db.prepare("UPDATE newsletter_subscribers SET active=0 WHERE email=?").run(email);
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};
