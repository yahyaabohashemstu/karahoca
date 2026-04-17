import { sendJson } from './cors.mjs';

/**
 * Central error handler. Logs full context server-side; returns a sanitized
 * JSON response so we never leak stack traces or driver-level messages to
 * the client.
 *
 * 4xx responses may carry the original `error.message` (those are intended
 * for the caller — e.g. "Invalid email address."). 5xx responses always
 * return a stable generic string.
 */
export const handleServerError = (request, response, error, requestOrigin) => {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;

  console.error('[server] unhandled error:', {
    url: request.url,
    method: request.method,
    statusCode,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  const safeMessage =
    statusCode >= 400 &&
    statusCode < 500 &&
    error instanceof Error &&
    typeof error.message === 'string'
      ? error.message
      : 'Server error. Please try again later.';

  sendJson(response, statusCode, { success: false, error: safeMessage }, requestOrigin);
};
