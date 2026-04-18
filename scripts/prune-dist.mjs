#!/usr/bin/env node
/**
 * Post-build dist/ pruner.
 *
 * Vite copies the entire `public/` tree to `dist/` wholesale. That ships
 * everything — including:
 *   - PNG originals that already have WebP siblings (duplicate bandwidth)
 *   - Source map files (`*.map`) for shipped libraries (debug info that
 *     should never reach production)
 *   - Stray .psd files (defensive — should not be in repo, but check)
 *
 * This script removes those FROM `dist/` ONLY. The originals in `public/`
 * are untouched, honouring the standing rule "never delete original PNGs
 * from the source tree". Each deploy gets a fresh `dist/` from the build,
 * so this prune is non-destructive at the source level.
 *
 * Runs after `vite build` in the `npm run build` chain. Idempotent —
 * re-running on an already-pruned tree is a no-op.
 *
 * What it KEEPS:
 *   - PNGs without a WebP sibling (genuine fallbacks for ancient browsers
 *     OR images we haven't generated WebP for yet)
 *   - All WebP / JPEG / SVG / GIF / ICO files
 *   - Catalog PDFs (functional content; flip to CDN via VITE_CATALOG_BASE_URL
 *     if you want them off the SPA origin)
 *   - All JS / CSS / fonts (Vite's assets/ tree)
 *
 * What it REMOVES:
 *   - `*.png` IFF a same-name `.webp` exists in the same directory
 *   - `*.map` files (source maps)
 *   - `*.psd` files (any stray Photoshop sources)
 */

import { readdir, stat, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Walk a directory recursively, returning every file path.
 */
const walk = async (dir) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const entry of entries) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(fp)));
    } else if (entry.isFile()) {
      out.push(fp);
    }
  }
  return out;
};

/**
 * Collect every internal asset reference from the built JS / CSS / HTML
 * so we never delete a file that the bundle still needs to load. Looks
 * for `/whatever.png`, `/whatever.webp`, etc. in any built artifact.
 *
 * Returns a Set of absolute /-prefixed paths (e.g. '/logos/foo.png').
 */
const collectReferencedAssets = async () => {
  const referenced = new Set();
  // Source files we scan: assets/* (JS/CSS), HTML at root + per-language.
  const candidates = await walk(distDir);
  const text = candidates.filter((fp) =>
    /\.(js|mjs|css|html)$/i.test(fp),
  );

  // Loose match — captures any /-prefixed path reference. Image-like
  // extensions only; we're not trying to track every asset, just enough
  // to be safe about pruning.
  const pathRe = /["'`(]\s*(\/[A-Za-z0-9._\-/%~]+\.(?:png|jpe?g|webp|gif|svg|pdf|ico))["'`)]/g;

  for (const fp of text) {
    let body;
    try { body = await readFile(fp, 'utf8'); }
    catch { continue; }
    let m;
    while ((m = pathRe.exec(body)) !== null) {
      // Decode percent-encoded paths (Arabic file names are URL-encoded
      // when emitted into JS string literals).
      try {
        referenced.add(decodeURIComponent(m[1]));
      } catch {
        referenced.add(m[1]);
      }
    }
  }
  return referenced;
};

const main = async () => {
  console.log('');
  console.log('━'.repeat(60));
  console.log('  dist/ pruner — removing redundant assets');
  console.log('━'.repeat(60));

  const allFiles = await walk(distDir);
  if (allFiles.length === 0) {
    console.log('  dist/ is empty or missing — nothing to prune.');
    return;
  }

  const referenced = await collectReferencedAssets();
  console.log(`  Indexed ${referenced.size} asset references from JS/CSS/HTML.`);

  let removedCount = 0;
  let savedBytes = 0;
  const removedReasons = { 'png-with-webp': 0, 'source-map': 0, 'psd': 0 };

  // Build a fast set of WebP basenames per directory.
  const webpByDir = new Map();
  for (const fp of allFiles) {
    if (!fp.toLowerCase().endsWith('.webp')) continue;
    const dir = path.dirname(fp);
    const base = path.basename(fp, '.webp');
    if (!webpByDir.has(dir)) webpByDir.set(dir, new Set());
    webpByDir.get(dir).add(base);
  }

  for (const fp of allFiles) {
    const lower = fp.toLowerCase();
    let reason = null;

    if (lower.endsWith('.map')) {
      reason = 'source-map';
    } else if (lower.endsWith('.psd')) {
      reason = 'psd';
    } else if (lower.endsWith('.png')) {
      const dir = path.dirname(fp);
      const base = path.basename(fp, '.png');
      const hasWebpSibling = webpByDir.get(dir)?.has(base);
      if (hasWebpSibling) {
        // Safety net — only prune the PNG if NOTHING in the bundle
        // references it directly. ImageWithFallback's `fallbackSrc` would
        // be a reference; if the caller hard-coded a .png path the bundle
        // will contain it and we keep the file.
        const relativePath = '/' + path.relative(distDir, fp).replace(/\\/g, '/');
        if (!referenced.has(relativePath)) {
          reason = 'png-with-webp';
        }
      }
    }

    if (!reason) continue;

    try {
      const s = await stat(fp);
      await unlink(fp);
      removedCount += 1;
      savedBytes += s.size;
      removedReasons[reason] += 1;
    } catch (err) {
      console.warn(`  [warn] could not remove ${fp}: ${err.message}`);
    }
  }

  console.log('');
  console.log(`  Removed: ${removedCount} files (${formatBytes(savedBytes)} saved)`);
  console.log(`    PNGs with WebP siblings: ${removedReasons['png-with-webp']}`);
  console.log(`    Source maps:             ${removedReasons['source-map']}`);
  console.log(`    Stray PSDs:              ${removedReasons['psd']}`);
  console.log('━'.repeat(60));
  console.log('');
};

main().catch((err) => {
  console.error('[prune-dist] fatal:', err);
  // Don't fail the build over a prune problem — the dist/ is still
  // shippable, just larger than ideal. Log + exit 0.
  process.exit(0);
});
