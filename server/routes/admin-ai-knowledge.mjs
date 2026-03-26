/**
 * AI Knowledge Base management routes.
 * - Custom Q&A pairs (added by admin)
 * - User questions log (auto-captured, admin reviews)
 */
import { getDb } from '../db.mjs';

// ── Build product context string from DB ─────────────────────────────────────
export const buildProductContext = (lang = 'ar') => {
  const db = getDb();
  const l = ['ar', 'en', 'tr', 'ru'].includes(lang) ? lang : 'ar';

  const categories = db.prepare(
    `SELECT * FROM product_categories ORDER BY brand, display_order`
  ).all();

  const products = db.prepare(
    `SELECT * FROM products WHERE active=1 ORDER BY brand, category_id, display_order`
  ).all();

  if (!products.length) return '';

  const lines = ['=== CURRENT PRODUCT CATALOG (from database) ==='];

  for (const cat of categories) {
    const catProds = products.filter(p => p.category_id === cat.id);
    if (!catProds.length) continue;
    lines.push(`\n[${cat.brand} — ${cat[`title_${l}`] || cat.title_en || cat.id}]`);
    for (const p of catProds) {
      const name = p[`name_${l}`] || p.name_en || p.id;
      const desc = p[`description_${l}`] || '';
      const weight = p.weight ? `  Weight: ${p.weight}` : '';
      const mat  = p[`material_${l}`] ? `  Material: ${p[`material_${l}`]}` : '';
      const cnt  = p[`count_${l}`]    ? `  Pack: ${p[`count_${l}`]}`        : '';
      lines.push(`• ${name}${weight}${mat}${cnt}${desc ? '\n  ' + desc.slice(0, 120) : ''}`);
    }
  }

  return lines.join('\n');
};

// ── Build custom Q&A context string from DB ───────────────────────────────────
export const buildCustomQAContext = (lang = 'ar') => {
  const db = getDb();
  const l = ['ar', 'en', 'tr', 'ru'].includes(lang) ? lang : 'ar';
  const qaList = db.prepare('SELECT * FROM ai_custom_qa WHERE active=1').all();
  if (!qaList.length) return '';

  const lines = ['\n=== CUSTOM KNOWLEDGE BASE (admin-defined) ==='];
  for (const qa of qaList) {
    const q = qa[`question_${l}`] || qa.question_en || '';
    const a = qa[`answer_${l}`]   || qa.answer_en   || '';
    if (q && a) lines.push(`Q: ${q}\nA: ${a}`);
  }
  return lines.join('\n');
};

// ── Log a user question ───────────────────────────────────────────────────────
export const logUserQuestion = (question, language, userId) => {
  try {
    const db = getDb();
    // Keep only if not a duplicate in last 24h
    const exists = db.prepare(
      `SELECT 1 FROM ai_user_questions WHERE question=? AND created_at > datetime('now','-1 day')`
    ).get(question);
    if (!exists) {
      db.prepare(
        'INSERT INTO ai_user_questions(question, language, user_id) VALUES(?,?,?)'
      ).run(question, language, userId || null);
    }
  } catch { /* non-fatal */ }
};

// ── Handler ───────────────────────────────────────────────────────────────────
export const handleAdminAiKnowledge = (req, res, { sendJson, origin, url, body }) => {
  const db = getDb();

  // ── /api/admin/ai-knowledge/questions
  if (url === '/api/admin/ai-knowledge/questions') {
    if (req.method === 'GET') {
      const urlObj = new URL(req.url, 'http://localhost');
      const status = urlObj.searchParams.get('status') || 'new';
      const questions = db.prepare(
        `SELECT * FROM ai_user_questions WHERE status=? ORDER BY created_at DESC LIMIT 100`
      ).all(status);
      const counts = db.prepare(
        `SELECT status, COUNT(*) as c FROM ai_user_questions GROUP BY status`
      ).all();
      sendJson(res, 200, { success: true, questions, counts }, origin);
      return;
    }
    if (req.method === 'PUT') {
      // Bulk update status: { ids: [...], status: 'reviewed'|'ignored' }
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
      const status = ['new','reviewed','ignored'].includes(body.status) ? body.status : 'reviewed';
      if (ids.length) {
        const ph = ids.map(() => '?').join(',');
        db.prepare(`UPDATE ai_user_questions SET status=? WHERE id IN (${ph})`).run(status, ...ids);
      }
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // ── /api/admin/ai-knowledge/preview  (GET — show what AI currently knows)
  if (url === '/api/admin/ai-knowledge/preview' && req.method === 'GET') {
    const urlObj = new URL(req.url, 'http://localhost');
    const lang = urlObj.searchParams.get('lang') || 'en';
    sendJson(res, 200, {
      success: true,
      productContext: buildProductContext(lang),
      customQA: buildCustomQAContext(lang),
    }, origin);
    return;
  }

  // ── /api/admin/ai-knowledge/:id
  const idMatch = url.match(/^\/api\/admin\/ai-knowledge\/(\d+)$/);
  if (idMatch) {
    const id = parseInt(idMatch[1], 10);

    if (req.method === 'PUT') {
      const fields = ['question_ar','question_en','question_tr','question_ru','answer_ar','answer_en','answer_tr','answer_ru','tags','active'];
      const sets = fields.filter(f => body[f] !== undefined).map(f => `${f}=@${f}`).join(', ');
      if (sets) db.prepare(`UPDATE ai_custom_qa SET ${sets}, updated_at=datetime('now') WHERE id=@id`).run({ ...body, id });
      sendJson(res, 200, { success: true, entry: db.prepare('SELECT * FROM ai_custom_qa WHERE id=?').get(id) }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM ai_custom_qa WHERE id=?').run(id);
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // ── GET /api/admin/ai-knowledge
  if (req.method === 'GET') {
    const entries = db.prepare('SELECT * FROM ai_custom_qa ORDER BY id DESC').all();
    sendJson(res, 200, { success: true, entries }, origin);
    return;
  }

  // ── POST /api/admin/ai-knowledge
  if (req.method === 'POST') {
    const info = db.prepare(`
      INSERT INTO ai_custom_qa(question_ar,question_en,question_tr,question_ru,answer_ar,answer_en,answer_tr,answer_ru,tags,active)
      VALUES(@question_ar,@question_en,@question_tr,@question_ru,@answer_ar,@answer_en,@answer_tr,@answer_ru,@tags,1)
    `).run({
      question_ar: body.question_ar || '', question_en: body.question_en || '',
      question_tr: body.question_tr || '', question_ru: body.question_ru || '',
      answer_ar:   body.answer_ar   || '', answer_en:   body.answer_en   || '',
      answer_tr:   body.answer_tr   || '', answer_ru:   body.answer_ru   || '',
      tags:        body.tags        || '',
    });
    sendJson(res, 201, { success: true, entry: db.prepare('SELECT * FROM ai_custom_qa WHERE id=?').get(info.lastInsertRowid) }, origin);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' }, origin);
};
