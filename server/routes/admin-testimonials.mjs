import { getDb } from '../db.mjs';

const TESTIMONIAL_FIELDS = [
  'client_name', 'company', 'country',
  'role_ar', 'role_en', 'role_tr', 'role_ru',
  'text_ar', 'text_en', 'text_tr', 'text_ru',
  'rating', 'display_order', 'active',
];

export const handleAdminTestimonials = (req, res, { body, sendJson, origin, url }) => {
  const db = getDb();

  // /api/admin/testimonials/:id
  const idMatch = url.match(/^\/api\/admin\/testimonials\/(\d+)$/);
  if (idMatch) {
    const id = Number(idMatch[1]);

    if (req.method === 'GET') {
      const item = db.prepare('SELECT * FROM testimonials WHERE id=?').get(id);
      if (!item) { sendJson(res, 404, { success: false, error: 'Not found.' }, origin); return; }
      sendJson(res, 200, { success: true, testimonial: item }, origin);
      return;
    }

    if (req.method === 'PUT') {
      const fields = TESTIMONIAL_FIELDS.filter(f => body[f] !== undefined);
      if (fields.length === 0) {
        sendJson(res, 400, { success: false, error: 'No valid fields to update.' }, origin); return;
      }
      const rating = body.rating !== undefined ? Number(body.rating) : undefined;
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        sendJson(res, 400, { success: false, error: 'Rating must be 1-5.' }, origin); return;
      }
      const sets = fields.map(f => `${f}=?`).join(', ');
      const vals = fields.map(f => f === 'rating' ? Number(body[f]) : body[f]);
      db.prepare(`UPDATE testimonials SET ${sets}, updated_at=datetime('now') WHERE id=?`).run(...vals, id);
      const updated = db.prepare('SELECT * FROM testimonials WHERE id=?').get(id);
      sendJson(res, 200, { success: true, testimonial: updated }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM testimonials WHERE id=?').run(id);
      sendJson(res, 200, { success: true }, origin);
      return;
    }

    sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
    return;
  }

  // /api/admin/testimonials
  if (url === '/api/admin/testimonials') {
    if (req.method === 'GET') {
      const items = db.prepare('SELECT * FROM testimonials ORDER BY display_order ASC, id ASC').all();
      sendJson(res, 200, { success: true, testimonials: items }, origin);
      return;
    }

    if (req.method === 'POST') {
      const { client_name } = body;
      if (!client_name || typeof client_name !== 'string' || !client_name.trim()) {
        sendJson(res, 400, { success: false, error: 'client_name is required.' }, origin); return;
      }
      const rating = body.rating !== undefined ? Number(body.rating) : 5;
      if (rating < 1 || rating > 5) {
        sendJson(res, 400, { success: false, error: 'Rating must be 1-5.' }, origin); return;
      }
      const fields = TESTIMONIAL_FIELDS.filter(f => body[f] !== undefined);
      const cols = fields.join(', ');
      const placeholders = fields.map(() => '?').join(', ');
      const vals = fields.map(f => f === 'rating' ? Number(body[f]) : body[f]);
      const result = db.prepare(`INSERT INTO testimonials (${cols}) VALUES (${placeholders})`).run(...vals);
      const created = db.prepare('SELECT * FROM testimonials WHERE id=?').get(result.lastInsertRowid);
      sendJson(res, 201, { success: true, testimonial: created }, origin);
      return;
    }

    sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
    return;
  }

  sendJson(res, 404, { success: false, error: 'Not found.' }, origin);
};

export const handlePublicTestimonials = (req, res, { sendJson, origin }) => {
  const db = getDb();
  const items = db.prepare(
    'SELECT * FROM testimonials WHERE active=1 ORDER BY display_order ASC, id ASC'
  ).all();
  sendJson(res, 200, { success: true, testimonials: items }, origin);
};
