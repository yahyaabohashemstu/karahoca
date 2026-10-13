/**
 * Email Campaign routes — uses Resend.com API
 * Env: RESEND_API_KEY, FROM_EMAIL (e.g. "KARAHOCA <noreply@karahoca.com>")
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';

import { generateOpaqueSubscriberKey, getDb, logAudit } from '../db.mjs';
import { buildUnsubscribeUrl } from '../newsletterTokens.mjs';
import { dequeueQueueItem, enqueueQueueItem } from '../redisClient.mjs';
import { logger } from '../utils/logger.mjs';
import { buildUpdater } from '../services/safeUpdate.mjs';
import { buildListUnsubscribeHeaders } from '../services/listUnsubscribe.mjs';

const CAMPAIGN_UPDATE_FIELDS = [
  'title', 'template_type',
  'subject_ar', 'subject_en', 'subject_tr', 'subject_ru',
  'subject_b_ar', 'subject_b_en', 'subject_b_tr', 'subject_b_ru',
  'body_ar', 'body_en', 'body_tr', 'body_ru',
  'image_url',
];
const updateCampaignRow = buildUpdater('email_campaigns', CAMPAIGN_UPDATE_FIELDS);

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
const CAMPAIGN_DISPATCH_QUEUE = 'queue:campaign_dispatch';

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

const ensureSubscriberUnsubscribeKey = (db, email, currentKey = '') => {
  const normalizedKey = typeof currentKey === 'string' ? currentKey.trim() : '';
  if (normalizedKey) {
    return normalizedKey;
  }

  let nextKey = generateOpaqueSubscriberKey();
  while (db.prepare('SELECT 1 FROM newsletter_subscribers WHERE unsubscribe_key = ? AND email != ?').get(nextKey, email)) {
    nextKey = generateOpaqueSubscriberKey();
  }

  db.prepare('UPDATE newsletter_subscribers SET unsubscribe_key = ? WHERE email = ?').run(nextKey, email);
  return nextKey;
};

// ── HTML email template ───────────────────────────────────────────────────────
// The template's own words, in the language the campaign is sent in: the
// header tagline and the copyright line used to be English in every e-mail.
const EMAIL_STRINGS = {
  ar: { tagline: 'النشرة الإخبارية الرسمية', rights: 'جميع الحقوق محفوظة.', cta: 'زيارة الموقع', unsubscribe: 'إلغاء الاشتراك' },
  en: { tagline: 'Official Newsletter', rights: 'All rights reserved.', cta: 'Visit Website', unsubscribe: 'Unsubscribe' },
  tr: { tagline: 'Resmi Bülten', rights: 'Tüm hakları saklıdır.', cta: 'Siteyi Ziyaret Et', unsubscribe: 'Aboneliği iptal et' },
  ru: { tagline: 'Официальная рассылка', rights: 'Все права защищены.', cta: 'Посетить сайт', unsubscribe: 'Отписаться' },
};

export const buildEmailContent = ({ subject, body, lang, sendId, unsubscribeUrl, imageUrl, requestHostOrigin = '' }) => {
  const strings = EMAIL_STRINGS[lang] || EMAIL_STRINGS.en;
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
              ${strings.tagline}
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
                ${strings.cta} →
              </a>
            </div>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="height:1px;background:#f0f0f0"></td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:24px 40px;text-align:center;font-size:12px;color:#999">
            <p style="margin:0 0 8px">© ${new Date().getFullYear()} KARAHOCA. ${strings.rights}</p>
            <p style="margin:0 0 8px">
              📧 <a href="mailto:info@karahoca.com" style="color:#4f6ef7;text-decoration:none">info@karahoca.com</a>
              &nbsp;|&nbsp;
              📞 <a href="tel:+905305914990" style="color:#4f6ef7;text-decoration:none">+90 530 591 4990</a>
            </p>
            <p style="margin:0">
              <a href="${unsubscribeUrl}" style="color:#bbb;font-size:11px">
                ${strings.unsubscribe}
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

  // Same API base as the pixel: the one-click POST must reach this server.
  const headers = buildListUnsubscribeHeaders({ unsubscribeUrl, apiBaseUrl });

  return { html, attachments, headers };
};

// ── Send one email via Resend ─────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, replyTo, attachments = [], headers = {} }) => {
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
    ...(Object.keys(headers).length ? { headers } : {}),
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

// ── Recipient exclusions ──────────────────────────────────────────────────────
// The campaign row's excluded_emails is the ONE source of truth. Every path
// that changes the selection (Save, Schedule, Send now) writes it, and the
// dispatcher reads it from the row. It used to travel inside the queue job,
// so a job without it — "Queue Send" on the list, or the boot-time recovery
// of a queued campaign — mailed the people the admin had excluded.

/** Request value → clean list, or null when the caller sent no list. */
const normaliseExcludedEmails = (value) => {
  if (!Array.isArray(value)) return null;
  const emails = new Set();
  for (const item of value) {
    if (typeof item !== 'string' || item.length > 254) continue;
    const email = item.toLowerCase().trim();
    if (email) emails.add(email);
    if (emails.size >= 100000) break;
  }
  return [...emails];
};

const readExcludedEmails = (campaign) => {
  try {
    const stored = JSON.parse(campaign?.excluded_emails || '[]');
    return new Set(
      Array.isArray(stored) ? stored.map((e) => String(e).toLowerCase().trim()) : [],
    );
  } catch {
    return new Set();
  }
};

// A campaign in one of these states is being, or has been, mailed: its
// content and recipients are frozen.
const LOCKED_STATUSES = new Set(['queued', 'sending', 'sent']);

const hasText = (value) => !!String(value || '').trim();

export const pickSendLanguage = (campaign) =>
  ['ar', 'en', 'tr', 'ru'].find((l) => hasText(campaign[`body_${l}`])) || 'ar';

/** Why this campaign can't be mailed yet, or '' when it can. */
const missingContentReason = (campaign) => {
  const lang = pickSendLanguage(campaign);
  if (!hasText(campaign[`body_${lang}`])) return 'The campaign has no body text in any language.';
  if (!hasText(campaign[`subject_${lang}`])) {
    return `The campaign is sent in ${lang.toUpperCase()}, but its ${lang.toUpperCase()} subject is empty.`;
  }
  return '';
};

// ── Dispatch a campaign ───────────────────────────────────────────────────────
export const dispatchCampaign = async (campaignId, options = {}) => {
  const db = getDb();
  const requestHostOrigin = typeof options.requestHostOrigin === 'string'
    ? trimTrailingSlash(options.requestHostOrigin)
    : '';

  const campaign = db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(campaignId);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent') throw new Error('Campaign already sent');
  if (campaign.status === 'sending') throw new Error('Campaign is already being dispatched');
  const excludedEmails = readExcludedEmails(campaign);

  // Atomically claim this campaign to prevent duplicate sends from the scheduler
  const claimed = db.prepare(
    "UPDATE email_campaigns SET status='sending', updated_at=datetime('now') WHERE id=? AND status IN ('draft','scheduled','queued')"
  ).run(campaignId);
  if (claimed.changes === 0) throw new Error('Campaign could not be claimed for sending');

  let subscribers = db.prepare(
    "SELECT email, unsubscribe_key FROM newsletter_subscribers WHERE active=1"
  ).all();

  if (excludedEmails.size > 0) {
    subscribers = subscribers.filter(s => !excludedEmails.has(s.email.toLowerCase().trim()));
  }

  if (!subscribers.length) {
    db.prepare("UPDATE email_campaigns SET status='sent', sent_at=datetime('now'), recipient_count=0 WHERE id=?").run(campaignId);
    return { sent: 0, sentA: 0, sentB: 0, errors: [] };
  }

  // Subscribers have no stored language yet, so one language is sent to
  // everyone: Arabic when it has a body, otherwise the first language that
  // does. It used to be hard-wired to Arabic, so a campaign written in
  // English only (which is what applying a template leaves: English filled,
  // the others cleared for re-translation) went out as an EMPTY right-to-
  // left e-mail with the bare title as its subject.
  const lang = pickSendLanguage(campaign);
  // A/B only when the language actually sent has a B subject. Checking
  // ar/en regardless split an English send on an Arabic-only B subject:
  // group B got subject A, and the "results" compared identical e-mails.
  const hasAbTest = !!String(campaign[`subject_b_${lang}`] || '').trim();

  let sent = 0;
  const errors = [];
  let sentA = 0;
  let sentB = 0;

  // ─── Phase 1: PRE-INSERT all email_sends rows in a SINGLE transaction ─
  // better-sqlite3 transactions are synchronous only. The send loop below
  // contains `await sendEmail(...)` which CANNOT live inside db.transaction.
  // So we split the work: batch all inserts up front (~100 ms for 5k rows
  // vs ~several seconds when committed one-by-one), then do the async sends.
  const insertSend = db.prepare(
    'INSERT INTO email_sends(campaign_id, email, ab_variant) VALUES(?,?,?)',
  );
  const updateResend = db.prepare('UPDATE email_sends SET resend_id=? WHERE id=?');

  // Each item describes the work for one subscriber, with pre-allocated send id.
  const sendQueue = [];

  const stageAllSends = db.transaction(() => {
    for (let i = 0; i < subscribers.length; i++) {
      const { email, unsubscribe_key: unsubscribeKey } = subscribers[i];
      const variant = hasAbTest && i % 2 === 1 ? 'b' : 'a';
      // ensureSubscriberUnsubscribeKey may INSERT/UPDATE — it's included
      // inside the transaction so the key allocation is atomic with the
      // send-row insert.
      const subscriberKey = ensureSubscriberUnsubscribeKey(db, email, unsubscribeKey);
      const info = insertSend.run(campaignId, email, variant);
      sendQueue.push({
        email,
        variant,
        subscriberKey,
        sendId: info.lastInsertRowid,
      });
    }
  });
  stageAllSends();

  // ─── Phase 2: dispatch emails sequentially ───────────────────────────
  // Sequential (not parallel) because Resend rate-limits outbound requests
  // and because we already paid the cost of batching the DB inserts above.
  // Individual failures are collected; partial-failure semantics match
  // the previous behaviour exactly.
  const heartbeat = db.prepare("UPDATE email_campaigns SET updated_at=datetime('now') WHERE id=?");
  for (const [index, { email, variant, subscriberKey, sendId }] of sendQueue.entries()) {
    // Liveness for closeInterruptedSends.
    if (index > 0 && index % 20 === 0) heartbeat.run(campaignId);
    const subject = variant === 'b'
      ? (campaign[`subject_b_${lang}`] || campaign[`subject_${lang}`] || campaign.title)
      : (campaign[`subject_${lang}`] || campaign.title);
    const body = campaign[`body_${lang}`] || '';

    try {
      const emailContent = buildEmailContent({
        subject,
        body,
        lang,
        sendId,
        unsubscribeUrl: buildUnsubscribeUrl({
          siteUrl: SITE_URL,
          subscriberKey,
          lang,
        }),
        imageUrl: campaign.image_url,
        requestHostOrigin,
      });
      const resendId = await sendEmail({
        to: email,
        subject,
        html: emailContent.html,
        attachments: emailContent.attachments,
        headers: emailContent.headers,
      });
      updateResend.run(resendId, sendId);
      sent++;
      if (variant === 'b') sentB++; else sentA++;
    } catch (err) {
      errors.push({ email, error: err.message });
    }
  }

  if (errors.length > 0) {
    logger.error(
      { campaignId, failed: errors.length, sent, firstError: errors[0]?.error },
      '[campaign] some e-mails were not sent',
    );
  }

  if (sent === 0 && errors.length > 0) {
    // Nothing went out: back to draft (not 'scheduled' — its time has
    // passed, so the scheduler would retry and fail every minute) and drop
    // the staged rows, or the next attempt lists every address twice in the
    // delivery details.
    db.transaction(() => {
      db.prepare('DELETE FROM email_sends WHERE campaign_id=? AND resend_id IS NULL').run(campaignId);
      db.prepare(
        "UPDATE email_campaigns SET status='draft', updated_at=datetime('now') WHERE id=?"
      ).run(campaignId);
    })();
    return { sent, sentA, sentB, errors };
  }

  db.prepare(
    "UPDATE email_campaigns SET status='sent', sent_at=datetime('now'), recipient_count=?, updated_at=datetime('now') WHERE id=?"
  ).run(sent, campaignId);

  return { sent, sentA, sentB, errors };
};

export const queueCampaignDispatch = async (campaignId, options = {}) => {
  const db = getDb();
  const campaign = db.prepare('SELECT id, title, status FROM email_campaigns WHERE id=?').get(campaignId);
  // statusCode → the admin sees this message instead of a generic
  // "Server error" (the error handler only forwards 4xx messages).
  const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
  if (!campaign) throw fail(404, 'Campaign not found');
  if (campaign.status === 'sent') throw fail(409, 'Campaign already sent');
  if (campaign.status === 'sending') throw fail(409, 'Campaign is already being dispatched');
  if (campaign.status === 'queued') {
    return { queued: true, alreadyQueued: true };
  }

  const full = db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(campaignId);
  const contentProblem = missingContentReason(full);
  if (contentProblem) throw fail(400, contentProblem);

  const nextStatus = campaign.status === 'scheduled' ? 'scheduled' : 'draft';
  // An explicit list ("Send now" in the editor) replaces the saved one; no
  // list (the list page, the scheduler) sends with the saved one.
  const excludedEmails = normaliseExcludedEmails(options.excludedEmails);
  const queued = excludedEmails
    ? db.prepare(`
        UPDATE email_campaigns
        SET status='queued', excluded_emails=?, updated_at=datetime('now')
        WHERE id=? AND status IN ('draft','scheduled')
      `).run(JSON.stringify(excludedEmails), campaignId)
    : db.prepare(`
        UPDATE email_campaigns
        SET status='queued', updated_at=datetime('now')
        WHERE id=? AND status IN ('draft','scheduled')
      `).run(campaignId);

  if (queued.changes === 0) {
    throw new Error('Campaign could not be queued for dispatch');
  }

  await enqueueQueueItem(CAMPAIGN_DISPATCH_QUEUE, JSON.stringify({
    campaignId,
    requestHostOrigin: typeof options.requestHostOrigin === 'string' ? options.requestHostOrigin : '',
    fallbackStatus: nextStatus,
  }));

  return { queued: true, alreadyQueued: false };
};

let isProcessingCampaignQueue = false;

export const processQueuedCampaignDispatches = async () => {
  if (isProcessingCampaignQueue) {
    return;
  }

  isProcessingCampaignQueue = true;

  try {
    while (true) {
      const rawJob = await dequeueQueueItem(CAMPAIGN_DISPATCH_QUEUE);
      if (!rawJob) {
        break;
      }

      let job;
      try {
        job = JSON.parse(rawJob);
      } catch {
        continue;
      }

      try {
        await dispatchCampaign(job.campaignId, { requestHostOrigin: job.requestHostOrigin });
      } catch (error) {
        const fallbackStatus = job?.fallbackStatus === 'scheduled' ? 'scheduled' : 'draft';
        try {
          getDb().prepare(`
            UPDATE email_campaigns
            SET status=?, updated_at=datetime('now')
            WHERE id=? AND status='queued'
          `).run(fallbackStatus, job.campaignId);
        } catch {
          // Best-effort status recovery only.
        }
        logger.error({ err: error, campaignId: job?.campaignId }, '[campaign-queue] campaign dispatch failed');
      }
    }
  } finally {
    isProcessingCampaignQueue = false;
  }
};

// A send loop touches updated_at every few e-mails (see dispatchCampaign),
// so a 'sending' campaign that has been quiet this long has no live loop:
// the process died mid-send. Re-sending would mail the first part of the
// list twice, so close it as sent to the addresses Resend accepted and drop
// the rows that never went out. The age check keeps a rolling deploy's new
// container from closing a send the old one is still running.
const SENDING_STALE_MINUTES = 15;

export const closeInterruptedSends = () => {
  const db = getDb();
  const interrupted = db.prepare(`
    SELECT id FROM email_campaigns
    WHERE status = 'sending'
      AND datetime(updated_at) <= datetime('now', '-${SENDING_STALE_MINUTES} minutes')
  `).all();
  for (const { id } of interrupted) {
    db.transaction(() => {
      db.prepare('DELETE FROM email_sends WHERE campaign_id=? AND resend_id IS NULL').run(id);
      const { c } = db.prepare('SELECT COUNT(*) AS c FROM email_sends WHERE campaign_id=?').get(id);
      db.prepare(`
        UPDATE email_campaigns
        SET status = CASE WHEN ? > 0 THEN 'sent' ELSE 'draft' END,
            sent_at = CASE WHEN ? > 0 THEN COALESCE(sent_at, datetime('now')) ELSE sent_at END,
            recipient_count = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(c, c, c, id);
    })();
    logger.warn({ campaignId: id }, '[campaign-queue] closed a campaign interrupted mid-send');
  }
};

export const recoverQueuedCampaignDispatches = async () => {
  const db = getDb();
  closeInterruptedSends();

  const queuedCampaigns = db.prepare(`
    SELECT id
    FROM email_campaigns
    WHERE status = 'queued'
  `).all();

  // Recipients come from the campaign row, so the order these run in
  // (relative to a job that survived in Redis) doesn't matter: the first
  // claims the campaign, the duplicate finds it sent and stops.
  for (const campaign of queuedCampaigns) {
    await enqueueQueueItem(CAMPAIGN_DISPATCH_QUEUE, JSON.stringify({
      campaignId: campaign.id,
      requestHostOrigin: '',
      fallbackStatus: 'draft',
    }));
  }
};

// ── Click tracking redirect ───────────────────────────────────────────────────
const siteHostname = (() => {
  try {
    return new URL(SITE_URL).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
})();

const isOwnSiteUrl = (value) => {
  if (!value || !siteHostname) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return parsed.hostname.replace(/^www\./i, '').toLowerCase() === siteHostname;
  } catch {
    return false;
  }
};

export const handleEmailClick = (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const sendId = parseInt(u.searchParams.get('id') || '0', 10);
  const requestedUrl = u.searchParams.get('url') || '';
  // Only our own site is a valid destination (the one link we wrap is the
  // CTA to SITE_URL). Accepting any http(s) URL made
  // /api/email/click?url=https://phish.example an open redirect that
  // borrowed karahoca.com's reputation for phishing links.
  const targetUrl = isOwnSiteUrl(requestedUrl) ? requestedUrl : '';

  if (sendId > 0 && targetUrl) {
    try {
      const db = getDb();
      db.prepare(
        'INSERT INTO email_link_clicks(send_id, url) VALUES(?,?)'
      ).run(sendId, targetUrl.slice(0, 500));
      // Increment campaign-level click counter
      const send = db.prepare('SELECT campaign_id FROM email_sends WHERE id=?').get(sendId);
      if (send?.campaign_id) {
        db.prepare('UPDATE email_campaigns SET click_count=click_count+1 WHERE id=?').run(send.campaign_id);
      }
    } catch { /* non-fatal */ }
  }

  res.writeHead(302, { Location: targetUrl || SITE_URL, 'Cache-Control': 'no-store' });
  res.end();
};

// ── Open tracking pixel ───────────────────────────────────────────────────────
export const handleEmailOpen = (req, res) => {
  const url   = new URL(req.url, 'http://localhost');
  const sendId = parseInt(url.searchParams.get('id') || '0', 10);
  if (sendId > 0) {
    try {
      const db = getDb();
      // `datetime('now')` — the double-quoted "now" this used to have is an
      // identifier, not a string, under better-sqlite3 (built with
      // SQLITE_DQS=0): every open threw "no such column", so no open was
      // ever recorded and the pixel answered 500 instead of a GIF.
      // `AND opened=0` makes the check-and-set atomic, so two loads of the
      // same e-mail can't both increment the campaign counter.
      const updated = db
        .prepare("UPDATE email_sends SET opened=1, opened_at=datetime('now') WHERE id=? AND opened=0")
        .run(sendId);
      if (updated.changes > 0) {
        const camp = db.prepare('SELECT campaign_id FROM email_sends WHERE id=?').get(sendId);
        if (camp) db.prepare('UPDATE email_campaigns SET open_count=open_count+1 WHERE id=?').run(camp.campaign_id);
      }
    } catch { /* non-fatal: always answer with the pixel */ }
  }
  // Return transparent 1x1 GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Content-Length': gif.length });
  res.end(gif);
};

// ── Admin Route Handler ───────────────────────────────────────────────────────
export const handleAdminCampaigns = async (req, res, { sendJson, origin, url, body, admin }) => {
  const db = getDb();
  const adminUser = admin?.username || 'admin';

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
    const result = await queueCampaignDispatch(id, {
      requestHostOrigin: getRequestHostOrigin(req),
      // Absent (the list page) → the saved selection is used.
      excludedEmails: body?.excludedEmails,
    });
    const camp = db.prepare('SELECT title FROM email_campaigns WHERE id=?').get(id);
    logAudit({
      action: 'QUEUE',
      entityType: 'campaign',
      entityId: id,
      entityName: camp?.title,
      adminUser,
      details: result.alreadyQueued ? 'Campaign already queued for delivery' : 'Queued campaign for background delivery',
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
      // A time that has already passed was accepted with "scheduled
      // successfully" and mailed within the minute.
      if (Date.parse(scheduledAt) <= Date.now()) {
        sendJson(res, 400, { error: 'The scheduled time is in the past. Pick a later time, or use Send now.' }, origin);
        return;
      }
      // Only drafts (or re-timing an already-scheduled one). Scheduling a
      // sent / sending / queued campaign flipped it back to 'scheduled' and
      // the scheduler then mailed every subscriber a second time.
      const current = db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(id);
      if (!current) { sendJson(res, 404, { error: 'Not found' }, origin); return; }
      if (current.status !== 'draft' && current.status !== 'scheduled') {
        sendJson(res, 409, { error: `Campaign is ${current.status}; only drafts can be scheduled.` }, origin);
        return;
      }
      const contentProblem = missingContentReason(current);
      if (contentProblem) { sendJson(res, 400, { error: contentProblem }, origin); return; }
      const excludedEmails = normaliseExcludedEmails(body.excludedEmails) ?? [...readExcludedEmails(current)];
      db.prepare("UPDATE email_campaigns SET status='scheduled', scheduled_at=?, excluded_emails=?, updated_at=datetime('now') WHERE id=?")
        .run(normalizedScheduledAt, JSON.stringify(excludedEmails), id);
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
      const current = db.prepare('SELECT status FROM email_campaigns WHERE id=?').get(id);
      if (!current) { sendJson(res, 404, { error: 'Not found' }, origin); return; }
      // Editing after the send made the stats describe an e-mail nobody got.
      if (LOCKED_STATUSES.has(current.status)) {
        sendJson(res, 409, { error: `Campaign is ${current.status}; it can no longer be edited.` }, origin);
        return;
      }
      db.transaction(() => {
        updateCampaignRow(id, body);
        // Save keeps the recipient selection too: before, only Schedule
        // stored it, so unticked people were mailed by a later Queue Send.
        const excludedEmails = normaliseExcludedEmails(body?.excludedEmails);
        if (excludedEmails) {
          db.prepare('UPDATE email_campaigns SET excluded_emails=? WHERE id=?')
            .run(JSON.stringify(excludedEmails), id);
        }
      })();
      sendJson(res, 200, { success: true, campaign: db.prepare('SELECT * FROM email_campaigns WHERE id=?').get(id) }, origin);
      return;
    }

    if (req.method === 'DELETE') {
      const camp = db.prepare('SELECT title, status FROM email_campaigns WHERE id=?').get(id);
      if (!camp) { sendJson(res, 404, { error: 'Not found' }, origin); return; }
      // The send loop doesn't look at the row again: deleting mid-send kept
      // mailing everyone and only threw the delivery stats away.
      if (camp.status === 'sending') {
        sendJson(res, 409, { error: 'The campaign is being sent right now; delete it once it has finished.' }, origin);
        return;
      }
      db.prepare('DELETE FROM email_campaigns WHERE id=?').run(id);
      logAudit({ action: 'DELETE', entityType: 'campaign', entityId: id, entityName: camp?.title, adminUser });
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
