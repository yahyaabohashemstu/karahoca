import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAX_BODY_BYTES, MAX_UPLOAD_BODY_BYTES, readRequestBody } from '../middlewares/bodyParser.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { requireAdminAuth, requireCsrfToken } from '../middlewares/adminAuth.mjs';
import { getDb, logAudit } from '../services/db.mjs';
import { createAdminCsrfCookie, generateCsrfToken, readAdminCsrfCookie } from '../auth.mjs';
import { logger } from '../utils/logger.mjs';
import { resolveDayRange } from '../utils/dateRange.mjs';

import { handleAdminLogin, handleAdminLogout } from './admin-auth.mjs';
import { handleAdminStats } from './admin-stats.mjs';
import { handleAdminAnalytics } from './admin-analytics.mjs';
import { handleKaroInsights } from './admin-karo-insights.mjs';
import { handleAdminChats } from './admin-chats.mjs';
import { handleAdminProducts, handleAdminCategories } from './admin-products.mjs';
import { handleAdminNews } from './admin-news.mjs';
import { handleAdminNewsletter } from './admin-newsletter.mjs';
import { handleAdminBlog } from './admin-blog.mjs';
import { handleAdminTranslate } from './admin-translate.mjs';
import { handleAdminGa } from './admin-ga.mjs';
import { handleAdminCampaigns } from './admin-campaigns.mjs';
import { handleAdminAiKnowledge } from './admin-ai-knowledge.mjs';
import { handleAdminCatalog } from './admin-catalog.mjs';
import { handleAdminFunnel, handleAdminCohorts } from './admin-funnel.mjs';
import { handleAdminAbTests } from './admin-ab-tests.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');

/**
 * The image type from the file's magic bytes — 'jpg' | 'png' | 'gif' |
 * 'webp', or null for anything else. The stored extension comes from
 * here, not from the client's file name: Windows saves JPEGs as
 * "photo.jfif" and a pasted screenshot can arrive with no extension, and
 * both were rejected although the bytes were a perfectly good image.
 */
const detectImageExt = (buf) => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  if (
    buf.length >= 12
    && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 // RIFF
    && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  ) return 'webp';
  return null;
};

let warnedNoApiPublicUrl = false;

const handleUploadImage = async (request, response, { origin, body }) => {
  const { imageBase64 } = body;
  if (!imageBase64) {
    sendJson(response, 400, { error: 'imageBase64 required' }, origin);
    return;
  }
  const buf = Buffer.from(imageBase64, 'base64');
  if (buf.length > 10 * 1024 * 1024) {
    sendJson(response, 400, { error: 'File too large (max 10 MB)' }, origin);
    return;
  }
  const ext = detectImageExt(buf);
  if (!ext) {
    sendJson(response, 400, { error: 'Unsupported file type — upload a JPEG, PNG, WebP or GIF image.' }, origin);
    return;
  }

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, unique), buf);

  // API_PUBLIC_URL = publicly reachable URL of this Node backend.
  // Required because email clients and the public site load uploaded
  // images directly from the API server (the nginx frontend does NOT
  // proxy /api/ — it answers 404), so the old fallback to SITE_URL built
  // URLs that could never load. Without API_PUBLIC_URL we hand back the
  // relative /api/uploads/… path — the form the rest of the code resolves
  // itself (resolveAdminImage prefixes VITE_BACKEND_URL; campaign sends,
  // the sitemap and OG cards map it to the API host) — and say so once.
  const apiBase = (process.env.API_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!apiBase && !warnedNoApiPublicUrl) {
    warnedNoApiPublicUrl = true;
    logger.warn(
      '[upload] API_PUBLIC_URL is not set: uploaded images get a relative /api/uploads/… URL, which the public '
      + 'site loads from the web host (404 when the API runs on its own domain). Set API_PUBLIC_URL to this '
      + "API's public origin, e.g. https://api.karahoca.com.",
    );
  }
  const relativePath = `/api/uploads/${unique}`;
  const absoluteUrl = apiBase ? `${apiBase}${relativePath}` : relativePath;
  sendJson(response, 200, { success: true, path: relativePath, url: absoluteUrl }, origin);
};

/**
 * GET /api/admin/audit-log[?entity=…&action=…&q=…&from=ISO&to=ISO&limit=…&offset=…&format=csv]
 *
 * Read the admin activity log with optional filtering. Supports four
 * orthogonal filters layered on top of pagination:
 *
 *   entity   exact match on entity_type (product, news, campaign, …)
 *   action   exact match on action (CREATE / UPDATE / DELETE / SEND / EXPORT)
 *   q        case-insensitive substring on entity_name OR entity_id
 *   from/to  'YYYY-MM-DD' days (UTC), both included; either may be left open
 *
 * When format=csv the endpoint streams a CSV download instead of JSON.
 * Used by the admin's "Export log" button for compliance / audit trails.
 *
 * Building the WHERE clause from scratch each call (vs caching prepared
 * statements per filter subset) is fine here — this endpoint is admin-
 * only and called at most a few times per minute; the schema is small.
 */
const handleAuditLog = (request, response, { origin, admin }) => {
  const db = getDb();
  const urlObj = new URL(request.url, 'http://localhost');
  const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(urlObj.searchParams.get('offset') || '0', 10);
  const entityType = urlObj.searchParams.get('entity') || null;
  const action = urlObj.searchParams.get('action') || null;
  const q = (urlObj.searchParams.get('q') || '').trim();
  // `to` used to be bound as `created_at < 'YYYY-MM-DD'`, which ends the
  // range at the START of that day: From = To was always empty, in the
  // table and the CSV export alike. Compare against the day after instead.
  const range = resolveDayRange(
    { from: urlObj.searchParams.get('from'), to: urlObj.searchParams.get('to') },
    { defaultDays: null, maxDays: null },
  );
  if (range.error) {
    sendJson(response, 400, { success: false, error: range.error }, origin);
    return;
  }
  const format = (urlObj.searchParams.get('format') || 'json').toLowerCase();

  const conditions = [];
  const params = [];
  if (entityType) { conditions.push('entity_type=?'); params.push(entityType); }
  if (action)     { conditions.push('action=?');      params.push(action); }
  if (q) {
    conditions.push('(LOWER(entity_name) LIKE ? OR LOWER(entity_id) LIKE ? OR LOWER(details) LIKE ?)');
    const needle = `%${q.toLowerCase()}%`;
    params.push(needle, needle, needle);
  }
  if (range.from)        { conditions.push('created_at >= ?'); params.push(range.from); }
  if (range.toExclusive) { conditions.push('created_at < ?');  params.push(range.toExclusive); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  if (format === 'csv') {
    // Cap CSV exports at 50k rows so a runaway query doesn't OOM the
    // single-process Node server. 50k is well above any reasonable
    // audit-log retention horizon for KARAHOCA's volume (~hundreds/day).
    const CSV_CAP = 50000;
    const rows = db.prepare(
      `SELECT id, action, entity_type, entity_id, entity_name, admin_user, details, created_at
       FROM admin_audit_log ${where} ORDER BY created_at DESC LIMIT ?`
    ).all(...params, CSV_CAP);

    // CSV-cell sanitiser: prefix anything that could be parsed as a
    // formula by Excel / Sheets with `'` so opening the export in a
    // spreadsheet doesn't execute injected payloads from entity_name.
    // The check runs on the RAW value, before quoting: run afterwards it
    // saw the opening `"` of a quoted cell, so `=HYPERLINK("…")` — quoted
    // because of its own `"` — went out live. A bare \r also needs
    // quoting, or it splits the row.
    const csvSafe = (v = '') => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['id', 'created_at', 'admin_user', 'action', 'entity_type', 'entity_id', 'entity_name', 'details'];
    const body = rows.map((r) => header.map((k) => csvSafe(r[k])).join(','));
    const csv = [header.join(','), ...body].join('\n');

    // Log the export itself — fully meta-circular. Useful for spotting
    // an admin shipping the audit log out of band. Records the filter
    // VALUES: the WHERE clause it used to store was only `entity_type=?`
    // placeholders, which said nothing about what was exported.
    const filters = [
      ['entity', entityType], ['action', action], ['q', q], ['from', range.from], ['to', range.to],
    ].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ');
    logAudit({
      action: 'EXPORT',
      entityType: 'audit_log',
      entityName: `CSV export (${rows.length} rows)`,
      adminUser: admin?.username || 'admin',
      details: filters ? `Filters: ${filters}` : 'No filters',
    });

    response.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    response.end(csv);
    return;
  }

  const logs = db.prepare(
    `SELECT * FROM admin_audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM admin_audit_log ${where}`).get(...params).c;
  sendJson(response, 200, { success: true, logs, total }, origin);
};

/**
 * Dispatcher for every `/api/admin/*` URL. Login/logout are public; the rest
 * require `requireAdminAuth` and receive a pre-parsed body.
 *
 * Returns `true` if the request was handled.
 */
export const handleAdminRoutes = async (request, response, ctx) => {
  const { url, origin } = ctx;

  // Public: login + logout
  if (request.method === 'POST' && url === '/api/admin/login') {
    const body = await readRequestBody(request);
    await handleAdminLogin(request, response, { ...ctx, body });
    return true;
  }
  if (request.method === 'POST' && url === '/api/admin/logout') {
    await handleAdminLogout(request, response, ctx);
    return true;
  }

  // Everything else under /api/admin/* requires admin auth.
  if (!url.startsWith('/api/admin/')) return false;

  const adminUser = requireAdminAuth(request, response, origin);
  if (!adminUser) return true; // response already written by middleware

  // CSRF double-submit check — ONLY for mutation methods. GET/HEAD/OPTIONS
  // are intentionally exempt (they don't change state and the SPA reads
  // data before it has a chance to handshake the CSRF cookie on the very
  // first page view after login).
  if (!requireCsrfToken(request, response, origin)) {
    return true; // 403 already written by middleware
  }

  const isUpload = url === '/api/admin/upload-image' && request.method === 'POST';
  const body = ['POST', 'PUT', 'PATCH'].includes(request.method)
    ? await readRequestBody(request, isUpload ? MAX_UPLOAD_BODY_BYTES : MAX_BODY_BYTES)
    : {};
  const adminCtx = { ...ctx, body, admin: adminUser, user: adminUser };

  if (url === '/api/admin/session' && request.method === 'GET') {
    // Heal existing sessions that predate the CSRF rollout: if the JWT is
    // valid but no CSRF cookie is present, mint one now so the next
    // mutation has a token to double-submit. Existing cookies are left
    // alone — rotating mid-session would race with in-flight forms.
    const extra = {};
    if (!readAdminCsrfCookie(request)) {
      extra['Set-Cookie'] = createAdminCsrfCookie(generateCsrfToken());
    }
    sendJson(response, 200, {
      success: true,
      user: { username: adminUser.username, role: adminUser.role },
    }, origin, extra);
    return true;
  }

  if (url === '/api/admin/stats' && request.method === 'GET') {
    handleAdminStats(request, response, adminCtx);
    return true;
  }
  if (url === '/api/admin/analytics' && request.method === 'GET') {
    handleAdminAnalytics(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/karo-insights') && request.method === 'GET') {
    handleKaroInsights(request, response, adminCtx);
    return true;
  }
  if (url === '/api/admin/audit-log' && request.method === 'GET') {
    handleAuditLog(request, response, adminCtx);
    return true;
  }
  // G1 + G2: conversion funnel + search-terms aggregation. Bundled
  // into one endpoint to halve the round-trip count for the admin
  // analytics deep-dive page.
  if (url.startsWith('/api/admin/funnel') && request.method === 'GET') {
    handleAdminFunnel(request, response, adminCtx);
    return true;
  }
  // G3: cohort retention triangle. Separate endpoint from funnel
  // because it bins by visitor-week / -month rather than by event
  // date, and the matrix shape doesn't fit funnel's response.
  if (url.startsWith('/api/admin/cohorts') && request.method === 'GET') {
    handleAdminCohorts(request, response, adminCtx);
    return true;
  }
  // G4: A/B testing framework. Single handler dispatches the full
  // CRUD surface (experiments + variants + start/stop transitions)
  // based on URL pattern matching inside admin-ab-tests.mjs.
  if (url.startsWith('/api/admin/ab-tests')) {
    handleAdminAbTests(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/chats')) {
    handleAdminChats(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/products')) {
    // handleAdminProducts is async (CSV import + AI description writer
    // both await an upstream service). Awaiting here lets thrown errors
    // bubble to api-admin's try/catch in server.mjs instead of becoming
    // an unhandled rejection that only the process logger sees.
    await handleAdminProducts(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/categories')) {
    handleAdminCategories(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/newsletter')) {
    handleAdminNewsletter(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/news')) {
    handleAdminNews(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/blog/')) {
    const handled = handleAdminBlog(request, response, adminCtx);
    if (handled) return true;
  }
  if (url === '/api/admin/translate' && request.method === 'POST') {
    await handleAdminTranslate(request, response, adminCtx);
    return true;
  }
  if (url === '/api/admin/ga' && request.method === 'GET') {
    await handleAdminGa(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/campaigns')) {
    await handleAdminCampaigns(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/ai-knowledge')) {
    handleAdminAiKnowledge(request, response, adminCtx);
    return true;
  }
  if (url === '/api/admin/upload-image' && request.method === 'POST') {
    await handleUploadImage(request, response, adminCtx);
    return true;
  }
  if (url.startsWith('/api/admin/catalog')) {
    handleAdminCatalog(request, response, { ...adminCtx, url: request.url });
    return true;
  }

  sendJson(response, 404, { success: false, error: 'Admin route not found.' }, origin);
  return true;
};
