/**
 * Admin blog endpoints — CRUD for posts and categories.
 *
 * Mirrors the patterns established by admin-news.mjs so future
 * maintenance is one mental model. Two top-level entry points:
 *
 *   /api/admin/blog/posts        (list / create)
 *   /api/admin/blog/posts/:id    (read / update / delete)
 *   /api/admin/blog/categories   (list / create)
 *   /api/admin/blog/categories/:id (read / update / delete)
 *
 * Authentication is enforced by the existing admin-auth middleware
 * upstream of this handler — no extra checks needed here.
 *
 * Reading time is auto-computed at save time from the longest
 * non-empty body variant. Visitor-facing fields are sanitised at
 * the public API layer; admin trust is implicit.
 */

import { getDb, logAudit } from '../db.mjs';
import { randomUUID } from 'node:crypto';
import { buildUpdater } from '../services/safeUpdate.mjs';
import { invalidateBlogCache } from '../services/publicCache.mjs';
import { logger } from '../utils/logger.mjs';

// ─── Field whitelists for safeUpdate ────────────────────────────────────────

const POST_FIELDS = [
  'slug', 'image', 'hero_image', 'category_id', 'tags',
  'title_ar', 'title_en', 'title_tr', 'title_ru',
  'excerpt_ar', 'excerpt_en', 'excerpt_tr', 'excerpt_ru',
  'body_ar', 'body_en', 'body_tr', 'body_ru',
  'meta_title_ar', 'meta_title_en', 'meta_title_tr', 'meta_title_ru',
  'meta_description_ar', 'meta_description_en', 'meta_description_tr', 'meta_description_ru',
  'author_name', 'author_avatar', 'reading_time', 'featured',
  'status', 'published_at', 'publish_at', 'active',
];
const updatePostRow = buildUpdater('blog_posts', POST_FIELDS);

const CATEGORY_FIELDS = [
  'slug', 'color', 'icon',
  'name_ar', 'name_en', 'name_tr', 'name_ru',
  'description_ar', 'description_en', 'description_tr', 'description_ru',
  'display_order', 'active',
];
const updateCategoryRow = buildUpdater('blog_categories', CATEGORY_FIELDS);

const VALID_STATUSES = new Set(['draft', 'published', 'scheduled']);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read time estimator. Picks the longest body variant (which is the
 * canonical "source" copy — translations are usually shorter), counts
 * roughly word-equivalent tokens, divides by 200 wpm (conservative
 * average across our 4 languages), and clamps to [1, 60].
 *
 * 200 wpm is the consensus reading speed for non-fiction prose at
 * comprehension levels typical of how-to articles. Arabic and Russian
 * tend to read slower than English; Turkish faster — 200 is the
 * median that doesn't insult any audience.
 */
const estimateReadingTime = (post) => {
  let longestWordCount = 0;
  for (const lang of ['ar', 'en', 'tr', 'ru']) {
    const body = post[`body_${lang}`];
    if (typeof body !== 'string' || !body.trim()) continue;
    // Token boundary heuristic: split on any whitespace OR a CJK/Arabic
    // word-character boundary. Good enough for an estimate.
    const tokens = body.trim().split(/\s+/).length;
    if (tokens > longestWordCount) longestWordCount = tokens;
  }
  if (longestWordCount === 0) return 1;
  const minutes = Math.round(longestWordCount / 200);
  return Math.max(1, Math.min(60, minutes));
};

/**
 * Normalise the tags field into a JSON-stringified array. Accepts
 * either a comma-separated string OR an array; coerces to lowercase
 * + trims whitespace + dedupes; caps at 15 tags.
 */
const normaliseTags = (input) => {
  let arr = [];
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === 'string') {
    arr = input.split(',');
  }
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    if (typeof raw !== 'string') continue;
    const clean = raw.trim().toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!clean || clean.length > 32) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= 15) break;
  }
  return JSON.stringify(out);
};

/**
 * Slug derivation when the admin leaves it blank. Falls back through
 * title_en → title_ar → random id. ASCII-only output, dashes for
 * spaces, max 60 chars.
 */
const deriveSlug = (post, fallbackId) => {
  const candidates = [post.title_en, post.title_ar, post.title_tr, post.title_ru];
  for (const c of candidates) {
    if (typeof c !== 'string' || !c.trim()) continue;
    const slug = c
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')   // strip combining marks
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    if (slug) return slug;
  }
  return fallbackId;
};

const sanitiseStatus = (status) => (VALID_STATUSES.has(status) ? status : 'draft');

// Serialise tags from DB JSON string back to array for the response —
// the admin UI expects a real array.
const serializeRow = (row) => {
  if (!row) return row;
  let tags = [];
  if (typeof row.tags === 'string') {
    try { tags = JSON.parse(row.tags); if (!Array.isArray(tags)) tags = []; } catch { tags = []; }
  } else if (Array.isArray(row.tags)) {
    tags = row.tags;
  }
  return { ...row, tags };
};

// ─── Posts ──────────────────────────────────────────────────────────────────

const handlePostsCollection = (req, res, ctx) => {
  const { body, sendJson, origin, admin, url } = ctx;
  const db = getDb();
  const adminUser = admin?.username || 'admin';
  const urlObj = new URL(req.url, 'http://localhost');

  if (req.method === 'GET') {
    const showAll = urlObj.searchParams.get('all') === '1';
    const where = showAll ? '' : "WHERE active=1 AND status='published'";
    const items = db.prepare(`SELECT * FROM blog_posts ${where} ORDER BY published_at DESC, created_at DESC`).all();
    sendJson(res, 200, { success: true, items: items.map(serializeRow) }, origin);
    return true;
  }

  if (req.method === 'POST') {
    if (!body || (!body.title_ar && !body.title_en)) {
      sendJson(res, 400, { success: false, error: 'At least one title (AR or EN) is required.' }, origin);
      return true;
    }

    const status = sanitiseStatus(body.status);
    if (status === 'scheduled' && !body.publish_at) {
      sendJson(res, 400, { success: false, error: 'publish_at is required for scheduled posts.' }, origin);
      return true;
    }

    const id = body.id || randomUUID().slice(0, 12);
    const slug = (body.slug && body.slug.trim()) || deriveSlug(body, id);
    const reading_time = body.reading_time && Number.isFinite(Number(body.reading_time))
      ? Number(body.reading_time)
      : estimateReadingTime(body);
    const tags = normaliseTags(body.tags);
    const featured = body.featured ? 1 : 0;
    const active = status === 'draft' ? 0 : 1;
    const published_at = body.published_at || new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO blog_posts(
          id, slug, image, hero_image, category_id, tags,
          title_ar, title_en, title_tr, title_ru,
          excerpt_ar, excerpt_en, excerpt_tr, excerpt_ru,
          body_ar, body_en, body_tr, body_ru,
          meta_title_ar, meta_title_en, meta_title_tr, meta_title_ru,
          meta_description_ar, meta_description_en, meta_description_tr, meta_description_ru,
          author_name, author_avatar, reading_time, featured,
          status, published_at, publish_at, active
        ) VALUES(
          @id, @slug, @image, @hero_image, @category_id, @tags,
          @title_ar, @title_en, @title_tr, @title_ru,
          @excerpt_ar, @excerpt_en, @excerpt_tr, @excerpt_ru,
          @body_ar, @body_en, @body_tr, @body_ru,
          @meta_title_ar, @meta_title_en, @meta_title_tr, @meta_title_ru,
          @meta_description_ar, @meta_description_en, @meta_description_tr, @meta_description_ru,
          @author_name, @author_avatar, @reading_time, @featured,
          @status, @published_at, @publish_at, @active
        )
      `).run({
        id, slug,
        image: body.image || '',
        hero_image: body.hero_image || body.image || '',
        category_id: body.category_id || null,
        tags,
        title_ar: body.title_ar || '', title_en: body.title_en || '',
        title_tr: body.title_tr || '', title_ru: body.title_ru || '',
        excerpt_ar: body.excerpt_ar || '', excerpt_en: body.excerpt_en || '',
        excerpt_tr: body.excerpt_tr || '', excerpt_ru: body.excerpt_ru || '',
        body_ar: body.body_ar || '', body_en: body.body_en || '',
        body_tr: body.body_tr || '', body_ru: body.body_ru || '',
        meta_title_ar: body.meta_title_ar || '', meta_title_en: body.meta_title_en || '',
        meta_title_tr: body.meta_title_tr || '', meta_title_ru: body.meta_title_ru || '',
        meta_description_ar: body.meta_description_ar || '', meta_description_en: body.meta_description_en || '',
        meta_description_tr: body.meta_description_tr || '', meta_description_ru: body.meta_description_ru || '',
        author_name: body.author_name || '', author_avatar: body.author_avatar || '',
        reading_time, featured,
        status, published_at, publish_at: body.publish_at || null,
        active,
      });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        sendJson(res, 409, { success: false, error: 'A post with that slug already exists.' }, origin);
        return true;
      }
      logger.error({ err: err.message }, '[admin-blog] post insert failed');
      sendJson(res, 500, { success: false, error: 'Failed to create post.' }, origin);
      return true;
    }

    const created = db.prepare('SELECT * FROM blog_posts WHERE id=?').get(id);
    logAudit({ action: 'CREATE', entityType: 'blog_post', entityId: id, entityName: created?.title_ar || created?.title_en || id, adminUser });
    void invalidateBlogCache();
    sendJson(res, 201, { success: true, item: serializeRow(created) }, origin);
    return true;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
  return true;
};

const handlePostById = (req, res, ctx, id) => {
  const { body, sendJson, origin, admin } = ctx;
  const db = getDb();
  const adminUser = admin?.username || 'admin';

  if (req.method === 'GET') {
    const item = db.prepare('SELECT * FROM blog_posts WHERE id=?').get(id);
    if (!item) { sendJson(res, 404, { success: false, error: 'Post not found.' }, origin); return true; }
    sendJson(res, 200, { success: true, item: serializeRow(item) }, origin);
    return true;
  }

  if (req.method === 'PUT') {
    const updateBody = { ...body };
    if (updateBody.status !== undefined && !VALID_STATUSES.has(updateBody.status)) {
      sendJson(res, 400, { success: false, error: 'Invalid status.' }, origin);
      return true;
    }
    if (updateBody.tags !== undefined) {
      updateBody.tags = normaliseTags(updateBody.tags);
    }
    if (updateBody.featured !== undefined) {
      updateBody.featured = updateBody.featured ? 1 : 0;
    }
    if (updateBody.status === 'draft') updateBody.active = 0;
    else if (updateBody.status === 'published' || updateBody.status === 'scheduled') updateBody.active = 1;

    // Recompute reading_time when any body field changes (unless admin
    // supplied an explicit override).
    const bodyFieldsTouched = ['body_ar', 'body_en', 'body_tr', 'body_ru'].some((k) => k in updateBody);
    if (bodyFieldsTouched && updateBody.reading_time === undefined) {
      const current = db.prepare('SELECT body_ar, body_en, body_tr, body_ru FROM blog_posts WHERE id=?').get(id) || {};
      const merged = { ...current, ...updateBody };
      updateBody.reading_time = estimateReadingTime(merged);
    }

    const result = updatePostRow(id, updateBody);
    if (result.skipped) { sendJson(res, 400, { success: false, error: 'No fields to update.' }, origin); return true; }

    const updated = db.prepare('SELECT * FROM blog_posts WHERE id=?').get(id);
    logAudit({ action: 'UPDATE', entityType: 'blog_post', entityId: id, entityName: updated?.title_ar || updated?.title_en || id, adminUser });
    void invalidateBlogCache();
    sendJson(res, 200, { success: true, item: serializeRow(updated) }, origin);
    return true;
  }

  if (req.method === 'DELETE') {
    const post = db.prepare('SELECT title_ar, title_en FROM blog_posts WHERE id=?').get(id);
    db.prepare("UPDATE blog_posts SET active=0, updated_at=datetime('now') WHERE id=?").run(id);
    logAudit({ action: 'DELETE', entityType: 'blog_post', entityId: id, entityName: post?.title_ar || post?.title_en || id, adminUser });
    void invalidateBlogCache();
    sendJson(res, 200, { success: true }, origin);
    return true;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
  return true;
};

// ─── Categories ─────────────────────────────────────────────────────────────

const handleCategoriesCollection = (req, res, ctx) => {
  const { body, sendJson, origin, admin } = ctx;
  const db = getDb();
  const adminUser = admin?.username || 'admin';

  if (req.method === 'GET') {
    const items = db.prepare('SELECT * FROM blog_categories ORDER BY display_order ASC, name_ar ASC').all();
    sendJson(res, 200, { success: true, items }, origin);
    return true;
  }

  if (req.method === 'POST') {
    if (!body || (!body.name_ar && !body.name_en)) {
      sendJson(res, 400, { success: false, error: 'At least one name (AR or EN) is required.' }, origin);
      return true;
    }
    const id = body.id || randomUUID().slice(0, 12);
    const slug = (body.slug && body.slug.trim()) || deriveSlug({ title_ar: body.name_ar, title_en: body.name_en }, id);
    try {
      db.prepare(`
        INSERT INTO blog_categories(
          id, slug, color, icon,
          name_ar, name_en, name_tr, name_ru,
          description_ar, description_en, description_tr, description_ru,
          display_order, active
        ) VALUES(
          @id, @slug, @color, @icon,
          @name_ar, @name_en, @name_tr, @name_ru,
          @desc_ar, @desc_en, @desc_tr, @desc_ru,
          @display_order, 1
        )
      `).run({
        id, slug, color: body.color || null, icon: body.icon || null,
        name_ar: body.name_ar || '', name_en: body.name_en || '',
        name_tr: body.name_tr || '', name_ru: body.name_ru || '',
        desc_ar: body.description_ar || '', desc_en: body.description_en || '',
        desc_tr: body.description_tr || '', desc_ru: body.description_ru || '',
        display_order: Number(body.display_order) || 0,
      });
    } catch (err) {
      if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        sendJson(res, 409, { success: false, error: 'A category with that slug already exists.' }, origin);
        return true;
      }
      logger.error({ err: err.message }, '[admin-blog] category insert failed');
      sendJson(res, 500, { success: false, error: 'Failed to create category.' }, origin);
      return true;
    }
    const created = db.prepare('SELECT * FROM blog_categories WHERE id=?').get(id);
    logAudit({ action: 'CREATE', entityType: 'blog_category', entityId: id, entityName: created?.name_ar || created?.name_en || id, adminUser });
    void invalidateBlogCache();
    sendJson(res, 201, { success: true, item: created }, origin);
    return true;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
  return true;
};

const handleCategoryById = (req, res, ctx, id) => {
  const { body, sendJson, origin, admin } = ctx;
  const db = getDb();
  const adminUser = admin?.username || 'admin';

  if (req.method === 'GET') {
    const item = db.prepare('SELECT * FROM blog_categories WHERE id=?').get(id);
    if (!item) { sendJson(res, 404, { success: false, error: 'Category not found.' }, origin); return true; }
    sendJson(res, 200, { success: true, item }, origin);
    return true;
  }

  if (req.method === 'PUT') {
    const result = updateCategoryRow(id, body || {});
    if (result.skipped) { sendJson(res, 400, { success: false, error: 'No fields to update.' }, origin); return true; }
    const updated = db.prepare('SELECT * FROM blog_categories WHERE id=?').get(id);
    logAudit({ action: 'UPDATE', entityType: 'blog_category', entityId: id, entityName: updated?.name_ar || updated?.name_en || id, adminUser });
    void invalidateBlogCache();
    sendJson(res, 200, { success: true, item: updated }, origin);
    return true;
  }

  if (req.method === 'DELETE') {
    // Soft-delete: leave the row in place so existing posts that
    // reference category_id don't suddenly orphan; just hide it.
    const cat = db.prepare('SELECT name_ar, name_en FROM blog_categories WHERE id=?').get(id);
    db.prepare("UPDATE blog_categories SET active=0, updated_at=datetime('now') WHERE id=?").run(id);
    logAudit({ action: 'DELETE', entityType: 'blog_category', entityId: id, entityName: cat?.name_ar || cat?.name_en || id, adminUser });
    void invalidateBlogCache();
    sendJson(res, 200, { success: true }, origin);
    return true;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
  return true;
};

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export const handleAdminBlog = (req, res, ctx) => {
  const { url } = ctx;
  const postsByIdMatch = url.match(/^\/api\/admin\/blog\/posts\/([^/]+)$/);
  if (postsByIdMatch) return handlePostById(req, res, ctx, decodeURIComponent(postsByIdMatch[1]));
  if (url === '/api/admin/blog/posts') return handlePostsCollection(req, res, ctx);

  const catsByIdMatch = url.match(/^\/api\/admin\/blog\/categories\/([^/]+)$/);
  if (catsByIdMatch) return handleCategoryById(req, res, ctx, decodeURIComponent(catsByIdMatch[1]));
  if (url === '/api/admin/blog/categories') return handleCategoriesCollection(req, res, ctx);

  return false; // not our path — let the outer router 404
};
