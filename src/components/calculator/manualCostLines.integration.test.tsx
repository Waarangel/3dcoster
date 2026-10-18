// ---------------------------------------------------------------------------
// Phase 47.1 (47.1-01 tracer): end-to-end CostCalculator mount for the manual
// one-off post-processing cost line. Drives the real UI: add a one-off line ->
// Cost Breakdown -> pricing reducer -> Save -> saved PrintJob.
//
// D-07: one-off lines are charged FLAT (not multiplied by the failure-rate
// factor), so a $200 line adds exactly $200.00 to costPerUnit at a 5% rate.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider } from '../ui';
import { makeScenarioProps } from './__fixtures__/goldenScenarios';
import type { PrintJob } from '../../types';

vi.mock('../../hooks/useStockEvents', () => ({
  useStockEvents: () => ({ stockByAssetId: new Map<string, number>(), events: [], logManualAdjustment: vi.fn() }),
}));

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
if (typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

const { CostCalculator: CostCalculatorUnderTest } = await import('./CostCalculator');

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  sessionStorage.clear();
  // finishAfterSave scrolls to the top after a successful save.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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
});

// A new-job draft: one PLA filament row at a 5% failure rate (explicit so the
// D-07 check runs at a non-zero rate whatever the form default is), with a
// fixed selling price so the True Cost / Sell Price / Net Profit readout shows.
function seedDraft() {
  sessionStorage.setItem('costCalculatorForm', JSON.stringify({
    printName: 'Auger widget',
    failureRate: 5,
    printTimeHours: 2,
    sellingPrice: 50,
    lastEdited: 'price',
    filamentRows: [{ uid: 'seed-row', filamentId: 'mat-pla', grams: 100, editedPrice: 0.02, editedCurrency: 'USD' }],
  }));
}

async function mountCalculator(onSaveJob: (job: PrintJob, hours: number) => void) {
  const props = makeScenarioProps({ editingJob: null, onSaveJob });
  await act(async () => {
    root!.render(
      <ToastProvider>
        <CostCalculatorUnderTest {...props} />
      </ToastProvider>
    );
  });
}

async function typeInto(el: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function inputByLabel(label: string): HTMLInputElement {
  const el = container!.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(el, `input with aria-label "${label}" must exist`).not.toBeNull();
  return el!;
}

function buttonByText(text: string): HTMLButtonElement {
  const el = Array.from(container!.querySelectorAll('button')).find(b => b.textContent?.trim() === text);
  expect(el, `button "${text}" must exist`).toBeDefined();
  return el as HTMLButtonElement;
}

// Cost Breakdown rows are `<div><span>label</span><span>value</span></div>`.
function breakdownValue(labelStart: string): string {
  const labelSpan = Array.from(container!.querySelectorAll('span')).find(s => s.textContent?.startsWith(labelStart));
  expect(labelSpan, `breakdown row "${labelStart}" must exist`).toBeDefined();
  return labelSpan!.nextElementSibling!.textContent ?? '';
}

// The pricing readout cards are `<div><div>$value</div><div>Label</div></div>`.
function readout(label: string): number {
  const labelDiv = Array.from(container!.querySelectorAll('div')).find(d => d.children.length === 0 && d.textContent === label);
  expect(labelDiv, `readout "${label}" must exist`).toBeDefined();
  return parseFloat(labelDiv!.previousElementSibling!.textContent!.replace(/[^0-9.-]/g, ''));
}

async function clickSave() {
  await act(async () => {
    buttonByText('Save Job for Tracking').click();
  });
}

async function addOneOff(name: string, cost: string) {
  await act(async () => { buttonByText('+ One-off cost').click(); });
  await typeInto(inputByLabel('One-off item name'), name);
  await typeInto(inputByLabel('One-off item cost'), cost);
}

describe('manual one-off post-processing cost (47.1-01 tracer)', () => {
  it('Test A: one-off line flows through breakdown, pricing, and the saved job (flat, D-07)', async () => {
    // --- Baseline: same draft, no line -> costPerUnit to compare against. ---
    seedDraft();
    const baselineSave = vi.fn();
    await mountCalculator(baselineSave);
    await clickSave();
    expect(baselineSave).toHaveBeenCalledTimes(1);
    const baselineCostPerUnit = (baselineSave.mock.calls[0][0] as PrintJob).costPerUnit;
    act(() => { root!.unmount(); });
    root = createRoot(container!);

    // --- With the one-off line ---
    sessionStorage.clear();
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);

    const failureAdjBefore = breakdownValue('+ Failure Adjustment');
    await addOneOff('Auger', '200');

    // (a) the Post-Processing Materials row shows the full one-off cost.
    expect(breakdownValue('Post-Processing Materials')).toBe('$200.00');

    // (b) Pitfall 1 guard: the reducer prices against the SAME trueCost the panel
    // shows. If one calculateCost call missed the line, this gap would be ~$200.
    const trueCost = readout('True Cost');
    const sellPrice = readout('Sell Price');
    const netProfit = readout('Net Profit');
    expect(Math.abs(netProfit - (sellPrice - trueCost))).toBeLessThanOrEqual(0.02);

    // (d) D-07: the failure adjustment does not grow with a one-off cost.
    expect(breakdownValue('+ Failure Adjustment')).toBe(failureAdjBefore);

    // (c) save payload.
    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    const saved = onSaveJob.mock.calls[0][0] as PrintJob;
    expect(saved.manualMaterials).toEqual([{ id: expect.any(String), name: 'Auger', cost: 200 }]);
    expect(Math.abs(saved.costPerUnit - (baselineCostPerUnit + 200))).toBeLessThan(1e-9);
  });

  it('Test B: saving the seeded draft with no one-off lines leaves manualMaterials undefined', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    const saved = onSaveJob.mock.calls[0][0] as PrintJob;
    expect(saved.manualMaterials).toBeUndefined();
  });

  it('enables "+ One-off cost" even when the asset library has no non-filament items', async () => {
    seedDraft();
    const props = makeScenarioProps({
      editingJob: null,
      materials: [{ id: 'mat-pla', name: 'PLA Spool', category: 'filament', filamentType: 'PLA', unit: 'g', costPerUnit: 0.02, currency: 'USD' }],
    });
    await act(async () => {
      root!.render(
        <ToastProvider>
          <CostCalculatorUnderTest {...props} />
        </ToastProvider>
      );
    });
    expect(buttonByText('+ Add Material').disabled).toBe(true);
    expect(buttonByText('+ One-off cost').disabled).toBe(false);
  });
});
