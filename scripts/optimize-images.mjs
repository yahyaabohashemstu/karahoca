/**
 * NON-DESTRUCTIVE Image Optimization Pipeline
 * =============================================
 * Converts PNG/JPG images to optimized WebP alongside originals.
 * Original files are NEVER deleted or modified.
 *
 * Usage:  node scripts/optimize-images.mjs
 * Flags:  --dry-run   List files without converting
 *         --force     Re-convert even if .webp already exists
 *         --quality N Set WebP quality (default: 82)
 *         --max-width Set max pixel width (default: 1200)
 */

import sharp from 'sharp';
import { readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// ─── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

const qualityIdx = args.indexOf('--quality');
const QUALITY = qualityIdx !== -1 ? Number(args[qualityIdx + 1]) : 82;

const maxWidthIdx = args.indexOf('--max-width');
const MAX_WIDTH = maxWidthIdx !== -1 ? Number(args[maxWidthIdx + 1]) : 1200;

// Directories to scan (relative to public/)
const TARGET_DIRS = [
  'aylux-images',
  'diox-images',
  'logos',
];

// Extensions to convert
const CONVERTIBLE = new Set(['.png', '.jpg', '.jpeg']);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(fullPath)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONVERTIBLE.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function webpPath(filePath) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, parsed.name + '.webp');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Main pipeline ──────────────────────────────────────────────────────────

async function optimizeImage(srcPath) {
  const destPath = webpPath(srcPath);
  const relativeSrc = path.relative(ROOT, srcPath);
  const relativeDest = path.relative(ROOT, destPath);

  // Skip if WebP already exists (unless --force)
  if (!FORCE) {
    try {
      await stat(destPath);
      return { status: 'skipped', relativeSrc, reason: 'webp already exists' };
    } catch {
      // File doesn't exist — proceed
    }
  }

  if (DRY_RUN) {
    const srcStat = await stat(srcPath);
    return {
      status: 'dry-run',
      relativeSrc,
      relativeDest,
      originalSize: srcStat.size,
    };
  }

  try {
    const srcStat = await stat(srcPath);
    const originalSize = srcStat.size;

    // Ensure output directory exists (for nested subdirectories)
    await mkdir(path.dirname(destPath), { recursive: true });

    // Read image metadata to decide if resize is needed
    const metadata = await sharp(srcPath).metadata();
    let pipeline = sharp(srcPath);

    // Only resize if wider than MAX_WIDTH (preserve aspect ratio)
    if (metadata.width && metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, null, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to WebP with target quality
    await pipeline
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(destPath);

    const destStat = await stat(destPath);
    const savedBytes = originalSize - destStat.size;
    const savedPct = ((savedBytes / originalSize) * 100).toFixed(1);

    return {
      status: 'converted',
      relativeSrc,
      relativeDest,
      originalSize,
      optimizedSize: destStat.size,
      savedBytes,
      savedPct,
    };
  } catch (err) {
    return {
      status: 'error',
      relativeSrc,
      error: err.message,
    };
  }
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  IMAGE OPTIMIZATION PIPELINE');
  console.log('  Non-destructive PNG/JPG → WebP conversion');
  console.log('='.repeat(60));
  console.log(`  Quality:   ${QUALITY}`);
  console.log(`  Max Width: ${MAX_WIDTH}px`);
  console.log(`  Dry Run:   ${DRY_RUN}`);
  console.log(`  Force:     ${FORCE}`);
  console.log('='.repeat(60));
  console.log('');

  // Collect all convertible files
  const allFiles = [];
  for (const dir of TARGET_DIRS) {
    const fullDir = path.join(PUBLIC_DIR, dir);
    try {
      await stat(fullDir);
      const files = await walkDir(fullDir);
      allFiles.push(...files);
    } catch {
      console.log(`  [WARN] Directory not found: ${dir}`);
    }
  }

  // Also check root-level PNGs in public/ (logos like Aylux-logo.png)
  const rootEntries = await readdir(PUBLIC_DIR, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONVERTIBLE.has(ext)) {
        allFiles.push(path.join(PUBLIC_DIR, entry.name));
      }
    }
  }

  console.log(`  Found ${allFiles.length} images to process.\n`);

  if (allFiles.length === 0) {
    console.log('  Nothing to do.');
    return;
  }

  // Process all images
  const results = [];
  let converted = 0;
  let skipped = 0;
  let errors = 0;
  let totalSaved = 0;
  let totalOriginal = 0;

  for (let i = 0; i < allFiles.length; i++) {
    const result = await optimizeImage(allFiles[i]);
    results.push(result);

    const idx = `[${String(i + 1).padStart(String(allFiles.length).length)}/${allFiles.length}]`;

    if (result.status === 'converted') {
      converted++;
      totalSaved += result.savedBytes;
      totalOriginal += result.originalSize;
      console.log(
        `  ${idx} CONVERTED  ${result.relativeSrc}` +
        `\n       ${formatBytes(result.originalSize)} → ${formatBytes(result.optimizedSize)}` +
        `  (saved ${result.savedPct}%)`
      );
    } else if (result.status === 'skipped') {
      skipped++;
      console.log(`  ${idx} SKIPPED    ${result.relativeSrc} (${result.reason})`);
    } else if (result.status === 'dry-run') {
      console.log(`  ${idx} DRY-RUN    ${result.relativeSrc} (${formatBytes(result.originalSize)})`);
    } else if (result.status === 'error') {
      errors++;
      console.log(`  ${idx} ERROR      ${result.relativeSrc}: ${result.error}`);
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total files scanned:  ${allFiles.length}`);
  console.log(`  Converted:            ${converted}`);
  console.log(`  Skipped (existing):   ${skipped}`);
  console.log(`  Errors:               ${errors}`);
  if (converted > 0) {
    console.log(`  Total original size:  ${formatBytes(totalOriginal)}`);
    console.log(`  Total saved:          ${formatBytes(totalSaved)}`);
    const avgPct = ((totalSaved / totalOriginal) * 100).toFixed(1);
    console.log(`  Average reduction:    ${avgPct}%`);
  }
  console.log('='.repeat(60));
  console.log('');

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
