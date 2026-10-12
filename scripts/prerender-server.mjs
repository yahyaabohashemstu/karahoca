import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Minimal static file server used ONLY by scripts/prerender.mjs. Serves the
 * given root directory, falls back to a provided HTML shell on unmatched
 * paths (so React Router client routes resolve).
 *
 * The shell is passed in explicitly (the blank `dist/index.html`, read once
 * at start) so routes are always rendered from scratch, never from a
 * snapshot written earlier in the run or by a previous one.
 */
const MIME = {
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
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.pdf':  'application/pdf',
  '.xml':  'application/xml',
  '.webmanifest': 'application/manifest+json',
};

export const startPrerenderServer = ({ rootDir: rootArg, shellHtml, port = 0 }) =>
  new Promise((resolve) => {
    // Absolute + platform separators, so the escape check below compares like
    // with like (a forward-slash path on Windows failed it: every page 403).
    const rootDir = path.resolve(rootArg);
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
        const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        const resolved = path.join(rootDir, safePath);

        // Reject anything that escaped the root.
        if (!resolved.startsWith(rootDir)) {
          res.writeHead(403).end('Forbidden');
          return;
        }

        // 1. Exact file hit?
        try {
          const s = await stat(resolved);
          if (s.isFile()) {
            const ext = path.extname(resolved).toLowerCase();
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            createReadStream(resolved).pipe(res);
            return;
          }
          // Directories (= routes) always get the blank shell below, never a
          // snapshot already written to dist/<route>/index.html: every page
          // must render from scratch, exactly as a first visit would.
        } catch {
          /* fall through to SPA shell */
        }

        // 2. SPA fallback — serve the pristine shell (NOT any prerendered
        //    content we may have written this run).
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(shellHtml);
      } catch (err) {
        res.writeHead(500).end(String(err?.message || err));
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const { port: actualPort } = server.address();
      resolve({
        origin: `http://127.0.0.1:${actualPort}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
