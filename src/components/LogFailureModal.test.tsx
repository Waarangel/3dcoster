import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { db } from '../db/database';
import { LogFailureModal } from './LogFailureModal';
import { ToastProvider } from './ui';
import type { Material, PrinterInstance } from '../types';

// ---------------------------------------------------------------------------
// LogFailureModal — Phase 39 Plan 02 Task 2 (FAIL-01).
// Same raw createRoot + act + real-Dexie-via-fake-indexeddb harness used by
// DeclineQuoteModal.test.tsx / useFailureEvents.test.tsx.
// ---------------------------------------------------------------------------

const PRINTERS: PrinterInstance[] = [
  { id: 'printer-1', printerConfigId: 'cfg-1', nickname: 'Office A1', printHours: 100 },
  { id: 'printer-2', printerConfigId: 'cfg-2', nickname: 'Garage P1S', printHours: 50 },
];

const MATERIALS: Material[] = [
  { id: 'mat-pla', name: 'PLA Basic', category: 'filament' },
  { id: 'mat-petg', name: 'PETG', category: 'filament' },
];

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

function selectByLabelText(labelText: string): HTMLSelectElement | undefined {
  const label = Array.from(document.body.querySelectorAll('label')).find(
    (l) => (l.textContent ?? '').includes(labelText),
  );
  const forId = label?.getAttribute('for');
  return forId ? (document.getElementById(forId) as HTMLSelectElement) : undefined;
}

function inputByLabelText(labelText: string): HTMLInputElement | undefined {
  const label = Array.from(document.body.querySelectorAll('label')).find(
    (l) => (l.textContent ?? '').includes(labelText),
  );
  const forId = label?.getAttribute('for');
  return forId ? (document.getElementById(forId) as HTMLInputElement) : undefined;
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === text,
  ) as HTMLButtonElement | undefined;
}

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function renderModal(props: Partial<React.ComponentProps<typeof LogFailureModal>> = {}) {
  await act(async () => {
    root!.render(
      <ToastProvider>
        <LogFailureModal
          isOpen
          onClose={vi.fn()}
          printerInstances={PRINTERS}
          filamentAssets={MATERIALS}
          {...props}
        />
      </ToastProvider>,
    );
  });
}

describe('LogFailureModal', () => {
  it('renders the required trio (% completion, printer Select, material Select) plus the reason enum and optional notes', async () => {
    await renderModal();

    expect(selectByLabelText('Printer')).toBeDefined();
    expect(selectByLabelText('Material')).toBeDefined();
    expect(inputByLabelText('% completion')).toBeDefined();
    const reasonSelect = selectByLabelText('Reason');
    expect(reasonSelect).toBeDefined();
    expect(reasonSelect!.querySelectorAll('option')).toHaveLength(6);
    expect(document.body.querySelector('textarea')).not.toBeNull();
  });

  it('submitting calls logFailure with the trio + reason + notes values', async () => {
    await renderModal();

    const printerSelect = selectByLabelText('Printer')!;
    const materialSelect = selectByLabelText('Material')!;
    const percentInput = inputByLabelText('% completion')!;
    const reasonSelect = selectByLabelText('Reason')!;
    const notesTextarea = document.body.querySelector('textarea') as HTMLTextAreaElement;

    await act(async () => { setValue(printerSelect, 'printer-2'); });
    await act(async () => { setValue(materialSelect, 'mat-petg'); });
    await act(async () => { setValue(percentInput, '75'); });
    await act(async () => { setValue(reasonSelect, 'clog'); });
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(notesTextarea, 'nozzle clogged mid-print');
      notesTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submitBtn = buttonByText('Log failure')!;
    await act(async () => { submitBtn.click(); });
    // allow the async logFailure write to settle
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const rows = await db.failureEvents.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      printerInstanceId: 'printer-2',
      materialId: 'mat-petg',
      percentComplete: 75,
      reason: 'clog',
      notes: 'nozzle clogged mid-print',
    });
  });

  it('opening from a job row pre-fills printerInstanceId + dominant material; user can change them', async () => {
    await renderModal({
      prefill: { printerInstanceId: 'printer-1', materialId: 'mat-pla', jobId: 'job-1', jobFilamentGrams: 100 },
    });

    const printerSelect = selectByLabelText('Printer')!;
    const materialSelect = selectByLabelText('Material')!;
    expect(printerSelect.value).toBe('printer-1');
    expect(materialSelect.value).toBe('mat-pla');

    // User can change the prefilled values.
    await act(async () => { setValue(printerSelect, 'printer-2'); });
    expect(printerSelect.value).toBe('printer-2');
  });

  it('submitting a job-linked failure computes gramsWasted = jobFilamentGrams × %completion and passes it to logFailure (which deducts stock)', async () => {
    await renderModal({
      prefill: { printerInstanceId: 'printer-1', materialId: 'mat-pla', jobId: 'job-1', jobFilamentGrams: 100 },
    });

    const percentInput = inputByLabelText('% completion')!;
    await act(async () => { setValue(percentInput, '40'); });

    const submitBtn = buttonByText('Log failure')!;
    await act(async () => { submitBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const rows = await db.failureEvents.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].gramsWasted).toBeCloseTo(40, 5); // 100g * 40% = 40g
    expect(rows[0].jobId).toBe('job-1');

    // D-03: paired stockEvent deduction written.
    const stockRows = await db.stockEvents.toArray();
    expect(stockRows).toHaveLength(1);
    expect(stockRows[0]).toMatchObject({ assetId: 'mat-pla', delta: -40 });
  });

  it('a multi-material job failure deducts each filament by its OWN grams × %completion (WR-08)', async () => {
    await renderModal({
      prefill: {
        printerInstanceId: 'printer-1',
        materialId: 'mat-pla', // dominant, per D-08
        jobId: 'job-1',
        jobFilamentGrams: 500, // 300 PLA + 200 PETG
        jobFilaments: [
          { filamentId: 'mat-pla', grams: 300 },
          { filamentId: 'mat-petg', grams: 200 },
        ],
      },
    });

    const percentInput = inputByLabelText('% completion')!;
    await act(async () => { setValue(percentInput, '50'); });

    const submitBtn = buttonByText('Log failure')!;
    await act(async () => { submitBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const stockRows = (await db.stockEvents.toArray()).sort((a, b) => a.assetId.localeCompare(b.assetId));
    expect(stockRows).toHaveLength(2);
    expect(stockRows[0]).toMatchObject({ assetId: 'mat-petg', delta: -100 }); // 200 × 50%
    expect(stockRows[1]).toMatchObject({ assetId: 'mat-pla', delta: -150 }); // 300 × 50%
  });
});
