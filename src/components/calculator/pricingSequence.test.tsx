// ---------------------------------------------------------------------------
// pricingSequence.test.tsx — the PERF-11 repro (D-04).
//
// Drives rapid consecutive keystrokes into the SAME interlinked pricing field
// (margin/profit/price) via native DOM input events, and asserts the
// displayed price/profit/margin triple stays mutually consistent AFTER EVERY
// step — not just after the sequence settles. This is the exact failure mode
// that shipped as a regression in v1.9 (dep-trim desynced profit/margin on
// consecutive same-field edits, caught by release-diff review, not tests) and
// the reason FOUND-02 exists: the correct fix belongs with the useReducer
// redesign in useCostDerivedValues, not a dep-array trim.
//
// Mounted against the CURRENT (pre-split) CostCalculator via the same
// CostCalculatorUnderTest single-import indirection as outputEquivalence.test.tsx.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider } from '../ui';
import { makeScenarioProps } from './__fixtures__/goldenScenarios';
import { priceFromMargin, priceFromProfit, marginFromPrice } from '../../utils/pricingInterlink';
import type { MarketplaceType } from '../../types';

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
  // WR-06: mounts with editingJob: null trigger the real persistence effect,
  // which writes the full form blob to sessionStorage — and jsdom's
  // sessionStorage persists across tests within a file, so without this clear
  // each mount restores the PREVIOUS test's form state before driving its own.
  sessionStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

function inputForLabel(labelText: string): HTMLInputElement {
  const labels = Array.from(container!.querySelectorAll('label'));
  const label = labels.find(l => (l.textContent ?? '').trim() === labelText);
  if (!label) throw new Error(`No label found with text "${labelText}"`);
  const id = label.getAttribute('for');
  if (!id) throw new Error(`Label "${labelText}" has no htmlFor`);
  // Use getElementById (via document, since the input is a descendant of
  // container which is itself attached to document.body) rather than a CSS
  // id-selector — jsdom does not implement CSS.escape, and useId()-generated
  // ids can contain characters (":") that are invalid in a raw selector.
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) throw new Error(`No input found for label "${labelText}" (id=${id})`);
  return input;
}

// Native input-event dispatch — the project's userEvent substitute
// (createRoot/act + descriptor-setter idiom, per JobsManager.test.tsx /
// PrinterSettings.test.tsx precedent).
async function setInputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function readText(labelText: string): string {
  const nodes = Array.from(container!.querySelectorAll('div'));
  const labelNode = nodes.find(n => (n.textContent ?? '').trim() === labelText);
  if (!labelNode) throw new Error(`No readout label "${labelText}" found`);
  const valueNode = labelNode.previousElementSibling;
  if (!valueNode) throw new Error(`Readout label "${labelText}" has no preceding value node`);
  return (valueNode.textContent ?? '').trim();
}

function parseMoney(rendered: string): number {
  // Strips a leading currency symbol/minus and parses the numeric portion.
  const match = rendered.match(/-?[\d,]+\.?\d*/);
  if (!match) throw new Error(`Could not parse money from "${rendered}"`);
  return parseFloat(match[0].replace(/,/g, ''));
}

function parsePercent(rendered: string): number {
  const match = rendered.match(/-?[\d,]+\.?\d*/);
  if (!match) throw new Error(`Could not parse percent from "${rendered}"`);
  return parseFloat(match[0].replace(/,/g, ''));
}

interface Triple {
  price: number;
  profit: number;
  margin: number;
}

function readTriple(): Triple {
  return {
    price: parseMoney(readText('Sell Price')),
    profit: parseMoney(readText('Net Profit')),
    margin: parsePercent(readText('Net Margin')),
  };
}

// Recomputes the expected triple via the SAME pure pricingInterlink functions
// the component itself calls, given a trueCost, the field that was last
// edited, and that field's new value. fee defaults to NO_FEE unless supplied
// (marketplace: 'none' scenarios).
function expectedTripleFromMargin(trueCost: number, marginPercent: number, fee?: { pctFees: number; fixedFees: number }) {
  const { price, netProfit } = priceFromMargin(trueCost, marginPercent, fee);
  return { price: parseFloat(price.toFixed(2)), profit: parseFloat(netProfit.toFixed(2)), margin: parseFloat(marginPercent.toFixed(1)) };
}
function expectedTripleFromProfit(trueCost: number, targetProfit: number, fee?: { pctFees: number; fixedFees: number }) {
  const { price, marginPercent } = priceFromProfit(trueCost, targetProfit, fee);
  return { price: parseFloat(price.toFixed(2)), profit: parseFloat(targetProfit.toFixed(2)), margin: parseFloat(marginPercent.toFixed(1)) };
}
function expectedTripleFromPrice(trueCost: number, sellingPrice: number, fee?: { pctFees: number; fixedFees: number }) {
  const { netProfit, marginPercent } = marginFromPrice(trueCost, sellingPrice, fee);
  return { price: parseFloat(sellingPrice.toFixed(2)), profit: parseFloat(netProfit.toFixed(2)), margin: parseFloat(marginPercent.toFixed(1)) };
}

// A reasonable float tolerance for repeated round-trip rounding through the
// component's toFixed(2)/toFixed(1) formatting.
const EPS = 0.05;

function assertTripleClose(actual: Triple, expected: Triple, context: string) {
  expect(actual.price, `${context}: price`).toBeCloseTo(expected.price, 1);
  expect(actual.profit, `${context}: profit`).toBeCloseTo(expected.profit, 1);
  expect(Math.abs(actual.margin - expected.margin) < EPS * 20, `${context}: margin actual=${actual.margin} expected=${expected.margin}`).toBe(true);
}

describe('pricingSequence — same-field rapid re-edit + field-to-field chains (D-04, PERF-11 repro)', () => {
  // -------------------------------------------------------------------------
  // marketplace: 'none' (zero-fee) run — Pitfall 5
  // -------------------------------------------------------------------------
  describe("marketplace: 'none' (zero-fee path)", () => {
    it('same-field rapid re-edit: margin 30 -> 35 -> 40 stays consistent after EVERY step', async () => {
      const props = makeScenarioProps({
        editingJob: null,
        materials: [{ id: 'mat-pla', name: 'PLA', category: 'filament', filamentType: 'PLA', unit: 'g', costPerUnit: 0.02, currency: 'USD' }],
      });
      await act(async () => {
        root!.render(
          <ToastProvider>
            <CostCalculatorUnderTest {...props} />
          </ToastProvider>
        );
      });

      // Seed a non-zero trueCost by filling print time (filament defaults to
      // row 0 with no filamentId selected — instead seed via printTimeHours +
      // an existing default printer so electricity/depreciation > 0).
      const printTimeInput = inputForLabel('Print Time (hours)');
      await setInputValue(printTimeInput, '5');

      const marginInput = inputForLabel('Profit Margin');

      for (const marginValue of ['30', '35', '40']) {
        await setInputValue(marginInput, marginValue);
        const triple = readTriple();
        // trueCost is invariant across this sequence (only `margin` changes,
        // not print time/materials/etc.), so it can be inverted from any
        // step's rendered price via the same closed-form priceFromMargin
        // uses: price = trueCost / (1 - margin/100) for the no-fee case.
        const trueCost = triple.price > 0 && triple.margin < 100
          ? triple.price * (1 - parseFloat(marginValue) / 100)
          : 0;
        const expected = expectedTripleFromMargin(trueCost, parseFloat(marginValue));
        assertTripleClose(triple, expected, `margin=${marginValue}`);
      }
    });

    it('typed price BEFORE any cost basis is retained, persisted, and drives derivation once trueCost > 0 (CR-01)', async () => {
      // Self-contained: a previous test in this file persists its form state
      // (print time etc.) to sessionStorage; clear it so this mount really
      // starts with trueCost === 0.
      sessionStorage.clear();
      const props = makeScenarioProps({ editingJob: null });
      await act(async () => {
        root!.render(
          <ToastProvider>
            <CostCalculatorUnderTest {...props} />
          </ToastProvider>
        );
      });

      // Fresh form, no filament / print time → trueCost === 0. Type the target
      // price FIRST ("I want to sell this at $25").
      const priceInput = inputForLabel('Selling Price');
      await setInputValue(priceInput, '25');

      // Pre-split contract: the value is STORED (controlled input keeps it,
      // sessionStorage persists it) even though no derivation can run yet.
      expect(priceInput.value, 'typed price must survive in the controlled input while trueCost is 0').toBe('25');
      const persisted = JSON.parse(sessionStorage.getItem('costCalculatorForm') ?? '{}');
      expect(persisted.sellingPrice, 'typed price must reach sessionStorage persistence').toBe(25);
      expect(persisted.lastEdited).toBe('price');

      // Now enter a cost basis — the RECALC effect must derive profit/margin
      // FROM the typed price (lastEdited: 'price'), not snap it back to a
      // margin-derived value.
      await setInputValue(inputForLabel('Print Time (hours)'), '5');
      const triple = readTriple();
      expect(triple.price, 'typed price must survive the trueCost 0 -> positive transition').toBeCloseTo(25, 1);
      // no-fee scenario: profit = price - trueCost, so trueCost inverts cleanly.
      const trueCost = 25 - triple.profit;
      assertTripleClose(triple, expectedTripleFromPrice(trueCost, 25), 'price typed before cost basis');
    });

    it('field-to-field chain: margin -> profit -> price stays consistent with pricingInterlink math', async () => {
      const props = makeScenarioProps({ editingJob: null });
      await act(async () => {
        root!.render(
          <ToastProvider>
            <CostCalculatorUnderTest {...props} />
          </ToastProvider>
        );
      });
      await setInputValue(inputForLabel('Print Time (hours)'), '5');

      // Step 1: edit margin
      await setInputValue(inputForLabel('Profit Margin'), '25');
      const afterMargin = readTriple();
      const trueCost = afterMargin.price * (1 - 25 / 100);
      assertTripleClose(afterMargin, expectedTripleFromMargin(trueCost, 25), 'after margin edit');

      // Step 2: edit profit directly
      await setInputValue(inputForLabel('Target Profit'), '20');
      const afterProfit = readTriple();
      assertTripleClose(afterProfit, expectedTripleFromProfit(trueCost, 20), 'after profit edit');

      // Step 3: edit price directly
      await setInputValue(inputForLabel('Selling Price'), '50');
      const afterPrice = readTriple();
      assertTripleClose(afterPrice, expectedTripleFromPrice(trueCost, 50), 'after price edit');
    });
  });

  // -------------------------------------------------------------------------
  // Marketplace-fee-bearing run (Etsy) — Pitfall 5, via editingJob seeding
  // (marketplace is internal form state, not a CostCalculatorProps field —
  // see goldenScenarios.ts header note).
  // -------------------------------------------------------------------------
  describe('fee-bearing path (Etsy marketplace)', () => {
    it('same-field rapid re-edit stays net-of-fee consistent after EVERY step', async () => {
      const props = makeScenarioProps({
        editingJob: {
          id: 'job-seq-etsy',
          name: 'Sequence Fixture',
          createdAt: new Date('2026-06-01T00:00:00Z'),
          updatedAt: new Date('2026-06-01T00:00:00Z'),
          filaments: [{ filamentId: 'mat-pla', grams: 250, pricePerGram: 0.02, currency: 'USD' }],
          printTimeHours: 5,
          printerInstanceId: 'instance-1',
          modelCost: 0,
          modelCostPerUnit: false,
          prepTimeMinutes: 0,
          postProcessingMinutes: 0,
          materialsUsed: [],
          failureRate: 5,
          costPerUnit: 10,
          sellingPrice: 20,
          copiesSold: 0,
          marketplace: 'etsy' as MarketplaceType,
          currency: 'USD',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
      await act(async () => {
        root!.render(
          <ToastProvider>
            <CostCalculatorUnderTest {...props} />
          </ToastProvider>
        );
      });

      const marginInput = inputForLabel('Profit Margin');
      const fee = { pctFees: 0.065 + 0.03, fixedFees: 0.25 + 0.2 }; // etsyTransactionPercent + etsyPaymentPercent, etsyPaymentFixed + etsyListingFee (defaults)

      for (const marginValue of ['20', '25', '30']) {
        await setInputValue(marginInput, marginValue);
        const triple = readTriple();
        // Recompute trueCost from the rendered price using the fee-aware
        // inverse relationship (price = (trueCost+fixed)/(1-pct-m/100)).
        const denom = 1 - fee.pctFees - parseFloat(marginValue) / 100;
        const trueCost = triple.price * denom - fee.fixedFees;
        const expected = expectedTripleFromMargin(trueCost, parseFloat(marginValue), fee);
        assertTripleClose(triple, expected, `etsy margin=${marginValue}`);
      }
    });
  });
});
