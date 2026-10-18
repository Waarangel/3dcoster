import { useEffect, useId, useMemo, useRef } from 'react';
import type { Material, PrinterConfig, PrinterInstance, ElectricityConfig, MaterialUsage, PrintJob, Currency, ShippingConfig, MarketplaceFees, FilamentUsage, UserProfile, ManualCostLine } from '../../types';
import { useStockEvents } from '../../hooks/useStockEvents';
import { useCostForm, nextRowKey, FORM_STORAGE_KEY } from '../../hooks/useCostForm';
import { useCostDerivedValues } from '../../hooks/useCostDerivedValues';
import { useFailureRate } from '../../hooks/useFailureRate';
import { useMaintenanceAmortization } from '../../hooks/useMaintenanceAmortization';
import { dominantMaterialId } from '../../db/failureRate';
import { resolveWeightedCostPerKwh } from '../../utils/touElectricity';
import { useSupportNudge } from '../SupportNudge';
import { Button, useToast } from '../ui';
import { getCurrencySymbol, getDistanceUnit } from '../../utils/currency';
import { newManualLine } from '../../utils/manualCostLines';
import type { FxRateTable } from '../../utils/fxConvert';
import { CostFormSection } from './CostFormSection';
import { CostParametersSection } from './CostParametersSection';
import { ShippingSection } from './ShippingSection';
import { PricingSection } from './PricingSection';
import { CostSummaryPanel } from './CostSummaryPanel';

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

export function CostCalculator({ materials, printers, printerInstances, electricity, laborHourlyRate, defaultProfitMargin, userCurrency, userProfile, fxTable, shippingConfig, marketplaceFees, onSaveJob, onUpdateJob, editingJob, onCancelEdit, onViewJobs }: CostCalculatorProps) {
  // Get currency symbol for display - changes based on user's selected currency
  const currencySymbol = getCurrencySymbol(userCurrency);
  // Get distance unit based on region (mi for US, km for most others)
  const distanceUnit = getDistanceUnit(userCurrency);

  // Stable IDs for label↔input associations (WCAG 1.3.1 / 4.1.2), one per
  // field — useId() must be called unconditionally at the top level (Rules of
  // Hooks forbid looping/generating these), so each call site stays explicit;
  // grouped into a single `ids` object afterward to keep prop-passing terse.
  // Per-row filament grams derive their id as `${ids.gramsBase}-${index}`.
  const ids = {
    printName: useId(),
    printerSelect: useId(),
    modelUrl: useId(),
    modelCost: useId(),
    authorMinPrice: useId(),
    gramsBase: useId(),
    printTime: useId(),
    failureRate: useId(),
    prepTime: useId(),
    postProcessing: useId(),
    shippingMethod: useId(),
    shippingDistance: useId(),
    carrierCost: useId(),
    sellingPlatform: useId(),
    profitMargin: useId(),
    targetProfit: useId(),
    sellingPrice: useId(),
    taxRate: useId(),
  };

  // FIX-04: ref for the Editing banner — scrolled into view when editingJob
  // becomes set so the user can see which job they are editing.
  const bannerRef = useRef<HTMLDivElement>(null);

  // FIX-04: Scroll to the Editing banner when editingJob becomes truthy.
  // Respects prefers-reduced-motion by using 'auto' behavior when the media
  // query matches (motion reduced), 'smooth' otherwise.
  useEffect(() => {
    if (!editingJob || !bannerRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bannerRef.current.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [editingJob]);

  const form = useCostForm({ editingJob, userCurrency, printerInstances, materials });
  const {
    // Value-only reads: setters/handlers for these fields are consumed by
    // CostFormSection via the wholesale `form` prop (Pick<UseCostFormResult>)
    // below — not destructured here since the orchestrator itself no longer
    // renders that JSX.
    printName,
    filamentRows,
    selectedInstanceId,
    printTimeHours, setPrintTimeHours,
    modelCost,
    modelCostPerUnit,
    authorMinPrice,
    modelUrl,
    prepTimeMinutes, setPrepTimeMinutes,
    postProcessingMinutes, setPostProcessingMinutes,
    failureRate, setFailureRate,
    materialsUsed, setMaterialsUsed,
    manualMaterials, setManualMaterials,
    taxRateOverride, setTaxRateOverride,
    shippingMethod, setShippingMethod,
    shippingDistanceKm, setShippingDistanceKm,
    shippingOverrideCost, setShippingOverrideCost,
    packagingMaterials, setPackagingMaterials,
    marketplace, setMarketplace,
    etsyChecks, setEtsyChecks,
    touStartTime, setTouStartTime,
    maintenanceCostPerHour, setMaintenanceCostPerHour,
    toMaterialRow,
    stripRowKey,
    clearForm,
    nonPricingFormState,
  } = form;

  const toast = useToast();
  // Phase 45 D-03: calm value-moment Pro nudge, self-gated (cooldown + once
  // per session) — safe to call unconditionally on the NEW-job-save path.
  const showSupportNudge = useSupportNudge();
  // Live per-asset stock (grams for filament) — drives the "won't finish this print" hint.
  const { stockByAssetId } = useStockEvents();

  // Get the selected printer instance and its config
  const selectedInstance = printerInstances.find(p => p.id === selectedInstanceId);
  // Falls back to undefined (not null) so the type matches CalcInput.selectedPrinter
  // and downstream `selectedPrinter?.foo` / `selectedPrinter !== undefined` checks
  // behave correctly. `|| undefined` (not `??`) so empty-string printer ids also fall through.
  const selectedPrinter = printers.find(p => p.id === selectedInstance?.printerConfigId) || printers[0] || undefined;

  const nonFilaments = materials.filter(m => m.category !== 'filament');
  // Filter for packaging dropdown - prioritize packaging items first, then consumables
  const packagingItems = materials.filter(m => m.category === 'packaging');
  const consumableItems = materials.filter(m => m.category === 'consumable');
  const consumables = [...packagingItems, ...consumableItems];

  // Phase 39 — Cost Realism suggestion hooks, called HERE in the orchestrator
  // (Pitfall 2: never inside CostParametersSection, which stays props-in /
  // callbacks-out / Dexie-free). Each hook is read-only; the manual inputs on
  // the form remain authoritative — Apply always routes through the EXISTING
  // setter, never an auto-write.
  const dominantFilamentId = useMemo(
    () => dominantMaterialId({ filaments: filamentRows.filter(r => r.filamentId).map(r => ({ filamentId: r.filamentId, grams: r.grams })) }),
    [filamentRows],
  );
  const empiricalFailureRate = useFailureRate(selectedInstanceId, dominantFilamentId);
  const { amortization: maintenanceAmortization } = useMaintenanceAmortization(selectedInstance);

  // TOU-02 (D-10/D-11): whether any TOU bands are configured (gates the
  // start-time picker's visibility) and a one-line savings hint comparing the
  // CURRENTLY selected start time's weighted rate against the cheapest
  // available band start, given the same print duration.
  const touBands = electricity.touBands ?? [];
  const touBandsConfigured = touBands.length > 0;
  const touSavingsHint = useMemo(() => {
    if (!touBandsConfigured || !touStartTime || printTimeHours <= 0) return null;
    const currentRate = resolveWeightedCostPerKwh(touBands, electricity.costPerKwh, touStartTime, printTimeHours);
    let cheapest: { start: string; rate: number } | null = null;
    for (const band of touBands) {
      const rate = resolveWeightedCostPerKwh(touBands, electricity.costPerKwh, band.startTime, printTimeHours);
      if (!cheapest || rate < cheapest.rate) cheapest = { start: band.startTime, rate };
    }
    if (!cheapest || cheapest.rate >= currentRate) return null;
    const wattage = selectedPrinter?.wattage ?? 0;
    const saving = (wattage / 1000) * printTimeHours * (currentRate - cheapest.rate);
    if (saving <= 0) return null;
    return { cheapestStart: cheapest.start, saving };
  }, [touBandsConfigured, touStartTime, printTimeHours, touBands, electricity.costPerKwh, selectedPrinter]);

  // availableMarketplaces / availableShippingMethods (A1) now live LOCALLY in
  // ShippingSection, derived from userCurrency/shippingConfig.customCarriers —
  // not routed through a hook or computed here.

  const derived = useCostDerivedValues({
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
    manualMaterials,
  });
  const { trueCost, fixedCosts, tax, pricing, dispatchPricing, costs } = derived;
  const { profitMarginPercent, targetProfit, sellingPrice, lastEdited } = pricing;

  // Persist the FULL form-state blob (useCostForm's non-pricing fields +
  // useCostDerivedValues' live pricing snapshot) to sessionStorage whenever
  // any of it changes — one JSON.stringify call, exactly as the pre-split
  // component's single persistence effect did. Lives in the orchestrator
  // because it's the natural place these two sibling hooks' outputs combine;
  // neither hook alone has both halves of the state in the same render.
  useEffect(() => {
    // Don't persist when editing an existing job
    if (editingJob) return;

    const formState = {
      ...nonPricingFormState,
      profitMarginPercent,
      targetProfit,
      sellingPrice,
      lastEdited,
    };
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formState));
  }, [editingJob, nonPricingFormState, profitMarginPercent, targetProfit, sellingPrice, lastEdited]);

  // Reset both useCostForm's non-pricing fields AND the pricing reducer
  // together — the pre-split component's single clearForm() touched both
  // slices of what is now two hooks' worth of state.
  const clearFormAndPricing = () => {
    clearForm();
    dispatchPricing({ type: 'RESET', profitMarginPercent: defaultProfitMargin });
  };

  // After a successful save/update: reset the form for the next job, scroll back
  // to the top, and surface a toast whose one action jumps to My Jobs (so the
  // user is never forced off the calculator but can review in a click).
  const finishAfterSave = (message: string) => {
    clearFormAndPricing();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const id = toast.success(
      <span className="flex flex-wrap items-center gap-2">
        <span>{message}</span>
        <Button
          variant="ghost"
          btnSize="sm"
          className="!px-2 !py-0.5 underline"
          onClick={() => { onViewJobs(); toast.dismiss(id); }}
        >
          View in My Jobs
        </Button>
      </span>
    );
  };

  // Explicit "start a new job" reset — clears immediately (no confirm) and
  // scrolls to the top. A saved job is safe in My Jobs; an unsaved one is cheap
  // to re-enter, so a confirm dialog isn't worth the friction.
  const handleClearForm = () => {
    clearFormAndPricing();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save job handler (create new or update existing)
  const handleSaveJob = async () => {
    if (!printName.trim()) {
      toast.error('Please enter a name for this print job');
      return;
    }
    if (filamentRows.every(r => !r.filamentId)) {
      toast.error('Please select at least one filament');
      return;
    }
    if (!selectedInstanceId || !printerInstances.some(p => p.id === selectedInstanceId)) {
      toast.error('Please select a printer');
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

    // Drop the view-only row keys before persisting (keeps the stored schema clean).
    const materialsUsedToSave = materialsUsed.map(stripRowKey);
    const packagingMaterialsToSave = packagingMaterials.map(stripRowKey);

    // Fields shared by create + update — pure object assembly (no business
    // math; trueCost/tax/fixedCosts are hook outputs consumed as-is). Phase
    // 22.1 D-03: fixedCostsAtSave snapshots the current printer/material
    // depreciation + nozzleWear so the JobsManager break-even pill converges
    // on the Calculator widget's formula for the same job.
    const sharedFields = {
      name: printName.trim(),
      filaments,
      printTimeHours,
      printerInstanceId: selectedInstanceId,
      modelCost,
      modelCostPerUnit,
      authorMinPrice: authorMinPrice || undefined,
      modelUrl: modelUrl.trim() || undefined,
      prepTimeMinutes,
      postProcessingMinutes,
      materialsUsed: materialsUsedToSave,
      // Phase 47.1 (MC-04): undefined (never []) when empty so jobs without one-off
      // costs stay byte-identical to existing records; on edit, the spread of
      // editingJob then sharedFields uses this explicit undefined to clear removed lines.
      // Save-time trimming/rounding/validation is wired in 47.1-02.
      manualMaterials: manualMaterials.length > 0 ? manualMaterials : undefined,
      failureRate,
      costPerUnit: trueCost,
      sellingPrice,
      taxRate: tax.ratePercent,
      taxAmount: tax.taxAmount,
      etsyChecks: Object.keys(etsyChecks).length > 0 ? etsyChecks : undefined,
      shippingMethod,
      shippingDistanceKm,
      shippingOverrideCost,
      packagingMaterials: packagingMaterialsToSave,
      marketplace,
      fixedCostsAtSave: { depreciation: fixedCosts.depreciation, nozzleWear: fixedCosts.nozzleWear },
      currency: userCurrency,
      // Phase 39 TOU-02/WEAR-02 (D-12/D-14): snapshot-at-save pattern — reads
      // the RESOLVED rate off `costs` (the real CostBreakdown, already computed
      // with this exact touStartTime), never recomputed later from a live
      // tariff. touStartTime itself is undefined when no TOU bands are
      // configured (flat rate was used) — both fields stay undefined for
      // non-TOU jobs, matching legacy jobs exactly.
      touStartTime: touStartTime || undefined,
      touRateUsedPerKwh: touStartTime ? costs.touRateUsedPerKwh : undefined,
      maintenanceCostAtSave: maintenanceCostPerHour > 0 ? maintenanceCostPerHour : undefined,
    };

    if (editingJob) {
      const updatedJob: PrintJob = { ...editingJob, ...sharedFields, updatedAt: new Date(), tags: editingJob.tags };
      try {
        await onUpdateJob(updatedJob);
        onCancelEdit();
        finishAfterSave('Job updated.');
      } catch {
        toast.error('Could not save the job — please try again.');
      }
    } else {
      const job: PrintJob = { id: `job-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), copiesSold: 0, ...sharedFields };
      try {
        await onSaveJob(job, printTimeHours);
        // Value moment: a NEW job was saved (not an edit) — nudge is self-gated.
        showSupportNudge();
        finishAfterSave('Job saved.');
      } catch {
        toast.error('Could not save the job — please try again.');
      }
    }
  };

  // The interlinked pricing derivation (margin/profit/price + marketplace-fee
  // re-derivation) now lives entirely in useCostDerivedValues' pricingReducer —
  // see its RECALC effect. The old ref-based fee-shape escape hatch and both
  // pre-split effects are gone.

  // Add material to job
  const addMaterialUsage = () => {
    if (nonFilaments.length === 0) return;
    setMaterialsUsed([...materialsUsed, toMaterialRow({ materialId: nonFilaments[0].id, quantity: 1 })]);
  };

  const updateMaterialUsage = (index: number, field: keyof MaterialUsage, value: string | number) => {
    setMaterialsUsed(prev =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const updatePackagingMaterial = (index: number, field: keyof MaterialUsage, value: string | number) => {
    setPackagingMaterials(prev =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const removeMaterialUsage = (index: number) => {
    setMaterialsUsed(materialsUsed.filter((_, i) => i !== index));
  };

  // Phase 47.1 (MC-01): id-keyed, immutable callbacks for manual one-off lines.
  const addManualMaterial = () => {
    setManualMaterials(prev => [...prev, newManualLine()]);
  };

  const updateManualMaterial = (id: string, patch: Partial<Pick<ManualCostLine, 'name' | 'cost'>>) => {
    setManualMaterials(prev => prev.map(line => (line.id === id ? { ...line, ...patch } : line)));
  };

  const removeManualMaterial = (id: string) => {
    setManualMaterials(prev => prev.filter(line => line.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Editing Banner */}
      {editingJob && (
        <div ref={bannerRef} className="bg-blue-600/20 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between">
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
              clearFormAndPricing();
              onCancelEdit();
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <CostFormSection
        materials={materials}
        printers={printers}
        printerInstances={printerInstances}
        userCurrency={userCurrency}
        currencySymbol={currencySymbol}
        form={form}
        stockByAssetId={stockByAssetId}
        editingJob={!!editingJob}
        nextRowKey={nextRowKey}
        ids={ids}
      />

      <CostParametersSection
        printTimeHours={printTimeHours}
        onPrintTimeHoursChange={setPrintTimeHours}
        failureRate={failureRate}
        onFailureRateChange={setFailureRate}
        prepTimeMinutes={prepTimeMinutes}
        onPrepTimeMinutesChange={setPrepTimeMinutes}
        postProcessingMinutes={postProcessingMinutes}
        onPostProcessingMinutesChange={setPostProcessingMinutes}
        materialsUsed={materialsUsed}
        materialsInProfile={derived.materialsInProfile}
        nonFilaments={nonFilaments}
        currencySymbol={currencySymbol}
        onAddMaterialUsage={addMaterialUsage}
        onUpdateMaterialUsage={updateMaterialUsage}
        onRemoveMaterialUsage={removeMaterialUsage}
        manualMaterials={manualMaterials}
        onAddManualMaterial={addManualMaterial}
        onUpdateManualMaterial={updateManualMaterial}
        onRemoveManualMaterial={removeManualMaterial}
        ids={ids}
        empiricalFailureRate={empiricalFailureRate}
        // WR-05: honor the field's own 0-99 contract (max="99" + onChange clamp)
        // and round to the whole percent the hint displays — deriveFailureRate
        // can return 100 (5 failures, 0 saves) or repeating decimals.
        onApplyEmpiricalFailureRate={() => empiricalFailureRate && setFailureRate(Math.min(99, Math.round(empiricalFailureRate.rate)))}
        touStartTime={touStartTime}
        onTouStartTimeChange={setTouStartTime}
        touBandsConfigured={touBandsConfigured}
        touSavingsHint={touSavingsHint}
        maintenanceCostPerHour={maintenanceCostPerHour}
        onMaintenanceCostPerHourChange={setMaintenanceCostPerHour}
        amortizedMaintenancePerHour={maintenanceAmortization}
        // WR-05: round to the 2-decimal currency amount the hint displays, so
        // the input never receives a long repeating-decimal division result.
        onApplyAmortizedMaintenance={() => maintenanceAmortization && setMaintenanceCostPerHour(Math.round(maintenanceAmortization.amortizedPerHour * 100) / 100)}
      />

      <ShippingSection
        shippingMethod={shippingMethod}
        onShippingMethodChange={setShippingMethod}
        shippingDistanceKm={shippingDistanceKm}
        onShippingDistanceKmChange={setShippingDistanceKm}
        shippingOverrideCost={shippingOverrideCost}
        onShippingOverrideCostChange={setShippingOverrideCost}
        derived={derived}
        shippingConfig={shippingConfig}
        distanceUnit={distanceUnit}
        currencySymbol={currencySymbol}
        packagingMaterials={packagingMaterials}
        consumables={consumables}
        onAddPackagingMaterial={() => {
          if (consumables.length > 0) {
            setPackagingMaterials([...packagingMaterials, toMaterialRow({ materialId: consumables[0].id, quantity: 1 })]);
          }
        }}
        onUpdatePackagingMaterial={updatePackagingMaterial}
        onRemovePackagingMaterial={(index) => setPackagingMaterials(packagingMaterials.filter((_, i) => i !== index))}
        marketplace={marketplace}
        onMarketplaceChange={setMarketplace}
        sellingPrice={sellingPrice}
        userCurrency={userCurrency}
        ids={ids}
      />

      <PricingSection
        currencySymbol={currencySymbol}
        derived={derived}
        sellingPrice={sellingPrice}
        targetProfit={targetProfit}
        profitMarginPercent={profitMarginPercent}
        authorMinPrice={authorMinPrice}
        taxRateOverride={taxRateOverride}
        onTaxRateOverrideChange={setTaxRateOverride}
        dispatchPricing={dispatchPricing}
        ids={ids}
      />

      <CostSummaryPanel
        currencySymbol={currencySymbol}
        userCurrency={userCurrency}
        derived={derived}
        sellingPrice={sellingPrice}
        shippingMethod={shippingMethod}
        modelCost={modelCost}
        modelCostPerUnit={modelCostPerUnit}
        prepTimeMinutes={prepTimeMinutes}
        postProcessingMinutes={postProcessingMinutes}
        laborHourlyRate={laborHourlyRate}
        failureRate={failureRate}
        printTimeHours={printTimeHours}
        marketplace={marketplace}
        etsyChecks={etsyChecks}
        onEtsyChecksChange={setEtsyChecks}
      />

      {/* Save Job Button */}
      <div className="flex flex-col md:flex-row md:justify-end gap-4">
        {editingJob ? (
          <Button
            variant="secondary"
            btnSize="lg"
            onClick={() => {
              clearFormAndPricing();
              onCancelEdit();
            }}
            className="w-full md:w-auto"
          >
            Cancel Edit
          </Button>
        ) : (
          <Button
            variant="ghost"
            btnSize="lg"
            onClick={handleClearForm}
            className="w-full md:w-auto"
          >
            Clear
          </Button>
        )}
        {/* Generate PDF removed in Phase 16 gap closure (D-13) — use Print Quote in JobsManager. */}
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
