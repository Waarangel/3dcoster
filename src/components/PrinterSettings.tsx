import { useState } from 'react';
import type { PrinterConfig, PrinterInstance, PrintJob, Currency } from '../types';
import { formatCurrency } from '../utils/currency';
import { Button, Input, Select, EmptyState, Skeleton, shouldShowEmptyState, useToast } from './ui';
import { InfoTooltip } from './ui/InfoTooltip';
import { PrinterIcon } from './ui/icons';
import { NewBadge } from './NewBadge';

// Sentinel option value in the Printer Model dropdown that opens the
// custom-model form instead of selecting an existing model.
const ADD_CUSTOM_MODEL = '__add_custom_model__';

// Stable unique id (crypto.randomUUID when available; jsdom-safe Date.now
// fallback). Module-scope so it's outside render and avoids a collision window
// between two adds in the same millisecond. Matches the codebase id idiom.
function makeId(prefix: string): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`;
}

// Default nozzle specs for a new custom model (hardened-steel-ish), matching
// the catalog convention.
const DEFAULT_NOZZLE_COST = 8;
const DEFAULT_NOZZLE_LIFESPAN_CM3 = 15000;

interface PrinterSettingsProps {
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  isLoading: boolean;
  jobs: PrintJob[];
  userCurrency: Currency;
  onAddInstance: (instance: PrinterInstance) => void;
  onUpdateInstance: (instance: PrinterInstance) => void;
  onDeleteInstance: (id: string) => void;
  onAddPrinter: (config: PrinterConfig) => void | Promise<void>;
}

function PrinterListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton variant="line" width="w-40" />
              <Skeleton variant="line" width="w-56" />
              <Skeleton variant="line" width="w-full" />
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
                <Skeleton variant="line" height="h-full" width="w-1/3" rounded="rounded-full" />
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <Skeleton variant="line" width="w-14" height="h-8" />
              <Skeleton variant="line" width="w-16" height="h-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrinterSettings({
  printers,
  printerInstances,
  isLoading,
  jobs,
  userCurrency,
  onAddInstance,
  onUpdateInstance,
  onDeleteInstance,
  onAddPrinter,
}: PrinterSettingsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstanceNickname, setNewInstanceNickname] = useState('');
  const [newInstancePrinterId, setNewInstancePrinterId] = useState(printers[0]?.id || '');
  const [newInstanceHours, setNewInstanceHours] = useState(0);
  const [newInstancePurchasePrice, setNewInstancePurchasePrice] = useState<number | undefined>(undefined);
  const [newInstanceRecoveryMonths, setNewInstanceRecoveryMonths] = useState(12);
  const [newInstanceMonthlyHours, setNewInstanceMonthlyHours] = useState(40);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

  // Custom printer-model form (lets users add a model not in the default catalog)
  const [addingCustomModel, setAddingCustomModel] = useState(false);
  const [customModelName, setCustomModelName] = useState('');
  const [customModelWattage, setCustomModelWattage] = useState<number>(0);
  const [customModelPrice, setCustomModelPrice] = useState<number>(0);
  const [customModelLifespan, setCustomModelLifespan] = useState<number>(5000);

  const toast = useToast();

  const canSaveCustomModel =
    customModelName.trim() !== '' && customModelWattage > 0 && customModelPrice > 0 && customModelLifespan > 0;

  const handleModelSelectChange = (value: string) => {
    if (value === ADD_CUSTOM_MODEL) {
      setAddingCustomModel(true);
    } else {
      setNewInstancePrinterId(value);
    }
  };

  const resetCustomModelForm = () => {
    setCustomModelName('');
    setCustomModelWattage(0);
    setCustomModelPrice(0);
    setCustomModelLifespan(5000);
  };

  const handleSaveCustomModel = async () => {
    if (!canSaveCustomModel) return;
    const config: PrinterConfig = {
      id: makeId('custom'),
      name: customModelName.trim(),
      purchasePrice: customModelPrice,
      expectedLifespanHours: customModelLifespan,
      wattage: customModelWattage,
      nozzleCost: DEFAULT_NOZZLE_COST,
      nozzleLifespanCm3: DEFAULT_NOZZLE_LIFESPAN_CM3,
    };
    try {
      // Await the Dexie write so the model exists before we auto-select it (the
      // dropdown is driven by useLiveQuery, which emits just after the write).
      await onAddPrinter(config);
      setNewInstancePrinterId(config.id);
      setAddingCustomModel(false);
      resetCustomModelForm();
    } catch {
      toast.error('Could not save the printer model — please try again.');
    }
  };

  const handleCancelCustomModel = () => {
    setAddingCustomModel(false);
    resetCustomModelForm();
  };

  // Get default price when printer model changes
  const selectedPrinterConfig = printers.find(p => p.id === newInstancePrinterId);

  const handleAddInstance = () => {
    if (!newInstanceNickname.trim() || !newInstancePrinterId) return;

    const instance: PrinterInstance = {
      id: makeId('instance'),
      printerConfigId: newInstancePrinterId,
      nickname: newInstanceNickname.trim(),
      printHours: newInstanceHours,
      actualPurchasePrice: newInstancePurchasePrice ?? selectedPrinterConfig?.purchasePrice,
      recoveryMonths: newInstanceRecoveryMonths,
      estimatedMonthlyPrintHours: newInstanceMonthlyHours,
    };

    onAddInstance(instance);
    setNewInstanceNickname('');
    setNewInstanceHours(0);
    setNewInstancePurchasePrice(undefined);
    setNewInstanceRecoveryMonths(12);
    setNewInstanceMonthlyHours(40);
    setShowAddForm(false);
  };

  const handleDeleteInstance = (id: string) => {
    if (window.confirm('Delete this printer instance? Print history will be preserved in jobs.')) {
      onDeleteInstance(id);
    }
  };

  const getConfigForInstance = (instance: PrinterInstance) => {
    return printers.find(p => p.id === instance.printerConfigId);
  };

  return (
    <div className="space-y-6">
      {/* My Printers (Instances) */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">My Printers</h2>
            <p className="text-xs text-slate-400 mt-1">Add your specific machines with nicknames to track hours</p>
          </div>
          <Button btnSize="sm" onClick={() => setShowAddForm(true)}>
            + Add Printer
          </Button>
        </div>

        {/* Add Printer Form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
            <h3 className="text-sm font-medium text-white mb-3">Add New Printer</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nickname *</label>
                <Input
                  type="text"
                  value={newInstanceNickname}
                  onChange={e => setNewInstanceNickname(e.target.value)}
                  placeholder="e.g., Office P1S, Garage A1"
                />
              </div>
              <div>
                <label htmlFor="printer-model-select" className="relative inline-block text-xs text-slate-400 mb-1">
                  Printer Model
                  <NewBadge feature="custom-printer-model" className="absolute -top-1.5 -right-4 pointer-events-none" />
                </label>
                <Select
                  id="printer-model-select"
                  value={addingCustomModel ? ADD_CUSTOM_MODEL : newInstancePrinterId}
                  onChange={e => handleModelSelectChange(e.target.value)}
                >
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option value={ADD_CUSTOM_MODEL}>＋ Add a custom model…</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Starting Hours</label>
                <Input
                  type="number"
                  compact
                  value={newInstanceHours}
                  onChange={e => setNewInstanceHours(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Custom model form (when "Add a custom model…" is chosen) */}
            {addingCustomModel && (
              <div className="mt-3 p-4 bg-slate-800 rounded-lg border border-blue-500/40">
                <h4 className="text-sm font-medium text-white mb-1">New Custom Model</h4>
                <p className="text-xs text-slate-400 mb-3">Add a printer that isn't in the list. It'll be saved and selectable for any printer you add.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Model Name *</label>
                    <Input
                      type="text"
                      value={customModelName}
                      onChange={e => setCustomModelName(e.target.value)}
                      placeholder="e.g., Sovol SV08"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <span>Avg Wattage (W) *</span>
                      <InfoTooltip text="Average power draw while printing — NOT the PSU/peak rating. Most FDM printers average ~100–180W in steady state (the heat-up spike is brief)." />
                    </label>
                    <Input
                      type="number"
                      compact
                      value={customModelWattage || ''}
                      onChange={e => setCustomModelWattage(parseFloat(e.target.value) || 0)}
                      placeholder="120"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Price / MSRP ($) *</label>
                    <Input
                      type="number"
                      compact
                      value={customModelPrice || ''}
                      onChange={e => setCustomModelPrice(parseFloat(e.target.value) || 0)}
                      placeholder="599"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <span>Expected Lifespan (hrs) *</span>
                      <InfoTooltip text="Estimated print-hours of useful service life, used to spread the machine cost over jobs. ~4000–10000h is typical." />
                    </label>
                    <Input
                      type="number"
                      compact
                      value={customModelLifespan || ''}
                      onChange={e => setCustomModelLifespan(parseFloat(e.target.value) || 0)}
                      placeholder="5000"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="success" btnSize="sm" onClick={handleSaveCustomModel} disabled={!canSaveCustomModel}>
                    Save Model
                  </Button>
                  <Button variant="secondary" btnSize="sm" onClick={handleCancelCustomModel}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Cost Recovery Settings */}
            <div className="mt-4 pt-4 border-t border-slate-600">
              <h4 className="text-xs font-medium text-slate-300 mb-3">Cost Recovery (Break-Even)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Purchase Price ($)</span>
                    <InfoTooltip text="What you paid (may differ from MSRP)" />
                  </label>
                  <Input
                    type="number"
                    compact
                    value={newInstancePurchasePrice ?? selectedPrinterConfig?.purchasePrice ?? ''}
                    onChange={e => setNewInstancePurchasePrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder={selectedPrinterConfig?.purchasePrice?.toString() || '0'}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Recovery Period</span>
                    <InfoTooltip text="Target months to recover your investment via printed-job sales" />
                  </label>
                  <Select
                    value={newInstanceRecoveryMonths}
                    onChange={e => setNewInstanceRecoveryMonths(parseInt(e.target.value))}
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months (1 year)</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months (2 years)</option>
                    <option value={36}>36 months (3 years)</option>
                  </Select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                    <span>Monthly Print Hours</span>
                    <InfoTooltip text="Expected hours/month — used to estimate cost recovery" />
                  </label>
                  <Input
                    type="number"
                    compact
                    value={newInstanceMonthlyHours}
                    onChange={e => setNewInstanceMonthlyHours(parseFloat(e.target.value) || 0)}
                    placeholder="40"
                  />
                </div>
              </div>
              {/* Show calculated depreciation */}
              {(() => {
                const price = newInstancePurchasePrice ?? selectedPrinterConfig?.purchasePrice ?? 0;
                const totalHours = newInstanceRecoveryMonths * newInstanceMonthlyHours;
                const depreciationPerHour = totalHours > 0 ? price / totalHours : 0;
                return (
                  <div className="mt-3 p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Depreciation Rate:</span>
                      <span className="text-white font-medium">${depreciationPerHour.toFixed(3)}/hour</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      ${price.toLocaleString()} ÷ {totalHours} hours ({newInstanceRecoveryMonths} mo × {newInstanceMonthlyHours} hrs/mo)
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="success"
                onClick={handleAddInstance}
                disabled={!newInstanceNickname.trim() || addingCustomModel || !newInstancePrinterId}
              >
                Add Printer
              </Button>
              <Button
                variant="secondary"
                onClick={() => { handleCancelCustomModel(); setShowAddForm(false); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Printer Instances List */}
        {isLoading ? (
          <PrinterListSkeleton />
        ) : shouldShowEmptyState(printerInstances, isLoading) ? (
          <EmptyState
            icon={<PrinterIcon className="w-12 h-12" />}
            title="No printers added yet"
            description="Add your first printer to track depreciation, electricity costs, and maintenance intervals across every job."
            cta={{ label: 'Add Printer', onClick: () => setShowAddForm(true) }}
          />
        ) : (
          <div className="space-y-3">
            {printerInstances.map(instance => {
              const config = getConfigForInstance(instance);
              const isEditing = editingInstanceId === instance.id;

              // Depreciation rate for cost calculations
              const purchasePrice = instance.actualPurchasePrice ?? config?.purchasePrice ?? 0;
              const recoveryMonths = instance.recoveryMonths ?? 12;
              const monthlyHours = instance.estimatedMonthlyPrintHours ?? 40;
              const totalRecoveryHours = recoveryMonths * monthlyHours;
              const depreciation = totalRecoveryHours > 0 ? purchasePrice / totalRecoveryHours : 0;

              // Calculate ACTUAL recovery from sales of jobs on this printer
              const printerJobs = jobs.filter(j => j.printerInstanceId === instance.id);
              const totalProfitFromSales = printerJobs.reduce((total, job) => {
                const profitPerUnit = job.sellingPrice - job.costPerUnit;
                return total + (profitPerUnit * job.copiesSold);
              }, 0);
              const totalUnitsSold = printerJobs.reduce((total, job) => total + job.copiesSold, 0);

              // Recovery progress based on actual profit from sales
              const recoveryPercent = purchasePrice > 0
                ? (totalProfitFromSales / purchasePrice) * 100
                : 0;
              const remainingToRecover = Math.max(0, purchasePrice - totalProfitFromSales);

              return (
                <div
                  key={instance.id}
                  className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Nickname</label>
                          <Input
                            type="text"
                            value={instance.nickname}
                            onChange={e => onUpdateInstance({ ...instance, nickname: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Print Hours</label>
                          <Input
                            type="number"
                            compact
                            value={instance.printHours}
                            onChange={e => onUpdateInstance({ ...instance, printHours: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                          <Input
                            type="number"
                            compact
                            value={instance.actualPurchasePrice ?? config?.purchasePrice ?? ''}
                            onChange={e => onUpdateInstance({ ...instance, actualPurchasePrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Recovery Period</label>
                          <Select
                            value={instance.recoveryMonths ?? 12}
                            onChange={e => onUpdateInstance({ ...instance, recoveryMonths: parseInt(e.target.value) })}
                          >
                            <option value={3}>3 months</option>
                            <option value={6}>6 months</option>
                            <option value={12}>12 months</option>
                            <option value={18}>18 months</option>
                            <option value={24}>24 months</option>
                            <option value={36}>36 months</option>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Monthly Print Hours</label>
                          <Input
                            type="number"
                            compact
                            value={instance.estimatedMonthlyPrintHours ?? 40}
                            onChange={e => onUpdateInstance({ ...instance, estimatedMonthlyPrintHours: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            onClick={() => setEditingInstanceId(null)}
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{instance.nickname}</h3>
                          <span className="text-xs text-slate-400">({config?.name || 'Unknown'})</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>{instance.printHours.toFixed(1)} hours printed</span>
                          <span className="text-blue-400">${depreciation.toFixed(3)}/hr cost</span>
                          <span>{printerJobs.length} jobs · {totalUnitsSold} units sold</span>
                        </div>
                        {/* Recovery progress bar - based on actual sales profit */}
                        <div className="mt-2 w-full max-w-md">
                          <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${recoveryPercent >= 100 ? 'bg-green-500' : recoveryPercent > 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                              style={{ width: `${Math.min(100, recoveryPercent)}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {totalUnitsSold === 0 ? (
                              `No sales yet · ${formatCurrency(purchasePrice, userCurrency)} to recover`
                            ) : recoveryPercent >= 100 ? (
                              `✓ Fully recovered! ${formatCurrency(totalProfitFromSales, userCurrency)} profit from ${totalUnitsSold} sales`
                            ) : (
                              `${formatCurrency(totalProfitFromSales, userCurrency)} profit from sales · ${formatCurrency(remainingToRecover, userCurrency)} remaining to recover`
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          btnSize="sm"
                          onClick={() => setEditingInstanceId(instance.id)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          btnSize="sm"
                          onClick={() => handleDeleteInstance(instance.id)}
                          className="text-xs"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
