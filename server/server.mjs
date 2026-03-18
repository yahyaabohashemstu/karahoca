import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, 'data');
const conversationsDirectory = path.join(dataDirectory, 'conversations');
const newsletterFile = path.join(dataDirectory, 'newsletter.json');

const port = Number.parseInt(process.env.PORT || '5000', 10);
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const geminiEndpoint =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8'
};

const ensureDataDirectories = async () => {
  await mkdir(conversationsDirectory, { recursive: true });
};

const readRequestBody = async (request) =>
  new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk;
    });

    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(new Error('Invalid JSON payload.'));
      }
    });

    request.on('error', reject);
  });

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(payload));
};

const extractModelText = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const firstCandidate = candidates[0];
  const textParts = firstCandidate?.content?.parts
    ?.map((part) => part?.text)
    .filter(Boolean);

  if (!Array.isArray(textParts) || textParts.length === 0) {
    return null;
  }

  return textParts.join('\n').trim();
};

const normalizeFilename = (value) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

const saveConversation = async ({ userId, messages }) => {
  if (typeof userId !== 'string' || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid conversation payload.');
  }

  await ensureDataDirectories();

  const safeUserId = normalizeFilename(userId);
  const conversationPath = path.join(conversationsDirectory, `${safeUserId}.json`);

  let isNew = true;
  try {
    await stat(conversationPath);
    isNew = false;
  } catch {
    isNew = true;
  }

  const payload = {
    userId,
    updatedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages
  };

  await writeFile(conversationPath, JSON.stringify(payload, null, 2), 'utf8');

  return {
    success: true,
    conversationId: safeUserId,
    messageCount: messages.length,
    isNew
  };
};

const subscribeNewsletter = async ({ email }) => {
  if (typeof email !== 'string') {
    throw new Error('Invalid email address.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('Invalid email address.');
  }

  await ensureDataDirectories();

  let subscribers = [];
  try {
    const rawFile = await readFile(newsletterFile, 'utf8');
    const parsedFile = JSON.parse(rawFile);
    subscribers = Array.isArray(parsedFile) ? parsedFile : [];
  } catch {
    subscribers = [];
  }

  const alreadySubscribed = subscribers.some((entry) => entry.email === normalizedEmail);
  if (!alreadySubscribed) {
    subscribers.push({
      email: normalizedEmail,
      subscribedAt: new Date().toISOString()
    });
    await writeFile(newsletterFile, JSON.stringify(subscribers, null, 2), 'utf8');
  }

  return {
    success: true,
    alreadySubscribed
  };
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
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: `You are a multilingual customer service AI for KARAHOCA company.

CRITICAL INSTRUCTION: You MUST respond in the SAME LANGUAGE as the customer's question.
- Arabic question -> Arabic response
- English question -> English response
- Turkish question -> Turkish response
- Russian question -> Russian response
- Any other language -> Same language response`
        }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    })
  });

  if (!geminiResponse.ok) {
    const rawError = await geminiResponse.text();
    const error = new Error(rawError || `Gemini request failed (${geminiResponse.status}).`);
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

  return {
    success: true,
    reply
  };
};

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { success: false, error: 'Missing request URL.' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  try {
    if (request.method === 'POST' && request.url === '/api/ai/chat') {
      const body = await readRequestBody(request);
      const result = await generateAiReply(body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/conversations/save') {
      const body = await readRequestBody(request);
      const result = await saveConversation(body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/newsletter/subscribe') {
      const body = await readRequestBody(request);
      const result = await subscribeNewsletter(body);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { success: false, error: 'Route not found.' });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    sendJson(response, statusCode, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown server error.'
    });
  }
});

server.listen(port, () => {
  console.log(`KARAHOCA API server listening on http://localhost:${port}`);
});
