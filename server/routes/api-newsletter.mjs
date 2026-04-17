import { readRequestBody } from '../middlewares/bodyParser.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { getClientIp, isNewsletterSubRateLimited, isUnsubRateLimited } from '../middlewares/security.mjs';
import { subscribeNewsletter, unsubscribeBySubscriberKey } from '../services/newsletter.mjs';
import { verifyUnsubscribeToken } from '../newsletterTokens.mjs';
import { logger } from '../utils/logger.mjs';

/**
 * POST /api/newsletter/subscribe
 * Rate limit: 3 req/hr per IP. Returns only sanitized fields — never raw
 * transport IDs or upstream email-provider errors.
 */
export const handleNewsletterSubscribe = async (request, response, { origin }) => {
  const clientIp = getClientIp(request);
  if (await isNewsletterSubRateLimited(clientIp)) {
    sendJson(
      response,
      429,
      { success: false, error: 'Too many subscription attempts. Please try again later.' },
      origin,
    );
    return;
  }

  const body = await readRequestBody(request);
  try {
    const result = await subscribeNewsletter(body);
    const safeResult = {
      success: !!result?.success,
      alreadySubscribed: !!result?.alreadySubscribed,
      welcomeEmail: result?.welcomeEmail ? { sent: !!result.welcomeEmail.sent } : null,
    };
    sendJson(response, 200, safeResult, origin);
  } catch (e) {
    logger.warn('[newsletter] subscribe failed:', e?.message);
    sendJson(
      response,
      400,
      { success: false, error: 'Unable to subscribe. Please check your email and try again.' },
      origin,
    );
  }
};

/**
 * POST /api/newsletter/unsubscribe
 * Rate limit: 10 req / 5-minute window per IP. Verifies the HMAC token then
 * flips the `active` flag on the matching subscriber row.
 */
export const handleNewsletterUnsubscribe = async (request, response, { origin }) => {
  const clientIp = getClientIp(request);
  if (await isUnsubRateLimited(clientIp)) {
    sendJson(
      response,
      429,
      { success: false, error: 'Too many requests. Please try again later.' },
      origin,
    );
    return;
  }

  const body = await readRequestBody(request);
  const tokenPayload = verifyUnsubscribeToken(body?.token);
  if (!tokenPayload) {
    sendJson(response, 400, { success: false, error: 'Invalid or expired unsubscribe token.' }, origin);
    return;
  }

  try {
    const result = unsubscribeBySubscriberKey(tokenPayload.subscriberKey);
    if (result.status === 'not_found') {
      sendJson(response, 404, { success: false, error: 'Unsubscribe target not found.' }, origin);
      return;
    }
    if (result.status === 'already_unsubscribed') {
      sendJson(response, 200, { success: true, alreadyUnsubscribed: true }, origin);
      return;
    }
    logger.info('[newsletter] Unsubscribed via opaque token:', tokenPayload.subscriberKey.slice(0, 8));
    sendJson(response, 200, { success: true }, origin);
  } catch (e) {
    logger.error('[newsletter] Unsubscribe error:', e.message);
    sendJson(response, 500, { success: false, error: 'Server error.' }, origin);
  }
};
