// ---------------------------------------------------------------------------
// Phase 47.1 (47.1-02 Task 3, MC-02/MC-07): ShippingSection one-off packaging row
// tests. First test file for this section. Props-in, callbacks-out: the section
// reads a Pick of derived values, so the fixture below is that minimal shape.
// NewBadge visibility is time-gated, so only the wrapper wiring is asserted.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ShippingSection } from './ShippingSection';
import type { CalculatorFieldIds } from './fieldIds';
import type { ManualCostLine, Material, ShippingConfig } from '../../types';

const ids: CalculatorFieldIds = {
  printName: 'printName',
  printerSelect: 'printerSelect',
  modelUrl: 'modelUrl',
  modelCost: 'modelCost',
  authorMinPrice: 'authorMinPrice',
  gramsBase: 'gramsBase',
  printTime: 'printTime',
  failureRate: 'failureRate',
  prepTime: 'prepTime',
  postProcessing: 'postProcessing',
  shippingMethod: 'shippingMethod',
  shippingDistance: 'shippingDistance',
  carrierCost: 'carrierCost',
  sellingPlatform: 'sellingPlatform',
  profitMargin: 'profitMargin',
  targetProfit: 'targetProfit',
  sellingPrice: 'sellingPrice',
  taxRate: 'taxRate',
};

const shippingConfig: ShippingConfig = {
  maxDeliveryRadiusKm: 50,
  gasPricePerLiter: 1.5,
  vehicleFuelEfficiency: 8,
  upsBaseCost: 12,
  fedexBaseCost: 13,
  purolatorBaseCost: 11,
  uspsBaseCost: 9,
  dhlBaseCost: 14,
  royalMailBaseCost: 8,
  australiaPostBaseCost: 10,
  canadaPostBaseCost: 10,
  customCarriers: [],
};

function baseProps() {
  return {
    shippingMethod: 'ups' as const,
    onShippingMethodChange: vi.fn(),
    shippingDistanceKm: 0,
    onShippingDistanceKmChange: vi.fn(),
    shippingOverrideCost: null as number | null,
    onShippingOverrideCostChange: vi.fn(),
    derived: { shippingCost: 12, packagingCost: 0, totalShippingCost: 12, materialsInProfile: [] as Material[], marketplaceFee: 0 },
    shippingConfig,
    distanceUnit: 'km' as const,
    currencySymbol: '$',
    packagingMaterials: [],
    consumables: [] as Material[],
    onAddPackagingMaterial: vi.fn(),
    onUpdatePackagingMaterial: vi.fn(),
    onRemovePackagingMaterial: vi.fn(),
    manualPackaging: [] as ManualCostLine[],
    onAddManualPackaging: vi.fn(),
    onUpdateManualPackaging: vi.fn(),
    onRemoveManualPackaging: vi.fn(),
    marketplace: 'none' as const,
    onMarketplaceChange: vi.fn(),
    sellingPrice: 0,
    userCurrency: 'USD' as const,
    ids,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(ui); });
}

function unmount() {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
}

function typeInto(el: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const buttonNamed = (text: string) =>
  Array.from(container!.querySelectorAll('button')).find(b => b.textContent?.trim() === text) as HTMLButtonElement;

describe('ShippingSection: one-off packaging rows (47.1-02)', () => {
  it('keeps "+ One-off cost" enabled with empty consumables while "+ Add Packaging" is disabled, and clicking it adds a line', () => {
    const props = baseProps();
    mount(<ShippingSection {...props} />);
    expect(buttonNamed('+ Add Packaging').disabled).toBe(true);
    expect(buttonNamed('+ One-off cost').disabled).toBe(false);
    act(() => { buttonNamed('+ One-off cost').click(); });
    expect(props.onAddManualPackaging).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('renders one labelled row per line and routes name/cost edits and removal by line id', () => {
    const props = baseProps();
    props.manualPackaging = [
      { id: 'a', name: 'Gift wrap', cost: 3.5 },
      { id: 'b', name: '', cost: 0 },
    ];
    mount(<ShippingSection {...props} />);
    const names = container!.querySelectorAll<HTMLInputElement>('input[aria-label="One-off packaging name"]');
    const costs = container!.querySelectorAll<HTMLInputElement>('input[aria-label="One-off packaging cost"]');
    expect(names).toHaveLength(2);
    expect(costs).toHaveLength(2);
    expect(container!.querySelector('button[aria-label="Remove Gift wrap"]')).not.toBeNull();
    expect(container!.querySelector('button[aria-label="Remove one-off packaging cost"]')).not.toBeNull();
    // Each row is a labelled group so screen-reader users can tell identical-labelled inputs apart.
    const groups = [...container!.querySelectorAll('[role="group"]')].map(g => g.getAttribute('aria-label'));
    expect(groups).toEqual(['One-off packaging 1: Gift wrap', 'One-off packaging 2']);

    typeInto(names[0], 'Gift wrap XL');
    expect(props.onUpdateManualPackaging).toHaveBeenLastCalledWith('a', { name: 'Gift wrap XL' });
    typeInto(costs[0], '12.5');
    expect(props.onUpdateManualPackaging).toHaveBeenLastCalledWith('a', { cost: 12.5 });
    typeInto(costs[0], '-3');
    expect(props.onUpdateManualPackaging).toHaveBeenLastCalledWith('a', { cost: 0 });

    act(() => { container!.querySelector<HTMLButtonElement>('button[aria-label="Remove one-off packaging cost"]')!.click(); });
    expect(props.onRemoveManualPackaging).toHaveBeenCalledWith('b');
    unmount();
  });

  it('shows "No packaging materials added." only when both the library list and the one-off list are empty', () => {
    mount(<ShippingSection {...baseProps()} />);
    expect(container!.textContent).toContain('No packaging materials added.');
    unmount();
    const props = baseProps();
    props.manualPackaging = [{ id: 'a', name: 'Gift wrap', cost: 3.5 }];
    mount(<ShippingSection {...props} />);
    expect(container!.textContent).not.toContain('No packaging materials added.');
    unmount();
  });

  it('renders the Carrier Cost input from the derived shippingCost, unaffected by one-off rows (D-01)', () => {
    const props = baseProps();
    props.manualPackaging = [{ id: 'a', name: 'Gift wrap', cost: 3.5 }];
    mount(<ShippingSection {...props} />);
    const carrier = container!.querySelector<HTMLInputElement>(`[id="${ids.carrierCost}"]`)!;
    expect(carrier.value).toBe('12');
    typeInto(container!.querySelector<HTMLInputElement>('input[aria-label="One-off packaging cost"]')!, '9');
    expect(props.onShippingOverrideCostChange).not.toHaveBeenCalled();
    unmount();
  });

  it('wraps "+ One-off cost" in a relative inline-flex span so the NEW badge overlays it (never inline in flex-1)', () => {
    mount(<ShippingSection {...baseProps()} />);
    const wrapper = buttonNamed('+ One-off cost').parentElement!;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper.className).toContain('relative');
    expect(wrapper.className).toContain('inline-flex');
    unmount();
  });
});
