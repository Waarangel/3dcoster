import { useEffect, useId, useMemo, useState, useCallback } from 'react';
import type { PrintJob, UserProfile, Quote, Customer, ShippingConfig } from '../types';
import { useQuotes, useCustomers } from '../hooks/useDatabase';
import { useCustomerPicker, PICKER_VISIBLE_LIMIT } from '../hooks/useCustomerPicker';
import { resolveTaxRate, taxLabelFor } from '../utils/taxResolution';
import { formatCurrency } from '../utils/currency';
import { calculateTax } from '../utils/costCalc';
import { computeJobShipping } from '../utils/jobShipping';
import { Button, Input, Textarea, InfoTooltip, Modal } from './ui';
import { formatQuoteNumber } from '../utils/format';

// ---------------------------------------------------------------------------
// PrintQuoteModal — Phase 16 gap closure (D-16 + D-18).
//
// SOLE entry point for creating a Quote in the runtime. Replaces JobsManager's
// prior silent most-recent-sale fallback. Mirrors Phase 15.1's customer picker
// pattern (WAI-ARIA combobox; ArrowDown/Up/Enter/Escape/Tab handling).
//
// ARCHITECTURAL LOCK (WARNING I-07 Option B):
// This component is Dexie-agnostic. It does NOT import `db`, does NOT import
// `setUserProfile as dbSetUserProfile`, does NOT open any Dexie transaction.
// All multi-store writes (Quote.add + Customer.add/update + nextQuoteNumber
// bump) flow through `createQuote` from the useQuotes hook, which owns the
// single `rw` transaction over ['quotes', 'customers', 'settings'].
//
// G6 LOCK (BLOCKER I-03): the Quote payload constructed inside createQuote is
// typed `status: RuntimeQuoteStatus` (the narrow enum excluding 'draft') so
// TypeScript REFUSES `'draft'` at the call site. End-to-end compile-time
// enforcement, not JSDoc convention.
// ---------------------------------------------------------------------------

export interface PrintQuoteModalProps {
  job: PrintJob;
  userProfile: UserProfile;
  /** Shipping config so create-mode can pre-fill Shipping cost from the job's stored shipping inputs (method/distance/override). */
  shippingConfig: ShippingConfig;
  isOpen: boolean;
  onClose: () => void;
  onQuoteCreated?: (quote: Quote) => void;
  /**
   * Second extension D-27: when set, the modal opens in EDIT mode for this
   * Quote. Pre-fills customer + shipping from the Quote snapshot. On Save:
   * updates the Quote via updateQuote (does NOT bump nextQuoteNumber) and
   * re-downloads the PDF. The modal title flips to "Edit Quote".
   *
   * Only Pending quotes (status='sent') should be passed here — editing a
   * converted Sale's quote doesn't make sense (the Sale was already created
   * from that snapshot). The JobsManager overflow menu only exposes Edit
   * Quote on Pending rows.
   */
  editingQuote?: Quote;
}

export function PrintQuoteModal({ job, userProfile, shippingConfig, isOpen, onClose, onQuoteCreated, editingQuote }: PrintQuoteModalProps) {
  const { customers, customersByEmail } = useCustomers();
  const { createQuote, updateQuote } = useQuotes();

  const isEdit = editingQuote !== undefined;

  // ─── State ────────────────────────────────────────────────────────────────
  const [quoteCustomerName, setQuoteCustomerName] = useState('');
  const [quoteCustomerEmail, setQuoteCustomerEmail] = useState('');
  const [quoteCustomerCompany, setQuoteCustomerCompany] = useState('');
  const [quoteCustomerAddress, setQuoteCustomerAddress] = useState('');
  const [quoteShippingCost, setQuoteShippingCost] = useState<number>(0);

  // Picker state migrated to useCustomerPicker hook (plan 22-03 / HYG-08).
  // The prior input ref was dead code (wired but never .focus()'d) — removed
  // per Open Question 2 / IN-06 alignment.

  // Captured when the picker's onPick callback fires. Passed to createQuote as
  // existingCustomerId so the hook bumps lastUsedAt on that record. Cleared
  // when the picker query is cleared so a typed-over email re-runs through
  // the email-match dedup path instead of forcing a stale library link.
  // RESEARCH Pitfall 1 lock: this is a PrintQuoteModal-only concept and MUST
  // NOT be migrated into the useCustomerPicker hook (the hook is consumer-
  // agnostic; pickedExistingCustomerId is library-link state).
  const [pickedExistingCustomerId, setPickedExistingCustomerId] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Stable ids for label/input pairing (A11Y C-02) ───────────────────────
  const quoteCustomerNameId = useId();
  const quoteCustomerEmailId = useId();
  const quoteCustomerCompanyId = useId();
  const quoteCustomerAddressId = useId();

  // ─── Picker integration (plan 22-03 / HYG-08) ────────────────────────────
  // handlePickCustomer fills the 4 quote-customer form fields AND captures
  // pickedExistingCustomerId — the latter is the PrintQuoteModal-specific
  // library-link slot that MUST NOT migrate into the hook (RESEARCH Pitfall 1).
  // The hook's internal pick() handles the query/open/activeIndex reset.
  const handlePickCustomer = useCallback((c: Customer) => {
    setQuoteCustomerName(c.name ?? '');
    setQuoteCustomerEmail(c.email ?? '');
    setQuoteCustomerCompany(c.company ?? '');
    setQuoteCustomerAddress(c.address ?? '');
    setPickedExistingCustomerId(c.id);  // PrintQuoteModal-only library link
  }, []);

  const picker = useCustomerPicker(customers, { onPick: handlePickCustomer });

  // ─── Effects ──────────────────────────────────────────────────────────────
  // Reset state on open. In CREATE mode, fields are blank; in EDIT mode (D-27),
  // they hydrate from editingQuote's snapshot so the user can adjust + re-send.
  useEffect(() => {
    if (isOpen) {
      if (editingQuote) {
        setQuoteCustomerName(editingQuote.customerSnapshot.name ?? '');
        setQuoteCustomerEmail(editingQuote.customerSnapshot.email ?? '');
        setQuoteCustomerCompany(editingQuote.customerSnapshot.company ?? '');
        setQuoteCustomerAddress(editingQuote.customerSnapshot.address ?? '');
        setQuoteShippingCost(editingQuote.lineItemsSnapshot.shippingCost);
        // If the Quote already has a customerId, treat it as a stale picked link
        // so the next Save re-bumps lastUsedAt on that record (and email-typed-over
        // re-runs through dedup).
        setPickedExistingCustomerId(editingQuote.customerId ?? null);
      } else {
        setQuoteCustomerName('');
        setQuoteCustomerEmail('');
        setQuoteCustomerCompany('');
        setQuoteCustomerAddress('');
        // Pre-fill shipping from the job's saved shipping inputs (method, distance,
        // override) so the user doesn't have to retype data that's already on the job.
        // User can still edit the field manually if they want a different quoted price.
        setQuoteShippingCost(computeJobShipping(job, shippingConfig));
        setPickedExistingCustomerId(null);
      }
      picker.reset();
      setIsGenerating(false);
      setError(null);
    }
    // picker.reset is stable per useCallback in useCustomerPicker; exclude
    // from deps to avoid re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingQuote, job, shippingConfig]);

  // ─── Live totals memoization ─────────────────────────────────────────────
  const resolvedTax = useMemo(
    () => resolveTaxRate({
      jobOverride: job.taxRate,
      settingsDefault: userProfile.defaultTaxRate,
      currency: userProfile.currency,
      address: userProfile.address,
    }),
    [job.taxRate, userProfile.defaultTaxRate, userProfile.currency, userProfile.address]
  );

  const subtotal = job.sellingPrice;
  // D-22: tax base is sellingPrice ONLY — shipping is NEVER in the base.
  // Phase 17 D-03: route through calculateTax helper for byte-identical rounding
  // parity with CostCalculator.tsx (TAX-05 lock — Math.round(price * rate) / 100).
  const taxAmount = useMemo(
    () => calculateTax(subtotal, resolvedTax.rate).taxAmount,
    [subtotal, resolvedTax.rate]
  );
  const total = subtotal + quoteShippingCost + taxAmount;

  const taxLabel = useMemo(
    () => taxLabelFor(userProfile.address?.country),
    [userProfile.address?.country]
  );

  // ─── Generate Quote handler ─────────────────────────────────────────────
  const validationOK = quoteCustomerName.trim() !== '' || quoteCustomerEmail.trim() !== '';
  const shippingOK = quoteShippingCost >= 0 && Number.isFinite(quoteShippingCost);
  const generateDisabled = !validationOK || !shippingOK || isGenerating;

  const handleGenerateQuote = async () => {
    setError(null);
    if (!validationOK) {
      setError('Customer name or email is required.');
      return;
    }
    if (!shippingOK) {
      setError('Shipping cost must be a non-negative number.');
      return;
    }
    setIsGenerating(true);
    try {
      const customerSnapshot = {
        name: quoteCustomerName.trim() || undefined,
        email: quoteCustomerEmail.trim() || undefined,
        company: quoteCustomerCompany.trim() || undefined,
        address: quoteCustomerAddress.trim() || undefined,
      };

      // Email-match dedup ahead of the call so createQuote can bump lastUsedAt
      // on the resolved record (whether explicitly picked or typed-as-match).
      const trimmedEmail = (quoteCustomerEmail || '').trim().toLowerCase();
      const existingByEmail = trimmedEmail ? customersByEmail.get(trimmedEmail) : undefined;
      const existingCustomerId = pickedExistingCustomerId ?? existingByEmail?.id;

      let quote: Quote;
      if (editingQuote) {
        // EDIT mode (D-27): mutate the existing Quote in place. NO counter
        // bump — the Quote keeps its quoteNumber. Customer auto-create/
        // bump is intentionally skipped here too; library hygiene happens
        // at create time. updateQuote is bound to db.quotes.put.
        quote = {
          ...editingQuote,
          customerId: existingCustomerId,
          customerSnapshot,
          lineItemsSnapshot: {
            ...editingQuote.lineItemsSnapshot,
            jobTitle: job.name,
            sellingPrice: job.sellingPrice,
            shippingCost: quoteShippingCost,
            resolvedTaxRate: resolvedTax.rate,
            taxAmount,
            currency: userProfile.currency,
            notes: job.notes ?? '',
            terms: userProfile.defaultTerms ?? '',
            countryAtSendTime: userProfile.address?.country,
          },
        };
        await updateQuote(quote);
      } else {
        // CREATE mode: single await wraps the entire Dexie multi-store
        // transaction inside the createQuote hook action.
        quote = await createQuote({
          job,
          userProfile,
          customerSnapshot,
          existingCustomerId,
          shippingCost: quoteShippingCost,
          resolvedTaxRate: resolvedTax.rate,
          taxAmount,
        });
      }

      // Re-download the PDF in both modes (D-27 explicit for edit; existing
      // for create). Tauri shows the native save dialog; web triggers
      // the browser download.
      const { generateQuotePdf } = await import('../pdf/generateQuotePdf');
      await generateQuotePdf(quote);

      onQuoteCreated?.(quote);
      onClose();
    } catch (err) {
      console.error('Quote generation failed:', err);
      setError(err instanceof Error ? err.message : 'Could not generate quote.');
    } finally {
      setIsGenerating(false);
    }
  };

  const showShippingRow = quoteShippingCost > 0;
  const showTaxRow = resolvedTax.rate > 0 && taxAmount > 0;

  // WR-06 fix: dropped the dead `editingQuote ? ... : ''` inner ternary
  // (impossible state — isEdit was derived from editingQuote in the same
  // render pass) and routed the quoteNumber formatting through the existing
  // `formatQuoteNumber` helper for consistency with PDF generation and
  // DeclineQuoteModal. Quote.quoteNumber is REQUIRED at the type level
  // (types.ts:226), so the formatter receives a real number.
  const modalTitle = editingQuote
    ? `Edit Quote ${formatQuoteNumber(editingQuote.quoteNumber)} — ${job.name}`
    : `Create Quote — ${job.name}`;

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="lg">
      <div className="p-4 space-y-4">
          {/* Customer picker — WAI-ARIA combobox (mirrors Phase 15.1-04 pattern) */}
          <div className="relative">
            <label className="block text-sm text-slate-400 mb-1" htmlFor="print-quote-customer-picker">
              Existing customer (optional)
            </label>
            <Input
              id="print-quote-customer-picker"
              type="text"
              role="combobox"
              aria-expanded={picker.open}
              aria-controls="print-quote-picker-listbox"
              aria-autocomplete="list"
              aria-activedescendant={
                picker.open && picker.visibleCustomers[picker.activeIndex]
                  ? `print-quote-option-${picker.visibleCustomers[picker.activeIndex].id}`
                  : undefined
              }
              value={picker.query}
              onChange={(e) => {
                picker.setQuery(e.target.value);
                picker.setOpen(true);
                picker.setActiveIndex(0);
                // Clear stale picked-id once the user starts typing again — keeps the
                // email-match dedup honest if they typed over a previously-picked match.
                if (pickedExistingCustomerId) setPickedExistingCustomerId(null);
              }}
              onFocus={() => { if (picker.query.trim()) picker.setOpen(true); }}
              onKeyDown={picker.handleKeyDown}
              placeholder="Type to find a saved customer…"
            />
            {picker.open && picker.query.trim() && (
              <div
                role="listbox"
                id="print-quote-picker-listbox"
                className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-72 overflow-y-auto"
              >
                {picker.visibleCustomers.map((c, i) => (
                  // allow-raw-html: WAI-ARIA combobox option needs full styling control
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    id={`print-quote-option-${c.id}`}
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
                    No saved customers match "{picker.query}". The customer will be saved with this quote.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4 customer fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label htmlFor={quoteCustomerNameId} className="block text-xs text-slate-400 mb-1">Name</label>
              <Input
                id={quoteCustomerNameId}
                type="text"
                value={quoteCustomerName}
                onChange={(e) => setQuoteCustomerName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label htmlFor={quoteCustomerEmailId} className="block text-xs text-slate-400 mb-1">Email</label>
              <Input
                id={quoteCustomerEmailId}
                type="email"
                value={quoteCustomerEmail}
                onChange={(e) => setQuoteCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label htmlFor={quoteCustomerCompanyId} className="block text-xs text-slate-400 mb-1">Company</label>
              <Input
                id={quoteCustomerCompanyId}
                type="text"
                value={quoteCustomerCompany}
                onChange={(e) => setQuoteCustomerCompany(e.target.value)}
                placeholder="Acme Co."
              />
            </div>
            <div>
              <label htmlFor={quoteCustomerAddressId} className="block text-xs text-slate-400 mb-1">Address</label>
              <Textarea
                id={quoteCustomerAddressId}
                rows={2}
                value={quoteCustomerAddress}
                onChange={(e) => setQuoteCustomerAddress(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">Provide at least Name or Email.</p>

          {/* Shipping input — compact + InfoTooltip per CLAUDE.md narrow-currency-inputs rule */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 inline-flex items-center gap-1" htmlFor="print-quote-shipping">
              Shipping cost (optional)
              <InfoTooltip text="Shipping is added to Total but is NOT taxed (per v1.2)." />
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="print-quote-shipping"
                type="number"
                min="0"
                step="0.01"
                inputSize="md"
                compact
                value={quoteShippingCost === 0 ? '' : String(quoteShippingCost)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setQuoteShippingCost(Number.isFinite(v) && v >= 0 ? v : 0);
                }}
                placeholder="0.00"
              />
              <span className="text-xs text-slate-400">{userProfile.currency}</span>
            </div>
          </div>

          {/* Live totals preview */}
          <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Subtotal</dt>
                <dd className="text-slate-100">{formatCurrency(subtotal, userProfile.currency)}</dd>
              </div>
              {showShippingRow && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">Shipping</dt>
                  <dd className="text-slate-100">{formatCurrency(quoteShippingCost, userProfile.currency)}</dd>
                </div>
              )}
              {showTaxRow && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">{taxLabel} ({resolvedTax.rate}%)</dt>
                  <dd className="text-slate-100">{formatCurrency(taxAmount, userProfile.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-slate-700">
                <dt className="text-slate-300 font-semibold">Total</dt>
                <dd className="text-white font-semibold">{formatCurrency(total, userProfile.currency)}</dd>
              </div>
            </dl>
          </div>

          {/* Error block */}
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 pt-2 border-t border-slate-700">
          <Button variant="secondary" btnSize="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            btnSize="md"
            onClick={() => { void handleGenerateQuote(); }}
            disabled={generateDisabled}
          >
            {isGenerating ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save & Re-download' : 'Create Quote')}
          </Button>
        </div>
    </Modal>
  );
}
