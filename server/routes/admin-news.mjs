import { getDb } from '../db.mjs';
import { randomUUID } from 'node:crypto';

const NEWS_FIELDS = [
  'slug', 'image', 'published_at',
  'category_ar', 'category_en', 'category_tr', 'category_ru',
  'title_ar', 'title_en', 'title_tr', 'title_ru',
  'excerpt_ar', 'excerpt_en', 'excerpt_tr', 'excerpt_ru',
  'body_ar', 'body_en', 'body_tr', 'body_ru',
  'active',
];

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

export const handleAdminNews = (req, res, { body, sendJson, origin, url }) => {
  const db = getDb();
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
      // Serialize arrays to JSON strings for storage
      for (const lang of ['ar', 'en', 'tr', 'ru']) {
        const k = `body_${lang}`;
        if (Array.isArray(updateBody[k])) updateBody[k] = JSON.stringify(updateBody[k]);
      }

      const sets = NEWS_FIELDS.filter(f => updateBody[f] !== undefined)
        .map(f => `${f} = @${f}`).join(', ');
      if (!sets) { sendJson(res, 400, { success: false, error: 'No fields to update.' }, origin); return; }

      db.prepare(`UPDATE news SET ${sets}, updated_at=datetime('now') WHERE id=@id`)
        .run({ ...updateBody, id });
      sendJson(res, 200, { success: true, item: serializeBody(db.prepare('SELECT * FROM news WHERE id=?').get(id)) }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      db.prepare("UPDATE news SET active=0, updated_at=datetime('now') WHERE id=?").run(id);
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // /api/admin/news
  if (req.method === 'GET') {
    const showInactive = urlObj.searchParams.get('all') === '1';
    const where = showInactive ? '' : 'WHERE active=1';
    const items = db.prepare(`SELECT * FROM news ${where} ORDER BY published_at DESC`).all();
    sendJson(res, 200, { success: true, items: items.map(serializeBody) }, origin);
    return;
  }

  if (req.method === 'POST') {
    if (!body.title_ar || !body.published_at) {
      sendJson(res, 400, { success: false, error: 'title_ar and published_at are required.' }, origin);
      return;
    }

    const id = body.id || randomUUID().slice(0, 12);
    const slug = body.slug || body.title_ar.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 60) || id;
    const now = new Date().toISOString();

    const toJson = (v) => Array.isArray(v) ? JSON.stringify(v) : (typeof v === 'string' ? v : JSON.stringify([]));

    db.prepare(`
      INSERT INTO news(
        id, slug, image, published_at,
        category_ar, category_en, category_tr, category_ru,
        title_ar, title_en, title_tr, title_ru,
        excerpt_ar, excerpt_en, excerpt_tr, excerpt_ru,
        body_ar, body_en, body_tr, body_ru,
        active, created_at, updated_at
      ) VALUES(
        @id, @slug, @image, @published_at,
        @cat_ar, @cat_en, @cat_tr, @cat_ru,
        @title_ar, @title_en, @title_tr, @title_ru,
        @excerpt_ar, @excerpt_en, @excerpt_tr, @excerpt_ru,
        @body_ar, @body_en, @body_tr, @body_ru,
        1, @now, @now
      )
    `).run({
      id, slug, image: body.image || '', published_at: body.published_at,
      cat_ar: body.category_ar || '', cat_en: body.category_en || '',
      cat_tr: body.category_tr || '', cat_ru: body.category_ru || '',
      title_ar: body.title_ar, title_en: body.title_en || '',
      title_tr: body.title_tr || '', title_ru: body.title_ru || '',
      excerpt_ar: body.excerpt_ar || '', excerpt_en: body.excerpt_en || '',
      excerpt_tr: body.excerpt_tr || '', excerpt_ru: body.excerpt_ru || '',
      body_ar: toJson(body.body_ar), body_en: toJson(body.body_en),
      body_tr: toJson(body.body_tr), body_ru: toJson(body.body_ru),
      now,
    });

    sendJson(res, 201, { success: true, item: serializeBody(db.prepare('SELECT * FROM news WHERE id=?').get(id)) }, origin);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};
