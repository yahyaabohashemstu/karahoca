/**
 * Automated SQLite backup system.
 *
 * Local:  Copies DB to server/data/backups/, keeps last 7 files.
 * Cloud:  Compresses (gzip) and uploads to Cloudflare R2 (or any S3-compatible
 *         storage) using AWS Signature V4 — no extra npm packages required.
 *
 * Required env vars for cloud backup (all optional — local backup always runs):
 *   BACKUP_S3_ENDPOINT   e.g. https://<account-id>.r2.cloudflarestorage.com
 *   BACKUP_S3_BUCKET     e.g. karahoca-backups
 *   BACKUP_S3_ACCESS_KEY R2 Access Key ID
 *   BACKUP_S3_SECRET_KEY R2 Secret Access Key
 *   BACKUP_S3_REGION     Default: "auto" (correct for R2); use "us-east-1" for AWS
 */

import { copyFile, readdir, unlink, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createHmac, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'karahoca.db');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const MAX_LOCAL_BACKUPS = 7;
const MAX_CLOUD_BACKUPS = 30;        // keep up to 30 daily copies in the cloud
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const gzipAsync = promisify(gzip);

// ── AWS Signature V4 helpers ─────────────────────────────────────────────────

const sha256hex = (data) =>
  createHash('sha256').update(data).digest('hex');

const hmac = (key, data) =>
  createHmac('sha256', key).update(data).digest();

const signingKey = (secretKey, dateStamp, region, service) =>
  hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), service), 'aws4_request');

/**
 * Upload a Buffer to an S3-compatible endpoint using AWS Signature V4.
 * Works with Cloudflare R2, AWS S3, Backblaze B2, MinIO, etc.
 */
const uploadToS3 = async (buffer, objectKey) => {
  const endpoint  = process.env.BACKUP_S3_ENDPOINT;
  const bucket    = process.env.BACKUP_S3_BUCKET;
  const accessKey = process.env.BACKUP_S3_ACCESS_KEY;
  const secretKey = process.env.BACKUP_S3_SECRET_KEY;
  const region    = process.env.BACKUP_S3_REGION || 'auto';

  if (!endpoint || !bucket || !accessKey || !secretKey) return null;

  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';  // 20240101T120000Z
  const dateStamp = amzDate.slice(0, 8);                                                   // 20240101

  const url = new URL(`/${bucket}/${objectKey}`, endpoint);
  const host = url.host;
  const canonicalUri = url.pathname;

  const contentType    = 'application/octet-stream';
  const payloadHash    = sha256hex(buffer);

  // Canonical headers (must be sorted alphabetically by header name)
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',                   // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join('\n');

  const signature = createHmac('sha256', signingKey(secretKey, dateStamp, region, 's3'))
    .update(stringToSign)
    .digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type':          contentType,
      'Content-Length':        String(buffer.length),
      'Host':                  host,
      'x-amz-date':            amzDate,
      'x-amz-content-sha256':  payloadHash,
      'Authorization':         authorization,
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`S3 upload failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return url.toString();
};

// ── Cloud rotation: delete old keys ─────────────────────────────────────────

/**
 * List objects in the bucket with the given prefix, delete oldest ones
 * if count exceeds MAX_CLOUD_BACKUPS.
 * Uses S3 ListObjectsV2 — also signed with Signature V4.
 */
const rotateCloudBackups = async (prefix) => {
  const endpoint  = process.env.BACKUP_S3_ENDPOINT;
  const bucket    = process.env.BACKUP_S3_BUCKET;
  const accessKey = process.env.BACKUP_S3_ACCESS_KEY;
  const secretKey = process.env.BACKUP_S3_SECRET_KEY;
  const region    = process.env.BACKUP_S3_REGION || 'auto';

  if (!endpoint || !bucket || !accessKey || !secretKey) return;

  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const listUrl   = new URL(`/${bucket}`, endpoint);
  listUrl.searchParams.set('list-type', '2');
  listUrl.searchParams.set('prefix', prefix);
  const host      = listUrl.host;

  const canonicalQS = `list-type=2&prefix=${encodeURIComponent(prefix)}`;
  const payloadHash  = sha256hex('');
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'GET', `/${bucket}`, canonicalQS,
    canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(secretKey, dateStamp, region, 's3'))
    .update(stringToSign).digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(listUrl.toString(), {
    headers: { 'Host': host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, Authorization: authorization },
  });

  if (!res.ok) return;

  const xml = await res.text();
  // Simple XML key extraction (avoids adding xml2js dependency)
  const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)]
    .map(m => m[1])
    .sort(); // ISO-named keys sort oldest→newest

  if (keys.length <= MAX_CLOUD_BACKUPS) return;

  const toDelete = keys.slice(0, keys.length - MAX_CLOUD_BACKUPS);
  for (const key of toDelete) {
    // DELETE with Signature V4
    const delUrl    = new URL(`/${bucket}/${key}`, endpoint);
    const delAmzDate  = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const delDateStamp = delAmzDate.slice(0, 8);
    const delPayload   = sha256hex('');
    const delCanHeaders = `host:${delUrl.host}\nx-amz-content-sha256:${delPayload}\nx-amz-date:${delAmzDate}\n`;
    const delSignedH    = 'host;x-amz-content-sha256;x-amz-date';
    const delCanReq     = ['DELETE', delUrl.pathname, '', delCanHeaders, delSignedH, delPayload].join('\n');
    const delScope      = `${delDateStamp}/${region}/s3/aws4_request`;
    const delSTS        = ['AWS4-HMAC-SHA256', delAmzDate, delScope, sha256hex(delCanReq)].join('\n');
    const delSig        = createHmac('sha256', signingKey(secretKey, delDateStamp, region, 's3')).update(delSTS).digest('hex');
    const delAuth       = `AWS4-HMAC-SHA256 Credential=${accessKey}/${delScope}, SignedHeaders=${delSignedH}, Signature=${delSig}`;

    await fetch(delUrl.toString(), {
      method: 'DELETE',
      headers: { Host: delUrl.host, 'x-amz-date': delAmzDate, 'x-amz-content-sha256': delPayload, Authorization: delAuth },
    }).catch(() => {});
    console.log(`[backup] Cloud rotated: ${key}`);
  }
};

// ── Main backup function ─────────────────────────────────────────────────────

export const runBackup = async () => {
  if (!existsSync(DB_PATH)) {
    console.log('[backup] DB file not found yet, skipping.');
    return;
  }

  const timestamp  = new Date().toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');

  // ── 1. Local backup ───────────────────────────────────────────────────────
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const localFile = path.join(BACKUP_DIR, `karahoca-${timestamp}.db`);
    await copyFile(DB_PATH, localFile);
    console.log(`[backup] Local saved: ${localFile}`);

    // Rotate local copies
    const files = (await readdir(BACKUP_DIR))
      .filter(f => f.startsWith('karahoca-') && f.endsWith('.db'))
      .sort();
    if (files.length > MAX_LOCAL_BACKUPS) {
      for (const f of files.slice(0, files.length - MAX_LOCAL_BACKUPS)) {
        await unlink(path.join(BACKUP_DIR, f));
        console.log(`[backup] Local rotated: ${f}`);
      }
    }
  } catch (err) {
    console.error('[backup] Local backup failed:', err.message);
  }

  // ── 2. Cloud backup (if credentials are configured) ───────────────────────
  const hasCloudConfig =
    process.env.BACKUP_S3_ENDPOINT &&
    process.env.BACKUP_S3_BUCKET &&
    process.env.BACKUP_S3_ACCESS_KEY &&
    process.env.BACKUP_S3_SECRET_KEY;

  if (!hasCloudConfig) {
    console.log('[backup] No cloud credentials configured — skipping cloud upload.');
    return;
  }

  try {
    const raw = await readFile(DB_PATH);
    const compressed = await gzipAsync(raw);
    const objectKey = `backups/karahoca-${timestamp}.db.gz`;

    const uploadedUrl = await uploadToS3(compressed, objectKey);
    console.log(`[backup] Cloud uploaded: ${objectKey} (${Math.round(compressed.length / 1024)} KB gzipped)`);

    // Rotate old cloud backups asynchronously (don't block)
    rotateCloudBackups('backups/karahoca-').catch(e =>
      console.error('[backup] Cloud rotation error:', e.message)
    );

    return uploadedUrl;
  } catch (err) {
    console.error('[backup] Cloud backup failed:', err.message);
  }
};

export const startAutoBackup = (intervalMs = BACKUP_INTERVAL_MS) => {
  // Initial backup 30 seconds after server start (let DB settle)
  setTimeout(runBackup, 30_000);
  const id = setInterval(runBackup, intervalMs);
  const hasCloud = !!(
    process.env.BACKUP_S3_ENDPOINT &&
    process.env.BACKUP_S3_BUCKET &&
    process.env.BACKUP_S3_ACCESS_KEY &&
    process.env.BACKUP_S3_SECRET_KEY
  );
  console.log(
    `[backup] Auto-backup every ${Math.round(intervalMs / 3_600_000)}h ` +
    `— local (${MAX_LOCAL_BACKUPS} copies) + ${hasCloud ? 'cloud (R2/S3) ✓' : 'cloud NOT configured'}`
  );
  return id;
};
