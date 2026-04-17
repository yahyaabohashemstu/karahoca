import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRequestBody } from '../middlewares/bodyParser.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { getClientIp, isLogErrorRateLimited } from '../middlewares/security.mjs';
import { STATIC_MIME } from './static-spa.mjs';
import { handleEmailOpen, handleEmailClick } from './admin-campaigns.mjs';
import { logger } from '../utils/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// routes/ sits under server/, so uploads live at `../data/uploads`.
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');

const MAX_STR = (s, n) => (typeof s === 'string' ? s.slice(0, n) : undefined);

/**
 * POST /api/log-error
 * Rate limit: 10 req/min per IP. Always responds 200 — we silently drop when
 * limited because a failing client retrying on its own error reports would
 * otherwise amplify the problem.
 *
 * Accepts (all optional):
 *   - message        (string, required for a log line to be emitted)
 *   - stack          (string, truncated to 500 chars)
 *   - url            (string, truncated to 200 chars)
 *   - componentStack (string, truncated to 500 chars — React-specific)
 *   - ts             (number | string, client timestamp)
 *   - sessionId      (string, UUID generated once per browser tab/session)
 *   - clientReqId    (string, the X-Request-Id of the API call that failed,
 *                     if the error originated from a fetch)
 *
 * All client-supplied strings are truncated before logging so a crash-loop
 * flood cannot blow up disk / log storage.
 */
export const handleLogError = async (request, response, { origin }) => {
  const clientIp = getClientIp(request);
  if (await isLogErrorRateLimited(clientIp)) {
    sendJson(response, 200, { success: true }, origin);
    return;
  }

  const body = await readRequestBody(request);
  if (body?.message && typeof body.message === 'string') {
    // Pino gets structured fields — downstream log pipelines can filter
    // by sessionId / clientReqId without regex on the message string.
    // `request.reqId` (set by requestContext middleware) is bound to the
    // child logger automatically.
    logger.error(
      {
        clientError: {
          message: MAX_STR(body.message, 300),
          stack: MAX_STR(body.stack, 500),
          componentStack: MAX_STR(body.componentStack, 500),
          url: MAX_STR(body.url, 200),
          sessionId: MAX_STR(body.sessionId, 64),
          // The request id that the FAILED fetch carried — lets us join a
          // client-side error to the exact server log entry of the failure.
          clientReqId: MAX_STR(body.clientReqId, 128),
          ts: body.ts,
        },
      },
      '[client-error]',
    );
  }

  sendJson(response, 200, { success: true }, origin);
};

/**
 * GET /api/uploads/:fileName
 * Serves admin-uploaded image assets. No auth — these are intentionally
 * publicly reachable (used by email clients etc).
 */
export const handleUpload = async (request, response, { origin, url }) => {
  const fileName = path.basename(url.replace('/api/uploads/', ''));
  const filePath = path.join(uploadsDir, fileName);
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
    sendJson(response, 404, { error: 'Not found' }, origin);
  }
};

// Re-export the email tracking handlers from their existing home so the
// main router can import all public endpoints from a single routes file.
export { handleEmailOpen, handleEmailClick };
