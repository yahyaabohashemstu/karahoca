#!/usr/bin/env node
/**
 * Build-time precompression of static assets.
 *
 * Why precompress instead of letting nginx compress on the fly
 * ────────────────────────────────────────────────────────────
 * Per-request compression (`gzip on; brotli on;`) burns CPU on every hit.
 * For static assets that never change between requests, the *same* file
 * gets re-compressed by every CPU core handling traffic — pure waste.
 *
 * The fix is to compress ONCE here and let nginx serve the
 * pre-compressed sibling via `gzip_static on; brotli_static on;`. nginx
 * picks the best variant the client accepts (Brotli > gzip > raw) by
 * inspecting `Accept-Encoding` and serves the matching `.br` or `.gz`
 * file directly off disk — zero compression CPU at request time.
 *
 * This also lets us crank compression levels far above what's safe
 * per-request:
 *   • Brotli quality 11 (max) — ~15% smaller than quality 5, but ~30×
 *                                slower. Fine here because we only run it
 *                                during the build.
 *   • Gzip level 9 — ~3% smaller than level 6, ~2× slower. Same logic.
 *
 * What gets compressed
 * ────────────────────
 * Only types where compression actually helps. Skipped:
 *   • Already-compressed formats (webp, png, jpg, gif, ico, woff, woff2,
 *     mp3, mp4, pdf) — Brotli wastes cycles re-compressing entropy-heavy
 *     binaries; the result is often LARGER than the original.
 *   • Tiny files (< 256 B). Compression overhead dominates the saving.
 *
 * Reversibility
 * ─────────────
 * Pure additive — original files are not modified. Removing the script
 * from the build chain (or running `find dist -name "*.br" -delete &&
 * find dist -name "*.gz" -delete`) restores the previous state.
 *
 * nginx must be configured with `gzip_static on; brotli_static on;`. If
 * the brotli module isn't loaded, nginx will silently ignore
 * `brotli_static on` and fall back to gzip — no breakage, just less
 * compression for Brotli-capable clients.
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createBrotliCompress, createGzip, constants as zlibConstants } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

// File extensions worth compressing. Match against the LAST extension only
// so `app.bundle.js` matches and `image.png.webp` doesn't (last ext = webp).
const COMPRESSIBLE_EXTS = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml',
  '.webmanifest', '.map', '.wasm',
]);

// Skip files smaller than this — compression overhead dominates.
const MIN_SIZE = 256;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const formatBytes = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      // Don't re-compress already-compressed siblings.
      if (entry.name.endsWith('.gz') || entry.name.endsWith('.br')) continue;
      files.push(full);
    }
  }
  return files;
}

async function compressGzip(srcPath, destPath) {
  const buf = await readFile(srcPath);
  const gzip = createGzip({
    level: 9, // max — fine here, runs once at build time
    memLevel: 9,
  });
  await pipeline(Readable.from(buf), gzip, createWriteStream(destPath));
}

async function compressBrotli(srcPath, destPath) {
  const buf = await readFile(srcPath);
  const isText = COMPRESSIBLE_EXTS.has(path.extname(srcPath).toLowerCase());
  const brotli = createBrotliCompress({
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11, // max
      [zlibConstants.BROTLI_PARAM_MODE]:
        isText ? zlibConstants.BROTLI_MODE_TEXT : zlibConstants.BROTLI_MODE_GENERIC,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  });
  await pipeline(Readable.from(buf), brotli, createWriteStream(destPath));
}

async function main() {
  let originalCount = 0;
  let totalOriginal = 0;
  let totalGz = 0;
  let totalBr = 0;
  let skippedSmall = 0;
  let skippedExt = 0;

  const allFiles = await walk(DIST_DIR);

  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    if (!COMPRESSIBLE_EXTS.has(ext)) {
      skippedExt++;
      continue;
    }
    const st = await stat(file);
    if (st.size < MIN_SIZE) {
      skippedSmall++;
      continue;
    }

    originalCount++;
    totalOriginal += st.size;

    const gzPath = `${file}.gz`;
    const brPath = `${file}.br`;

    if (DRY_RUN) continue;

    // Run gzip + brotli in parallel — they're CPU-bound but separate.
    await Promise.all([compressGzip(file, gzPath), compressBrotli(file, brPath)]);

    const gzStat = await stat(gzPath);
    const brStat = await stat(brPath);
    totalGz += gzStat.size;
    totalBr += brStat.size;

    // Sanity: if compressed > original, the static directive will still
    // serve the smaller original. But we don't want to ship pure cruft —
    // delete a compressed sibling that grew.
    if (gzStat.size >= st.size) {
      await import('node:fs/promises').then((fs) => fs.unlink(gzPath));
    }
    if (brStat.size >= st.size) {
      await import('node:fs/promises').then((fs) => fs.unlink(brPath));
    }
  }

  console.log('─'.repeat(60));
  console.log(`[compress] processed: ${originalCount} files`);
  console.log(`[compress] skipped:   ${skippedSmall} (too small) + ${skippedExt} (binary)`);
  console.log(`[compress] original:  ${formatBytes(totalOriginal)}`);
  if (!DRY_RUN) {
    console.log(`[compress] gzip:      ${formatBytes(totalGz)}  (${((1 - totalGz / totalOriginal) * 100).toFixed(1)}% smaller)`);
    console.log(`[compress] brotli:    ${formatBytes(totalBr)}  (${((1 - totalBr / totalOriginal) * 100).toFixed(1)}% smaller)`);
    console.log(`[compress] brotli vs gzip:  ${(((totalGz - totalBr) / totalGz) * 100).toFixed(1)}% additional saving`);
  }
}

main().catch((err) => {
  console.error('[compress] FAILED:', err);
  process.exit(1);
});
