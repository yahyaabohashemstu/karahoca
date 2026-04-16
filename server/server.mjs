import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync } from 'node:fs';

import { initDb, getDb, incrementStat, logAudit } from './db.mjs';
import { requireAuth } from './auth.mjs';
import { handleAdminLogin } from './routes/admin-auth.mjs';
import { handleAdminStats } from './routes/admin-stats.mjs';
import { handleAdminAnalytics } from './routes/admin-analytics.mjs';
import { handleAdminChats } from './routes/admin-chats.mjs';
import { handleAdminProducts, handleAdminCategories } from './routes/admin-products.mjs';
import { handleAdminNews } from './routes/admin-news.mjs';
import { handleAdminNewsletter } from './routes/admin-newsletter.mjs';
import { handleAdminTranslate } from './routes/admin-translate.mjs';
import { handleAdminGa } from './routes/admin-ga.mjs';
import { handleAdminCampaigns, handleEmailOpen, handleEmailClick, dispatchCampaign } from './routes/admin-campaigns.mjs';
import { handleAdminAiKnowledge, buildProductContext, buildCustomQAContext, logUserQuestion } from './routes/admin-ai-knowledge.mjs';
import { handleAdminCatalog } from './routes/admin-catalog.mjs';
import { handlePublicProducts, handlePublicNews, handleChatLog } from './routes/public-data.mjs';
import { startAutoBackup } from './backup.mjs';
import { handleSitemap } from './routes/sitemap.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, 'data');
const newsletterFile = path.join(dataDirectory, 'newsletter.json');

const port = Number.parseInt(process.env.PORT || '5000', 10);
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
// OpenRouter API key — must be set via environment variable (never hardcode)
const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
const isProduction = process.env.NODE_ENV === 'production';
// ─── CORS ────────────────────────────────────────────────────────────────────

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const explicitOriginCandidates = [
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim()),
  process.env.SITE_URL || '',
  process.env.FRONTEND_URL || '',
  process.env.PUBLIC_SITE_URL || '',
  process.env.PUBLIC_APP_URL || '',
  process.env.APP_URL || ''
]
  .map((origin) => trimTrailingSlash(origin))
  .filter(Boolean);
const configuredAllowedOrigins = new Set(explicitOriginCandidates);
const localDevelopmentOrigins = new Set([
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
};

const createJsonHeaders = (requestOrigin = '') => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...SECURITY_HEADERS,
  };
  if (requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers.Vary = 'Origin';
  }
  return headers;
};

const getRequestOrigin = (request) => {
  const origin = request.headers.origin;
  return typeof origin === 'string' ? trimTrailingSlash(origin) : '';
};

const getRequestHostOrigin = (request) => {
  // Prefer X-Forwarded-Host set by reverse proxies (Traefik / Nginx / Coolify)
  // so that origin comparison works correctly in production behind a proxy.
  const forwardedHost = request.headers['x-forwarded-host'];
  const host = (typeof forwardedHost === 'string' && forwardedHost.trim())
    ? forwardedHost.split(',')[0].trim()
    : typeof request.headers.host === 'string'
      ? request.headers.host.trim()
      : '';
  if (!host) return '';
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.trim().length > 0
      ? forwardedProto.split(',')[0].trim()
      : request.socket.encrypted ? 'https' : 'http';
  return protocol + '://' + host;
};

const isCoolifySiblingOrigin = (requestOrigin, requestHostOrigin) => {
  try {
    const originUrl = new URL(requestOrigin);
    const hostUrl = new URL(requestHostOrigin);
    if (originUrl.protocol !== hostUrl.protocol) return false;

    const originHost = originUrl.hostname.toLowerCase();
    const hostHost = hostUrl.hostname.toLowerCase();
    if (!originHost.includes('.coolify.') || !hostHost.includes('.coolify.')) return false;

    const originParts = originHost.split('.').filter(Boolean);
    const hostParts = hostHost.split('.').filter(Boolean);
    if (originParts.length < 4 || hostParts.length < 4) return false;

    return originParts.slice(1).join('.') === hostParts.slice(1).join('.');
  } catch {
    return false;
  }
};

const isOriginAllowed = (requestOrigin, requestHostOrigin) => {
  if (!requestOrigin) return !isProduction;
  return (
    requestOrigin === requestHostOrigin ||
    configuredAllowedOrigins.has(requestOrigin) ||
    (isProduction && isCoolifySiblingOrigin(requestOrigin, requestHostOrigin)) ||
    (!isProduction && localDevelopmentOrigins.has(requestOrigin))
  );
};
// ─── Helpers ─────────────────────────────────────────────────────────────────

const ensureDataDirectories = async () => {
  await mkdir(dataDirectory, { recursive: true });
};

const MAX_BODY_BYTES = Number.parseInt(process.env.MAX_REQUEST_BODY_BYTES || '524288', 10); // 512 KB
// Base64 inflates by ~33 %, so 14 MB here covers a decoded 10 MB image comfortably.
const MAX_UPLOAD_BODY_BYTES = 14 * 1024 * 1024; // 14 MB body → supports up to 10 MB decoded image

const readRequestBody = async (request, maxBytes = MAX_BODY_BYTES) =>
  new Promise((resolve, reject) => {
    let rawBody = '';
    let totalBytes = 0;
    let tooLarge = false;
    request.on('data', (chunk) => {
      if (tooLarge) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        // Drain remaining data so the socket stays alive for a response
        request.resume();
        const err = new Error('Request body too large.');
        err.statusCode = 413;
        reject(err);
        return;
      }
      rawBody += chunk;
    });
    request.on('end', () => {
      if (tooLarge) return; // already rejected
      try { resolve(rawBody ? JSON.parse(rawBody) : {}); }
      catch { reject(new Error('Invalid JSON payload.')); }
    });
    request.on('error', (err) => { if (!tooLarge) reject(err); });
  });

const sendJson = (response, statusCode, payload, requestOrigin = '') => {
  response.writeHead(statusCode, createJsonHeaders(requestOrigin));
  response.end(JSON.stringify(payload));
};

const extractModelText = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  // OpenAI / OpenRouter format
  if (payload.choices?.[0]?.message?.content) {
    return payload.choices[0].message.content.trim();
  }
  // Gemini format (legacy fallback)
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const textParts = candidates[0]?.content?.parts?.map((part) => part?.text).filter(Boolean);
  if (!Array.isArray(textParts) || textParts.length === 0) return null;
  return textParts.join('\n').trim();
};

// ─── Existing handlers ────────────────────────────────────────────────────────

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
    subject: "KARAHOCA Bültenine Hoş Geldiniz! 🎉",
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

const subscribeNewsletter = async ({ email, lang }) => {
  if (typeof email !== 'string') throw new Error('Invalid email address.');
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254) throw new Error('Email address too long.');
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(normalizedEmail)) {
    throw new Error('Invalid email address.');
  }
  await ensureDataDirectories();

  // Save to DB (primary)
  const db = getDb();
  const now = new Date().toISOString();

  // Check if already exists (may be active or inactive from a past unsubscribe)
  const existing = db.prepare('SELECT email, active FROM newsletter_subscribers WHERE email = ?').get(normalizedEmail);

  let inserted = false;
  if (!existing) {
    // Brand new subscriber
    db.prepare('INSERT INTO newsletter_subscribers(email, subscribed_at, active) VALUES(?,?,1)').run(normalizedEmail, now);
    inserted = true;
    incrementStat('newsletter_signups');
  } else if (existing.active === 0) {
    // Previously unsubscribed — reactivate
    db.prepare('UPDATE newsletter_subscribers SET active = 1, subscribed_at = ? WHERE email = ?').run(now, normalizedEmail);
    inserted = true; // treat as new so they get the welcome email
    incrementStat('newsletter_signups');
  }
  // else: already active — do nothing (no duplicate welcome email)

  // Also keep the JSON file as backup
  let subscribers = [];
  try {
    const rawFile = await readFile(newsletterFile, 'utf8');
    const parsed = JSON.parse(rawFile);
    subscribers = Array.isArray(parsed) ? parsed : [];
  } catch { subscribers = []; }

  const alreadySubscribed = subscribers.some((entry) => entry.email === normalizedEmail);
  if (!alreadySubscribed) {
    subscribers.push({ email: normalizedEmail, subscribedAt: new Date().toISOString() });
    // Backup JSON write is non-fatal — DB is the primary store.
    try {
      await writeFile(newsletterFile, JSON.stringify(subscribers, null, 2), 'utf8');
    } catch (e) {
      console.warn('[newsletter] Could not write backup JSON file:', e.message);
    }
  }

  // ── Welcome email — awaited so errors surface in the response ────────────────
  let welcomeEmailStatus = null; // null = not attempted (already subscribed)

  if (inserted) {
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || '';
    const siteUrl   = process.env.SITE_URL   || 'https://karahoca.com';

    if (!resendKey) {
      welcomeEmailStatus = { sent: false, error: 'RESEND_API_KEY is not configured on the server.' };
      console.warn('[welcome-email] RESEND_API_KEY is not set.');
    } else if (!fromEmail) {
      welcomeEmailStatus = { sent: false, error: 'FROM_EMAIL is not configured on the server.' };
      console.warn('[welcome-email] FROM_EMAIL is not set.');
    } else {
      try {
        // Pick i18n strings based on subscriber's language (fallback: ar)
        const userLang = (typeof lang === 'string' && WELCOME_EMAIL_I18N[lang]) ? lang : 'ar';
        const i = WELCOME_EMAIL_I18N[userLang];
        const textAlign = i.dir === 'rtl' ? 'right' : 'left';
        const unsubUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(normalizedEmail)}`;

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
          welcomeEmailStatus = { sent: true, id: data.id };
          console.log('[welcome-email] Sent OK, id:', data.id);
        } else {
          welcomeEmailStatus = { sent: false, error: data.message || data.name || `Resend HTTP ${resp.status}`, details: data };
          console.warn('[welcome-email] Resend error:', JSON.stringify(data));
        }
      } catch (e) {
        welcomeEmailStatus = { sent: false, error: e.message };
        console.warn('[welcome-email] Network error:', e.message);
      }
    }
  }

  return { success: true, alreadySubscribed: !!existing, welcomeEmail: welcomeEmailStatus };
};

/** Build enriched prompt: append live DB products + custom Q&A */
/** Build enriched prompt: append live DB products + custom Q&A */
const buildDynamicContext = (prompt, lang = 'ar') => {
  try {
    const productCtx = buildProductContext(lang);
    const customCtx  = buildCustomQAContext(lang);
    const extra = [productCtx, customCtx].filter(Boolean).join('\n\n');
    if (!extra) return prompt;
    return `${prompt}\n\n${extra}`;
  } catch {
    return prompt; // fallback: use original prompt if DB fails
  }
};

// ── AI Model: Gemma 4 31B via OpenRouter ─────────────────────────────────────
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'google/gemma-3-27b-it'; // Gemma 4 31B

const SYSTEM_PROMPT = [
  'You are the AI assistant for KARAHOCA company.',
  '',
  'LANGUAGE RULE (ABSOLUTE PRIORITY):',
  '- You MUST respond in the exact same language as the customer question.',
  '- Arabic question -> Arabic response.',
  '- English question -> English response.',
  '- Turkish question -> Turkish response.',
  '- Russian question -> Russian response.',
  '- Any other language -> the same language response.',
  '',
  'BEHAVIOR RULES:',
  '- Sound like a natural human sales and support assistant, not a scripted keyword bot.',
  '- Answer the customer\'s real question directly before offering extra context.',
  '- Use only the information provided in the prompt and its knowledge base.',
  '- Do not say information is unavailable if the prompt already contains it.',
  '- Do not reply with a generic list of topics unless the customer explicitly asks what you can help with.',
  '- Keep answers clear, commercially professional, and useful.',
  '',
  'STRICT RULES — NEVER VIOLATE:',
  '- NEVER invent or guess prices, MOQ (minimum order quantities), shipping costs, delivery times, or payment terms.',
  '- For ANY question about pricing, MOQ, bulk orders, shipping, or commercial terms: say that these depend on several factors and the customer MUST contact us directly for accurate details.',
  '- Always provide contact info: email info@karahoca.com or WhatsApp +905305914990.',
  '- The "count per box" in product data means packaging units, NOT minimum order quantity. Never confuse them.',
  '- Do NOT make up information that is not explicitly in the knowledge base.'
].join('\n');

const generateAiReply = async ({ prompt, lang }) => {
  if (!openrouterApiKey) {
    const error = new Error('OPENROUTER_API_KEY is not configured on the server.');
    error.statusCode = 500;
    throw error;
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    const error = new Error('Prompt is required.');
    error.statusCode = 400;
    throw error;
  }

  const aiResponse = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openrouterApiKey}`,
      'HTTP-Referer': 'https://karahoca.com',
      'X-OpenRouter-Title': 'KARAHOCA AI Assistant',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildDynamicContext(prompt, lang) },
      ],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 1024,
    }),
  });

  if (!aiResponse.ok) {
    const rawError = await aiResponse.text();
    console.error(`[ai-chat] OpenRouter HTTP ${aiResponse.status}:`, rawError.slice(0, 300));
    const error = new Error(rawError || 'AI request failed (' + aiResponse.status + ').');
    error.statusCode = aiResponse.status;
    throw error;
  }

  const payload = await aiResponse.json();
  const reply = extractModelText(payload);
  if (!reply) {
    const error = new Error('AI model returned an empty response.');
    error.statusCode = 502;
    throw error;
  }
  return { success: true, reply };
};

// ─── AI response cache ───────────────────────────────────────────────────────
const aiCache = new Map(); // key → { reply, expiresAt, hits }
const AI_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const AI_CACHE_MAX = 500;

const normalizePrompt = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const getCachedReply = (prompt, lang) => {
  const key = lang + ':' + normalizePrompt(prompt);
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    aiCache.delete(key);
    return null;
  }
  entry.hits = (entry.hits || 0) + 1;
  return entry.reply;
};

const setCachedReply = (prompt, lang, reply) => {
  const key = lang + ':' + normalizePrompt(prompt);
  aiCache.set(key, { reply, expiresAt: Date.now() + AI_CACHE_TTL, hits: 0 });
  if (aiCache.size > AI_CACHE_MAX) {
    const firstKey = aiCache.keys().next().value;
    aiCache.delete(firstKey);
  }
};

// ─── Rate limiter with memory cap ────────────────────────────────────────────
const MAX_RATE_ENTRIES = 10_000; // prevent memory exhaustion from IP rotation attacks

const chatRateMap = new Map(); // ip → { count, resetAt }
const CHAT_LIMIT = 30;         // max requests per window
const CHAT_WINDOW = 60_000;    // 1 minute

const isChatRateLimited = (ip) => {
  const now = Date.now();
  const rec = chatRateMap.get(ip);
  if (!rec || now > rec.resetAt) {
    if (chatRateMap.size >= MAX_RATE_ENTRIES) chatRateMap.delete(chatRateMap.keys().next().value);
    chatRateMap.set(ip, { count: 1, resetAt: now + CHAT_WINDOW });
    return false;
  }
  rec.count++;
  if (rec.count > CHAT_LIMIT) return true;
  return false;
};

// ─── Unsubscribe rate limiter (prevents abuse/enumeration) ──────────────────
const unsubRateMap = new Map(); // ip → { count, resetAt }
const UNSUB_LIMIT  = 10;        // max requests per window
const UNSUB_WINDOW = 5 * 60_000; // 5 minutes

const isUnsubRateLimited = (ip) => {
  const now = Date.now();
  const rec = unsubRateMap.get(ip);
  if (!rec || now > rec.resetAt) {
    if (unsubRateMap.size >= MAX_RATE_ENTRIES) unsubRateMap.delete(unsubRateMap.keys().next().value);
    unsubRateMap.set(ip, { count: 1, resetAt: now + UNSUB_WINDOW });
    return false;
  }
  rec.count++;
  return rec.count > UNSUB_LIMIT;
};

// Prune stale entries every 5 minutes
const rateLimitPruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of chatRateMap) {
    if (now > rec.resetAt) chatRateMap.delete(ip);
  }
  for (const [ip, rec] of unsubRateMap) {
    if (now > rec.resetAt) unsubRateMap.delete(ip);
  }
}, 300_000);

// ─── Admin auth guard ─────────────────────────────────────────────────────────

const requireAdminAuth = (request, response, requestOrigin) => {
  const user = requireAuth(request);
  if (!user || user.role !== 'admin') {
    sendJson(response, 401, { success: false, error: 'Unauthorized.' }, requestOrigin);
    return null;
  }
  return user;
};

// ─── Static file MIME types ───────────────────────────────────────────────────
const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.txt':  'text/plain',
  '.xml':  'application/xml',
  '.pdf':  'application/pdf',
  '.webmanifest': 'application/manifest+json',
};
const distDir = path.join(__dirname, '..', 'dist');
const spaIndex = path.join(distDir, 'index.html');

// ── SEO: per-route meta for SPA fallback (crawlers see correct title/desc) ──
const ROUTE_META = {
  '/': {
    title: 'KARAHOCA - World-Class Cleaning Products | منظفات بجودة عالمية',
    description: 'KARAHOCA is the leading manufacturer of cleaning products in Turkey. Two brands: DIOX & AYLUX. 30+ years of experience, 200+ employees, 15+ countries.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/diox': {
    title: 'DIOX - Professional Cleaning Products | KARAHOCA',
    description: 'DIOX brand from KARAHOCA - professional cleaning products with superior power. Laundry detergents, all-purpose cleaners, liquid soap, and stain removers.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/aylux': {
    title: 'AYLUX - Premium Care Products | KARAHOCA',
    description: 'AYLUX brand from KARAHOCA - premium care products with elegant sophistication. Gel cleaners, liquid cleaners, liquid soap, and fragrances.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/about': {
    title: 'About Us - 30 Years Success Story | KARAHOCA',
    description: 'Discover KARAHOCA journey from 1995 to today. 30+ years experience, 15+ distribution countries, 2 global brands: DIOX & AYLUX.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/news': {
    title: 'News & Updates | KARAHOCA',
    description: 'Follow KARAHOCA news about new product launches, distribution agreements, exhibitions, and operational upgrades.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/production': {
    title: 'Production Process | KARAHOCA',
    description: 'Discover KARAHOCA advanced production process from raw materials to packaging with strict quality control.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/goal': {
    title: 'Our Goal | KARAHOCA',
    description: 'Learn about our goals and roadmap for continuous growth and innovation in the detergent sector.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/dryer': {
    title: 'Our Dryer | KARAHOCA',
    description: 'Discover KARAHOCA advanced dryer technology - high-capacity production with raw material manufacturing capability.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/privacy': {
    title: 'Privacy Policy | KARAHOCA',
    description: 'KARAHOCA privacy policy — how we collect, use, and protect your personal information.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
  '/terms': {
    title: 'Terms of Service | KARAHOCA',
    description: 'KARAHOCA terms of service — rules and conditions for using our website.',
    image: '/karahoca-logo-1-Photoroom.webp',
  },
};

// Cache the raw HTML template at startup for meta injection
let spaHtmlTemplate = '';
try { spaHtmlTemplate = existsSync(spaIndex) ? (await readFile(spaIndex, 'utf8')) : ''; } catch { /* */ }

/** Escape HTML attribute values to prevent XSS injection */
function escAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectMeta(html, routePath) {
  let meta = ROUTE_META[routePath];

  // Dynamic news article meta from database
  if (!meta && routePath.startsWith('/news/')) {
    try {
      const slug = routePath.replace('/news/', '');
      const db = getDb();
      const row = db.prepare(
        `SELECT title_en, excerpt_en, image FROM news WHERE slug=? AND active=1`
      ).get(slug);
      if (row) {
        meta = {
          title: `${row.title_en} | KARAHOCA`,
          description: row.excerpt_en || '',
          image: row.image || '/karahoca-logo-1-Photoroom.webp',
        };
      }
    } catch { /* fallback to uninjected HTML */ }
  }

  if (!meta) return html;
  const siteUrl = 'https://karahoca.com';
  const t = escAttr(meta.title);
  const d = escAttr(meta.description);
  const img = escAttr(`${siteUrl}${meta.image}`);
  const url = escAttr(`${siteUrl}${routePath}`);
  const ogType = routePath.startsWith('/news/') ? 'article' : 'website';
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*">/, `<meta name="description" content="${d}">`)
    .replace('</head>', `<meta property="og:title" content="${t}">\n<meta property="og:description" content="${d}">\n<meta property="og:image" content="${img}">\n<meta property="og:url" content="${url}">\n<meta property="og:type" content="${ogType}">\n<meta property="og:site_name" content="KARAHOCA">\n</head>`);
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { success: false, error: 'Missing request URL.' });
    return;
  }

  const requestOrigin = getRequestOrigin(request);
  const requestHostOrigin = getRequestHostOrigin(request);
  const originAllowed = isOriginAllowed(requestOrigin, requestHostOrigin);
  const url = request.url.split('?')[0]; // path without query string
  const ctx = { sendJson: (res, code, payload, origin) => sendJson(res, code, payload, origin), origin: requestOrigin, url };

  if (request.method === 'OPTIONS') {
    if (!originAllowed) { sendJson(response, 403, { success: false, error: 'Origin is not allowed.' }); return; }
    response.writeHead(204, createJsonHeaders(requestOrigin));
    response.end();
    return;
  }

  if ((request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') && !originAllowed) {
    sendJson(response, 403, { success: false, error: 'Origin is not allowed.' }, requestOrigin);
    return;
  }

  try {
    // ── Public routes ──────────────────────────────────────────────────────

    if (request.method === 'POST' && url === '/api/ai/chat') {
      const clientIp = (request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown')
        .split(',')[0].trim();
      if (isChatRateLimited(clientIp)) {
        sendJson(response, 429, { success: false, error: 'Too many requests. Please slow down.' }, requestOrigin);
        return;
      }
      const body = await readRequestBody(request);
      // Log user question silently (fire-and-forget)
      if (typeof body?.prompt === 'string') {
        const lastLine = body.prompt.split('\n').filter(l => l.startsWith('User:')).pop();
        if (lastLine) {
          const q = lastLine.replace(/^User:\s*/,'').trim().slice(0, 500);
          logUserQuestion(q, body.lang || 'ar', null);
        }
      }
      // Check cache first
      const cachedReply = getCachedReply(body.prompt, body.lang || 'ar');
      if (cachedReply) {
        sendJson(response, 200, { success: true, reply: cachedReply }, requestOrigin);
        return;
      }
      try {
        const promptLen = (body.prompt || '').length;
        console.log(`[ai-chat] prompt length: ${promptLen} chars`);
        const result = await generateAiReply(body);
        if (result?.reply) setCachedReply(body.prompt, body.lang || 'ar', result.reply);
        sendJson(response, 200, result, requestOrigin);
      } catch (aiErr) {
        console.error(`[ai-chat] generateAiReply failed:`, aiErr.message || aiErr);
        sendJson(response, aiErr.statusCode || 503, {
          success: false,
          error: 'AI service temporarily unavailable. Please try again.'
        }, requestOrigin);
      }
      return;
    }

    if (request.method === 'POST' && url === '/api/newsletter/subscribe') {
      const body = await readRequestBody(request);
      const result = await subscribeNewsletter(body);
      sendJson(response, 200, result, requestOrigin);
      return;
    }

    // ── Public newsletter unsubscribe (no auth needed, rate-limited) ───────
    if (request.method === 'GET' && url === '/api/newsletter/unsubscribe') {
      const unsubIp = (request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown')
        .split(',')[0].trim();
      if (isUnsubRateLimited(unsubIp)) {
        sendJson(response, 429, { success: false, error: 'Too many requests. Please try again later.' }, requestOrigin);
        return;
      }
      const queryUrl = new URL(request.url, 'http://localhost');
      const email = queryUrl.searchParams.get('email');
      if (!email || typeof email !== 'string') {
        sendJson(response, 400, { success: false, error: 'Missing email parameter.' }, requestOrigin);
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      try {
        const db = getDb();
        const row = db.prepare('SELECT email, active FROM newsletter_subscribers WHERE email = ?').get(normalizedEmail);
        if (!row) {
          sendJson(response, 404, { success: false, error: 'Email not found.' }, requestOrigin);
          return;
        }
        if (row.active === 0) {
          sendJson(response, 200, { success: true, alreadyUnsubscribed: true }, requestOrigin);
          return;
        }
        db.prepare('UPDATE newsletter_subscribers SET active = 0 WHERE email = ?').run(normalizedEmail);
        console.log('[newsletter] Unsubscribed:', normalizedEmail);
        sendJson(response, 200, { success: true }, requestOrigin);
      } catch (e) {
        console.error('[newsletter] Unsubscribe error:', e.message);
        sendJson(response, 500, { success: false, error: 'Server error.' }, requestOrigin);
      }
      return;
    }

    // ── Frontend error reporting (non-fatal, no auth needed) ─────────────────
    if (request.method === 'POST' && url === '/api/log-error') {
      const body = await readRequestBody(request);
      if (body?.message && typeof body.message === 'string') {
        console.error('[client-error]', JSON.stringify({
          message: String(body.message).slice(0, 300),
          stack: typeof body.stack === 'string' ? body.stack.slice(0, 500) : undefined,
          url: typeof body.url === 'string' ? body.url.slice(0, 200) : undefined,
          ts: body.ts,
        }));
      }
      sendJson(response, 200, { success: true }, requestOrigin);
      return;
    }

    if (request.method === 'POST' && url === '/api/chat/log') {
      const body = await readRequestBody(request);
      // Basic spam guard: userId must be a non-empty string ≤ 128 chars
      if (typeof body?.userId !== 'string' || !body.userId.trim() || body.userId.length > 128) {
        sendJson(response, 400, { success: false, error: 'Invalid userId.' }, requestOrigin);
        return;
      }
      await handleChatLog(request, response, { ...ctx, body });
      return;
    }

    // ── Uploaded images (public — no auth needed) ─────────────────────────────
    if (request.method === 'GET' && url.startsWith('/api/uploads/')) {
      const fileName = path.basename(url.replace('/api/uploads/', ''));
      const filePath = path.join(__dirname, 'data', 'uploads', fileName);
      try {
        const s = await stat(filePath);
        if (!s.isFile()) throw new Error('not a file');
        const ext = path.extname(filePath).toLowerCase();
        const mime = STATIC_MIME[ext] ?? 'application/octet-stream';
        response.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': String(s.size),
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
        createReadStream(filePath).pipe(response);
      } catch {
        sendJson(response, 404, { error: 'Not found' }, requestOrigin);
      }
      return;
    }

    // Open tracking pixel (public — no auth needed)
    if (request.method === 'GET' && url === '/api/email/open') {
      handleEmailOpen(request, response);
      return;
    }

    // Click tracking redirect (public — no auth needed)
    if (request.method === 'GET' && url.startsWith('/api/email/click')) {
      handleEmailClick(request, response);
      return;
    }

    if (request.method === 'GET' && url.startsWith('/api/products/')) {
      handlePublicProducts(request, response, ctx);
      return;
    }

    if (request.method === 'GET' && url === '/api/news') {
      handlePublicNews(request, response, ctx);
      return;
    }

    // ── Admin login (public) ───────────────────────────────────────────────

    if (request.method === 'POST' && url === '/api/admin/login') {
      const body = await readRequestBody(request);
      await handleAdminLogin(request, response, { ...ctx, body });
      return;
    }

    // ── Catalog route (self-authenticates via query token for new-tab PDF) ──
    if (url.startsWith('/api/admin/catalog')) {
      handleAdminCatalog(request, response, { ...ctx, url: request.url });
      return;
    }

    // ── Protected admin routes ─────────────────────────────────────────────

    if (url.startsWith('/api/admin/')) {
      const adminUser = requireAdminAuth(request, response, requestOrigin);
      if (!adminUser) return;
      const isUpload = url === '/api/admin/upload-image' && request.method === 'POST';
      const body = ['POST','PUT','PATCH'].includes(request.method)
        ? await readRequestBody(request, isUpload ? MAX_UPLOAD_BODY_BYTES : MAX_BODY_BYTES)
        : {};
      const adminCtx = { ...ctx, body, admin: adminUser };

      if (url === '/api/admin/stats' && request.method === 'GET') {
        handleAdminStats(request, response, adminCtx);
        return;
      }

      if (url === '/api/admin/analytics' && request.method === 'GET') {
        handleAdminAnalytics(request, response, adminCtx);
        return;
      }

      // ── Audit log ────────────────────────────────────────────────────────────
      if (url === '/api/admin/audit-log' && request.method === 'GET') {
        const db = getDb();
        const urlObj = new URL(request.url, 'http://localhost');
        const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '100', 10), 500);
        const offset = parseInt(urlObj.searchParams.get('offset') || '0', 10);
        const entityType = urlObj.searchParams.get('entity') || null;
        const where = entityType ? 'WHERE entity_type=?' : '';
        const params = entityType ? [entityType, limit, offset] : [limit, offset];
        const logs = db.prepare(`SELECT * FROM admin_audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params);
        const total = db.prepare(`SELECT COUNT(*) as c FROM admin_audit_log ${where}`).get(...(entityType ? [entityType] : [])).c;
        sendJson(response, 200, { success: true, logs, total }, requestOrigin);
        return;
      }

      if (url.startsWith('/api/admin/chats')) {
        handleAdminChats(request, response, adminCtx);
        return;
      }

      if (url.startsWith('/api/admin/products')) {
        handleAdminProducts(request, response, adminCtx);
        return;
      }

      if (url.startsWith('/api/admin/categories')) {
        handleAdminCategories(request, response, adminCtx);
        return;
      }

      if (url.startsWith('/api/admin/newsletter')) {
        handleAdminNewsletter(request, response, adminCtx);
        return;
      }

      if (url.startsWith('/api/admin/news')) {
        handleAdminNews(request, response, adminCtx);
        return;
      }

      if (url === '/api/admin/translate' && request.method === 'POST') {
        await handleAdminTranslate(request, response, adminCtx);
        return;
      }

      if (url === '/api/admin/ga' && request.method === 'GET') {
        await handleAdminGa(request, response, adminCtx);
        return;
      }

      if (url.startsWith('/api/admin/campaigns')) {
        await handleAdminCampaigns(request, response, adminCtx);
        return;
      }

      if (url.startsWith('/api/admin/ai-knowledge')) {
        handleAdminAiKnowledge(request, response, adminCtx);
        return;
      }

      // ── Image upload ──────────────────────────────────────────────────────────
      if (url === '/api/admin/upload-image' && request.method === 'POST') {
        const { imageBase64, fileName } = body;
        if (!imageBase64 || !fileName) {
          sendJson(response, 400, { error: 'imageBase64 and fileName required' }, requestOrigin);
          return;
        }
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        if (!['jpg','jpeg','png','webp','gif'].includes(ext)) {
          sendJson(response, 400, { error: 'Unsupported file type' }, requestOrigin);
          return;
        }
        const buf = Buffer.from(imageBase64, 'base64');
        if (buf.length > 10 * 1024 * 1024) {
          sendJson(response, 400, { error: 'File too large (max 10 MB)' }, requestOrigin);
          return;
        }

        // Verify actual file content matches claimed extension (magic bytes)
        const magicValid =
          (ext === 'jpg' || ext === 'jpeg') && buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF ||
          ext === 'png'  && buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 ||
          ext === 'gif'  && buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 ||
          ext === 'webp' && buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
        if (!magicValid) {
          sendJson(response, 400, { error: 'File content does not match the declared image type' }, requestOrigin);
          return;
        }

        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const uploadDir = path.join(__dirname, 'data', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, unique), buf);
        // API_PUBLIC_URL = the publicly accessible URL of this Node.js backend
        // (needed so email clients can load uploaded images directly from the API server,
        //  since the nginx frontend does NOT proxy /api/ routes)
        const apiBase = (process.env.API_PUBLIC_URL || process.env.SITE_URL || '').replace(/\/+$/, '');
        const relativePath = `/api/uploads/${unique}`;
        const absoluteUrl = apiBase ? `${apiBase}${relativePath}` : relativePath;
        sendJson(response, 200, { success: true, path: relativePath, url: absoluteUrl }, requestOrigin);
        return;
      }

      if (url.startsWith('/api/admin/catalog')) {
        handleAdminCatalog(request, response, { ...ctx, url });
        return;
      }

      sendJson(response, 404, { success: false, error: 'Admin route not found.' }, requestOrigin);
      return;
    }

    if (request.method === 'GET' && url === '/sitemap.xml') {
      handleSitemap(request, response);
      return;
    }

    // ── Static file serving (production SPA) ──────────────────────────────────
    if (request.method === 'GET' && existsSync(distDir)) {
      let decodedUrl = url;
      try { decodedUrl = decodeURIComponent(url); } catch { decodedUrl = url; }
      const resolved = path.resolve(distDir, decodedUrl.replace(/^\//, ''));
      if (!resolved.startsWith(distDir + path.sep) && resolved !== distDir) {
        sendJson(response, 403, { success: false, error: 'Forbidden.' }, requestOrigin);
        return;
      }
      const filePath = resolved;

      const tryServeFile = async (fp) => {
        try {
          const s = await stat(fp);
          if (!s.isFile()) return false;
          const ext = path.extname(fp).toLowerCase();
          const mime = STATIC_MIME[ext] ?? 'application/octet-stream';
          const headers = { 'Content-Type': mime, 'Content-Length': String(s.size) };
          if (ext !== '.html') headers['Cache-Control'] = 'public, max-age=31536000, immutable';
          response.writeHead(200, headers);
          createReadStream(fp).pipe(response);
          return true;
        } catch {
          return false;
        }
      };

      if (await tryServeFile(filePath)) return;
      if (await tryServeFile(path.join(filePath, 'index.html'))) return;

      // SPA fallback — serve index.html with injected meta for crawlers
      if (spaHtmlTemplate) {
        const injected = injectMeta(spaHtmlTemplate, url.split('?')[0].split('#')[0]);
        const buf = Buffer.from(injected, 'utf8');
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': String(buf.length),
        });
        response.end(buf);
        return;
      }
    }

    sendJson(response, 404, { success: false, error: 'Route not found.' }, requestOrigin);
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    sendJson(response, statusCode, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown server error.'
    }, requestOrigin);
  }
});

// ─── Init DB then start server ────────────────────────────────────────────────

await ensureDataDirectories();
initDb();

// ── News: auto-publish scheduled articles ────────────────────────────────────
const publishDueNewsArticles = () => {
  try {
    const db = getDb();
    const result = db.prepare(`
      UPDATE news
      SET status='published', active=1, updated_at=datetime('now')
      WHERE status='scheduled'
        AND publish_at IS NOT NULL
        AND datetime(publish_at) <= datetime('now')
        AND active=1
    `).run();
    if (result.changes > 0) {
      console.log(`[news-scheduler] Published ${result.changes} scheduled article(s).`);
    }
  } catch (e) {
    console.error('[news-scheduler] error:', e.message);
  }
};
void publishDueNewsArticles();
const newsSchedulerInterval = setInterval(publishDueNewsArticles, 60 * 1000);

// ── Campaign scheduler ────────────────────────────────────────────────────────
const dispatchDueCampaigns = async () => {
  try {
    const db = getDb();
    const due = db.prepare(
      `SELECT id FROM email_campaigns
       WHERE status='scheduled'
         AND scheduled_at IS NOT NULL
         AND datetime(scheduled_at) <= datetime('now')`
    ).all();
    for (const { id } of due) {
      console.log(`[scheduler] Dispatching campaign #${id}`);
      await dispatchCampaign(id).catch(e => console.error(`[scheduler] Campaign #${id} failed:`, e.message));
    }
  } catch (e) {
    console.error('[scheduler] error:', e.message);
  }
};

// Check immediately on boot, then every minute so scheduled sends do not lag.
void dispatchDueCampaigns();
const campaignInterval = setInterval(() => {
  void dispatchDueCampaigns();
}, 60 * 1000);

server.listen(port, () => {
  console.log('KARAHOCA API server listening on http://localhost:' + port);
});

const backupInterval = startAutoBackup();

// ── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`[server] ${signal} received — shutting down gracefully.`);
  clearInterval(newsSchedulerInterval);
  clearInterval(campaignInterval);
  clearInterval(rateLimitPruneInterval);
  if (backupInterval) clearInterval(backupInterval);
  server.close(() => {
    console.log('[server] HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 5s if server.close hangs
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));





