import { getDb, incrementStat } from '../db.mjs';

// ─── GET /api/products/:brand ────────────────────────────────────────────────

export const handlePublicProducts = (req, res, { sendJson, origin, url }) => {
  const db = getDb();
  const match = url.match(/^\/api\/products\/([^/?]+)/);
  if (!match) { sendJson(res, 400, { success: false, error: 'Brand required.' }, origin); return; }

  const brand = match[1].toUpperCase();
  const lang = new URL(req.url, 'http://localhost').searchParams.get('lang') || 'ar';
  const validLangs = ['ar', 'en', 'tr', 'ru'];
  const l = validLangs.includes(lang) ? lang : 'ar';

  const categories = db.prepare(`
    SELECT * FROM product_categories WHERE brand=? ORDER BY display_order ASC
  `).all(brand);

  const result = categories.map(cat => {
    const products = db.prepare(`
      SELECT
        id,
        name_${l} as name,
        description_${l} as description,
        image,
        alt_${l} as alt,
        weight,
        sizes,
        material_${l} as material,
        count_${l} as count
      FROM products
      WHERE category_id=? AND active=1
      ORDER BY display_order ASC
    `).all(cat.id);

    return {
      id: cat.id,
      key: cat.key,
      title: cat[`title_${l}`] || cat.title_ar,
      products: products.map(p => {
        let sizes = null;
        try { sizes = p.sizes ? JSON.parse(p.sizes) : null; } catch { sizes = null; }
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          image: p.image,
          alt: p.alt,
          sizes,
          details: {
            weight: p.weight,
            material: p.material,
            count: p.count,
          }
        };
      })
    };
  });

  sendJson(res, 200, { success: true, brand, categories: result }, origin);
};

// ─── GET /api/news ───────────────────────────────────────────────────────────

export const handlePublicNews = (req, res, { sendJson, origin }) => {
  const db = getDb();
  const lang = new URL(req.url, 'http://localhost').searchParams.get('lang') || 'ar';
  const validLangs = ['ar', 'en', 'tr', 'ru'];
  const l = validLangs.includes(lang) ? lang : 'ar';

  const items = db.prepare(`
    SELECT
      id, slug, image, published_at,
      category_${l} as category,
      title_${l} as title,
      excerpt_${l} as excerpt,
      body_${l} as body
    FROM news WHERE active=1
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
      image: item.image,
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

  sendJson(res, 200, { success: true, items: formatted }, origin);
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
