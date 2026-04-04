/**
 * Email Campaign routes — uses Resend.com API
 * Env: RESEND_API_KEY, FROM_EMAIL (e.g. "KARAHOCA <noreply@karahoca.com>")
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';

import { getDb } from '../db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');

const FROM = () => process.env.FROM_EMAIL || 'KARAHOCA <noreply@karahoca.com>';
const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');
const SITE_URL = trimTrailingSlash(
  process.env.SITE_URL || process.env.FRONTEND_URL || 'https://karahoca.com'
);
const API_PUBLIC_URL = trimTrailingSlash(process.env.API_PUBLIC_URL || process.env.SITE_URL || '');
const EMAIL_ASSETS_BASE_URL = trimTrailingSlash(
  process.env.EMAIL_ASSETS_BASE_URL || process.env.API_PUBLIC_URL || process.env.SITE_URL || ''
);
const IMAGE_CONTENT_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(value);

const joinUrl = (baseUrl, pathname) => {
  if (!baseUrl) return pathname;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${trimTrailingSlash(baseUrl)}${normalizedPath}`;
};

const resolveLocalAssetPath = (assetRef) => {
  if (typeof assetRef !== 'string' || !assetRef.trim()) {
    return null;
  }

  let assetPath = assetRef.trim();
  if (isAbsoluteHttpUrl(assetPath)) {
    try {
      assetPath = decodeURIComponent(new URL(assetPath).pathname);
    } catch {
      return null;
    }
  }

  if (!assetPath.startsWith('/')) {
    return null;
  }

  if (assetPath.startsWith('/api/uploads/')) {
    const uploadPath = path.join(uploadsDir, path.basename(assetPath));
    return existsSync(uploadPath) ? uploadPath : null;
  }

  const relativeAssetPath = assetPath.replace(/^\/+/, '');
  for (const baseDir of [distDir, publicDir]) {
    const resolved = path.resolve(baseDir, relativeAssetPath);
    if (
      (resolved === baseDir || resolved.startsWith(baseDir + path.sep)) &&
      existsSync(resolved)
    ) {
      return resolved;
    }
  }

  return null;
};

const resolvePublicAssetUrl = (assetRef, apiBaseUrl = '') => {
  if (typeof assetRef !== 'string' || !assetRef.trim()) {
    return null;
  }

  const value = assetRef.trim();
  if (isAbsoluteHttpUrl(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith('/api/')) {
        return joinUrl(API_PUBLIC_URL || trimTrailingSlash(apiBaseUrl) || parsed.origin, `${parsed.pathname}${parsed.search}`);
      }
      return value;
    } catch {
      return value;
    }
  }

  if (!value.startsWith('/')) {
    return null;
  }

  if (value.startsWith('/api/')) {
    const resolvedApiBase = trimTrailingSlash(API_PUBLIC_URL || apiBaseUrl || SITE_URL);
    return resolvedApiBase ? joinUrl(resolvedApiBase, value) : null;
  }

  return EMAIL_ASSETS_BASE_URL ? joinUrl(EMAIL_ASSETS_BASE_URL, value) : null;
};

const buildEmailImage = (assetRef, contentId, apiBaseUrl = '') => {
  if (!assetRef) {
    return null;
  }

  const publicUrl = resolvePublicAssetUrl(assetRef, apiBaseUrl);
  if (publicUrl) {
    return { src: publicUrl, attachment: null };
  }

  const localAssetPath = resolveLocalAssetPath(assetRef);
  if (localAssetPath) {
    const extension = path.extname(localAssetPath).toLowerCase();
    return {
      src: `cid:${contentId}`,
      attachment: {
        content: readFileSync(localAssetPath).toString('base64'),
        filename: path.basename(localAssetPath),
        contentId,
        ...(IMAGE_CONTENT_TYPES[extension] ? { contentType: IMAGE_CONTENT_TYPES[extension] } : {}),
      },
    };
  }

  return null;
};

const escapeHtmlAttribute = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// ── HTML email template ───────────────────────────────────────────────────────
const buildEmailContent = ({ subject, body, lang, sendId, email, imageUrl, requestHostOrigin = '' }) => {
  const isRtl = lang === 'ar';
  const dir   = isRtl ? 'rtl' : 'ltr';
  const font  = isRtl
    ? "'Segoe UI', Tahoma, sans-serif"
    : "'Segoe UI', Arial, sans-serif";

  // Convert newlines to <p> tags — escape HTML first to prevent injection
  const bodyHtml = body
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const safe = escapeHtmlAttribute(l);
      return `<p style="margin:0 0 14px">${safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;
    })
    .join('');

  const attachments = [];
  const campaignImage = buildEmailImage(imageUrl, 'campaign-image', requestHostOrigin);

  if (campaignImage?.attachment) {
    attachments.push(campaignImage.attachment);
  }

  const resolvedImageUrl = campaignImage?.src || resolvePublicAssetUrl(imageUrl, requestHostOrigin);
  const imageBlock = resolvedImageUrl
    ? `<tr><td style="padding:0 40px 24px;text-align:center">
        <img src="${resolvedImageUrl}" alt="${escapeHtmlAttribute(subject)}"
          style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto" />
      </td></tr>`
    : '';

  const unsub = `${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}&lang=${lang}`;
  const apiBaseUrl = trimTrailingSlash(API_PUBLIC_URL || requestHostOrigin || SITE_URL);
  const pixel = apiBaseUrl ? `${apiBaseUrl}/api/email/open?id=${sendId}` : '';
  // Wrap the main CTA link with click tracking redirect
  const ctaHref = apiBaseUrl
    ? `${apiBaseUrl}/api/email/click?id=${sendId}&url=${encodeURIComponent(SITE_URL)}`
    : SITE_URL;
  const logoBlock = `<div style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px">KARAHOCA</div>`;

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtmlAttribute(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:${font}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f1117,#1a1d27);padding:32px 40px;text-align:center">
            ${logoBlock}
            <div style="color:#4f6ef7;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:8px">
              Official Newsletter
            </div>
          </td>
        </tr>

        ${imageBlock}

        <!-- Body -->
        <tr>
          <td style="padding:40px;direction:${dir};text-align:${isRtl ? 'right' : 'left'};color:#1a1a2e;font-size:15px;line-height:1.7">
            ${bodyHtml}
            <div style="margin-top:28px;text-align:center">
              <a href="${ctaHref}" style="display:inline-block;padding:13px 32px;background:linear-gradient(135deg,#4f6ef7,#6b84ff);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
                ${isRtl ? 'زيارة الموقع' : lang === 'tr' ? 'Siteyi Ziyaret Et' : lang === 'ru' ? 'Посетить сайт' : 'Visit Website'} →
              </a>
            </div>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="height:1px;background:#f0f0f0"></td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:24px 40px;text-align:center;font-size:12px;color:#999">
            <p style="margin:0 0 8px">© ${new Date().getFullYear()} KARAHOCA. All rights reserved.</p>
            <p style="margin:0 0 8px">
              📧 <a href="mailto:info@karahoca.com" style="color:#4f6ef7;text-decoration:none">info@karahoca.com</a>
              &nbsp;|&nbsp;
              📞 <a href="tel:+905305914990" style="color:#4f6ef7;text-decoration:none">+90 530 591 4990</a>
            </p>
            <p style="margin:0">
              <a href="${unsub}" style="color:#bbb;font-size:11px">
                ${isRtl ? 'إلغاء الاشتراك' : lang === 'tr' ? 'Aboneliği iptal et' : lang === 'ru' ? 'Отписаться' : 'Unsubscribe'}
              </a>
            </p>
            ${pixel ? `<img src="${pixel}" width="1" height="1" alt="" style="display:none" />` : ''}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { html, attachments };
};

// ── Send one email via Resend ─────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, replyTo, attachments = [] }) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured.');
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: FROM(),
    to: [to],
    subject,
    html,
    replyTo,
    attachments,
  });
  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }
  return data?.id; // resend message id
};

const getRequestHostOrigin = (req) => {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = (typeof forwardedHost === 'string' && forwardedHost.trim())
    ? forwardedHost.split(',')[0].trim()
    : typeof req.headers.host === 'string'
      ? req.headers.host.trim()
      : '';

  if (!host) {
    return '';
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.trim()
      ? forwardedProto.split(',')[0].trim()
      : req.socket?.encrypted ? 'https' : 'http';

  return `${protocol}://${host}`;
};

// ── Dispatch a campaign ───────────────────────────────────────────────────────
export const dispatchCampaign = async (campaignId, options = {}) => {
  const db = getDb();
  const requestHostOrigin = typeof options.requestHostOrigin === 'string'
    ? trimTrailingSlash(options.requestHostOrigin)
    : '';
  const excludedEmails = Array.isArray(options.excludedEmails)
    ? new Set(options.excludedEmails.map(e => String(e).toLowerCase().trim()))
    : new Set();

  const campaign = db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent') throw new Error('Campaign already sent');

  let subscribers = db.prepare(
    "SELECT email FROM newsletter_subscribers WHERE active=1"
  ).all();

  if (excludedEmails.size > 0) {
    subscribers = subscribers.filter(s => !excludedEmails.has(s.email.toLowerCase().trim()));
  }

  if (!subscribers.length) {
    db.prepare("UPDATE email_campaigns SET status='sent', sent_at=datetime('now'), recipient_count=0 WHERE id=?").run(campaignId);
    return { sent: 0, sentA: 0, sentB: 0, errors: [] };
  }

  // Detect if A/B test is configured (subject_b_ar must be filled)
  const hasAbTest = !!(campaign.subject_b_ar || campaign.subject_b_en);

  let sent = 0;
  const errors = [];
  let sentA = 0;
  let sentB = 0;

  for (let i = 0; i < subscribers.length; i++) {
    const { email } = subscribers[i];
    const lang = 'ar'; // default — future: store subscriber preferred language

    // Assign A/B variant: alternate evenly
    const variant = (hasAbTest && i % 2 === 1) ? 'b' : 'a';

    const subject = variant === 'b'
      ? (campaign[`subject_b_${lang}`] || campaign[`subject_${lang}`] || campaign.subject_ar || campaign.title)
      : (campaign[`subject_${lang}`] || campaign.subject_ar || campaign.title);
    const body = campaign[`body_${lang}`] || campaign.body_ar || '';

    // Insert a send record first to get the ID for the tracking pixel
    const info = db.prepare(
      'INSERT INTO email_sends(campaign_id, email, ab_variant) VALUES(?,?,?)'
    ).run(campaignId, email, variant);
    const sendId = info.lastInsertRowid;

    try {
      const emailContent = buildEmailContent({
        subject,
        body,
        lang,
        sendId,
        email,
        imageUrl: campaign.image_url,
        requestHostOrigin,
      });
      const resendId = await sendEmail({
        to: email,
        subject,
        html: emailContent.html,
        attachments: emailContent.attachments,
      });
      db.prepare('UPDATE email_sends SET resend_id=? WHERE id=?').run(resendId, sendId);
      sent++;
      if (variant === 'b') sentB++; else sentA++;
    } catch (err) {
      errors.push({ email, error: err.message });
    }
  }

  db.prepare(
    "UPDATE email_campaigns SET status='sent', sent_at=datetime('now'), recipient_count=? WHERE id=?"
  ).run(sent, campaignId);

  return { sent, sentA, sentB, errors };
};

// ── Click tracking redirect ───────────────────────────────────────────────────
export const handleEmailClick = (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const sendId = parseInt(u.searchParams.get('id') || '0', 10);
  const targetUrl = u.searchParams.get('url') || '';

  if (sendId > 0 && targetUrl) {
    try {
      const db = getDb();
      db.prepare(
        'INSERT INTO email_link_clicks(send_id, url) VALUES(?,?)'
      ).run(sendId, targetUrl.slice(0, 500));
    } catch { /* non-fatal */ }
  }

  // Validate URL before redirecting (allow only http/https)
  const safe = /^https?:\/\//i.test(targetUrl) ? targetUrl : '/';
  res.writeHead(302, { Location: safe, 'Cache-Control': 'no-store' });
  res.end();
};

// ── Open tracking pixel ───────────────────────────────────────────────────────
export const handleEmailOpen = (req, res) => {
  const url   = new URL(req.url, 'http://localhost');
  const sendId = parseInt(url.searchParams.get('id') || '0', 10);
  if (sendId > 0) {
    const db = getDb();
    const send = db.prepare('SELECT id, opened FROM email_sends WHERE id=?').get(sendId);
    if (send && !send.opened) {
      db.prepare('UPDATE email_sends SET opened=1, opened_at=datetime("now") WHERE id=?').run(sendId);
      // Increment campaign open count
      const camp = db.prepare('SELECT campaign_id FROM email_sends WHERE id=?').get(sendId);
      if (camp) db.prepare('UPDATE email_campaigns SET open_count=open_count+1 WHERE id=?').run(camp.campaign_id);
    }
  }
  // Return transparent 1x1 GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Content-Length': gif.length });
  res.end(gif);
};

// ── Admin Route Handler ───────────────────────────────────────────────────────
export const handleAdminCampaigns = async (req, res, { sendJson, origin, url, body }) => {
  const db = getDb();

  // ── GET /api/admin/campaigns/:id/stats
  const statsMatch = url.match(/^\/api\/admin\/campaigns\/(\d+)\/stats$/);
  if (statsMatch && req.method === 'GET') {
    const id = parseInt(statsMatch[1], 10);
    const campaign = db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(id);
    if (!campaign) { sendJson(res, 404, { error: 'Not found' }, origin); return; }
    const sends = db.prepare(`
      SELECT
        es.id,
        es.email,
        es.opened,
        es.opened_at,
        es.created_at,
        es.ab_variant,
        COUNT(lc.id) AS click_count
      FROM email_sends es
      LEFT JOIN email_link_clicks lc ON lc.send_id = es.id
      WHERE es.campaign_id = ?
      GROUP BY es.id
      ORDER BY es.id
    `).all(id);
    sendJson(res, 200, { success: true, campaign, sends }, origin);
    return;
  }

  // ── POST /api/admin/campaigns/:id/send
  const sendMatch = url.match(/^\/api\/admin\/campaigns\/(\d+)\/send$/);
  if (sendMatch && req.method === 'POST') {
    const id = parseInt(sendMatch[1], 10);
    const excludedEmails = Array.isArray(body?.excludedEmails) ? body.excludedEmails : [];
    const result = await dispatchCampaign(id, {
      requestHostOrigin: getRequestHostOrigin(req),
      excludedEmails,
    });
    sendJson(res, 200, { success: true, ...result }, origin);
    return;
  }

  // ── POST /api/admin/campaigns/:id/schedule
    const schedMatch = url.match(/^\/api\/admin\/campaigns\/(\d+)\/schedule$/);
    if (schedMatch && req.method === 'POST') {
      const id = parseInt(schedMatch[1], 10);
      const { scheduledAt } = body;
      if (!scheduledAt || typeof scheduledAt !== 'string') { sendJson(res, 400, { error: 'scheduledAt required' }, origin); return; }
      // Validate format on JS side before passing to SQLite
      if (isNaN(Date.parse(scheduledAt))) { sendJson(res, 400, { error: 'Invalid scheduledAt format' }, origin); return; }
      const normalizedScheduledAt = db.prepare('SELECT datetime(?) as value').get(scheduledAt)?.value;
      if (!normalizedScheduledAt) {
        sendJson(res, 400, { error: 'Invalid scheduledAt value' }, origin);
        return;
      }
      db.prepare("UPDATE email_campaigns SET status='scheduled', scheduled_at=?, updated_at=datetime('now') WHERE id=?")
        .run(normalizedScheduledAt, id);
      sendJson(res, 200, { success: true }, origin);
      return;
    }

  // ── /api/admin/campaigns/:id  (GET / PUT / DELETE)
  const idMatch = url.match(/^\/api\/admin\/campaigns\/(\d+)$/);
  if (idMatch) {
    const id = parseInt(idMatch[1], 10);

    if (req.method === 'GET') {
      const campaign = db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(id);
      if (!campaign) { sendJson(res, 404, { error: 'Not found' }, origin); return; }
      sendJson(res, 200, { success: true, campaign }, origin);
      return;
    }

    if (req.method === 'PUT') {
      const fields = ['title','template_type','subject_ar','subject_en','subject_tr','subject_ru','subject_b_ar','subject_b_en','subject_b_tr','subject_b_ru','body_ar','body_en','body_tr','body_ru','image_url'];
      const sets = fields.filter(f => body[f] !== undefined).map(f => `${f}=@${f}`).join(', ');
      if (sets) db.prepare(`UPDATE email_campaigns SET ${sets}, updated_at=datetime('now') WHERE id=@id`).run({ ...body, id });
      sendJson(res, 200, { success: true, campaign: db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(id) }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM email_campaigns WHERE id=?').run(id);
      sendJson(res, 200, { success: true }, origin);
      return;
    }
  }

  // ── GET /api/admin/campaigns
  if (req.method === 'GET') {
    const campaigns = db.prepare('SELECT * FROM email_campaigns ORDER BY created_at DESC').all();
    sendJson(res, 200, { success: true, campaigns }, origin);
    return;
  }

  // ── POST /api/admin/campaigns
  if (req.method === 'POST') {
    if (!body.title) { sendJson(res, 400, { error: 'title required' }, origin); return; }
    const info = db.prepare(`
      INSERT INTO email_campaigns(
        title,template_type,
        subject_ar,subject_en,subject_tr,subject_ru,
        subject_b_ar,subject_b_en,subject_b_tr,subject_b_ru,
        body_ar,body_en,body_tr,body_ru,image_url
      ) VALUES(
        @title,@template_type,
        @subject_ar,@subject_en,@subject_tr,@subject_ru,
        @subject_b_ar,@subject_b_en,@subject_b_tr,@subject_b_ru,
        @body_ar,@body_en,@body_tr,@body_ru,@image_url
      )
    `).run({
      title:         body.title,
      template_type: body.template_type || 'custom',
      subject_ar:    body.subject_ar || '', subject_en: body.subject_en || '',
      subject_tr:    body.subject_tr || '', subject_ru: body.subject_ru || '',
      subject_b_ar:  body.subject_b_ar || '', subject_b_en: body.subject_b_en || '',
      subject_b_tr:  body.subject_b_tr || '', subject_b_ru: body.subject_b_ru || '',
      body_ar:       body.body_ar || '', body_en: body.body_en || '',
      body_tr:       body.body_tr || '', body_ru: body.body_ru || '',
      image_url:     body.image_url || null,
    });
    sendJson(res, 201, { success: true, campaign: db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(info.lastInsertRowid) }, origin);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' }, origin);
};
