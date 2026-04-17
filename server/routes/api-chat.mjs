import { readRequestBody } from '../middlewares/bodyParser.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { getClientIp, isChatRateLimited, isChatLogRateLimited } from '../middlewares/security.mjs';
import { generateAiReply, getCachedReply, setCachedReply } from '../services/aiChat.mjs';
import { logUserQuestion } from './admin-ai-knowledge.mjs';
import { handleChatLog as handleChatLogLegacy } from './public-data.mjs';
import { logger } from '../utils/logger.mjs';

/**
 * POST /api/ai/chat
 * Rate limit: 30 req/min per IP. Checks Redis cache first; on miss calls
 * OpenRouter; cached replies are stored for 24h.
 */
export const handleAiChat = async (request, response, { origin }) => {
  const clientIp = getClientIp(request);
  if (await isChatRateLimited(clientIp)) {
    sendJson(response, 429, { success: false, error: 'Too many requests. Please slow down.' }, origin);
    return;
  }

  const body = await readRequestBody(request);

  // Fire-and-forget: silently log the last user line for knowledge-base mining.
  if (typeof body?.prompt === 'string') {
    const lastLine = body.prompt.split('\n').filter((l) => l.startsWith('User:')).pop();
    if (lastLine) {
      const q = lastLine.replace(/^User:\s*/, '').trim().slice(0, 500);
      logUserQuestion(q, body.lang || 'ar', null);
    }
  }

  const cachedReply = await getCachedReply(body.prompt, body.lang || 'ar');
  if (cachedReply) {
    sendJson(response, 200, { success: true, reply: cachedReply }, origin);
    return;
  }

  try {
    const promptLen = (body.prompt || '').length;
    logger.info(`[ai-chat] prompt length: ${promptLen} chars`);
    const result = await generateAiReply(body);
    if (result?.reply) await setCachedReply(body.prompt, body.lang || 'ar', result.reply);
    sendJson(response, 200, result, origin);
  } catch (aiErr) {
    logger.error('[ai-chat] generateAiReply failed:', aiErr.message || aiErr);
    sendJson(
      response,
      aiErr.statusCode || 503,
      { success: false, error: 'AI service temporarily unavailable. Please try again.' },
      origin,
    );
  }
};

/**
 * POST /api/chat/log
 * Rate limit: 20 req/min per IP. Delegates the actual persistence to
 * `public-data.handleChatLog` so the on-disk schema / storage choice stays
 * co-located with the rest of the public-data handlers.
 */
export const handleChatLogRoute = async (request, response, ctx) => {
  const clientIp = getClientIp(request);
  if (await isChatLogRateLimited(clientIp)) {
    sendJson(response, 429, { success: false, error: 'Too many requests.' }, ctx.origin);
    return;
  }

  const body = await readRequestBody(request);
  if (typeof body?.userId !== 'string' || !body.userId.trim() || body.userId.length > 128) {
    sendJson(response, 400, { success: false, error: 'Invalid userId.' }, ctx.origin);
    return;
  }

  await handleChatLogLegacy(request, response, { ...ctx, body });
};
