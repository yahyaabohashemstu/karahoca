import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDb, incrementStat, generateOpaqueSubscriberKey } from './db.mjs';
import { buildUnsubscribeUrl } from '../newsletterTokens.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// services/ lives one level below server/, so data/ is `../data`.
const dataDirectory = path.join(__dirname, '..', 'data');
const newsletterFile = path.join(dataDirectory, 'newsletter.json');

const ensureDataDirectory = () => mkdir(dataDirectory, { recursive: true });

// ── Welcome email i18n strings ──────────────────────────────────────────────
const WELCOME_EMAIL_I18N = {
  ar: {
    subject: 'مرحباً بك في نشرة KARAHOCA! 🎉',
    greeting: 'مرحباً بك! 🎉',
    thanks: 'شكراً لاشتراكك في النشرة الإخبارية لـ <strong>KARAHOCA</strong>.',
    promise: 'ستصلك أحدث الأخبار والعروض الحصرية مباشرة إلى بريدك الإلكتروني.',
    unsubNote: 'إذا لم تشترك بنفسك، يمكنك',
    unsubLink: 'إلغاء الاشتراك',
    dir: 'rtl', lang: 'ar',
  },
  en: {
    subject: 'Welcome to KARAHOCA Newsletter! 🎉',
    greeting: 'Welcome! 🎉',
    thanks: 'Thank you for subscribing to the <strong>KARAHOCA</strong> newsletter.',
    promise: 'You will receive the latest news and exclusive offers directly to your inbox.',
    unsubNote: "If you didn't subscribe yourself, you can",
    unsubLink: 'unsubscribe',
    dir: 'ltr', lang: 'en',
  },
  tr: {
    subject: 'KARAHOCA Bültenine Hoş Geldiniz! 🎉',
    greeting: 'Hoş Geldiniz! 🎉',
    thanks: '<strong>KARAHOCA</strong> bültenine abone olduğunuz için teşekkürler.',
    promise: 'En son haberler ve özel teklifler doğrudan e-postanıza gelecek.',
    unsubNote: 'Kendiniz abone olmadıysanız',
    unsubLink: 'abonelikten çıkabilirsiniz',
    dir: 'ltr', lang: 'tr',
  },
  ru: {
    subject: 'Добро пожаловать в рассылку KARAHOCA! 🎉',
    greeting: 'Добро пожаловать! 🎉',
    thanks: 'Спасибо за подписку на рассылку <strong>KARAHOCA</strong>.',
    promise: 'Вы будете получать последние новости и эксклюзивные предложения.',
    unsubNote: 'Если вы не подписывались сами, вы можете',
    unsubLink: 'отписаться',
    dir: 'ltr', lang: 'ru',
  },
};

const ensureSubscriberUnsubscribeKey = (db, normalizedEmail, currentKey = '') => {
  const normalizedKey = typeof currentKey === 'string' ? currentKey.trim() : '';
  if (normalizedKey) return normalizedKey;

  let nextKey = generateOpaqueSubscriberKey();
  while (
    db.prepare('SELECT 1 FROM newsletter_subscribers WHERE unsubscribe_key = ? AND email != ?').get(nextKey, normalizedEmail)
  ) {
    nextKey = generateOpaqueSubscriberKey();
  }

  db.prepare('UPDATE newsletter_subscribers SET unsubscribe_key = ? WHERE email = ?').run(nextKey, normalizedEmail);
  return nextKey;
};

const sendWelcomeEmail = async ({ normalizedEmail, lang, subscriberKey }) => {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || '';
  const siteUrl = process.env.SITE_URL || 'https://karahoca.com';

  if (!resendKey) {
    console.warn('[welcome-email] RESEND_API_KEY is not set.');
    return { sent: false, error: 'RESEND_API_KEY is not configured on the server.' };
  }
  if (!fromEmail) {
    console.warn('[welcome-email] FROM_EMAIL is not set.');
    return { sent: false, error: 'FROM_EMAIL is not configured on the server.' };
  }

  const userLang = typeof lang === 'string' && WELCOME_EMAIL_I18N[lang] ? lang : 'ar';
  const i = WELCOME_EMAIL_I18N[userLang];
  const textAlign = i.dir === 'rtl' ? 'right' : 'left';
  const unsubUrl = buildUnsubscribeUrl({ siteUrl, subscriberKey, lang: userLang });

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [normalizedEmail],
        subject: i.subject,
        html: `<!DOCTYPE html><html lang="${i.lang}" dir="${i.dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Tahoma,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr><td style="background:linear-gradient(135deg,#1a1f3c,#2d3561);padding:32px 40px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700">KARAHOCA</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;text-align:${textAlign}">
          <h2 style="margin:0 0 16px;color:#1a1f3c;font-size:20px">${i.greeting}</h2>
          <p style="margin:0 0 14px;color:#444;line-height:1.7;font-size:15px">${i.thanks}</p>
          <p style="margin:0 0 14px;color:#444;line-height:1.7;font-size:15px">${i.promise}</p>
          <p style="margin:24px 0 0;color:#888;font-size:12px">${i.unsubNote} <a href="${unsubUrl}" style="color:#4f6ef7">${i.unsubLink}</a>.</p>
        </td></tr>
        <tr><td style="background:#f8f9fb;padding:16px 40px;text-align:center">
          <p style="margin:0;color:#aaa;font-size:11px">&copy; ${new Date().getFullYear()} KARAHOCA</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok) {
      console.log('[welcome-email] Sent OK, id:', data.id);
      return { sent: true, id: data.id };
    }
    console.warn('[welcome-email] Resend error:', JSON.stringify(data));
    return { sent: false, error: data.message || data.name || `Resend HTTP ${resp.status}`, details: data };
  } catch (e) {
    console.warn('[welcome-email] Network error:', e.message);
    return { sent: false, error: e.message };
  }
};

export const subscribeNewsletter = async ({ email, lang, _honey }) => {
  // Honeypot spam trap: bots fill the hidden _honey field.
  // Silently return success without saving anything.
  if (_honey) {
    return { success: true, message: 'Subscribed!' };
  }
  if (typeof email !== 'string') throw new Error('Invalid email address.');
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254) throw new Error('Email address too long.');
  if (
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(normalizedEmail)
  ) {
    throw new Error('Invalid email address.');
  }
  await ensureDataDirectory();

  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare(`
    SELECT email, active, unsubscribe_key
    FROM newsletter_subscribers
    WHERE email = ?
  `).get(normalizedEmail);

  let inserted = false;
  let subscriberKey = typeof existing?.unsubscribe_key === 'string' ? existing.unsubscribe_key.trim() : '';
  if (!existing) {
    subscriberKey = generateOpaqueSubscriberKey();
    db.prepare(`
      INSERT INTO newsletter_subscribers(email, subscribed_at, active, unsubscribe_key)
      VALUES(?,?,1,?)
    `).run(normalizedEmail, now, subscriberKey);
    inserted = true;
    incrementStat('newsletter_signups');
  } else if (existing.active === 0) {
    db.prepare('UPDATE newsletter_subscribers SET active = 1, subscribed_at = ? WHERE email = ?').run(now, normalizedEmail);
    inserted = true; // treat as new so they get the welcome email
    incrementStat('newsletter_signups');
  }

  subscriberKey = ensureSubscriberUnsubscribeKey(db, normalizedEmail, subscriberKey);

  // Backup JSON mirror — non-fatal.
  let subscribers = [];
  try {
    const rawFile = await readFile(newsletterFile, 'utf8');
    const parsed = JSON.parse(rawFile);
    subscribers = Array.isArray(parsed) ? parsed : [];
  } catch {
    subscribers = [];
  }
  const alreadyInBackup = subscribers.some((entry) => entry.email === normalizedEmail);
  if (!alreadyInBackup) {
    subscribers.push({ email: normalizedEmail, subscribedAt: new Date().toISOString() });
    try {
      await writeFile(newsletterFile, JSON.stringify(subscribers, null, 2), 'utf8');
    } catch (e) {
      console.warn('[newsletter] Could not write backup JSON file:', e.message);
    }
  }

  const welcomeEmail = inserted
    ? await sendWelcomeEmail({ normalizedEmail, lang, subscriberKey })
    : null;

  return { success: true, alreadySubscribed: !!existing, welcomeEmail };
};

export const unsubscribeBySubscriberKey = (subscriberKey) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT email, active
    FROM newsletter_subscribers
    WHERE unsubscribe_key = ?
  `).get(subscriberKey);
  if (!row) return { status: 'not_found' };
  if (row.active === 0) return { status: 'already_unsubscribed' };
  db.prepare('UPDATE newsletter_subscribers SET active = 0 WHERE unsubscribe_key = ?').run(subscriberKey);
  return { status: 'unsubscribed' };
};
