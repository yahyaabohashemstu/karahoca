/**
 * crop-to-content.mjs
 *
 * Scans every PNG/WebP product image and crops it to the tight bounding-box
 * of its non-transparent pixels (alpha > 20).  Overwrites originals in-place.
 *
 * Usage:
 *   node scripts/crop-to-content.mjs [--dir <relative-public-path>] [--dry]
 *
 * Defaults to processing both:
 *   public/diox-images   (including subfolders)
 *   public/aylux-images  (including subfolders)
 *
 * Flags:
 *   --dry    Print what would be done without touching any file.
 */

import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'public');

const args = process.argv.slice(2);
const DRY  = args.includes('--dry');
const dirArg = args.indexOf('--dir') !== -1 ? args[args.indexOf('--dir') + 1] : null;

const TARGET_DIRS = dirArg
  ? [path.join(ROOT, dirArg)]
  : [
      path.join(ROOT, 'diox-images'),
      path.join(ROOT, 'aylux-images'),
    ];

const ALPHA_THRESHOLD = 20;   // pixels with alpha ≤ this are treated as empty
const EXTS = new Set(['.png', '.webp']);

// ── helpers ──────────────────────────────────────────────────────────────────

/** Recursively collect all image files under a directory. */
async function collectImages(dir) {
  const files = [];
  if (!existsSync(dir)) return files;

  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) {
      files.push(...await collectImages(full));
    } else if (EXTS.has(path.extname(entry).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

/** Find the bounding-box of non-transparent pixels using raw RGBA data. */
function findContentBounds(data, width, height, channels) {
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // If the image has no alpha channel every pixel is "content"
      const alpha = channels >= 4 ? data[(y * width + x) * channels + 3] : 255;
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

/** Crop one file in-place.  Returns a result object for the summary. */
async function cropFile(filePath) {
  const meta = await sharp(filePath).metadata();
  const { width, height, channels, hasAlpha, format } = meta;

  // If there's no alpha channel there's nothing transparent to trim
  if (!hasAlpha) {
    return { file: filePath, status: 'skip-no-alpha', width, height };
  }

  // Read raw pixel data
  const { data, info } = await sharp(filePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { minX, minY, maxX, maxY } = findContentBounds(
    data, info.width, info.height, info.channels
  );

  if (maxX < minX || maxY < minY) {
    return { file: filePath, status: 'skip-empty', width, height };
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const origPx  = width * height;
  const cropPx  = cropW * cropH;
  const reduction = ((1 - cropPx / origPx) * 100).toFixed(1);

  // Nothing meaningful to gain → skip
  if (parseFloat(reduction) < 1) {
    return { file: filePath, status: 'skip-already-tight', width, height, reduction };
  }

  if (DRY) {
    return {
      file: filePath, status: 'would-crop',
      from: `${width}x${height}`, to: `${cropW}x${cropH}`, reduction,
    };
  }

  // Write to a temp file first so we never corrupt the original
  const tmp = filePath + '.__crop_tmp';
  await sharp(filePath)
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()           // always output PNG to preserve transparency
    .toFile(tmp);

  await rename(tmp, filePath);

  return {
    file: filePath, status: 'cropped',
    from: `${width}x${height}`, to: `${cropW}x${cropH}`, reduction,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n🔍  crop-to-content' + (DRY ? ' [DRY RUN]' : '') + '\n');

  let total = 0, cropped = 0, skipped = 0, errors = 0;

  for (const dir of TARGET_DIRS) {
    const images = await collectImages(dir);
    if (images.length === 0) {
      console.log(`  (no images found in ${dir})\n`);
      continue;
    }

    console.log(`📂  ${path.relative(ROOT, dir)}  (${images.length} images)\n`);

    for (const img of images) {
      total++;
      const rel = path.relative(ROOT, img);
      try {
        const r = await cropFile(img);
        if (r.status === 'cropped' || r.status === 'would-crop') {
          cropped++;
          const arrow = r.status === 'would-crop' ? '→ (dry)' : '→';
          console.log(`  ✂  ${rel}`);
          console.log(`     ${r.from} ${arrow} ${r.to}  (–${r.reduction}%)`);
        } else {
          skipped++;
          console.log(`  –  ${rel}  [${r.status}]`);
        }
      } catch (err) {
        errors++;
        console.error(`  ✗  ${rel}  ERROR: ${err.message}`);
      }
    }
    console.log();
  }

  console.log('─'.repeat(60));
  console.log(
    `Done.  ${total} total  |  ${cropped} ${DRY ? 'would be cropped' : 'cropped'}` +
    `  |  ${skipped} skipped  |  ${errors} errors\n`
  );
})();
