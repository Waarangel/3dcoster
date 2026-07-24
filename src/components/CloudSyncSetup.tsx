import { useEffect, useId, useState } from 'react';
import type Dexie from 'dexie';
import { db } from '../db/database';
import { useCloudSync } from '../hooks/useCloudSync';
import { useEntitlement } from '../hooks/useEntitlement';
import { supabase } from '../lib/supabaseClient';
import { checkPassphraseStrength, type PassphraseStrengthResult } from '../utils/syncCrypto';
import { formatRelativeDate } from '../utils/formatRelativeDate';
import { SyncMergeSummary } from './SyncMergeSummary';
import { NewBadge } from './NewBadge';
import { ProPitchModal } from './pro/ProPitchModal';
import { Button, ConfirmModal, Input } from './ui';

// ---------------------------------------------------------------------------
// CloudSyncSetup — the "Cloud sync" subsection of Settings -> Data ->
// "Backup, Restore & Sync" (D-15: one home, joins the existing file-sync
// SyncSetup subsection). Free/signed-out users see a Pro chip that opens the
// ONE bundle ProPitchModal (D-15, one monetization voice — mirrors 46
// D-13/D-14 exactly); sign-in itself is deferred to the App-level
// SignInModal via `onOpenSignIn` — this component never collects an email.
//
// Pro users drive the full useCloudSync (47-05) surface: first-time
// passphrase setup (strength-gated, D-06/D-07 unrecoverable warning),
// per-device passphrase entry on a new device (needsPassphrase), quiet
// status with no toasts/header chrome (D-12), the D-11 pre-merge restore
// affordance, and the two D-14 self-serve deletion levels.
//
// Mounted alongside SyncSetup in a later plan (47-07) — this plan only
// builds the component itself.
// ---------------------------------------------------------------------------

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

interface CloudSyncSetupProps {
  /** Injectable for tests; defaults to the app database. */
  database?: Dexie;
  /** Opens the existing App-level SignInModal (D-09) — deferred from ProPitchModal's onSignIn; this component never collects an email itself. */
  onOpenSignIn: () => void;
}

export function CloudSyncSetup({ database = db, onOpenSignIn }: CloudSyncSetupProps) {
  const { isPro } = useEntitlement();
  const cloud = useCloudSync(database);

  const setupPassphraseId = useId();
  const entryPassphraseId = useId();

  const [showPitch, setShowPitch] = useState(false);

  const [passphrase, setPassphrase] = useState('');
  const [strength, setStrength] = useState<PassphraseStrengthResult | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);

  const [entryPassphrase, setEntryPassphrase] = useState('');
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  const [showTurnOffConfirm, setShowTurnOffConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [liveHostedQuoteCount, setLiveHostedQuoteCount] = useState(0);

  const isSyncing = cloud.status === 'syncing';

  // Live-scores the setup passphrase as the user types. Ignores stale
  // results (a fast-typing user can trigger overlapping async checks).
  useEffect(() => {
    if (!passphrase) {
      setStrength(null);
      return;
    }
    let cancelled = false;
    void checkPassphraseStrength(passphrase).then(result => {
      if (!cancelled) setStrength(result);
    });
    return () => {
      cancelled = true;
    };
  }, [passphrase]);

  const handleSetupSubmit = async () => {
    setIsSubmittingSetup(true);
    setSetupError(null);
    try {
      const err = await cloud.setupCloudSync(passphrase);
      if (err) {
        setSetupError(err);
        return;
      }
      setPassphrase('');
      setStrength(null);
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  const handleEntrySubmit = async () => {
    setIsSubmittingEntry(true);
    try {
      const err = await cloud.enterPassphrase(entryPassphrase);
      if (!err) setEntryPassphrase('');
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  // D-14 level 2: surface any live hosted quotes (from THIS device's local
  // data, no extra network round trip needed) in the confirmation before the
  // destructive delete-account call.
  const openDeleteAccountConfirm = async () => {
    try {
      const count = await database
        .table<{ publishStatus?: string }, string>('quotes')
        .toCollection()
        .filter(q => q.publishStatus === 'published')
        .count();
      setLiveHostedQuoteCount(count);
    } catch {
      setLiveHostedQuoteCount(0);
    }
    setShowDeleteAccountConfirm(true);
  };

  const handleDeleteAccount = async () => {
    if (!supabase) throw new Error('Cloud sync is unavailable.');
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error(error.message || 'Account deletion failed — please try again.');
    // The account (and every server-side record tied to it) is gone —
    // reload so the whole app shell re-derives its now-signed-out state,
    // same pattern as restorePreMerge's post-destructive-op reload.
    window.location.reload();
  };

  const deleteAccountBody = liveHostedQuoteCount > 0
    ? `This permanently deletes your account, your cloud sync data, and ${liveHostedQuoteCount} live hosted quote link${liveHostedQuoteCount === 1 ? '' : 's'} (they will stop working immediately). Your local data on this device is never touched. This cannot be undone.`
    : 'This permanently deletes your account and your cloud sync data. Your local data on this device is never touched. This cannot be undone.';

  const strengthLabel = strength ? STRENGTH_LABELS[strength.score] : null;
  const canSubmitSetup = passphrase.length > 0 && strength !== null && strength.ok && !isSubmittingSetup;

  return (
    <div className="border-t border-slate-700 pt-6 space-y-3">
      <div className="relative inline-block">
        <h3 className="text-sm font-semibold text-white mb-1">Cloud sync</h3>
        <NewBadge feature="cloud-sync" className="absolute top-0 left-full ml-2 pointer-events-none" />
      </div>
      <p className="text-sm text-slate-400">
        Real-time sync across all your devices — end-to-end encrypted, so we can&apos;t read your data.
      </p>

      {/* D-10: a pending first-connect/risky merge is the most important
          thing on this screen when it exists — render it FIRST, above the
          status/action buttons below, so it's never mistaken for a buried
          footnote (UAT gap-closure 47-07). */}
      {cloud.pendingMerge && (
        <SyncMergeSummary
          plan={cloud.pendingMerge.plan}
          onConfirm={() => void cloud.confirmMerge()}
          onCancel={cloud.cancelMerge}
        />
      )}

      {!isPro ? (
        <>
          <Button
            btnSize="sm"
            variant="secondary"
            onClick={() => setShowPitch(true)}
            aria-label="Set up cloud sync (Pro feature)"
          >
            Set up cloud sync
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-600/30 text-blue-300 rounded">
              Pro
            </span>
          </Button>
          <ProPitchModal
            isOpen={showPitch}
            onClose={() => setShowPitch(false)}
            onSignIn={() => {
              setShowPitch(false);
              onOpenSignIn();
            }}
          />
        </>
      ) : !cloud.isEnabled ? (
        <div className="space-y-3">
          <div>
            <label htmlFor={setupPassphraseId} className="block text-xs text-slate-400 mb-1">
              Choose a passphrase
            </label>
            <Input
              id={setupPassphraseId}
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              placeholder="A long, memorable passphrase"
            />
            {strengthLabel && (
              <p className="text-xs text-slate-500 mt-1">
                Strength: <span className={strength?.ok ? 'text-green-400' : 'text-amber-400'}>{strengthLabel}</span>
                {strength && !strength.ok && strength.feedback.warning ? ` — ${strength.feedback.warning}` : ''}
              </p>
            )}
          </div>
          <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            We can&apos;t recover your passphrase. If you lose it, you&apos;ll reset cloud sync and
            re-upload from a device that still has your data — nothing local is ever lost.
          </p>
          {setupError && (
            <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {setupError}
            </div>
          )}
          <Button btnSize="sm" onClick={() => void handleSetupSubmit()} disabled={!canSubmitSetup}>
            {isSubmittingSetup ? 'Setting up…' : 'Set up cloud sync'}
          </Button>
        </div>
      ) : cloud.needsPassphrase ? (
        <div className="space-y-3">
          <div>
            <label htmlFor={entryPassphraseId} className="block text-xs text-slate-400 mb-1">
              Enter your cloud sync passphrase
            </label>
            <Input
              id={entryPassphraseId}
              type="password"
              autoComplete="current-password"
              value={entryPassphrase}
              onChange={e => setEntryPassphrase(e.target.value)}
              placeholder="Passphrase for this account"
            />
          </div>
          <p className="text-sm text-slate-400">
            This device hasn&apos;t unlocked your synced data yet — enter the passphrase you set up
            cloud sync with on another device.
          </p>
          <Button
            btnSize="sm"
            onClick={() => void handleEntrySubmit()}
            disabled={entryPassphrase.length === 0 || isSubmittingEntry}
          >
            {isSubmittingEntry ? 'Unlocking…' : 'Unlock cloud sync'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p role="status" className="text-sm text-slate-300">
            {isSyncing
              ? 'Syncing…'
              : cloud.lastSyncedAt
                ? `Last synced ${formatRelativeDate(new Date(cloud.lastSyncedAt))}`
                : 'Not yet synced'}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              btnSize="sm"
              variant="secondary"
              onClick={() => void cloud.syncNow()}
              disabled={isSyncing || cloud.pendingMerge !== null}
            >
              Sync now
            </Button>
            <Button btnSize="sm" variant="ghost" onClick={() => void cloud.restorePreMerge()} disabled={isSyncing}>
              Restore pre-merge state
            </Button>
          </div>
          {cloud.pendingMerge && (
            <p className="text-xs text-amber-300">
              Review the pending sync changes above before syncing again.
            </p>
          )}
        </div>
      )}

      {cloud.conflictNote && !cloud.pendingMerge && (
        <p className="text-xs text-slate-500">{cloud.conflictNote}</p>
      )}

      {cloud.error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {cloud.error}
        </div>
      )}

      {/* D-07/D-14: reachable from EITHER the locked (needsPassphrase) or
          fully-synced state — not gated behind the synced-only branch above
          — and placed directly under the primary status/action area (not
          buried past error/pendingMerge) so it's actually discoverable
          (UAT gap-closure 47-07: founder could not find this control). */}
      {isPro && cloud.isEnabled && (
        <div className="border-t border-slate-700/50 pt-3 flex flex-wrap items-center gap-2">
          <Button
            btnSize="sm"
            variant="ghost"
            onClick={() => setShowTurnOffConfirm(true)}
            aria-label="Turn off cloud sync and delete cloud copy"
            className="text-slate-400 hover:text-slate-200"
          >
            Turn off cloud sync &amp; delete cloud copy
          </Button>
        </div>
      )}

      {isPro && (
        <div className={`flex flex-col items-start gap-2 ${cloud.isEnabled ? '' : 'border-t border-slate-700/50 pt-3'}`}>
          <Button
            btnSize="sm"
            variant="ghost"
            onClick={() => void openDeleteAccountConfirm()}
            aria-label="Delete account"
            className="text-red-400 hover:text-red-300"
          >
            Delete account
          </Button>
        </div>
      )}

      <ConfirmModal
        isOpen={showTurnOffConfirm}
        title="Turn off cloud sync?"
        body="This deletes your encrypted cloud copy and disables cloud sync on this account. Your local data on every device is never touched — you can set cloud sync up again any time with a new passphrase."
        confirmLabel="Turn off & delete cloud copy"
        onConfirm={() => cloud.turnOffAndDeleteCloud()}
        onClose={() => setShowTurnOffConfirm(false)}
      />

      <ConfirmModal
        isOpen={showDeleteAccountConfirm}
        title="Delete account?"
        body={deleteAccountBody}
        confirmLabel="Delete account"
        onConfirm={() => handleDeleteAccount()}
        onClose={() => setShowDeleteAccountConfirm(false)}
      />
    </div>
  );
}
