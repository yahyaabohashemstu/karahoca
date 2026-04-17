import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRequestBody } from '../middlewares/bodyParser.mjs';
import { sendJson } from '../middlewares/cors.mjs';
import { getClientIp, isLogErrorRateLimited } from '../middlewares/security.mjs';
import { STATIC_MIME } from './static-spa.mjs';
import { handleEmailOpen, handleEmailClick } from './admin-campaigns.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// routes/ sits under server/, so uploads live at `../data/uploads`.
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');

/**
 * POST /api/log-error
 * Rate limit: 10 req/min per IP. Always responds 200 — we silently drop when
 * limited because a failing client retrying on its own error reports would
 * otherwise amplify the problem.
 */
export const handleLogError = async (request, response, { origin }) => {
  const clientIp = getClientIp(request);
  if (await isLogErrorRateLimited(clientIp)) {
    sendJson(response, 200, { success: true }, origin);
    return;
  }

  const body = await readRequestBody(request);
  if (body?.message && typeof body.message === 'string') {
    console.error('[client-error]', JSON.stringify({
      message: String(body.message).slice(0, 300),
      stack: typeof body.stack === 'string' ? body.stack.slice(0, 500) : undefined,
      url: typeof body.url === 'string' ? body.url.slice(0, 200) : undefined,
      ts: body.ts,
    }));
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
