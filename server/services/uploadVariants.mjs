/**
 * Resized WebP copies of admin-uploaded images, made on first request.
 *
 * Product photos uploaded through the admin are stored as-is — often
 * 2–8 MB PNGs of ~2800 px — and the product cards showed them at ~250 px:
 * the AYLUX page downloaded ~23 MB of images. `/api/uploads/<file>?w=640`
 * now returns a WebP at most 640 px wide (never enlarged), cached on disk
 * next to the uploads so each size is encoded once.
 *
 * Only a fixed set of widths is accepted, so the number of files a visitor
 * can make the server encode is bounded (widths × uploads). If sharp is not
 * available or encoding fails, the caller serves the original file.
 */
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { logger } from '../utils/logger.mjs';

export const UPLOAD_VARIANT_WIDTHS = [160, 320, 480, 640, 960, 1280];
const RESIZABLE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

let sharpPromise = null;
const loadSharp = () => {
  if (!sharpPromise) {
    sharpPromise = import('sharp')
      .then((m) => m.default)
      .catch((err) => {
        logger.warn({ err: err?.message }, '[uploads] sharp unavailable — serving originals');
        return null;
      });
  }
  return sharpPromise;
};

// Concurrent requests for the same variant share one encode.
const inFlight = new Map();

/**
 * @param {string} uploadsDir   directory holding the uploads
 * @param {string} fileName     already basename()-sanitised upload name
 * @param {number} width        requested width (must be in UPLOAD_VARIANT_WIDTHS)
 * @returns {Promise<string|null>} path of the WebP variant, or null → serve original
 */
export const getUploadVariant = async (uploadsDir, fileName, width) => {
  if (!UPLOAD_VARIANT_WIDTHS.includes(width)) return null;
  if (!fileName || fileName !== path.basename(fileName) || fileName.startsWith('.')) return null;
  if (!RESIZABLE_EXT.has(path.extname(fileName).toLowerCase())) return null;

  const variantsDir = path.join(uploadsDir, '.variants');
  const target = path.join(variantsDir, `${path.parse(fileName).name}.w${width}.webp`);
  try {
    const s = await stat(target);
    if (s.isFile() && s.size > 0) return target;
  } catch { /* not generated yet */ }

  if (inFlight.has(target)) return inFlight.get(target);
  const job = (async () => {
    const sharp = await loadSharp();
    if (!sharp) return null;
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      await mkdir(variantsDir, { recursive: true });
      await sharp(path.join(uploadsDir, fileName), { limitInputPixels: 80_000_000 })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(tmp);
      await rename(tmp, target);
      return target;
    } catch (err) {
      logger.warn({ err: err?.message, fileName, width }, '[uploads] variant encode failed — serving original');
      await unlink(tmp).catch(() => {});
      return null;
    }
  })().finally(() => inFlight.delete(target));
  inFlight.set(target, job);
  return job;
};
