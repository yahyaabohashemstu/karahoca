import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDb, getDb, incrementStat } from './db.mjs';
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
import { handleAdminCampaigns, handleEmailOpen, dispatchCampaign } from './routes/admin-campaigns.mjs';
import { handleAdminAiKnowledge, buildProductContext, buildCustomQAContext, logUserQuestion } from './routes/admin-ai-knowledge.mjs';
import { handleAdminCatalog } from './routes/admin-catalog.mjs';
import { handlePublicProducts, handlePublicNews, handleChatLog } from './routes/public-data.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, 'data');
const newsletterFile = path.join(dataDirectory, 'newsletter.json');

const port = Number.parseInt(process.env.PORT || '5000', 10);
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const isProduction = process.env.NODE_ENV === 'production';
const geminiEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
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

const readRequestBody = async (request) =>
  new Promise((resolve, reject) => {
    let rawBody = '';
    let totalBytes = 0;
    request.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        request.destroy();
        const err = new Error('Request body too large.');
        err.statusCode = 413;
        reject(err);
        return;
      }
      rawBody += chunk;
    });
    request.on('end', () => {
      try { resolve(rawBody ? JSON.parse(rawBody) : {}); }
      catch { reject(new Error('Invalid JSON payload.')); }
    });
    request.on('error', reject);
  });

const sendJson = (response, statusCode, payload, requestOrigin = '') => {
  response.writeHead(statusCode, createJsonHeaders(requestOrigin));
  response.end(JSON.stringify(payload));
};

const extractModelText = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const textParts = candidates[0]?.content?.parts?.map((part) => part?.text).filter(Boolean);
  if (!Array.isArray(textParts) || textParts.length === 0) return null;
  return textParts.join('\n').trim();
};

// ─── Existing handlers ────────────────────────────────────────────────────────

const subscribeNewsletter = async ({ email }) => {
  if (typeof email !== 'string') throw new Error('Invalid email address.');
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254) throw new Error('Email address too long.');
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(normalizedEmail)) {
    throw new Error('Invalid email address.');
  }
  await ensureDataDirectories();

  // Save to DB (primary)
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM newsletter_subscribers WHERE email=?').get(normalizedEmail);
  if (!exists) {
    db.prepare('INSERT INTO newsletter_subscribers(email, subscribed_at) VALUES(?,?)').run(
      normalizedEmail, new Date().toISOString()
    );
    incrementStat('newsletter_signups');
  }

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

  return { success: true, alreadySubscribed: !!exists };
};

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

const generateAiReply = async ({ prompt, lang }) => {
  if (!geminiApiKey) {
    const error = new Error('GEMINI_API_KEY is not configured on the server.');
    error.statusCode = 500;
    throw error;
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    const error = new Error('Prompt is required.');
    error.statusCode = 400;
    throw error;
  }

  const geminiResponse = await fetch(geminiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: [
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
            '- If pricing, shipping, or order conditions depend on quantity, size, packaging, or exact SKU, explain that naturally and ask only the minimum necessary follow-up.',
            '- Keep answers clear, commercially professional, and useful.'
          ].join('\\n')
        }]
      },
      contents: [{ role: 'user', parts: [{ text: buildDynamicContext(prompt, lang) }] }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 1024 }
    })
  });

  if (!geminiResponse.ok) {
    const rawError = await geminiResponse.text();
    const error = new Error(rawError || 'Gemini request failed (' + geminiResponse.status + ').');
    error.statusCode = geminiResponse.status;
    throw error;
  }

  const payload = await geminiResponse.json();
  const reply = extractModelText(payload);
  if (!reply) {
    const error = new Error('Gemini returned an empty response.');
    error.statusCode = 502;
    throw error;
  }
  return { success: true, reply };
};

// ─── Chat rate limiter (prevents Gemini quota abuse) ─────────────────────────
const chatRateMap = new Map(); // ip → { count, resetAt }
const CHAT_LIMIT = 30;         // max requests per window
const CHAT_WINDOW = 60_000;    // 1 minute

const isChatRateLimited = (ip) => {
  const now = Date.now();
  const rec = chatRateMap.get(ip);
  if (!rec || now > rec.resetAt) {
    chatRateMap.set(ip, { count: 1, resetAt: now + CHAT_WINDOW });
    return false;
  }
  rec.count++;
  if (rec.count > CHAT_LIMIT) return true;
  return false;
};

// Prune stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of chatRateMap) {
    if (now > rec.resetAt) chatRateMap.delete(ip);
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
      const result = await generateAiReply(body);
      sendJson(response, 200, result, requestOrigin);
      return;
    }

    if (request.method === 'POST' && url === '/api/newsletter/subscribe') {
      const body = await readRequestBody(request);
      const result = await subscribeNewsletter(body);
      sendJson(response, 200, result, requestOrigin);
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

    // Open tracking pixel (public — no auth needed)
    if (request.method === 'GET' && url === '/api/email/open') {
      handleEmailOpen(request, response);
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
      if (!requireAdminAuth(request, response, requestOrigin)) return;
      const body = ['POST','PUT','PATCH'].includes(request.method) ? await readRequestBody(request) : {};

      if (url === '/api/admin/stats' && request.method === 'GET') {
        handleAdminStats(request, response, ctx);
        return;
      }

      if (url === '/api/admin/analytics' && request.method === 'GET') {
        handleAdminAnalytics(request, response, ctx);
        return;
      }

      if (url.startsWith('/api/admin/chats')) {
        handleAdminChats(request, response, { ...ctx, body });
        return;
      }

      if (url.startsWith('/api/admin/products')) {
        handleAdminProducts(request, response, { ...ctx, body });
        return;
      }

      if (url.startsWith('/api/admin/categories')) {
        handleAdminCategories(request, response, { ...ctx, body });
        return;
      }

      if (url.startsWith('/api/admin/news')) {
        handleAdminNews(request, response, { ...ctx, body });
        return;
      }

      if (url.startsWith('/api/admin/newsletter')) {
        handleAdminNewsletter(request, response, { ...ctx, body });
        return;
      }

      if (url === '/api/admin/translate' && request.method === 'POST') {
        await handleAdminTranslate(request, response, { ...ctx, body });
        return;
      }

      if (url === '/api/admin/ga' && request.method === 'GET') {
        await handleAdminGa(request, response, ctx);
        return;
      }

      if (url.startsWith('/api/admin/campaigns')) {
        await handleAdminCampaigns(request, response, { ...ctx, body });
        return;
      }

      if (url.startsWith('/api/admin/ai-knowledge')) {
        handleAdminAiKnowledge(request, response, { ...ctx, body });
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
        if (buf.length > 5 * 1024 * 1024) {
          sendJson(response, 400, { error: 'File too large (max 5 MB)' }, requestOrigin);
          return;
        }
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, unique), buf);
        sendJson(response, 200, { success: true, path: `/uploads/${unique}` }, origin);
        return;
      }

      if (url.startsWith('/api/admin/catalog')) {
        handleAdminCatalog(request, response, { ...ctx, url });
        return;
      }

      sendJson(response, 404, { success: false, error: 'Admin route not found.' }, requestOrigin);
      return;
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

// ── Campaign scheduler — check every 5 minutes ────────────────────────────────
setInterval(async () => {
  try {
    const db = getDb();
    const due = db.prepare(
      `SELECT id FROM email_campaigns WHERE status='scheduled' AND scheduled_at <= datetime('now')`
    ).all();
    for (const { id } of due) {
      console.log(`[scheduler] Dispatching campaign #${id}`);
      await dispatchCampaign(id).catch(e => console.error(`[scheduler] Campaign #${id} failed:`, e.message));
    }
  } catch (e) {
    console.error('[scheduler] error:', e.message);
  }
}, 5 * 60 * 1000);

server.listen(port, () => {
  console.log('KARAHOCA API server listening on http://localhost:' + port);
});





