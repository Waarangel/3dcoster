import { useState, useMemo, useCallback } from 'react';
import type { PrintJob, Material, Sale, ShippingConfig, Currency, ShippingMethodType, MarketplaceType } from '../types';
import { useSales } from '../hooks/useDatabase';
import { Button, Input, Select, EmptyState, Skeleton, shouldShowEmptyState } from './ui';
import { ClipboardListIcon } from './ui/icons';

interface JobsManagerProps {
  jobs: PrintJob[];
  isLoading: boolean;
  materials: Material[];
  shippingConfig: ShippingConfig;
  userCurrency: Currency;
  onDeleteJob: (id: string) => Promise<void>;
  onEditJob: (job: PrintJob) => void;
  onSwitchTab: (tab: 'calculator' | 'jobs' | 'materials' | 'settings') => void;
}

function JobsListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-lg border bg-slate-700/50 border-slate-600">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton variant="line" width="w-40" />
                <Skeleton variant="line" width="w-32" height="h-5" rounded="rounded-full" />
              </div>
              <Skeleton variant="line" width="w-3/4" />
            </div>
            <div className="text-right space-y-1">
              <Skeleton variant="line" width="w-20" height="h-6" className="ml-auto" />
              <Skeleton variant="line" width="w-16" className="ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobsManager({ jobs, isLoading, materials, shippingConfig, userCurrency, onDeleteJob, onEditJob, onSwitchTab }: JobsManagerProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [saleShippingMethod, setSaleShippingMethod] = useState<ShippingMethodType>('local_pickup');
  const [saleShippingCost, setSaleShippingCost] = useState(0);
  const [saleMarketplace, setSaleMarketplace] = useState<MarketplaceType>('facebook_local');
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState<string | null>(null);

  const { sales, addSale } = useSales(selectedJobId || undefined);
  const { sales: allSales } = useSales();

  const salesByJob = useMemo(() => {
    const map = new Map<string, Sale[]>();
    for (const sale of allSales ?? []) {
      const existing = map.get(sale.jobId);
      if (existing) existing.push(sale);
      else map.set(sale.jobId, [sale]);
    }
    return map;
  }, [allSales]);

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

  // Calculate break-even info for a job using actual sale revenue
  const getBreakEvenInfo = useCallback((job: PrintJob) => {
    const jobSales = salesByJob.get(job.id) ?? [];
    const actualRevenue = jobSales.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalCost = job.costPerUnit * job.copiesSold + job.modelCost;
    const actualProfit = actualRevenue - totalCost;

    // Theoretical profit per unit at listed sell price
    const theoreticalProfitPerUnit = job.sellingPrice - job.costPerUnit;

    // Actual average profit per unit from real sales
    const actualProfitPerUnit = job.copiesSold > 0
      ? (actualRevenue - job.costPerUnit * job.copiesSold) / job.copiesSold
      : theoreticalProfitPerUnit;

    // Break-even copies uses actual avg profit if sales exist, otherwise theoretical
    const effectiveProfitPerUnit = job.copiesSold > 0 ? actualProfitPerUnit : theoreticalProfitPerUnit;
    // WR-04: normalize non-finite break-even results to null so the UI can
    // render a "cannot be computed" fallback instead of leaking 'Infinity' /
    // 'NaN' into copy ("0 / Infinity copies", "Infinity more to break even").
    // Pre-existing logic: when effectiveProfitPerUnit <= 0 and modelCost > 0
    // the raw computation yields Infinity; when modelCost === 0 and
    // effectiveProfitPerUnit <= 0 it yields 0 (already break-even, valid).
    const breakEvenCopiesRaw = effectiveProfitPerUnit > 0
      ? Math.ceil(job.modelCost / effectiveProfitPerUnit)
      : job.modelCost > 0 ? Infinity : 0;
    const breakEvenCopies: number | null = Number.isFinite(breakEvenCopiesRaw)
      ? breakEvenCopiesRaw
      : null;
    const remainingToBreakEven: number | null = breakEvenCopies === null
      ? null
      : Math.max(0, breakEvenCopies - job.copiesSold);

    return {
      revenueEarned: actualRevenue,
      profitPerUnit: actualProfitPerUnit,
      breakEvenCopies,
      remainingToBreakEven,
      isBreakEven: actualProfit >= 0 && job.copiesSold > 0,
    };
  }, [salesByJob]);

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
    setDeleteConfirmJobId(id);
  };

  const confirmDeleteJob = async () => {
    if (!deleteConfirmJobId) return;
    await onDeleteJob(deleteConfirmJobId);
    if (selectedJobId === deleteConfirmJobId) {
      setSelectedJobId(null);
    }
    setDeleteConfirmJobId(null);
  };

  const getFilamentName = (filamentId: string) => {
    const filament = materials.find(m => m.id === filamentId);
    return filament ? `${filament.brand || ''} ${filament.filamentType || filament.name}`.trim() : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Jobs List */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">My Print Jobs</h2>

        {isLoading ? (
          <JobsListSkeleton />
        ) : shouldShowEmptyState(jobs, isLoading) ? (
          <EmptyState
            icon={<ClipboardListIcon className="w-12 h-12" />}
            title="No jobs saved yet"
            description={<>Use the Cost Calculator to create and save print jobs.<br />Track sales and see how many copies you need to break even.</>}
            cta={{ label: 'Open Calculator', onClick: () => onSwitchTab('calculator') }}
          />
        ) : (
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
                      ) : info.remainingToBreakEven === null ? (
                        // WR-04: profit-per-unit <= 0 with positive modelCost means
                        // break-even is unreachable at the current sell price.
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          Break-even not reachable at current price
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          {info.remainingToBreakEven} more to break even
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {job.filaments && job.filaments.length > 0 ? (
                        job.filaments.map((f, i) => (
                          <span key={i}>
                            {i > 0 && ' + '}
                            {getFilamentName(f.filamentId ?? '')}{f.grams ? ` ${f.grams}g` : ''}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">No filament data</span>
                      )} | {job.printTimeHours}h
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">${info.revenueEarned.toFixed(2)}</div>
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
                        <div className="text-xs text-slate-500">Unit Sell Price</div>
                        <div className="font-mono text-slate-300">${job.sellingPrice.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Model source URL */}
                    {job.modelUrl && (
                      <div className="mb-4 text-sm">
                        <span className="text-slate-500">Model source: </span>
                        <a
                          href={job.modelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-400 hover:text-blue-300 underline break-all"
                        >
                          {job.modelUrl}
                        </a>
                      </div>
                    )}

                    {/* Break-even progress bar */}
                    {/* WR-04: skip the progress bar entirely when break-even is
                        not computable (e.g., sell price <= cost with a positive
                        model cost). Show an informational line instead so the
                        UI never emits 'Infinity' / 'NaN'. */}
                    <div className="mb-4">
                      {info.breakEvenCopies === null ? (
                        <div className="text-xs text-slate-400">
                          Break-even progress unavailable — sell price does not exceed cost per unit.
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Break-even Progress</span>
                            <span>{job.copiesSold} / {info.breakEvenCopies} copies</span>
                          </div>
                          <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${info.isBreakEven ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{
                                width: info.breakEvenCopies === 0
                                  ? '100%'
                                  : `${Math.min(100, (job.copiesSold / info.breakEvenCopies) * 100)}%`,
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        btnSize="sm"
                        onClick={(e) => { e.stopPropagation(); setShowSaleForm(true); setSalePrice(job.sellingPrice); }}
                      >
                        Record Sale
                      </Button>
                      <Button
                        btnSize="sm"
                        onClick={(e) => { e.stopPropagation(); handleEditJob(); }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        btnSize="sm"
                        onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}
                      >
                        Delete
                      </Button>
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
        )}
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
                  <Input
                    type="number"
                    min="1"
                    value={saleQuantity}
                    onChange={e => setSaleQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Price per Unit ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Customer Name (optional)</label>
                <Input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Facebook Marketplace buyer"
                />
              </div>

              {/* Shipping for this sale */}
              <div className="pt-3 border-t border-slate-700">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Shipping</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Method</label>
                    <Select
                      value={saleShippingMethod}
                      onChange={e => {
                        const method = e.target.value as ShippingMethodType;
                        setSaleShippingMethod(method);
                        setSaleShippingCost(getDefaultShippingCost(method));
                      }}
                    >
                      {availableShippingMethods.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Cost ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={saleShippingCost}
                      onChange={e => setSaleShippingCost(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Marketplace for this sale */}
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Marketplace</div>
                <Select
                  value={saleMarketplace}
                  onChange={e => setSaleMarketplace(e.target.value as MarketplaceType)}
                >
                  {availableMarketplaces.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Select>
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
                <Button
                  variant="success"
                  onClick={handleRecordSale}
                  className="flex-1"
                >
                  Record Sale
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowSaleForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmJobId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirmJobId(null)}>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Delete Job</h3>
            <p className="text-slate-400 text-sm mb-6">
              Delete this job and all associated sales records? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirmJobId(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteJob}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
