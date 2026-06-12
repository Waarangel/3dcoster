// ---------------------------------------------------------------------------
// BackupRestoreSection — TDD suite written BEFORE the component.
//
// Contract locks:
//  - Restore gates: non-.json extension and oversized files are rejected with
//    a role="alert" error BEFORE any parse/validate work.
//  - A valid file shows a confirm step with record counts from BOTH the
//    parsed backup and the live database.
//  - Cancel never writes; Confirm restores then triggers the injected reload
//    (full page reload re-runs boot reconciles + one-shot settings hooks).
// ---------------------------------------------------------------------------

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import Dexie from 'dexie';
import { BackupRestoreSection } from './BackupRestoreSection';
import { buildBackupFile, serializeBackup } from '../utils/backupExport';
import { MAX_BACKUP_BYTES } from '../utils/backupSchema';

let dbCounter = 0;
function makeTestDb(): Dexie {
  const db = new Dexie(`BackupSectionTest-${++dbCounter}`);
  db.version(10).stores({
    materials: 'id, category, brand, filamentType, currency',
    printers: 'id, name',
    printerInstances: 'id, printerConfigId, nickname',
    jobs: 'id, name, createdAt, printerInstanceId',
    sales: 'id, jobId, soldAt',
    settings: 'key',
    customers: 'id, name, email, lastUsedAt',
    quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
  });
  return db;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root!.unmount());
  container!.remove();
  container = null;
  root = null;
});

function render(ui: React.ReactElement) {
  act(() => root!.render(ui));
}

function fileInput(): HTMLInputElement {
  const input = container!.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not rendered');
  return input as HTMLInputElement;
}

/**
 * Poll until a condition holds instead of sleeping a fixed interval — the
 * pipeline is genuinely async (file.text() + Dexie ops run on real timer
 * turns under fake-indexeddb) and fixed sleeps are flaky on slow CI.
 */
async function waitUntil(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition not met within timeout');
    }
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
}

async function chooseFile(file: File) {
  const input = fileInput();
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Every pipeline outcome surfaces as either an error alert or the confirm step.
  await waitUntil(() => alertText().length > 0 || !!confirmButton());
}

/** The confirm step's destructive CTA — its absence proves we never got there. */
function confirmButton(): HTMLButtonElement | undefined {
  return Array.from(container!.querySelectorAll('button'))
    .find(b => /replace everything/i.test(b.textContent ?? ''));
}

function alertText(): string {
  return Array.from(container!.querySelectorAll('[role="alert"]'))
    .map(el => el.textContent ?? '')
    .join(' ');
}

async function makeValidBackupFileBlob(seedJobs = 2): Promise<File> {
  const source = makeTestDb();
  for (let i = 0; i < seedJobs; i++) {
    await source.table('jobs').put({
      id: `job-${i}`, name: `Job ${i}`,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      filaments: [], printTimeHours: 1, printerInstanceId: 'pi-1', modelCost: 0,
      prepTimeMinutes: 0, postProcessingMinutes: 0, materialsUsed: [],
      failureRate: 0, costPerUnit: 1, sellingPrice: 2, copiesSold: 0,
    });
  }
  const json = serializeBackup(await buildBackupFile(source));
  return new File([json], '3dcoster-backup-2026-06-12.json', { type: 'application/json' });
}

describe('BackupRestoreSection', () => {
  it('renders a download-backup button and a restore file picker', () => {
    render(<BackupRestoreSection database={makeTestDb()} reload={() => {}} />);
    const text = container!.textContent ?? '';
    expect(text).toMatch(/download backup/i);
    expect(text).toMatch(/restore/i);
    expect(fileInput().accept).toContain('.json');
  });

  it('rejects a non-.json file with an alert, before any confirm step appears', async () => {
    render(<BackupRestoreSection database={makeTestDb()} reload={() => {}} />);
    await chooseFile(new File(['x'], 'backup.csv', { type: 'text/csv' }));
    expect(alertText()).toMatch(/\.json/i);
    expect(confirmButton()).toBeUndefined();
  });

  it('rejects an oversized file before parsing', async () => {
    render(<BackupRestoreSection database={makeTestDb()} reload={() => {}} />);
    const big = new File(['x'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(big, 'size', { value: MAX_BACKUP_BYTES + 1 });
    await chooseFile(big);
    expect(alertText()).toMatch(/50 MB|too large/i);
  });

  it('rejects a structurally invalid backup with the validation message', async () => {
    render(<BackupRestoreSection database={makeTestDb()} reload={() => {}} />);
    await chooseFile(new File(['{"nope":true}'], 'backup.json', { type: 'application/json' }));
    expect(alertText().length).toBeGreaterThan(0);
    expect(confirmButton()).toBeUndefined();
  });

  it('valid file shows a confirm step with backup AND current record counts', async () => {
    const db = makeTestDb();
    await db.table('jobs').put({
      id: 'existing-1', name: 'Existing',
      createdAt: new Date(), updatedAt: new Date(),
      filaments: [], printTimeHours: 1, printerInstanceId: 'pi-1', modelCost: 0,
      prepTimeMinutes: 0, postProcessingMinutes: 0, materialsUsed: [],
      failureRate: 0, costPerUnit: 1, sellingPrice: 2, copiesSold: 0,
    });
    render(<BackupRestoreSection database={db} reload={() => {}} />);
    await chooseFile(await makeValidBackupFileBlob(2));

    const text = container!.textContent ?? '';
    expect(confirmButton()).toBeDefined();
    expect(text).toMatch(/2 jobs/i);     // from the backup
    expect(text).toMatch(/1 job\b/i);    // currently in the database
  });

  it('cancel clears the confirm step without writing', async () => {
    const db = makeTestDb();
    render(<BackupRestoreSection database={db} reload={() => {}} />);
    await chooseFile(await makeValidBackupFileBlob(2));

    const cancel = Array.from(container!.querySelectorAll('button'))
      .find(b => /cancel/i.test(b.textContent ?? ''));
    await act(async () => { cancel!.click(); await Promise.resolve(); });

    expect(confirmButton()).toBeUndefined();
    expect(await db.table('jobs').count()).toBe(0);
  });

  it('confirm restores the backup and triggers reload', async () => {
    const db = makeTestDb();
    const reload = vi.fn();
    render(<BackupRestoreSection database={db} reload={reload} />);
    await chooseFile(await makeValidBackupFileBlob(2));

    const confirm = confirmButton();
    await act(async () => {
      confirm!.click();
    });
    await waitUntil(() => reload.mock.calls.length > 0);

    expect(await db.table('jobs').count()).toBe(2);
    expect(reload).toHaveBeenCalled();
  });
});
