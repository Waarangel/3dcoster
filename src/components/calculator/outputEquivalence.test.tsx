// ---------------------------------------------------------------------------
// SNAPSHOT CAPTURED FROM PRE-SPLIT CostCalculator per D-01 — do not regenerate
// during the refactor; a diff here is a FOUND-01 equivalence failure.
//
// Mounts the CURRENT (pre-split) CostCalculator with every CURATED_SCENARIOS
// and RANDOM_SCENARIOS fixture and reads back the rendered, user-visible
// numbers as STRINGS (D-03 — '$12.47', '23.5%', never parsed floats). The
// captured strings are the oracle every later plan in this phase (the
// CostCalculator split) must reproduce byte-for-byte.
//
// This test is authored to be RE-RUNNABLE against the split component later
// with zero changes to its assertions — the component under test is bound
// through a single `CostCalculatorUnderTest` indirection below so Plan 04 can
// repoint the import to `./CostCalculator` (post folder-move) by changing one
// line.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider } from '../ui';
import { CURATED_SCENARIOS, RANDOM_SCENARIOS } from './__fixtures__/goldenScenarios';

// The current CostCalculator receives all its data via props (materials,
// printers, fxTable, etc.) — it does NOT read Dexie hooks for those. The one
// exception is useStockEvents (low-stock hint on filament rows), which reads
// Dexie directly via useLiveQuery. Mocked here so mounting doesn't require a
// real IndexedDB; stockByAssetId empty means no low-stock hints render (a
// user-visible but non-numeric text branch, out of scope for this equivalence
// oracle which only asserts on the numeric cost/pricing readouts).
vi.mock('../../hooks/useStockEvents', () => ({
  useStockEvents: () => ({ stockByAssetId: new Map<string, number>(), events: [], logManualAdjustment: vi.fn() }),
}));

// jsdom does not implement window.matchMedia. CostCalculator's editing-banner
// scroll effect (FIX-04) calls it whenever editingJob is truthy — which every
// fixture in this suite sets (editingJob is the mount-time seeding channel,
// see goldenScenarios.ts file header). Polyfilled locally (not in a shared
// setup file) since no other mounted-component test in the project currently
// needs it; "matches: false" picks the 'smooth' scroll branch, which is inert
// under jsdom (no real scrolling/layout) and has no bearing on the numeric
// readouts this oracle asserts on.
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

// jsdom also does not implement Element.scrollIntoView (called by the same
// effect immediately after the matchMedia check above). No-op polyfill —
// same rationale as matchMedia above.
if (typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// Single import-binding indirection (Plan 04 repoints this one line after the
// git mv to `./CostCalculator`).
const { CostCalculator: CostCalculatorUnderTest } = await import('./CostCalculator');

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  // WR-06: start from a clean sessionStorage so no persisted form blob from
  // another test can leak into the useState/useReducer initializers.
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

// Well-formed rendered-number pattern: optional leading non-digit currency
// symbol/sign, then digits (with optional thousands separators), optional
// decimal portion. Matches strings like '$12.47', '-¥352', '23.5%', '∞'.
const WELL_FORMED_NUMBER = /^[^\d∞]*([\d,]+\.?\d*|∞)[^\d]*$/;

interface CapturedReadout {
  trueCost: string | null;
  sellPrice: string | null;
  netProfit: string | null;
  netMargin: string | null;
  costPerUnitBreakdown: string | null;
  breakEvenCopies: string | null;
}

// Reads the user-visible numeric readouts from the mounted DOM by structural
// text-content search (no @testing-library, no data-testid additions needed —
// every value's DOM neighborhood already carries a stable label per the
// existing CostCalculator.tsx JSX, e.g. "True Cost" / "Sell Price" / "Net
// Profit" / "Net Margin" / "Cost Per Unit" / the Break-even Units count).
function readCapturedValues(el: HTMLElement): CapturedReadout {
  const textOf = (labelText: string): string | null => {
    const nodes = Array.from(el.querySelectorAll('div'));
    const labelNode = nodes.find(n => (n.textContent ?? '').trim() === labelText);
    if (!labelNode) return null;
    const valueNode = labelNode.previousElementSibling;
    return valueNode ? (valueNode.textContent ?? '').trim() : null;
  };

  const breakEvenLabel = Array.from(el.querySelectorAll('div')).find(
    n => (n.textContent ?? '').trim() === 'Break-even Units'
  );
  let breakEvenCopies: string | null = null;
  if (breakEvenLabel) {
    // Structure: outer flex row has [ {label block}, {big number block} ].
    const row = breakEvenLabel.closest('.flex.items-center.justify-between');
    const numberNode = row?.querySelector('.text-4xl');
    breakEvenCopies = numberNode ? (numberNode.textContent ?? '').trim() : null;
  }

  const costPerUnitLabel = Array.from(el.querySelectorAll('span')).find(
    n => (n.textContent ?? '').trim() === 'Cost Per Unit'
  );
  const costPerUnitBreakdown = costPerUnitLabel
    ? (costPerUnitLabel.nextElementSibling?.textContent ?? '').trim()
    : null;

  return {
    trueCost: textOf('True Cost'),
    sellPrice: textOf('Sell Price'),
    netProfit: textOf('Net Profit'),
    netMargin: textOf('Net Margin'),
    costPerUnitBreakdown,
    breakEvenCopies,
  };
}

function assertWellFormedOrNull(label: string, value: string | null) {
  if (value === null) return; // Not every scenario renders every readout (e.g. sellingPrice === 0 hides the panel).
  expect(value, `${label} should be non-empty when present`).not.toBe('');
  expect(value, `${label} ("${value}") should look like a rendered number`).toMatch(WELL_FORMED_NUMBER);
}

const ALL_SCENARIOS = [...CURATED_SCENARIOS, ...RANDOM_SCENARIOS];

describe('CostCalculator output-equivalence oracle (pre-split baseline, D-01/D-03)', () => {
  // A running snapshot map keyed by scenario name — this is the byte-for-byte
  // baseline the split components must reproduce. Vitest's toMatchSnapshot
  // writes/compares against __snapshots__/outputEquivalence.test.tsx.snap,
  // committed alongside this file as the pre-split oracle.
  //
  // *** SCENARIO ORDER IS FROZEN (WR-05) ***
  // The loop below re-renders into the SAME root for every scenario, so React
  // UPDATES one component instance rather than remounting — useState/useReducer
  // initializers run only for scenario 1, and fields the next editingJob leaves
  // `undefined` (shippingMethod, packagingMaterials, marketplace, ... — see
  // useCostForm.ts populate effect) CARRY FORWARD from the previous scenario.
  // The committed baseline was captured against the pre-split component with
  // this exact accumulation, so split-vs-pre-split parity holds — but ONLY
  // while scenario order is byte-identical. Per-scenario snapshot values do
  // NOT mean "this fixture in isolation". Do not reorder/insert/remove
  // scenarios, and do not switch to per-scenario remounts, without
  // re-capturing the baseline against the pre-split component at the diff
  // base (05677f2:src/components/CostCalculator.tsx) in a dedicated,
  // auditable commit. See goldenScenarios.ts header for the same warning.
  it('mounts every curated + random scenario and captures well-formed rendered readouts', async () => {
    const snapshot: Record<string, CapturedReadout> = {};

    for (const scenario of ALL_SCENARIOS) {
      await act(async () => {
        root!.render(
          <ToastProvider>
            <CostCalculatorUnderTest {...scenario.props} />
          </ToastProvider>
        );
      });

      const captured = readCapturedValues(container!);
      snapshot[scenario.name] = captured;

      assertWellFormedOrNull(`${scenario.name}: True Cost`, captured.trueCost);
      assertWellFormedOrNull(`${scenario.name}: Sell Price`, captured.sellPrice);
      assertWellFormedOrNull(`${scenario.name}: Net Profit`, captured.netProfit);
      assertWellFormedOrNull(`${scenario.name}: Net Margin`, captured.netMargin);
      assertWellFormedOrNull(`${scenario.name}: Cost Per Unit`, captured.costPerUnitBreakdown);
      assertWellFormedOrNull(`${scenario.name}: Break-even Units`, captured.breakEvenCopies);

      // Every fixture seeds costPerUnit/sellingPrice > 0 via editingJob, so the
      // financial-targets summary panel (trueCost > 0 && sellingPrice > 0 gate
      // in CostCalculator.tsx) should always be present — a null here means the
      // fixture failed to seed the component as intended (a fixture bug, not a
      // component bug) and should fail loudly rather than silently pass.
      expect(captured.trueCost, `${scenario.name}: True Cost must render (fixture should seed trueCost > 0)`).not.toBeNull();
      expect(captured.sellPrice, `${scenario.name}: Sell Price must render (fixture should seed sellingPrice > 0)`).not.toBeNull();
    }

    expect(snapshot).toMatchSnapshot();
  });
});
