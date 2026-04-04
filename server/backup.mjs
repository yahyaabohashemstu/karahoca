import { copyFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'karahoca.db');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const MAX_BACKUPS = 7;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const runBackup = async () => {
  if (!existsSync(DB_PATH)) {
    console.log('[backup] DB file not found yet, skipping.');
    return;
  }
  try {
    await mkdir(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
    const backupFile = path.join(BACKUP_DIR, `karahoca-${timestamp}.db`);

    await copyFile(DB_PATH, backupFile);
    console.log(`[backup] Saved: ${backupFile}`);

    // Rotate: keep only the last MAX_BACKUPS files
    const files = (await readdir(BACKUP_DIR))
      .filter(f => f.startsWith('karahoca-') && f.endsWith('.db'))
      .sort(); // ISO timestamps sort correctly oldest→newest

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(0, files.length - MAX_BACKUPS);
      for (const f of toDelete) {
        await unlink(path.join(BACKUP_DIR, f));
        console.log(`[backup] Rotated: ${f}`);
      }
    }
  } catch (err) {
    console.error('[backup] Failed:', err.message);
  }
};

export const startAutoBackup = (intervalMs = BACKUP_INTERVAL_MS) => {
  // Initial backup after 30 seconds (let server fully start first)
  setTimeout(runBackup, 30_000);
  // Then every 24 hours — return interval ID for graceful shutdown
  const id = setInterval(runBackup, intervalMs);
  console.log(`[backup] Auto-backup scheduled every ${Math.round(intervalMs / 3_600_000)}h, keeping last ${MAX_BACKUPS} copies.`);
  return id;
};
