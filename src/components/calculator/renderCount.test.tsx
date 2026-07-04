// Deliberate, narrow render-count exception — pins the PERF-11 double-render
// regression that 819 behavior-level tests did not catch (RESEARCH Pitfall 4).
// NOT general house style; scoped to the same-field pricing re-edit path only.
//
// The current (pre-split) CostCalculator has no extracted "pricing section"
// subcomponent to independently render-count (that extraction is FOUND-01's
// job in a later plan of this phase) — the whole component re-renders as one
// unit. This probe therefore counts commits of the WHOLE mounted component
// tree on a single pricing-field keystroke, as the closest available proxy
// to "the pricing section" until Plan 03/04 extract a PricingSection
// component this probe can be re-pointed at (narrowing the Profiler's
// subtree to just that section). Counting is done via React's built-in
// <Profiler onRender> callback, which fires once per commit that touches the
// profiled subtree — the correct, idiomatic tool for this job (a manual
// useRef-in-effect counter on a wrapper component was tried first and does
// NOT work here: the wrapper's own render count doesn't track a child's
// independent setState-driven re-renders, since the wrapper itself never
// re-renders when only CostCalculator's internal state changes).
//
// TIGHTENED (Plan 03, FOUND-02): the pre-fix baseline recorded here was 3
// commits per keystroke — (1) the input's own state commit, (2) the "locked"
// derivation effect committing setSellingPrice/setTargetProfit, and (3) the
// marketplace fee-shape re-fire effect committing again because
// marketplaceFeeParts was keyed on `sellingPrice` (which had just changed in
// commit 2). Plan 03 replaced both effects + the ref-based fee-shape escape
// hatch with a single useReducer pricing interlink (dispatchPricing called
// directly from the field's onChange handler, one RECALC effect for the
// remaining external-trigger case). Measured post-fix: a single margin
// keystroke now commits exactly ONCE. The assertion below is tightened to
// === 1 unconditionally — a regression back to multiple commits should fail
// this test loudly, not silently widen back to a baseline-acceptance branch.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, Profiler } from 'react';
import { ToastProvider } from '../ui';
import { makeScenarioProps } from './__fixtures__/goldenScenarios';

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

const { CostCalculator: CostCalculatorUnderTest } = await import('../CostCalculator');

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
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
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) throw new Error(`No input found for label "${labelText}" (id=${id})`);
  return input;
}

async function setInputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Render-counting via React's built-in Profiler — the correct, idiomatic
// tool for "count commits of this subtree" (fires its onRender callback once
// per commit that touches the profiled subtree, whether triggered by a
// state update inside CostCalculator or a parent re-render). This is a
// better fit here than a manual useRef-in-effect counter: a wrapper
// component's own render count does NOT track a child's independent state
// updates (verified — the naive counter approach stayed at 0 because
// CostCalculator's internal setState calls never re-render the wrapper).
// Follows the same "vi.fn()-style call-count assertion" spirit used
// elsewhere in the project (JobsManager.test.tsx), just via React's
// profiling API instead of a spy function.
describe('renderCount — PERF-11 tripwire (D-15, RESEARCH Pitfall 4)', () => {
  it('records the current CostCalculator render count for a single same-field pricing keystroke', async () => {
    const props = makeScenarioProps({ editingJob: null });
    let commitCount = 0;
    const onRenderCallback = () => {
      commitCount += 1;
    };

    await act(async () => {
      root!.render(
        <ToastProvider>
          <Profiler id="CostCalculator-probe" onRender={onRenderCallback}>
            <CostCalculatorUnderTest {...props} />
          </Profiler>
        </ToastProvider>
      );
    });

    // Seed a non-zero trueCost so the pricing derivation effects actually run.
    await setInputValue(inputForLabel('Print Time (hours)'), '5');

    commitCount = 0; // Reset after the seeding keystroke's own commits settle.

    // The tripwire: ONE keystroke into the SAME pricing field (margin).
    await setInputValue(inputForLabel('Profit Margin'), '35');

    const rendersFromSingleKeystroke = commitCount;

    // TIGHTENED (Plan 03, FOUND-02): the useReducer pricing interlink dispatches
    // synchronously from the field's onChange handler — no effect-driven
    // re-derivation chain remains for a same-field re-edit. Exactly one commit
    // per keystroke, unconditionally. A regression back to multiple commits
    // (e.g. a reintroduced effect-driven derivation) must fail this test.
    expect(rendersFromSingleKeystroke, 'single keystroke renders exactly once (useReducer pricing interlink)').toBe(1);
  });
});
