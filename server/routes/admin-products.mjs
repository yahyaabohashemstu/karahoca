import { getDb, logAudit, normalizeWeight } from '../db.mjs';
import { randomUUID } from 'node:crypto';
import { buildUpdater } from '../services/safeUpdate.mjs';
import { invalidateProductsCache } from '../services/publicCache.mjs';
import { invalidateProductOgCache } from '../services/ogImage.mjs';
import { hasEncodingDamage, parseCsvObjects, stringifyCsv, stripFormulaGuard } from '../services/csv.mjs';
import { generateProductDescriptions } from '../services/aiDescriptionWriter.mjs';
import { normalizeMarketplaceUrlFields } from '../services/marketplaceLinks.mjs';

const PRODUCT_FIELDS = [
  'brand', 'category_id',
  'name_ar', 'name_en', 'name_tr', 'name_ru',
  'description_ar', 'description_en', 'description_tr', 'description_ru',
  'image', 'gallery',
  'alt_ar', 'alt_en', 'alt_tr', 'alt_ru',
  'weight',
  'material_ar', 'material_en', 'material_tr', 'material_ru',
  'count_ar', 'count_en', 'count_tr', 'count_ru',
  // Free gift shown on the product card ("+ gift: …"). Was missing here,
  // so it could only ever be set by a DB migration, never from the admin.
  'gift_ar', 'gift_en', 'gift_tr', 'gift_ru',
  'weight_count_table',
  'image_scale',
  // The product's own marketplace listings — validated by
  // normalizeMarketplaceUrlFields() before every write.
  'trendyol_url', 'hepsiburada_url',
  'display_order', 'active',
  // D5 publishing fields — status is enum-checked at the route layer,
  // publish_at is an ISO-8601 string (validated by the admin form's
  // datetime-local picker before submission).
  'status', 'publish_at',
];

const VALID_PRODUCT_STATUSES = new Set(['draft', 'scheduled', 'published']);

// Safe UPDATE helpers — column names are validated at module init, SQL is
// pre-compiled and cached per unique field subset; no runtime interpolation.
const updateProductRow = buildUpdater('products', PRODUCT_FIELDS);
const CATEGORY_FIELDS = ['title_ar', 'title_en', 'title_tr', 'title_ru', 'display_order', 'key'];
const updateCategoryRow = buildUpdater('product_categories', CATEGORY_FIELDS, {
  // product_categories has no updated_at column.
  touchUpdatedAt: false,
});

// ─── CSV import/export schema ────────────────────────────────────────────────
// The CSV column order MUST stay stable across exports so admins can
// round-trip files through Excel/Sheets. New product columns added in
// the future should be appended at the END of CSV_COLUMNS so an old
// export file can still be re-imported (missing right-edge columns get
// the per-field default in the importer).
const CSV_COLUMNS = [
  'id', 'brand', 'category_id',
  'name_ar', 'name_en', 'name_tr', 'name_ru',
  'description_ar', 'description_en', 'description_tr', 'description_ru',
  'image',
  'alt_ar', 'alt_en', 'alt_tr', 'alt_ru',
  'weight',
  'material_ar', 'material_en', 'material_tr', 'material_ru',
  'count_ar', 'count_en', 'count_tr', 'count_ru',
  'display_order', 'active',
];

const REQUIRED_IMPORT_FIELDS = ['brand', 'category_id', 'name_ar'];

/**
 * Validate and coerce a single row from a CSV import. Returns either
 * `{ ok: true, data, mode }` where mode is 'insert' | 'update', or
 * `{ ok: false, error }` with the first problem found.
 */
const normalizeImportRow = (raw, db, lineNumber) => {
  const data = {};
  // The export prefixes "'" to cells starting with = + - @ (Excel formula
  // guard); strip it again or every round trip adds it to the field.
  for (const col of CSV_COLUMNS) data[col] = stripFormulaGuard((raw[col] ?? '').toString()).trim();

  for (const req of REQUIRED_IMPORT_FIELDS) {
    if (!data[req]) {
      return { ok: false, error: `Row ${lineNumber}: missing required field "${req}".` };
    }
  }
  if (!['DIOX', 'AYLUX'].includes(data.brand)) {
    return { ok: false, error: `Row ${lineNumber}: brand must be DIOX or AYLUX (got "${data.brand}").` };
  }
  const cat = db.prepare('SELECT id, brand FROM product_categories WHERE id=?').get(data.category_id);
  if (!cat) {
    return { ok: false, error: `Row ${lineNumber}: category_id "${data.category_id}" does not exist.` };
  }
  if (cat.brand !== data.brand) {
    return {
      ok: false,
      error: `Row ${lineNumber}: category "${data.category_id}" belongs to ${cat.brand}, not ${data.brand}.`,
    };
  }
  // Normalise the weight string so "1L", "1 L", "1l" all collapse to
  // the same canonical form used by the rest of the app.
  if (data.weight) data.weight = normalizeWeight(data.weight);
  // Coerce booleans / numerics from their string CSV representation.
  data.display_order = data.display_order ? Number.parseInt(data.display_order, 10) || 0 : 0;
  data.active = ['', '1', 'true', 'TRUE', 'yes', 'Y', 'y'].includes(data.active) ? 1 : 0;

  // Did this id already exist? Determines insert vs update.
  let mode = 'insert';
  if (data.id) {
    const exists = db.prepare('SELECT 1 FROM products WHERE id=?').get(data.id);
    if (exists) mode = 'update';
  } else {
    // Generate a fresh id so re-importing without one doesn't collide.
    data.id = `${data.brand.toLowerCase()}-${randomUUID().slice(0, 8)}`;
  }
  if (mode === 'update') {
    // An update writes only the columns the file actually has. Missing
    // columns used to be written as '' — so a trimmed or older export
    // (e.g. without the description columns) wiped those fields on every
    // product, a missing "active" column re-activated deleted products,
    // and a missing "display_order" reset the curated order. An EMPTY
    // cell in a present column still clears the field, as before.
    for (const col of CSV_COLUMNS) {
      if (col !== 'id' && !Object.prototype.hasOwnProperty.call(raw, col)) delete data[col];
    }
  }
  return { ok: true, data, mode };
};

export const handleAdminProducts = async (req, res, { body, sendJson, origin, url, admin }) => {
  const db = getDb();
  const adminUser = admin?.username || 'admin';
  const urlObj = new URL(req.url, 'http://localhost');

  // ── POST /api/admin/products/ai-description — AI copywriter ──────────────
  // Generates a polished commercial description in all four languages
  // from a short brief (name + brand + optional category/hint). Routes
  // through the same Gemini → OpenRouter provider chain as the visitor
  // chat, so we inherit its retry / fallback behaviour. The admin
  // gets four-language output in a single round-trip, with consistent
  // terminology across translations because the model sees them
  // together.
  if (url === '/api/admin/products/ai-description' && req.method === 'POST') {
    const { name, brand, category, hint, sourceLang } = body || {};
    try {
      const descriptions = await generateProductDescriptions({
        name,
        brand,
        category,
        hint,
        sourceLang: sourceLang || 'ar',
      });
      logAudit({
        action: 'UPDATE',
        entityType: 'product',
        entityName: `AI description draft for "${name}" (${brand})`,
        adminUser,
        details: hint ? `Hint: ${String(hint).slice(0, 200)}` : 'No hint provided',
      });
      sendJson(res, 200, { success: true, descriptions }, origin);
    } catch (err) {
      const code = err?.code;
      if (code === 'VALIDATION') {
        sendJson(res, 400, { success: false, error: err.message }, origin);
      } else if (code === 'AI_PROVIDERS_UNAVAILABLE') {
        sendJson(res, 503, { success: false, error: err.message }, origin);
      } else {
        // PARSE_FAILED / SHAPE_FAILED / EMPTY_RESPONSE — model-side
        // issues that an admin retry will usually fix.
        sendJson(res, 502, { success: false, error: err.message || 'AI generation failed.' }, origin);
      }
    }
    return;
  }

  // ── GET /api/admin/products/export.csv — download full catalogue ─────────
  if (url === '/api/admin/products/export.csv' && req.method === 'GET') {
    const brand = urlObj.searchParams.get('brand');
    const where = brand ? 'WHERE p.brand=?' : '';
    const params = brand ? [brand] : [];
    const rows = db.prepare(`
      SELECT
        p.id, p.brand, p.category_id,
        p.name_ar, p.name_en, p.name_tr, p.name_ru,
        p.description_ar, p.description_en, p.description_tr, p.description_ru,
        p.image,
        p.alt_ar, p.alt_en, p.alt_tr, p.alt_ru,
        p.weight,
        p.material_ar, p.material_en, p.material_tr, p.material_ru,
        p.count_ar, p.count_en, p.count_tr, p.count_ru,
        p.display_order, p.active
      FROM products p
      ${where}
      ORDER BY p.brand, p.category_id, p.display_order
    `).all(...params);

    const csv = stringifyCsv(rows, CSV_COLUMNS);
    logAudit({
      action: 'EXPORT',
      entityType: 'product',
      entityName: brand
        ? `CSV export of ${brand} products`
        : 'CSV export of full product catalogue',
      adminUser,
      details: `${rows.length} rows exported`,
    });
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-${(brand || 'all').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    res.end(csv);
    return;
  }

  // ── POST /api/admin/products/import.csv ─────────────────────────────────
  // Body shape: { csv: string, dryRun?: boolean }
  // Returns: { success, summary: { total, inserted, updated, errors:[{line,error}] } }
  //
  // dryRun=true validates without writing — used to power a confirmation
  // preview in the admin UI. Run wrapped in a single transaction so a
  // mid-import failure rolls back cleanly; otherwise a bad row 50 of
  // 100 would leave the catalogue half-updated.
  if (url === '/api/admin/products/import.csv' && req.method === 'POST') {
    const csv = typeof body.csv === 'string' ? body.csv : '';
    const dryRun = body.dryRun === true;
    if (!csv.trim()) {
      sendJson(res, 400, { success: false, error: 'csv body required (string).' }, origin);
      return;
    }
    if (hasEncodingDamage(csv)) {
      sendJson(res, 400, {
        success: false,
        error: 'The file is not UTF-8, so its Arabic/Turkish/Russian text arrived corrupted ("�"). '
          + 'In Excel use File → Save As → "CSV UTF-8 (Comma delimited)" and import that file.',
      }, origin);
      return;
    }
    const { records, rowNumbers } = parseCsvObjects(csv);
    if (records.length === 0) {
      sendJson(res, 400, { success: false, error: 'CSV contained no data rows.' }, origin);
      return;
    }
    if (records.length > 5000) {
      sendJson(res, 413, {
        success: false,
        error: `CSV too large: ${records.length} rows (max 5000 per import).`,
      }, origin);
      return;
    }

    // Phase 1: validate everything. If any row fails, we report and
    // skip the write phase — admin sees per-row errors and can fix the
    // file.
    const normalized = [];
    const errors = [];
    for (let i = 0; i < records.length; i++) {
      // CSV row number (header = 1); blank rows the parser skipped still count.
      const line = rowNumbers[i];
      const out = normalizeImportRow(records[i], db, line);
      if (out.ok) normalized.push(out);
      else errors.push({ line, error: out.error });
    }
    const summary = {
      total: records.length,
      inserted: normalized.filter((r) => r.mode === 'insert').length,
      updated: normalized.filter((r) => r.mode === 'update').length,
      errors,
      dryRun,
    };
    if (errors.length > 0) {
      sendJson(res, 400, { success: false, summary, error: `${errors.length} row(s) failed validation.` }, origin);
      return;
    }
    if (dryRun) {
      sendJson(res, 200, { success: true, summary }, origin);
      return;
    }

    // Phase 2: write. Single transaction = all-or-nothing semantics.
    const insertStmt = db.prepare(`
      INSERT INTO products(
        id, brand, category_id,
        name_ar, name_en, name_tr, name_ru,
        description_ar, description_en, description_tr, description_ru,
        image,
        alt_ar, alt_en, alt_tr, alt_ru,
        weight,
        material_ar, material_en, material_tr, material_ru,
        count_ar, count_en, count_tr, count_ru,
        display_order, active, created_at, updated_at
      ) VALUES(
        @id, @brand, @category_id,
        @name_ar, @name_en, @name_tr, @name_ru,
        @description_ar, @description_en, @description_tr, @description_ru,
        @image,
        @alt_ar, @alt_en, @alt_tr, @alt_ru,
        @weight,
        @material_ar, @material_en, @material_tr, @material_ru,
        @count_ar, @count_en, @count_tr, @count_ru,
        @display_order, @active, datetime('now'), datetime('now')
      )
    `);
    // Updates go through the allow-listed updater, which writes only the
    // keys present on the row (see normalizeImportRow) and touches
    // updated_at.
    const tx = db.transaction((entries) => {
      for (const e of entries) {
        if (e.mode === 'insert') insertStmt.run(e.data);
        else updateProductRow(e.data.id, e.data);
      }
    });
    tx(normalized);

    // Invalidate caches once at the end (cheaper than per-row).
    const brands = new Set(normalized.map((e) => e.data.brand));
    for (const b of brands) void invalidateProductsCache(b);
    for (const e of normalized) void invalidateProductOgCache(e.data.id);

    logAudit({
      action: 'IMPORT',
      entityType: 'product',
      entityName: `CSV import — ${summary.inserted} new, ${summary.updated} updated`,
      adminUser,
      details: `Brands: ${[...brands].join(', ')}; ${summary.total} rows`,
    });
    sendJson(res, 200, { success: true, summary }, origin);
    return;
  }

  // ── PUT /api/admin/products/reorder — bulk display_order update ───────────
  if (url === '/api/admin/products/reorder' && req.method === 'PUT') {
    const { items } = body;
    if (!Array.isArray(items) || items.length === 0) {
      sendJson(res, 400, { success: false, error: 'items[] array required.' }, origin);
      return;
    }
    const update = db.prepare(
      "UPDATE products SET display_order=?, updated_at=datetime('now') WHERE id=?"
    );
    const updateAll = db.transaction((rows) => {
      for (const { id, display_order } of rows) {
        update.run(display_order ?? 0, id);
      }
    });
    updateAll(items);
    logAudit({
      action: 'REORDER', entityType: 'product', entityId: null,
      entityName: `${items.length} products reordered`, adminUser,
    });
    // Bust the public products cache so the next read rebuilds with the
    // new display order.
    void invalidateProductsCache();
    sendJson(res, 200, { success: true }, origin);
    return;
  }

  // /api/admin/products/:id
  const idMatch = url.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (req.method === 'GET') {
      const product = db.prepare('SELECT * FROM products WHERE id=?').get(id);
      if (!product) { sendJson(res, 404, { success: false, error: 'Product not found.' }, origin); return; }
      sendJson(res, 200, { success: true, product }, origin);
      return;
    }

    if (req.method === 'PUT') {
      // Normalize weight values before saving
      if (body.weight) body.weight = normalizeWeight(body.weight);
      if (body.weight_count_table) {
        try {
          const rows = JSON.parse(body.weight_count_table);
          if (Array.isArray(rows)) body.weight_count_table = JSON.stringify(rows.map(r => ({ ...r, weight: normalizeWeight(r.weight) })));
        } catch {}
      }
      // Validate status + publish_at consistency. A scheduled row must
      // have a publish_at; drafts and published rows must NOT (drafts
      // shouldn't reveal accidentally; published shouldn't surprise an
      // admin who toggled the dropdown without realising publish_at
      // was still set from an earlier draft).
      if (body.status !== undefined) {
        if (!VALID_PRODUCT_STATUSES.has(body.status)) {
          sendJson(res, 400, { success: false, error: `status must be one of: ${[...VALID_PRODUCT_STATUSES].join(', ')}.` }, origin);
          return;
        }
        if (body.status === 'scheduled' && !body.publish_at) {
          sendJson(res, 400, { success: false, error: 'A scheduled product requires publish_at (ISO 8601).' }, origin);
          return;
        }
        if (body.status !== 'scheduled') body.publish_at = null;
      }

      const urlError = normalizeMarketplaceUrlFields(body);
      if (urlError) { sendJson(res, 400, { success: false, error: urlError }, origin); return; }

      const previousBrand = db.prepare('SELECT brand FROM products WHERE id=?').get(id)?.brand;
      const result = updateProductRow(id, body);
      if (result.skipped) { sendJson(res, 400, { success: false, error: 'No fields to update.' }, origin); return; }

      const updated = db.prepare('SELECT * FROM products WHERE id=?').get(id);
      // Moved to the other brand: the old brand's cached catalogue still
      // listed it (only the new brand was invalidated).
      if (previousBrand && previousBrand !== updated?.brand) void invalidateProductsCache(previousBrand);
      logAudit({ action: 'UPDATE', entityType: 'product', entityId: id, entityName: body.name_ar || body.name_en || id, adminUser });
      void invalidateProductsCache(updated?.brand);
      // Purge cached OG images for this product across all 4 languages.
      // Next share-link request rebuilds from the new copy / photo.
      void invalidateProductOgCache(id);
      sendJson(res, 200, { success: true, product: updated }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      const prod = db.prepare('SELECT brand, name_ar, name_en FROM products WHERE id=?').get(id);
      db.prepare("UPDATE products SET active=0, updated_at=datetime('now') WHERE id=?").run(id);
      logAudit({ action: 'DELETE', entityType: 'product', entityId: id, entityName: prod?.name_ar || prod?.name_en || id, adminUser });
      void invalidateProductsCache(prod?.brand);
      void invalidateProductOgCache(id);
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
    `).all(...params);

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

    // Normalize weight values before saving
    if (body.weight) body.weight = normalizeWeight(body.weight);
    if (body.weight_count_table) {
      try {
        const rows = JSON.parse(body.weight_count_table);
        if (Array.isArray(rows)) body.weight_count_table = JSON.stringify(rows.map(r => ({ ...r, weight: normalizeWeight(r.weight) })));
      } catch {}
    }
    // Default status to 'published' for backward-compat with admin
    // flows that don't pass it. Same validation guard as the UPDATE
    // path so a malformed status / mismatched publish_at can't slip
    // in via POST either.
    const status = body.status || 'published';
    if (!VALID_PRODUCT_STATUSES.has(status)) {
      sendJson(res, 400, { success: false, error: `status must be one of: ${[...VALID_PRODUCT_STATUSES].join(', ')}.` }, origin);
      return;
    }
    let publishAt = body.publish_at || null;
    if (status === 'scheduled' && !publishAt) {
      sendJson(res, 400, { success: false, error: 'A scheduled product requires publish_at (ISO 8601).' }, origin);
      return;
    }
    if (status !== 'scheduled') publishAt = null;

    const urlError = normalizeMarketplaceUrlFields(body);
    if (urlError) { sendJson(res, 400, { success: false, error: urlError }, origin); return; }

    const id = body.id || `${body.brand.toLowerCase()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO products(
        id, brand, category_id,
        name_ar, name_en, name_tr, name_ru,
        description_ar, description_en, description_tr, description_ru,
        image, gallery, alt_ar, alt_en, alt_tr, alt_ru,
        weight,
        material_ar, material_en, material_tr, material_ru,
        count_ar, count_en, count_tr, count_ru,
        gift_ar, gift_en, gift_tr, gift_ru,
        weight_count_table, image_scale,
        trendyol_url, hepsiburada_url,
        display_order, active, status, publish_at, created_at, updated_at
      ) VALUES(
        @id, @brand, @category_id,
        @name_ar, @name_en, @name_tr, @name_ru,
        @desc_ar, @desc_en, @desc_tr, @desc_ru,
        @image, @gallery, @alt_ar, @alt_en, @alt_tr, @alt_ru,
        @weight,
        @mat_ar, @mat_en, @mat_tr, @mat_ru,
        @cnt_ar, @cnt_en, @cnt_tr, @cnt_ru,
        @gift_ar, @gift_en, @gift_tr, @gift_ru,
        @weight_count_table, @image_scale,
        @trendyol_url, @hepsiburada_url,
        @display_order, @active, @status, @publish_at, @now, @now
      )
    `).run({
      id, brand: body.brand, category_id: body.category_id,
      name_ar: body.name_ar || '', name_en: body.name_en || '',
      name_tr: body.name_tr || '', name_ru: body.name_ru || '',
      desc_ar: body.description_ar || '', desc_en: body.description_en || '',
      desc_tr: body.description_tr || '', desc_ru: body.description_ru || '',
      image: body.image || '',
      gallery: body.gallery || null,
      alt_ar: body.alt_ar || '', alt_en: body.alt_en || '',
      alt_tr: body.alt_tr || '', alt_ru: body.alt_ru || '',
      weight: body.weight || '',
      mat_ar: body.material_ar || '', mat_en: body.material_en || '',
      mat_tr: body.material_tr || '', mat_ru: body.material_ru || '',
      cnt_ar: body.count_ar || '', cnt_en: body.count_en || '',
      cnt_tr: body.count_tr || '', cnt_ru: body.count_ru || '',
      gift_ar: body.gift_ar || null, gift_en: body.gift_en || null,
      gift_tr: body.gift_tr || null, gift_ru: body.gift_ru || null,
      weight_count_table: body.weight_count_table || null,
      // These two were accepted by the form but not inserted: a new
      // product always got the default 85 % image size and was always
      // active, whatever the admin had set before the first save.
      image_scale: Number.isFinite(Number(body.image_scale)) && body.image_scale !== '' && body.image_scale !== null
        ? Number(body.image_scale) : 0.85,
      active: body.active === 0 || body.active === false || body.active === '0' ? 0 : 1,
      trendyol_url: body.trendyol_url || null,
      hepsiburada_url: body.hepsiburada_url || null,
      display_order: body.display_order || 0,
      status,
      publish_at: publishAt,
      now,
    });

    const product = db.prepare('SELECT * FROM products WHERE id=?').get(id);
    logAudit({ action: 'CREATE', entityType: 'product', entityId: id, entityName: body.name_ar || body.name_en || id, adminUser });
    void invalidateProductsCache(product?.brand);
    sendJson(res, 201, { success: true, product }, origin);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};

// ─── Categories ──────────────────────────────────────────────────────────────

export const handleAdminCategories = (req, res, { body, sendJson, origin, url, admin }) => {
  const db = getDb();
  const adminUser = admin?.username || 'admin';

  const idMatch = url.match(/^\/api\/admin\/categories\/([^/]+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);

    if (req.method === 'PUT') {
      updateCategoryRow(id, body);
      const cat = db.prepare('SELECT * FROM product_categories WHERE id=?').get(id);
      void invalidateProductsCache(cat?.brand);
      logAudit({
        action: 'UPDATE',
        entityType: 'category',
        entityId: id,
        entityName: cat?.title_ar || cat?.title_en || id,
        adminUser,
      });
      sendJson(res, 200, { success: true, category: cat }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      // Hidden (soft-deleted) products still reference the category: only
      // counting active ones let the DELETE through to a foreign-key
      // failure, which reached the admin as a bare 500.
      const counts = db.prepare(
        'SELECT COUNT(*) AS total, COALESCE(SUM(active=1), 0) AS active FROM products WHERE category_id=?'
      ).get(id);
      if (counts.total > 0) {
        const hidden = counts.total - counts.active;
        const parts = [];
        if (counts.active > 0) parts.push(`${counts.active} active product(s)`);
        if (hidden > 0) parts.push(`${hidden} hidden product(s)`);
        sendJson(res, 400, {
          success: false,
          error: `Cannot delete: ${parts.join(' and ')} still use this category. Move them to another category first.`,
        }, origin);
        return;
      }
      const cat = db.prepare('SELECT brand, title_ar, title_en FROM product_categories WHERE id=?').get(id);
      try {
        db.prepare('DELETE FROM product_categories WHERE id=?').run(id);
      } catch (err) {
        if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          sendJson(res, 409, { success: false, error: 'Cannot delete: other records still reference this category.' }, origin);
          return;
        }
        throw err;
      }
      void invalidateProductsCache(cat?.brand);
      logAudit({
        action: 'DELETE',
        entityType: 'category',
        entityId: id,
        entityName: cat?.title_ar || cat?.title_en || id,
        adminUser,
      });
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
    logAudit({
      action: 'CREATE',
      entityType: 'category',
      entityId: id,
      entityName: body.title_ar || body.title_en || id,
      adminUser,
    });
    sendJson(res, 201, { success: true, category: db.prepare('SELECT * FROM product_categories WHERE id=?').get(id) }, origin);
    return;
  }

  sendJson(res, 405, { success: false, error: 'Method not allowed.' }, origin);
};
