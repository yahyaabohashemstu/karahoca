import { getDb, incrementStat, normalizeWeight } from '../db.mjs';
import { getPublicCached, setPublicCached } from '../services/publicCache.mjs';
import { createJsonHeaders } from '../middlewares/cors.mjs';

const normalizeLegacyAssetPath = (assetPath) => {
  if (typeof assetPath !== 'string') {
    return assetPath;
  }

  if (assetPath.startsWith('/diox/')) {
    return assetPath.replace('/diox/', '/diox-images/');
  }

  if (assetPath.startsWith('/aylux/')) {
    return assetPath.replace('/aylux/', '/aylux-images/');
  }

  return assetPath;
};

// ─── GET /api/products/:brand ────────────────────────────────────────────────

const sendCachedJson = (res, cachedBody, origin) => {
  const headers = createJsonHeaders(origin);
  headers['X-Cache'] = 'HIT';
  res.writeHead(200, headers);
  res.end(cachedBody);
};

export const handlePublicProducts = async (req, res, { sendJson, origin, url }) => {
  const db = getDb();
  const match = url.match(/^\/api\/products\/([^/?]+)/);
  if (!match) { sendJson(res, 400, { success: false, error: 'Brand required.' }, origin); return; }

  const brand = match[1].toUpperCase();
  const lang = new URL(req.url, 'http://localhost').searchParams.get('lang') || 'ar';
  const validLangs = ['ar', 'en', 'tr', 'ru'];
  const l = validLangs.includes(lang) ? lang : 'ar';

  // Short-circuit on cache hit (5-min TTL, admin mutations bust).
  const cached = await getPublicCached('products', [brand, l]);
  if (cached) {
    sendCachedJson(res, cached, origin);
    return;
  }

  const categories = db.prepare(`
    SELECT * FROM product_categories WHERE brand=? ORDER BY display_order ASC
  `).all(brand);

  const products = db.prepare(`
    SELECT
      p.id,
      p.category_id,
      p.name_${l} as name,
      p.description_${l} as description,
      p.image,
      p.gallery,
      p.alt_${l} as alt,
      p.weight,
      p.material_${l} as material,
      p.count_${l} as count,
      p.gift_${l} as gift,
      p.weight_count_table,
      p.image_scale
    FROM products p
    INNER JOIN product_categories c ON c.id = p.category_id
    WHERE c.brand = ? AND p.active = 1
    ORDER BY c.display_order ASC, p.display_order ASC
  `).all(brand);

  const productsByCategory = new Map();

  for (const product of products) {
    let gallery;
    if (product.gallery) {
      try {
        const raw = JSON.parse(product.gallery);
        gallery = Array.isArray(raw) ? raw.map(normalizeLegacyAssetPath) : undefined;
      } catch {
        gallery = undefined;
      }
    }

    const normalizedProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      image: normalizeLegacyAssetPath(product.image),
      alt: product.alt,
      gallery: gallery && gallery.length > 0 ? gallery : undefined,
      details: {
        weight: normalizeWeight(product.weight),
        material: product.material,
        count: product.count,
        ...(product.gift ? { gift: product.gift } : {}),
      },
      weightCountTable: (() => {
        if (!product.weight_count_table) return undefined;
        try {
          const parsed = JSON.parse(product.weight_count_table);
          if (!Array.isArray(parsed) || !parsed.length) return undefined;
          return parsed.map(row => ({ ...row, weight: normalizeWeight(row.weight) }));
        } catch {
          return undefined;
        }
      })(),
      imageScale: product.image_scale ?? 0.85,
    };

    const bucket = productsByCategory.get(product.category_id) || [];
    bucket.push(normalizedProduct);
    productsByCategory.set(product.category_id, bucket);
  }

  const result = categories.map(cat => ({
    id: cat.id,
    key: cat.key,
    title: cat[`title_${l}`] || cat.title_ar,
    products: productsByCategory.get(cat.id) || [],
  }));

  const serialised = JSON.stringify({ success: true, brand, categories: result });
  // Populate the cache for subsequent reads. Fire-and-forget — failures
  // fall back to the in-memory LRU path inside the Redis client.
  void setPublicCached('products', [brand, l], serialised);

  const headers = createJsonHeaders(origin);
  headers['X-Cache'] = 'MISS';
  res.writeHead(200, headers);
  res.end(serialised);
};

// ─── GET /api/news ───────────────────────────────────────────────────────────

export const handlePublicNews = async (req, res, { sendJson, origin }) => {
  const db = getDb();
  const lang = new URL(req.url, 'http://localhost').searchParams.get('lang') || 'ar';
  const validLangs = ['ar', 'en', 'tr', 'ru'];
  const l = validLangs.includes(lang) ? lang : 'ar';

  const cached = await getPublicCached('news', [l]);
  if (cached) {
    sendCachedJson(res, cached, origin);
    return;
  }

  const items = db.prepare(`
    SELECT
      id, slug, image, published_at,
      category_${l} as category,
      title_${l} as title,
      excerpt_${l} as excerpt,
      body_${l} as body
    FROM news
    WHERE active=1
      AND (
        status = 'published'
        OR status IS NULL
        OR (status = 'scheduled' AND publish_at IS NOT NULL AND datetime(publish_at) <= datetime('now'))
      )
    ORDER BY published_at DESC
  `).all();

  const localeMap = { ar: 'ar', en: 'en-US', tr: 'tr-TR', ru: 'ru-RU' };
  const locale = localeMap[l] || 'ar';

  const formatted = items.map(item => {
    let body = [];
    try { body = JSON.parse(item.body); } catch { body = item.body ? [item.body] : []; }

    return {
      id: item.id,
      slug: item.slug,
      image: normalizeLegacyAssetPath(item.image),
      publishedAt: item.published_at,
      dateLabel: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(item.published_at)),
      category: item.category,
      title: item.title,
      excerpt: item.excerpt,
      body,
      alt: item.title,
    };
  });

  const serialised = JSON.stringify({ success: true, items: formatted });
  void setPublicCached('news', [l], serialised);

  const headers = createJsonHeaders(origin);
  headers['X-Cache'] = 'MISS';
  res.writeHead(200, headers);
  res.end(serialised);
};

// ─── POST /api/chat/log ──────────────────────────────────────────────────────

export const handleChatLog = (req, res, { body, sendJson, origin }) => {
  const db = getDb();

  const { userId, sessionId, messages, language } = body;
  if (!userId || !Array.isArray(messages) || messages.length === 0) {
    sendJson(res, 400, { success: false, error: 'userId and messages required.' }, origin);
    return;
  }

  const now = new Date().toISOString();

  // Upsert user
  db.prepare(`
    INSERT INTO chat_users(id, first_seen, last_seen, language, message_count)
    VALUES(@id, @now, @now, @lang, @count)
    ON CONFLICT(id) DO UPDATE SET
      last_seen = @now,
      language = @lang,
      message_count = message_count + @count
  `).run({ id: userId, now, lang: language || 'ar', count: messages.length });

  // Insert messages (check for duplicates via unique constraint workaround)
  const insertMsg = db.prepare(`
    INSERT OR IGNORE INTO chat_messages(user_id, session_id, role, content, language, created_at)
    VALUES(@user_id, @session_id, @role, @content, @language, @created_at)
  `);

  for (const msg of messages) {
    if (!msg.role || !msg.content) continue;
    insertMsg.run({
      user_id: userId,
      session_id: sessionId || null,
      role: msg.role,
      content: msg.content,
      language: language || msg.language || 'ar',
      created_at: msg.timestamp || now,
    });
  }

  incrementStat('chat_messages');

  sendJson(res, 200, { success: true }, origin);
};
