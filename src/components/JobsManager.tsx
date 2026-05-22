import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import type { PrintJob, Material, Sale, ShippingConfig, Currency, ShippingMethodType, MarketplaceType, Customer } from '../types';
import { useSales, useCustomers } from '../hooks/useDatabase';
import { Button, Input, Select, Textarea, EmptyState, Skeleton, shouldShowEmptyState } from './ui';
import { ClipboardListIcon } from './ui/icons';
import { NewBadge } from './NewBadge';

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

type BreakEvenInfo = {
  revenueEarned: number;
  profitPerUnit: number;
  breakEvenCopies: number | null;
  remainingToBreakEven: number | null;
  isBreakEven: boolean;
};

// Props for the module-scope JobCard. Everything is passed in explicitly so
// React.memo can compare props shallowly and skip re-renders when nothing
// relevant for THIS row changed (CR-01 + CR-03 fix).
type JobCardProps = {
  job: PrintJob;
  isSelected: boolean;
  info: BreakEvenInfo;
  recentSales?: Sale[];
  getFilamentName: (id: string) => string;
  onToggleSelect: (id: string) => void;
  onOpenSaleForm: (job: PrintJob) => void;
  onEdit: (job: PrintJob) => void;
  onDelete: (id: string) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (sale: Sale) => void;
  style?: React.CSSProperties;
};

// Module-scope, memoized job card. CR-01 fix: row component identity is now
// stable across parent renders, so react-window's internal memo wrapper
// caches correctly and rows only re-render when their props change.
const JobCard = memo(function JobCard({
  job,
  isSelected,
  info,
  recentSales,
  getFilamentName,
  onToggleSelect,
  onOpenSaleForm,
  onEdit,
  onDelete,
  onEditSale,
  onDeleteSale,
  style,
}: JobCardProps) {
  return (
    <div
      style={style}
      onClick={() => onToggleSelect(job.id)}
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

          <div className="flex gap-2">
            <Button
              variant="success"
              btnSize="sm"
              onClick={(e) => { e.stopPropagation(); onOpenSaleForm(job); }}
            >
              Record Sale
            </Button>
            <Button
              btnSize="sm"
              onClick={(e) => { e.stopPropagation(); onEdit(job); }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              btnSize="sm"
              onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
            >
              Delete
            </Button>
          </div>

          {recentSales && recentSales.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Recent Sales</h4>
              <div className="space-y-1">
                {recentSales.slice(0, 5).map(sale => {
                  // Phase 14 revised (2026-05-22): customer is per-sale.
                  // Read from sale.customer (new) with fallback to sale.customerName (legacy).
                  const saleCustomerName = sale.customer?.name || sale.customerName;
                  const hasCustomerDetails = Boolean(
                    sale.customer?.name ||
                    sale.customer?.email ||
                    sale.customer?.company ||
                    sale.customer?.address ||
                    sale.customer?.notes ||
                    sale.customerName
                  );
                  const summaryLabel = saleCustomerName
                    ? `${sale.quantity}x @ $${sale.unitPrice.toFixed(2)} (${saleCustomerName})`
                    : `${sale.quantity}x @ $${sale.unitPrice.toFixed(2)}`;
                  return (
                    <details
                      key={sale.id}
                      className="text-sm text-slate-400 bg-slate-800 px-3 py-2 rounded group"
                      onClick={e => e.stopPropagation()}
                    >
                      <summary className="flex justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 group-open:rotate-90 transition-transform">▸</span>
                          {summaryLabel}
                        </span>
                        <span className="font-mono">${sale.totalRevenue.toFixed(2)}</span>
                      </summary>
                      <div className="mt-2 pt-2 border-t border-slate-700 text-xs pl-5 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {hasCustomerDetails ? (
                            <div className="space-y-0.5">
                              {sale.customer?.name && (
                                <div><span className="text-slate-500">Name:</span> <span className="text-slate-300">{sale.customer.name}</span></div>
                              )}
                              {!sale.customer?.name && sale.customerName && (
                                <div><span className="text-slate-500">Name:</span> <span className="text-slate-300">{sale.customerName}</span></div>
                              )}
                              {sale.customer?.email && (
                                <div><span className="text-slate-500">Email:</span> <span className="text-slate-300 break-all">{sale.customer.email}</span></div>
                              )}
                              {sale.customer?.company && (
                                <div><span className="text-slate-500">Company:</span> <span className="text-slate-300">{sale.customer.company}</span></div>
                              )}
                              {sale.customer?.address && (
                                <div><span className="text-slate-500">Address:</span> <span className="text-slate-300 whitespace-pre-line">{sale.customer.address}</span></div>
                              )}
                              {sale.customer?.notes && (
                                <div><span className="text-slate-500">Notes:</span> <span className="text-slate-300 whitespace-pre-line">{sale.customer.notes}</span></div>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-500 italic">No customer details recorded.</div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            variant="primary"
                            btnSize="sm"
                            onClick={e => { e.stopPropagation(); onEditSale(sale); }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            btnSize="sm"
                            onClick={e => { e.stopPropagation(); onDeleteSale(sale); }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Module-scope adapter for react-window's <List rowComponent>. Receives the
// values for THIS row via rowProps, computes per-row derived state, and
// forwards them to JobCard. The adapter is intentionally not React.FC —
// react-window v2 requires the row component to return ReactElement | null,
// not ReactNode.
type JobRowProps = {
  jobs: PrintJob[];
  selectedJobId: string | null;
  selectedSales: Sale[];
  getFilamentName: (id: string) => string;
  getBreakEvenInfo: (job: PrintJob) => BreakEvenInfo;
  onToggleSelect: (id: string) => void;
  onOpenSaleForm: (job: PrintJob) => void;
  onEdit: (job: PrintJob) => void;
  onDelete: (id: string) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (sale: Sale) => void;
};

const JobRow = ({
  index,
  style,
  jobs,
  selectedJobId,
  selectedSales,
  getFilamentName,
  getBreakEvenInfo,
  onToggleSelect,
  onOpenSaleForm,
  onEdit,
  onDelete,
  onEditSale,
  onDeleteSale,
}: RowComponentProps<JobRowProps>) => {
  const job = jobs[index];
  const isSelected = selectedJobId === job.id;
  return (
    <JobCard
      job={job}
      isSelected={isSelected}
      info={getBreakEvenInfo(job)}
      recentSales={isSelected ? selectedSales : undefined}
      getFilamentName={getFilamentName}
      onToggleSelect={onToggleSelect}
      onOpenSaleForm={onOpenSaleForm}
      onEdit={onEdit}
      onDelete={onDelete}
      onEditSale={onEditSale}
      onDeleteSale={onDeleteSale}
      style={style}
    />
  );
};

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
  // Per-sale customer (Phase 14 revised on 2026-05-22 — D-21).
  // Captured at sale time so each Sale row carries its own buyer info.
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleCustomerEmail, setSaleCustomerEmail] = useState('');
  const [saleCustomerCompany, setSaleCustomerCompany] = useState('');
  const [saleCustomerAddress, setSaleCustomerAddress] = useState('');
  const [saleCustomerNotes, setSaleCustomerNotes] = useState('');
  const [saleShippingMethod, setSaleShippingMethod] = useState<ShippingMethodType>('local_pickup');
  const [saleShippingCost, setSaleShippingCost] = useState(0);
  const [saleMarketplace, setSaleMarketplace] = useState<MarketplaceType>('facebook_local');
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState<string | null>(null);

  const { sales, addSale, updateSale, deleteSale } = useSales(selectedJobId || undefined);
  const { sales: allSales } = useSales();
  // Phase 14 revised (2026-05-22): sales are editable so users can fix per-sale
  // customer typos after recording. Null = create mode; Sale = edit mode.
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deleteSaleConfirmId, setDeleteSaleConfirmId] = useState<string | null>(null);

  // Phase 15.1 (CL-04) — combobox picker state lives next to the saleCustomer* state
  // so they can be cleared together by handleEditSale and the cancel/close flows.
  const { customers, customersByEmail, bumpLastUsed, addCustomer } = useCustomers();
  const [customerPickerQuery, setCustomerPickerQuery] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerPickerActiveIndex, setCustomerPickerActiveIndex] = useState(0);
  const customerPickerInputRef = useRef<HTMLInputElement>(null);

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
  const getBreakEvenInfo = useCallback((job: PrintJob): BreakEvenInfo => {
    const jobSales = salesByJob.get(job.id) ?? [];
    const actualRevenue = jobSales.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalCost = job.costPerUnit * job.copiesSold + job.modelCost;
    const actualProfit = actualRevenue - totalCost;

    const theoreticalProfitPerUnit = job.sellingPrice - job.costPerUnit;
    const actualProfitPerUnit = job.copiesSold > 0
      ? (actualRevenue - job.costPerUnit * job.copiesSold) / job.copiesSold
      : theoreticalProfitPerUnit;

    const effectiveProfitPerUnit = job.copiesSold > 0 ? actualProfitPerUnit : theoreticalProfitPerUnit;
    // WR-04: normalize non-finite break-even results to null so the UI can
    // render a "cannot be computed" fallback instead of leaking 'Infinity' /
    // 'NaN' into copy.
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

  // Reset all sale-form state. Called after submit + on Cancel.
  const resetSaleForm = useCallback(() => {
    setShowSaleForm(false);
    setEditingSale(null);
    setSaleQuantity(1);
    setSalePrice(0);
    setSaleCustomerName('');
    setSaleCustomerEmail('');
    setSaleCustomerCompany('');
    setSaleCustomerAddress('');
    setSaleCustomerNotes('');
    setSaleShippingMethod('local_pickup');
    setSaleShippingCost(0);
    setSaleMarketplace('facebook_local');
  }, []);

  // Open the sale modal in edit mode. Loads the existing sale's fields into form state.
  const handleEditSale = useCallback((sale: Sale) => {
    setEditingSale(sale);
    setSaleQuantity(sale.quantity);
    setSalePrice(sale.unitPrice);
    setSaleCustomerName(sale.customer?.name ?? sale.customerName ?? '');
    setSaleCustomerEmail(sale.customer?.email ?? '');
    setSaleCustomerCompany(sale.customer?.company ?? '');
    setSaleCustomerAddress(sale.customer?.address ?? '');
    setSaleCustomerNotes(sale.customer?.notes ?? '');
    setSaleShippingMethod(sale.shippingMethod ?? 'local_pickup');
    setSaleShippingCost(sale.shippingCost ?? 0);
    setSaleMarketplace(sale.marketplace ?? 'facebook_local');
    // Phase 15.1 — clear picker state when entering edit mode (no auto-pick from prior sales)
    setCustomerPickerQuery('');
    setCustomerPickerOpen(false);
    setCustomerPickerActiveIndex(0);
    setShowSaleForm(true);
  }, []);

  // Phase 15.1 (CL-04) — filter customers by Name OR Email substring (case-insensitive).
  // Empty query keeps the dropdown closed (UI-SPEC §5).
  const filteredCustomers = useMemo<Customer[]>(() => {
    const q = customerPickerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, customerPickerQuery]);

  // Top 8 visible; the rest get an overflow footer per UI-SPEC §5.
  const visibleCustomers = useMemo<Customer[]>(
    () => filteredCustomers.slice(0, 8),
    [filteredCustomers]
  );

  // Phase 15.1 (CL-04 + D-05): pick fills Name/Email/Company/Address — NOT Notes.
  // (Sale has its own Sale.notes for transaction-level notes; library Notes is buyer-bound.)
  const handlePickCustomer = useCallback(async (c: Customer) => {
    setSaleCustomerName(c.name ?? '');
    setSaleCustomerEmail(c.email ?? '');
    setSaleCustomerCompany(c.company ?? '');
    setSaleCustomerAddress(c.address ?? '');
    // D-05: DO NOT setSaleCustomerNotes
    setCustomerPickerQuery('');
    setCustomerPickerOpen(false);
    setCustomerPickerActiveIndex(0);
    await bumpLastUsed(c.id);
  }, [bumpLastUsed]);

  // Phase 15.1 (CL-04) — WAI-ARIA combobox keyboard handler per UI-SPEC §5.
  const handlePickerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // WR-04 fix: do not open an empty dropdown. If the user typed a query
      // that matches nothing, ArrowDown has nothing to navigate — leave the
      // dropdown state alone so the user isn't shown an active-index pointing
      // at a non-existent row.
      if (visibleCustomers.length === 0) return;
      if (!customerPickerOpen) {
        setCustomerPickerOpen(true);
        setCustomerPickerActiveIndex(0);
      } else {
        // wrap: last → first
        setCustomerPickerActiveIndex(i => (i + 1) % visibleCustomers.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // wrap: first → last
      setCustomerPickerActiveIndex(i =>
        visibleCustomers.length === 0 ? 0 : (i - 1 + visibleCustomers.length) % visibleCustomers.length
      );
    } else if (e.key === 'Enter') {
      // WR-01 fix: the Record Sale modal is not a <form>, so there is no
      // implicit submit handler. Treat Enter-with-no-match as "dismiss the
      // dropdown" so the user has a clear next step (fill the fields below).
      // Enter on the empty/unopened state is a no-op — do NOT attempt to
      // submit the surrounding modal.
      if (customerPickerOpen) {
        const picked = visibleCustomers[customerPickerActiveIndex];
        if (picked) {
          e.preventDefault();
          void handlePickCustomer(picked);
        } else if (customerPickerQuery.trim()) {
          // No match — close suggestions so the user can fill the fields below.
          e.preventDefault();
          setCustomerPickerOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      if (customerPickerOpen) {
        e.preventDefault();
        setCustomerPickerOpen(false);
      }
    } else if (e.key === 'Tab') {
      // Per UI-SPEC §5: Tab closes the dropdown and advances focus naturally (do NOT auto-pick)
      setCustomerPickerOpen(false);
    }
  }, [customerPickerOpen, customerPickerActiveIndex, customerPickerQuery, visibleCustomers, handlePickCustomer]);

  const handleConfirmDeleteSale = useCallback(async (sale: Sale) => {
    await deleteSale(sale);
    setDeleteSaleConfirmId(null);
  }, [deleteSale]);

  const handleRecordSale = async () => {
    if (!selectedJob || saleQuantity <= 0) return;

    const unitPrice = salePrice || selectedJob.sellingPrice;
    const marketplaceFee = calculateMarketplaceFee(unitPrice * saleQuantity, saleMarketplace);

    // Per-sale customer payload (Phase 14 revised — D-21).
    // Only persist `customer` if at least one field was filled in; saves nothing if the
    // user skips customer entry. The legacy `customerName` field stays undefined on new
    // sales — readers fall back to it for pre-revision IndexedDB records only.
    const hasCustomer =
      saleCustomerName.trim() !== '' ||
      saleCustomerEmail.trim() !== '' ||
      saleCustomerCompany.trim() !== '' ||
      saleCustomerAddress.trim() !== '' ||
      saleCustomerNotes.trim() !== '';

    const customer = hasCustomer
      ? {
          name: saleCustomerName.trim() || undefined,
          email: saleCustomerEmail.trim() || undefined,
          company: saleCustomerCompany.trim() || undefined,
          address: saleCustomerAddress.trim() || undefined,
          notes: saleCustomerNotes.trim() || undefined,
        }
      : undefined;

    // Phase 15.1 (CL-04 / D-06 / D-07): library side-effect for NEW sales only.
    // - If the user picked from the combobox, lastUsedAt was already bumped by handlePickCustomer
    //   AND the 4 fields were filled from the library record; the typed values pass through unchanged.
    // - If the user did NOT pick (typed values directly) and at least one of name/email is non-empty:
    //   - If the typed email matches an existing library record (after trim+toLowerCase): silently
    //     link by bumping lastUsedAt; do NOT overwrite library fields with per-sale typed values
    //     (by-value rule, D-05/D-07).
    //   - Otherwise: auto-create a new library record (D-06).
    // Edit-sale path is excluded — we don't want to retroactively create library records when a
    // user edits a pre-15.1 sale.
    if (!editingSale && customer && (customer.name || customer.email)) {
      const emailKey = (customer.email || '').trim().toLowerCase();
      const existing = emailKey ? customersByEmail.get(emailKey) : undefined;
      if (existing) {
        // D-07 silent link: bump lastUsedAt; do NOT overwrite library fields with per-sale values
        await bumpLastUsed(existing.id);
      } else {
        // D-06 auto-create from typed values
        const newCustomer: Customer = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `customer-${Date.now()}`,
          createdAt: new Date(),
          lastUsedAt: new Date(),  // first use = creation time
          name: customer.name,
          email: customer.email,
          company: customer.company,
          address: customer.address,
          notes: customer.notes,
        };
        await addCustomer(newCustomer);
      }
    }

    if (editingSale) {
      // Edit mode: preserve id + soldAt + jobId from the original sale.
      const updated: Sale = {
        ...editingSale,
        quantity: saleQuantity,
        unitPrice: unitPrice,
        totalRevenue: saleQuantity * unitPrice,
        customer,
        customerName: undefined,  // Drop the legacy field on update — new shape wins.
        shippingMethod: saleShippingMethod,
        shippingCost: saleShippingCost,
        marketplace: saleMarketplace,
        marketplaceFee: marketplaceFee,
      };
      await updateSale(updated);
    } else {
      const sale: Sale = {
        id: `sale-${Date.now()}`,
        jobId: selectedJob.id,
        quantity: saleQuantity,
        unitPrice: unitPrice,
        totalRevenue: saleQuantity * unitPrice,
        soldAt: new Date(),
        customer,
        shippingMethod: saleShippingMethod,
        shippingCost: saleShippingCost,
        marketplace: saleMarketplace,
        marketplaceFee: marketplaceFee,
      };
      await addSale(sale);
    }

    resetSaleForm();
  };

  // Stable callbacks so React.memo on JobCard can skip rows whose data
  // didn't change. State setters are already stable; only derived handlers
  // need useCallback wrapping.
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedJobId(prev => prev === id ? null : id);
  }, []);

  const handleOpenSaleForm = useCallback((job: PrintJob) => {
    setSelectedJobId(job.id);
    setShowSaleForm(true);
    setSalePrice(job.sellingPrice);
  }, []);

  const handleDeleteJob = useCallback((id: string) => {
    setDeleteConfirmJobId(id);
  }, []);

  const confirmDeleteJob = async () => {
    if (!deleteConfirmJobId) return;
    await onDeleteJob(deleteConfirmJobId);
    if (selectedJobId === deleteConfirmJobId) {
      setSelectedJobId(null);
    }
    setDeleteConfirmJobId(null);
  };

  const getFilamentName = useCallback((filamentId: string) => {
    const filament = materials.find(m => m.id === filamentId);
    return filament ? `${filament.brand || ''} ${filament.filamentType || filament.name}`.trim() : 'Unknown';
  }, [materials]);

  // Dynamic row-height cache for virtualized rendering. The `key` arg
  // invalidates the cache whenever selection changes, so the previously-
  // expanded row collapses back to ~88px and the newly-selected row grows
  // to its measured height. defaultRowHeight: 88 honors D-08's bias toward
  // fixed sizing for the pre-measurement initial render.
  const rowHeightCache = useDynamicRowHeight({
    defaultRowHeight: 88,
    key: selectedJobId ?? '',
  });

  // Bundle everything the row needs through rowProps. react-window v2 does
  // a shallow comparison and re-renders rows when these values change —
  // selecting a different job updates selectedJobId, which flips isSelected
  // for the two affected rows and leaves the rest memoized (CR-03 fix).
  // Stable callbacks for per-sale actions so JobCard's React.memo can short-circuit.
  const handleEditSaleStable = useCallback((sale: Sale) => handleEditSale(sale), [handleEditSale]);
  const handleDeleteSaleStable = useCallback((sale: Sale) => setDeleteSaleConfirmId(sale.id), []);

  const rowProps = useMemo<JobRowProps>(() => ({
    jobs,
    selectedJobId,
    selectedSales: sales,
    getFilamentName,
    getBreakEvenInfo,
    onToggleSelect: handleToggleSelect,
    onOpenSaleForm: handleOpenSaleForm,
    onEdit: onEditJob,
    onDelete: handleDeleteJob,
    onEditSale: handleEditSaleStable,
    onDeleteSale: handleDeleteSaleStable,
  }), [jobs, selectedJobId, sales, getFilamentName, getBreakEvenInfo, handleToggleSelect, handleOpenSaleForm, onEditJob, handleDeleteJob, handleEditSaleStable, handleDeleteSaleStable]);

  return (
    <div className="space-y-6">
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
        ) : jobs.length > 100 ? (
          <List
            rowComponent={JobRow}
            rowCount={jobs.length}
            rowHeight={rowHeightCache}
            rowProps={rowProps}
            overscanCount={4}
            style={{ height: '70vh' }}
            className="space-y-0"
          />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isSelected = selectedJobId === job.id;
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={isSelected}
                  info={getBreakEvenInfo(job)}
                  recentSales={isSelected ? sales : undefined}
                  getFilamentName={getFilamentName}
                  onToggleSelect={handleToggleSelect}
                  onOpenSaleForm={handleOpenSaleForm}
                  onEdit={onEditJob}
                  onDelete={handleDeleteJob}
                  onEditSale={handleEditSaleStable}
                  onDeleteSale={handleDeleteSaleStable}
                />
              );
            })}
          </div>
        )}
      </div>

      {showSaleForm && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={resetSaleForm}>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingSale ? 'Edit Sale' : 'Record Sale'} - {selectedJob.name}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    compact
                    value={saleQuantity}
                    onChange={e => setSaleQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Price per Unit ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    compact
                    value={salePrice}
                    onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Customer details (Phase 14 revised — D-21).
                  Optional 4-field block. Lives on the sale, not the job. */}
              <div className="pt-3 border-t border-slate-700 relative">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Customer (optional)
                  <NewBadge feature="customer-details" className="absolute top-2 right-0" />
                </div>
                <div className="space-y-2">
                  {/* Phase 15.1 (CL-04) — Customer combobox picker (LOCKED layout per UI-SPEC §5) */}
                  <div className="relative">
                    <label className="block text-sm text-slate-400 mb-1" htmlFor="customer-picker-input">
                      Existing customer
                    </label>
                    <Input
                      id="customer-picker-input"
                      ref={customerPickerInputRef}
                      type="text"
                      role="combobox"
                      aria-expanded={customerPickerOpen}
                      aria-controls="customer-picker-listbox"
                      aria-autocomplete="list"
                      aria-activedescendant={
                        customerPickerOpen && visibleCustomers[customerPickerActiveIndex]
                          ? `customer-option-${visibleCustomers[customerPickerActiveIndex].id}`
                          : undefined
                      }
                      value={customerPickerQuery}
                      onChange={(e) => {
                        setCustomerPickerQuery(e.target.value);
                        setCustomerPickerOpen(true);
                        setCustomerPickerActiveIndex(0);
                      }}
                      onFocus={() => { if (customerPickerQuery.trim()) setCustomerPickerOpen(true); }}
                      onKeyDown={handlePickerKeyDown}
                      placeholder="Type to find a saved customer…"
                    />
                    {customerPickerOpen && customerPickerQuery.trim() && (
                      <div
                        role="listbox"
                        id="customer-picker-listbox"
                        className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-72 overflow-y-auto"
                      >
                        {visibleCustomers.map((c, i) => (
                          // allow-raw-html: WAI-ARIA combobox option needs full styling control (custom dropdown row, not a CTA button)
                          <button
                            key={c.id}
                            type="button"
                            role="option"
                            id={`customer-option-${c.id}`}
                            aria-selected={i === customerPickerActiveIndex}
                            onClick={() => { void handlePickCustomer(c); }}
                            onMouseEnter={() => setCustomerPickerActiveIndex(i)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none min-h-[44px] ${
                              i === customerPickerActiveIndex ? 'bg-blue-500/10 text-blue-300' : ''
                            }`}
                          >
                            <div className="text-sm font-medium text-white">{c.name || '(no name)'}</div>
                            <div className="text-xs text-slate-400">
                              {[c.email, c.company].filter(Boolean).join(' · ')}
                            </div>
                          </button>
                        ))}
                        {filteredCustomers.length > 8 && (
                          <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700">
                            Showing first 8 of {filteredCustomers.length} matches — refine your search
                          </div>
                        )}
                        {filteredCustomers.length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-400">
                            No saved customers match "{customerPickerQuery}". The customer will be saved when you record the sale.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Name</label>
                      <Input
                        type="text"
                        value={saleCustomerName}
                        onChange={e => setSaleCustomerName(e.target.value)}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Email</label>
                      <Input
                        type="email"
                        value={saleCustomerEmail}
                        onChange={e => setSaleCustomerEmail(e.target.value)}
                        placeholder="jane@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Company</label>
                    <Input
                      type="text"
                      value={saleCustomerCompany}
                      onChange={e => setSaleCustomerCompany(e.target.value)}
                      placeholder="Acme LLC"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Address</label>
                    <Textarea
                      rows={2}
                      value={saleCustomerAddress}
                      onChange={e => setSaleCustomerAddress(e.target.value)}
                      placeholder="Shipping address or pickup location"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Notes</label>
                    <Textarea
                      rows={2}
                      value={saleCustomerNotes}
                      onChange={e => setSaleCustomerNotes(e.target.value)}
                      placeholder="Quirks, preferences, allergies — anything to remember for next time"
                    />
                  </div>
                </div>
              </div>

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
                      compact
                      value={saleShippingCost}
                      onChange={e => setSaleShippingCost(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

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
                  {editingSale ? 'Save Changes' : 'Record Sale'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={resetSaleForm}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {deleteSaleConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteSaleConfirmId(null)}>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Delete Sale</h3>
            <p className="text-slate-400 text-sm mb-6">
              Delete this sale record? The job's copies-sold count will decrease accordingly. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => setDeleteSaleConfirmId(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const sale = sales.find(s => s.id === deleteSaleConfirmId);
                  if (sale) handleConfirmDeleteSale(sale);
                }}
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
