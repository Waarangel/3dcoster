import type Dexie from 'dexie';
import { db } from '../db/database';
import { useSyncFolder } from '../hooks/useSyncFolder';
import { SyncMergeSummary } from './SyncMergeSummary';
import { Button } from './ui';
import { NewBadge } from './NewBadge';
import { formatRelativeDate } from '../utils/formatRelativeDate';

// ---------------------------------------------------------------------------
// SyncSetup — the "Sync" subsection of Settings -> Data -> "Backup, Restore
// & Sync" (D-03: one home, no new chrome elsewhere). Folder setup/status,
// manual actions, the D-02 capability note, and the D-08 undo affordance.
// Renders SyncMergeSummary inline whenever useSyncFolder surfaces a
// pendingMerge that needs the user's confirmation before it commits.
//
// D-02: on Safari/Firefox (capability === 'manual') there is no folder
// picker at all — the existing Backup/Restore buttons immediately above
// this subsection already move a full snapshot between devices, so the
// capability note points there instead of duplicating export/import UI.
// ---------------------------------------------------------------------------

export function SyncSetup({ database = db }: { database?: Dexie }) {
  const {
    capability,
    isConfigured,
    lastSyncedAt,
    pendingMerge,
    canUndo,
    error,
    status,
    setupSync,
    syncNow,
    confirmMerge,
    cancelMerge,
    undoLastMerge,
  } = useSyncFolder(database);

  const isManual = capability === 'manual';
  const isSyncing = status === 'syncing';

  return (
    <div className="border-t border-slate-700 pt-6 space-y-3">
      <div className="relative inline-block">
        <h3 className="text-sm font-semibold text-white mb-1">Sync</h3>
        <NewBadge feature="sync-devices" className="absolute top-0 left-full ml-2 pointer-events-none" />
      </div>
      <p className="text-sm text-slate-400">
        Keep your data in sync across devices using a shared folder (Dropbox, Google Drive,
        iCloud, or a local network folder). Pick a folder once — after that, changes sync
        automatically.
      </p>

      {isManual ? (
        <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          Automatic sync needs Chrome/Edge or the desktop app. Use the Backup and Restore
          buttons above to move data between devices manually — export a backup on one
          device and restore it on the other.
        </p>
      ) : (
        <>
          {!isConfigured ? (
            <Button btnSize="sm" onClick={() => void setupSync()} disabled={isSyncing}>
              Set up sync
            </Button>
          ) : (
            <div className="space-y-2">
              <p role="status" className="text-sm text-slate-300">
                {isSyncing
                  ? 'Syncing…'
                  : lastSyncedAt
                    ? `Last synced ${formatRelativeDate(new Date(lastSyncedAt))}`
                    : 'Not yet synced'}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button btnSize="sm" variant="secondary" onClick={() => void syncNow()} disabled={isSyncing}>
                  Sync now
                </Button>
                {canUndo && (
                  <Button btnSize="sm" variant="ghost" onClick={() => void undoLastMerge()} disabled={isSyncing}>
                    Restore pre-merge state
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {pendingMerge && (
        <SyncMergeSummary
          plan={pendingMerge.plan}
          onConfirm={() => void confirmMerge()}
          onCancel={cancelMerge}
        />
      )}
    </div>
  );
}
