import { useState } from 'react';
import type { PrinterConfig, PrinterInstance, ElectricityConfig, PrintJob } from '../types';
import { Button, Input, Select, EmptyState, Skeleton, shouldShowEmptyState } from './ui';
import { PrinterIcon } from './ui/icons';

interface PrinterSettingsProps {
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  isLoading: boolean;
  jobs: PrintJob[];
  electricity: ElectricityConfig;
  onAddInstance: (instance: PrinterInstance) => void;
  onUpdateInstance: (instance: PrinterInstance) => void;
  onDeleteInstance: (id: string) => void;
  onElectricityChange: (config: ElectricityConfig) => void;
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
  electricity,
  onAddInstance,
  onUpdateInstance,
  onDeleteInstance,
  onElectricityChange,
}: PrinterSettingsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstanceNickname, setNewInstanceNickname] = useState('');
  const [newInstancePrinterId, setNewInstancePrinterId] = useState(printers[0]?.id || '');
  const [newInstanceHours, setNewInstanceHours] = useState(0);
  const [newInstancePurchasePrice, setNewInstancePurchasePrice] = useState<number | undefined>(undefined);
  const [newInstanceRecoveryMonths, setNewInstanceRecoveryMonths] = useState(12);
  const [newInstanceMonthlyHours, setNewInstanceMonthlyHours] = useState(40);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

  // Get default price when printer model changes
  const selectedPrinterConfig = printers.find(p => p.id === newInstancePrinterId);

  const handleAddInstance = () => {
    if (!newInstanceNickname.trim() || !newInstancePrinterId) return;

    const instance: PrinterInstance = {
      id: `instance-${Date.now()}`,
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
                <label className="block text-xs text-slate-400 mb-1">Printer Model</label>
                <Select
                  value={newInstancePrinterId}
                  onChange={e => setNewInstancePrinterId(e.target.value)}
                >
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Starting Hours</label>
                <Input
                  type="number"
                  value={newInstanceHours}
                  onChange={e => setNewInstanceHours(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Cost Recovery Settings */}
            <div className="mt-4 pt-4 border-t border-slate-600">
              <h4 className="text-xs font-medium text-slate-300 mb-3">Cost Recovery (Break-Even)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                  <Input
                    type="number"
                    value={newInstancePurchasePrice ?? selectedPrinterConfig?.purchasePrice ?? ''}
                    onChange={e => setNewInstancePurchasePrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder={selectedPrinterConfig?.purchasePrice?.toString() || '0'}
                  />
                  <p className="text-xs text-slate-500 mt-1">What you paid</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Recovery Period</label>
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
                  <p className="text-xs text-slate-500 mt-1">Target to break even</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monthly Print Hours</label>
                  <Input
                    type="number"
                    value={newInstanceMonthlyHours}
                    onChange={e => setNewInstanceMonthlyHours(parseFloat(e.target.value) || 0)}
                    placeholder="40"
                  />
                  <p className="text-xs text-slate-500 mt-1">Expected usage</p>
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
                disabled={!newInstanceNickname.trim()}
              >
                Add Printer
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowAddForm(false)}
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
                            value={instance.printHours}
                            onChange={e => onUpdateInstance({ ...instance, printHours: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                          <Input
                            type="number"
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
                              `No sales yet · $${purchasePrice.toFixed(2)} to recover`
                            ) : recoveryPercent >= 100 ? (
                              `✓ Fully recovered! $${totalProfitFromSales.toFixed(2)} profit from ${totalUnitsSold} sales`
                            ) : (
                              `$${totalProfitFromSales.toFixed(2)} profit from sales · $${remainingToRecover.toFixed(2)} remaining to recover`
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

      {/* Electricity */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Electricity</h2>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Cost per kWh ($)</label>
          <Input
            type="number"
            step="0.01"
            value={electricity.costPerKwh}
            onChange={e => onElectricityChange({ costPerKwh: parseFloat(e.target.value) || 0 })}
            className="max-w-xs"
          />
        </div>
      </div>
    </div>
  );
}
