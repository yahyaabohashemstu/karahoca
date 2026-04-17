/**
 * Automated SQLite backup system.
 *
 * STRATEGY — split across two branches based on S3 configuration:
 *
 *   A) S3 configured (S3_BUCKET_NAME set):
 *      1. Open the live DB via better-sqlite3 and run `.backup()` to a
 *         staging file. This is an ONLINE backup — safe while the server
 *         is writing. (copyFile would risk copying a half-written page.)
 *      2. Upload the staging file to S3 using the AWS SDK. Retries are
 *         handled by the SDK's built-in middleware (3 attempts w/ jitter).
 *      3. On upload success, delete the staging file (S3 is the source of
 *         truth; local disk stays lean).
 *      4. On upload failure, KEEP the staging file — it's our last-line
 *         local fallback if S3 is unreachable.
 *      5. Async prune of old S3 objects (best-effort — a failure here
 *         never blocks the primary backup path).
 *
 *   B) No S3 configured:
 *      Fall back to the classic 7-copy local rotation. This is the
 *      preserve-existing-behavior branch for deploys that haven't wired
 *      up object storage yet. `.backup()` is still used instead of
 *      copyFile — an upgrade from the pre-6.2 behavior.
 *
 * Any error in either branch is logged via the structured `logger` but
 * NEVER propagates out of the top-level `runBackup()` — a failed backup
 * must never take down the API.
 *
 * Env vars (all optional — absence = local-rotation-only fallback):
 *   S3_BUCKET_NAME           e.g. karahoca-backups
 *   S3_ENDPOINT              e.g. https://<acct>.r2.cloudflarestorage.com
 *                            (omit for AWS S3 proper)
 *   S3_REGION                default: 'auto' (R2); 'us-east-1' for AWS
 *   S3_KEY_PREFIX            default: 'backups/karahoca/'
 *   S3_FORCE_PATH_STYLE      'true' for MinIO / old-style S3 endpoints
 *   AWS_ACCESS_KEY_ID        access key (used by every S3-compatible provider)
 *   AWS_SECRET_ACCESS_KEY    secret key
 *   MAX_CLOUD_BACKUPS        default: 30 — cloud retention (days)
 */

import { readdir, unlink, mkdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import { logger } from './utils/logger.mjs';
import { getDb } from './services/db.mjs';

// Module-level lock: if a previous backup is still running (e.g. S3 hung
// near the 24h interval boundary) the next tick MUST NOT start a second
// concurrent run — two `db.backup()` calls + two S3 uploads to the same
// staging path would race and potentially corrupt either side.
let backupInProgress = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'karahoca.db');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const MAX_LOCAL_BACKUPS = 7;
const MAX_CLOUD_BACKUPS = Number.parseInt(process.env.MAX_CLOUD_BACKUPS || '30', 10);
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const S3_BUCKET = process.env.S3_BUCKET_NAME || '';
const S3_KEY_PREFIX = (process.env.S3_KEY_PREFIX || 'backups/karahoca/').replace(/^\/+/, '').replace(/\/*$/, '/');

// ─── S3 client (lazy, cached) ───────────────────────────────────────────────
// We build the client ONCE on first use and keep it across backup runs. The
// SDK's internal HTTP agent / connection pool benefits from reuse.
let cachedS3Client = null;

const isS3Configured = () =>
  Boolean(S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const getS3Client = () => {
  if (cachedS3Client) return cachedS3Client;
  cachedS3Client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    // Explicit credentials object (vs relying on SDK auto-discovery) —
    // makes it unambiguous which env vars we're reading, and plays nicely
    // with R2 / DO Spaces / MinIO where AWS default discovery may fight us.
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    // AWS SDK already retries with exponential backoff on transient errors
    // (network, 5xx). `maxAttempts: 4` = initial + 3 retries, ~7s total cap.
    maxAttempts: 4,
    // Hard timeouts on the underlying HTTP connection so a stuck socket
    // never pins the file handle / buffer in memory indefinitely. The
    // SDK's maxAttempts already multiplies retries, so these caps are
    // per-attempt, giving a worst-case upper bound of ~4 × 60s = 4 min.
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10_000,
      requestTimeout: 60_000,
    }),
  });
  logger.info(
    {
      bucket: S3_BUCKET,
      endpoint: process.env.S3_ENDPOINT || '(aws default)',
      region: process.env.S3_REGION || 'auto',
    },
    '[backup] S3 client initialized',
  );
  return cachedS3Client;
};

// ─── Upload the backup file to S3 ───────────────────────────────────────────
// Reads the file into memory as a Buffer. For SQLite DBs in this project's
// scale (tens of MB at worst) that's fine and lets the SDK retry naturally.
// If the DB ever exceeds ~100MB, swap for `@aws-sdk/lib-storage`'s `Upload`
// helper which does parallel multipart from a Readable stream.
const uploadBackupToS3 = async (localPath, objectKey) => {
  const fileBuffer = await readFile(localPath);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      Body: fileBuffer,
      ContentLength: fileBuffer.length,
      ContentType: 'application/vnd.sqlite3',
      // Server-side encryption (AWS): for R2/DO Spaces this header is a
      // silent no-op but doesn't break. Harmless + beneficial where supported.
      ServerSideEncryption: 'AES256',
      Metadata: {
        source: 'karahoca-api',
        'backed-up-at': new Date().toISOString(),
      },
    }),
  );

  return {
    bucket: S3_BUCKET,
    key: objectKey,
    bytes: fileBuffer.length,
  };
};

// ─── Prune old S3 objects ───────────────────────────────────────────────────
// Lists all objects under the backup prefix, keeps the latest
// MAX_CLOUD_BACKUPS, deletes the rest. Best-effort — any error is logged
// and swallowed; the primary backup already completed.
const pruneOldS3Backups = async () => {
  if (MAX_CLOUD_BACKUPS <= 0) return;
  try {
    const client = getS3Client();
    const list = await client.send(
      new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: S3_KEY_PREFIX }),
    );
    const items = (list.Contents || [])
      .filter((o) => typeof o.Key === 'string' && o.Key.endsWith('.db'))
      // Sort by LastModified ascending; oldest first for easy slicing.
      .sort((a, b) => {
        const at = a.LastModified ? new Date(a.LastModified).getTime() : 0;
        const bt = b.LastModified ? new Date(b.LastModified).getTime() : 0;
        return at - bt;
      });

    if (items.length <= MAX_CLOUD_BACKUPS) return;
    const toDelete = items.slice(0, items.length - MAX_CLOUD_BACKUPS);

    for (const obj of toDelete) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: obj.Key }));
        logger.info({ key: obj.Key }, '[backup] S3 pruned old backup');
      } catch (err) {
        logger.warn({ err, key: obj.Key }, '[backup] S3 prune failed for one object (continuing)');
      }
    }
  } catch (err) {
    logger.warn({ err: err?.message || err }, '[backup] S3 prune listing failed (non-fatal)');
  }
};

// ─── Local-only rotation fallback ───────────────────────────────────────────
// Used when S3 isn't configured: keep the last MAX_LOCAL_BACKUPS files on disk.
const rotateLocalBackups = async () => {
  try {
    const files = (await readdir(BACKUP_DIR))
      .filter((f) => f.startsWith('karahoca-') && f.endsWith('.db'))
      .sort();
    if (files.length <= MAX_LOCAL_BACKUPS) return;
    for (const f of files.slice(0, files.length - MAX_LOCAL_BACKUPS)) {
      await unlink(path.join(BACKUP_DIR, f));
      logger.info({ file: f }, '[backup] Local rotated (pruned)');
    }
  } catch (err) {
    logger.warn({ err: err?.message || err }, '[backup] Local rotation failed (non-fatal)');
  }
};

// ─── Main backup entry point ────────────────────────────────────────────────
export const runBackup = async () => {
  // Overlap guard: if S3 hangs past the 24h interval (even with per-request
  // timeouts stacking up via retries) we must NOT start a second concurrent
  // backup — two `.backup()` calls would race on the same staging path.
  if (backupInProgress) {
    logger.warn('[backup] previous run still in progress — skipping this tick');
    return;
  }
  backupInProgress = true;

  try {
    if (!existsSync(DB_PATH)) {
      logger.info('[backup] DB file not found yet, skipping');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
    const backupFilename = `karahoca-${timestamp}.db`;
    const localBackupPath = path.join(BACKUP_DIR, backupFilename);
    await runBackupInner(backupFilename, localBackupPath);
  } finally {
    backupInProgress = false;
  }
};

// The original body, extracted so the lock wrapping above stays a single
// try/finally and the branching logic below is unchanged.
const runBackupInner = async (backupFilename, localBackupPath) => {

  // ── Step 1: online .backup() to the staging file ─────────────────────────
  // Use better-sqlite3's native backup API so pages-in-flight are handled
  // safely. This is cheap (~100 ms for a 10MB DB) and is the authoritative
  // "right way" to hot-copy a SQLite file.
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const db = getDb();
    await db.backup(localBackupPath, { attached: 'main' });
    const sizeBytes = (await stat(localBackupPath)).size;
    logger.info({ path: localBackupPath, bytes: sizeBytes }, '[backup] Local snapshot created');
  } catch (err) {
    // If the snapshot itself failed, there's nothing to upload.
    logger.error({ err: err?.message || err }, '[backup] Local snapshot FAILED — nothing to upload');
    return;
  }

  // ── Step 2: if S3 is configured, upload + delete local ───────────────────
  if (isS3Configured()) {
    const objectKey = `${S3_KEY_PREFIX}${backupFilename}`;
    try {
      const result = await uploadBackupToS3(localBackupPath, objectKey);
      logger.info(
        { bucket: result.bucket, key: result.key, bytes: result.bytes },
        '[backup] S3 upload OK',
      );

      // Upload succeeded → drop the local temp file so the disk stays lean.
      try {
        await unlink(localBackupPath);
      } catch (err) {
        // Non-fatal: S3 already has the backup. Log and move on.
        logger.warn(
          { err: err?.message || err, path: localBackupPath },
          '[backup] Local temp cleanup failed (backup is safe in S3)',
        );
      }

      // Best-effort prune of old S3 objects. Does not block.
      await pruneOldS3Backups();
      return;
    } catch (err) {
      // S3 failed — KEEP the local file as an insurance copy. Log with
      // structured context so a log pipeline can alert on recurring failures.
      logger.error(
        { err: err?.message || err, bucket: S3_BUCKET, key: objectKey, localFallback: localBackupPath },
        '[backup] S3 upload FAILED — local snapshot retained as fallback',
      );
      // Fall through to local rotation so we still cap disk usage at 7 copies.
      await rotateLocalBackups();
      return;
    }
  }

  // ── Step 3: no S3 — classic 7-copy local rotation ────────────────────────
  await rotateLocalBackups();
};

export const startAutoBackup = (intervalMs = BACKUP_INTERVAL_MS) => {
  // Initial backup 30 seconds after server start (let DB settle before the
  // first write-heavy migration from seed data is fully flushed).
  setTimeout(() => {
    void runBackup().catch((err) => {
      // Top-level safety net — runBackup already catches internally, but
      // we ensure nothing synchronous can bubble up to crash the process.
      logger.error({ err }, '[backup] Unexpected error in scheduled run');
    });
  }, 30_000);

  const id = setInterval(() => {
    void runBackup().catch((err) => {
      logger.error({ err }, '[backup] Unexpected error in scheduled run');
    });
  }, intervalMs);

  const hours = Math.round(intervalMs / 3_600_000);
  if (isS3Configured()) {
    logger.info(
      {
        intervalHours: hours,
        localRetention: MAX_LOCAL_BACKUPS,
        cloudRetention: MAX_CLOUD_BACKUPS,
        bucket: S3_BUCKET,
      },
      '[backup] Auto-backup scheduled (local snapshot → S3 upload → local cleanup)',
    );
  } else {
    logger.info(
      {
        intervalHours: hours,
        localRetention: MAX_LOCAL_BACKUPS,
      },
      '[backup] Auto-backup scheduled (local-only rotation — S3 env vars not set)',
    );
  }

  return id;
};
