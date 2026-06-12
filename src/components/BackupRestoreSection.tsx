import { useEffect, useRef, useState } from 'react';
import type Dexie from 'dexie';
import { db } from '../db/database';
import { Button } from './ui';
import { downloadBackup } from '../utils/backupExport';
import { restoreBackup, validateBackupFile } from '../utils/backupRestore';
import { MAX_BACKUP_BYTES, type BackupStoreName } from '../utils/backupSchema';

// ---------------------------------------------------------------------------
// Settings → Data tab content. Lives in its own file because SettingsModal
// sits at the 800-line cap; the modal only mounts this component.
//
// Restore is replace-all and irreversible, so the flow is deliberately
// staged: pick file → gates (extension/size/parse/validate, all BEFORE any
// write) → confirm step showing record counts from BOTH the backup and the
// live database → atomic restore → full page reload (boot reconciles are
// per-session and settings hooks read once on mount — a reactive refresh
// would leave stale state).
// ---------------------------------------------------------------------------

type RestoreStage =
  | { step: 'idle' }
  | { step: 'confirm'; parsed: unknown; backupCounts: CountSummary; currentCounts: CountSummary }
  | { step: 'restoring' };

type CountSummary = Record<BackupStoreName, number>;

// The stores users think in; the rest restore too but ride under "settings".
const COUNT_DISPLAY: { store: BackupStoreName; singular: string }[] = [
  { store: 'jobs', singular: 'job' },
  { store: 'sales', singular: 'sale' },
  { store: 'materials', singular: 'asset' },
  { store: 'customers', singular: 'customer' },
  { store: 'quotes', singular: 'quote' },
];

function summarizeCounts(counts: CountSummary): string {
  return COUNT_DISPLAY
    .map(({ store, singular }) => {
      const n = counts[store];
      return `${n} ${n === 1 ? singular : `${singular}s`}`;
    })
    .join(', ');
}

async function readCurrentCounts(database: Dexie): Promise<CountSummary> {
  if (!database.isOpen()) await database.open();
  const counts = {} as CountSummary;
  for (const { store } of COUNT_DISPLAY) {
    counts[store] = await database.table(store).count();
  }
  // Non-display stores aren't summarized but keep the type total.
  counts.printers = 0;
  counts.printerInstances = 0;
  counts.settings = 0;
  return counts;
}

export function BackupRestoreSection({
  database = db,
  reload = () => window.location.reload(),
}: {
  /** Injectable for tests; defaults to the app database. */
  database?: Dexie;
  /** Injectable for tests; defaults to a full page reload. */
  reload?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [stage, setStage] = useState<RestoreStage>({ step: 'idle' });

  // When the destructive confirm panel appears, move focus to Cancel (the
  // safe default) so keyboard/AT users land on the panel, not on the
  // just-unmounted file-picker button.
  useEffect(() => {
    if (stage.step === 'confirm') cancelButtonRef.current?.focus();
  }, [stage.step]);
  const [error, setError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setError(null);
    setExportMessage(null);
    try {
      await downloadBackup(database);
      setExportMessage('Backup downloaded. Keep it somewhere safe — it contains everything.');
    } catch (err) {
      console.error('Backup download failed:', err);
      setError(err instanceof Error ? err.message : 'Could not create the backup. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChosen = async (file: File) => {
    setError(null);
    setExportMessage(null);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Backups are .json files — choose a file downloaded from "Download Backup".');
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(0);
      setError(`File is ${sizeMb} MB — backups are limited to 50 MB. This doesn't look like a 3DCoster backup.`);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError('That file is not valid JSON — it may be corrupted or not a 3DCoster backup.');
      return;
    }

    const result = validateBackupFile(parsed);
    if (!result.ok) {
      setError(`Not a usable backup: ${result.error}`);
      return;
    }

    const currentCounts = await readCurrentCounts(database);
    setStage({ step: 'confirm', parsed, backupCounts: result.file.counts, currentCounts });
  };

  const handleConfirmRestore = async () => {
    if (stage.step !== 'confirm') return;
    const { parsed } = stage;
    setStage({ step: 'restoring' });
    setError(null);
    try {
      await restoreBackup(database, parsed);
      // Full reload re-runs boot reconciles and the one-shot settings hooks
      // against the restored data (same reasoning as handleVersionchange).
      reload();
    } catch (err) {
      console.error('Restore failed:', err);
      setError(err instanceof Error ? err.message : 'Restore failed — your existing data is unchanged.');
      setStage({ step: 'idle' });
    }
  };

  const handleCancel = () => {
    setStage({ step: 'idle' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Backup */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Backup</h3>
        <p className="text-sm text-slate-400 mb-3">
          Download your entire 3DCoster database — jobs, sales, assets, customers, quotes, and
          settings — as a single file. Your data lives only in this browser, so a backup is your
          safety net against a cleared profile or a new computer.
        </p>
        <Button btnSize="sm" onClick={handleDownload} disabled={isExporting}>
          Download Backup
        </Button>
        {exportMessage && (
          <p role="status" className="text-sm text-green-400 mt-2">{exportMessage}</p>
        )}
      </div>

      {/* Restore */}
      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-white mb-1">Restore</h3>
        <p className="text-sm text-slate-400 mb-3">
          Load a backup file. This <span className="font-semibold text-slate-200">replaces everything</span>{' '}
          currently in the app with the backup&apos;s contents — it cannot be undone.
        </p>

        {stage.step === 'idle' && (
          <>
            {/* allow-raw-html: hidden file picker — no shared primitive exists for file inputs (mirrors CsvImportModal) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Choose a backup file to restore"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleFileChosen(file);
              }}
            />
            <Button variant="secondary" btnSize="sm" onClick={() => fileInputRef.current?.click()}>
              Choose Backup File…
            </Button>
          </>
        )}

        {stage.step === 'confirm' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
            <p className="text-sm text-amber-200 font-medium">
              Replace everything with this backup?
            </p>
            <div className="text-sm text-slate-300 space-y-1">
              <p>Backup contains: <span className="text-white">{summarizeCounts(stage.backupCounts)}</span>.</p>
              <p>Currently in the app: <span className="text-white">{summarizeCounts(stage.currentCounts)}</span> — all of it will be deleted.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="danger" btnSize="sm" onClick={handleConfirmRestore}>
                Replace Everything &amp; Restore
              </Button>
              <Button ref={cancelButtonRef} variant="secondary" btnSize="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {stage.step === 'restoring' && (
          <p role="status" className="text-sm text-slate-300">Restoring… the app will reload when it finishes.</p>
        )}
      </div>
    </div>
  );
}
