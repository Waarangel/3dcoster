import { useState, useEffect } from 'react';
import type { Material, PrinterInstance, MaterialUsage, PrintJob, Currency, ShippingMethodType, MarketplaceType } from '../types';

// Session storage key for form persistence
export const FORM_STORAGE_KEY = 'costCalculatorForm';

// Helper to get initial state from sessionStorage or default
export function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (key in parsed) return parsed[key];
    }
  } catch (e) {
    console.error('[CostCalculator] Failed to parse sessionStorage:', e);
    sessionStorage.removeItem(FORM_STORAGE_KEY);
  }
  return defaultValue;
}

// Internal form state for multi-filament rows (NOT the DB FilamentUsage type)
// Monotonic source of stable, view-only row keys for the dynamic filament &
// material lists. A key is assigned when a row enters component state and is
// never persisted — it's stripped before a job is written to IndexedDB — so
// React gets stable keys (no index keys on reorderable/deletable lists) without
// leaking a view concern into the stored schema.
let rowKeySeq = 0;
export const nextRowKey = (): string => `row-${++rowKeySeq}`;

export interface FilamentRow {
  uid: string;
  filamentId: string;
  grams: number;
  editedPrice: number;
  editedCurrency: Currency;
}

// MaterialUsage augmented with a stable view-only key (see nextRowKey).
export type MaterialRow = MaterialUsage & { uid: string };

export interface UseCostFormProps {
  editingJob: PrintJob | null;
  userCurrency: Currency;
  printerInstances: PrinterInstance[];
  materials: Material[];
  defaultProfitMargin: number;
}

export function useCostForm({ editingJob, userCurrency, printerInstances, materials, defaultProfitMargin }: UseCostFormProps) {
  // makeDefaultRow is a function (not a constant) so it captures userCurrency at call time
  const makeDefaultRow = (currency: Currency): FilamentRow => ({
    uid: nextRowKey(),
    filamentId: '',
    grams: 0,
    editedPrice: 0,
    editedCurrency: currency,
  });

  // Wrap a stored MaterialUsage in a view-only key for the editable list, and
  // strip it back out before the job is persisted (keeps the stored schema clean).
  const toMaterialRow = (usage: MaterialUsage): MaterialRow => ({ ...usage, uid: nextRowKey() });
  const stripRowKey = (row: MaterialRow): MaterialUsage => ({ materialId: row.materialId, quantity: row.quantity });

  // Print job inputs - restore from sessionStorage if available
  const [printName, setPrintName] = useState(() => getStoredValue('printName', ''));
  const [filamentRows, setFilamentRows] = useState<FilamentRow[]>(() => {
    try {
      const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // New format: has filamentRows array
        if (Array.isArray(parsed.filamentRows) && parsed.filamentRows.length > 0) {
          // Reassign view-only keys from the live sequence so restored rows can't
          // collide with freshly-added ones (persisted keys are not trusted).
          return (parsed.filamentRows as FilamentRow[]).map(r => ({ ...r, uid: nextRowKey() }));
        }
        // Old format: has filamentId scalar -- graceful fallback per PERSIST-02
        // Just fall through to default
      }
    } catch (e) {
      console.error('[CostCalculator] Failed to parse filamentRows from sessionStorage:', e);
      sessionStorage.removeItem(FORM_STORAGE_KEY);
    }
    return [makeDefaultRow(userCurrency)];
  });

  // Helper functions for filament row management
  const addFilamentRow = () => {
    if (filamentRows.length >= 16) return;
    setFilamentRows(prev => [...prev, makeDefaultRow(userCurrency)]);
  };

  const removeFilamentRow = (index: number) => {
    if (index === 0) return;
    setFilamentRows(prev => prev.filter((_, i) => i !== index));
  };

  const updateFilamentRow = (index: number, patch: Partial<FilamentRow>) => {
    setFilamentRows(prev => prev.map((row, i) => i === index ? { ...row, ...patch } : row));
  };
  const [selectedInstanceId, setSelectedInstanceId] = useState(() => {
    const stored = getStoredValue('selectedInstanceId', '');
    // If stored value is empty or doesn't match any current printer, use first available
    if (!stored || !printerInstances.some(p => p.id === stored)) {
      return printerInstances[0]?.id || '';
    }
    return stored;
  });
  const [printTimeHours, setPrintTimeHours] = useState(() => getStoredValue('printTimeHours', 0));
  const [modelCost, setModelCost] = useState(() => getStoredValue('modelCost', 0));
  const [modelCostPerUnit, setModelCostPerUnit] = useState(() => getStoredValue('modelCostPerUnit', false));
  const [authorMinPrice, setAuthorMinPrice] = useState(() => getStoredValue('authorMinPrice', 0));
  const [modelUrl, setModelUrl] = useState(() => getStoredValue('modelUrl', ''));
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(() => getStoredValue('prepTimeMinutes', 0));
  const [postProcessingMinutes, setPostProcessingMinutes] = useState(() => getStoredValue('postProcessingMinutes', 0));
  const [failureRate, setFailureRate] = useState(() => getStoredValue('failureRate', 5));
  const [materialsUsed, setMaterialsUsed] = useState<MaterialRow[]>(() => getStoredValue<MaterialUsage[]>('materialsUsed', []).map(toMaterialRow));

  // Pricing inputs (interlinked)
  const [profitMarginPercent, setProfitMarginPercent] = useState(() => getStoredValue('profitMarginPercent', defaultProfitMargin));
  const [targetProfit, setTargetProfit] = useState(() => getStoredValue('targetProfit', 0));
  const [sellingPrice, setSellingPrice] = useState(() => getStoredValue('sellingPrice', 0));
  const [lastEdited, setLastEdited] = useState<'margin' | 'profit' | 'price'>(() => getStoredValue('lastEdited', 'margin'));

  // Per-job Tax Rate override (Phase 13). Undefined ⇒ chain falls back to Settings default → region → manual.
  // editingJob takes precedence over sessionStorage (resumed-job-edit case).
  const [taxRateOverride, setTaxRateOverride] = useState<number | undefined>(
    () => editingJob?.taxRate ?? getStoredValue<number | undefined>('taxRateOverride', undefined)
  );

  // Shipping
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodType>(() => getStoredValue('shippingMethod', 'local_pickup'));
  const [shippingDistanceKm, setShippingDistanceKm] = useState(() => getStoredValue('shippingDistanceKm', 0));
  const [shippingOverrideCost, setShippingOverrideCost] = useState<number | null>(() => getStoredValue('shippingOverrideCost', null));
  const [packagingMaterials, setPackagingMaterials] = useState<MaterialRow[]>(() => getStoredValue<MaterialUsage[]>('packagingMaterials', []).map(toMaterialRow));

  // Marketplace
  const [marketplace, setMarketplace] = useState<MarketplaceType>(() => getStoredValue('marketplace', 'none'));

  // Etsy self-review check state (Phase 14 — ETSY-01, D-18).
  // editingJob takes precedence over sessionStorage (resumed-job-edit case).
  const [etsyChecks, setEtsyChecks] = useState<Record<string, boolean>>(
    () => editingJob?.etsyChecks ?? getStoredValue('etsyChecks', {} as Record<string, boolean>)
  );

  // Persist form state to sessionStorage whenever values change
  useEffect(() => {
    // Don't persist when editing an existing job
    if (editingJob) return;

    const formState = {
      printName,
      filamentRows,
      selectedInstanceId,
      printTimeHours,
      modelCost,
      modelCostPerUnit,
      authorMinPrice,
      modelUrl,
      prepTimeMinutes,
      postProcessingMinutes,
      failureRate,
      materialsUsed,
      profitMarginPercent,
      targetProfit,
      sellingPrice,
      taxRateOverride,
      lastEdited,
      shippingMethod,
      shippingDistanceKm,
      shippingOverrideCost,
      packagingMaterials,
      marketplace,
      etsyChecks,
    };
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
  }, [
    editingJob, printName, filamentRows,
    selectedInstanceId, printTimeHours, modelCost, modelCostPerUnit, authorMinPrice, modelUrl, prepTimeMinutes, postProcessingMinutes,
    failureRate, materialsUsed, profitMarginPercent, targetProfit, sellingPrice, taxRateOverride, lastEdited,
    shippingMethod, shippingDistanceKm, shippingOverrideCost, packagingMaterials, marketplace, etsyChecks
  ]);

  // Populate fields when editing an existing job
  useEffect(() => {
    if (editingJob) {
      setPrintName(editingJob.name);
      setSelectedInstanceId(editingJob.printerInstanceId);
      setPrintTimeHours(editingJob.printTimeHours);
      setModelCost(editingJob.modelCost);
      setModelCostPerUnit(editingJob.modelCostPerUnit ?? false);
      setAuthorMinPrice(editingJob.authorMinPrice ?? 0);
      setModelUrl(editingJob.modelUrl ?? '');
      setPrepTimeMinutes(editingJob.prepTimeMinutes);
      setPostProcessingMinutes(editingJob.postProcessingMinutes);
      setFailureRate(editingJob.failureRate);
      setMaterialsUsed(editingJob.materialsUsed.map(toMaterialRow));
      setSellingPrice(editingJob.sellingPrice);
      setTaxRateOverride(editingJob.taxRate);
      setEtsyChecks(editingJob.etsyChecks ?? {});
      // Cost-input snapshot restore (Phase 14 fix-up). Fields are optional on PrintJob —
      // pre-fix-up records have these undefined, in which case we leave form state alone
      // (it falls back to sessionStorage / defaults from the initial useState).
      if (editingJob.shippingMethod !== undefined) setShippingMethod(editingJob.shippingMethod);
      if (editingJob.shippingDistanceKm !== undefined) setShippingDistanceKm(editingJob.shippingDistanceKm);
      if (editingJob.shippingOverrideCost !== undefined) setShippingOverrideCost(editingJob.shippingOverrideCost);
      if (editingJob.packagingMaterials !== undefined) setPackagingMaterials(editingJob.packagingMaterials.map(toMaterialRow));
      if (editingJob.marketplace !== undefined) setMarketplace(editingJob.marketplace);
      // Seed profit margin + target profit from the saved cost basis so the
      // user sees the historical margin immediately, not the user-profile default.
      // The derive-from-price effect rebases these against current trueCost once
      // filaments and materials reconcile, so changed asset prices still surface.
      if (editingJob.sellingPrice > 0 && editingJob.costPerUnit > 0) {
        const savedProfit = editingJob.sellingPrice - editingJob.costPerUnit;
        const savedMargin = (savedProfit / editingJob.sellingPrice) * 100;
        setTargetProfit(parseFloat(savedProfit.toFixed(2)));
        setProfitMarginPercent(parseFloat(savedMargin.toFixed(1)));
      }
      setLastEdited('price');

      // Restore filament rows from FilamentUsage[] (new multi-filament data model)
      const restoredRows: FilamentRow[] = (editingJob.filaments ?? []).map(fu => {
        const asset = materials.find(m => m.id === fu.filamentId);
        return {
          uid: nextRowKey(),
          filamentId: fu.filamentId,
          grams: fu.grams,
          editedPrice: fu.pricePerGram ?? asset?.costPerUnit ?? 0,
          editedCurrency: fu.currency ?? asset?.currency ?? userCurrency,
        };
      });
      setFilamentRows(restoredRows.length > 0 ? restoredRows : [makeDefaultRow(userCurrency)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingJob]);

  // Auto-select first printer if none selected but printers exist
  // Also handles case where stored printer ID no longer exists or is empty
  useEffect(() => {
    if (editingJob) return; // Don't auto-select when editing
    if (printerInstances.length === 0) return; // No printers available yet

    // Check if current selection is valid (exists and is not empty)
    const hasValidSelection = selectedInstanceId && selectedInstanceId.trim() !== '' && printerInstances.some(p => p.id === selectedInstanceId);

    if (!hasValidSelection) {
      setSelectedInstanceId(printerInstances[0].id);
    }
  }, [printerInstances, selectedInstanceId, editingJob]);

  // Clear form handler
  const clearForm = () => {
    setPrintName('');
    setFilamentRows([makeDefaultRow(userCurrency)]);
    setSelectedInstanceId(printerInstances[0]?.id || '');
    setPrintTimeHours(0);
    setModelCost(0);
    setModelCostPerUnit(false);
    setAuthorMinPrice(0);
    setModelUrl('');
    setPrepTimeMinutes(0);
    setPostProcessingMinutes(0);
    setFailureRate(5);
    setMaterialsUsed([]);
    setSellingPrice(0);
    setTargetProfit(0);
    setProfitMarginPercent(defaultProfitMargin);
    setTaxRateOverride(undefined);
    setLastEdited('margin');
    setShippingMethod('local_pickup');
    setShippingDistanceKm(0);
    setShippingOverrideCost(null);
    setPackagingMaterials([]);
    setMarketplace('none');
    setEtsyChecks({});
    // Clear sessionStorage when form is cleared
    sessionStorage.removeItem(FORM_STORAGE_KEY);
  };

  return {
    printName, setPrintName,
    filamentRows, setFilamentRows,
    addFilamentRow, removeFilamentRow, updateFilamentRow,
    selectedInstanceId, setSelectedInstanceId,
    printTimeHours, setPrintTimeHours,
    modelCost, setModelCost,
    modelCostPerUnit, setModelCostPerUnit,
    authorMinPrice, setAuthorMinPrice,
    modelUrl, setModelUrl,
    prepTimeMinutes, setPrepTimeMinutes,
    postProcessingMinutes, setPostProcessingMinutes,
    failureRate, setFailureRate,
    materialsUsed, setMaterialsUsed,
    profitMarginPercent, setProfitMarginPercent,
    targetProfit, setTargetProfit,
    sellingPrice, setSellingPrice,
    lastEdited, setLastEdited,
    taxRateOverride, setTaxRateOverride,
    shippingMethod, setShippingMethod,
    shippingDistanceKm, setShippingDistanceKm,
    shippingOverrideCost, setShippingOverrideCost,
    packagingMaterials, setPackagingMaterials,
    marketplace, setMarketplace,
    etsyChecks, setEtsyChecks,
    makeDefaultRow,
    toMaterialRow,
    stripRowKey,
    clearForm,
  };
}
