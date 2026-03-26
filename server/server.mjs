import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const configuredAllowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => trimTrailingSlash(origin.trim()))
    .filter(Boolean)
);
const localDevelopmentOrigins = new Set([
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

const createJsonHeaders = (requestOrigin = '') => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
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
  const host = typeof request.headers.host === 'string' ? request.headers.host.trim() : '';
  if (!host) return '';
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.trim().length > 0
      ? forwardedProto.split(',')[0].trim()
      : request.socket.encrypted ? 'https' : 'http';
  return protocol + '://' + host;
};

const isOriginAllowed = (requestOrigin, requestHostOrigin) => {
  if (!requestOrigin) return !isProduction;
  return (
    requestOrigin === requestHostOrigin ||
    configuredAllowedOrigins.has(requestOrigin) ||
    (!isProduction && localDevelopmentOrigins.has(requestOrigin))
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ensureDataDirectories = async () => {
  await mkdir(dataDirectory, { recursive: true });
};

const readRequestBody = async (request) =>
  new Promise((resolve, reject) => {
    let rawBody = '';
    request.on('data', (chunk) => { rawBody += chunk; });
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Invalid email address.');
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
    await writeFile(newsletterFile, JSON.stringify(subscribers, null, 2), 'utf8');
  }

  return { success: true, alreadySubscribed: !!exists };
};

const generateAiReply = async ({ prompt }) => {
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
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
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

// ─── Admin auth guard ─────────────────────────────────────────────────────────

const requireAdminAuth = (request, response, requestOrigin) => {
  const user = requireAuth(request);
  if (!user) {
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
      const body = await readRequestBody(request);
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
      await handleChatLog(request, response, { ...ctx, body });
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

server.listen(port, () => {
  console.log('KARAHOCA API server listening on http://localhost:' + port);
});
