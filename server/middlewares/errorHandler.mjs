import { sendJson } from './cors.mjs';
import { getLogger, getReqId } from './requestContext.mjs';

/**
 * Central error handler. Logs full context via Pino (with the request's
 * reqId auto-attached by the child logger), forwards to Sentry if the DSN
 * is configured, and returns a sanitized JSON response so we never leak
 * stack traces or driver-level messages to the client.
 *
 * 4xx responses may carry the original `error.message` (those are intended
 * for the caller — e.g. "Invalid email address."). 5xx responses always
 * return a stable generic string. The response also echoes `X-Request-Id`
 * (set by requestContext) so a user's bug report directly maps to log lines.
 */
export const handleServerError = (request, response, error, requestOrigin) => {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const log = getLogger();
  const reqId = getReqId();

  log.error(
    {
      err: error,
      url: request.url,
      method: request.method,
      statusCode,
    },
    '[server] unhandled error',
  );

  // Fire-and-forget to Sentry if it's wired up. We attach the reqId as a
  // tag so the Sentry issue can be cross-referenced with our server logs.
  const sentry = globalThis.__karahocaSentry;
  if (sentry && typeof sentry.captureException === 'function') {
    try {
      sentry.captureException(error, {
        tags: {
          reqId: reqId || 'unknown',
          url: request.url,
          method: request.method,
          statusCode: String(statusCode),
        },
      });
    } catch {
      /* never let telemetry failures derail the response */
    }
  }

  const safeMessage =
    statusCode >= 400 &&
    statusCode < 500 &&
    error instanceof Error &&
    typeof error.message === 'string'
      ? error.message
      : 'Server error. Please try again later.';

  sendJson(response, statusCode, { success: false, error: safeMessage }, requestOrigin);
};
