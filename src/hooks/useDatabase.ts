import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getPrinter, setPrinter, getElectricity, setElectricity, getLabor, setLabor, getUserProfile, setUserProfile, getShippingConfig, setShippingConfig, getMarketplaceFees, setMarketplaceFees } from '../db/database';
import type { Asset, PrinterConfig, PrinterInstance, ElectricityConfig, LaborConfig, PrintJob, Sale, UserProfile, ShippingConfig, MarketplaceFees, Customer, Quote, JobCustomer, RuntimeQuoteStatus } from '../types';
import { defaultMaterials, defaultPrinter, defaultPrinterAssets, assetToPrinterConfig, bambuFilamentAssets } from '../data/defaultMaterials';
import { backfillCustomersFromSales, reconcileCopiesSoldFromSales, normalizeTagsOnJob } from '../db/backfill';

// Process-lifetime flag so the Sale→Customer backfill (D-32 / gap K) only
// runs ONCE per page load. The helper is idempotent so a second pass would
// be a harmless no-op, but skipping the Dexie reads is still a perf win for
// every subsequent useCustomers mount in the same session.
let saleCustomerBackfillRan = false;

// Process-lifetime flag for the copiesSold reconcile (post-Convert-to-Sale
// regression hotfix). Same one-per-page-load pattern as the customer backfill.
let copiesSoldReconcileRan = false;

// Phase 15 D-12 — process-lifetime flag for the tag-normalization reconcile (sibling to copiesSoldReconcileRan).
let tagsNormalizeRan = false;

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

          // Migration: Add Bambu filament catalog for existing users who don't have it yet
          // Check for a known Bambu catalog entry that wouldn't exist from old hand-maintained defaults
          const hasBambuCatalog = await db.materials.get('bambu-pla-sparkle');
          if (cancelled) return;

          if (!hasBambuCatalog) {
            // Add all Bambu catalog entries, using bulkPut to update any existing entries
            await db.materials.bulkPut(bambuFilamentAssets);
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

  const bulkImportAssets = useCallback(async (importAssets: Asset[]) => {
    await db.materials.bulkPut(importAssets); // upsert — handles both new + overwrite
  }, []);

  return {
    assets: assets ?? [],
    isLoading,
    addAsset,
    updateAsset,
    deleteAsset,
    bulkImportAssets,
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
    let cancelled = false;
    db.printerInstances.count().then(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
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
    defaultProfitMargin: 30,
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

  // Second extension hotfix: self-heal job.copiesSold against the actual
  // sum of Sale.quantity per job. Runs ONCE per page load. Reason: the
  // Convert-to-Sale transaction (originally landed in plan 16-12, fixed
  // forward-only in commit 80fdf7b) silently dropped the copiesSold bump
  // for an entire ship cycle — jobs that converted Quotes via that path
  // had stale counters, surfacing as "0 sold" with the Orders list visibly
  // showing sales. This reconcile makes the next page load self-heal those
  // historical mistakes AND guards against any future drift (manual DB
  // edits, race conditions, test data).
  //
  // Idempotent: helper returns empty when every job already matches its
  // sales sum, so subsequent loads pay zero write cost.
  useEffect(() => {
    if (copiesSoldReconcileRan) return;
    if (jobs === undefined) return;  // wait for the first liveQuery emission
    copiesSoldReconcileRan = true;
    let cancelled = false;
    (async () => {
      try {
        const allSales = await db.sales.toArray();
        if (cancelled) return;
        const patches = reconcileCopiesSoldFromSales(jobs, allSales);
        if (patches.length > 0) {
          // bulkPut needs the full row; fetch current then merge copiesSold.
          await db.transaction('rw', db.jobs, async () => {
            for (const patch of patches) {
              const current = await db.jobs.get(patch.id);
              if (current) {
                await db.jobs.put({ ...current, copiesSold: patch.copiesSold, updatedAt: new Date() });
              }
            }
          });
        }
      } catch (err) {
        // Reconcile failures must NOT break the app — the UI still works
        // against stale counters; users can manually edit a Sale to retrigger.
        console.error('copiesSold reconcile failed:', err);
        copiesSoldReconcileRan = false;  // allow retry on next mount
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs === undefined]);

  // Phase 15 D-12: silently normalize legacy tag rows on the first liveQuery
  // emission. Phase 12's backfillTagsOnJob set tags=[] but did NOT enforce
  // D-02 normalization (lowercase + trim + dedupe + cap-at-10 + whitelist
  // /[^a-z0-9\s\-_]/g) because those rules didn't exist yet. Any pre-Phase-15
  // record with hand-edited tags via DevTools could carry uppercase / untrimmed
  // / punctuation-laced values that the chip filter would treat as distinct
  // from their normalized equivalents.
  //
  // Runs ONCE per page load. Idempotent — `normalizeTagsOnJob` returns false
  // for already-canonical tags, so subsequent loads pay zero write cost. The
  // shallow-copy step (`const copy = { ...job, tags: [...job.tags] }`) is
  // critical: we MUST NOT mutate the dexie-react-hooks liveQuery cache, only
  // the copy we will write back via bulkPut.
  useEffect(() => {
    if (tagsNormalizeRan) return;
    if (jobs === undefined) return;  // wait for the first liveQuery emission
    tagsNormalizeRan = true;
    let cancelled = false;
    (async () => {
      try {
        const dirty: PrintJob[] = [];
        for (const job of jobs) {
          // Work on a SHALLOW COPY so we don't mutate the liveQuery cache.
          const copy: PrintJob = { ...job, tags: job.tags ? [...job.tags] : undefined };
          if (normalizeTagsOnJob(copy)) {
            dirty.push({ ...copy, updatedAt: new Date() });
          }
        }
        if (cancelled) return;
        if (dirty.length > 0) {
          await db.transaction('rw', db.jobs, async () => {
            for (const job of dirty) await db.jobs.put(job);
          });
        }
      } catch (err) {
        // Reconcile failures must NOT break the app — the UI still works
        // against un-normalized tags. Allow retry on next mount.
        console.error('tag normalize reconcile failed:', err);
        tagsNormalizeRan = false;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs === undefined]);

  const addJob = useCallback(async (job: PrintJob) => {
    await db.jobs.add(job);
  }, []);

  const updateJob = useCallback(async (job: PrintJob) => {
    await db.jobs.put({ ...job, updatedAt: new Date() });
  }, []);

  const deleteJob = useCallback(async (id: string) => {
    // WR-01 hardening: the sales-cleanup + job-delete pair must be atomic.
    // Without the tx wrap, a crash between the two writes leaves orphan
    // sales referencing a deleted jobId — the same DATA-01 concern that
    // motivated wrapping addSale/deleteSale/updateSale in plan 20-01.
    await db.transaction('rw', db.sales, db.jobs, async () => {
      await db.sales.where('jobId').equals(id).delete();
      await db.jobs.delete(id);
    });
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
    await db.transaction('rw', db.sales, db.jobs, async () => {
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
    });
  }, []);

  const deleteSale = useCallback(async (sale: Sale) => {
    await db.transaction('rw', db.sales, db.jobs, async () => {
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
    });
  }, []);

  // Phase 14 revised (2026-05-22): users need to fix typos in sale records
  // (especially customer email). Quantity change must reconcile job.copiesSold
  // by the delta between old and new sale quantity.
  // Phase 20 DATA-01: wrapped in db.transaction('rw', db.sales, db.jobs, ...)
  // so a thrown exception or tab close between the sale write and the copiesSold
  // bump rolls the entire mutation back. Mirror of Convert-to-Sale at
  // JobsManager.tsx:1490. Closes CODE-AUDIT #4 (HIGH).
  const updateSale = useCallback(async (updated: Sale) => {
    await db.transaction('rw', db.sales, db.jobs, async () => {
      const previous = await db.sales.get(updated.id);
      await db.sales.put(updated);
      if (previous && previous.quantity !== updated.quantity) {
        const job = await db.jobs.get(updated.jobId);
        if (job) {
          const delta = updated.quantity - previous.quantity;
          await db.jobs.put({
            ...job,
            copiesSold: Math.max(0, job.copiesSold + delta),
            updatedAt: new Date(),
          });
        }
      }
    });
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
    updateSale,
    deleteSale,
    getTotals,
  };
}

/**
 * Hook for reading all sales globally.
 *
 * Used by JobsManager to build the salesByJob Map. Separate from
 * useSales(jobId) which exposes addSale/updateSale/deleteSale for a
 * scoped subscription on a single job.
 *
 * Returns Sale[] directly (not { sales: [...] }) to make intent clear
 * and simplify mocking: `useAllSales: () => []`.
 *
 * PERF-07: closes the global-vs-scoped useSales duplication that
 * previously lived at JobsManager.tsx:984-985 (the destructure-rename
 * pattern `const { sales: allSales } = useSales()`).
 */
export function useAllSales(): Sale[] {
  const sales = useLiveQuery(
    () => db.sales.orderBy('soldAt').reverse().toArray(),
    []
  );
  return sales ?? [];
}

// Hook for customer library (Phase 15.1 — D-03 + UI-SPEC discretion #15).
// Modeled on usePrinterInstances (no seed data, minimal CRUD + entity-specific bumpers).
export function useCustomers() {
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  // IN-01 fix: derive isLoading directly from the liveQuery value so consumers
  // also see `isLoading=true` if the store is cleared mid-session (e.g. user
  // wipes IndexedDB via DevTools) and Dexie re-emits `undefined`. Previously
  // a one-shot useState+useEffect flipped to false on the first count and
  // never re-flipped, briefly surfacing `customers: []` to consumers during
  // the next re-emission.
  const isLoading = customers === undefined;

  // Second extension D-32 / gap K: one-time pass to populate the Customer
  // Library with any customer that exists ONLY on a historical Sale.customer
  // snapshot (typically pre-Phase 15.1 sales whose auto-create path never
  // fired). Without this, the PrintQuoteModal customer picker can't find
  // them — surfaced in UAT (user typed "Logan" → no match even though Logan
  // was visibly on a Sale row). Guarded by a module-scope flag so it runs
  // exactly once per page load; helper itself is idempotent regardless.
  useEffect(() => {
    if (saleCustomerBackfillRan) return;
    if (customers === undefined) return;  // wait for the first liveQuery emission
    saleCustomerBackfillRan = true;
    let cancelled = false;
    (async () => {
      try {
        const allSales = await db.sales.toArray();
        if (cancelled) return;
        const toInsert = backfillCustomersFromSales(allSales, customers);
        if (toInsert.length > 0) {
          await db.customers.bulkAdd(toInsert);
        }
      } catch (err) {
        // Backfill failures must NOT break the app — the picker still works
        // against whatever's already in db.customers. Log so it surfaces in
        // DevTools but never throw to consumers.
        console.error('Sale→Customer backfill (D-32) failed:', err);
        // Reset the flag so the next mount can retry (DevTools wipe, etc.)
        saleCustomerBackfillRan = false;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers === undefined]);  // re-evaluate only when isLoading flips, not on every emission

  // WR-03 fix: shallow-freeze the customers array at the hook boundary so
  // consumers cannot mutate the array reference returned by Dexie's
  // liveQuery cache (e.g. an accidental `customers.sort()` in a future
  // component would corrupt the cache and emit phantom re-renders).
  // The freeze is shallow — individual Customer records are NOT frozen,
  // which preserves the existing by-value snapshot model (CL-05) at the
  // SALE WRITE site (mutation isolation is enforced when sale.customer is
  // built from typed values, not at hook-read time).
  // We deliberately keep the public type as `Customer[]` (not
  // `readonly Customer[]`) so consumers like `[...customers].sort()` and
  // `.filter()` keep working without rippling a readonly type-change
  // through every prop signature. The runtime freeze still throws (in
  // strict mode) on any direct mutation attempt — the type system loses
  // a tiny amount of compile-time safety in exchange for a much smaller
  // diff.
  const customersFrozen = useMemo<Customer[]>(
    () => Object.freeze(customers ?? []) as Customer[],
    [customers]
  );

  // O(1) email→customer map for picker + import dedup (UI-SPEC discretion #15).
  // Memoized so the reference is stable across renders that don't change the
  // customers array. Rows with empty email are excluded so the map never has
  // an empty-string key collision.
  const customersByEmail = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customersFrozen) {
      const key = (c.email || '').trim().toLowerCase();
      if (key) map.set(key, c);
    }
    return map;
  }, [customersFrozen]);

  const addCustomer = useCallback(async (customer: Customer) => {
    await db.customers.add(customer);
  }, []);

  const updateCustomer = useCallback(async (customer: Customer) => {
    await db.customers.put(customer);
  }, []);

  const deleteCustomer = useCallback(async (id: string) => {
    await db.customers.delete(id);
  }, []);

  // D-03: bump lastUsedAt when the customer is picked in the Record Sale combobox
  // or when the silent email-match auto-link path fires. NOT bumped by library
  // edits — semantics is "last used in business," not "last touched."
  // Read-modify-write so we no-op silently if the record was deleted concurrently.
  const bumpLastUsed = useCallback(async (id: string) => {
    const existing = await db.customers.get(id);
    if (existing) {
      await db.customers.put({ ...existing, lastUsedAt: new Date() });
    }
  }, []);

  // Bulk import for the CSV importer (Plan 03). Mirrors useAssets.bulkImportAssets:
  // upsert semantics so the same call handles both new rows and overwrite-existing.
  const bulkImportCustomers = useCallback(async (toImport: Customer[]) => {
    await db.customers.bulkPut(toImport);
  }, []);

  return {
    customers: customersFrozen,
    customersByEmail,
    isLoading,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    bumpLastUsed,
    bulkImportCustomers,
  };
}

// ---------------------------------------------------------------------------
// useQuotes — Quote entity hook (Phase 16 gap closure D-17 + WARNING I-07 Option B)
//
// Mirrors useCustomers' shape. Exposes:
//   - read side: quotes array + quotesByJobId Map (O(1) per-job lookup for plan 16-11)
//   - simple CRUD: addQuote / updateQuote / deleteQuote
//   - createQuote transactional action: owns the multi-store Dexie transaction
//     (quotes + customers + settings) so consumers (PrintQuoteModal in plan 16-10)
//     never import `db` directly. Per WARNING I-07 Option B architectural cleanliness.
//
// The createQuote action's Quote payload is typed `status: RuntimeQuoteStatus` so
// TypeScript REFUSES `'draft'` at the call site — compile-time enforcement of G6
// lock per BLOCKER I-03.
// ---------------------------------------------------------------------------

/**
 * Input to `createQuote` — the modal-collected fields + a reference to the current
 * UserProfile snapshot. The hook action constructs the full Quote internally.
 */
export interface CreateQuoteInput {
  job: PrintJob;
  userProfile: UserProfile;
  /** By-value snapshot of customer fields from the modal at submit time. */
  customerSnapshot: JobCustomer;
  /** Set when the modal's email-match dedup found an existing Customer; undefined = auto-create. */
  existingCustomerId?: string;
  /** D-15: shipping line from the modal's compact input. */
  shippingCost: number;
  /** D-21 resolved rate (post-fallback chain). */
  resolvedTaxRate: number;
  /** D-22 computed from sellingPrice × (resolvedTaxRate/100). */
  taxAmount: number;
}

export function useQuotes() {
  const quotes = useLiveQuery(() => db.quotes.toArray(), []);
  // IN-01 pattern: derive isLoading directly from the liveQuery value so consumers
  // also see `isLoading=true` if the store is cleared mid-session.
  const isLoading = quotes === undefined;

  // Shallow-freeze at the hook boundary (mirrors useCustomers WR-03).
  const quotesFrozen = useMemo<Quote[]>(
    () => Object.freeze(quotes ?? []) as Quote[],
    [quotes]
  );

  // O(1) per-job lookup for plan 16-11's Recent Quotes section. Indexed by
  // printJobId so each accordion expand renders without a full-array scan.
  const quotesByJobId = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const q of quotesFrozen) {
      const list = map.get(q.printJobId);
      if (list) list.push(q);
      else map.set(q.printJobId, [q]);
    }
    return map;
  }, [quotesFrozen]);

  // Simple CRUD — used by plan 16-11 status flips (updateQuote for Mark Accepted/Declined/Reopen).
  // addQuote / deleteQuote are surfaced for future hygiene; they are distinct from createQuote
  // (which wraps the full transactional action with customer link + counter bump).
  const addQuote = useCallback(async (quote: Quote) => {
    await db.quotes.add(quote);
  }, []);

  const updateQuote = useCallback(async (quote: Quote) => {
    await db.quotes.put(quote);
  }, []);

  const deleteQuote = useCallback(async (id: string) => {
    await db.quotes.delete(id);
  }, []);

  /**
   * Transactional Quote creation (per WARNING I-07 Option B).
   *
   * One atomic Dexie transaction over ['quotes', 'customers', 'settings']:
   *  - If existingCustomerId is set → bump that Customer's lastUsedAt.
   *  - Else if name OR email present → auto-create a Customer; capture id for Quote.customerId.
   *  - Add the Quote (status: 'sent' as RuntimeQuoteStatus — compiler refuses 'draft' here).
   *  - Bump UserProfile.nextQuoteNumber via setUserProfile.
   *
   * Returns the freshly-written Quote so the caller can feed it to generateQuotePdf.
   * PrintQuoteModal (plan 16-10) calls `await createQuote(...)` and NEVER imports `db` directly.
   */
  const createQuote = useCallback(async (input: CreateQuoteInput): Promise<Quote> => {
    const { job, userProfile, customerSnapshot, existingCustomerId, shippingCost, resolvedTaxRate, taxAmount } = input;

    // Auto-create customer candidate: only if no existing link AND at least name OR email present.
    const shouldAutoCreate = !existingCustomerId &&
      ((customerSnapshot.name?.trim() ?? '') !== '' || (customerSnapshot.email?.trim() ?? '') !== '');

    const newCustomerCandidate: Customer | undefined = shouldAutoCreate
      ? {
          id: typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `customer-${Date.now()}`,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          name: customerSnapshot.name,
          email: customerSnapshot.email,
          company: customerSnapshot.company,
          address: customerSnapshot.address,
          notes: customerSnapshot.notes,
        }
      : undefined;

    const customerIdForQuote = existingCustomerId ?? newCustomerCandidate?.id;

    // quotePayload is declared outside but assigned inside the tx scope so
    // the caller can return it after the transaction commits.
    // CR-02 hardening: typed as `| undefined` (not `!`) — a runtime guard
    // after the tx surfaces any future Dexie regression as a loud throw
    // rather than a silent `undefined` return that callers would dereference.
    let quotePayload: (Quote & { status: RuntimeQuoteStatus }) | undefined;

    await db.transaction('rw', db.quotes, db.customers, db.settings, async (tx) => {
      // DATA-02: read nextQuoteNumber from the tx-scoped settings snapshot
      // (not from the React state arg) so two concurrent tabs cannot allocate
      // the same quote number.
      const settingsRow = await tx.table('settings').get('userProfile');
      let nextNum = 1;
      if (settingsRow) {
        try {
          nextNum = (JSON.parse(settingsRow.value) as UserProfile).nextQuoteNumber ?? 1;
        } catch {
          // Corrupt settings — fall through to nextNum = 1. The setUserProfile
          // write at the end of this transaction will re-stamp the row clean.
        }
      }

      // Compile-time G6 guard: `status` is typed RuntimeQuoteStatus on the payload, so
      // TypeScript REFUSES `'draft'` at this call site (per BLOCKER I-03).
      const sentAt = new Date();
      quotePayload = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `quote-${Date.now()}`,
        quoteNumber: nextNum,
        printJobId: job.id,
        customerId: customerIdForQuote,
        customerSnapshot,
        lineItemsSnapshot: {
          jobTitle: job.name,
          sellingPrice: job.sellingPrice,
          shippingCost,
          resolvedTaxRate,
          taxAmount,
          currency: userProfile.currency,
          notes: job.notes ?? '',
          terms: userProfile.defaultTerms ?? '',
          countryAtSendTime: userProfile.address?.country,
        },
        status: 'sent',  // RuntimeQuoteStatus — 'draft' refused here at compile time
        createdAt: sentAt,
        sentAt,
      };

      if (existingCustomerId) {
        const existing = await db.customers.get(existingCustomerId);
        if (existing) {
          await db.customers.put({ ...existing, lastUsedAt: new Date() });
        }
      } else if (newCustomerCandidate) {
        await db.customers.add(newCustomerCandidate);
      }
      await db.quotes.add(quotePayload);
      await setUserProfile({ ...userProfile, nextQuoteNumber: nextNum + 1 });
    });

    // CR-02 guard: Dexie's documented contract is that `await db.transaction()`
    // only resolves after the scope function completes, which means quotePayload
    // is assigned. This throw is unreachable under that contract — present to
    // surface any future regression (or library change) loudly rather than as a
    // silent `undefined` returned to the caller.
    if (!quotePayload) {
      throw new Error('createQuote: transaction resolved without assigning quotePayload');
    }
    return quotePayload;
  }, []);

  return {
    quotes: quotesFrozen,
    quotesByJobId,
    isLoading,
    addQuote,
    updateQuote,
    deleteQuote,
    createQuote,
  };
}
