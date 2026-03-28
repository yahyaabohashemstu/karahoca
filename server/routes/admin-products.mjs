import { getDb } from '../db.mjs';
import { randomUUID } from 'node:crypto';

const PRODUCT_FIELDS = [
  'brand', 'category_id',
  'name_ar', 'name_en', 'name_tr', 'name_ru',
  'description_ar', 'description_en', 'description_tr', 'description_ru',
  'image',
  'alt_ar', 'alt_en', 'alt_tr', 'alt_ru',
  'weight',
  'material_ar', 'material_en', 'material_tr', 'material_ru',
  'count_ar', 'count_en', 'count_tr', 'count_ru',
  'sizes',
  'display_order', 'active',
];

// Serialize sizes array → JSON string before storing, parse after reading
const serializeSizes = (sizes) => {
  if (!sizes) return null;
  if (typeof sizes === 'string') return sizes; // already JSON string
  return JSON.stringify(sizes);
};

const parseSizes = (sizesStr) => {
  if (!sizesStr) return null;
  try { return JSON.parse(sizesStr); } catch { return null; }
};

export const handleAdminProducts = (req, res, { body, sendJson, origin, url }) => {
  const db = getDb();
  const urlObj = new URL(req.url, 'http://localhost');

  // /api/admin/products/:id
  const idMatch = url.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (req.method === 'GET') {
      const product = db.prepare('SELECT * FROM products WHERE id=?').get(id);
      if (!product) { sendJson(res, 404, { success: false, error: 'Product not found.' }, origin); return; }
      product.sizes = parseSizes(product.sizes);
      sendJson(res, 200, { success: true, product }, origin);
      return;
    }

    if (req.method === 'PUT') {
      const normalizedBody = { ...body, sizes: serializeSizes(body.sizes) };
      const sets = PRODUCT_FIELDS.filter(f => normalizedBody[f] !== undefined)
        .map(f => `${f} = @${f}`).join(', ');
      if (!sets) { sendJson(res, 400, { success: false, error: 'No fields to update.' }, origin); return; }

      db.prepare(`UPDATE products SET ${sets}, updated_at=datetime('now') WHERE id=@id`)
        .run({ ...normalizedBody, id });
      const updated = db.prepare('SELECT * FROM products WHERE id=?').get(id);
      updated.sizes = parseSizes(updated.sizes);
      sendJson(res, 200, { success: true, product: updated }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      db.prepare("UPDATE products SET active=0, updated_at=datetime('now') WHERE id=?").run(id);
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // /api/admin/products
  if (req.method === 'GET') {
    const brand = urlObj.searchParams.get('brand');
    const showInactive = urlObj.searchParams.get('all') === '1';

    let where = showInactive ? '' : 'WHERE p.active=1';
    const params = [];
    if (brand) {
      where = showInactive ? 'WHERE p.brand=?' : 'WHERE p.brand=? AND p.active=1';
      params.push(brand);
    }

    const products = db.prepare(`
      SELECT p.*, pc.title_ar as category_title_ar, pc.title_en as category_title_en
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      ${where}
      ORDER BY p.category_id, p.display_order ASC
    `).all(...params).map(p => ({ ...p, sizes: parseSizes(p.sizes) }));

    sendJson(res, 200, { success: true, products }, origin);
    return;
  }

  if (req.method === 'POST') {
    const required = ['brand', 'category_id', 'name_ar'];
    for (const f of required) {
      if (!body[f]) {
        sendJson(res, 400, { success: false, error: `Field "${f}" is required.` }, origin);
        return;
      }
    }

    const id = body.id || `${body.brand.toLowerCase()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO products(
        id, brand, category_id,
        name_ar, name_en, name_tr, name_ru,
        description_ar, description_en, description_tr, description_ru,
        image, alt_ar, alt_en, alt_tr, alt_ru,
        weight, sizes,
        material_ar, material_en, material_tr, material_ru,
        count_ar, count_en, count_tr, count_ru,
        display_order, active, created_at, updated_at
      ) VALUES(
        @id, @brand, @category_id,
        @name_ar, @name_en, @name_tr, @name_ru,
        @desc_ar, @desc_en, @desc_tr, @desc_ru,
        @image, @alt_ar, @alt_en, @alt_tr, @alt_ru,
        @weight, @sizes,
        @mat_ar, @mat_en, @mat_tr, @mat_ru,
        @cnt_ar, @cnt_en, @cnt_tr, @cnt_ru,
        @display_order, 1, @now, @now
      )
    `).run({
      id, brand: body.brand, category_id: body.category_id,
      name_ar: body.name_ar || '', name_en: body.name_en || '',
      name_tr: body.name_tr || '', name_ru: body.name_ru || '',
      desc_ar: body.description_ar || '', desc_en: body.description_en || '',
      desc_tr: body.description_tr || '', desc_ru: body.description_ru || '',
      image: body.image || '',
      alt_ar: body.alt_ar || '', alt_en: body.alt_en || '',
      alt_tr: body.alt_tr || '', alt_ru: body.alt_ru || '',
      weight: body.weight || '',
      sizes: serializeSizes(body.sizes),
      mat_ar: body.material_ar || '', mat_en: body.material_en || '',
      mat_tr: body.material_tr || '', mat_ru: body.material_ru || '',
      cnt_ar: body.count_ar || '', cnt_en: body.count_en || '',
      cnt_tr: body.count_tr || '', cnt_ru: body.count_ru || '',
      display_order: body.display_order || 0,
      now,
    });

    const product = db.prepare('SELECT * FROM products WHERE id=?').get(id);
    product.sizes = parseSizes(product.sizes);
    sendJson(res, 201, { success: true, product }, origin);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};

// ─── Categories ──────────────────────────────────────────────────────────────

export const handleAdminCategories = (req, res, { body, sendJson, origin, url }) => {
  const db = getDb();

  const idMatch = url.match(/^\/api\/admin\/categories\/([^/]+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (req.method === 'PUT') {
      const fields = ['title_ar','title_en','title_tr','title_ru','display_order','key'];
      const sets = fields.filter(f => body[f] !== undefined).map(f => `${f}=@${f}`).join(', ');
      if (sets) db.prepare(`UPDATE product_categories SET ${sets} WHERE id=@id`).run({ ...body, id });
      sendJson(res, 200, { success: true, category: db.prepare('SELECT * FROM product_categories WHERE id=?').get(id) }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      const productCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id=? AND active=1').get(id).c;
      if (productCount > 0) {
        sendJson(res, 400, { success: false, error: `Cannot delete: ${productCount} active products in this category.` }, origin);
        return;
      }
      db.prepare('DELETE FROM product_categories WHERE id=?').run(id);
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  if (req.method === 'GET') {
    const brand = new URL(req.url, 'http://localhost').searchParams.get('brand');
    const where = brand ? 'WHERE brand=?' : '';
    const cats = db.prepare(`SELECT * FROM product_categories ${where} ORDER BY brand, display_order`).all(...(brand ? [brand] : []));
    sendJson(res, 200, { success: true, categories: cats }, origin);
    return;
  }

  if (req.method === 'POST') {
    const id = body.id || `${(body.brand || 'cat').toLowerCase()}-${randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO product_categories(id,brand,key,title_ar,title_en,title_tr,title_ru,display_order)
      VALUES(@id,@brand,@key,@title_ar,@title_en,@title_tr,@title_ru,@display_order)
    `).run({
      id, brand: body.brand, key: body.key || id,
      title_ar: body.title_ar || '', title_en: body.title_en || '',
      title_tr: body.title_tr || '', title_ru: body.title_ru || '',
      display_order: body.display_order || 0,
    });
    sendJson(res, 201, { success: true, category: db.prepare('SELECT * FROM product_categories WHERE id=?').get(id) }, origin);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};
