import { getDb } from '../db.mjs';
import { verifyToken } from '../auth.mjs';

const LANG_LABELS = { ar: 'العربية', en: 'English', tr: 'Türkçe', ru: 'Русский' };
const LANG_DIR = { ar: 'rtl', en: 'ltr', tr: 'ltr', ru: 'ltr' };

function buildCatalogHtml({ products, lang, siteUrl, autoprint }) {
  const isMulti = lang === 'all';
  const langs = isMulti ? ['ar', 'en', 'tr', 'ru'] : [lang];
  const dir = isMulti ? 'ltr' : (LANG_DIR[lang] || 'ltr');

  const productCards = products.map(p => {
    const imageHtml = p.image
      ? `<div class="prod-img-wrap"><img src="${siteUrl}${p.image.startsWith('/') ? '' : '/'}${p.image}" alt="" /></div>`
      : `<div class="prod-img-wrap prod-no-img"><span>🧴</span></div>`;

    if (isMulti) {
      return `
      <div class="prod-card">
        ${imageHtml}
        <div class="prod-info">
          <div class="prod-brand">${p.brand}</div>
          <div class="prod-names">
            <span dir="rtl" lang="ar">${p.name_ar || ''}</span>
            <span dir="ltr" lang="en">${p.name_en || ''}</span>
            <span dir="ltr" lang="tr">${p.name_tr || ''}</span>
            <span dir="ltr" lang="ru">${p.name_ru || ''}</span>
          </div>
          ${p.weight ? `<div class="prod-meta">⚖️ ${p.weight}</div>` : ''}
          ${p.description_en ? `<div class="prod-desc" dir="ltr">${p.description_en}</div>` : ''}
        </div>
      </div>`;
    } else {
      const name = p[`name_${lang}`] || p.name_en || '';
      const desc = p[`description_${lang}`] || '';
      const material = p[`material_${lang}`] || '';
      const count = p[`count_${lang}`] || '';
      return `
      <div class="prod-card">
        ${imageHtml}
        <div class="prod-info">
          <div class="prod-brand">${p.brand}</div>
          <div class="prod-name" dir="${LANG_DIR[lang] || 'ltr'}">${name}</div>
          ${desc ? `<div class="prod-desc" dir="${LANG_DIR[lang] || 'ltr'}">${desc}</div>` : ''}
          <div class="prod-specs">
            ${p.weight ? `<span>⚖️ ${p.weight}</span>` : ''}
            ${material ? `<span>🔬 ${material}</span>` : ''}
            ${count ? `<span>📦 ${count}</span>` : ''}
          </div>
        </div>
      </div>`;
    }
  }).join('');

  const langLabel = isMulti ? 'All Languages' : LANG_LABELS[lang];
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="${isMulti ? 'en' : lang}" dir="${dir}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>KARAHOCA Product Catalog ${year}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', 'Cairo', sans-serif;
    background: #f7f8fc;
    color: #1a1d2e;
    direction: ${dir};
  }
  /* ─── Print button bar ─── */
  .no-print {
    position: fixed; top: 0; left: 0; right: 0;
    background: #1a1d2e; color: #fff;
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 24px; z-index: 100; gap: 16px;
    font-size: 14px;
  }
  .no-print button {
    background: #4f6ef7; color: #fff; border: none;
    padding: 8px 20px; border-radius: 8px; cursor: pointer;
    font-size: 14px; font-weight: 600;
  }
  .no-print button:hover { background: #6b84ff; }
  /* ─── Cover ─── */
  .cover {
    background: linear-gradient(135deg, #0f1117 0%, #1a1d27 50%, #0a0c14 100%);
    color: #fff; text-align: center;
    padding: 80px 40px 60px;
    page-break-after: always;
    min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }
  .cover-logo { font-size: 52px; font-weight: 800; letter-spacing: 3px; color: #fff; margin-bottom: 8px; }
  .cover-logo span { color: #4f6ef7; }
  .cover-tagline { font-size: 16px; color: #8892b0; margin-bottom: 48px; letter-spacing: 1px; }
  .cover-divider { width: 60px; height: 3px; background: #4f6ef7; margin: 0 auto 32px; border-radius: 2px; }
  .cover-title { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
  .cover-sub { font-size: 15px; color: #8892b0; }
  .cover-meta { margin-top: 60px; font-size: 13px; color: #5a637a; }
  .cover-badge {
    display: inline-block; background: rgba(79,110,247,0.15);
    border: 1px solid rgba(79,110,247,0.3);
    color: #4f6ef7; padding: 6px 18px; border-radius: 20px;
    font-size: 13px; font-weight: 600; margin-top: 20px;
  }
  /* ─── Products grid ─── */
  .catalog-body { padding: 48px 40px; max-width: 1100px; margin: 0 auto; }
  .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; padding-bottom: 12px; border-bottom: 2px solid #e2e5f1; }
  .section-header h2 { font-size: 20px; font-weight: 700; color: #1a1d2e; }
  .section-count { background: #4f6ef7; color: #fff; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .prod-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 24px;
  }
  .prod-card {
    background: #fff;
    border: 1px solid #e2e5f1;
    border-radius: 14px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }
  .prod-img-wrap {
    height: 180px;
    background: #f0f2f8;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .prod-img-wrap img { max-width: 100%; max-height: 180px; object-fit: contain; }
  .prod-no-img span { font-size: 48px; opacity: 0.3; }
  .prod-info { padding: 16px; }
  .prod-brand { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #4f6ef7; text-transform: uppercase; margin-bottom: 6px; }
  .prod-name { font-size: 15px; font-weight: 700; color: #1a1d2e; margin-bottom: 8px; line-height: 1.4; }
  .prod-names { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
  .prod-names span { font-size: 13px; font-weight: 600; color: #1a1d2e; }
  .prod-names span:not(:first-child) { color: #5a637a; font-weight: 500; font-size: 12px; }
  .prod-desc { font-size: 12px; color: #5a637a; line-height: 1.5; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .prod-meta { font-size: 12px; color: #8892b0; margin-bottom: 6px; }
  .prod-specs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .prod-specs span { font-size: 11px; background: #f0f2f8; color: #5a637a; padding: 3px 8px; border-radius: 6px; }
  /* ─── Footer ─── */
  .catalog-footer {
    text-align: center; padding: 40px;
    border-top: 1px solid #e2e5f1;
    margin-top: 40px;
    color: #8892b0; font-size: 13px;
  }
  /* ─── Print ─── */
  @media print {
    .no-print { display: none !important; }
    body { background: #fff !important; margin-top: 0 !important; }
    .cover { min-height: auto; padding: 60px 40px; }
    .prod-card { box-shadow: none !important; border-color: #ddd !important; }
    @page { margin: 1cm 1.5cm; size: A4; }
  }
  body { margin-top: 48px; }
  @media print { body { margin-top: 0; } }
</style>
</head>
<body>

<!-- Print bar -->
<div class="no-print">
  <span>📄 KARAHOCA Catalog — ${products.length} products — ${langLabel}</span>
  <button onclick="window.print()">🖨️ Print / Save as PDF</button>
</div>

<!-- Cover page -->
<div class="cover">
  <div class="cover-logo">KARA<span>HOCA</span></div>
  <div class="cover-tagline">Professional Cleaning Products</div>
  <div class="cover-divider"></div>
  <div class="cover-title">Product Catalog ${year}</div>
  <div class="cover-sub">${products.length} Premium Products</div>
  <div class="cover-badge">${langLabel}</div>
  <div class="cover-meta">www.karahoca.com • info@karahoca.com</div>
</div>

<!-- Products -->
<div class="catalog-body">
  <div class="section-header">
    <h2>Our Products</h2>
    <span class="section-count">${products.length} items</span>
  </div>
  <div class="prod-grid">
    ${productCards}
  </div>
</div>

<!-- Footer -->
<div class="catalog-footer">
  <strong>KARAHOCA</strong> — Professional Cleaning Products<br />
  © ${year} All rights reserved • www.karahoca.com
</div>

${autoprint ? '<script>window.onload = function(){ window.print(); }</script>' : ''}
</body>
</html>`;
}

export function handleAdminCatalog(request, response, ctx) {
  const { url, origin } = ctx;
  const u = new URL(url, 'http://localhost');

  if (request.method !== 'GET') {
    response.writeHead(405, { 'Content-Type': 'text/plain' });
    response.end('Method Not Allowed');
    return;
  }

  // Accept token from query param (since browser opens in new tab without Authorization header)
  const queryToken = u.searchParams.get('token');
  const user = queryToken ? verifyToken(queryToken) : ctx.user;

  if (!user) {
    response.writeHead(401, { 'Content-Type': 'text/plain' });
    response.end('Unauthorized');
    return;
  }

  try {
    const db = getDb();
    const productIds = (u.searchParams.get('products') || '').split(',').map(s => s.trim()).filter(Boolean);
    const lang = u.searchParams.get('lang') || 'en';
    const brand = u.searchParams.get('brand') || '';
    const autoprint = u.searchParams.get('autoprint') === '1';
    const siteUrl = process.env.SITE_URL || 'https://karahoca.com';

    let products;
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      products = db.prepare(
        `SELECT * FROM products WHERE id IN (${placeholders}) AND active=1 ORDER BY display_order, name_en`
      ).all(...productIds);
    } else {
      const whereClause = brand ? `WHERE active=1 AND brand=?` : `WHERE active=1`;
      const params = brand ? [brand] : [];
      products = db.prepare(
        `SELECT * FROM products ${whereClause} ORDER BY brand, display_order, name_en`
      ).all(...params);
    }

    const html = buildCatalogHtml({ products, lang, siteUrl, autoprint });

    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    };
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    response.writeHead(200, headers);
    response.end(html);
  } catch (err) {
    console.error('[catalog] Error generating catalog:', err);
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end('An internal error occurred. Please try again later.');
  }
}
