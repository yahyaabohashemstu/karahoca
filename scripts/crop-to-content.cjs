/**
 * crop-to-content.cjs
 *
 * Crops every PNG/WebP product image to the tight bounding-box of its
 * non-transparent pixels (alpha > 20), eliminating blank canvas padding.
 * Overwrites originals in-place.
 *
 * Run from project root:
 *   node scripts/crop-to-content.cjs [--dry]
 *
 * --dry   Preview what would be done without touching any file.
 */

'use strict';

// Resolve sharp from whichever node_modules has it
let sharp;
try {
  sharp = require('sharp');
} catch {
  // Try sibling node_modules locations
  const paths = [
    '../node_modules/sharp',
    '../../node_modules/sharp',
    '../.claude/worktrees/lucid-carson/node_modules/sharp',
  ];
  for (const p of paths) {
    try { sharp = require(require('path').resolve(__dirname, p)); break; } catch {}
  }
}
if (!sharp) { console.error('sharp not found'); process.exit(1); }

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..', 'public');
const DRY     = process.argv.includes('--dry');
const ALPHA   = 20;   // pixels with alpha ≤ this count as transparent
const EXTS    = new Set(['.png', '.webp']);

const TARGET_DIRS = [
  path.join(ROOT, 'diox-images'),
  path.join(ROOT, 'aylux-images'),
];

// ── helpers ──────────────────────────────────────────────────────────────────

function collectImages(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      out.push(...collectImages(full));
    } else if (EXTS.has(path.extname(entry).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function findBounds(data, width, height, ch) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = ch >= 4 ? data[(y * width + x) * ch + 3] : 255;
      if (a > ALPHA) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

async function cropFile(filePath) {
  const meta = await sharp(filePath).metadata();
  if (!meta.hasAlpha) return { status: 'skip-no-alpha' };

  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const { minX, minY, maxX, maxY } = findBounds(data, info.width, info.height, info.channels);

  if (maxX < minX || maxY < minY) return { status: 'skip-empty' };

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const pctSaved = ((1 - (cropW * cropH) / (meta.width * meta.height)) * 100).toFixed(1);

  if (parseFloat(pctSaved) < 0.5) return { status: 'skip-tight', pctSaved };

  if (DRY) return {
    status: 'would-crop',
    from: `${meta.width}x${meta.height}`,
    to: `${cropW}x${cropH}`,
    pctSaved,
  };

  const tmp = filePath + '.__tmp';
  await sharp(filePath)
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png()
    .toFile(tmp);

  fs.renameSync(tmp, filePath);

  return {
    status: 'cropped',
    from: `${meta.width}x${meta.height}`,
    to: `${cropW}x${cropH}`,
    pctSaved,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n✂  crop-to-content' + (DRY ? ' [DRY RUN — no files touched]' : '') + '\n');

  let total = 0, cropped = 0, skipped = 0, errors = 0;

  for (const dir of TARGET_DIRS) {
    const images = collectImages(dir);
    if (!images.length) { console.log(`  (empty or missing: ${dir})\n`); continue; }

    console.log(`📂  ${path.relative(ROOT, dir)}  (${images.length} images)\n`);

    for (const img of images) {
      total++;
      const rel = path.relative(ROOT, img);
      try {
        const r = await cropFile(img);
        if (r.status === 'cropped' || r.status === 'would-crop') {
          cropped++;
          console.log(`  ✂  ${rel}`);
          console.log(`     ${r.from} → ${r.to}  (saves ${r.pctSaved}%)`);
        } else {
          skipped++;
          if (process.env.VERBOSE) console.log(`  –  ${rel}  [${r.status}]`);
        }
      } catch (e) {
        errors++;
        console.error(`  ✗  ${rel}  ERROR: ${e.message}`);
      }
    }
    console.log();
  }

  console.log('─'.repeat(58));
  console.log(
    `Total: ${total}  |  ` +
    (DRY ? `Would crop: ${cropped}` : `Cropped: ${cropped}`) +
    `  |  Skipped: ${skipped}  |  Errors: ${errors}\n`
  );
})();
