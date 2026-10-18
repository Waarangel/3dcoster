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
import { makeScenarioProps, type CostCalculatorProps } from './__fixtures__/goldenScenarios';
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

async function mountCalculator(onSaveJob: (job: PrintJob, hours: number) => void, overrides: Partial<CostCalculatorProps> = {}) {
  const props = makeScenarioProps({ editingJob: null, onSaveJob, ...overrides });
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
  // The newest row is last; a blank name/cost is left untouched (typing '' is a no-op).
  const nameInputs = container!.querySelectorAll<HTMLInputElement>('input[aria-label="One-off item name"]');
  const costInputs = container!.querySelectorAll<HTMLInputElement>('input[aria-label="One-off item cost"]');
  if (name !== '') await typeInto(nameInputs[nameInputs.length - 1], name);
  if (cost !== '') await typeInto(costInputs[costInputs.length - 1], cost);
}

const oneOffRows = () => container!.querySelectorAll('input[aria-label="One-off item name"]');
const toastText = () => Array.from(container!.ownerDocument.querySelectorAll('[role="alert"]')).map(e => e.textContent ?? '').join('|');

async function remountCalculator(onSaveJob: (job: PrintJob, hours: number) => void, overrides: Partial<CostCalculatorProps> = {}) {
  act(() => { root!.unmount(); });
  root = createRoot(container!);
  await mountCalculator(onSaveJob, overrides);
}

// A saved job to edit (mirrors makeEditingJob in goldenScenarios, which is not exported).
function makeEditJob(overrides: Partial<PrintJob> = {}): PrintJob {
  const now = new Date('2026-06-15T00:00:00Z');
  return {
    id: 'job-edit-1',
    name: 'Saved widget',
    createdAt: now,
    updatedAt: now,
    filaments: [{ filamentId: 'mat-pla', grams: 100, pricePerGram: 0.02, currency: 'USD' }],
    printTimeHours: 2,
    printerInstanceId: 'instance-1',
    modelCost: 0,
    modelCostPerUnit: false,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 5,
    costPerUnit: 10,
    sellingPrice: 50,
    copiesSold: 0,
    marketplace: 'none',
    currency: 'USD',
    ...overrides,
  };
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

describe('post-processing one-off lines: save validation, restore, lifecycle (47.1-02 Task 1)', () => {
  it('restores one-off lines (same id, name, cost) after a reload mid-draft', async () => {
    seedDraft();
    await mountCalculator(vi.fn());
    await addOneOff('Auger', '200');
    const draft = JSON.parse(sessionStorage.getItem('costCalculatorForm')!);
    const draftId = draft.manualMaterials[0].id as string;

    const onSaveJob = vi.fn();
    await remountCalculator(onSaveJob);
    expect(oneOffRows()).toHaveLength(1);
    expect(inputByLabel('One-off item name').value).toBe('Auger');
    expect(inputByLabel('One-off item cost').value).toBe('200');

    await clickSave();
    const saved = onSaveJob.mock.calls[0][0] as PrintJob;
    expect(saved.manualMaterials).toEqual([{ id: draftId, name: 'Auger', cost: 200 }]);
  });

  it('loads a legacy draft (no manualMaterials key) with no one-off rows', async () => {
    seedDraft();
    await mountCalculator(vi.fn());
    expect(oneOffRows()).toHaveLength(0);
  });

  it('loads a tampered draft (non-array manualMaterials) without throwing and with no one-off rows', async () => {
    sessionStorage.setItem('costCalculatorForm', JSON.stringify({
      printName: 'Auger widget',
      printTimeHours: 2,
      sellingPrice: 50,
      lastEdited: 'price',
      filamentRows: [{ uid: 'seed-row', filamentId: 'mat-pla', grams: 100, editedPrice: 0.02, editedCurrency: 'USD' }],
      manualMaterials: 'garbage',
    }));
    await mountCalculator(vi.fn());
    expect(oneOffRows()).toHaveLength(0);
    expect(container!.textContent).toContain('Post-Processing Materials');
  });

  it('edit isolation: a draft with one-off lines never leaks into a legacy job being edited', async () => {
    seedDraft();
    await mountCalculator(vi.fn());
    await addOneOff('Auger', '200');

    const onUpdateJob = vi.fn();
    await remountCalculator(vi.fn(), { editingJob: makeEditJob(), onUpdateJob });
    expect(oneOffRows()).toHaveLength(0);

    await act(async () => { buttonByText('Update Job').click(); });
    expect(onUpdateJob).toHaveBeenCalledTimes(1);
    expect((onUpdateJob.mock.calls[0][0] as PrintJob).manualMaterials).toBeUndefined();
  });

  it('edit re-hydrate: restores a saved one-off line, and removing it then Update clears it explicitly', async () => {
    const onUpdateJob = vi.fn();
    const job = makeEditJob({ manualMaterials: [{ id: 'm1', name: 'Auger', cost: 200, libraryPrompted: true }] });
    await mountCalculator(vi.fn(), { editingJob: job, onUpdateJob });
    expect(oneOffRows()).toHaveLength(1);
    expect(inputByLabel('One-off item name').value).toBe('Auger');
    expect(inputByLabel('One-off item cost').value).toBe('200');

    await act(async () => {
      container!.querySelector<HTMLButtonElement>('button[aria-label="Remove Auger"]')!.click();
    });
    expect(oneOffRows()).toHaveLength(0);

    await act(async () => { buttonByText('Update Job').click(); });
    expect(onUpdateJob).toHaveBeenCalledTimes(1);
    const updated = onUpdateJob.mock.calls[0][0] as PrintJob;
    // The key is present and explicitly undefined so { ...editingJob, ...sharedFields } clears it.
    expect('manualMaterials' in updated).toBe(true);
    expect(updated.manualMaterials).toBeUndefined();
  });

  it('clears the one-off rows after a successful save', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    await addOneOff('Auger', '200');
    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    expect(oneOffRows()).toHaveLength(0);
  });

  it('clears the one-off rows when Clear is clicked', async () => {
    seedDraft();
    await mountCalculator(vi.fn());
    await addOneOff('Auger', '200');
    expect(oneOffRows()).toHaveLength(1);
    await act(async () => { buttonByText('Clear').click(); });
    expect(oneOffRows()).toHaveLength(0);
  });

  it('blocks save with an error toast when a one-off row has a cost but no name', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    await addOneOff('', '50');
    await clickSave();
    expect(onSaveJob).not.toHaveBeenCalled();
    expect(toastText()).toContain('Give each one-off post-processing cost a name, or remove the empty row.');
  });

  it('blocks save with an error toast naming a one-off row that has a name but no cost', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    await addOneOff('Glue', '');
    await clickSave();
    expect(onSaveJob).not.toHaveBeenCalled();
    expect(toastText()).toContain('Enter a cost for "Glue", or remove it.');
  });

  it('silently drops a fully empty one-off row and saves with manualMaterials undefined', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    await addOneOff('', '');
    expect(oneOffRows()).toHaveLength(1);
    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    expect((onSaveJob.mock.calls[0][0] as PrintJob).manualMaterials).toBeUndefined();
  });

  it('trims the name and rounds the cost to cents in the saved job', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    await addOneOff('  Auger  ', '19.999');
    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    expect((onSaveJob.mock.calls[0][0] as PrintJob).manualMaterials).toEqual([
      { id: expect.any(String), name: 'Auger', cost: 20 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 47.1-02 Task 2: one-off packaging costs in Shipping -> Packaging Materials (D-01).
// Both sections carry a "+ One-off cost" button; packaging is the LAST one in the DOM.
// ---------------------------------------------------------------------------

const PKG_NAME = 'One-off packaging name';
const PKG_COST = 'One-off packaging cost';
const packagingRows = () => container!.querySelectorAll(`input[aria-label="${PKG_NAME}"]`);

async function addPackagingOneOff(name: string, cost: string) {
  const buttons = Array.from(container!.querySelectorAll('button')).filter(b => b.textContent?.trim() === '+ One-off cost');
  expect(buttons).toHaveLength(2);
  await act(async () => { buttons[buttons.length - 1].click(); });
  const nameInputs = container!.querySelectorAll<HTMLInputElement>(`input[aria-label="${PKG_NAME}"]`);
  const costInputs = container!.querySelectorAll<HTMLInputElement>(`input[aria-label="${PKG_COST}"]`);
  if (name !== '') await typeInto(nameInputs[nameInputs.length - 1], name);
  if (cost !== '') await typeInto(costInputs[costInputs.length - 1], cost);
}

function carrierCostValue(): string {
  const label = Array.from(container!.querySelectorAll('label')).find(l => l.textContent?.startsWith('Carrier Cost'));
  expect(label, 'Carrier Cost label must exist').toBeDefined();
  return (container!.ownerDocument.getElementById(label!.htmlFor) as HTMLInputElement).value;
}

describe('one-off packaging costs (47.1-02 Task 2, D-01)', () => {
  it('shows in the Shipping summary, raises Total Shipping, and is saved flat (not failure-adjusted, D-07)', async () => {
    seedDraft();
    const baselineSave = vi.fn();
    await mountCalculator(baselineSave);
    await clickSave();
    const baselineCostPerUnit = (baselineSave.mock.calls[0][0] as PrintJob).costPerUnit;
    act(() => { root!.unmount(); });
    root = createRoot(container!);

    sessionStorage.clear();
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    const carrierBefore = carrierCostValue();
    await addPackagingOneOff('Gift wrap', '3.5');

    expect(breakdownValue('Packaging:')).toBe('$3.50');
    expect(breakdownValue('Total Shipping:')).toBe('$3.50');
    // D-01: the Carrier Cost field is untouched by one-off packaging lines.
    expect(carrierCostValue()).toBe(carrierBefore);

    // Pitfall 1 (packaging path): the pricing reducer prices against the SAME trueCost the panel shows.
    const trueCost = readout('True Cost');
    const sellPrice = readout('Sell Price');
    const netProfit = readout('Net Profit');
    expect(Math.abs(netProfit - (sellPrice - trueCost))).toBeLessThanOrEqual(0.02);

    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    const saved = onSaveJob.mock.calls[0][0] as PrintJob;
    expect(saved.manualPackaging).toEqual([{ id: expect.any(String), name: 'Gift wrap', cost: 3.5 }]);
    expect(saved.manualMaterials).toBeUndefined();
    // Exactly +3.50 at a 5% failure rate: NOT divided by the failure multiplier.
    expect(Math.abs(saved.costPerUnit - (baselineCostPerUnit + 3.5))).toBeLessThan(1e-9);
  });

  it('enables the packaging "+ One-off cost" button even with an empty consumables library', async () => {
    seedDraft();
    await mountCalculator(vi.fn(), {
      materials: [{ id: 'mat-pla', name: 'PLA Spool', category: 'filament', filamentType: 'PLA', unit: 'g', costPerUnit: 0.02, currency: 'USD' }],
    });
    expect(buttonByText('+ Add Packaging').disabled).toBe(true);
    const buttons = Array.from(container!.querySelectorAll('button')).filter(b => b.textContent?.trim() === '+ One-off cost');
    expect(buttons).toHaveLength(2);
    expect(buttons[buttons.length - 1].disabled).toBe(false);
  });

  it('restores packaging one-off lines (same id, name, cost) after a reload mid-draft', async () => {
    seedDraft();
    await mountCalculator(vi.fn());
    await addPackagingOneOff('Gift wrap', '3.5');
    const draftId = JSON.parse(sessionStorage.getItem('costCalculatorForm')!).manualPackaging[0].id as string;

    const onSaveJob = vi.fn();
    await remountCalculator(onSaveJob);
    expect(packagingRows()).toHaveLength(1);
    await clickSave();
    expect((onSaveJob.mock.calls[0][0] as PrintJob).manualPackaging).toEqual([{ id: draftId, name: 'Gift wrap', cost: 3.5 }]);
  });

  it('loads legacy and tampered drafts with no packaging one-off rows and no crash', async () => {
    seedDraft();
    await mountCalculator(vi.fn());
    expect(packagingRows()).toHaveLength(0);
    act(() => { root!.unmount(); });
    root = createRoot(container!);

    sessionStorage.setItem('costCalculatorForm', JSON.stringify({
      printName: 'Auger widget',
      printTimeHours: 2,
      sellingPrice: 50,
      lastEdited: 'price',
      filamentRows: [{ uid: 'seed-row', filamentId: 'mat-pla', grams: 100, editedPrice: 0.02, editedCurrency: 'USD' }],
      manualPackaging: { not: 'an array' },
    }));
    await mountCalculator(vi.fn());
    expect(packagingRows()).toHaveLength(0);
  });

  it('edit isolation: a draft packaging line never leaks into a legacy job being edited', async () => {
    seedDraft();
    await mountCalculator(vi.fn());
    await addPackagingOneOff('Gift wrap', '3.5');

    const onUpdateJob = vi.fn();
    await remountCalculator(vi.fn(), { editingJob: makeEditJob(), onUpdateJob });
    expect(packagingRows()).toHaveLength(0);
    await act(async () => { buttonByText('Update Job').click(); });
    expect(onUpdateJob).toHaveBeenCalledTimes(1);
    expect((onUpdateJob.mock.calls[0][0] as PrintJob).manualPackaging).toBeUndefined();
  });

  it('edit re-hydrate restores a saved packaging line; removing it then Update clears it explicitly', async () => {
    const onUpdateJob = vi.fn();
    const job = makeEditJob({ manualPackaging: [{ id: 'p1', name: 'Gift wrap', cost: 3.5 }] });
    await mountCalculator(vi.fn(), { editingJob: job, onUpdateJob });
    expect(packagingRows()).toHaveLength(1);
    expect(inputByLabel(PKG_NAME).value).toBe('Gift wrap');
    expect(inputByLabel(PKG_COST).value).toBe('3.5');

    await act(async () => {
      container!.querySelector<HTMLButtonElement>('button[aria-label="Remove Gift wrap"]')!.click();
    });
    expect(packagingRows()).toHaveLength(0);
    await act(async () => { buttonByText('Update Job').click(); });
    const updated = onUpdateJob.mock.calls[0][0] as PrintJob;
    expect('manualPackaging' in updated).toBe(true);
    expect(updated.manualPackaging).toBeUndefined();
  });

  it('clears the packaging one-off rows after save and after Clear', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);
    await addPackagingOneOff('Gift wrap', '3.5');
    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    expect(packagingRows()).toHaveLength(0);

    await addPackagingOneOff('Ribbon', '1');
    expect(packagingRows()).toHaveLength(1);
    await act(async () => { buttonByText('Clear').click(); });
    expect(packagingRows()).toHaveLength(0);
  });

  it('blocks save with packaging-worded toasts for a nameless or costless row, and trims/rounds on success', async () => {
    seedDraft();
    const onSaveJob = vi.fn();
    await mountCalculator(onSaveJob);

    await addPackagingOneOff('', '4');
    await clickSave();
    expect(onSaveJob).not.toHaveBeenCalled();
    expect(toastText()).toContain('Give each one-off packaging cost a name, or remove the empty row.');

    act(() => { root!.unmount(); });
    root = createRoot(container!);
    sessionStorage.clear();
    seedDraft();
    await mountCalculator(onSaveJob);
    await addPackagingOneOff('Box', '');
    await clickSave();
    expect(onSaveJob).not.toHaveBeenCalled();
    expect(toastText()).toContain('Enter a cost for "Box", or remove it.');

    act(() => { root!.unmount(); });
    root = createRoot(container!);
    sessionStorage.clear();
    seedDraft();
    await mountCalculator(onSaveJob);
    await addPackagingOneOff('', '');
    await addPackagingOneOff('  Tape  ', '2.345');
    await clickSave();
    expect(onSaveJob).toHaveBeenCalledTimes(1);
    expect((onSaveJob.mock.calls[0][0] as PrintJob).manualPackaging).toEqual([
      { id: expect.any(String), name: 'Tape', cost: 2.35 },
    ]);
  });
});
