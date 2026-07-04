import type {
  Material,
  PrinterConfig,
  PrinterInstance,
  ElectricityConfig,
  Currency,
  UserProfile,
  ShippingConfig,
  MarketplaceFees,
  MarketplaceType,
  PrintJob,
} from '../../../types';
import type { FxRateTable } from '../../../utils/fxConvert';

// ---------------------------------------------------------------------------
// Golden-scenario fixtures for the Phase 38 CostCalculator split (FOUND-01).
//
// Captured from the CURRENT (pre-split) src/components/CostCalculator.tsx per
// D-01 — these fixtures are INPUTS only. Expected outputs are captured at test
// time (Task 2, outputEquivalence.test.tsx) by mounting the CURRENT component
// and reading its rendered strings. Do NOT hand-compute expected values here.
//
// Mirrors the makeCalcInput override-factory idiom in src/utils/costCalc.test.ts
// but built one level up, at the full CostCalculatorProps surface (marketplace,
// tax, currency conversion, shipping/packaging are all in scope here — broader
// than calculateCost's pure surface).
//
// IMPORTANT: `marketplace`, `sellingPrice`, `failureRate`, `filaments`, etc. are
// NOT fields of CostCalculatorProps — they are internal form `useState` in the
// current (pre-split) component, defaulting from sessionStorage/`'none'`/0.
// The only mount-time channel to seed them deterministically (without driving
// DOM events first) is `editingJob` — the component's "populate fields when
// editing an existing job" effect (CostCalculator.tsx lines 287-337) copies
// every relevant field off `editingJob` into form state on mount. Scenarios
// that need a specific marketplace, failure rate, or selling price therefore
// set `editingJob` rather than a (nonexistent) prop.
// ---------------------------------------------------------------------------

export interface CostCalculatorProps {
  materials: Material[];
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  electricity: ElectricityConfig;
  laborHourlyRate: number;
  defaultProfitMargin: number;
  userCurrency: Currency;
  userProfile: UserProfile;
  fxTable: FxRateTable | null;
  shippingConfig: ShippingConfig;
  marketplaceFees: MarketplaceFees;
  onSaveJob: (job: PrintJob, printHours: number) => void | Promise<void>;
  onUpdateJob: (job: PrintJob) => void | Promise<void>;
  editingJob: PrintJob | null;
  onCancelEdit: () => void;
  onViewJobs: () => void;
}

// ---------------------------------------------------------------------------
// Deterministic seed constant (D-02). RANDOM_SCENARIOS is generated from this
// fixed seed via the inline mulberry32 PRNG below, so runs are reproducible.
// FIXTURE_SEED is referenced twice: declared here, consumed by mulberry32()
// at RANDOM_SCENARIOS generation time.
// ---------------------------------------------------------------------------
export const FIXTURE_SEED = 1337;

// Tiny deterministic PRNG (mulberry32) — no dependency added. Returns a
// function producing floats in [0, 1) given repeated calls, seeded once.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Default building blocks
// ---------------------------------------------------------------------------

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-pla',
    name: 'PLA Spool',
    category: 'filament',
    filamentType: 'PLA',
    unit: 'g',
    costPerUnit: 0.02,
    currency: 'USD',
    ...overrides,
  };
}

function makeConsumable(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-box',
    name: 'Small Box',
    category: 'packaging',
    unit: 'unit',
    costPerUnit: 0.5,
    currency: 'USD',
    ...overrides,
  };
}

function makePrinter(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    id: 'printer-1',
    name: 'Test Printer',
    purchasePrice: 1200,
    expectedLifespanHours: 5000,
    wattage: 100,
    nozzleCost: 20,
    nozzleLifespanCm3: 1000,
    ...overrides,
  };
}

function makeInstance(overrides: Partial<PrinterInstance> = {}): PrinterInstance {
  return {
    id: 'instance-1',
    printerConfigId: 'printer-1',
    nickname: 'Test Instance',
    printHours: 0,
    actualPurchasePrice: 1200,
    recoveryMonths: 12,
    estimatedMonthlyPrintHours: 40,
    ...overrides,
  };
}

function makeElectricity(overrides: Partial<ElectricityConfig> = {}): ElectricityConfig {
  return { costPerKwh: 0.12, ...overrides };
}

function makeShippingConfig(overrides: Partial<ShippingConfig> = {}): ShippingConfig {
  return {
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
    ...overrides,
  };
}

function makeMarketplaceFees(overrides: Partial<MarketplaceFees> = {}): MarketplaceFees {
  return {
    facebookShippedPercent: 10,
    facebookMinFee: 0.8,
    facebookProcessingPercent: 2.9,
    etsyTransactionPercent: 6.5,
    etsyPaymentPercent: 3,
    etsyPaymentFixed: 0.25,
    etsyListingFee: 0.2,
    etsyOffsiteAdPercent: 15,
    kijijiFeaturedFee: 0,
    ebayFinalValuePercent: 12.9,
    ebayFixedFee: 0.3,
    amazonHandmadePercent: 15,
    customMarketplaces: [],
    ...overrides,
  };
}

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    currency: 'USD',
    laborHourlyRate: 20,
    defaultProfitMargin: 30,
    ...overrides,
  };
}

function makeFxTable(overrides: Partial<FxRateTable> = {}): FxRateTable {
  return {
    base: 'USD',
    rates: {
      USD: 1,
      CAD: 1.35,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 150,
      AUD: 1.5,
    },
    date: '2026-07-01',
    cachedAt: Date.parse('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

let jobIdSeq = 0;
const nextJobId = (): string => `job-fixture-${++jobIdSeq}`;

// Build an `editingJob` PrintJob so a scenario can deterministically seed
// marketplace / failure rate / selling price / tax / filaments on mount via
// the component's editingJob-population effect. All PrintJob-required fields
// get sane defaults; pass only the fields the scenario cares about.
function makeEditingJob(overrides: Partial<PrintJob> = {}): PrintJob {
  const now = new Date('2026-06-15T00:00:00Z');
  return {
    id: nextJobId(),
    name: 'Fixture Job',
    createdAt: now,
    updatedAt: now,
    filaments: [{ filamentId: 'mat-pla', grams: 250, pricePerGram: 0.02, currency: 'USD' }],
    printTimeHours: 3,
    printerInstanceId: 'instance-1',
    modelCost: 0,
    modelCostPerUnit: false,
    prepTimeMinutes: 10,
    postProcessingMinutes: 15,
    materialsUsed: [],
    failureRate: 5,
    costPerUnit: 10,
    sellingPrice: 20,
    copiesSold: 0,
    marketplace: 'none' as MarketplaceType,
    currency: 'USD',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeScenarioProps — the fixture factory. Mirrors the makeCalcInput
// override-idiom in costCalc.test.ts, but at the full CostCalculatorProps
// surface (marketplace, tax, currency conversion, shipping/packaging).
// ---------------------------------------------------------------------------

export function makeScenarioProps(overrides: Partial<CostCalculatorProps> = {}): CostCalculatorProps {
  return {
    materials: [makeMaterial(), makeConsumable()],
    printers: [makePrinter()],
    printerInstances: [makeInstance()],
    electricity: makeElectricity(),
    laborHourlyRate: 20,
    defaultProfitMargin: 30,
    userCurrency: 'USD',
    userProfile: makeUserProfile(),
    fxTable: makeFxTable(),
    shippingConfig: makeShippingConfig(),
    marketplaceFees: makeMarketplaceFees(),
    onSaveJob: () => {},
    onUpdateJob: () => {},
    editingJob: null,
    onCancelEdit: () => {},
    onViewJobs: () => {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CURATED_SCENARIOS — ~15-20 hand-picked landmine scenarios (D-02).
//
// Coverage per plan: multi-material filament slots; marketplace fixed fees +
// FX conversion (JPY-style cross-currency); non-zero failure %; VAT/tax modes;
// break-even scenarios; labor + shipping + packaging cost; AND (per RESEARCH
// Pitfall 5) at least 4 plain marketplace:'none' (zero-fee) scenarios so the
// default path is not crowded out by fee-aware cases.
// ---------------------------------------------------------------------------

interface Scenario {
  name: string;
  props: CostCalculatorProps;
}

const petgMaterial = makeMaterial({ id: 'mat-petg', name: 'PETG Spool', filamentType: 'PETG', costPerUnit: 0.03 });
const tpuMaterial = makeMaterial({ id: 'mat-tpu', name: 'TPU Spool', filamentType: 'TPU', costPerUnit: 0.045 });
const finishingMaterial: Material = {
  id: 'mat-paint',
  name: 'Acrylic Paint',
  category: 'finishing',
  unit: 'ml',
  costPerUnit: 0.1,
  currency: 'USD',
};

export const CURATED_SCENARIOS: Scenario[] = [
  // --- Direct-sale / no-fee baseline scenarios (>= 4 required, Pitfall 5) ---
  {
    // marketplace: 'none' marker
    name: "none-01: simple single-filament direct sale, marketplace: 'none', no fees",
    props: makeScenarioProps({
      materials: [makeMaterial()],
      editingJob: makeEditingJob({ marketplace: 'none' as MarketplaceType, sellingPrice: 20, costPerUnit: 10 }),
    }),
  },
  {
    // marketplace: 'none' marker
    name: "none-02: direct sale, marketplace: 'none', with failure rate + labor",
    props: makeScenarioProps({
      materials: [makeMaterial(), finishingMaterial],
      laborHourlyRate: 25,
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        failureRate: 12,
        prepTimeMinutes: 20,
        postProcessingMinutes: 30,
        sellingPrice: 30,
        costPerUnit: 15,
      }),
    }),
  },
  {
    // marketplace: 'none' marker
    name: "none-03: direct sale, marketplace: 'none', break-even scenario (fixed costs > 0)",
    props: makeScenarioProps({
      printerInstances: [makeInstance({ actualPurchasePrice: 800, recoveryMonths: 6, estimatedMonthlyPrintHours: 20 })],
      editingJob: makeEditingJob({ marketplace: 'none' as MarketplaceType, sellingPrice: 25, costPerUnit: 12 }),
    }),
  },
  {
    // marketplace: 'none' marker
    name: "none-04: direct sale, marketplace: 'none', with shipping + packaging materials",
    props: makeScenarioProps({
      materials: [makeMaterial(), makeConsumable()],
      shippingConfig: makeShippingConfig({ upsBaseCost: 15 }),
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        shippingMethod: 'ups',
        packagingMaterials: [{ materialId: 'mat-box', quantity: 2 }],
        sellingPrice: 35,
        costPerUnit: 14,
      }),
    }),
  },

  // --- Multi-material filament slots ---
  {
    name: 'multi-material: PLA + PETG two filament rows',
    props: makeScenarioProps({
      materials: [makeMaterial(), petgMaterial, tpuMaterial],
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        filaments: [
          { filamentId: 'mat-pla', grams: 250, pricePerGram: 0.02, currency: 'USD' },
          { filamentId: 'mat-petg', grams: 120, pricePerGram: 0.03, currency: 'USD' },
        ],
        sellingPrice: 28,
        costPerUnit: 13,
      }),
    }),
  },
  {
    name: 'multi-material: three filament rows (PLA + PETG + TPU)',
    props: makeScenarioProps({
      materials: [makeMaterial(), petgMaterial, tpuMaterial],
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        filaments: [
          { filamentId: 'mat-pla', grams: 150, pricePerGram: 0.02, currency: 'USD' },
          { filamentId: 'mat-petg', grams: 100, pricePerGram: 0.03, currency: 'USD' },
          { filamentId: 'mat-tpu', grams: 50, pricePerGram: 0.045, currency: 'USD' },
        ],
        sellingPrice: 32,
        costPerUnit: 16,
      }),
    }),
  },

  // --- Marketplace fixed fees + FX conversion (JPY-style cross-currency) ---
  {
    name: 'fx-jpy: Etsy fees FX-converted for JPY seller',
    props: makeScenarioProps({
      userCurrency: 'JPY',
      userProfile: makeUserProfile({ currency: 'JPY' }),
      fxTable: makeFxTable(),
      editingJob: makeEditingJob({
        marketplace: 'etsy' as MarketplaceType,
        currency: 'JPY',
        sellingPrice: 3000,
        costPerUnit: 1500,
      }),
    }),
  },
  {
    name: 'fx-eur: Facebook shipped fees FX-converted for EUR seller',
    props: makeScenarioProps({
      userCurrency: 'EUR',
      userProfile: makeUserProfile({ currency: 'EUR' }),
      editingJob: makeEditingJob({
        marketplace: 'facebook_shipped' as MarketplaceType,
        currency: 'EUR',
        sellingPrice: 40,
        costPerUnit: 18,
      }),
    }),
  },
  {
    name: 'fx-missing-table: no fxTable cached yet (offline fallback)',
    props: makeScenarioProps({
      userCurrency: 'CAD',
      userProfile: makeUserProfile({ currency: 'CAD' }),
      fxTable: null,
      editingJob: makeEditingJob({
        marketplace: 'etsy' as MarketplaceType,
        currency: 'CAD',
        sellingPrice: 45,
        costPerUnit: 20,
      }),
    }),
  },
  {
    name: 'etsy-offsite-ad: highest-fee marketplace path',
    props: makeScenarioProps({
      editingJob: makeEditingJob({
        marketplace: 'etsy_offsite_ad' as MarketplaceType,
        sellingPrice: 50,
        costPerUnit: 22,
      }),
    }),
  },

  // --- Non-zero failure % ---
  {
    name: 'high-failure: 40% failure rate inflates per-unit cost',
    props: makeScenarioProps({
      materials: [makeMaterial()],
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        failureRate: 40,
        sellingPrice: 20,
        costPerUnit: 12,
      }),
    }),
  },
  {
    name: 'near-cap-failure: 99% failure rate clamp boundary',
    props: makeScenarioProps({
      materials: [makeMaterial()],
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        failureRate: 99,
        sellingPrice: 100,
        costPerUnit: 60,
      }),
    }),
  },

  // --- VAT / tax modes ---
  {
    name: 'tax-eu-vat: EU VAT rate applied via settings default',
    props: makeScenarioProps({
      userCurrency: 'EUR',
      userProfile: makeUserProfile({ currency: 'EUR', defaultTaxRate: 20 }),
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        currency: 'EUR',
        sellingPrice: 24,
        costPerUnit: 11,
      }),
    }),
  },
  {
    name: 'tax-region-lookup: address-based tax resolution (Ontario HST)',
    props: makeScenarioProps({
      userCurrency: 'CAD',
      userProfile: makeUserProfile({
        currency: 'CAD',
        address: { country: 'CA', province: 'ON' },
      }),
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        currency: 'CAD',
        sellingPrice: 26,
        costPerUnit: 12,
      }),
    }),
  },
  {
    name: 'tax-none: zero tax rate (US no-tax default path)',
    props: makeScenarioProps({
      userCurrency: 'USD',
      userProfile: makeUserProfile({ currency: 'USD', defaultTaxRate: 0 }),
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        sellingPrice: 20,
        costPerUnit: 9,
      }),
    }),
  },

  // --- Break-even scenarios ---
  {
    name: 'break-even: high fixed cost, low margin — many copies needed',
    props: makeScenarioProps({
      printerInstances: [makeInstance({ actualPurchasePrice: 2000, recoveryMonths: 24, estimatedMonthlyPrintHours: 30 })],
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        sellingPrice: 15,
        costPerUnit: 12,
      }),
    }),
  },
  {
    name: 'break-even: unprofitable price (selling below cost)',
    props: makeScenarioProps({
      printerInstances: [makeInstance({ actualPurchasePrice: 1500, recoveryMonths: 12, estimatedMonthlyPrintHours: 40 })],
      editingJob: makeEditingJob({
        marketplace: 'none' as MarketplaceType,
        sellingPrice: 8,
        costPerUnit: 12,
      }),
    }),
  },

  // --- Labor + shipping + packaging cost combined ---
  {
    name: 'combined: labor + dropoff shipping + packaging + marketplace fee',
    props: makeScenarioProps({
      materials: [makeMaterial(), makeConsumable(), finishingMaterial],
      laborHourlyRate: 35,
      shippingConfig: makeShippingConfig({ gasPricePerLiter: 1.8, vehicleFuelEfficiency: 9 }),
      editingJob: makeEditingJob({
        marketplace: 'etsy' as MarketplaceType,
        shippingMethod: 'dropoff',
        shippingDistanceKm: 12,
        packagingMaterials: [{ materialId: 'mat-box', quantity: 1 }],
        prepTimeMinutes: 15,
        postProcessingMinutes: 45,
        sellingPrice: 55,
        costPerUnit: 24,
      }),
    }),
  },
  {
    name: 'combined: model cost per-unit license + all cost centers',
    props: makeScenarioProps({
      materials: [makeMaterial(), makeConsumable()],
      editingJob: makeEditingJob({
        marketplace: 'facebook_shipped' as MarketplaceType,
        modelCost: 3,
        modelCostPerUnit: true,
        sellingPrice: 42,
        costPerUnit: 19,
      }),
    }),
  },

  // --- Editing an existing job (restores from PrintJob), no marketplace fee ---
  {
    // marketplace: 'none' marker
    name: "editing-job: resumed edit of a saved multi-filament job, marketplace: 'none'",
    props: makeScenarioProps({
      materials: [makeMaterial(), petgMaterial],
      editingJob: makeEditingJob({
        name: 'Dragon Figurine',
        filaments: [
          { filamentId: 'mat-pla', grams: 200, pricePerGram: 0.02, currency: 'USD' },
          { filamentId: 'mat-petg', grams: 80, pricePerGram: 0.03, currency: 'USD' },
        ],
        printTimeHours: 4,
        modelCost: 5,
        modelCostPerUnit: false,
        prepTimeMinutes: 10,
        postProcessingMinutes: 15,
        failureRate: 5,
        costPerUnit: 12,
        sellingPrice: 25,
        copiesSold: 3,
        marketplace: 'none' as MarketplaceType,
      }),
    }),
  },
];

// ---------------------------------------------------------------------------
// RANDOM_SCENARIOS — ~100 combos generated by a FIXED-SEED PRNG (D-02).
// Reproducible across runs since FIXTURE_SEED is a hard-coded constant.
// Each scenario seeds marketplace/failure-rate/selling-price/filaments via
// `editingJob`, mirroring the CURATED_SCENARIOS approach so the mount-time
// output actually reflects the varied inputs (see file-header note on why
// `editingJob` — not a nonexistent prop — is the correct seeding channel).
// ---------------------------------------------------------------------------

const RANDOM_SCENARIO_COUNT = 100;
const FILAMENT_TYPES: Material[] = [makeMaterial(), petgMaterial, tpuMaterial];
const MARKETPLACES: MarketplaceType[] = ['none', 'none', 'none', 'facebook_local', 'facebook_shipped', 'etsy', 'etsy_offsite_ad', 'kijiji'];
const CURRENCIES: Currency[] = ['USD', 'CAD', 'EUR', 'GBP', 'JPY'];

function generateRandomScenarios(): Scenario[] {
  const rng = mulberry32(FIXTURE_SEED);
  const scenarios: Scenario[] = [];

  for (let i = 0; i < RANDOM_SCENARIO_COUNT; i++) {
    const currency = CURRENCIES[Math.floor(rng() * CURRENCIES.length)];
    const marketplace = MARKETPLACES[Math.floor(rng() * MARKETPLACES.length)];
    const grams = Math.round(10 + rng() * 490);
    const printTimeHours = parseFloat((0.1 + rng() * 10).toFixed(1));
    const failureRate = Math.round(rng() * 30);
    const prepTimeMinutes = Math.round(rng() * 60);
    const postProcessingMinutes = Math.round(rng() * 90);
    const laborHourlyRate = Math.round(10 + rng() * 40);
    const defaultProfitMargin = Math.round(10 + rng() * 60);
    const materialChoice = FILAMENT_TYPES[Math.floor(rng() * FILAMENT_TYPES.length)];
    // Selling price seeded comfortably above a plausible per-gram cost so the
    // component's trueCost > 0 && sellingPrice > 0 render-gate (the summary
    // panel / breakdown JSX) is exercised for every random scenario.
    const sellingPrice = Math.round(20 + rng() * 80);
    const costPerUnit = Math.round(sellingPrice * (0.3 + rng() * 0.4));

    scenarios.push({
      name: `random-${i}: seeded scenario ${i}`,
      props: makeScenarioProps({
        materials: [materialChoice, makeConsumable()],
        userCurrency: currency,
        userProfile: makeUserProfile({ currency, laborHourlyRate, defaultProfitMargin }),
        laborHourlyRate,
        defaultProfitMargin,
        electricity: makeElectricity({ costPerKwh: parseFloat((0.05 + rng() * 0.3).toFixed(3)) }),
        editingJob: makeEditingJob({
          marketplace,
          currency,
          filaments: [{ filamentId: materialChoice.id, grams, pricePerGram: materialChoice.costPerUnit ?? 0.02, currency }],
          printTimeHours,
          failureRate,
          prepTimeMinutes,
          postProcessingMinutes,
          sellingPrice,
          costPerUnit,
        }),
      }),
    });
  }

  return scenarios;
}

export const RANDOM_SCENARIOS: Scenario[] = generateRandomScenarios();
