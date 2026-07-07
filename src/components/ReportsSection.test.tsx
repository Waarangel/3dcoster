import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { db } from '../db/database';
import { ReportsSection } from './ReportsSection';
import { ToastProvider } from './ui';
import type { FailureEvent, PrinterInstance, Material } from '../types';

// ---------------------------------------------------------------------------
// ReportsSection — Phase 39 Plan 02 Task 3 (FAIL-04).
// Failures ledger sub-section: grouped per printer + per material, standalone
// log button, edit/delete affordances, no new top-level tab (D-04).
// ---------------------------------------------------------------------------

const PRINTERS: PrinterInstance[] = [
  { id: 'printer-1', printerConfigId: 'cfg-1', nickname: 'Office A1', printHours: 100 },
];

const MATERIALS: Material[] = [
  { id: 'mat-pla', name: 'PLA Basic', category: 'filament' },
];

function makeFailure(overrides: Partial<FailureEvent> = {}): FailureEvent {
  return {
    id: 'f-1',
    printerInstanceId: 'printer-1',
    materialId: 'mat-pla',
    percentComplete: 60,
    reason: 'adhesion',
    failedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(async () => {
  await db.failureEvents.clear();
  await db.stockEvents.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  if (container) { container.remove(); container = null; }
});

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}

async function renderSection(failureEvents: FailureEvent[] = []) {
  await act(async () => {
    root!.render(
      <ToastProvider>
        <ReportsSection
          allSales={[]}
          jobs={[]}
          userCurrency="USD"
          fxTable={null}
          failureEvents={failureEvents}
          printerInstances={PRINTERS}
          filamentAssets={MATERIALS}
        />
      </ToastProvider>,
    );
  });
}

describe('ReportsSection — Failures section', () => {
  it('renders a "Failures" heading listing failure events grouped per printer and per material (D-04, in-Reports not a new tab)', async () => {
    await renderSection([makeFailure()]);

    expect(document.body.textContent ?? '').toContain('Failures');
    expect(document.body.textContent ?? '').toContain('By printer');
    expect(document.body.textContent ?? '').toContain('By material');
    expect(document.body.textContent ?? '').toContain('Office A1');
    expect(document.body.textContent ?? '').toContain('PLA Basic');

    // No new top-level tab — the section is a plain in-page heading, not a
    // tab/tablist role.
    expect(document.body.querySelector('[role="tab"]')).toBeNull();
  });

  it('shows an empty state when there are no failures logged yet', async () => {
    await renderSection([]);
    expect(document.body.textContent ?? '').toContain('No failures logged yet.');
  });

  it('a standalone "Log failure" button opens LogFailureModal with no job prefill', async () => {
    await renderSection([]);

    const logBtn = buttonByText('Log failure');
    expect(logBtn).toBeDefined();
    await act(async () => { logBtn!.click(); });

    expect(document.body.textContent ?? '').toContain('Log a failed print');
    // No job-linked grams field should render (standalone shows "Filament wasted" input instead).
    expect(document.body.textContent ?? '').toContain('Filament wasted');
  });

  it('per-entry delete uses a shared DeleteButton with a label and reverses the paired stock deduction via useFailureEvents.deleteFailure', async () => {
    const id = 'f-delete-me';
    await act(async () => {
      await db.failureEvents.add(makeFailure({ id }));
      await db.stockEvents.add({
        id: `failure-${id}`,
        assetId: 'mat-pla',
        delta: -30,
        kind: 'manual',
        refId: `failure-${id}`,
        timestamp: new Date(),
      });
    });

    await renderSection([makeFailure({ id })]);

    const deleteBtn = document.body.querySelector('button[aria-label^="Delete failure logged"]') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();
    await act(async () => { deleteBtn.click(); });

    const confirmBtn = buttonByText('Delete');
    expect(confirmBtn).toBeDefined();
    await act(async () => { confirmBtn!.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(await db.failureEvents.count()).toBe(0);
    expect(await db.stockEvents.count()).toBe(0);
  });

  it('renders notes as plain text — no dangerouslySetInnerHTML in the source', () => {
    const source = readFileSync(join(__dirname, 'ReportsSection.tsx'), 'utf-8');
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
