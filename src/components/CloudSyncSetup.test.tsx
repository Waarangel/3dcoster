import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MergePlan } from '../utils/syncMerge';
import { BACKUP_STORES } from '../utils/backupSchema';

// ---------------------------------------------------------------------------
// CloudSyncSetup — Phase 47 Plan 06 (D-06, D-07, D-10, D-12, D-14, D-15).
//
// Raw createRoot + act per project precedent (BrandingSection.test.tsx).
// useCloudSync and useEntitlement are mocked at the hook boundary (mirrors
// BillingPanel.test.tsx) — this is a component test, not a re-test of
// useCloudSync's own orchestration (already covered by useCloudSync.test.tsx).
// checkPassphraseStrength is mocked deterministically so the strength-gate
// test doesn't depend on the real zxcvbn dictionary. A real fake-indexeddb
// Dexie `quotes` table is injected so the D-14 level-2 live-hosted-quote
// count reads real data, not a mock.
// ---------------------------------------------------------------------------

// NewBadge's own visibility is date-gated (features.ts release date +
// NEW_FEATURE_MAX_AGE_DAYS/SEEN_HOURS) — mocked here so the badge-position
// test below is deterministic regardless of wall-clock date, and asserts
// only on the className CloudSyncSetup passes to it.
vi.mock('./NewBadge', () => ({
  NewBadge: ({ className }: { className?: string }) => (
    <span data-testid="new-badge" className={className} />
  ),
}));

let mockIsPro = false;
vi.mock('../hooks/useEntitlement', () => ({
  useEntitlement: () => ({
    isPro: mockIsPro,
    plan: null,
    status: null,
    currentPeriodEnd: null,
    refresh: vi.fn(),
  }),
}));

interface MockCloudSyncState {
  status: 'idle' | 'syncing';
  isEnabled: boolean;
  needsPassphrase: boolean;
  lastSyncedAt: string | null;
  pendingMerge: { plan: MergePlan; remoteVersion: number; isFirstConnect: boolean } | null;
  conflictNote: string | null;
  error: string | null;
}

let mockCloudState: MockCloudSyncState;
const mockSetupCloudSync = vi.fn<(passphrase: string) => Promise<string | null>>();
const mockEnterPassphrase = vi.fn<(passphrase: string) => Promise<string | null>>();
const mockSyncNow = vi.fn(async () => {});
const mockCheckOnLaunch = vi.fn(async () => {});
const mockConfirmMerge = vi.fn(async () => {});
const mockCancelMerge = vi.fn();
const mockRestorePreMerge = vi.fn(async () => {});
const mockResetCloudSync = vi.fn(async () => {});
const mockTurnOffAndDeleteCloud = vi.fn(async () => {});

vi.mock('../hooks/useCloudSync', () => ({
  useCloudSync: () => ({
    ...mockCloudState,
    setupCloudSync: mockSetupCloudSync,
    enterPassphrase: mockEnterPassphrase,
    syncNow: mockSyncNow,
    checkOnLaunch: mockCheckOnLaunch,
    confirmMerge: mockConfirmMerge,
    cancelMerge: mockCancelMerge,
    restorePreMerge: mockRestorePreMerge,
    resetCloudSync: mockResetCloudSync,
    turnOffAndDeleteCloud: mockTurnOffAndDeleteCloud,
  }),
}));

let mockStrengthOk = false;
vi.mock('../utils/syncCrypto', () => ({
  checkPassphraseStrength: vi.fn(async (_passphrase: string) => ({
    score: mockStrengthOk ? 4 : 1,
    ok: mockStrengthOk,
    feedback: { warning: mockStrengthOk ? '' : 'Choose a stronger passphrase.', suggestions: [] },
  })),
}));

const mockFunctionsInvoke = vi.fn(async (..._args: unknown[]) => ({ data: { deleted: true }, error: null }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) } },
}));

const { CloudSyncSetup } = await import('./CloudSyncSetup');

let dbCounter = 0;
function makeTestDb(): Dexie {
  const database = new Dexie(`CloudSyncSetupTest-${++dbCounter}`);
  database.version(1).stores({
    quotes: 'id',
  });
  return database;
}

function defaultCloudState(): MockCloudSyncState {
  return {
    status: 'idle',
    isEnabled: false,
    needsPassphrase: false,
    lastSyncedAt: null,
    pendingMerge: null,
    conflictNote: null,
    error: null,
  };
}

function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockIsPro = false;
  mockStrengthOk = false;
  mockCloudState = defaultCloudState();
  mockSetupCloudSync.mockReset().mockResolvedValue(null);
  mockEnterPassphrase.mockReset().mockResolvedValue(null);
  mockFunctionsInvoke.mockClear();
});

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  vi.clearAllMocks();
});

function renderSetup(onOpenSignIn: () => void = vi.fn(), database: Dexie = makeTestDb()) {
  act(() => {
    root!.render(<CloudSyncSetup database={database} onOpenSignIn={onOpenSignIn} />);
  });
  return { database };
}

describe('CloudSyncSetup — free / signed-out path (D-15)', () => {
  it('shows the Pro chip, not the passphrase form, and clicking it opens ProPitchModal', async () => {
    renderSetup();

    const chip = container!.querySelector<HTMLButtonElement>('button[aria-label="Set up cloud sync (Pro feature)"]');
    expect(chip).not.toBeNull();
    expect(container!.querySelector('input[type="password"]')).toBeNull();

    await act(async () => { chip!.click(); });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Unlock 3DCoster Pro');
  });

  it('defers sign-in to onOpenSignIn from the pitch modal, without collecting an email itself', async () => {
    const onOpenSignIn = vi.fn();
    renderSetup(onOpenSignIn);

    const chip = container!.querySelector<HTMLButtonElement>('button[aria-label="Set up cloud sync (Pro feature)"]');
    await act(async () => { chip!.click(); });

    const signInBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Sign in for Pro"]');
    expect(signInBtn).not.toBeNull();
    await act(async () => { signInBtn!.click(); });

    expect(onOpenSignIn).toHaveBeenCalledTimes(1);
  });
});

describe('CloudSyncSetup — Pro, not yet set up (D-06/D-07)', () => {
  it('shows the strength meter and unrecoverable-passphrase warning, with submit disabled until strength passes', async () => {
    mockIsPro = true;
    renderSetup();

    expect(document.body.textContent).toContain("We can't recover your passphrase");

    const input = container!.querySelector<HTMLInputElement>('input[type="password"]');
    expect(input).not.toBeNull();
    const submit = Array.from(container!.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Set up cloud sync') && !b.hasAttribute('aria-label'));
    expect(submit).toBeTruthy();

    // Weak passphrase — submit stays disabled.
    mockStrengthOk = false;
    await act(async () => {
      setInputValue(input!, 'weak');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(submit!.disabled).toBe(true);

    // Strong passphrase — submit becomes enabled and calls setupCloudSync.
    mockStrengthOk = true;
    await act(async () => {
      setInputValue(input!, 'a-long-and-genuinely-unguessable-passphrase-42!');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(submit!.disabled).toBe(false);

    await act(async () => { submit!.click(); });
    expect(mockSetupCloudSync).toHaveBeenCalledWith('a-long-and-genuinely-unguessable-passphrase-42!');
  });
});

describe('CloudSyncSetup — Pro, new device (needsPassphrase, Pitfall 5)', () => {
  it('renders a passphrase ENTRY field (not setup) and calls enterPassphrase on submit', async () => {
    mockIsPro = true;
    mockCloudState = { ...defaultCloudState(), isEnabled: true, needsPassphrase: true };
    renderSetup();

    const input = container!.querySelector<HTMLInputElement>('input[type="password"]');
    expect(input).not.toBeNull();
    expect(document.body.textContent).toContain("hasn't unlocked your synced data yet");
    // Not the setup-flow warning.
    expect(document.body.textContent).not.toContain("We can't recover your passphrase");

    await act(async () => {
      setInputValue(input!, 'my-existing-passphrase');
    });
    const submit = Array.from(container!.querySelectorAll('button')).find(b => b.textContent?.includes('Unlock cloud sync'));
    await act(async () => { submit!.click(); });

    expect(mockEnterPassphrase).toHaveBeenCalledWith('my-existing-passphrase');
  });

  it('surfaces a friendly decrypt-failure message from a wrong passphrase via the hook error state', () => {
    mockIsPro = true;
    mockCloudState = {
      ...defaultCloudState(),
      isEnabled: true,
      needsPassphrase: true,
      error: 'Could not decrypt your cloud sync data — check your passphrase, or reset cloud sync from Settings.',
    };
    renderSetup();

    expect(document.body.textContent).toContain('Could not decrypt your cloud sync data');
  });
});

describe('CloudSyncSetup — Pro, enabled + key present (quiet status, D-12)', () => {
  it('shows "Last synced" status with no toast/header chrome, and a Sync now button', () => {
    mockIsPro = true;
    mockCloudState = {
      ...defaultCloudState(),
      isEnabled: true,
      needsPassphrase: false,
      lastSyncedAt: new Date().toISOString(),
      conflictNote: '2 added, 1 updated',
    };
    renderSetup();

    expect(document.body.textContent).toMatch(/Last synced/);
    expect(document.body.textContent).toContain('2 added, 1 updated');
    expect(document.querySelector('[class*="toast"]')).toBeNull();

    const syncNow = Array.from(container!.querySelectorAll('button')).find(b => b.textContent?.includes('Sync now'));
    expect(syncNow).toBeTruthy();
  });
});

describe('CloudSyncSetup — D-14 self-serve deletion, confirm-gated', () => {
  it('shows both deletion controls for a Pro signed-in user, each confirm-gated (never auto-fires)', async () => {
    mockIsPro = true;
    mockCloudState = { ...defaultCloudState(), isEnabled: true, lastSyncedAt: new Date().toISOString() };
    renderSetup();

    const turnOffBtn = container!.querySelector<HTMLButtonElement>('button[aria-label="Turn off cloud sync and delete cloud copy"]');
    const deleteAccountBtn = container!.querySelector<HTMLButtonElement>('button[aria-label="Delete account"]');
    expect(turnOffBtn).not.toBeNull();
    expect(deleteAccountBtn).not.toBeNull();

    // Neither destructive action has fired just by rendering.
    expect(mockTurnOffAndDeleteCloud).not.toHaveBeenCalled();
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();

    await act(async () => { turnOffBtn!.click(); });
    const turnOffDialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => d.textContent?.includes('Turn off cloud sync?'));
    expect(turnOffDialog).toBeTruthy();
    expect(mockTurnOffAndDeleteCloud).not.toHaveBeenCalled();

    const confirmBtn = Array.from(turnOffDialog!.querySelectorAll('button')).find(b => b.textContent?.includes('Turn off & delete cloud copy'));
    await act(async () => { confirmBtn!.click(); });
    expect(mockTurnOffAndDeleteCloud).toHaveBeenCalledTimes(1);
  });

  it('surfaces the live hosted-quote count from local data in the Delete account confirmation', async () => {
    mockIsPro = true;
    mockCloudState = { ...defaultCloudState(), isEnabled: true };
    const database = makeTestDb();
    await database.table('quotes').bulkAdd([
      { id: 'q1', publishStatus: 'published' },
      { id: 'q2', publishStatus: 'unpublished' },
      { id: 'q3', publishStatus: 'published' },
    ]);
    renderSetup(vi.fn(), database);

    const deleteAccountBtn = container!.querySelector<HTMLButtonElement>('button[aria-label="Delete account"]');
    await act(async () => {
      deleteAccountBtn!.click();
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => d.textContent?.includes('Delete account?'));
    expect(dialog).toBeTruthy();
    expect(dialog!.textContent).toContain('2 live hosted quote links');
  });
});

/** A syntactically-complete MergePlan with every store zeroed — real enough
 *  for SyncMergeSummary to render without crashing on an undefined
 *  `plan.summary[store]` lookup. */
function makeEmptyMergePlan(): MergePlan {
  const summary = {} as MergePlan['summary'];
  for (const store of BACKUP_STORES) {
    summary[store] = { added: 0, updated: 0, deleted: 0, conflicts: 0 };
  }
  return {
    winnersByStore: {} as MergePlan['winnersByStore'],
    deleteIdsByStore: {} as MergePlan['deleteIdsByStore'],
    tombstonesToWrite: [],
    summary,
  };
}

describe('CloudSyncSetup — pending merge visibility (UAT gap-closure 47-07)', () => {
  it('renders the pending-merge review ABOVE the Sync now / Restore buttons, not below them', () => {
    mockIsPro = true;
    mockCloudState = {
      ...defaultCloudState(),
      isEnabled: true,
      pendingMerge: {
        plan: makeEmptyMergePlan(),
        remoteVersion: 2,
        isFirstConnect: true,
      },
      conflictNote: '1 added',
    };
    renderSetup();

    const reviewHeading = Array.from(container!.querySelectorAll('h3')).find(h => h.textContent === 'Review sync changes');
    const syncNowBtn = Array.from(container!.querySelectorAll('button')).find(b => b.textContent?.includes('Sync now'));
    expect(reviewHeading).toBeTruthy();
    expect(syncNowBtn).toBeTruthy();

    // DOM order: the review panel's position precedes the Sync now button's.
    const position = reviewHeading!.compareDocumentPosition(syncNowBtn!);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('disables "Sync now" while a merge is pending, with an explanatory hint (no silent no-op, UAT bug #2)', () => {
    mockIsPro = true;
    mockCloudState = {
      ...defaultCloudState(),
      isEnabled: true,
      pendingMerge: {
        plan: makeEmptyMergePlan(),
        remoteVersion: 2,
        isFirstConnect: true,
      },
    };
    renderSetup();

    const syncNowBtn = Array.from(container!.querySelectorAll('button')).find(b => b.textContent?.includes('Sync now'));
    expect(syncNowBtn!.disabled).toBe(true);
    expect(document.body.textContent).toContain('Review the pending sync changes above before syncing again.');
  });
});

describe('CloudSyncSetup — off switch reachable from the locked (needsPassphrase) state too (UAT bug #7)', () => {
  it('shows "Turn off cloud sync & delete cloud copy" even before this device has unlocked cloud sync', () => {
    mockIsPro = true;
    mockCloudState = { ...defaultCloudState(), isEnabled: true, needsPassphrase: true };
    renderSetup();

    const turnOffBtn = container!.querySelector<HTMLButtonElement>('button[aria-label="Turn off cloud sync and delete cloud copy"]');
    expect(turnOffBtn).not.toBeNull();
  });
});

describe('CloudSyncSetup — NEW badge does not overlap the heading (UAT bug #9)', () => {
  it('positions the badge to the side of the heading (left-full offset), not a negative-right overlay', () => {
    renderSetup();
    const badge = container!.querySelector('[data-testid="new-badge"]');
    // The fix replaces the overlapping `-right-N` offset with a `left-full`
    // side-anchor — the badge's left edge sits at the heading box's right
    // edge, so it can never render on top of the heading text regardless of
    // heading length.
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('left-full');
    expect(badge?.className).not.toMatch(/-right-\d/);
  });
});

describe('CloudSyncSetup — no destructive controls for a free/signed-out user', () => {
  it('does not render either D-14 deletion control when not Pro', () => {
    mockIsPro = false;
    renderSetup();

    expect(container!.querySelector('button[aria-label="Delete account"]')).toBeNull();
    expect(container!.querySelector('button[aria-label="Turn off cloud sync and delete cloud copy"]')).toBeNull();
  });
});
