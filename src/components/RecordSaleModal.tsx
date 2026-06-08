import { useEffect, useId, useMemo, useCallback, useState } from 'react';
import type {
  PrintJob,
  ShippingConfig,
  Currency,
  Sale,
  Quote,
  MarketplaceType,
  ShippingMethodType,
  Customer,
  RuntimeQuoteStatus,
} from '../types';
import { useSales, useCustomers } from '../hooks/useDatabase';
import { useCustomerPicker, PICKER_VISIBLE_LIMIT } from '../hooks/useCustomerPicker';
import { db } from '../db/database';
import { Button, Input, Select, Textarea, Modal } from './ui';
import { NewBadge } from './NewBadge';
import { formatQuoteNumber } from '../utils/format';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

// ---------------------------------------------------------------------------
// RecordSaleModal — Phase 22 HYG-06 (plan 22-03).
//
// Extracted from JobsManager.tsx (the inline Modal block + handleRecordSale).
// Owns its own state, the Phase 15.1 D-06 auto-create + D-07 silent-link
// customer side-effects, AND the Convert-from-Quote atomic db.transaction
// (D-20 / Phase 16 plan 16-12). The atomic tx CANNOT be replaced with
// addSale() — addSale wraps its own implicit transaction, and a nested
// transaction over db.quotes (not in addSale's scope) would deadlock. See
// Pitfall 2 in 22-RESEARCH.md.
//
// Modal subscribes to useCustomers() and useSales(job.id) internally (D-06)
// so the parent doesn't pass customer/sale data through props. editingSale
// and convertingFromQuote stay CONTROLLED by JobsManager — the modal
// hydrates its local form state from those props via a useEffect (D-08).
//
// Per Modal.tsx:67 (`if (!isOpen) return null`), children unmount on close,
// so form reset on close is handled by unmount — no useEffect([isOpen])
// reset block needed. The hydration effect is keyed on
// [editingSale, convertingFromQuote, job.sellingPrice] so a fresh mount
// always picks the right initial state.
// ---------------------------------------------------------------------------

// PERF-03 (plan 22-05 will hoist further; for now move verbatim from
// JobsManager.tsx:1051-1060 to module scope). Pure function — no React
// closures, no side effects.
function calculateMarketplaceFee(price: number, marketplace: MarketplaceType): number {
  switch (marketplace) {
    case 'facebook_shipped':
      return Math.max(0.80, price * 0.10) + price * 0.029;
    case 'etsy':
      return price * 0.065 + price * 0.03 + 0.45;
    default:
      return 0;
  }
}

export interface RecordSaleModalProps {
  job: PrintJob;
  userCurrency: Currency;
  shippingConfig: ShippingConfig;
  editingSale: Sale | null;
  convertingFromQuote: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function RecordSaleModal({
  job,
  userCurrency,
  shippingConfig,
  editingSale,
  convertingFromQuote,
  isOpen,
  onClose,
  onSaved,
}: RecordSaleModalProps) {
  // D-06: modal owns its own useCustomers + useSales subscriptions
  const { customers, customersByEmail, bumpLastUsed, addCustomer } = useCustomers();
  const { addSale, updateSale } = useSales(job.id);

  // ─── Form state (mirror of JobsManager) ────────────────────────────────────
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleCustomerEmail, setSaleCustomerEmail] = useState('');
  const [saleCustomerCompany, setSaleCustomerCompany] = useState('');
  const [saleCustomerAddress, setSaleCustomerAddress] = useState('');
  const [saleCustomerNotes, setSaleCustomerNotes] = useState('');
  const [saleShippingMethod, setSaleShippingMethod] = useState<ShippingMethodType>('local_pickup');
  const [saleShippingCost, setSaleShippingCost] = useState(0);
  const [saleMarketplace, setSaleMarketplace] = useState<MarketplaceType>('facebook_local');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Stable ids for label/input pairing (A11Y-07) ─────────────────────────
  const saleQuantityId = useId();
  const salePriceId = useId();
  const saleCustomerNameId = useId();
  const saleCustomerEmailId = useId();
  const saleCustomerCompanyId = useId();
  const saleCustomerAddressId = useId();
  const saleCustomerNotesId = useId();
  const saleShippingMethodId = useId();
  const saleShippingCostId = useId();

  // ─── Hydration effect (D-08 / Pitfall 3 / Phase 22.1 D-09 / WR-02) ────────
  // Keyed on [editingSale?.id, convertingFromQuote?.id] only — see Pitfall 3
  // comment immediately above the closing dep array below for the full WHY.
  // Modal.tsx:67 unmounts children on close, so each open is a fresh mount;
  // the first effect-fire after mount hydrates with the correct mode.
  // DO NOT add isOpen to the dep array — that would re-hydrate every time
  // the modal opens with the same props, clobbering user edits mid-session
  // if React ever batches the open transition.
  useEffect(() => {
    if (editingSale) {
      // Edit mode — hydrate from the existing Sale (mirror of handleEditSale
      // at JobsManager.tsx:1154-1171)
      setSaleQuantity(editingSale.quantity);
      setSalePrice(editingSale.unitPrice);
      setSaleCustomerName(editingSale.customer?.name ?? editingSale.customerName ?? '');
      setSaleCustomerEmail(editingSale.customer?.email ?? '');
      setSaleCustomerCompany(editingSale.customer?.company ?? '');
      setSaleCustomerAddress(editingSale.customer?.address ?? '');
      setSaleCustomerNotes(editingSale.customer?.notes ?? '');
      setSaleShippingMethod(editingSale.shippingMethod ?? 'local_pickup');
      setSaleShippingCost(editingSale.shippingCost ?? 0);
      setSaleMarketplace(editingSale.marketplace ?? 'facebook_local');
    } else if (convertingFromQuote) {
      // Convert-from-Quote mode — hydrate from the Quote snapshot (mirror of
      // handleStartConversion at JobsManager.tsx:1130-1151)
      setSaleQuantity(1);
      setSalePrice(convertingFromQuote.lineItemsSnapshot.sellingPrice);
      setSaleCustomerName(convertingFromQuote.customerSnapshot.name ?? '');
      setSaleCustomerEmail(convertingFromQuote.customerSnapshot.email ?? '');
      setSaleCustomerCompany(convertingFromQuote.customerSnapshot.company ?? '');
      setSaleCustomerAddress(convertingFromQuote.customerSnapshot.address ?? '');
      setSaleCustomerNotes('');
      setSaleShippingMethod('local_pickup');
      setSaleShippingCost(convertingFromQuote.lineItemsSnapshot.shippingCost);
      setSaleMarketplace('facebook_local');
    } else {
      // Create mode — defaults (mirror of resetSaleForm at JobsManager.tsx:1110-1124
      // but with job.sellingPrice as the default unitPrice).
      setSaleQuantity(1);
      setSalePrice(job.sellingPrice);
      setSaleCustomerName('');
      setSaleCustomerEmail('');
      setSaleCustomerCompany('');
      setSaleCustomerAddress('');
      setSaleCustomerNotes('');
      setSaleShippingMethod('local_pickup');
      setSaleShippingCost(0);
      setSaleMarketplace('facebook_local');
    }
    // Pitfall 3: DO NOT add job.sellingPrice — a concurrent useLiveQuery emission
    // that updates the job's selling price while the modal is open must NOT clobber
    // the user's in-progress form state. Only editingSale/convertingFromQuote
    // identity drives re-hydration (Phase 22.1 D-09 / WR-02).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSale?.id, convertingFromQuote?.id]);

  // ─── Customer picker integration ──────────────────────────────────────────
  // Phase 15.1 (CL-04 + D-05): pick fills Name/Email/Company/Address — NOT Notes.
  // (Sale has its own Sale.notes for transaction-level notes; library Notes is
  // buyer-bound — never overwrite the user's typed sale-level notes from a
  // library record.) WR-05 fix: do NOT bump lastUsedAt here — the bump fires
  // exclusively from handleRecordSale's auto-link path (D-07 silent link).
  const handlePickCustomer = useCallback((c: Customer) => {
    setSaleCustomerName(c.name ?? '');
    setSaleCustomerEmail(c.email ?? '');
    setSaleCustomerCompany(c.company ?? '');
    setSaleCustomerAddress(c.address ?? '');
    // D-05: DO NOT setSaleCustomerNotes
  }, []);

  const picker = useCustomerPicker(customers, { onPick: handlePickCustomer });

  // ─── Shipping method defaults ─────────────────────────────────────────────
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

  // ─── Currency-scoped shipping + marketplace options ───────────────────────
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

  // PERF-02 (D-21): collapse the 3 JSX summary-block calls to a single
  // memoized constant. Previously the same calculation ran 3× per render
  // (Sale Total summary, Marketplace Fee row, Net Revenue row). Now it
  // runs once per change of [saleQuantity, salePrice, saleMarketplace].
  // NOTE: handleRecordSale's separate `marketplaceFee` (local const inside
  // the handler) uses `unitPrice = salePrice || job.sellingPrice` as its
  // first arg — DIFFERENT semantics from the JSX summary which displays
  // the in-progress entry verbatim. The handler's local stays untouched.
  const marketplaceFee = useMemo(
    () => calculateMarketplaceFee(saleQuantity * salePrice, saleMarketplace),
    [saleQuantity, salePrice, saleMarketplace],
  );

  // ─── handleRecordSale (ported verbatim from JobsManager.tsx:1272-1420) ───
  const handleRecordSale = async () => {
    setSaveError(null);
    if (saleQuantity <= 0) return;

    try {
    const unitPrice = salePrice || job.sellingPrice;
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
    // Single source of truth for lastUsedAt bumps — fires here at sale-commit
    // time, NOT at pick time (WR-05 fix: picking and cancelling the form must
    // NOT advance lastUsedAt).
    // - Picked customer who is still email-matched at commit → silent link
    //   path below bumps lastUsedAt for that existing record. The 4 fields
    //   were filled from the library record by handlePickCustomer; the typed
    //   values pass through unchanged.
    // - Picked customer whose email was edited to match a DIFFERENT record →
    //   the silent link path bumps the new match (D-07 intended behavior),
    //   and the originally-picked record is correctly left untouched.
    // - User typed values directly with no email match → auto-create a new
    //   library record (D-06).
    // Edit-sale path is excluded — we don't want to retroactively create
    // library records when a user edits a pre-15.1 sale.
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

    // TODO(future-sale-pdf): D-21 audit 2026-05-23 — when Sale gains taxRate (e.g.,
    // Sale PDF invoicing in v2), persist the RESOLVED rate from resolveTaxRate(),
    // NOT the raw form override. Mirror the CostCalculator.tsx D-21 fix at lines
    // 589 + 624. Sale today (Phase 14 shape) has shippingCost/marketplace/marketplaceFee
    // but no taxRate field — audit-clean as of 2026-05-23.
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
        currency: userCurrency,
      };
      await updateSale(updated);
    } else {
      const sale: Sale = {
        id: `sale-${Date.now()}`,
        jobId: job.id,
        quantity: saleQuantity,
        unitPrice: unitPrice,
        totalRevenue: saleQuantity * unitPrice,
        soldAt: new Date(),
        customer,
        shippingMethod: saleShippingMethod,
        shippingCost: saleShippingCost,
        marketplace: saleMarketplace,
        marketplaceFee: marketplaceFee,
        // Phase 16 plan 16-12 (D-20): back-reference to the originating Quote when this Sale
        // is being written as part of a Convert to Sale flow. The conversion's Quote patch
        // is written atomically in the same Dexie transaction below.
        convertedFromQuoteId: convertingFromQuote?.id,
        currency: userCurrency,
      };
      if (convertingFromQuote) {
        // D-20 atomicity: Sale.add + Quote.put + job.copiesSold bump run in ONE
        // Dexie transaction. Rollback leaves NEITHER persisted on any mid-
        // transaction failure.
        //
        // The job.copiesSold bump MUST live here (not via useSales().addSale)
        // because addSale wraps its own implicit write — calling it inside this
        // explicit transaction would either deadlock or fail to participate in
        // the atomic rollback. So we inline the same logic: read the job, bump
        // copiesSold, write back. Mirrors useSales.addSale's body verbatim.
        // [DO NOT REMOVE THIS BUMP] — first ext2 ship silently dropped it,
        // which made break-even progress stall whenever conversions happened
        // without a parallel Record Sale.
        //
        // BLOCKER I-03 compile-time guard: the Quote patch declares
        // `status: RuntimeQuoteStatus` so TypeScript REFUSES `'draft'` at this
        // call site. Symmetric with createQuote in useDatabase.ts — both
        // runtime write sites narrow the status to the runtime-only enum.
        const quotePatch: Quote & { status: RuntimeQuoteStatus } = {
          ...convertingFromQuote,
          status: 'converted',
          convertedAt: new Date(),
          convertedToSaleId: sale.id,
        };
        await db.transaction('rw', db.sales, db.quotes, db.jobs, async () => {
          await db.sales.add(sale);
          await db.quotes.put(quotePatch);
          const jobRow = await db.jobs.get(sale.jobId);
          if (jobRow) {
            await db.jobs.put({
              ...jobRow,
              copiesSold: jobRow.copiesSold + sale.quantity,
              updatedAt: new Date(),
            });
          }
        });
      } else {
        // Legacy non-conversion path — addSale internally bumps job.copiesSold
        // (see useDatabase.ts:476-487). Do NOT duplicate the bump here.
        await addSale(sale);
      }
    }

    onSaved?.();
    onClose();
  } catch (err) {
    console.error('RecordSaleModal save failed:', err);
    setSaveError('Could not save the sale — please try again.');
  }
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${editingSale ? 'Edit Sale' : 'Record Sale'} - ${job.name}`}
      size="md"
    >
      <div className="p-4">
        {convertingFromQuote && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs text-blue-300 mb-3">
            Converting {formatQuoteNumber(convertingFromQuote.quoteNumber)} — review and adjust if needed.
          </div>
        )}

        {saveError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-3">
            {saveError}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={saleQuantityId} className="block text-xs text-slate-400 mb-1">Quantity</label>
              <Input
                id={saleQuantityId}
                type="number"
                min="1"
                compact
                value={saleQuantity}
                onChange={e => setSaleQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <label htmlFor={salePriceId} className="block text-xs text-slate-400 mb-1">Price per Unit ({getCurrencySymbol(userCurrency)})</label>
              <Input
                id={salePriceId}
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
                  type="text"
                  role="combobox"
                  aria-expanded={picker.open}
                  aria-controls="customer-picker-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    picker.open && picker.visibleCustomers[picker.activeIndex]
                      ? `customer-option-${picker.visibleCustomers[picker.activeIndex].id}`
                      : undefined
                  }
                  value={picker.query}
                  onChange={(e) => {
                    picker.setQuery(e.target.value);
                    picker.setOpen(true);
                    picker.setActiveIndex(0);
                  }}
                  onFocus={() => { if (picker.query.trim()) picker.setOpen(true); }}
                  onKeyDown={picker.handleKeyDown}
                  placeholder="Type to find a saved customer…"
                />
                {picker.open && picker.query.trim() && (
                  <div
                    role="listbox"
                    id="customer-picker-listbox"
                    className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-72 overflow-y-auto"
                  >
                    {picker.visibleCustomers.map((c, i) => (
                      // allow-raw-html: WAI-ARIA combobox option needs full styling control (custom dropdown row, not a CTA button)
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        id={`customer-option-${c.id}`}
                        aria-selected={i === picker.activeIndex}
                        onClick={() => { picker.pick(c); }}
                        onMouseEnter={() => picker.setActiveIndex(i)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-700 focus:bg-slate-700 focus:outline-none min-h-[44px] ${
                          i === picker.activeIndex ? 'bg-blue-500/10 text-blue-300' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-white">{c.name || '(no name)'}</div>
                        <div className="text-xs text-slate-400">
                          {[c.email, c.company].filter(Boolean).join(' · ')}
                        </div>
                      </button>
                    ))}
                    {picker.filteredCustomers.length > PICKER_VISIBLE_LIMIT && (
                      <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700">
                        Showing first {PICKER_VISIBLE_LIMIT} of {picker.filteredCustomers.length} matches — refine your search
                      </div>
                    )}
                    {picker.filteredCustomers.length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        No saved customers match "{picker.query}". The customer will be saved when you record the sale.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label htmlFor={saleCustomerNameId} className="block text-xs text-slate-400 mb-1">Name</label>
                  <Input
                    id={saleCustomerNameId}
                    type="text"
                    value={saleCustomerName}
                    onChange={e => setSaleCustomerName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label htmlFor={saleCustomerEmailId} className="block text-xs text-slate-400 mb-1">Email</label>
                  <Input
                    id={saleCustomerEmailId}
                    type="email"
                    value={saleCustomerEmail}
                    onChange={e => setSaleCustomerEmail(e.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor={saleCustomerCompanyId} className="block text-xs text-slate-400 mb-1">Company</label>
                <Input
                  id={saleCustomerCompanyId}
                  type="text"
                  value={saleCustomerCompany}
                  onChange={e => setSaleCustomerCompany(e.target.value)}
                  placeholder="Acme LLC"
                />
              </div>
              <div>
                <label htmlFor={saleCustomerAddressId} className="block text-xs text-slate-400 mb-1">Address</label>
                <Textarea
                  id={saleCustomerAddressId}
                  rows={2}
                  value={saleCustomerAddress}
                  onChange={e => setSaleCustomerAddress(e.target.value)}
                  placeholder="Shipping address or pickup location"
                />
              </div>
              <div>
                <label htmlFor={saleCustomerNotesId} className="block text-xs text-slate-400 mb-1">Notes</label>
                <Textarea
                  id={saleCustomerNotesId}
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
                <label htmlFor={saleShippingMethodId} className="block text-xs text-slate-400 mb-1">Method</label>
                <Select
                  id={saleShippingMethodId}
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
                <label htmlFor={saleShippingCostId} className="block text-xs text-slate-400 mb-1">Cost ({getCurrencySymbol(userCurrency)})</label>
                <Input
                  id={saleShippingCostId}
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
              <span className="font-mono">{formatCurrency(saleQuantity * salePrice, userCurrency)}</span>
            </div>
            {saleShippingCost > 0 && (
              <div className="flex justify-between text-sm text-slate-400">
                <span>+ Shipping Charged</span>
                <span className="font-mono">{formatCurrency(saleShippingCost, userCurrency)}</span>
              </div>
            )}
            {marketplaceFee > 0 && (
              <div className="flex justify-between text-sm text-orange-400">
                <span>- Marketplace Fee</span>
                <span className="font-mono">-{formatCurrency(marketplaceFee, userCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-semibold pt-2 border-t border-slate-600">
              <span>Net Revenue</span>
              <span className="font-mono">
                {formatCurrency((saleQuantity * salePrice) + saleShippingCost - marketplaceFee, userCurrency)}
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
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
