import { getDb, logAudit } from '../db.mjs';
import { CAMPAIGN_LANGS, normaliseSubscriberLang } from '../services/campaignLanguage.mjs';

const isValidEmail = (email) =>
  !!email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const handleAdminNewsletter = (req, res, { sendJson, origin, url, admin, body }) => {
  const db = getDb();
  const urlObj = new URL(req.url, 'http://localhost');
  const adminUser = admin?.username || 'admin';

  // Export CSV
  if (req.method === 'GET' && url === '/api/admin/newsletter/export') {
    const subscribers = db.prepare(
      'SELECT email, subscribed_at, lang FROM newsletter_subscribers WHERE active=1 ORDER BY subscribed_at DESC'
    ).all();
    logAudit({
      action: 'EXPORT',
      entityType: 'newsletter',
      entityName: 'CSV export of newsletter subscribers',
      adminUser,
      details: `${subscribers.length} rows exported`,
    });

    // Sanitize CSV cells: prefix dangerous chars to prevent Excel formula injection
    const csvSafe = (v = '') => {
      const s = String(v);
      return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    };
    const csv = [
      'email,subscribed_at,lang',
      ...subscribers.map(s => `${csvSafe(s.email)},${csvSafe(s.subscribed_at)},${csvSafe(s.lang || '')}`),
    ].join('\n');

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

    // ?lang=ar|en|tr|ru filters by language; ?lang=unknown lists the
    // subscribers who signed up before the language was recorded.
    const langParam = (urlObj.searchParams.get('lang') || '').toLowerCase();
    const langFilter = langParam === 'unknown'
      ? { sql: ' AND lang IS NULL', params: [] }
      : CAMPAIGN_LANGS.includes(langParam)
        ? { sql: ' AND lang = ?', params: [langParam] }
        : { sql: '', params: [] };

    const total = db.prepare(`SELECT COUNT(*) as c FROM newsletter_subscribers WHERE active=1${langFilter.sql}`)
      .get(...langFilter.params).c;
    const subscribers = db.prepare(
      `SELECT email, subscribed_at, lang FROM newsletter_subscribers WHERE active=1${langFilter.sql} ORDER BY subscribed_at DESC LIMIT ? OFFSET ?`
    ).all(...langFilter.params, limit, offset);

    // Audience per language, for the page header and the campaign editor.
    const langCounts = { ar: 0, en: 0, tr: 0, ru: 0, unknown: 0 };
    for (const row of db.prepare('SELECT lang, COUNT(*) as c FROM newsletter_subscribers WHERE active=1 GROUP BY lang').all()) {
      langCounts[normaliseSubscriberLang(row.lang) ?? 'unknown'] += row.c;
    }

    sendJson(res, 200, { success: true, subscribers, total, page, limit, langCounts }, origin);
    return;
  }

  // Set a subscriber's language: PUT /api/admin/newsletter/:email { lang }.
  // For people who signed up before it was recorded, or who asked for
  // another language; lang null or '' clears it. (PUT, not PATCH: PATCH
  // is not in the CORS allow-list, so the cross-origin admin couldn't call it.)
  if (req.method === 'PUT') {
    const emailMatch = url.match(/^\/api\/admin\/newsletter\/(.+)$/);
    if (emailMatch) {
      const email = decodeURIComponent(emailMatch[1]).toLowerCase();
      if (!isValidEmail(email)) {
        sendJson(res, 400, { success: false, error: 'Invalid email.' }, origin);
        return;
      }
      const raw = body?.lang ?? null;
      const lang = normaliseSubscriberLang(raw);
      if (raw !== null && raw !== '' && !lang) {
        sendJson(res, 400, { success: false, error: 'Language must be one of ar, en, tr, ru.' }, origin);
        return;
      }
      const { changes } = db.prepare('UPDATE newsletter_subscribers SET lang = ? WHERE email = ? AND active = 1').run(lang, email);
      if (!changes) {
        sendJson(res, 404, { success: false, error: 'Subscriber not found.' }, origin);
        return;
      }
      logAudit({
        action: 'UPDATE',
        entityType: 'newsletter',
        entityId: email,
        entityName: `Language of ${email}`,
        adminUser,
        details: `lang=${lang ?? 'unknown'}`,
      });
      sendJson(res, 200, { success: true, lang }, origin);
      return;
    }
  }

  // Unsubscribe
  if (req.method === 'DELETE') {
    const emailMatch = url.match(/^\/api\/admin\/newsletter\/(.+)$/);
    if (emailMatch) {
      const email = decodeURIComponent(emailMatch[1]);
      // Validate email length and format before DB operation
      if (!isValidEmail(email)) {
        sendJson(res, 400, { success: false, error: 'Invalid email.' }, origin);
        return;
      }
      db.prepare("UPDATE newsletter_subscribers SET active=0 WHERE email=?").run(email);
      logAudit({
        action: 'DELETE',
        entityType: 'newsletter',
        entityId: email,
        entityName: `Unsubscribed ${email}`,
        adminUser,
      });
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};
