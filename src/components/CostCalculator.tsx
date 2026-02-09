import { useState, useEffect, useMemo } from 'react';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, MaterialUsage, CostBreakdown, PrintJob, Currency, ShippingConfig, ShippingMethodType, MarketplaceType } from '../types';
import { FilamentSelector } from './FilamentSelector';
import { NewBadge } from './NewBadge';
import { getCurrencySymbol, getDistanceUnit, kmToMiles, milesToKm } from '../utils/currency';

// Default marketplace fees based on research (to be implemented)
// Facebook Marketplace: 10% + $0.80 min + 2.9% processing for shipped items
// Etsy: 6.5% transaction + 3% + $0.25 payment + $0.20 listing + 15% offsite ads

interface CostCalculatorProps {
  materials: Material[];
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  electricity: ElectricityConfig;
  laborHourlyRate: number;
  userCurrency: Currency;
  shippingConfig: ShippingConfig;
  onSaveJob: (job: PrintJob, printHours: number) => void;
  onUpdateJob: (job: PrintJob) => void;
  editingJob: PrintJob | null;
  onCancelEdit: () => void;
}

// PLA density: ~1.24 g/cm³
const FILAMENT_DENSITY = 1.24;

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

export function CostCalculator({ materials, printers, printerInstances, electricity, laborHourlyRate, userCurrency, shippingConfig, onSaveJob, onUpdateJob, editingJob, onCancelEdit }: CostCalculatorProps) {
  // Get currency symbol for display - changes based on user's selected currency
  const currencySymbol = getCurrencySymbol(userCurrency);
  // Get distance unit based on region (mi for US, km for most others)
  const distanceUnit = getDistanceUnit(userCurrency);

  // Print job inputs - restore from sessionStorage if available
  const [printName, setPrintName] = useState(() => getStoredValue('printName', ''));
  const [filamentGrams, setFilamentGrams] = useState(() => getStoredValue('filamentGrams', 0));
  const [filamentId, setFilamentId] = useState(() => getStoredValue('filamentId', ''));
  const [editedFilamentPrice, setEditedFilamentPrice] = useState(() => getStoredValue('editedFilamentPrice', 0));
  const [editedFilamentCurrency, setEditedFilamentCurrency] = useState<Currency>(() => getStoredValue('editedFilamentCurrency', 'USD'));
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
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(() => getStoredValue('prepTimeMinutes', 0));
  const [postProcessingMinutes, setPostProcessingMinutes] = useState(() => getStoredValue('postProcessingMinutes', 0));
  const [failureRate, setFailureRate] = useState(() => getStoredValue('failureRate', 5));
  const [materialsUsed, setMaterialsUsed] = useState<MaterialUsage[]>(() => getStoredValue('materialsUsed', []));

  // Pricing inputs (interlinked)
  const [profitMarginPercent, setProfitMarginPercent] = useState(() => getStoredValue('profitMarginPercent', 30));
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

  // Persist form state to sessionStorage whenever values change
  useEffect(() => {
    // Don't persist when editing an existing job
    if (editingJob) return;

    const formState = {
      printName,
      filamentGrams,
      filamentId,
      editedFilamentPrice,
      editedFilamentCurrency,
      selectedInstanceId,
      printTimeHours,
      modelCost,
      modelCostPerUnit,
      authorMinPrice,
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
    editingJob, printName, filamentGrams, filamentId, editedFilamentPrice, editedFilamentCurrency,
    selectedInstanceId, printTimeHours, modelCost, modelCostPerUnit, authorMinPrice, prepTimeMinutes, postProcessingMinutes,
    failureRate, materialsUsed, profitMarginPercent, targetProfit, sellingPrice, lastEdited,
    shippingMethod, shippingDistanceKm, shippingOverrideCost, packagingMaterials, marketplace
  ]);

  // Populate fields when editing an existing job
  useEffect(() => {
    if (editingJob) {
      setPrintName(editingJob.name);
      setFilamentGrams(editingJob.filamentGrams);
      setFilamentId(editingJob.filamentId);
      setSelectedInstanceId(editingJob.printerInstanceId);
      setPrintTimeHours(editingJob.printTimeHours);
      setModelCost(editingJob.modelCost);
      setModelCostPerUnit(editingJob.modelCostPerUnit ?? false);
      setAuthorMinPrice(editingJob.authorMinPrice ?? 0);
      setPrepTimeMinutes(editingJob.prepTimeMinutes);
      setPostProcessingMinutes(editingJob.postProcessingMinutes);
      setFailureRate(editingJob.failureRate);
      setMaterialsUsed(editingJob.materialsUsed);
      setSellingPrice(editingJob.sellingPrice);
      setLastEdited('price');

      // Set filament price from material if available
      const filament = materials.find(m => m.id === editingJob.filamentId);
      if (filament) {
        setEditedFilamentPrice(filament.costPerUnit ?? 0);
        setEditedFilamentCurrency(filament.currency || 'USD');
      }
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

  // Handle filament selection from the nested dropdown
  const handleFilamentSelect = (filament: Material) => {
    setFilamentId(filament.id);
    setEditedFilamentPrice(filament.costPerUnit ?? 0);
    setEditedFilamentCurrency(filament.currency || 'USD');
  };

  // Calculate costs - separating per-unit consumables from fixed costs
  const costs = useMemo((): CostBreakdown => {
    // Filament cost (uses edited price which may differ from database price)
    const filamentCost = filamentId && editedFilamentPrice > 0 ? filamentGrams * editedFilamentPrice : 0;

    // Electricity cost (needs printer to be selected)
    const electricityCost = selectedPrinter
      ? (selectedPrinter.wattage / 1000) * printTimeHours * electricity.costPerKwh
      : 0;

    // Printer depreciation - FIXED COST for this print job (not per-unit)
    // Formula: (Purchase Price / Recovery Months) / Monthly Hours = $/hour
    const purchasePrice = selectedInstance?.actualPurchasePrice ?? selectedPrinter?.purchasePrice ?? 0;
    const recoveryMonths = selectedInstance?.recoveryMonths ?? 12;
    const monthlyHours = selectedInstance?.estimatedMonthlyPrintHours ?? 40;
    const totalRecoveryHours = recoveryMonths * monthlyHours;
    const depreciationPerHour = totalRecoveryHours > 0 ? purchasePrice / totalRecoveryHours : 0;
    const depreciation = depreciationPerHour * printTimeHours;

    // Nozzle wear (based on volume) - FIXED COST for this print job
    const volumeCm3 = filamentGrams / FILAMENT_DENSITY;
    const nozzleWear = selectedPrinter
      ? (volumeCm3 / selectedPrinter.nozzleLifespanCm3) * selectedPrinter.nozzleCost
      : 0;

    // Model amortization - handled separately as fixed cost
    const modelAmortization = 0;

    // Materials cost (consumables - per unit)
    const materialsCost = materialsUsed.reduce((total, usage) => {
      const material = materials.find(m => m.id === usage.materialId);
      if (!material) return total;
      return total + usage.quantity * (material.costPerUnit ?? 0);
    }, 0);

    // Labor cost (per unit)
    const totalLaborMinutes = prepTimeMinutes + postProcessingMinutes;
    const laborCost = (totalLaborMinutes / 60) * laborHourlyRate;

    // Per-unit model license cost (if enabled)
    const perUnitModelCost = modelCostPerUnit ? modelCost : 0;

    // Per-unit subtotal (consumables only - NOT including depreciation/nozzle)
    // When modelCostPerUnit is true, model cost is included here instead of fixed costs
    const perUnitSubtotal = filamentCost + electricityCost + materialsCost + laborCost + perUnitModelCost;

    // Failure-adjusted per-unit cost
    const failureMultiplier = 1 / (1 - failureRate / 100);
    const failureAdjusted = perUnitSubtotal * failureMultiplier;

    return {
      filament: filamentCost,
      electricity: electricityCost,
      printerDepreciation: depreciation,  // Fixed cost - shown separately
      nozzleWear: nozzleWear,              // Fixed cost - shown separately
      modelAmortization: modelAmortization,
      materials: materialsCost,
      labor: laborCost,
      subtotal: perUnitSubtotal,           // Per-unit only (no depreciation/nozzle)
      failureAdjusted: failureAdjusted,    // Per-unit failure adjusted
      profitMargin: profitMarginPercent,
      targetProfit: targetProfit,
      sellingPrice: sellingPrice,
    };
  }, [
    materials, filamentId, editedFilamentPrice, filamentGrams, printTimeHours, selectedPrinter, electricity,
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
    setFilamentGrams(0);
    setFilamentId('');
    setEditedFilamentPrice(0);
    setSelectedInstanceId(printerInstances[0]?.id || '');
    setPrintTimeHours(0);
    setModelCost(0);
    setModelCostPerUnit(false);
    setAuthorMinPrice(0);
    setPrepTimeMinutes(0);
    setPostProcessingMinutes(0);
    setFailureRate(5);
    setMaterialsUsed([]);
    setSellingPrice(0);
    setTargetProfit(0);
    setProfitMarginPercent(30);
    setLastEdited('margin');
    setShippingMethod('local_pickup');
    setShippingDistanceKm(0);
    setShippingOverrideCost(null);
    setPackagingMaterials([]);
    setMarketplace('none');
    // Clear sessionStorage when form is cleared
    sessionStorage.removeItem(FORM_STORAGE_KEY);
  };

  // Save job handler (create new or update existing)
  const handleSaveJob = () => {
    if (!printName.trim()) {
      alert('Please enter a name for this print job');
      return;
    }
    if (!filamentId) {
      alert('Please select a filament');
      return;
    }
    if (!selectedInstanceId || !printerInstances.some(p => p.id === selectedInstanceId)) {
      alert('Please select a printer');
      return;
    }

    if (editingJob) {
      // Update existing job
      const updatedJob: PrintJob = {
        ...editingJob,
        name: printName.trim(),
        updatedAt: new Date(),
        filamentId,
        filamentGrams,
        printTimeHours,
        printerInstanceId: selectedInstanceId,
        modelCost,
        modelCostPerUnit,
        authorMinPrice: authorMinPrice || undefined,
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
        filamentId,
        filamentGrams,
        printTimeHours,
        printerInstanceId: selectedInstanceId,
        modelCost,
        modelCostPerUnit,
        authorMinPrice: authorMinPrice || undefined,
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
      const newPrice = trueCost / (1 - profitMarginPercent / 100);
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
      {/* Editing Banner */}
      {editingJob && (
        <div className="bg-blue-600/20 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-blue-300 font-medium">Editing: {editingJob.name}</div>
            <div className="text-slate-400 text-sm">
              {editingJob.copiesSold} copies sold | Created {new Date(editingJob.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => {
              clearForm();
              onCancelEdit();
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Print Job Details */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Print Job Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Print Name *</label>
            <input
              type="text"
              value={printName}
              onChange={e => setPrintName(e.target.value)}
              placeholder="e.g., Dragon Figurine"
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Printer</label>
            {printerInstances.length === 0 ? (
              <p className="text-yellow-400 text-sm">No printers set up. Go to Printer Settings to add one.</p>
            ) : (
              <select
                value={selectedInstanceId}
                onChange={e => setSelectedInstanceId(e.target.value)}
                className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                {printerInstances.map(instance => {
                  const config = printers.find(p => p.id === instance.printerConfigId);
                  return (
                    <option key={instance.id} value={instance.id}>
                      {instance.nickname} ({config?.name || 'Unknown'}) - {instance.printHours.toFixed(1)}h
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Filament Selector - Nested dropdown with editable price */}
          <div className="lg:col-span-2">
            <FilamentSelector
              materials={materials}
              selectedFilamentId={filamentId}
              onSelect={handleFilamentSelect}
              editedPrice={editedFilamentPrice}
              editedCurrency={editedFilamentCurrency}
              onPriceChange={setEditedFilamentPrice}
              onCurrencyChange={setEditedFilamentCurrency}
              userCurrency={userCurrency}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Filament Used (g)</label>
            <input
              type="number"
              value={filamentGrams || ''}
              onChange={e => setFilamentGrams(parseFloat(e.target.value) || 0)}
              placeholder="From slicer"
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Print Time (hours)</label>
            <input
              type="number"
              step="0.1"
              value={printTimeHours || ''}
              onChange={e => setPrintTimeHours(parseFloat(e.target.value) || 0)}
              placeholder="From slicer"
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Model/STL Cost ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              value={modelCost || ''}
              onChange={e => setModelCost(parseFloat(e.target.value) || 0)}
              placeholder="0 if free/own design"
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
            {modelCost > 0 && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modelCostPerUnit}
                  onChange={e => setModelCostPerUnit(e.target.checked)}
                  className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                />
                <span className="text-xs text-slate-400">Per-unit license (pay each print)</span>
                <NewBadge feature="per-unit-licensing" />
              </label>
            )}
          </div>

          {modelCost > 0 && (
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <span>Author Min Price ({currencySymbol})</span>
                <NewBadge feature="author-min-price" />
              </label>
              <input
                type="number"
                step="0.01"
                value={authorMinPrice || ''}
                onChange={e => setAuthorMinPrice(parseFloat(e.target.value) || 0)}
                placeholder="Optional"
                className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
              <p className="text-xs text-slate-500 mt-1">Warn if selling below this</p>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Failure Rate (%)</label>
            <input
              type="number"
              value={failureRate || ''}
              onChange={e => setFailureRate(parseFloat(e.target.value) || 0)}
              placeholder="5"
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Prep Time (min)</label>
            <input
              type="number"
              value={prepTimeMinutes || ''}
              onChange={e => setPrepTimeMinutes(parseInt(e.target.value) || 0)}
              placeholder="Slicing, bed prep, etc."
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Post-Processing (min)</label>
            <input
              type="number"
              value={postProcessingMinutes || ''}
              onChange={e => setPostProcessingMinutes(parseInt(e.target.value) || 0)}
              placeholder="Support removal, sanding, etc."
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Post-Processing Materials */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Post-Processing Materials</h2>
          <button
            onClick={addMaterialUsage}
            disabled={nonFilaments.length === 0}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            + Add Material
          </button>
        </div>

        {materialsUsed.length === 0 ? (
          <p className="text-slate-500 text-sm">No post-processing materials added yet.</p>
        ) : (
          <div className="space-y-2">
            {materialsUsed.map((usage, index) => {
              const material = materials.find(m => m.id === usage.materialId);
              return (
                <div key={index} className="flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg">
                  <select
                    value={usage.materialId}
                    onChange={e => updateMaterialUsage(index, 'materialId', e.target.value)}
                    className="flex-1 bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 min-h-[44px]"
                  >
                    {nonFilaments.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={usage.quantity}
                      onChange={e => updateMaterialUsage(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 text-right min-h-[44px]"
                    />
                    <span className="text-slate-400 text-sm w-12">{material?.unit || ''}</span>
                  </div>
                  <span className="text-slate-300 text-sm font-mono w-16 text-right">
                    {currencySymbol}{material ? (usage.quantity * (material.costPerUnit ?? 0)).toFixed(2) : '0.00'}
                  </span>
                  <button
                    onClick={() => removeMaterialUsage(index)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    ✕
                  </button>
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
            <select
              value={shippingMethod}
              onChange={e => {
                setShippingMethod(e.target.value as ShippingMethodType);
                setShippingOverrideCost(null); // Reset override when method changes
              }}
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              {availableShippingMethods.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </div>

          {shippingMethod === 'dropoff' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Distance ({distanceUnit})</label>
              <input
                type="number"
                value={distanceUnit === 'mi' ? (shippingDistanceKm > 0 ? kmToMiles(shippingDistanceKm).toFixed(1) : '') : (shippingDistanceKm || '')}
                onChange={e => {
                  const inputVal = parseFloat(e.target.value) || 0;
                  // Convert miles to km for internal storage if using miles
                  setShippingDistanceKm(distanceUnit === 'mi' ? milesToKm(inputVal) : inputVal);
                }}
                max={distanceUnit === 'mi' ? kmToMiles(shippingConfig.maxDeliveryRadiusKm) : shippingConfig.maxDeliveryRadiusKm}
                placeholder={`Max ${distanceUnit === 'mi' ? kmToMiles(shippingConfig.maxDeliveryRadiusKm).toFixed(0) : shippingConfig.maxDeliveryRadiusKm}${distanceUnit}`}
                className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
              {shippingDistanceKm > shippingConfig.maxDeliveryRadiusKm && (
                <p className="text-xs text-red-400 mt-1">Exceeds max delivery radius!</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Carrier Cost ({currencySymbol})</label>
            <input
              type="number"
              step="0.01"
              value={shippingOverrideCost !== null ? shippingOverrideCost : shippingCost}
              onChange={e => setShippingOverrideCost(parseFloat(e.target.value) || 0)}
              placeholder={shippingCost.toFixed(2)}
              className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
            {shippingOverrideCost !== null && (
              <button
                onClick={() => setShippingOverrideCost(null)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                Reset to default
              </button>
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
            <button
              onClick={() => {
                if (consumables.length > 0) {
                  setPackagingMaterials([...packagingMaterials, { materialId: consumables[0].id, quantity: 1 }]);
                }
              }}
              disabled={consumables.length === 0}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
            >
              + Add Packaging
            </button>
          </div>

          {packagingMaterials.length === 0 ? (
            <p className="text-slate-500 text-xs">No packaging materials added.</p>
          ) : (
            <div className="space-y-2">
              {packagingMaterials.map((usage, index) => {
                const material = materials.find(m => m.id === usage.materialId);
                return (
                  <div key={index} className="flex items-center gap-3 bg-slate-700/50 p-2 rounded-lg">
                    <select
                      value={usage.materialId}
                      onChange={e => {
                        const updated = [...packagingMaterials];
                        updated[index] = { ...updated[index], materialId: e.target.value };
                        setPackagingMaterials(updated);
                      }}
                      className="flex-1 bg-slate-700 text-white text-base md:text-sm px-3 py-1.5 rounded-lg border-0 min-h-[44px]"
                    >
                      {consumables.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={usage.quantity}
                        onChange={e => {
                          const updated = [...packagingMaterials];
                          updated[index] = { ...updated[index], quantity: parseFloat(e.target.value) || 0 };
                          setPackagingMaterials(updated);
                        }}
                        className="w-16 bg-slate-700 text-white text-base md:text-sm px-2 py-1.5 rounded-lg border-0 text-right min-h-[44px]"
                      />
                      <span className="text-slate-400 text-xs w-8">{material?.unit || ''}</span>
                    </div>
                    <span className="text-slate-300 text-sm font-mono w-14 text-right">
                      {currencySymbol}{material ? (usage.quantity * (material.costPerUnit ?? 0)).toFixed(2) : '0.00'}
                    </span>
                    <button
                      onClick={() => setPackagingMaterials(packagingMaterials.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      ✕
                    </button>
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
              <select
                value={marketplace}
                onChange={e => setMarketplace(e.target.value as MarketplaceType)}
                className="w-full bg-slate-700 text-white text-base md:text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                {availableMarketplaces.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
              <input
                type="number"
                value={profitMarginPercent || ''}
                onChange={e => {
                  setProfitMarginPercent(parseFloat(e.target.value) || 0);
                  setLastEdited('margin');
                }}
                className="w-full bg-slate-700 text-white text-base md:text-sm pl-8 pr-3 py-2.5 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Target Profit</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{currencySymbol}</span>
              <input
                type="number"
                step="0.01"
                value={targetProfit || ''}
                onChange={e => {
                  setTargetProfit(parseFloat(e.target.value) || 0);
                  setLastEdited('profit');
                }}
                className="w-full bg-slate-700 text-white text-base md:text-sm pl-8 pr-3 py-2.5 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Selling Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{currencySymbol}</span>
              <input
                type="number"
                step="0.01"
                value={sellingPrice || ''}
                onChange={e => {
                  setSellingPrice(parseFloat(e.target.value) || 0);
                  setLastEdited('price');
                }}
                className="w-full bg-slate-700 text-white text-base md:text-sm pl-8 pr-3 py-2.5 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
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
          <button
            onClick={() => {
              clearForm();
              onCancelEdit();
            }}
            className="w-full md:w-auto px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-medium rounded-lg transition-colors min-h-[44px]"
          >
            Cancel Edit
          </button>
        )}
        <button
          onClick={handleSaveJob}
          disabled={!printName.trim() || !filamentId || trueCost <= 0}
          className={`w-full md:w-auto px-6 py-3 ${editingJob ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors min-h-[44px]`}
        >
          {editingJob ? 'Update Job' : 'Save Job for Tracking'}
        </button>
      </div>
    </div>
  );
}
