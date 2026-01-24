import { useState, useMemo } from 'react';
import type { PrintJob, Material, PrinterConfig, PrinterInstance, Sale, ShippingConfig, Currency, ShippingMethodType, MarketplaceType } from '../types';
import { useSales } from '../hooks/useDatabase';

interface JobsManagerProps {
  jobs: PrintJob[];
  materials: Material[];
  printers: PrinterConfig[];
  printerInstances: PrinterInstance[];
  shippingConfig: ShippingConfig;
  userCurrency: Currency;
  onDeleteJob: (id: string) => void;
  onEditJob: (job: PrintJob) => void;
}

export function JobsManager({ jobs, materials, printers, printerInstances, shippingConfig, userCurrency, onDeleteJob, onEditJob }: JobsManagerProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [saleShippingMethod, setSaleShippingMethod] = useState<ShippingMethodType>('local_pickup');
  const [saleShippingCost, setSaleShippingCost] = useState(0);
  const [saleMarketplace, setSaleMarketplace] = useState<MarketplaceType>('facebook_local');

  const { sales, addSale } = useSales(selectedJobId || undefined);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Get available shipping methods based on currency
  const availableShippingMethods = useMemo(() => {
    const methods: { value: ShippingMethodType; label: string }[] = [];
    if (userCurrency === 'CAD') {
      methods.push({ value: 'local_pickup', label: 'Local Pickup (Free)' });
      methods.push({ value: 'dropoff', label: 'Dropoff' });
      methods.push({ value: 'ups', label: 'UPS' });
      methods.push({ value: 'fedex', label: 'FedEx' });
      methods.push({ value: 'purolator', label: 'Purolator' });
    } else {
      methods.push({ value: 'local_pickup', label: 'Local Pickup (Free)' });
      methods.push({ value: 'ups', label: 'UPS' });
      methods.push({ value: 'fedex', label: 'FedEx' });
      methods.push({ value: 'usps', label: 'USPS' });
    }
    return methods;
  }, [userCurrency]);

  // Get available marketplace options based on currency
  const availableMarketplaces = useMemo(() => {
    const options: { value: MarketplaceType; label: string }[] = [
      { value: 'none', label: 'Direct Sale' },
      { value: 'facebook_local', label: 'FB Marketplace (Local)' },
      { value: 'facebook_shipped', label: 'FB Marketplace (Shipped)' },
    ];
    if (userCurrency === 'CAD') {
      options.push({ value: 'kijiji', label: 'Kijiji' });
    }
    options.push({ value: 'etsy', label: 'Etsy' });
    return options;
  }, [userCurrency]);

  // Calculate marketplace fee
  const calculateMarketplaceFee = (price: number, marketplace: MarketplaceType) => {
    switch (marketplace) {
      case 'facebook_shipped':
        return Math.max(0.80, price * 0.10) + price * 0.029;
      case 'etsy':
        return price * 0.065 + price * 0.03 + 0.45;
      default:
        return 0;
    }
  };

  // Get default shipping cost based on method
  const getDefaultShippingCost = (method: ShippingMethodType) => {
    switch (method) {
      case 'local_pickup': return 0;
      case 'ups': return shippingConfig.upsBaseCost;
      case 'fedex': return shippingConfig.fedexBaseCost;
      case 'purolator': return shippingConfig.purolatorBaseCost;
      case 'usps': return shippingConfig.uspsBaseCost;
      default: return 0;
    }
  };

  // Calculate break-even info for a job
  const getBreakEvenInfo = (job: PrintJob) => {
    const revenueEarned = job.copiesSold * job.sellingPrice;
    const profitPerUnit = job.sellingPrice - job.costPerUnit;

    // How many copies to break even (recover model cost)
    const breakEvenCopies = profitPerUnit > 0
      ? Math.ceil(job.modelCost / profitPerUnit)
      : job.modelCost > 0 ? Infinity : 0;
    const remainingToBreakEven = Math.max(0, breakEvenCopies - job.copiesSold);

    return {
      revenueEarned,
      profitPerUnit,
      breakEvenCopies,
      remainingToBreakEven,
      isBreakEven: job.copiesSold >= breakEvenCopies,
    };
  };

  const handleRecordSale = async () => {
    if (!selectedJob || saleQuantity <= 0) return;

    const unitPrice = salePrice || selectedJob.sellingPrice;
    const marketplaceFee = calculateMarketplaceFee(unitPrice * saleQuantity, saleMarketplace);

    const sale: Sale = {
      id: `sale-${Date.now()}`,
      jobId: selectedJob.id,
      quantity: saleQuantity,
      unitPrice: unitPrice,
      totalRevenue: saleQuantity * unitPrice,
      soldAt: new Date(),
      customerName: customerName || undefined,
      shippingMethod: saleShippingMethod,
      shippingCost: saleShippingCost,
      marketplace: saleMarketplace,
      marketplaceFee: marketplaceFee,
    };

    await addSale(sale);
    setShowSaleForm(false);
    setSaleQuantity(1);
    setSalePrice(0);
    setCustomerName('');
    setSaleShippingMethod('local_pickup');
    setSaleShippingCost(0);
    setSaleMarketplace('facebook_local');
  };

  // Handle edit job - load in Cost Calculator
  const handleEditJob = () => {
    if (!selectedJob) return;
    onEditJob(selectedJob);
  };

  const handleDeleteJob = (id: string) => {
    if (window.confirm('Delete this job and all associated sales records?')) {
      onDeleteJob(id);
      if (selectedJobId === id) {
        setSelectedJobId(null);
      }
    }
  };

  const getFilamentName = (filamentId: string) => {
    const filament = materials.find(m => m.id === filamentId);
    return filament ? `${filament.brand || ''} ${filament.filamentType || filament.name}`.trim() : 'Unknown';
  };

  // Helper function for potential future use
  const _getPrinterName = (printerInstanceId: string) => {
    const instance = printerInstances.find(p => p.id === printerInstanceId);
    if (!instance) return 'Unknown';
    const config = printers.find(p => p.id === instance.printerConfigId);
    return `${instance.nickname} (${config?.name || 'Unknown'})`;
  };
  void _getPrinterName; // Silence unused warning

  if (jobs.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>
        <div className="text-center py-12">
          <p className="text-slate-400 mb-2">No jobs saved yet</p>
          <p className="text-slate-500 text-sm">
            Use the Cost Calculator to create and save print jobs.
            <br />
            Track sales and see how many copies you need to break even.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Jobs List */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>

        <div className="space-y-3">
          {jobs.map(job => {
            const info = getBreakEvenInfo(job);
            const isSelected = selectedJobId === job.id;

            return (
              <div
                key={job.id}
                onClick={() => setSelectedJobId(isSelected ? null : job.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-700 border-blue-500'
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-white">{job.name}</h3>
                      {info.isBreakEven ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                          Break-even reached
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          {info.remainingToBreakEven} more to break even
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {getFilamentName(job.filamentId)} | {job.filamentGrams}g | {job.printTimeHours}h
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">${job.sellingPrice.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">
                      {job.copiesSold} sold
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-slate-600">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-slate-500">Cost/Unit</div>
                        <div className="font-mono text-slate-300">${job.costPerUnit.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Profit/Unit</div>
                        <div className="font-mono text-green-400">${info.profitPerUnit.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Revenue Earned</div>
                        <div className="font-mono text-slate-300">${info.revenueEarned.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Break-even progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Break-even Progress</span>
                        <span>{job.copiesSold} / {info.breakEvenCopies} copies</span>
                      </div>
                      <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${info.isBreakEven ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, (job.copiesSold / info.breakEvenCopies) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowSaleForm(true); setSalePrice(job.sellingPrice); }}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Record Sale
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditJob(); }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>

                    {/* Recent sales */}
                    {sales.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Recent Sales</h4>
                        <div className="space-y-1">
                          {sales.slice(0, 5).map(sale => (
                            <div key={sale.id} className="flex justify-between text-sm text-slate-400 bg-slate-800 px-3 py-2 rounded">
                              <span>
                                {sale.quantity}x @ ${sale.unitPrice.toFixed(2)}
                                {sale.customerName && <span className="text-slate-500 ml-2">({sale.customerName})</span>}
                              </span>
                              <span className="font-mono">${sale.totalRevenue.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sale Form Modal */}
      {showSaleForm && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSaleForm(false)}>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Record Sale - {selectedJob.name}</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={saleQuantity}
                    onChange={e => setSaleQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Price per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Customer Name (optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Facebook Marketplace buyer"
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Shipping for this sale */}
              <div className="pt-3 border-t border-slate-700">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Shipping</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Method</label>
                    <select
                      value={saleShippingMethod}
                      onChange={e => {
                        const method = e.target.value as ShippingMethodType;
                        setSaleShippingMethod(method);
                        setSaleShippingCost(getDefaultShippingCost(method));
                      }}
                      className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    >
                      {availableShippingMethods.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={saleShippingCost}
                      onChange={e => setSaleShippingCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Marketplace for this sale */}
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Marketplace</div>
                <select
                  value={saleMarketplace}
                  onChange={e => setSaleMarketplace(e.target.value as MarketplaceType)}
                  className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
                >
                  {availableMarketplaces.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Summary */}
              <div className="pt-3 border-t border-slate-700 space-y-2">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Sale Total</span>
                  <span className="font-mono">${(saleQuantity * salePrice).toFixed(2)}</span>
                </div>
                {saleShippingCost > 0 && (
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>+ Shipping Charged</span>
                    <span className="font-mono">${saleShippingCost.toFixed(2)}</span>
                  </div>
                )}
                {calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace) > 0 && (
                  <div className="flex justify-between text-sm text-orange-400">
                    <span>- Marketplace Fee</span>
                    <span className="font-mono">-${calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-semibold pt-2 border-t border-slate-600">
                  <span>Net Revenue</span>
                  <span className="font-mono">
                    ${((saleQuantity * salePrice) + saleShippingCost - calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleRecordSale}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                >
                  Record Sale
                </button>
                <button
                  onClick={() => setShowSaleForm(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
