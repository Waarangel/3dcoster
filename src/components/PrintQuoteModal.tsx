import { useEffect, useId, useMemo, useState, useCallback } from 'react';
import type { PrintJob, UserProfile, Quote, Customer, ShippingConfig } from '../types';
import { useQuotes, useCustomers } from '../hooks/useDatabase';
import { useCustomerPicker, PICKER_VISIBLE_LIMIT } from '../hooks/useCustomerPicker';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { resolveTaxRate, taxLabelFor } from '../utils/taxResolution';
import { formatCurrency } from '../utils/currency';
import { calculateTax } from '../utils/costCalc';
import { computeJobShipping } from '../utils/jobShipping';
import { Button, Input, Textarea, InfoTooltip, Modal } from './ui';
import { formatQuoteNumber } from '../utils/format';
import { usePublishedQuote } from '../hooks/usePublishedQuote';
import { useEntitlement } from '../hooks/useEntitlement';
import { ShareQuoteButton } from './pro/ShareQuoteButton';
import { useSupportNudge } from './SupportNudge';
import type { QuoteBranding } from '../pdf/generateQuotePdf';

// ---------------------------------------------------------------------------
// CONN-03 Quantity variants (D-05..D-08). Three fixed tier slots, defaulting
// 1/10/50 quantity and 0% discount. Tier math is maker-controlled per-tier
// discount % — explicitly NOT cost-amortization-at-quantity (D-06).
// ---------------------------------------------------------------------------
const DEFAULT_VARIANT_QUANTITIES = [1, 10, 50];
const DEFAULT_VARIANT_DISCOUNTS = [0, 0, 0];
const VARIANT_DISCOUNT_DEFAULTS_KEY = 'printQuoteModal.variantDiscountDefaults';

function clampDiscountPercent(v: number): number {
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
}

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
  // Phase 43-04 (PRO-02): Share/Unpublish for the quote currently being
  // edited. D-13: only edit-mode has an already-created Quote to publish —
  // create-mode's Quote doesn't exist yet until Create Quote is clicked.
  const { publish: publishQuote, unpublish: unpublishQuote } = usePublishedQuote(
    userProfile.name,
    userProfile.logoDataUrl,
    updateQuote,
  );
  // Phase 46-04 (D-04/D-05/D-06/D-07): live entitlement drives the PDF
  // white-label branding injected below — safe to call unconditionally
  // (no-op/not-Pro when Supabase is null; cache-backed for offline Pro users).
  const { isPro } = useEntitlement();
  // Phase 45 D-03: calm value-moment Pro nudge, self-gated (cooldown + once
  // per session) — safe to call unconditionally on the quote-CREATE path.
  const showSupportNudge = useSupportNudge();

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

  // ─── Quantity variants state (CONN-03 D-05..D-08) ────────────────────────
  // variantsEnabled + quantities reset per quote (create) or hydrate from the
  // Quote snapshot (edit). discountsPercent persists as the maker's last-used
  // default across quotes via localStorage (D-06) — no new Dexie store.
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantQuantities, setVariantQuantities] = useState<number[]>(DEFAULT_VARIANT_QUANTITIES);
  const [variantDiscountsPercent, setVariantDiscountsPercent] = useLocalStorage<number[]>(
    VARIANT_DISCOUNT_DEFAULTS_KEY,
    DEFAULT_VARIANT_DISCOUNTS,
  );

  // ─── Stable ids for label/input pairing (A11Y C-02) ───────────────────────
  const quoteCustomerNameId = useId();
  const quoteCustomerEmailId = useId();
  const quoteCustomerCompanyId = useId();
  const quoteCustomerAddressId = useId();
  const variantsToggleId = useId();

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
        // CONN-03 D-08: hydrate the variants section from the Quote's own
        // by-value snapshot (not the persisted discount defaults) so editing
        // an existing variant quote shows its actual saved quantities/discounts.
        if (editingQuote.variantsSnapshot) {
          setVariantsEnabled(true);
          setVariantQuantities(editingQuote.variantsSnapshot.quantities);
          setVariantDiscountsPercent(editingQuote.variantsSnapshot.discountsPercent);
        } else {
          setVariantsEnabled(false);
          setVariantQuantities(DEFAULT_VARIANT_QUANTITIES);
        }
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
        // CONN-03: fresh quote starts with variants off and default quantities;
        // discount defaults intentionally carry over from the last quote (D-06).
        setVariantsEnabled(false);
        setVariantQuantities(DEFAULT_VARIANT_QUANTITIES);
      }
      picker.reset();
      setIsGenerating(false);
      setError(null);
    }
    // picker.reset is stable per useCallback in useCustomerPicker; setVariantDiscountsPercent
    // is stable per useLocalStorage's setState identity; exclude both from deps to avoid
    // re-running on every render.
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

  // ─── Quantity variants derivation (CONN-03 D-06) ─────────────────────────
  // unitPrice[i] = job.sellingPrice × (1 − clamp(discount%, 0, 100)/100).
  // Maker-controlled discount — explicitly NOT cost-amortization-at-quantity;
  // never touches calculateCost/priceFromMargin.
  const variantUnitPrices = useMemo(
    () => variantQuantities.map((_, i) =>
      job.sellingPrice * (1 - clampDiscountPercent(variantDiscountsPercent[i] ?? 0) / 100)
    ),
    [variantQuantities, variantDiscountsPercent, job.sellingPrice]
  );

  const handleVariantQuantityChange = useCallback((index: number, raw: string) => {
    const v = parseInt(raw, 10);
    setVariantQuantities(prev => prev.map((q, i) => (i === index ? (Number.isFinite(v) && v >= 0 ? v : q) : q)));
  }, []);

  const handleVariantDiscountChange = useCallback((index: number, raw: string) => {
    const v = parseFloat(raw);
    const clamped = clampDiscountPercent(Number.isFinite(v) ? v : 0);
    setVariantDiscountsPercent(prev => prev.map((d, i) => (i === index ? clamped : d)));
  }, [setVariantDiscountsPercent]);
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

      // CONN-03 D-08: by-value snapshot computed HERE at Generate time — never
      // recomputed at render time. Absent (undefined) when the section is
      // disabled, so a single-tier quote carries no variantsSnapshot at all.
      const variantsSnapshot: Quote['variantsSnapshot'] = variantsEnabled
        ? {
            quantities: [...variantQuantities],
            discountsPercent: [...variantDiscountsPercent],
            unitPrices: [...variantUnitPrices],
            currency: userProfile.currency,
          }
        : undefined;

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
          variantsSnapshot,
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
          variantsSnapshot,
        });
      }

      // Re-download the PDF in both modes (D-27 explicit for edit; existing
      // for create). Tauri shows the native save dialog; web triggers
      // the browser download.
      //
      // D-10 white-label injection: branding is built HERE from LIVE
      // entitlement + userProfile (dependency injection, mirrors the
      // usePublishedQuote(userProfile.name, ...) injection above) — the
      // generator itself never reads UserProfile/Dexie. Live entitlement
      // means the PDF reflects Pro status AT DOWNLOAD TIME, not whatever
      // was true when the Quote was created (deliberate PDF-vs-hosted-page
      // asymmetry vs. the frozen hosted-page snapshot).
      const branding: QuoteBranding = {
        isWhiteLabel: isPro,
        logoDataUrl: userProfile.logoDataUrl,
        businessName: userProfile.name,
      };
      const { generateQuotePdf } = await import('../pdf/generateQuotePdf');
      await generateQuotePdf(quote, branding);

      onQuoteCreated?.(quote);
      // Value moment: a NEW quote was created (not an edit) — nudge is self-gated.
      if (!isEdit) showSupportNudge();
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

          {/* Quantity variants — CONN-03 (D-05..D-08) */}
          <div className="pt-3 border-t border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1 text-xs text-slate-400 uppercase tracking-wide">
                <label htmlFor={variantsToggleId}>Quantity variants</label>
                <InfoTooltip text="You set the discount per tier — the app does the arithmetic and remembers your defaults for next time. This is maker-controlled pricing, not a cost calculation." />
              </span>
              {/* allow-raw-html: WAI-ARIA switch — the shared Button primitive's min-h-[44px] would break the toggle-pill visual; no shared Toggle component exists yet */}
              <button
                id={variantsToggleId}
                type="button"
                role="switch"
                aria-checked={variantsEnabled}
                onClick={() => setVariantsEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${variantsEnabled ? 'bg-blue-500' : 'bg-slate-600'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${variantsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {variantsEnabled && (
              <div className="space-y-2 bg-slate-900/40 border border-slate-700 rounded-lg p-3">
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 uppercase tracking-wide">
                  <span>Qty</span>
                  <span>Discount %</span>
                  <span className="col-span-2 text-right">Unit price</span>
                </div>
                {variantQuantities.map((qty, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      inputSize="sm"
                      compact
                      value={qty === 0 ? '' : String(qty)}
                      onChange={(e) => handleVariantQuantityChange(i, e.target.value)}
                      aria-label={`Tier ${i + 1} quantity`}
                    />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      inputSize="sm"
                      compact
                      value={variantDiscountsPercent[i] === 0 ? '' : String(variantDiscountsPercent[i])}
                      onChange={(e) => handleVariantDiscountChange(i, e.target.value)}
                      aria-label={`Tier ${i + 1} discount percent`}
                      placeholder="0"
                    />
                    <span className="col-span-2 text-right text-sm text-slate-100 font-mono">
                      {formatCurrency(variantUnitPrices[i], userProfile.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
        <div className="flex items-center justify-between gap-2 p-4 pt-2 border-t border-slate-700">
          {/* D-13: only edit-mode has an already-created Quote to share — create-mode's Quote doesn't exist until Create Quote is clicked. */}
          <div>
            {editingQuote && (
              <ShareQuoteButton quote={editingQuote} publish={publishQuote} unpublish={unpublishQuote} />
            )}
          </div>
          <div className="flex gap-2">
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
        </div>
    </Modal>
  );
}
