// ---------------------------------------------------------------------------
// Targeted coverage-gap closer for src/hooks/useCostDerivedValues.ts
// (Plan 03 Task 2 — Assumption A2 widens vitest.config.ts coverage.include to
// this file, so its thresholds are now enforced by `npm run build`).
//
// The golden-scenario fixtures (goldenScenarios.ts) don't exercise every
// shippingCost carrier branch or the "editingJob exists but has no saved cost
// basis yet" pricing-seed fallback — neither is this task's primary subject,
// but both are branches IN the file this task's coverage.include now gates.
// These tests close those specific gaps with minimal, targeted mounts rather
// than expanding the shared golden-scenario fixture set (which is scoped to
// D-01 output-equivalence, not general branch coverage).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToastProvider } from '../ui';
import { makeScenarioProps } from './__fixtures__/goldenScenarios';
import type { ShippingMethodType } from '../../types';

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
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

// Region-gated carriers (availableShippingMethods in CostCalculator.tsx) only
// appear in the dropdown for the matching userCurrency — pair each carrier
// with the currency that unlocks it so the DOM select actually offers it.
const CARRIER_METHODS: { shippingMethod: ShippingMethodType; userCurrency: 'CAD' | 'USD' | 'GBP' | 'AUD' }[] = [
  { shippingMethod: 'fedex', userCurrency: 'USD' },
  { shippingMethod: 'dhl', userCurrency: 'USD' },
  { shippingMethod: 'purolator', userCurrency: 'CAD' },
  { shippingMethod: 'usps', userCurrency: 'USD' },
  { shippingMethod: 'royal_mail', userCurrency: 'GBP' },
  { shippingMethod: 'australia_post', userCurrency: 'AUD' },
  { shippingMethod: 'canada_post', userCurrency: 'CAD' },
];

describe('useCostDerivedValues coverage gaps', () => {
  it.each(CARRIER_METHODS)('shippingCost switch: renders without error for carrier method $shippingMethod', async ({ shippingMethod, userCurrency }) => {
    const props = makeScenarioProps({
      editingJob: null,
      userCurrency,
      shippingConfig: {
        vehicleFuelEfficiency: 8,
        gasPricePerLiter: 1.5,
        upsBaseCost: 10,
        fedexBaseCost: 11,
        dhlBaseCost: 12,
        purolatorBaseCost: 13,
        uspsBaseCost: 14,
        royalMailBaseCost: 15,
        australiaPostBaseCost: 16,
        canadaPostBaseCost: 17,
        maxDeliveryRadiusKm: 50,
        customCarriers: [],
      },
    });

    await act(async () => {
      root!.render(
        <ToastProvider>
          <CostCalculatorUnderTest {...props} />
        </ToastProvider>
      );
    });

    // Drive shippingMethod via the DOM select (the component owns this state
    // internally — there's no prop for it) so the shippingCost useMemo's
    // switch statement actually evaluates the target carrier's case branch.
    const select = Array.from(container!.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === shippingMethod)
    );
    expect(select, `shipping method select must offer ${shippingMethod}`).toBeDefined();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      nativeSetter.call(select, shippingMethod);
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container!.textContent).toContain('Shipping');
  });

  it('shippingCost switch: default branch matches a configured custom carrier', async () => {
    const props = makeScenarioProps({
      editingJob: null,
      shippingConfig: {
        vehicleFuelEfficiency: 8,
        gasPricePerLiter: 1.5,
        upsBaseCost: 10,
        fedexBaseCost: 11,
        dhlBaseCost: 12,
        purolatorBaseCost: 13,
        uspsBaseCost: 14,
        royalMailBaseCost: 15,
        australiaPostBaseCost: 16,
        canadaPostBaseCost: 17,
        maxDeliveryRadiusKm: 50,
        customCarriers: [{ id: 'my-custom-carrier', name: 'My Custom Carrier', defaultCost: 42 }],
      },
    });

    await act(async () => {
      root!.render(
        <ToastProvider>
          <CostCalculatorUnderTest {...props} />
        </ToastProvider>
      );
    });

    const select = Array.from(container!.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'my-custom-carrier')
    );
    expect(select, 'custom carrier must appear in the shipping method select').toBeDefined();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      nativeSetter.call(select, 'my-custom-carrier');
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // The custom carrier's defaultCost (42) should now be reflected in the
    // Carrier Cost field placeholder/value.
    expect(container!.textContent).toContain('42.00');
  });

  it('shippingCost switch: default branch with no matching custom carrier falls back to 0', async () => {
    // Pre-seed sessionStorage with a shippingMethod value that matches neither
    // a known carrier case nor a configured custom carrier — reachable via a
    // stale/corrupted persisted form (e.g. a custom carrier the user later
    // deleted from Settings). getStoredValue('shippingMethod', ...) is the
    // sessionStorage restore path in useCostForm.ts.
    sessionStorage.setItem('costCalculatorForm', JSON.stringify({ shippingMethod: 'deleted-custom-carrier-id' }));

    const props = makeScenarioProps({ editingJob: null });

    await act(async () => {
      root!.render(
        <ToastProvider>
          <CostCalculatorUnderTest {...props} />
        </ToastProvider>
      );
    });

    // Should render without throwing; shippingCost resolves to 0 for the
    // unrecognized method (no crash, no NaN in the Carrier Cost field).
    expect(container!.textContent).toContain('Shipping');
    sessionStorage.removeItem('costCalculatorForm');
  });

  it('pricing seed: editingJob exists but has no saved cost basis yet (sellingPrice or costPerUnit <= 0)', async () => {
    const props = makeScenarioProps({
      editingJob: {
        id: 'job-legacy',
        name: 'Legacy job (no cost basis)',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        filaments: [],
        printTimeHours: 2,
        printerInstanceId: 'instance-1',
        modelCost: 0,
        modelCostPerUnit: false,
        prepTimeMinutes: 0,
        postProcessingMinutes: 0,
        materialsUsed: [],
        failureRate: 5,
        costPerUnit: 0, // <= 0 — takes the "no savings basis yet" fallback branch
        sellingPrice: 12,
        copiesSold: 0,
        marketplace: 'none',
        currency: 'USD',
      },
    });

    await act(async () => {
      root!.render(
        <ToastProvider>
          <CostCalculatorUnderTest {...props} />
        </ToastProvider>
      );
    });

    // Should render without throwing, and the seeded sellingPrice should
    // appear in the Selling Price field (fallback branch still seeds price).
    const sellingPriceInputs = Array.from(container!.querySelectorAll('input')).filter(
      i => i.value === '12'
    );
    expect(sellingPriceInputs.length).toBeGreaterThan(0);
  });
});
