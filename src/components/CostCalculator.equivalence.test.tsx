import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CostCalculator } from './CostCalculator';
import { ToastProvider } from './ui';
import type {
  Material, PrinterConfig, PrinterInstance, ElectricityConfig, ShippingConfig,
  MarketplaceFees, UserProfile, PrintJob, Currency,
} from '../types';
import type { FxRateTable } from '../utils/fxConvert';

// ---------------------------------------------------------------------------
// Phase 38 output-equivalence harness (FOUND-01 gate).
//
// These tests mount the REAL CostCalculator, drive it through real DOM events,
// and lock the rendered pricing/cost outputs for representative scenarios —
// including the exact interaction that forced the v1.9 PERF-11 revert
// (consecutive edits to the same pricing field).
//
// RULES (see .planning/phases/38-foundation/38-RESEARCH.md):
//   * The golden values below were captured against the PRE-SPLIT component
//     and hand-verified against the pricingInterlink closed forms. They are
//     FROZEN. If a value changes during the CostCalculator split, that is a
//     behavioral regression — fix the code, never re-capture the golden.
//   * This file must not import any post-split module (hooks/sections), so it
//     runs unmodified on both sides of the refactor.
//   * Convention: raw createRoot + act (no @testing-library), matching
//     Modal.test.tsx / FilamentSelector.test.tsx.
//
// The component's only Dexie edge is useStockEvents — mocked below. All other
// data arrives via props.
// ---------------------------------------------------------------------------

vi.mock('../hooks/useStockEvents', () => ({
  useStockEvents: () => ({
    events: [],
    stockByAssetId: new Map<string, number>(),
    logManualAdjustment: async () => {},
  }),
}));

const FORM_STORAGE_KEY = 'costCalculatorForm';

// ─── Fixtures ───────────────────────────────────────────────────────────────
// Numbers chosen so every derived figure is hand-checkable:
//   filament: 100 g × $0.02/g = $2.00
//   electricity: (1000 W / 1000) × 2 h × $0.10/kWh = $0.20
//   depreciation: $480 / (12 mo × 40 h) = $1/h (fixed cost — not in trueCost)
//   → baseline trueCost = 2.00 + 0.20 = $2.20

const materials: Material[] = [
  { id: 'fil-pla', name: 'Test PLA', brand: 'TestBrand', category: 'filament', filamentType: 'PLA', costPerUnit: 0.02, currency: 'USD', unit: 'g' },
  { id: 'fil-petg', name: 'Test PETG', brand: 'TestBrand', category: 'filament', filamentType: 'PETG', costPerUnit: 0.03, currency: 'USD', unit: 'g' },
  { id: 'mat-glue', name: 'Glue Stick', category: 'consumable', costPerUnit: 1.5, currency: 'USD', unit: 'unit' },
];

const printers: PrinterConfig[] = [
  { id: 'printer-a', name: 'Test Printer', purchasePrice: 480, expectedLifespanHours: 5000, wattage: 1000, nozzleCost: 0, nozzleLifespanCm3: 1000 },
];

const printerInstances: PrinterInstance[] = [
  { id: 'inst-1', printerConfigId: 'printer-a', nickname: 'Bench', printHours: 0 },
];

const electricity: ElectricityConfig = { costPerKwh: 0.1 };

const shippingConfig: ShippingConfig = {
  maxDeliveryRadiusKm: 50, gasPricePerLiter: 2, vehicleFuelEfficiency: 10,
  upsBaseCost: 15, fedexBaseCost: 16, purolatorBaseCost: 17, uspsBaseCost: 8,
  dhlBaseCost: 20, royalMailBaseCost: 5, australiaPostBaseCost: 9, canadaPostBaseCost: 12,
  customCarriers: [],
};

// Mirrors defaultMarketplaceFees (useDatabase.ts) — inlined so this file does
// not import the Dexie-touching module. Etsy shape: pct 6.5%+3% = 0.095,
// fixed $0.25+$0.20 = $0.45 (USD, FX-converted for non-USD profiles).
const marketplaceFees: MarketplaceFees = {
  facebookShippedPercent: 10, facebookMinFee: 0.8, facebookProcessingPercent: 2.9,
  etsyTransactionPercent: 6.5, etsyPaymentPercent: 3, etsyPaymentFixed: 0.25,
  etsyListingFee: 0.2, etsyOffsiteAdPercent: 15,
  kijijiFeaturedFee: 0,
  ebayFinalValuePercent: 12.9, ebayFixedFee: 0.3,
  amazonHandmadePercent: 15,
  customMarketplaces: [],
};

// 1 USD = 0.5 EUR — deliberately unrealistic so FX-converted figures are clean.
const fxTable: FxRateTable = { base: 'USD', rates: { EUR: 0.5 }, date: '2026-08-27' };

const userProfileUSD: UserProfile = { currency: 'USD', laborHourlyRate: 12 };

// The sessionStorage form seed — the component's own restore path is used to
// establish complex state (filament rows) without driving the filament menu.
// Shape mirrors the persistence effect's formState object exactly.
const BASE_FORM = {
  printName: 'Benchy',
  filamentRows: [
    { uid: 'seed-1', filamentId: 'fil-pla', grams: 100, editedPrice: 0.02, editedCurrency: 'USD' as Currency },
  ],
  selectedInstanceId: 'inst-1',
  printTimeHours: 2,
  modelCost: 0,
  modelCostPerUnit: false,
  authorMinPrice: 0,
  modelUrl: '',
  prepTimeMinutes: 0,
  postProcessingMinutes: 0,
  failureRate: 0,
  materialsUsed: [] as { materialId: string; quantity: number }[],
  profitMarginPercent: 50,
  targetProfit: 0,
  sellingPrice: 0,
  lastEdited: 'margin' as const,
  shippingMethod: 'local_pickup',
  shippingDistanceKm: 0,
  shippingOverrideCost: null,
  packagingMaterials: [],
  marketplace: 'none',
  etsyChecks: {},
};

function seedForm(overrides: Partial<typeof BASE_FORM> = {}) {
  sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({ ...BASE_FORM, ...overrides }));
}

function baseProps() {
  return {
    materials,
    printers,
    printerInstances,
    electricity,
    laborHourlyRate: 12,
    defaultProfitMargin: 50,
    userCurrency: 'USD' as Currency,
    userProfile: userProfileUSD,
    fxTable,
    shippingConfig,
    marketplaceFees,
    onSaveJob: vi.fn(),
    onUpdateJob: vi.fn(),
    editingJob: null as PrintJob | null,
    onCancelEdit: vi.fn(),
    onViewJobs: vi.fn(),
  };
}

// ─── Mount plumbing ─────────────────────────────────────────────────────────

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
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
  container?.remove();
  container = null;
  sessionStorage.clear();
  vi.restoreAllMocks();
});

async function mount(props: ReturnType<typeof baseProps>) {
  await act(async () => {
    root!.render(
      <ToastProvider>
        <CostCalculator {...props} />
      </ToastProvider>,
    );
  });
}

// ─── DOM helpers ────────────────────────────────────────────────────────────

/** Find the input associated (label htmlFor → id) with a label whose text starts with `text`. */
function inputByLabel(text: string): HTMLInputElement {
  const labels = Array.from(container!.querySelectorAll('label'));
  const label = labels.find(l => (l.textContent ?? '').trim().startsWith(text));
  if (!label) throw new Error(`No label starting with "${text}"`);
  const el = document.getElementById(label.htmlFor);
  if (!(el instanceof HTMLInputElement)) throw new Error(`Label "${text}" is not wired to an <input>`);
  return el;
}

function selectByLabel(text: string): HTMLSelectElement {
  const labels = Array.from(container!.querySelectorAll('label'));
  const label = labels.find(l => (l.textContent ?? '').trim().startsWith(text));
  if (!label) throw new Error(`No label starting with "${text}"`);
  const el = document.getElementById(label.htmlFor);
  if (!(el instanceof HTMLSelectElement)) throw new Error(`Label "${text}" is not wired to a <select>`);
  return el;
}

/** Drive a controlled input the way a user keystroke does (native setter + input event). */
async function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function choose(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** Read a stat tile from the financial-targets summary panel by its caption. */
function tile(caption: string): string {
  const captions = Array.from(container!.querySelectorAll('div'))
    .filter(d => (d.textContent ?? '').trim() === caption && d.previousElementSibling);
  if (captions.length === 0) throw new Error(`No summary tile captioned "${caption}"`);
  return (captions[0].previousElementSibling!.textContent ?? '').trim();
}

function pricingInputs() {
  return {
    margin: inputByLabel('Profit Margin'),
    profit: inputByLabel('Target Profit'),
    price: inputByLabel('Selling Price'),
  };
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

describe('CostCalculator output equivalence (Phase 38 gate)', () => {
  it('S1 baseline: margin-driven derivation on mount (trueCost 2.20, margin 50%)', async () => {
    seedForm();
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    // priceFromMargin(2.20, 50): price = 2.20/0.5 = 4.40, netProfit = 2.20
    expect(margin.value).toBe('50');
    expect(price.value).toBe('4.4');
    expect(profit.value).toBe('2.2');
    expect(tile('True Cost')).toBe('$2.20');
    expect(tile('Sell Price')).toBe('$4.40');
    expect(tile('Net Profit')).toBe('$2.20');
    expect(tile('Net Margin')).toBe('50.0%');
  });

  it('S2 multi-filament + consumables + labor + failure clamp (trueCost 20.78)', async () => {
    seedForm({
      filamentRows: [
        { uid: 's2-1', filamentId: 'fil-pla', grams: 100, editedPrice: 0.02, editedCurrency: 'USD' },
        { uid: 's2-2', filamentId: 'fil-petg', grams: 50, editedPrice: 0.03, editedCurrency: 'USD' },
      ],
      materialsUsed: [{ materialId: 'mat-glue', quantity: 2 }],
      prepTimeMinutes: 30,
      postProcessingMinutes: 30,
      failureRate: 10,
    });
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    // subtotal = 3.50 filament + 0.20 electricity + 3.00 materials + 12.00 labor = 18.70
    // failureAdjusted = 18.70 / 0.9 = 20.7778 → trueCost $20.78 displayed
    // priceFromMargin(20.7778, 50): price 41.5556 → 41.56, netProfit → 20.78
    expect(tile('True Cost')).toBe('$20.78');
    expect(margin.value).toBe('50');
    expect(price.value).toBe('41.56');
    expect(profit.value).toBe('20.78');
  });

  it('S3 price-driven: typing a selling price derives net profit + margin', async () => {
    seedForm();
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    await type(price, '25');
    // marginFromPrice(2.20, 25): netProfit 22.80, margin 91.2%
    expect(price.value).toBe('25');
    expect(profit.value).toBe('22.8');
    expect(margin.value).toBe('91.2');
  });

  it('S4 THE PERF-11 CASE: consecutive edits to the same field must re-derive siblings', async () => {
    seedForm();
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    await type(price, '25');
    expect(profit.value).toBe('22.8');
    expect(margin.value).toBe('91.2');

    // Second consecutive edit to the SAME field. lastEdited ('price') and
    // trueCost are both unchanged — the v1.9 dep-trim regression left profit
    // and margin frozen at the values for 25 here. They MUST track 30.
    await type(price, '30');
    expect(price.value).toBe('30');
    expect(profit.value).toBe('27.8');                 // 30 − 2.20
    expect(margin.value).toBe('92.7');                 // 27.8/30 → 92.66…7 → 92.7
    expect(tile('Net Margin')).toBe('92.7%');
  });

  it('S5 same-field case, margin branch: 40 then 60', async () => {
    seedForm();
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    await type(margin, '40');
    // priceFromMargin(2.20, 40): price 3.6667 → 3.67, netProfit 1.4667 → 1.47
    expect(price.value).toBe('3.67');
    expect(profit.value).toBe('1.47');

    await type(margin, '60');
    // priceFromMargin(2.20, 60): price 5.50, netProfit 3.30
    expect(price.value).toBe('5.5');
    expect(profit.value).toBe('3.3');
  });

  it('S6 profit-driven, then a cost-input change rebases price off the new trueCost', async () => {
    seedForm();
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    await type(profit, '10');
    // priceFromProfit(2.20, 10): price 12.20, margin 81.967 → 82
    expect(price.value).toBe('12.2');
    expect(margin.value).toBe('82');

    // Doubling print time: electricity 0.20 → 0.40, trueCost 2.20 → 2.40.
    // lastEdited stays 'profit' → price re-derives, profit target holds.
    await type(inputByLabel('Print Time (hours)'), '4');
    expect(profit.value).toBe('10');
    expect(price.value).toBe('12.4');
    expect(margin.value).toBe('80.6');                 // 10/12.4 → 80.645 → 80.6
  });

  it('S7 Etsy (USD): net-of-fee derivation + fee readouts', async () => {
    seedForm();
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    await choose(selectByLabel('Selling Platform'), 'etsy');
    // fee shape: pct 0.095, fixed 0.45
    // priceFromMargin(2.20, 50, fee): price = 2.65/0.405 = 6.5432 → 6.54
    // netProfit = 6.5432×0.905 − 2.65 = 3.2716 → 3.27; margin stays 50
    expect(margin.value).toBe('50');
    expect(price.value).toBe('6.54');
    expect(profit.value).toBe('3.27');
    // fee for displayed price 6.54: 6.54×0.095 + 0.45 = 1.0713 → $1.07
    expect(tile('Platform Fee')).toBe('-$1.07');
    expect(tile('Net Profit')).toBe('$3.27');
    expect(tile('Net Margin')).toBe('50.0%');
  });

  it('S8 Etsy (EUR profile): fixed fee is FX-converted before the interlink', async () => {
    seedForm({
      filamentRows: [
        { uid: 's8-1', filamentId: 'fil-pla', grams: 100, editedPrice: 0.02, editedCurrency: 'EUR' },
      ],
      marketplace: 'etsy',
    });
    const props = { ...baseProps(), userCurrency: 'EUR' as Currency, userProfile: { currency: 'EUR' as Currency, laborHourlyRate: 12 } };
    await mount(props);
    const { margin, profit, price } = pricingInputs();

    // Fixed Etsy fees $0.45 USD × 0.5 = €0.225 (the v1.9 ~150× fix path).
    // priceFromMargin(2.20, 50, {0.095, 0.225}): price = 2.425/0.405 = 5.9877 → 5.99
    // netProfit = 5.9877×0.905 − 2.425 = 2.9938 → 2.99
    expect(margin.value).toBe('50');
    expect(price.value).toBe('5.99');
    expect(profit.value).toBe('2.99');
    expect(tile('True Cost')).toBe('€2.20');
    // fee at displayed 5.99: 5.99×0.095 + 0.225 = 0.79405 → €0.79
    expect(tile('Platform Fee')).toBe('-€0.79');
  });

  it('S9 marketplace round-trip none → etsy → none restores the exact gross derivation', async () => {
    seedForm();
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();
    const platform = selectByLabel('Selling Platform');

    await choose(platform, 'etsy');
    expect(price.value).toBe('6.54');

    await choose(platform, 'none');
    // fee shape back to {0,0} → identical to S1
    expect(margin.value).toBe('50');
    expect(price.value).toBe('4.4');
    expect(profit.value).toBe('2.2');
  });

  it('S10 trueCost ≤ 0 guard: typing a margin leaves price/profit untouched', async () => {
    seedForm({
      filamentRows: [{ uid: 's10-1', filamentId: '', grams: 0, editedPrice: 0, editedCurrency: 'USD' }],
      printTimeHours: 0,
      profitMarginPercent: 0,
      lastEdited: 'margin',
    });
    await mount(baseProps());
    const { margin, profit, price } = pricingInputs();

    await type(margin, '40');
    expect(margin.value).toBe('40');
    expect(price.value).toBe('');                      // 0 renders as ''
    expect(profit.value).toBe('');
  });

  it('S11 editingJob population seeds saved margin/profit then rebases against CURRENT cost', async () => {
    // matchMedia + scrollIntoView are used by the editing-banner effect; jsdom
    // lacks both. Stubs, not behavior under test.
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    Element.prototype.scrollIntoView = () => {};

    seedForm();
    const props = baseProps();
    await mount(props);

    const editingJob: PrintJob = {
      id: 'job-1', name: 'Saved Benchy', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
      filaments: [{ filamentId: 'fil-pla', grams: 100, pricePerGram: 0.02, currency: 'USD' }],
      printTimeHours: 2, printerInstanceId: 'inst-1',
      modelCost: 0, modelCostPerUnit: false,
      prepTimeMinutes: 0, postProcessingMinutes: 0,
      materialsUsed: [], failureRate: 0,
      costPerUnit: 3,                                   // saved cost basis (differs from current 2.20)
      sellingPrice: 10,
      copiesSold: 0, currency: 'USD',
    } as PrintJob;

    await mount({ ...props, editingJob });
    const { margin, profit, price } = pricingInputs();

    // Population seeds savedProfit 7 / savedMargin 70, sets lastEdited='price';
    // the interlink then REBASES against current trueCost (2.20):
    // marginFromPrice(2.20, 10): netProfit 7.80, margin 78.0
    expect(price.value).toBe('10');
    expect(profit.value).toBe('7.8');
    expect(margin.value).toBe('78');
    expect(tile('Net Margin')).toBe('78.0%');
  });

  it('S12 dropoff shipping folds ceil-rounded fuel cost into trueCost', async () => {
    seedForm({ shippingMethod: 'dropoff', shippingDistanceKm: 10 });
    await mount(baseProps());
    const { profit, price } = pricingInputs();

    // fuel: 20 km round trip → 2 L × $2 = $4.00 (Math.ceil to the cent)
    // trueCost = 2.20 + 4.00 = 6.20 → price 12.40, profit 6.20
    expect(tile('True Cost')).toBe('$6.20');
    expect(price.value).toBe('12.4');
    expect(profit.value).toBe('6.2');
  });
});
