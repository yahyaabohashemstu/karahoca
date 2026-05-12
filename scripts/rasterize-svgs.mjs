#!/usr/bin/env node
/**
 * One-off raster pipeline for the giant illustrative SVGs.
 *
 * Why this exists
 * ───────────────
 * `public/employees.svg` (1.9 MB, 4,816 paths) and `public/employees2.svg`
 * (485 KB) are Adobe-Illustrator exports of complex compositions. They
 * render inside a 260×320 px container (`.animation-container` in
 * `src/styles/employee.css`) — orders of magnitude smaller than the SVG's
 * intrinsic 2241-px viewBox width. Browsers still pay to:
 *   • parse the entire SVG DOM (~12 MB heap for employees.svg)
 *   • build a render tree of thousands of nodes
 *   • compute layout & paint each animation frame
 *
 * Rasterising at *display size × 2 (Retina)* shrinks the file by ~95% and
 * eliminates the parse/render tax entirely — the browser just blits a
 * pixel buffer.
 *
 * Reversibility
 * ─────────────
 * Originals are preserved at `public/.backup-svgs/*.svg`. The on-disk
 * `public/employees.svg` is NOT touched; we add a sibling `.webp`. If a
 * regression appears, swapping the React `<img src>` back to the SVG path
 * is a one-line revert.
 *
 * Each SVG gets two outputs:
 *   • `<name>.webp`     — 1x raster for non-Retina screens
 *   • `<name>@2x.webp`  — 2x raster for Retina; consumed via srcset
 *
 * Usage:  node scripts/rasterize-svgs.mjs
 * Flags:  --quality N  (default 80)  — lower = smaller file, more artefacts
 *         --dry-run                  — print plan without writing
 */

import sharp from 'sharp';
import { stat, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const BACKUP_DIR = path.join(PUBLIC_DIR, '.backup-svgs');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const qIdx = args.indexOf('--quality');
const QUALITY = qIdx !== -1 ? Number(args[qIdx + 1]) : 80;

/**
 * What to convert. Each entry:
 *   src      — source SVG (relative to public/)
 *   width1x  — CSS-pixel width the SVG occupies on screen at 1x DPR
 *
 * The 1x render width is chosen to match the largest container the image
 * appears in across all breakpoints. The 2x render is exactly double that.
 *
 * For the employees filmstrips: container is `.animation-container`
 *   = 260×320 px. The SVG is `object-fit: contain` and has aspect 0.23
 *   (extremely tall), so width is the bound — not height. We render at
 *   600 px wide @1x to leave headroom for any future container resize,
 *   and 1200 px @2x for Retina.
 */
const TARGETS = [
  { src: 'employees.svg',  width1x: 600 },
  // employees2.svg + products.svg verified unused across the entire repo
  // (grep -r returned only this script). Leaving them on disk for now in
  // case future content surfaces them; not generating raster siblings.
];

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Render an SVG at the requested CSS width × DPR scale, output WebP.
 * `density` controls the rasterisation resolution Sharp asks the SVG
 * renderer for. We compute it so the resulting raster lands at exactly
 * `width × scale` pixels regardless of the SVG's intrinsic dimensions.
 */
async function rasterise(srcAbs, destAbs, cssWidth, scale) {
  const svg = await readFile(srcAbs);

  // Sharp's SVG renderer (librsvg) treats `density` as DPI relative to
  // the SVG's intrinsic size. We need to learn the intrinsic width first,
  // then pick a density that scales it to `cssWidth × scale` output px.
  const meta = await sharp(svg).metadata();
  const intrinsicWidth = meta.width || cssWidth;
  const targetPx = cssWidth * scale;
  const density = Math.round((targetPx / intrinsicWidth) * 72);

  await sharp(svg, { density })
    .resize({ width: targetPx, withoutEnlargement: false })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(destAbs);
}

async function main() {
  // Confirm backups exist — we refuse to run if originals aren't preserved.
  try {
    await stat(BACKUP_DIR);
  } catch {
    console.error(`✘ Backup directory missing: ${BACKUP_DIR}`);
    console.error('  Run:  cp public/employees*.svg public/world-map.svg public/.backup-svgs/');
    process.exit(1);
  }

  console.log(`[rasterize] quality=${QUALITY} dry-run=${DRY_RUN}`);
  console.log('');

  let totalBefore = 0;
  let totalAfter = 0;

  for (const target of TARGETS) {
    const srcAbs = path.join(PUBLIC_DIR, target.src);
    const baseName = path.basename(target.src, '.svg');
    const dest1x = path.join(PUBLIC_DIR, `${baseName}.webp`);
    const dest2x = path.join(PUBLIC_DIR, `${baseName}@2x.webp`);

    const srcStat = await stat(srcAbs);
    totalBefore += srcStat.size;

    if (DRY_RUN) {
      console.log(`[plan] ${target.src} (${formatBytes(srcStat.size)})`);
      console.log(`        → ${baseName}.webp     (${target.width1x}px)`);
      console.log(`        → ${baseName}@2x.webp  (${target.width1x * 2}px)`);
      continue;
    }

    console.log(`[convert] ${target.src} (${formatBytes(srcStat.size)})`);

    await rasterise(srcAbs, dest1x, target.width1x, 1);
    const s1 = await stat(dest1x);
    console.log(`           → ${baseName}.webp     ${formatBytes(s1.size)} (${target.width1x}px wide)`);
    totalAfter += s1.size;

    await rasterise(srcAbs, dest2x, target.width1x, 2);
    const s2 = await stat(dest2x);
    console.log(`           → ${baseName}@2x.webp  ${formatBytes(s2.size)} (${target.width1x * 2}px wide)`);
    totalAfter += s2.size;

    const reduction = ((1 - (s1.size + s2.size) / srcStat.size) * 100).toFixed(1);
    console.log(`           = ${reduction}% smaller (1x+2x combined vs original SVG)`);
    console.log('');
  }

  if (!DRY_RUN) {
    console.log('─'.repeat(60));
    console.log(`Total before: ${formatBytes(totalBefore)}`);
    console.log(`Total after:  ${formatBytes(totalAfter)}`);
    const totalReduction = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
    console.log(`Saved:        ${formatBytes(totalBefore - totalAfter)} (${totalReduction}%)`);
  }
}

main().catch((err) => {
  console.error('[rasterize] FAILED:', err);
  process.exit(1);
});
