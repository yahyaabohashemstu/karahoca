#!/usr/bin/env node
/**
 * Conservative SVG optimiser tailored for `public/world-map.svg`.
 *
 * Why a custom script instead of plain SVGO?
 * ──────────────────────────────────────────
 * The map embeds an inline `<style>` block containing `@keyframes
 * drawArrow` plus `.arrow1` / `.arrow2` / etc classes that animate
 * trade-route arrows on the world map. Default SVGO presets:
 *   - inline `<style>` into per-element style attrs (loses keyframes)
 *   - drop class names that look unused (loses animation hooks)
 *   - rename IDs (breaks gradient / pattern references)
 *
 * We keep the `inlineStyles`, `cleanupIds`, and `removeUnknownsAndDefaults`
 * plugins OFF so the animation survives, and apply only the safe
 * geometric / numeric optimisations.
 *
 * Reversibility
 * ─────────────
 * Original is preserved at `public/.backup-svgs/world-map.svg`. We write
 * the optimised version on top of `public/world-map.svg`. To revert:
 *
 *   cp public/.backup-svgs/world-map.svg public/world-map.svg
 *
 * Usage:  node scripts/optimize-svg-conservative.mjs [--dry-run]
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const BACKUP_DIR = path.join(PUBLIC_DIR, '.backup-svgs');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const TARGET = 'world-map.svg';

const formatBytes = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;

async function ensureSvgoAvailable() {
  try {
    return await import('svgo');
  } catch {
    console.error('✘ svgo is not installed.');
    console.error('  Run:  npm install --save-dev svgo');
    process.exit(1);
  }
}

async function main() {
  const { optimize } = await ensureSvgoAvailable();

  const srcAbs = path.join(PUBLIC_DIR, TARGET);
  const backupAbs = path.join(BACKUP_DIR, TARGET);

  // Sanity: backup must exist or we refuse to overwrite the original.
  try {
    await stat(backupAbs);
  } catch {
    console.error(`✘ Backup missing: ${backupAbs}`);
    console.error('  Run:  cp public/world-map.svg public/.backup-svgs/');
    process.exit(1);
  }

  const before = await readFile(srcAbs, 'utf8');
  const beforeBytes = Buffer.byteLength(before);

  const result = optimize(before, {
    multipass: true,
    // floatPrecision: 1 cuts numeric digits in path data aggressively.
    // For a world map at 2000×857 viewBox, sub-pixel precision is invisible
    // at every realistic display size. This is where the bulk of the
    // savings come from (path data is ~95% of the file).
    floatPrecision: 1,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            // ─── Plugins we MUST disable to preserve animation ──────────
            // The map's <style> block declares @keyframes and animated
            // classes. Inlining would either drop @keyframes entirely
            // (they have no element to attach to) or convert classes to
            // style attributes (animations still wouldn't fire because
            // class hooks are lost). Keep <style> intact.
            inlineStyles: false,
            // Class names like `.arrow`, `.arrow1` are referenced from
            // <style>. SVGO can't see CSS-to-element binding, so removing
            // them would silently break the trade-route animation.
            removeUselessDefs: false,
            // IDs may be referenced from <use>, gradients, or external CSS.
            // Renaming them is a known footgun.
            cleanupIds: false,
            // The default removes unknown attributes / defaults, but our
            // file uses a `baseprofile="tiny"` and other namespaced attrs
            // that we don't want stripped without careful review.
            removeUnknownsAndDefaults: false,
          },
        },
      },
    ],
  });

  if (result.error) {
    console.error('✘ SVGO failed:', result.error);
    process.exit(1);
  }

  const afterBytes = Buffer.byteLength(result.data);
  const reduction = ((1 - afterBytes / beforeBytes) * 100).toFixed(1);

  console.log(`[svgo] ${TARGET}`);
  console.log(`       before: ${formatBytes(beforeBytes)}`);
  console.log(`       after:  ${formatBytes(afterBytes)}  (${reduction}% smaller)`);

  if (DRY_RUN) {
    console.log('       (dry-run, not written)');
    return;
  }

  // Sanity-check: animation hooks must survive.
  const hasKeyframes = result.data.includes('@keyframes drawArrow');
  const hasArrowClass = result.data.includes('.arrow');
  if (!hasKeyframes || !hasArrowClass) {
    console.error('✘ Optimisation lost animation hooks. Refusing to write.');
    console.error(`   keyframes preserved: ${hasKeyframes}`);
    console.error(`   .arrow class preserved: ${hasArrowClass}`);
    process.exit(1);
  }

  await writeFile(srcAbs, result.data, 'utf8');
  console.log(`       ✓ written to ${TARGET}`);
}

main().catch((err) => {
  console.error('[svgo] FAILED:', err);
  process.exit(1);
});
