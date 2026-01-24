import { useState } from 'react';
import type { PrinterConfig, PrinterInstance, ElectricityConfig, PrintJob } from '../types';

interface PrinterSettingsProps {
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  jobs: PrintJob[];
  electricity: ElectricityConfig;
  onAddInstance: (instance: PrinterInstance) => void;
  onUpdateInstance: (instance: PrinterInstance) => void;
  onDeleteInstance: (id: string) => void;
  onElectricityChange: (config: ElectricityConfig) => void;
}

export function PrinterSettings({
  printers,
  printerInstances,
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
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            + Add Printer
          </button>
        </div>

        {/* Add Printer Form */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
            <h3 className="text-sm font-medium text-white mb-3">Add New Printer</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nickname *</label>
                <input
                  type="text"
                  value={newInstanceNickname}
                  onChange={e => setNewInstanceNickname(e.target.value)}
                  placeholder="e.g., Office P1S, Garage A1"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Printer Model</label>
                <select
                  value={newInstancePrinterId}
                  onChange={e => setNewInstancePrinterId(e.target.value)}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                >
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Starting Hours</label>
                <input
                  type="number"
                  value={newInstanceHours}
                  onChange={e => setNewInstanceHours(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Cost Recovery Settings */}
            <div className="mt-4 pt-4 border-t border-slate-600">
              <h4 className="text-xs font-medium text-slate-300 mb-3">Cost Recovery (Break-Even)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                  <input
                    type="number"
                    value={newInstancePurchasePrice ?? selectedPrinterConfig?.purchasePrice ?? ''}
                    onChange={e => setNewInstancePurchasePrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder={selectedPrinterConfig?.purchasePrice?.toString() || '0'}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">What you paid</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Recovery Period</label>
                  <select
                    value={newInstanceRecoveryMonths}
                    onChange={e => setNewInstanceRecoveryMonths(parseInt(e.target.value))}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months (1 year)</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months (2 years)</option>
                    <option value={36}>36 months (3 years)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Target to break even</p>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monthly Print Hours</label>
                  <input
                    type="number"
                    value={newInstanceMonthlyHours}
                    onChange={e => setNewInstanceMonthlyHours(parseFloat(e.target.value) || 0)}
                    placeholder="40"
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
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
              <button
                onClick={handleAddInstance}
                disabled={!newInstanceNickname.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Add Printer
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Printer Instances List */}
        {printerInstances.length === 0 ? (
          <p className="text-slate-500 text-sm">No printers added yet. Add your first printer to start tracking.</p>
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
                          <input
                            type="text"
                            value={instance.nickname}
                            onChange={e => onUpdateInstance({ ...instance, nickname: e.target.value })}
                            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Print Hours</label>
                          <input
                            type="number"
                            value={instance.printHours}
                            onChange={e => onUpdateInstance({ ...instance, printHours: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Purchase Price ($)</label>
                          <input
                            type="number"
                            value={instance.actualPurchasePrice ?? config?.purchasePrice ?? ''}
                            onChange={e => onUpdateInstance({ ...instance, actualPurchasePrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Recovery Period</label>
                          <select
                            value={instance.recoveryMonths ?? 12}
                            onChange={e => onUpdateInstance({ ...instance, recoveryMonths: parseInt(e.target.value) })}
                            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={3}>3 months</option>
                            <option value={6}>6 months</option>
                            <option value={12}>12 months</option>
                            <option value={18}>18 months</option>
                            <option value={24}>24 months</option>
                            <option value={36}>36 months</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Monthly Print Hours</label>
                          <input
                            type="number"
                            value={instance.estimatedMonthlyPrintHours ?? 40}
                            onChange={e => onUpdateInstance({ ...instance, estimatedMonthlyPrintHours: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => setEditingInstanceId(null)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                          >
                            Done
                          </button>
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
                        <button
                          onClick={() => setEditingInstanceId(instance.id)}
                          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteInstance(instance.id)}
                          className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded transition-colors"
                        >
                          Delete
                        </button>
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
          <input
            type="number"
            step="0.01"
            value={electricity.costPerKwh}
            onChange={e => onElectricityChange({ costPerKwh: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 max-w-xs"
          />
        </div>
      </div>
    </div>
  );
}
