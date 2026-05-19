/**
 * Public blog API.
 *
 * Endpoints
 *   GET  /api/blog/posts?lang=&category=&tag=&featured=&page=&limit=
 *        List published posts. Filters compose with AND. Returns
 *        { items: [...], total, page, pageSize, totalPages }.
 *
 *   GET  /api/blog/posts/:slug?lang=
 *        Single post. Increments view_count. Returns the post plus
 *        a `related` array (3 posts from the same category, newest
 *        first, excluding the current one).
 *
 *   GET  /api/blog/categories?lang=
 *        All active categories with localised name + post count.
 *
 *   POST /api/blog/posts/:slug/view
 *        Lightweight beacon — increments view_count. Separate from
 *        GET so the count survives caching. CSRF-gated like all
 *        public mutating endpoints.
 *
 * Caching
 *   List queries cache by full query-string fingerprint with a 5-min
 *   TTL (reuses publicCache.mjs). Single-post fetches are cached too
 *   but BUST on view-count increments to avoid stale counts.
 *   Admin mutations also bust via invalidateBlogCache() (called
 *   from admin-blog.mjs).
 */

import { getDb } from '../db.mjs';
import { getPublicCached, setPublicCached, invalidateBlogCache } from '../services/publicCache.mjs';
import { createJsonHeaders } from '../middlewares/cors.mjs';
import { logger } from '../utils/logger.mjs';

const SUPPORTED_LANGS = ['ar', 'en', 'tr', 'ru'];

const safeLang = (input) => {
  const code = (input || 'ar').toLowerCase();
  return SUPPORTED_LANGS.includes(code) ? code : 'ar';
};

const safeInt = (input, defaultValue, max) => {
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || n < 1) return defaultValue;
  if (max && n > max) return max;
  return n;
};

/**
 * Parse the stored JSON tags array safely. Returns [] on any error.
 */
const parseTags = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Map a DB row to the public shape — strips inactive language fields,
 * folds in category metadata, and JSON-parses tags. Caller provides
 * `lang` so we return only the requested language plus English
 * fallbacks. The admin endpoint serves the full polyglot blob via a
 * different serializer (see admin-blog.mjs).
 */
const toPublicPost = (row, lang, categoryRow) => {
  if (!row) return null;
  const l = safeLang(lang);
  // English fallback when the requested language field is empty —
  // admin frequently authors AR + EN first, then back-fills TR/RU.
  const pick = (suffix) =>
    (row[`${suffix}_${l}`] && String(row[`${suffix}_${l}`]).trim()) ||
    row[`${suffix}_en`] ||
    row[`${suffix}_ar`] ||
    '';

  return {
    id: row.id,
    slug: row.slug,
    image: row.image || null,
    heroImage: row.hero_image || row.image || null,
    title: pick('title'),
    excerpt: pick('excerpt'),
    body: pick('body'),
    metaTitle: pick('meta_title') || pick('title'),
    metaDescription: pick('meta_description') || pick('excerpt'),
    authorName: row.author_name || null,
    authorAvatar: row.author_avatar || null,
    readingTime: Number.isFinite(row.reading_time) ? row.reading_time : 0,
    viewCount: Number.isFinite(row.view_count) ? row.view_count : 0,
    featured: Boolean(row.featured),
    publishedAt: row.published_at,
    tags: parseTags(row.tags),
    category: categoryRow
      ? {
          id: categoryRow.id,
          slug: categoryRow.slug,
          name:
            (categoryRow[`name_${l}`] && String(categoryRow[`name_${l}`]).trim()) ||
            categoryRow.name_en ||
            categoryRow.name_ar ||
            '',
          color: categoryRow.color || null,
          icon: categoryRow.icon || null,
        }
      : null,
  };
};

const toPublicCategory = (row, lang, postCount) => {
  if (!row) return null;
  const l = safeLang(lang);
  const pick = (suffix) =>
    (row[`${suffix}_${l}`] && String(row[`${suffix}_${l}`]).trim()) ||
    row[`${suffix}_en`] ||
    row[`${suffix}_ar`] ||
    '';
  return {
    id: row.id,
    slug: row.slug,
    name: pick('name'),
    description: pick('description'),
    color: row.color || null,
    icon: row.icon || null,
    postCount: Number.isFinite(postCount) ? postCount : 0,
  };
};

// ─── GET /api/blog/posts ────────────────────────────────────────────────────

export const handleBlogList = async (req, res, { sendJson, origin, url }) => {
  const db = getDb();
  const urlObj = new URL(req.url, 'http://localhost');
  const lang = safeLang(urlObj.searchParams.get('lang'));
  const categorySlug = urlObj.searchParams.get('category') || '';
  const tag = urlObj.searchParams.get('tag') || '';
  const featuredOnly = urlObj.searchParams.get('featured') === '1';
  const page = safeInt(urlObj.searchParams.get('page'), 1);
  const pageSize = safeInt(urlObj.searchParams.get('limit'), 12, 50);

  // Cache key fingerprint — full query so each filter combination
  // caches independently.
  const cacheKey = `list:${lang}:${categorySlug}:${tag}:${featuredOnly ? 'f' : '_'}:${page}:${pageSize}`;
  const cached = await getPublicCached('blog', [cacheKey]);
  if (cached) {
    const headers = createJsonHeaders(origin);
    headers['X-Cache'] = 'HIT';
    res.writeHead(200, headers);
    res.end(cached);
    return;
  }

  // Build WHERE conditions. Status='published' AND active=1 cuts drafts
  // and the scheduler's pending entries; published_at <= now drops any
  // future-dated rows that aren't yet released.
  //
  // `datetime(published_at)` normalises both ISO 8601 (with 'T' / 'Z')
  // and SQLite-canonical formats to the same shape before comparing,
  // so a post seeded with `Date.toISOString()` doesn't get filtered
  // out by lexical string ordering (the bug that hid every seeded
  // blog post from the public list on first deploy).
  const conditions = ["status='published'", 'active=1', "datetime(published_at) <= datetime('now')"];
  const params = {};
  let categoryRow = null;

  if (categorySlug) {
    categoryRow = db.prepare('SELECT * FROM blog_categories WHERE slug=? AND active=1').get(categorySlug);
    if (!categoryRow) {
      sendJson(res, 404, { success: false, error: 'Category not found.' }, origin);
      return;
    }
    conditions.push('category_id = @categoryId');
    params.categoryId = categoryRow.id;
  }

  if (featuredOnly) {
    conditions.push('featured = 1');
  }

  if (tag) {
    // Tags stored as JSON array — substring scan is fine at our scale
    // (a few hundred posts). FTS5 + a tags subtable would be the right
    // move past ~10k posts.
    conditions.push('tags LIKE @tagLike');
    params.tagLike = `%"${tag}"%`;
  }

  const whereSQL = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalRow = db.prepare(`SELECT COUNT(*) AS n FROM blog_posts ${whereSQL}`).get(params);
  const total = totalRow?.n || 0;

  // Featured posts at the top, then chronological. The CASE preserves
  // editorial intent (admin pinned them) while keeping the rest fresh.
  const rows = db.prepare(`
    SELECT * FROM blog_posts ${whereSQL}
    ORDER BY featured DESC, published_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

  // Bulk-load all categories referenced by the result set so we don't
  // run one query per post.
  const catIds = [...new Set(rows.map((r) => r.category_id).filter(Boolean))];
  const catMap = new Map();
  if (catIds.length) {
    const placeholders = catIds.map(() => '?').join(',');
    const cats = db.prepare(`SELECT * FROM blog_categories WHERE id IN (${placeholders})`).all(...catIds);
    for (const c of cats) catMap.set(c.id, c);
  }

  const items = rows.map((r) => toPublicPost(r, lang, catMap.get(r.category_id)));

  const payload = JSON.stringify({
    success: true,
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    category: categoryRow ? toPublicCategory(categoryRow, lang, total) : null,
  });

  await setPublicCached('blog', [cacheKey], payload, 5 * 60);
  const headers = createJsonHeaders(origin);
  headers['X-Cache'] = 'MISS';
  res.writeHead(200, headers);
  res.end(payload);
};

// ─── GET /api/blog/posts/:slug ──────────────────────────────────────────────

export const handleBlogPost = async (req, res, { sendJson, origin, url }) => {
  const db = getDb();
  const match = url.match(/^\/api\/blog\/posts\/([^/?]+)$/);
  if (!match) {
    sendJson(res, 400, { success: false, error: 'Invalid path.' }, origin);
    return;
  }
  const slug = decodeURIComponent(match[1]);
  const urlObj = new URL(req.url, 'http://localhost');
  const lang = safeLang(urlObj.searchParams.get('lang'));

  const cacheKey = `post:${slug}:${lang}`;
  const cached = await getPublicCached('blog', [cacheKey]);
  if (cached) {
    const headers = createJsonHeaders(origin);
    headers['X-Cache'] = 'HIT';
    res.writeHead(200, headers);
    res.end(cached);
    return;
  }

  const row = db.prepare(`
    SELECT * FROM blog_posts
    WHERE slug=? AND active=1 AND status='published' AND datetime(published_at) <= datetime('now')
  `).get(slug);

  if (!row) {
    sendJson(res, 404, { success: false, error: 'Post not found.' }, origin);
    return;
  }

  const categoryRow = row.category_id
    ? db.prepare('SELECT * FROM blog_categories WHERE id=?').get(row.category_id)
    : null;

  // Related — 3 newest posts from the same category, excluding self.
  // Falls back to "any latest 3" when the post has no category or the
  // category has fewer than 3 siblings.
  let related = [];
  if (categoryRow) {
    const relatedRows = db.prepare(`
      SELECT * FROM blog_posts
      WHERE category_id=? AND id != ? AND status='published' AND active=1
        AND datetime(published_at) <= datetime('now')
      ORDER BY published_at DESC
      LIMIT 3
    `).all(categoryRow.id, row.id);
    related = relatedRows.map((r) => toPublicPost(r, lang, categoryRow));
  }
  if (related.length < 3) {
    const fillRows = db.prepare(`
      SELECT * FROM blog_posts
      WHERE id != ? AND status='published' AND active=1
        AND datetime(published_at) <= datetime('now')
      ORDER BY published_at DESC
      LIMIT ?
    `).all(row.id, 3 - related.length);
    const fillCatIds = [...new Set(fillRows.map((r) => r.category_id).filter(Boolean))];
    const fillCatMap = new Map();
    if (fillCatIds.length) {
      const placeholders = fillCatIds.map(() => '?').join(',');
      const cats = db.prepare(`SELECT * FROM blog_categories WHERE id IN (${placeholders})`).all(...fillCatIds);
      for (const c of cats) fillCatMap.set(c.id, c);
    }
    related = related.concat(fillRows.map((r) => toPublicPost(r, lang, fillCatMap.get(r.category_id))));
  }

  const post = toPublicPost(row, lang, categoryRow);

  const payload = JSON.stringify({ success: true, item: post, related });
  await setPublicCached('blog', [cacheKey], payload, 5 * 60);
  const headers = createJsonHeaders(origin);
  headers['X-Cache'] = 'MISS';
  res.writeHead(200, headers);
  res.end(payload);
};

// ─── GET /api/blog/categories ───────────────────────────────────────────────

export const handleBlogCategories = async (req, res, { sendJson, origin }) => {
  const db = getDb();
  const urlObj = new URL(req.url, 'http://localhost');
  const lang = safeLang(urlObj.searchParams.get('lang'));

  const cacheKey = `cats:${lang}`;
  const cached = await getPublicCached('blog', [cacheKey]);
  if (cached) {
    const headers = createJsonHeaders(origin);
    headers['X-Cache'] = 'HIT';
    res.writeHead(200, headers);
    res.end(cached);
    return;
  }

  const rows = db.prepare('SELECT * FROM blog_categories WHERE active=1 ORDER BY display_order ASC').all();

  // Single roll-up query for post counts so we don't fan out N queries.
  const counts = db.prepare(`
    SELECT category_id, COUNT(*) AS n
    FROM blog_posts
    WHERE active=1 AND status='published' AND datetime(published_at) <= datetime('now')
    GROUP BY category_id
  `).all();
  const countMap = new Map(counts.map((c) => [c.category_id, c.n]));

  const items = rows.map((r) => toPublicCategory(r, lang, countMap.get(r.id) || 0));

  const payload = JSON.stringify({ success: true, items });
  await setPublicCached('blog', [cacheKey], payload, 10 * 60);
  const headers = createJsonHeaders(origin);
  headers['X-Cache'] = 'MISS';
  res.writeHead(200, headers);
  res.end(payload);
};

// ─── POST /api/blog/posts/:slug/view ────────────────────────────────────────
// Lightweight view-count beacon. Anonymous, rate-limited indirectly
// through the existing IP-based limiter chain — we don't bother
// rate-limiting per slug because each call is one UPDATE that costs
// less than the rate-check itself.

export const handleBlogViewIncrement = (req, res, { sendJson, origin, url }) => {
  const match = url.match(/^\/api\/blog\/posts\/([^/?]+)\/view$/);
  if (!match) {
    sendJson(res, 400, { success: false, error: 'Invalid path.' }, origin);
    return;
  }
  const slug = decodeURIComponent(match[1]);
  const db = getDb();
  try {
    const r = db.prepare('UPDATE blog_posts SET view_count = view_count + 1 WHERE slug=? AND active=1').run(slug);
    if (r.changes === 0) {
      sendJson(res, 404, { success: false, error: 'Post not found.' }, origin);
      return;
    }
    // View counts naturally drift behind the cache TTL (5 min). Not
    // worth a fan-out invalidation for cosmetic accuracy — the next
    // miss will hit the fresh count anyway.
    sendJson(res, 200, { success: true }, origin);
  } catch (err) {
    logger.error({ err: err.message, slug }, '[blog] view increment failed');
    sendJson(res, 500, { success: false, error: 'Failed to record view.' }, origin);
  }
};

// Re-export the cache invalidator so admin routes can call it from one
// import. The actual implementation lives in services/publicCache.mjs.
export { invalidateBlogCache };
