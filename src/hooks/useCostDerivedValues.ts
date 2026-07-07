import { useMemo, useCallback, useEffect, useReducer, useRef } from 'react';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, MaterialUsage, CostBreakdown, PrintJob, Currency, ShippingConfig, ShippingMethodType, MarketplaceType, MarketplaceFees, UserProfile } from '../types';
import { getStoredValue } from './useCostForm';
import type { FilamentRow } from './useCostForm';
import { convert, type FxRateTable } from '../utils/fxConvert';
import { computeMarketplaceFee } from '../utils/marketplaceFee';
import { priceFromMargin, priceFromProfit, marginFromPrice, type FeeShape } from '../utils/pricingInterlink';
import { calculateCost, calculateTax } from '../utils/costCalc';
import { resolveTaxRate } from '../utils/taxResolution';

// ---------------------------------------------------------------------------
// Pricing interlink — useReducer state machine (the PERF-11 fix, FOUND-02).
//
// Replaces the prior two-useEffect + ref-based fee-shape escape-hatch
// architecture (CostCalculator.tsx lines 789-852 pre-split) with a single
// reducer. Every field edit dispatches an
// action; the reducer computes the new {sellingPrice, targetProfit,
// profitMarginPercent} triple in one pass using the UNCHANGED pure functions in
// pricingInterlink.ts. Exactly one useEffect (below) dispatches RECALC when
// trueCost or the fee shape changes but the user didn't touch a pricing field —
// its dep array is honest (every value it reads is a dep), no eslint-disable.
// ---------------------------------------------------------------------------

export type LastEdited = 'margin' | 'profit' | 'price';

export interface PricingState {
  sellingPrice: number;
  targetProfit: number;
  profitMarginPercent: number;
  lastEdited: LastEdited;
}

export type PricingAction =
  | { type: 'EDIT_MARGIN'; value: number }
  | { type: 'EDIT_PROFIT'; value: number }
  | { type: 'EDIT_PRICE'; value: number }
  | { type: 'RECALC' }
  | { type: 'SEED_FROM_JOB'; sellingPrice: number; targetProfit: number; profitMarginPercent: number }
  | { type: 'RESET'; profitMarginPercent: number };

const round2 = (n: number): number => parseFloat(n.toFixed(2));
const round1 = (n: number): number => parseFloat(n.toFixed(1));

// The reducer is created per-render (closed over the current trueCost/fee) so
// dispatched actions always compute against the LATEST inputs — mirrors the
// pre-split effects, which read trueCost/marketplaceFeeParts from the render
// scope directly, not from stale closures.
//
// `feeSource` accepts either a plain FeeShape (unit tests) or a getter
// (the hook passes `() => feeShapeRef.current`, WR-01 fix): the fee shape is
// resolved at INVOCATION time, so the reducer always reads the latest
// floor-aware decomposition assigned from the real marketplaceFeeParts —
// mirroring the pre-split effects, which read feeShapeRef.current at run time.
export function createPricingReducer(trueCost: number, feeSource: FeeShape | (() => FeeShape)) {
  return function pricingReducer(state: PricingState, action: PricingAction): PricingState {
    const fee = typeof feeSource === 'function' ? feeSource() : feeSource;
    switch (action.type) {
      case 'SEED_FROM_JOB': {
        // Seed sellingPrice from the job's saved cost basis, then IMMEDIATELY
        // rebase targetProfit/profitMarginPercent against the CURRENT trueCost
        // (not the saved one) — mirrors the pre-split comment: "The
        // derive-from-price effect rebases these against current trueCost once
        // filaments and materials reconcile". Doing this inline (not waiting
        // for a separate RECALC dispatch) avoids a dependency-array race: RECALC
        // is keyed on [trueCost, fee], which may be UNCHANGED between two
        // consecutive editingJob values (e.g. same printer/materials, only the
        // job's own saved numbers differ) and so would not re-fire even though
        // a fresh seed just landed.
        if (trueCost <= 0) {
          return {
            sellingPrice: action.sellingPrice,
            targetProfit: action.targetProfit,
            profitMarginPercent: action.profitMarginPercent,
            lastEdited: 'price',
          };
        }
        const { netProfit, marginPercent } = marginFromPrice(trueCost, action.sellingPrice, fee);
        return {
          sellingPrice: action.sellingPrice,
          targetProfit: round2(netProfit),
          profitMarginPercent: round1(marginPercent),
          lastEdited: 'price',
        };
      }
      case 'RESET':
        return {
          sellingPrice: 0,
          targetProfit: 0,
          profitMarginPercent: action.profitMarginPercent,
          lastEdited: 'margin',
        };
      default:
        break;
    }

    // trueCost<=0 handling (CR-01 fix): the pre-split component stored EDIT_*
    // input UNCONDITIONALLY (the field's onChange called setSellingPrice/
    // setProfitMarginPercent/setTargetProfit + setLastEdited directly) and only
    // the DERIVATION effect was guarded on `if (trueCost <= 0) return;`. So a
    // user could type a price before entering any cost basis, the value was
    // kept (and persisted), and derivation kicked in once trueCost > 0.
    // Mirror that per-case: store the edited field + lastEdited, skip only the
    // derivation. A blanket `return state` here would drop the keystroke
    // entirely (React's eager-reducer bailout → no re-render → controlled-input
    // desync) and silently replace the typed value once costs are entered.
    // Only RECALC keeps the full guard (it is pure derivation, nothing to store).
    switch (action.type) {
      case 'EDIT_MARGIN': {
        if (trueCost <= 0) return { ...state, profitMarginPercent: action.value, lastEdited: 'margin' };
        const { price, netProfit } = priceFromMargin(trueCost, action.value, fee);
        return {
          sellingPrice: round2(price),
          targetProfit: round2(netProfit),
          profitMarginPercent: action.value,
          lastEdited: 'margin',
        };
      }
      case 'EDIT_PROFIT': {
        if (trueCost <= 0) return { ...state, targetProfit: action.value, lastEdited: 'profit' };
        const { price, marginPercent } = priceFromProfit(trueCost, action.value, fee);
        return {
          sellingPrice: round2(price),
          targetProfit: action.value,
          profitMarginPercent: round1(marginPercent),
          lastEdited: 'profit',
        };
      }
      case 'EDIT_PRICE': {
        if (trueCost <= 0) return { ...state, sellingPrice: action.value, lastEdited: 'price' };
        const { netProfit, marginPercent } = marginFromPrice(trueCost, action.value, fee);
        return {
          sellingPrice: action.value,
          targetProfit: round2(netProfit),
          profitMarginPercent: round1(marginPercent),
          lastEdited: 'price',
        };
      }
      case 'RECALC': {
        // Guard: matches the pre-split `if (trueCost <= 0) return;` — no
        // derivation runs until there's a real cost basis.
        if (trueCost <= 0) return state;
        // Re-derive off the CURRENT lastEdited branch — replaces the second
        // pre-split effect (the marketplace-fee-shape-change trigger). Never
        // flips lastEdited.
        switch (state.lastEdited) {
          case 'margin': {
            const { price, netProfit } = priceFromMargin(trueCost, state.profitMarginPercent, fee);
            return { ...state, sellingPrice: round2(price), targetProfit: round2(netProfit) };
          }
          case 'profit': {
            const { price, marginPercent } = priceFromProfit(trueCost, state.targetProfit, fee);
            return { ...state, sellingPrice: round2(price), profitMarginPercent: round1(marginPercent) };
          }
          case 'price': {
            const { netProfit, marginPercent } = marginFromPrice(trueCost, state.sellingPrice, fee);
            return { ...state, targetProfit: round2(netProfit), profitMarginPercent: round1(marginPercent) };
          }
        }
        return state;
      }
      default:
        return state;
    }
  };
}

export interface UseCostDerivedValuesProps {
  editingJob: PrintJob | null;
  userCurrency: Currency;
  fxTable: FxRateTable | null;
  materials: Material[];
  materialsUsed: MaterialUsage[];
  filamentRows: FilamentRow[];
  printTimeHours: number;
  selectedPrinter: PrinterConfig | undefined;
  selectedInstance: PrinterInstance | undefined;
  electricity: ElectricityConfig;
  laborHourlyRate: number;
  prepTimeMinutes: number;
  postProcessingMinutes: number;
  failureRate: number;
  modelCost: number;
  modelCostPerUnit: boolean;
  defaultProfitMargin: number;
  shippingMethod: ShippingMethodType;
  shippingDistanceKm: number;
  shippingOverrideCost: number | null;
  shippingConfig: ShippingConfig;
  packagingMaterials: MaterialUsage[];
  marketplace: MarketplaceType;
  marketplaceFees: MarketplaceFees;
  taxRateOverride: number | undefined;
  userProfile: UserProfile;
  // Phase 39 TOU-02/WEAR-02: ordinary CalcInput pass-throughs, both optional/
  // defaulted so omitting them is byte-identical to pre-Phase-39 behavior.
  touStartTime?: string;
  maintenanceCostPerHour?: number;
}

export function useCostDerivedValues({
  editingJob,
  userCurrency,
  fxTable,
  materials,
  materialsUsed,
  filamentRows,
  printTimeHours,
  selectedPrinter,
  selectedInstance,
  electricity,
  laborHourlyRate,
  prepTimeMinutes,
  postProcessingMinutes,
  failureRate,
  modelCost,
  modelCostPerUnit,
  defaultProfitMargin,
  shippingMethod,
  shippingDistanceKm,
  shippingOverrideCost,
  shippingConfig,
  packagingMaterials,
  marketplace,
  marketplaceFees,
  taxRateOverride,
  userProfile,
  touStartTime,
  maintenanceCostPerHour,
}: UseCostDerivedValuesProps) {
  // Convert a stored price from its native currency into the user's currency for
  // display and cost math. Falls back to the raw amount only when no rate table
  // is cached yet (rare: offline before the first successful fetch).
  //
  // NOTE: this fallback differs from AssetLibrary's `convertForDisplay`, which
  // shows the native currency CODE on a missing rate. Here we deliberately fall
  // back to the raw number under the profile symbol, because the calculator
  // renders every value with a single `currencySymbol` and can't mix codes
  // mid-total. The trade-off (a USD figure shown under a CAD symbol) only occurs
  // offline before the first fetch and self-heals once a rate loads.
  const convertToProfile = useCallback(
    (amount: number, from: Currency): number => convert(amount, from, userCurrency, fxTable) ?? amount,
    [userCurrency, fxTable],
  );

  // Materials with costPerUnit pre-converted into the user's currency, so every
  // downstream cost computation and display operates in a single currency. Name,
  // filamentType, and all other fields are preserved.
  const materialsInProfile = useMemo<Material[]>(
    () => materials.map(m =>
      m.costPerUnit == null
        ? m
        : { ...m, costPerUnit: convertToProfile(m.costPerUnit, m.currency ?? userCurrency), currency: userCurrency },
    ),
    [materials, convertToProfile, userCurrency],
  );

  // Calculate shipping cost based on method
  const shippingCost = useMemo(() => {
    if (shippingOverrideCost !== null) return shippingOverrideCost;

    switch (shippingMethod) {
      case 'local_pickup':
        return 0;
      case 'dropoff': {
        // Round trip distance * fuel consumption * fuel price.
        // Ceil to the next cent so float math (e.g. 6.354179999…) doesn't leak
        // into the input value or the totals — always at-or-above the real cost.
        const roundTripKm = shippingDistanceKm * 2;
        const litersUsed = (roundTripKm / 100) * shippingConfig.vehicleFuelEfficiency;
        return Math.ceil(litersUsed * shippingConfig.gasPricePerLiter * 100) / 100;
      }
      case 'ups':
        return shippingConfig.upsBaseCost;
      case 'fedex':
        return shippingConfig.fedexBaseCost;
      case 'dhl':
        return shippingConfig.dhlBaseCost;
      case 'purolator':
        return shippingConfig.purolatorBaseCost;
      case 'usps':
        return shippingConfig.uspsBaseCost;
      case 'royal_mail':
        return shippingConfig.royalMailBaseCost;
      case 'australia_post':
        return shippingConfig.australiaPostBaseCost;
      case 'canada_post':
        return shippingConfig.canadaPostBaseCost;
      default: {
        // Check if it's a custom carrier
        const customCarrier = shippingConfig.customCarriers?.find(c => c.id === shippingMethod);
        if (customCarrier) {
          return customCarrier.defaultCost;
        }
        return 0;
      }
    }
  }, [shippingMethod, shippingDistanceKm, shippingOverrideCost, shippingConfig]);

  // Calculate packaging materials cost
  const packagingCost = useMemo(() => {
    return packagingMaterials.reduce((total, usage) => {
      const material = materialsInProfile.find(m => m.id === usage.materialId);
      if (!material) return total;
      return total + usage.quantity * (material.costPerUnit ?? 0);
    }, 0);
  }, [packagingMaterials, materialsInProfile]);

  // Total shipping = carrier/delivery cost + packaging materials
  const totalShippingCost = shippingCost + packagingCost;

  // Filament rows with each per-gram price converted into the user's currency,
  // so the cost math runs in a single currency regardless of the filament's
  // native currency (grams + filamentId are preserved for the nozzle-wear calc).
  const filamentRowsForCalc = useMemo(
    () => filamentRows.map(row => ({
      ...row,
      editedPrice: convertToProfile(row.editedPrice, row.editedCurrency),
      editedCurrency: userCurrency,
    })),
    [filamentRows, convertToProfile, userCurrency],
  );

  // --- Bootstrapping note -----------------------------------------------
  // `trueCost` (via costs.failureAdjusted) does NOT depend on
  // profitMarginPercent/targetProfit/sellingPrice — costCalc.ts carries them
  // through CostBreakdown as pure PASS-THROUGH display fields only. The
  // pricingReducer, in turn, needs trueCost + the fee shape to compute new
  // pricing. To build `useReducer`'s reducer argument from the CURRENT
  // render's trueCost (so React always applies the live reducer — verified:
  // React re-reads the reducer function argument on the render that processes
  // each dispatch, it is not frozen at a stale closure), the cost breakdown is
  // computed in two passes: `costsForTrueCost` (placeholder 0s for the pricing
  // fields, used ONLY to derive trueCost/fixedCosts/marketplaceFeeParts) and
  // `costs` (the real, pricing-inclusive CostBreakdown returned to callers).
  // Both calls are byte-identical except for the three pass-through fields,
  // which never influence failureAdjusted/printerDepreciation/nozzleWear.
  const costsForTrueCost = useMemo((): CostBreakdown => calculateCost({
    filamentRows: filamentRowsForCalc,
    printTimeHours,
    selectedPrinter,
    selectedInstance,
    electricity,
    materials: materialsInProfile,
    materialsUsed,
    prepTimeMinutes,
    postProcessingMinutes,
    laborHourlyRate,
    failureRate,
    profitMarginPercent: 0,
    targetProfit: 0,
    sellingPrice: 0,
    modelCost,
    modelCostPerUnit,
    touStartTime,
    maintenanceCostPerHour,
  }), [
    materialsInProfile, filamentRowsForCalc, printTimeHours, selectedPrinter, electricity,
    selectedInstance, materialsUsed, laborHourlyRate, prepTimeMinutes,
    postProcessingMinutes, failureRate, modelCost, modelCostPerUnit,
    touStartTime, maintenanceCostPerHour,
  ]);

  const trueCostForReducer = costsForTrueCost.failureAdjusted + totalShippingCost;

  // Marketplace fee decomposition needs sellingPrice, which is circular with
  // the reducer it feeds — resolved with the pre-split pattern (WR-01 fix): a
  // ref assigned from the REAL, floor-aware marketplaceFeeParts every render
  // (after `pricing` exists below), read by the reducer at INVOCATION time via
  // the getter passed to createPricingReducer. This matters for platforms
  // whose decomposition depends on the price itself — facebook_shipped's
  // $0.80 min-fee floor yields { pctFees: processing-only, fixedFees: minFee }
  // when the floor binds, which a shape computed at sellingPrice: 0 can never
  // represent. The pre-split component read feeShapeRef.current (assigned from
  // live marketplaceFeeParts) inside both derivation effects — same contract.
  // At worst the shape lags one committed render behind (same as pre-split);
  // the RECALC effect below re-fires when the real parts change, so it
  // converges immediately.
  const feeShapeRef = useRef<FeeShape>({ pctFees: 0, fixedFees: 0 });

  // Pricing interlink state — see createPricingReducer above for the derivation.
  // The reducer argument is rebuilt every render from trueCostForReducer (and
  // reads feeShapeRef at invocation time) so any dispatch (RECALC or a field
  // EDIT_*) processed on or after this render always computes against fresh
  // inputs. Initial state is seeded from sessionStorage (new job) or the
  // editingJob's saved cost basis (resumed edit), mirroring the pre-split
  // component's useState lazy initializers exactly.
  const [pricing, dispatchPricing] = useReducer(
    // The getter below is only invoked inside the reducer at dispatch-
    // PROCESSING time (event handler / queued update), never while rendering
    // output; this is the pre-split feeShapeRef read-at-run-time pattern
    // (WR-01 fix) — hence the targeted suppression.
    // eslint-disable-next-line react-hooks/refs
    createPricingReducer(trueCostForReducer, () => feeShapeRef.current),
    undefined,
    (): PricingState => {
      if (editingJob && editingJob.sellingPrice > 0 && editingJob.costPerUnit > 0) {
        const savedProfit = editingJob.sellingPrice - editingJob.costPerUnit;
        const savedMargin = (savedProfit / editingJob.sellingPrice) * 100;
        return {
          sellingPrice: editingJob.sellingPrice,
          targetProfit: round2(savedProfit),
          profitMarginPercent: round1(savedMargin),
          lastEdited: 'price',
        };
      }
      if (editingJob) {
        return {
          sellingPrice: editingJob.sellingPrice,
          targetProfit: 0,
          profitMarginPercent: defaultProfitMargin,
          lastEdited: 'price',
        };
      }
      return {
        profitMarginPercent: getStoredValue('profitMarginPercent', defaultProfitMargin),
        targetProfit: getStoredValue('targetProfit', 0),
        sellingPrice: getStoredValue('sellingPrice', 0),
        lastEdited: getStoredValue<LastEdited>('lastEdited', 'margin'),
      };
    },
  );

  // Re-seed pricing from the saved cost basis whenever editingJob changes (not
  // just on mount — the useReducer lazy initializer above only runs once).
  // Mirrors the pre-split editingJob-population effect's pricing-seeding
  // branch (CostCalculator.tsx pre-split lines ~314-320) exactly, including
  // the "no savings basis yet" fallback (sellingPrice from the job, profit/
  // margin left at 0/default) for legacy jobs. Honest dep array (includes
  // defaultProfitMargin and dispatchPricing) — no suppression needed here.
  useEffect(() => {
    if (!editingJob) return;
    if (editingJob.sellingPrice > 0 && editingJob.costPerUnit > 0) {
      const savedProfit = editingJob.sellingPrice - editingJob.costPerUnit;
      const savedMargin = (savedProfit / editingJob.sellingPrice) * 100;
      dispatchPricing({
        type: 'SEED_FROM_JOB',
        sellingPrice: editingJob.sellingPrice,
        targetProfit: round2(savedProfit),
        profitMarginPercent: round1(savedMargin),
      });
    } else {
      dispatchPricing({
        type: 'SEED_FROM_JOB',
        sellingPrice: editingJob.sellingPrice,
        targetProfit: 0,
        profitMarginPercent: defaultProfitMargin,
      });
    }
  }, [editingJob, defaultProfitMargin, dispatchPricing]);

  // Cost calculation extracted to src/utils/costCalc.ts for testability (Phase 10, D-01).
  // Prices are fed in already converted to the user's currency (filamentRowsForCalc,
  // materialsInProfile), so calculateCost itself stays currency-agnostic. This is
  // the REAL CostBreakdown returned to callers (pricing pass-through fields are
  // the actual reducer state, unlike costsForTrueCost above).
  const costs = useMemo((): CostBreakdown => calculateCost({
    filamentRows: filamentRowsForCalc,
    printTimeHours,
    selectedPrinter,
    selectedInstance,
    electricity,
    materials: materialsInProfile,
    materialsUsed,
    prepTimeMinutes,
    postProcessingMinutes,
    laborHourlyRate,
    failureRate,
    profitMarginPercent: pricing.profitMarginPercent,
    targetProfit: pricing.targetProfit,
    sellingPrice: pricing.sellingPrice,
    modelCost,
    modelCostPerUnit,
    touStartTime,
    maintenanceCostPerHour,
  }), [
    materialsInProfile, filamentRowsForCalc, printTimeHours, selectedPrinter, electricity,
    selectedInstance, materialsUsed, laborHourlyRate, prepTimeMinutes,
    postProcessingMinutes, failureRate, pricing.profitMarginPercent, pricing.targetProfit, pricing.sellingPrice,
    modelCost, modelCostPerUnit, touStartTime, maintenanceCostPerHour,
  ]);

  // True cost = failure adjusted cost + shipping
  // True cost = failure adjusted cost + total shipping (carrier + packaging)
  // Byte-identical to trueCostForReducer (failureAdjusted does not depend on
  // the pricing pass-through fields) — kept as a separate read for clarity and
  // so this value (not the bootstrapping one) is what's returned to callers.
  const trueCost = costs.failureAdjusted + totalShippingCost;

  // Marketplace fee decomposition (pctFees + fixedFees + total), all in the
  // user's currency. The fixed-dollar fee constants are stored in USD in the
  // Settings → Marketplaces config and FX-converted here (cost HIGH fix) — a
  // non-USD seller was previously charged the raw USD number (e.g. ¥0.45
  // instead of ~¥70). Percentage fees are currency-agnostic. The pct/fixed
  // split also feeds the net-margin closed-form in the pricing interlink below.
  const marketplaceFeeParts = useMemo(
    () => computeMarketplaceFee({ sellingPrice: pricing.sellingPrice, marketplace, fees: marketplaceFees, userCurrency, fxTable }),
    [pricing.sellingPrice, marketplace, marketplaceFees, userCurrency, fxTable],
  );
  const marketplaceFee = marketplaceFeeParts.total;

  // Keep the reducer's fee shape in lockstep with the live, floor-aware
  // decomposition (WR-01 fix). Assigned in an effect (not the render body) so
  // discarded renders never leak a value into the ref; declared BEFORE the
  // RECALC effect below so that within any commit the ref is updated first,
  // and the RECALC dispatched by the next effect is processed against the
  // fresh shape. Same observable semantics as the pre-split component's
  // feeShapeRef (its effects also read the last committed decomposition).
  useEffect(() => {
    feeShapeRef.current = { pctFees: marketplaceFeeParts.pctFees, fixedFees: marketplaceFeeParts.fixedFees };
  }, [marketplaceFeeParts.pctFees, marketplaceFeeParts.fixedFees]);

  // The ONE remaining pricing effect: dispatches RECALC when trueCost or the fee
  // shape changes but the user didn't touch a pricing field. Dep array is honest
  // — every value it reads (trueCost, pctFees, fixedFees) is a dep. No
  // eslint-disable. Replaces BOTH pre-split effects and the ref-based escape hatch.
  useEffect(() => {
    dispatchPricing({ type: 'RECALC' });
  }, [trueCost, marketplaceFeeParts.pctFees, marketplaceFeeParts.fixedFees]);

  // Fixed costs for this print job (recovered through sales, not added to per-unit cost)
  // When modelCostPerUnit is true, model cost is NOT a fixed cost - it's included in per-unit
  const fixedCosts = useMemo(() => {
    const fixedModelCost = modelCostPerUnit ? 0 : modelCost;
    return {
      depreciation: costs.printerDepreciation,
      nozzleWear: costs.nozzleWear,
      modelCost: fixedModelCost,
      total: costs.printerDepreciation + costs.nozzleWear + fixedModelCost,
    };
  }, [costs.printerDepreciation, costs.nozzleWear, modelCost, modelCostPerUnit]);

  // Calculate break-even info. profitPerUnit is NET of the marketplace fee
  // (v1.9 cost-MEDIUM decision) so the widget's break-even matches the net
  // framing and the sales-report treatment (fee comes off revenue). With no
  // marketplace selected marketplaceFee = 0 and this reduces to the prior math.
  const breakEvenInfo = useMemo(() => {
    const costPerUnit = trueCost;  // Per-unit consumable cost only (fee-free — persisted as-is)
    const profitPerUnit = pricing.sellingPrice - costPerUnit - marketplaceFee;

    // Copies needed to break even on ALL fixed costs (model + depreciation + nozzle)
    const breakEvenCopies = profitPerUnit > 0
      ? Math.ceil(fixedCosts.total / profitPerUnit)
      : fixedCosts.total > 0 ? Infinity : 0;

    // Total investment to break even
    const totalInvestmentToBreakEven = fixedCosts.total + (costPerUnit * breakEvenCopies);

    return {
      costPerUnit,
      profitPerUnit,
      breakEvenCopies,
      totalInvestmentToBreakEven,
    };
  }, [trueCost, pricing.sellingPrice, fixedCosts, marketplaceFee]);

  // Phase 13: tax-rate provenance chain (override → settings → province → region → eu-average → manual).
  // Reads `taxRateOverride` local state so in-progress edits flow through `resolveTaxRate`.
  // address takes precedence over currency-keyed default once filled (e.g., Ontario 13% HST
  // beats the Canadian federal 5% GST default).
  const taxSource = useMemo(
    () => resolveTaxRate({
      jobOverride: taxRateOverride,
      settingsDefault: userProfile.defaultTaxRate,
      currency: userCurrency,
      address: userProfile.address,
    }),
    [taxRateOverride, userProfile.defaultTaxRate, userCurrency, userProfile.address]
  );
  // Phase 13: tax math (TAX-05 lock — applied to sellingPrice, NOT subtotal).
  const tax = useMemo(
    () => calculateTax(pricing.sellingPrice, taxSource.rate),
    [pricing.sellingPrice, taxSource.rate]
  );

  // Per-job Tax Rate input placeholder — resolves the chain WITHOUT the override
  // so the user sees the inherited rate they'd get if they left the field blank.
  // Blank input means "inherit"; the placeholder makes the inherited value visible.
  const inheritedTaxRate = useMemo(
    () => resolveTaxRate({
      jobOverride: undefined,
      settingsDefault: userProfile.defaultTaxRate,
      currency: userCurrency,
      address: userProfile.address,
    }).rate,
    [userProfile.defaultTaxRate, userCurrency, userProfile.address]
  );

  return {
    convertToProfile,
    materialsInProfile,
    shippingCost,
    packagingCost,
    totalShippingCost,
    filamentRowsForCalc,
    marketplaceFeeParts,
    marketplaceFee,
    costs,
    trueCost,
    fixedCosts,
    breakEvenInfo,
    taxSource,
    tax,
    inheritedTaxRate,
    pricing,
    dispatchPricing,
  };
}

// Shared return-shape type so section components can accept a typed SUBSET
// of this hook's output (via Pick<>) instead of re-declaring every field name
// individually — keeps the orchestrator's JSX prop-passing terse while each
// section's prop interface still enumerates exactly which fields it reads.
export type UseCostDerivedValuesResult = ReturnType<typeof useCostDerivedValues>;
