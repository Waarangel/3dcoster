import { useState, useEffect, useMemo } from 'react';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, MaterialUsage, CostBreakdown, PrintJob, Currency, ShippingConfig, ShippingMethodType, MarketplaceType, FilamentUsage } from '../types';
import { FilamentSelector } from './FilamentSelector';
import { GcodeImport } from './GcodeImport';
import { NewBadge } from './NewBadge';
import { Button, Input, Select, InfoTooltip } from './ui';
import { getCurrencySymbol, getDistanceUnit, kmToMiles, milesToKm } from '../utils/currency';
import { calculateCost } from '../utils/costCalc';

// Default marketplace fees based on research (to be implemented)
// Facebook Marketplace: 10% + $0.80 min + 2.9% processing for shipped items
// Etsy: 6.5% transaction + 3% + $0.25 payment + $0.20 listing + 15% offsite ads

interface CostCalculatorProps {
  materials: Material[];
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  electricity: ElectricityConfig;
  laborHourlyRate: number;
  defaultProfitMargin: number;
  userCurrency: Currency;
  shippingConfig: ShippingConfig;
  onSaveJob: (job: PrintJob, printHours: number) => void;
  onUpdateJob: (job: PrintJob) => void;
  editingJob: PrintJob | null;
  onCancelEdit: () => void;
}

// Session storage key for form persistence
const FORM_STORAGE_KEY = 'costCalculatorForm';

// Helper to get initial state from sessionStorage or default
function getStoredValue<T>(key: string, defaultValue: T): T {
  try {
    const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (key in parsed) return parsed[key];
    }
  } catch {
    // Ignore parsing errors
  }
  return defaultValue;
}

// Internal form state for multi-filament rows (NOT the DB FilamentUsage type)
interface FilamentRow {
  filamentId: string;
  grams: number;
  editedPrice: number;
  editedCurrency: Currency;
}

export function CostCalculator({ materials, printers, printerInstances, electricity, laborHourlyRate, defaultProfitMargin, userCurrency, shippingConfig, onSaveJob, onUpdateJob, editingJob, onCancelEdit }: CostCalculatorProps) {
  // Get currency symbol for display - changes based on user's selected currency
  const currencySymbol = getCurrencySymbol(userCurrency);
  // Get distance unit based on region (mi for US, km for most others)
  const distanceUnit = getDistanceUnit(userCurrency);

  // makeDefaultRow is a function (not a constant) so it captures userCurrency at call time
  const makeDefaultRow = (currency: Currency): FilamentRow => ({
    filamentId: '',
    grams: 0,
    editedPrice: 0,
    editedCurrency: currency,
  });

  // Print job inputs - restore from sessionStorage if available
  const [printName, setPrintName] = useState(() => getStoredValue('printName', ''));
  const [filamentRows, setFilamentRows] = useState<FilamentRow[]>(() => {
    try {
      const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // New format: has filamentRows array
        if (Array.isArray(parsed.filamentRows) && parsed.filamentRows.length > 0) {
          return parsed.filamentRows as FilamentRow[];
        }
        // Old format: has filamentId scalar -- graceful fallback per PERSIST-02
        // Just fall through to default
      }
    } catch {
      // Ignore parsing errors
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
  const [materialsUsed, setMaterialsUsed] = useState<MaterialUsage[]>(() => getStoredValue('materialsUsed', []));

  // Pricing inputs (interlinked)
  const [profitMarginPercent, setProfitMarginPercent] = useState(() => getStoredValue('profitMarginPercent', defaultProfitMargin));
  const [targetProfit, setTargetProfit] = useState(() => getStoredValue('targetProfit', 0));
  const [sellingPrice, setSellingPrice] = useState(() => getStoredValue('sellingPrice', 0));
  const [lastEdited, setLastEdited] = useState<'margin' | 'profit' | 'price'>(() => getStoredValue('lastEdited', 'margin'));

  // Shipping
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodType>(() => getStoredValue('shippingMethod', 'local_pickup'));
  const [shippingDistanceKm, setShippingDistanceKm] = useState(() => getStoredValue('shippingDistanceKm', 0));
  const [shippingOverrideCost, setShippingOverrideCost] = useState<number | null>(() => getStoredValue('shippingOverrideCost', null));
  const [packagingMaterials, setPackagingMaterials] = useState<MaterialUsage[]>(() => getStoredValue('packagingMaterials', []));

  // Marketplace
  const [marketplace, setMarketplace] = useState<MarketplaceType>(() => getStoredValue('marketplace', 'none'));

  // Job saved feedback
  const [justSaved, setJustSaved] = useState(false);

  // Validation error toast
  const [validationError, setValidationError] = useState<string | null>(null);

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
      lastEdited,
      shippingMethod,
      shippingDistanceKm,
      shippingOverrideCost,
      packagingMaterials,
      marketplace,
    };
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
  }, [
    editingJob, printName, filamentRows,
    selectedInstanceId, printTimeHours, modelCost, modelCostPerUnit, authorMinPrice, modelUrl, prepTimeMinutes, postProcessingMinutes,
    failureRate, materialsUsed, profitMarginPercent, targetProfit, sellingPrice, lastEdited,
    shippingMethod, shippingDistanceKm, shippingOverrideCost, packagingMaterials, marketplace
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
      setMaterialsUsed(editingJob.materialsUsed);
      setSellingPrice(editingJob.sellingPrice);
      setLastEdited('price');

      // Restore filament rows from FilamentUsage[] (new multi-filament data model)
      const restoredRows: FilamentRow[] = (editingJob.filaments ?? []).map(fu => {
        const asset = materials.find(m => m.id === fu.filamentId);
        return {
          filamentId: fu.filamentId,
          grams: fu.grams,
          editedPrice: fu.pricePerGram ?? asset?.costPerUnit ?? 0,
          editedCurrency: fu.currency ?? asset?.currency ?? userCurrency,
        };
      });
      setFilamentRows(restoredRows.length > 0 ? restoredRows : [makeDefaultRow(userCurrency)]);
    }
  }, [editingJob, materials]);

  // Auto-select first printer if none selected but printers exist
  // Also handles case where stored printer ID no longer exists or is empty
  useEffect(() => {
    if (editingJob) return; // Don't auto-select when editing
    if (printerInstances.length === 0) return; // No printers available yet

    // Check if current selection is valid (exists and is not empty)
    const hasValidSelection = selectedInstanceId && selectedInstanceId.trim() !== '' && printerInstances.some(p => p.id === selectedInstanceId);

    if (!hasValidSelection) {
      console.log('Auto-selecting printer:', printerInstances[0].id, 'from instances:', printerInstances.map(p => p.id));
      setSelectedInstanceId(printerInstances[0].id);
    }
  }, [printerInstances, selectedInstanceId, editingJob]);

  // Get the selected printer instance and its config
  const selectedInstance = printerInstances.find(p => p.id === selectedInstanceId);
  const selectedPrinter = printers.find(p => p.id === selectedInstance?.printerConfigId) || printers[0] || null;

  const nonFilaments = materials.filter(m => m.category !== 'filament');
  // Filter for packaging dropdown - prioritize packaging items first, then consumables
  const packagingItems = materials.filter(m => m.category === 'packaging');
  const consumableItems = materials.filter(m => m.category === 'consumable');
  const consumables = [...packagingItems, ...consumableItems];

  // Calculate shipping cost based on method
  const shippingCost = useMemo(() => {
    if (shippingOverrideCost !== null) return shippingOverrideCost;

    switch (shippingMethod) {
      case 'local_pickup':
        return 0;
      case 'dropoff':
        // Round trip distance * fuel consumption * fuel price
        const roundTripKm = shippingDistanceKm * 2;
        const litersUsed = (roundTripKm / 100) * shippingConfig.vehicleFuelEfficiency;
        return litersUsed * shippingConfig.gasPricePerLiter;
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
      default:
        // Check if it's a custom carrier
        const customCarrier = shippingConfig.customCarriers?.find(c => c.id === shippingMethod);
        if (customCarrier) {
          return customCarrier.defaultCost;
        }
        return 0;
    }
  }, [shippingMethod, shippingDistanceKm, shippingOverrideCost, shippingConfig]);

  // Calculate packaging materials cost
  const packagingCost = useMemo(() => {
    return packagingMaterials.reduce((total, usage) => {
      const material = materials.find(m => m.id === usage.materialId);
      if (!material) return total;
      return total + usage.quantity * (material.costPerUnit ?? 0);
    }, 0);
  }, [packagingMaterials, materials]);

  // Total shipping = carrier/delivery cost + packaging materials
  const totalShippingCost = shippingCost + packagingCost;

  // Get available marketplace options based on currency
  const availableMarketplaces = useMemo(() => {
    const options: { value: MarketplaceType; label: string; description: string }[] = [
      { value: 'none', label: 'Direct Sale', description: 'No marketplace fees' },
    ];

    if (userCurrency === 'CAD') {
      options.push({ value: 'facebook_local', label: 'FB Marketplace (Local)', description: 'Free for local pickup' });
      options.push({ value: 'facebook_shipped', label: 'FB Marketplace (Shipped)', description: '10% + 2.9% processing' });
      options.push({ value: 'kijiji', label: 'Kijiji', description: 'Free basic listing' });
    } else {
      options.push({ value: 'facebook_local', label: 'FB Marketplace (Local)', description: 'Free for local pickup' });
      options.push({ value: 'facebook_shipped', label: 'FB Marketplace (Shipped)', description: '10% + 2.9% processing' });
    }

    options.push({ value: 'etsy', label: 'Etsy', description: '6.5% + 3% + 0.45 fees' });
    options.push({ value: 'etsy_offsite_ad', label: 'Etsy (Offsite Ad)', description: '+ 15% offsite ad fee' });

    return options;
  }, [userCurrency]);

  // Calculate marketplace fees based on selling price
  const marketplaceFee = useMemo(() => {
    if (sellingPrice <= 0) return 0;

    switch (marketplace) {
      case 'none':
      case 'facebook_local':
      case 'kijiji':
        return 0;

      case 'facebook_shipped':
        // 10% selling fee (min $0.80) + 2.9% payment processing
        const fbSellingFee = Math.max(0.80, sellingPrice * 0.10);
        const fbProcessingFee = sellingPrice * 0.029;
        return fbSellingFee + fbProcessingFee;

      case 'etsy':
        // 6.5% transaction + 3% payment + $0.25 payment fixed + $0.20 listing
        const etsyTransactionFee = sellingPrice * 0.065;
        const etsyPaymentFee = sellingPrice * 0.03 + 0.25;
        const etsyListingFee = 0.20;
        return etsyTransactionFee + etsyPaymentFee + etsyListingFee;

      case 'etsy_offsite_ad':
        // Same as Etsy + 15% offsite ad fee
        const etsyBase = sellingPrice * 0.065 + sellingPrice * 0.03 + 0.25 + 0.20;
        const offsiteAdFee = sellingPrice * 0.15;
        return etsyBase + offsiteAdFee;

      default:
        return 0;
    }
  }, [marketplace, sellingPrice]);

  // Get available shipping methods based on currency
  const availableShippingMethods = useMemo(() => {
    const methods: { value: ShippingMethodType; label: string }[] = [];

    // Universal options - available for all currencies
    methods.push({ value: 'local_pickup', label: 'Local Pickup (Free)' });
    methods.push({ value: 'dropoff', label: 'Dropoff (Fuel Cost)' });

    // International carriers - available everywhere
    methods.push({ value: 'ups', label: 'UPS' });
    methods.push({ value: 'fedex', label: 'FedEx' });
    methods.push({ value: 'dhl', label: 'DHL' });

    // Region-specific carriers
    if (userCurrency === 'CAD') {
      methods.push({ value: 'canada_post', label: 'Canada Post' });
      methods.push({ value: 'purolator', label: 'Purolator' });
    }
    if (userCurrency === 'USD') {
      methods.push({ value: 'usps', label: 'USPS' });
    }
    if (userCurrency === 'GBP') {
      methods.push({ value: 'royal_mail', label: 'Royal Mail' });
    }
    if (userCurrency === 'AUD' || userCurrency === 'NZD') {
      methods.push({ value: 'australia_post', label: 'Australia Post' });
    }

    // Add custom carriers from shipping config
    if (shippingConfig.customCarriers && shippingConfig.customCarriers.length > 0) {
      shippingConfig.customCarriers.forEach(carrier => {
        methods.push({ value: carrier.id, label: carrier.name });
      });
    }

    return methods;
  }, [userCurrency, shippingConfig.customCarriers]);

  // Cost calculation extracted to src/utils/costCalc.ts for testability (Phase 10, D-01)
  const costs = useMemo((): CostBreakdown => calculateCost({
    filamentRows,
    printTimeHours,
    selectedPrinter,
    selectedInstance,
    electricity,
    materials,
    materialsUsed,
    prepTimeMinutes,
    postProcessingMinutes,
    laborHourlyRate,
    failureRate,
    profitMarginPercent,
    targetProfit,
    sellingPrice,
    modelCost,
    modelCostPerUnit,
  }), [
    materials, filamentRows, printTimeHours, selectedPrinter, electricity,
    selectedInstance, materialsUsed, laborHourlyRate, prepTimeMinutes,
    postProcessingMinutes, failureRate, profitMarginPercent, targetProfit, sellingPrice,
    modelCost, modelCostPerUnit
  ]);

  // True cost = failure adjusted cost + shipping
  // True cost = failure adjusted cost + total shipping (carrier + packaging)
  const trueCost = costs.failureAdjusted + totalShippingCost;

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

  // Calculate break-even info
  const breakEvenInfo = useMemo(() => {
    const costPerUnit = trueCost;  // Per-unit consumable cost only
    const profitPerUnit = sellingPrice - costPerUnit;

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
  }, [trueCost, sellingPrice, fixedCosts]);

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
    setLastEdited('margin');
    setShippingMethod('local_pickup');
    setShippingDistanceKm(0);
    setShippingOverrideCost(null);
    setPackagingMaterials([]);
    setMarketplace('none');
    // Clear sessionStorage when form is cleared
    sessionStorage.removeItem(FORM_STORAGE_KEY);
  };

  // Auto-dismiss validation error
  useEffect(() => {
    if (!validationError) return;
    const timer = setTimeout(() => setValidationError(null), 5000);
    return () => clearTimeout(timer);
  }, [validationError]);

  // Save job handler (create new or update existing)
  const handleSaveJob = () => {
    if (!printName.trim()) {
      setValidationError('Please enter a name for this print job');
      return;
    }
    if (filamentRows.every(r => !r.filamentId)) {
      setValidationError('Please select at least one filament');
      return;
    }
    if (!selectedInstanceId || !printerInstances.some(p => p.id === selectedInstanceId)) {
      setValidationError('Please select a printer');
      return;
    }

    const filaments: FilamentUsage[] = filamentRows
      .filter(r => r.filamentId && r.grams > 0)
      .map(r => ({
        filamentId: r.filamentId,
        grams: r.grams,
        pricePerGram: r.editedPrice > 0 ? r.editedPrice : undefined,
        currency: r.editedPrice > 0 ? r.editedCurrency : undefined,
      }));

    if (editingJob) {
      // Update existing job
      const updatedJob: PrintJob = {
        ...editingJob,
        name: printName.trim(),
        updatedAt: new Date(),
        filaments,
        printTimeHours,
        printerInstanceId: selectedInstanceId,
        modelCost,
        modelCostPerUnit,
        authorMinPrice: authorMinPrice || undefined,
        modelUrl: modelUrl.trim() || undefined,
        prepTimeMinutes,
        postProcessingMinutes,
        materialsUsed,
        failureRate,
        costPerUnit: trueCost,
        sellingPrice,
      };

      onUpdateJob(updatedJob);
      clearForm();
      onCancelEdit();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    } else {
      // Create new job
      const job: PrintJob = {
        id: `job-${Date.now()}`,
        name: printName.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
        filaments,
        printTimeHours,
        printerInstanceId: selectedInstanceId,
        modelCost,
        modelCostPerUnit,
        authorMinPrice: authorMinPrice || undefined,
        modelUrl: modelUrl.trim() || undefined,
        prepTimeMinutes,
        postProcessingMinutes,
        materialsUsed,
        failureRate,
        costPerUnit: trueCost,
        sellingPrice,
        copiesSold: 0,
      };

      onSaveJob(job, printTimeHours);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    }
  };

  // Update interlinked pricing fields based on true cost (including shipping)
  useEffect(() => {
    if (trueCost <= 0) return;

    if (lastEdited === 'margin') {
      // Guard: clamp margin below 100% to prevent division by zero
      const clampedMargin = Math.min(profitMarginPercent, 99.9);
      const newPrice = trueCost / (1 - clampedMargin / 100);
      const newProfit = newPrice - trueCost;
      setSellingPrice(parseFloat(newPrice.toFixed(2)));
      setTargetProfit(parseFloat(newProfit.toFixed(2)));
    } else if (lastEdited === 'profit') {
      const newPrice = trueCost + targetProfit;
      const newMargin = ((newPrice - trueCost) / newPrice) * 100;
      setSellingPrice(parseFloat(newPrice.toFixed(2)));
      setProfitMarginPercent(parseFloat(newMargin.toFixed(1)));
    } else if (lastEdited === 'price') {
      const newProfit = sellingPrice - trueCost;
      const newMargin = sellingPrice > 0 ? ((sellingPrice - trueCost) / sellingPrice) * 100 : 0;
      setTargetProfit(parseFloat(newProfit.toFixed(2)));
      setProfitMarginPercent(parseFloat(newMargin.toFixed(1)));
    }
  }, [trueCost, lastEdited, profitMarginPercent, targetProfit, sellingPrice]);

  // Add material to job
  const addMaterialUsage = () => {
    if (nonFilaments.length === 0) return;
    setMaterialsUsed([...materialsUsed, { materialId: nonFilaments[0].id, quantity: 1 }]);
  };

  const updateMaterialUsage = (index: number, field: keyof MaterialUsage, value: string | number) => {
    const updated = [...materialsUsed];
    updated[index] = { ...updated[index], [field]: value };
    setMaterialsUsed(updated);
  };

  const removeMaterialUsage = (index: number) => {
    setMaterialsUsed(materialsUsed.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Validation error toast */}
      {validationError && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-red-500/40 rounded-lg p-3 shadow-lg shadow-black/30 flex items-center justify-between max-w-sm animate-in">
          <div className="flex items-center gap-3 text-sm">
            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-red-300">{validationError}</span>
          </div>
          <Button
            variant="ghost"
            btnSize="sm"
            onClick={() => setValidationError(null)}
            className="ml-2 text-slate-500 hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      )}

      {/* Editing Banner */}
      {editingJob && (
        <div className="bg-blue-600/20 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-blue-300 font-medium">Editing: {editingJob.name}</div>
            <div className="text-slate-400 text-sm">
              {editingJob.copiesSold} copies sold | Created {new Date(editingJob.createdAt).toLocaleDateString()}
            </div>
          </div>
          <Button
            variant="ghost"
            btnSize="sm"
            onClick={() => {
              clearForm();
              onCancelEdit();
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Print Job Details */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Print Job Details</h2>

        {/* G-code Import */}
        <GcodeImport
          assets={materials}
          onImport={({ filaments, printTimeHours: time, printName: name }) => {
            if (time > 0) setPrintTimeHours(time);
            if (name && !printName) setPrintName(name);
            if (filaments.length > 0) {
              const newRows: FilamentRow[] = filaments.map(f => {
                const asset = f.filamentId ? materials.find(m => m.id === f.filamentId) : null;
                return {
                  filamentId: f.filamentId ?? '',
                  grams: f.grams,
                  editedPrice: asset?.costPerUnit ?? 0,
                  editedCurrency: asset?.currency ?? userCurrency,
                };
              });
              setFilamentRows(newRows.length > 0 ? newRows : [makeDefaultRow(userCurrency)]);
            }
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Print Name *</label>
            <Input
              type="text"
              value={printName}
              onChange={e => setPrintName(e.target.value)}
              placeholder="e.g., Dragon Figurine"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Printer</label>
            {printerInstances.length === 0 ? (
              <p className="text-yellow-400 text-sm">No printers set up. Go to Printer Settings to add one.</p>
            ) : (
              <Select
                value={selectedInstanceId}
                onChange={e => setSelectedInstanceId(e.target.value)}
              >
                {printerInstances.map(instance => {
                  const config = printers.find(p => p.id === instance.printerConfigId);
                  return (
                    <option key={instance.id} value={instance.id}>
                      {instance.nickname} ({config?.name || 'Unknown'}) - {instance.printHours.toFixed(1)}h
                    </option>
                  );
                })}
              </Select>
            )}
          </div>

          {/* Model URL — under Print Name / Printer, ahead of Filaments. Narrow input keeps the row visually light. */}
          <div className="lg:col-span-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <span>Model URL</span>
              <InfoTooltip text="Save the source link so you can find it again later (works for free models too)" />
              <NewBadge feature="model-url" />
            </label>
            <Input
              type="url"
              value={modelUrl}
              onChange={e => setModelUrl(e.target.value)}
              placeholder="https://makerworld.com/..."
              className="max-w-md"
            />
          </div>

          {/* Multi-Filament Rows */}
          <div className="lg:col-span-3 space-y-3">
            <label className="block text-xs text-slate-400">Filaments *</label>

            {filamentRows.map((row, index) => (
              <div key={index} className="flex items-start gap-2 bg-slate-700/30 p-3 rounded-lg">
                <div className="flex-1 min-w-0">
                  <FilamentSelector
                    materials={materials}
                    selectedFilamentId={row.filamentId}
                    onSelect={(filament) => updateFilamentRow(index, {
                      filamentId: filament.id,
                      editedPrice: filament.costPerUnit ?? 0,
                      editedCurrency: filament.currency || userCurrency,
                    })}
                    editedPrice={row.editedPrice}
                    editedCurrency={row.editedCurrency}
                    onPriceChange={(price) => updateFilamentRow(index, { editedPrice: price })}
                    onCurrencyChange={(currency) => updateFilamentRow(index, { editedCurrency: currency })}
                    userCurrency={userCurrency}
                  />
                </div>
                <div className="shrink-0 w-[196px]">
                  <label className="block text-xs text-slate-400 mb-1">Grams</label>
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      value={row.grams || ''}
                      onChange={e => updateFilamentRow(index, { grams: parseFloat(e.target.value) || 0 })}
                      placeholder="g"
                      className="w-24"
                    />
                    {index === filamentRows.length - 1 && filamentRows.length < 16 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={addFilamentRow}
                        className="w-[44px] h-[44px] !px-0 !py-0 shrink-0"
                        aria-label="Add filament row"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </Button>
                    )}
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => removeFilamentRow(index)}
                        className="w-[44px] h-[44px] !px-0 !py-0 shrink-0 text-red-400 hover:text-red-300"
                        aria-label="Remove filament row"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Print parameters — guaranteed 4-on-a-row at lg+; wraps on narrow screens. */}
          <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Print Time (hours)</label>
              <Input
                type="number"
                step="0.1"
                compact
                value={printTimeHours || ''}
                onChange={e => setPrintTimeHours(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Failure Rate (%)</label>
              <Input
                type="number"
                min="0"
                max="99"
                compact
                value={failureRate || ''}
                onChange={e => setFailureRate(Math.min(parseFloat(e.target.value) || 0, 99))}
                placeholder="5"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <span>Prep Time (min)</span>
                <InfoTooltip text="Slicing, bed prep, etc." />
              </label>
              <Input
                type="number"
                compact
                value={prepTimeMinutes || ''}
                onChange={e => setPrepTimeMinutes(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <span>Post-Processing (min)</span>
                <InfoTooltip text="Support removal, sanding, etc." />
              </label>
              <Input
                type="number"
                compact
                value={postProcessingMinutes || ''}
                onChange={e => setPostProcessingMinutes(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Model Cost + Author Min Price — always visible side-by-side; the per-unit checkbox
              only adds vertical space under Cost, never shifts the row. */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-x-4 gap-y-3 max-w-md">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Model Cost ({currencySymbol})</label>
              <Input
                type="number"
                step="0.01"
                compact
                value={modelCost || ''}
                onChange={e => setModelCost(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
              {modelCost > 0 && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  {/* allow-raw-html: checkbox uses accent-blue + custom border styling not covered by Input primitive */}
                  <input
                    type="checkbox"
                    checked={modelCostPerUnit}
                    onChange={e => setModelCostPerUnit(e.target.checked)}
                    className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                  />
                  <span className="text-xs text-slate-400">Per-unit license</span>
                  <NewBadge feature="per-unit-licensing" />
                </label>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <span>Author Min Price ({currencySymbol})</span>
                <InfoTooltip text="Warn if selling below this" />
                <NewBadge feature="author-min-price" />
              </label>
              <Input
                type="number"
                step="0.01"
                compact
                value={authorMinPrice || ''}
                onChange={e => setAuthorMinPrice(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Post-Processing Materials */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Post-Processing Materials</h2>
          <Button
            btnSize="sm"
            onClick={addMaterialUsage}
            disabled={nonFilaments.length === 0}
          >
            + Add Material
          </Button>
        </div>

        {materialsUsed.length === 0 ? (
          <p className="text-slate-500 text-sm">No post-processing materials added yet.</p>
        ) : (
          <div className="space-y-2">
            {materialsUsed.map((usage, index) => {
              const material = materials.find(m => m.id === usage.materialId);
              return (
                <div key={index} className="flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg">
                  <Select
                    value={usage.materialId}
                    onChange={e => updateMaterialUsage(index, 'materialId', e.target.value)}
                    className="flex-1"
                  >
                    {nonFilaments.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={usage.quantity}
                      onChange={e => updateMaterialUsage(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-20 text-right"
                    />
                    <span className="text-slate-400 text-sm w-12">{material?.unit || ''}</span>
                  </div>
                  <span className="text-slate-300 text-sm font-mono w-16 text-right">
                    {currencySymbol}{material ? (usage.quantity * (material.costPerUnit ?? 0)).toFixed(2) : '0.00'}
                  </span>
                  <Button
                    variant="danger"
                    btnSize="sm"
                    onClick={() => removeMaterialUsage(index)}
                  >
                    ✕
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shipping */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Shipping</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Shipping Method</label>
            <Select
              value={shippingMethod}
              onChange={e => {
                setShippingMethod(e.target.value as ShippingMethodType);
                setShippingOverrideCost(null); // Reset override when method changes
              }}
            >
              {availableShippingMethods.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </Select>
          </div>

          {shippingMethod === 'dropoff' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Distance ({distanceUnit})</label>
              <Input
                type="number"
                value={distanceUnit === 'mi' ? (shippingDistanceKm > 0 ? kmToMiles(shippingDistanceKm).toFixed(1) : '') : (shippingDistanceKm || '')}
                onChange={e => {
                  const inputVal = parseFloat(e.target.value) || 0;
                  // Convert miles to km for internal storage if using miles
                  setShippingDistanceKm(distanceUnit === 'mi' ? milesToKm(inputVal) : inputVal);
                }}
                max={distanceUnit === 'mi' ? kmToMiles(shippingConfig.maxDeliveryRadiusKm) : shippingConfig.maxDeliveryRadiusKm}
                placeholder={`Max ${distanceUnit === 'mi' ? kmToMiles(shippingConfig.maxDeliveryRadiusKm).toFixed(0) : shippingConfig.maxDeliveryRadiusKm}${distanceUnit}`}
              />
              {shippingDistanceKm > shippingConfig.maxDeliveryRadiusKm && (
                <p className="text-xs text-red-400 mt-1">Exceeds max delivery radius!</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Carrier Cost ({currencySymbol})</label>
            <Input
              type="number"
              step="0.01"
              value={shippingOverrideCost !== null ? shippingOverrideCost : shippingCost}
              onChange={e => setShippingOverrideCost(parseFloat(e.target.value) || 0)}
              placeholder={shippingCost.toFixed(2)}
            />
            {shippingOverrideCost !== null && (
              <Button
                variant="ghost"
                btnSize="sm"
                onClick={() => setShippingOverrideCost(null)}
                className="mt-1 text-blue-400 hover:text-blue-300 text-xs"
              >
                Reset to default
              </Button>
            )}
          </div>
        </div>

        {/* Packaging Materials */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-medium text-white">
                <span>Packaging Materials</span>
                <NewBadge feature="packaging-materials" />
              </h3>
              <p className="text-xs text-slate-500">Boxes, bubble wrap, tape, etc.</p>
            </div>
            <Button
              btnSize="sm"
              onClick={() => {
                if (consumables.length > 0) {
                  setPackagingMaterials([...packagingMaterials, { materialId: consumables[0].id, quantity: 1 }]);
                }
              }}
              disabled={consumables.length === 0}
              className="text-xs"
            >
              + Add Packaging
            </Button>
          </div>

          {packagingMaterials.length === 0 ? (
            <p className="text-slate-500 text-xs">No packaging materials added.</p>
          ) : (
            <div className="space-y-2">
              {packagingMaterials.map((usage, index) => {
                const material = materials.find(m => m.id === usage.materialId);
                return (
                  <div key={index} className="flex items-center gap-3 bg-slate-700/50 p-2 rounded-lg">
                    <Select
                      value={usage.materialId}
                      onChange={e => {
                        const updated = [...packagingMaterials];
                        updated[index] = { ...updated[index], materialId: e.target.value };
                        setPackagingMaterials(updated);
                      }}
                      className="flex-1"
                    >
                      {consumables.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={usage.quantity}
                        onChange={e => {
                          const updated = [...packagingMaterials];
                          updated[index] = { ...updated[index], quantity: parseFloat(e.target.value) || 0 };
                          setPackagingMaterials(updated);
                        }}
                        inputSize="sm"
                        className="w-16 text-right"
                      />
                      <span className="text-slate-400 text-xs w-8">{material?.unit || ''}</span>
                    </div>
                    <span className="text-slate-300 text-sm font-mono w-14 text-right">
                      {currencySymbol}{material ? (usage.quantity * (material.costPerUnit ?? 0)).toFixed(2) : '0.00'}
                    </span>
                    <Button
                      variant="danger"
                      btnSize="sm"
                      onClick={() => setPackagingMaterials(packagingMaterials.filter((_, i) => i !== index))}
                    >
                      ✕
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total Shipping Summary */}
          {(shippingCost > 0 || packagingCost > 0) && (
            <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Carrier/Delivery:</span>
                <span>{currencySymbol}{shippingCost.toFixed(2)}</span>
              </div>
              {packagingCost > 0 && (
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Packaging:</span>
                  <span>{currencySymbol}{packagingCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium text-white mt-1 pt-1 border-t border-slate-600">
                <span>Total Shipping:</span>
                <span>{currencySymbol}{totalShippingCost.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Marketplace Selection */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="mb-3">
            <h3 className="text-sm font-medium text-white">Marketplace</h3>
            <p className="text-xs text-slate-500">Platform fees deducted from your revenue</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Selling Platform</label>
              <Select
                value={marketplace}
                onChange={e => setMarketplace(e.target.value as MarketplaceType)}
              >
                {availableMarketplaces.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {availableMarketplaces.find(m => m.value === marketplace)?.description}
              </p>
            </div>

            {marketplaceFee > 0 && (
              <div className="flex items-center">
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg w-full">
                  <div className="text-xs text-orange-400">Marketplace Fee</div>
                  <div className="text-lg font-semibold text-orange-400">{currencySymbol}{marketplaceFee.toFixed(2)}</div>
                  <div className="text-xs text-slate-500">Deducted from {currencySymbol}{sellingPrice.toFixed(2)} sale</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing - Moved above Cost Breakdown */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Set Financial Targets</h2>
        <p className="text-slate-400 text-sm mb-4">Set targets and keep track of profitability throughout your project</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Profit Margin</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">%</span>
              <Input
                type="number"
                value={profitMarginPercent || ''}
                onChange={e => {
                  setProfitMarginPercent(parseFloat(e.target.value) || 0);
                  setLastEdited('margin');
                }}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Target Profit</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">{currencySymbol}</span>
              <Input
                type="number"
                step="0.01"
                value={targetProfit || ''}
                onChange={e => {
                  setTargetProfit(parseFloat(e.target.value) || 0);
                  setLastEdited('profit');
                }}
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Selling Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">{currencySymbol}</span>
              <Input
                type="number"
                step="0.01"
                value={sellingPrice || ''}
                onChange={e => {
                  setSellingPrice(parseFloat(e.target.value) || 0);
                  setLastEdited('price');
                }}
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {trueCost > 0 && sellingPrice > 0 && (
          <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{currencySymbol}{trueCost.toFixed(2)}</div>
                <div className="text-xs text-slate-400">True Cost</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">{currencySymbol}{sellingPrice.toFixed(2)}</div>
                <div className="text-xs text-slate-400">Sell Price</div>
              </div>
              {marketplaceFee > 0 && (
                <div>
                  <div className="text-2xl font-bold text-orange-400">-{currencySymbol}{marketplaceFee.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">Platform Fee</div>
                </div>
              )}
              <div>
                <div className={`text-2xl font-bold ${(targetProfit - marketplaceFee) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {currencySymbol}{(targetProfit - marketplaceFee).toFixed(2)}
                </div>
                <div className="text-xs text-slate-400">Net Profit</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {sellingPrice > 0 ? (((sellingPrice - trueCost - marketplaceFee) / sellingPrice) * 100).toFixed(1) : '0'}%
                </div>
                <div className="text-xs text-slate-400">Net Margin</div>
              </div>
            </div>
            {marketplaceFee > 0 && (targetProfit - marketplaceFee) < targetProfit && (
              <p className="text-xs text-orange-400 text-center mt-3">
                Marketplace fees reduce your profit by {currencySymbol}{marketplaceFee.toFixed(2)} ({((marketplaceFee / sellingPrice) * 100).toFixed(1)}% of sale)
              </p>
            )}
            {authorMinPrice > 0 && sellingPrice < authorMinPrice && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-400 text-center font-medium">
                  Warning: Your selling price ({currencySymbol}{sellingPrice.toFixed(2)}) is below the author's minimum price ({currencySymbol}{authorMinPrice.toFixed(2)})
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Cost Breakdown</h2>

        <div className="space-y-2 text-sm">
          {/* Per-Unit Costs (Consumables) */}
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Per-Unit Costs (Consumables)</div>
          <div className="flex justify-between text-slate-300">
            <span>Filament</span>
            <span className="font-mono">{currencySymbol}{costs.filament.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Electricity</span>
            <span className="font-mono">{currencySymbol}{costs.electricity.toFixed(2)}</span>
          </div>
          {costs.materials > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Post-Processing Materials</span>
              <span className="font-mono">{currencySymbol}{costs.materials.toFixed(2)}</span>
            </div>
          )}
          {costs.labor > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Labor ({prepTimeMinutes + postProcessingMinutes} min @ {currencySymbol}{laborHourlyRate}/hr)</span>
              <span className="font-mono">{currencySymbol}{costs.labor.toFixed(2)}</span>
            </div>
          )}
          {shippingCost > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Shipping ({shippingMethod.replace('_', ' ')})</span>
              <span className="font-mono">{currencySymbol}{shippingCost.toFixed(2)}</span>
            </div>
          )}
          {packagingCost > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Packaging Materials</span>
              <span className="font-mono">{currencySymbol}{packagingCost.toFixed(2)}</span>
            </div>
          )}
          {modelCostPerUnit && modelCost > 0 && (
            <div className="flex justify-between text-purple-400">
              <span>Model License (per unit)</span>
              <span className="font-mono">{currencySymbol}{modelCost.toFixed(2)}</span>
            </div>
          )}

          <div className="border-t border-slate-700 pt-2 mt-2">
            <div className="flex justify-between text-slate-300">
              <span>Subtotal</span>
              <span className="font-mono">{currencySymbol}{(costs.subtotal + totalShippingCost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-yellow-400">
              <span>+ Failure Adjustment ({failureRate}%)</span>
              <span className="font-mono">+{currencySymbol}{(costs.failureAdjusted - costs.subtotal).toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-slate-600 pt-3 mt-3">
            <div className="flex justify-between text-white text-lg font-semibold">
              <span>Cost Per Unit</span>
              <span className="font-mono">{currencySymbol}{trueCost.toFixed(2)}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              This is what you spend each time you print this item
            </div>
          </div>

          {/* Marketplace Fee Note */}
          {marketplaceFee > 0 && sellingPrice > 0 && (
            <div className="mt-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-orange-400">Marketplace Fee ({marketplace.replace('_', ' ')})</div>
                  <div className="text-xs text-slate-500">Deducted from your sale revenue, not added to cost</div>
                </div>
                <div className="text-lg font-semibold text-orange-400">-{currencySymbol}{marketplaceFee.toFixed(2)}</div>
              </div>
              <div className="text-xs text-slate-400 mt-2">
                You receive: {currencySymbol}{(sellingPrice - marketplaceFee).toFixed(2)} | Net profit: {currencySymbol}{(sellingPrice - marketplaceFee - trueCost).toFixed(2)}
              </div>
            </div>
          )}

          {/* Fixed Costs Section */}
          {fixedCosts.total > 0 && (
            <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">Fixed Costs (Recovered Through Sales)</div>

              {fixedCosts.depreciation > 0 && (
                <div className="flex justify-between text-slate-300 mb-2">
                  <span>Printer Depreciation ({printTimeHours}h print)</span>
                  <span className="font-mono">{currencySymbol}{fixedCosts.depreciation.toFixed(2)}</span>
                </div>
              )}
              {fixedCosts.nozzleWear > 0 && (
                <div className="flex justify-between text-slate-300 mb-2">
                  <span>Nozzle Wear</span>
                  <span className="font-mono">{currencySymbol}{fixedCosts.nozzleWear.toFixed(2)}</span>
                </div>
              )}
              {modelCost > 0 && !modelCostPerUnit && (
                <div className="flex justify-between text-slate-300 mb-2">
                  <span>Model/STL Cost (one-time)</span>
                  <span className="font-mono">{currencySymbol}{modelCost.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-white font-semibold pt-2 border-t border-slate-600">
                <span>Total Fixed Costs</span>
                <span className="font-mono">{currencySymbol}{fixedCosts.total.toFixed(2)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                These costs are spread across all units sold. The more you sell, the less each unit carries.
              </div>
            </div>
          )}

          {/* Break-even Banner */}
          {trueCost > 0 && sellingPrice > 0 && fixedCosts.total > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg border border-blue-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-300 font-medium">Break-even Units</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Sell this many to recover {currencySymbol}{fixedCosts.total.toFixed(2)} in fixed costs
                  </div>
                </div>
                <div className="text-4xl font-bold text-blue-400">
                  {breakEvenInfo.breakEvenCopies === Infinity ? '∞' : breakEvenInfo.breakEvenCopies}
                </div>
              </div>
              {breakEvenInfo.profitPerUnit > 0 && (
                <div className="text-xs text-slate-400 mt-2">
                  {currencySymbol}{breakEvenInfo.profitPerUnit.toFixed(2)} profit per unit at {currencySymbol}{sellingPrice.toFixed(2)} selling price
                </div>
              )}
              {breakEvenInfo.profitPerUnit <= 0 && (
                <div className="text-xs text-red-400 mt-2">
                  Warning: Selling price is below cost. You lose {currencySymbol}{Math.abs(breakEvenInfo.profitPerUnit).toFixed(2)} per unit.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Job Button */}
      <div className="flex flex-col md:flex-row md:justify-end gap-4">
        {justSaved && (
          <span className="text-green-400 text-sm self-center">
            {editingJob ? 'Job updated!' : 'Job saved! View it in "My Jobs" tab.'}
          </span>
        )}
        {editingJob && (
          <Button
            variant="secondary"
            btnSize="lg"
            onClick={() => {
              clearForm();
              onCancelEdit();
            }}
            className="w-full md:w-auto"
          >
            Cancel Edit
          </Button>
        )}
        <Button
          variant={editingJob ? 'primary' : 'success'}
          btnSize="lg"
          onClick={handleSaveJob}
          disabled={!printName.trim() || filamentRows.every(r => !r.filamentId) || trueCost <= 0}
          className="w-full md:w-auto"
        >
          {editingJob ? 'Update Job' : 'Save Job for Tracking'}
        </Button>
      </div>
    </div>
  );
}
