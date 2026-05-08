/**
 * Static-asset MIME table used by `/api/uploads/:fileName` (the only static
 * file route the backend still serves now that the SPA is shipped by a
 * separate nginx image — see `web/Dockerfile`).
 */
export const STATIC_MIME = Object.freeze({
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
});
