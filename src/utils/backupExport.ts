import type Dexie from 'dexie';
import { APP_VERSION } from '../version';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_STORES,
  type BackupData,
  type BackupFile,
} from './backupSchema';

// ---------------------------------------------------------------------------
// Full-database backup export. Takes the Dexie instance as a parameter so
// tests run against isolated fake-indexeddb instances; production passes the
// app singleton from db/database.ts.
// ---------------------------------------------------------------------------

/** Reads all 9 stores and wraps them in the meta envelope. */
export async function buildBackupFile(database: Dexie): Promise<BackupFile> {
  if (!database.isOpen()) await database.open();

  const data = {} as BackupData;
  for (const store of BACKUP_STORES) {
    data[store] = await database.table(store).toArray();
  }

  return {
    meta: {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      appSchemaVersion: database.verno,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
    },
    data,
  };
}

/** Plain JSON — Date fields flatten to ISO strings (rehydrated on restore). */
export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file);
}

/** `3dcoster-backup-YYYY-MM-DD.json`, dated with the local export date. */
export function buildBackupFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `3dcoster-backup-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Saves the backup to disk. Web: Blob + anchor download (downloadCsv
 * pattern). Tauri: native save dialog + plugin-fs write, with the same
 * "forbidden path:" error mapping as the PDF save path
 * (generateQuotePdf.ts) so scope denials surface as friendly guidance.
 */
export async function downloadBackup(database: Dexie): Promise<void> {
  const json = serializeBackup(await buildBackupFile(database));
  const filename = buildBackupFilename();

  if (!__IS_TAURI__) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const savePath = await save({
    defaultPath: filename,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!savePath) return; // user cancelled the dialog

  try {
    await writeFile(savePath, new TextEncoder().encode(json));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().startsWith('forbidden path:')) {
      throw new Error(
        `Cannot save to "${savePath}" — this location is restricted. ` +
        'Try saving to Downloads, Documents, or Desktop instead.',
      );
    }
    throw err;
  }
}
