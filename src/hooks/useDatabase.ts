import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getPrinter, setPrinter, getElectricity, setElectricity, getLabor, setLabor, getUserProfile, setUserProfile, getShippingConfig, setShippingConfig, getMarketplaceFees, setMarketplaceFees } from '../db/database';
import type { Asset, PrinterConfig, PrinterInstance, ElectricityConfig, LaborConfig, PrintJob, Sale, UserProfile, ShippingConfig, MarketplaceFees } from '../types';
import { defaultMaterials, defaultPrinter, defaultPrinterAssets, assetToPrinterConfig } from '../data/defaultMaterials';

// Hook for all assets (materials + printers) with CRUD operations
export function useAssets() {
  const assets = useLiveQuery(() => db.materials.toArray(), []);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize with defaults if empty (includes both materials and printers)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const count = await db.materials.count();
        if (cancelled) return;

        if (count === 0) {
          // Add both default materials and printer assets
          const allDefaults: Asset[] = [...defaultMaterials, ...defaultPrinterAssets];
          await db.materials.bulkPut(allDefaults); // Use bulkPut instead of bulkAdd to handle duplicates
        } else {
          // Check if we need to add printer assets (migration for existing users)
          const printerCount = await db.materials.where('category').equals('printer').count();
          if (cancelled) return;

          if (printerCount === 0) {
            await db.materials.bulkPut(defaultPrinterAssets); // Use bulkPut to handle duplicates
          }

          // Check if we need to add packaging assets (migration for existing users)
          const packagingCount = await db.materials.where('category').equals('packaging').count();
          if (cancelled) return;

          if (packagingCount === 0) {
            const packagingDefaults = defaultMaterials.filter(m => m.category === 'packaging');
            await db.materials.bulkPut(packagingDefaults); // Use bulkPut to handle duplicates
          }
        }
      } catch (error) {
        console.error('Error initializing assets:', error);
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    }
    init();

    return () => { cancelled = true; };
  }, []);

  const addAsset = useCallback(async (asset: Asset) => {
    await db.materials.add(asset);
  }, []);

  const updateAsset = useCallback(async (asset: Asset) => {
    await db.materials.put(asset);
  }, []);

  const deleteAsset = useCallback(async (id: string) => {
    await db.materials.delete(id);
  }, []);

  const resetToDefaults = useCallback(async () => {
    await db.materials.clear();
    const allDefaults: Asset[] = [...defaultMaterials, ...defaultPrinterAssets];
    await db.materials.bulkAdd(allDefaults);
  }, []);

  const resetMaterialsOnly = useCallback(async () => {
    // Only reset non-printer assets
    const printerAssets = await db.materials.where('category').equals('printer').toArray();
    await db.materials.clear();
    await db.materials.bulkAdd([...defaultMaterials, ...printerAssets]);
  }, []);

  const resetPrintersOnly = useCallback(async () => {
    // Only reset printer assets
    await db.materials.where('category').equals('printer').delete();
    await db.materials.bulkAdd(defaultPrinterAssets);
  }, []);

  return {
    assets: assets ?? [],
    isLoading,
    addAsset,
    updateAsset,
    deleteAsset,
    resetToDefaults,
    resetMaterialsOnly,
    resetPrintersOnly,
  };
}

// Hook for materials only (non-printer assets) - backwards compatible
export function useMaterials() {
  const { assets, isLoading, addAsset, updateAsset, deleteAsset, resetMaterialsOnly } = useAssets();

  // Filter to only non-printer assets
  const materials = useMemo(() =>
    assets.filter(a => a.category !== 'printer'),
    [assets]
  );

  return {
    materials,
    isLoading,
    addMaterial: addAsset,
    updateMaterial: updateAsset,
    deleteMaterial: deleteAsset,
    resetToDefaults: resetMaterialsOnly,
  };
}

// Hook for available printers (from asset library)
export function usePrinters() {
  const { assets, isLoading, addAsset, updateAsset, deleteAsset, resetPrintersOnly } = useAssets();

  // Filter to only printer assets and convert to PrinterConfig
  const printers = useMemo(() => {
    return assets
      .filter(a => a.category === 'printer')
      .map(a => assetToPrinterConfig(a))
      .filter((p): p is PrinterConfig => p !== null);
  }, [assets]);

  // Wrapper to add printer as asset
  const addPrinter = useCallback(async (printer: PrinterConfig) => {
    const asset: Asset = {
      id: printer.id,
      name: printer.name,
      category: 'printer',
      purchasePrice: printer.purchasePrice,
      expectedLifespanHours: printer.expectedLifespanHours,
      wattage: printer.wattage,
      nozzleCost: printer.nozzleCost,
      nozzleLifespanCm3: printer.nozzleLifespanCm3,
    };
    await addAsset(asset);
  }, [addAsset]);

  // Wrapper to update printer as asset
  const updatePrinterInDb = useCallback(async (printer: PrinterConfig) => {
    const asset: Asset = {
      id: printer.id,
      name: printer.name,
      category: 'printer',
      purchasePrice: printer.purchasePrice,
      expectedLifespanHours: printer.expectedLifespanHours,
      wattage: printer.wattage,
      nozzleCost: printer.nozzleCost,
      nozzleLifespanCm3: printer.nozzleLifespanCm3,
    };
    await updateAsset(asset);
  }, [updateAsset]);

  return {
    printers,
    isLoading,
    addPrinter,
    updatePrinter: updatePrinterInDb,
    deletePrinter: deleteAsset,
    resetToDefaults: resetPrintersOnly,
  };
}

// Hook for printer instances (user's specific machines)
export function usePrinterInstances() {
  const instances = useLiveQuery(() => db.printerInstances.toArray(), []);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    db.printerInstances.count().then(() => setIsLoading(false));
  }, []);

  const addInstance = useCallback(async (instance: PrinterInstance) => {
    await db.printerInstances.add(instance);
  }, []);

  const updateInstance = useCallback(async (instance: PrinterInstance) => {
    await db.printerInstances.put(instance);
  }, []);

  const deleteInstance = useCallback(async (id: string) => {
    await db.printerInstances.delete(id);
  }, []);

  // Add print hours to an instance (called when a job is completed)
  const addPrintHours = useCallback(async (instanceId: string, hours: number) => {
    const instance = await db.printerInstances.get(instanceId);
    if (instance) {
      await db.printerInstances.put({
        ...instance,
        printHours: instance.printHours + hours,
      });
    }
  }, []);

  return {
    instances: instances ?? [],
    isLoading,
    addInstance,
    updateInstance,
    deleteInstance,
    addPrintHours,
  };
}

// Hook for current printer settings (selected printer)
export function usePrinterSettings() {
  const [printer, setPrinterState] = useState<PrinterConfig>(defaultPrinter);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPrinter(defaultPrinter).then(value => {
      setPrinterState(value);
      setIsLoading(false);
    });
  }, []);

  const updatePrinter = useCallback(async (value: PrinterConfig) => {
    setPrinterState(value);
    await setPrinter(value);
  }, []);

  return { printer, updatePrinter, isLoading };
}

// Hook for electricity settings
export function useElectricitySettings() {
  const defaultElectricity: ElectricityConfig = { costPerKwh: 0.12 };
  const [electricity, setElectricityState] = useState<ElectricityConfig>(defaultElectricity);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getElectricity(defaultElectricity).then(value => {
      setElectricityState(value);
      setIsLoading(false);
    });
  }, []);

  const updateElectricity = useCallback(async (value: ElectricityConfig) => {
    setElectricityState(value);
    await setElectricity(value);
  }, []);

  return { electricity, updateElectricity, isLoading };
}

// Hook for labor settings
export function useLaborSettings() {
  const defaultLabor: LaborConfig = { hourlyRate: 15 };
  const [labor, setLaborState] = useState<LaborConfig>(defaultLabor);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getLabor(defaultLabor).then(value => {
      setLaborState(value);
      setIsLoading(false);
    });
  }, []);

  const updateLabor = useCallback(async (value: LaborConfig) => {
    setLaborState(value);
    await setLabor(value);
  }, []);

  return { labor, updateLabor, isLoading };
}

// Hook for user profile (currency preference and labor rate)
export function useUserProfile() {
  const defaultProfile: UserProfile = {
    currency: 'CAD',
    laborHourlyRate: 15,
    address: {
      country: 'CA',
    },
  };
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getUserProfile(defaultProfile).then(value => {
      setProfileState(value);
      setIsLoading(false);
    });
  }, []);

  const updateProfile = useCallback(async (value: UserProfile) => {
    setProfileState(value);
    await setUserProfile(value);
  }, []);

  return { profile, updateProfile, isLoading };
}

// Hook for shipping configuration
export function useShippingConfig() {
  const defaultShipping: ShippingConfig = {
    maxDeliveryRadiusKm: 25,
    gasPricePerLiter: 1.50,
    vehicleFuelEfficiency: 10, // L/100km (typical car)
    upsBaseCost: 15,
    fedexBaseCost: 15,
    purolatorBaseCost: 12,
    uspsBaseCost: 10,
    dhlBaseCost: 20,
    royalMailBaseCost: 8,
    australiaPostBaseCost: 12,
    canadaPostBaseCost: 15,
    customCarriers: [],
  };
  const [shipping, setShippingState] = useState<ShippingConfig>(defaultShipping);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getShippingConfig(defaultShipping).then(value => {
      setShippingState(value);
      setIsLoading(false);
    });
  }, []);

  const updateShipping = useCallback(async (value: ShippingConfig) => {
    setShippingState(value);
    await setShippingConfig(value);
  }, []);

  return { shipping, updateShipping, isLoading };
}

// Default marketplace fees based on current platform rates (as of 2024)
// Users can adjust these in Settings if platforms change their fees
export const defaultMarketplaceFees: MarketplaceFees = {
  // Facebook Marketplace
  facebookShippedPercent: 10,          // 10% selling fee
  facebookMinFee: 0.80,                // Minimum $0.80 fee
  facebookProcessingPercent: 2.9,      // 2.9% payment processing

  // Etsy
  etsyTransactionPercent: 6.5,         // 6.5% transaction fee
  etsyPaymentPercent: 3,               // 3% payment processing
  etsyPaymentFixed: 0.25,              // $0.25 per transaction
  etsyListingFee: 0.20,                // $0.20 listing fee
  etsyOffsiteAdPercent: 15,            // 15% offsite ad fee (when applicable)

  // Kijiji
  kijijiFeaturedFee: 0,                // Free for basic listings

  // eBay
  ebayFinalValuePercent: 12.9,         // 12.9% final value fee
  ebayFixedFee: 0.30,                  // $0.30 per order

  // Amazon Handmade
  amazonHandmadePercent: 15,           // 15% referral fee

  // Custom marketplaces (user-defined)
  customMarketplaces: [],
};

// Hook for marketplace fees configuration
export function useMarketplaceFees() {
  const [fees, setFeesState] = useState<MarketplaceFees>(defaultMarketplaceFees);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMarketplaceFees(defaultMarketplaceFees).then(value => {
      setFeesState(value);
      setIsLoading(false);
    });
  }, []);

  const updateFees = useCallback(async (value: MarketplaceFees) => {
    setFeesState(value);
    await setMarketplaceFees(value);
  }, []);

  const resetToDefaults = useCallback(async () => {
    setFeesState(defaultMarketplaceFees);
    await setMarketplaceFees(defaultMarketplaceFees);
  }, []);

  return { fees, updateFees, resetToDefaults, isLoading };
}

// Combined hook for all settings
export function useAllSettings() {
  const { printer, updatePrinter, isLoading: printerLoading } = usePrinterSettings();
  const { electricity, updateElectricity, isLoading: electricityLoading } = useElectricitySettings();

  return {
    printer,
    electricity,
    updatePrinter,
    updateElectricity,
    isLoading: printerLoading || electricityLoading,
  };
}

// Hook for print jobs with CRUD operations and break-even tracking
export function useJobs() {
  const jobs = useLiveQuery(() => db.jobs.orderBy('createdAt').reverse().toArray(), []);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    db.jobs.count().then(() => setIsLoading(false));
  }, []);

  const addJob = useCallback(async (job: PrintJob) => {
    await db.jobs.add(job);
  }, []);

  const updateJob = useCallback(async (job: PrintJob) => {
    await db.jobs.put({ ...job, updatedAt: new Date() });
  }, []);

  const deleteJob = useCallback(async (id: string) => {
    // Also delete associated sales
    await db.sales.where('jobId').equals(id).delete();
    await db.jobs.delete(id);
  }, []);

  const getJob = useCallback(async (id: string) => {
    return db.jobs.get(id);
  }, []);

  return {
    jobs: jobs ?? [],
    isLoading,
    addJob,
    updateJob,
    deleteJob,
    getJob,
  };
}

// Hook for sales tracking
export function useSales(jobId?: string) {
  const sales = useLiveQuery(
    () => jobId
      ? db.sales.where('jobId').equals(jobId).toArray()
      : db.sales.orderBy('soldAt').reverse().toArray(),
    [jobId]
  );

  const addSale = useCallback(async (sale: Sale) => {
    await db.sales.add(sale);
    // Update job's copiesSold count
    const job = await db.jobs.get(sale.jobId);
    if (job) {
      await db.jobs.put({
        ...job,
        copiesSold: job.copiesSold + sale.quantity,
        updatedAt: new Date(),
      });
    }
  }, []);

  const deleteSale = useCallback(async (sale: Sale) => {
    await db.sales.delete(sale.id);
    // Update job's copiesSold count
    const job = await db.jobs.get(sale.jobId);
    if (job) {
      await db.jobs.put({
        ...job,
        copiesSold: Math.max(0, job.copiesSold - sale.quantity),
        updatedAt: new Date(),
      });
    }
  }, []);

  // Calculate totals for a job
  const getTotals = useCallback((jobSales: Sale[]) => {
    return jobSales.reduce(
      (acc, sale) => ({
        totalQuantity: acc.totalQuantity + sale.quantity,
        totalRevenue: acc.totalRevenue + sale.totalRevenue,
      }),
      { totalQuantity: 0, totalRevenue: 0 }
    );
  }, []);

  return {
    sales: sales ?? [],
    addSale,
    deleteSale,
    getTotals,
  };
}
