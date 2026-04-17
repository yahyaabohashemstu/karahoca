import { getDb, logAudit } from '../db.mjs';
import { randomUUID } from 'node:crypto';
import { buildUpdater } from '../services/safeUpdate.mjs';
import { invalidateNewsCache } from '../services/publicCache.mjs';

const NEWS_FIELDS = [
  'slug', 'image', 'published_at', 'status', 'publish_at',
  'category_ar', 'category_en', 'category_tr', 'category_ru',
  'title_ar', 'title_en', 'title_tr', 'title_ru',
  'excerpt_ar', 'excerpt_en', 'excerpt_tr', 'excerpt_ru',
  'body_ar', 'body_en', 'body_tr', 'body_ru',
  'active',
];

const updateNewsRow = buildUpdater('news', NEWS_FIELDS);

const VALID_STATUSES = new Set(['draft', 'published', 'scheduled']);

const serializeBody = (item) => {
  const result = { ...item };
  for (const lang of ['ar', 'en', 'tr', 'ru']) {
    const key = `body_${lang}`;
    if (typeof result[key] === 'string') {
      try { result[key] = JSON.parse(result[key]); } catch { result[key] = [result[key]]; }
    }
  }
  return result;
};

export const handleAdminNews = (req, res, { body, sendJson, origin, url, admin }) => {
  const db = getDb();
  const adminUser = admin?.username || 'admin';
  const urlObj = new URL(req.url, 'http://localhost');

  // /api/admin/news/:id
  const idMatch = url.match(/^\/api\/admin\/news\/([^/]+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (req.method === 'GET') {
      const item = db.prepare('SELECT * FROM news WHERE id=?').get(id);
      if (!item) { sendJson(res, 404, { success: false, error: 'News item not found.' }, origin); return; }
      sendJson(res, 200, { success: true, item: serializeBody(item) }, origin);
      return;
    }

    if (req.method === 'PUT') {
      const updateBody = { ...body };
      // Validate status if provided
      if (updateBody.status !== undefined && !VALID_STATUSES.has(updateBody.status)) {
        sendJson(res, 400, { success: false, error: 'Invalid status. Must be draft, published, or scheduled.' }, origin);
        return;
      }
      // Auto-set active based on status
      if (updateBody.status === 'draft') updateBody.active = 0;
      else if (updateBody.status === 'published') updateBody.active = 1;
      else if (updateBody.status === 'scheduled') updateBody.active = 1;

      // Serialize arrays to JSON strings for storage
      for (const lang of ['ar', 'en', 'tr', 'ru']) {
        const k = `body_${lang}`;
        if (Array.isArray(updateBody[k])) updateBody[k] = JSON.stringify(updateBody[k]);
      }

      const result = updateNewsRow(id, updateBody);
      if (result.skipped) { sendJson(res, 400, { success: false, error: 'No fields to update.' }, origin); return; }

      const updated = db.prepare('SELECT * FROM news WHERE id=?').get(id);
      logAudit({ action: 'UPDATE', entityType: 'news', entityId: id, entityName: updated?.title_ar || updated?.title_en || id, adminUser });
      void invalidateNewsCache();
      sendJson(res, 200, { success: true, item: serializeBody(updated) }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      const art = db.prepare('SELECT title_ar, title_en FROM news WHERE id=?').get(id);
      db.prepare("UPDATE news SET active=0, updated_at=datetime('now') WHERE id=?").run(id);
      logAudit({ action: 'DELETE', entityType: 'news', entityId: id, entityName: art?.title_ar || art?.title_en || id, adminUser });
      void invalidateNewsCache();
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // /api/admin/news
  if (req.method === 'GET') {
    // ?all=1 → return all statuses for admin panel
    const showAll = urlObj.searchParams.get('all') === '1';
    const where = showAll ? '' : "WHERE active=1 AND status='published'";
    const items = db.prepare(`SELECT * FROM news ${where} ORDER BY published_at DESC`).all();
    sendJson(res, 200, { success: true, items: items.map(serializeBody) }, origin);
    return;
  }

  if (req.method === 'POST') {
    if (!body.title_ar || !body.published_at) {
      sendJson(res, 400, { success: false, error: 'title_ar and published_at are required.' }, origin);
      return;
    }

    const status = VALID_STATUSES.has(body.status) ? body.status : 'published';
    // Scheduled articles must have a future publish_at date
    if (status === 'scheduled' && !body.publish_at) {
      sendJson(res, 400, { success: false, error: 'publish_at is required for scheduled articles.' }, origin);
      return;
    }

    const id = body.id || randomUUID().slice(0, 12);
    const slug = body.slug || body.title_ar.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 60) || id;
    const now = new Date().toISOString();
    const toJson = (v) => Array.isArray(v) ? JSON.stringify(v) : (typeof v === 'string' ? v : JSON.stringify([]));
    // Draft articles are not publicly active
    const active = status === 'draft' ? 0 : 1;

    db.prepare(`
      INSERT INTO news(
        id, slug, image, published_at, status, publish_at,
        category_ar, category_en, category_tr, category_ru,
        title_ar, title_en, title_tr, title_ru,
        excerpt_ar, excerpt_en, excerpt_tr, excerpt_ru,
        body_ar, body_en, body_tr, body_ru,
        active, created_at, updated_at
      ) VALUES(
        @id, @slug, @image, @published_at, @status, @publish_at,
        @cat_ar, @cat_en, @cat_tr, @cat_ru,
        @title_ar, @title_en, @title_tr, @title_ru,
        @excerpt_ar, @excerpt_en, @excerpt_tr, @excerpt_ru,
        @body_ar, @body_en, @body_tr, @body_ru,
        @active, @now, @now
      )
    `).run({
      id, slug, image: body.image || '', published_at: body.published_at,
      status, publish_at: body.publish_at || null,
      cat_ar: body.category_ar || '', cat_en: body.category_en || '',
      cat_tr: body.category_tr || '', cat_ru: body.category_ru || '',
      title_ar: body.title_ar, title_en: body.title_en || '',
      title_tr: body.title_tr || '', title_ru: body.title_ru || '',
      excerpt_ar: body.excerpt_ar || '', excerpt_en: body.excerpt_en || '',
      excerpt_tr: body.excerpt_tr || '', excerpt_ru: body.excerpt_ru || '',
      body_ar: toJson(body.body_ar), body_en: toJson(body.body_en),
      body_tr: toJson(body.body_tr), body_ru: toJson(body.body_ru),
      active, now,
    });

    const created = db.prepare('SELECT * FROM news WHERE id=?').get(id);
    logAudit({ action: 'CREATE', entityType: 'news', entityId: id, entityName: body.title_ar || body.title_en || id, adminUser });
    void invalidateNewsCache();
    sendJson(res, 201, { success: true, item: serializeBody(created) }, origin);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};
