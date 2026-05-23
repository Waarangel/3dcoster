import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { PrintJob, UserProfile, Quote, Customer } from '../types';
import { useQuotes, useCustomers } from '../hooks/useDatabase';
import { resolveTaxRate, taxLabelFor } from '../utils/taxResolution';
import { formatCurrency } from '../utils/currency';
import { Button, Input, Textarea, InfoTooltip } from './ui';

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

const PICKER_VISIBLE_LIMIT = 8;

export interface PrintQuoteModalProps {
  job: PrintJob;
  userProfile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onQuoteCreated: (quote: Quote) => void;
}

export function PrintQuoteModal({ job, userProfile, isOpen, onClose, onQuoteCreated }: PrintQuoteModalProps) {
  const { customers, customersByEmail } = useCustomers();
  const { createQuote } = useQuotes();

  // ─── State ────────────────────────────────────────────────────────────────
  const [quoteCustomerName, setQuoteCustomerName] = useState('');
  const [quoteCustomerEmail, setQuoteCustomerEmail] = useState('');
  const [quoteCustomerCompany, setQuoteCustomerCompany] = useState('');
  const [quoteCustomerAddress, setQuoteCustomerAddress] = useState('');
  const [quoteShippingCost, setQuoteShippingCost] = useState<number>(0);

  // Picker triplet (mirrors 15.1-04)
  const [customerPickerQuery, setCustomerPickerQuery] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerPickerActiveIndex, setCustomerPickerActiveIndex] = useState(0);
  const customerPickerInputRef = useRef<HTMLInputElement | null>(null);

  // Captured when handlePickCustomer fires. Passed to createQuote as existingCustomerId
  // so the hook bumps lastUsedAt on that record. Cleared when the picker query is cleared
  // so a typed-over email re-runs through the email-match dedup path instead of forcing
  // a stale library link.
  const [pickedExistingCustomerId, setPickedExistingCustomerId] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Effects ──────────────────────────────────────────────────────────────
  // Reset state on open (fresh-form every time).
  useEffect(() => {
    if (isOpen) {
      setQuoteCustomerName('');
      setQuoteCustomerEmail('');
      setQuoteCustomerCompany('');
      setQuoteCustomerAddress('');
      setQuoteShippingCost(0);
      setCustomerPickerQuery('');
      setCustomerPickerOpen(false);
      setCustomerPickerActiveIndex(0);
      setPickedExistingCustomerId(null);
      setIsGenerating(false);
      setError(null);
    }
  }, [isOpen]);

  // Close on Escape (mirrors CustomerEditModal).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ─── Picker logic (mirror 15.1-04 verbatim) ──────────────────────────────
  const filteredCustomers = useMemo<Customer[]>(() => {
    const q = customerPickerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, customerPickerQuery]);

  const visibleCustomers = useMemo<Customer[]>(
    () => filteredCustomers.slice(0, PICKER_VISIBLE_LIMIT),
    [filteredCustomers]
  );

  const handlePickCustomer = useCallback((c: Customer) => {
    setQuoteCustomerName(c.name ?? '');
    setQuoteCustomerEmail(c.email ?? '');
    setQuoteCustomerCompany(c.company ?? '');
    setQuoteCustomerAddress(c.address ?? '');
    setPickedExistingCustomerId(c.id);
    setCustomerPickerQuery('');
    setCustomerPickerOpen(false);
    setCustomerPickerActiveIndex(0);
  }, []);

  const handlePickerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleCustomers.length === 0) return;
      if (!customerPickerOpen) {
        setCustomerPickerOpen(true);
        setCustomerPickerActiveIndex(0);
      } else {
        setCustomerPickerActiveIndex(i => (i + 1) % visibleCustomers.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCustomerPickerActiveIndex(i =>
        visibleCustomers.length === 0 ? 0 : (i - 1 + visibleCustomers.length) % visibleCustomers.length
      );
    } else if (e.key === 'Enter') {
      if (customerPickerOpen) {
        const picked = visibleCustomers[customerPickerActiveIndex];
        if (picked) {
          e.preventDefault();
          void handlePickCustomer(picked);
        } else if (customerPickerQuery.trim()) {
          e.preventDefault();
          setCustomerPickerOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      if (customerPickerOpen) {
        e.preventDefault();
        e.stopPropagation();  // don't bubble to the modal's Esc-close handler
        setCustomerPickerOpen(false);
      }
    } else if (e.key === 'Tab') {
      setCustomerPickerOpen(false);
    }
  }, [customerPickerOpen, customerPickerActiveIndex, customerPickerQuery, visibleCustomers, handlePickCustomer]);

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
  const taxAmount = useMemo(
    () => subtotal * (resolvedTax.rate / 100),
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

      // Single await wraps the entire Dexie multi-store transaction inside the hook.
      const quote = await createQuote({
        job,
        userProfile,
        customerSnapshot,
        existingCustomerId,
        shippingCost: quoteShippingCost,
        resolvedTaxRate: resolvedTax.rate,
        taxAmount,
      });

      // Generate the PDF AFTER the Quote is persisted so the download is keyed off
      // the freshly-written record (Quote.quoteNumber is now guaranteed present).
      const { generateQuotePdf } = await import('../pdf/generateQuotePdf');
      await generateQuotePdf(quote);

      onQuoteCreated(quote);
      onClose();
    } catch (err) {
      console.error('Quote generation failed:', err);
      setError(err instanceof Error ? err.message : 'Could not generate quote.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const showShippingRow = quoteShippingCost > 0;
  const showTaxRow = resolvedTax.rate > 0 && taxAmount > 0;

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Print Quote — {job.name}</h3>
          <Button variant="ghost" btnSize="sm" onClick={onClose} aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Customer picker — WAI-ARIA combobox (mirrors Phase 15.1-04 pattern) */}
          <div className="relative">
            <label className="block text-sm text-slate-400 mb-1" htmlFor="print-quote-customer-picker">
              Existing customer (optional)
            </label>
            <Input
              id="print-quote-customer-picker"
              ref={customerPickerInputRef}
              type="text"
              role="combobox"
              aria-expanded={customerPickerOpen}
              aria-controls="print-quote-picker-listbox"
              aria-autocomplete="list"
              aria-activedescendant={
                customerPickerOpen && visibleCustomers[customerPickerActiveIndex]
                  ? `print-quote-option-${visibleCustomers[customerPickerActiveIndex].id}`
                  : undefined
              }
              value={customerPickerQuery}
              onChange={(e) => {
                setCustomerPickerQuery(e.target.value);
                setCustomerPickerOpen(true);
                setCustomerPickerActiveIndex(0);
                // Clear stale picked-id once the user starts typing again — keeps the
                // email-match dedup honest if they typed over a previously-picked match.
                if (pickedExistingCustomerId) setPickedExistingCustomerId(null);
              }}
              onFocus={() => { if (customerPickerQuery.trim()) setCustomerPickerOpen(true); }}
              onKeyDown={handlePickerKeyDown}
              placeholder="Type to find a saved customer…"
            />
            {customerPickerOpen && customerPickerQuery.trim() && (
              <div
                role="listbox"
                id="print-quote-picker-listbox"
                className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-72 overflow-y-auto"
              >
                {visibleCustomers.map((c, i) => (
                  // allow-raw-html: WAI-ARIA combobox option needs full styling control
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    id={`print-quote-option-${c.id}`}
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
                {filteredCustomers.length > PICKER_VISIBLE_LIMIT && (
                  <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700">
                    Showing first {PICKER_VISIBLE_LIMIT} of {filteredCustomers.length} matches — refine your search
                  </div>
                )}
                {filteredCustomers.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    No saved customers match "{customerPickerQuery}". The customer will be saved with this quote.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4 customer fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <Input
                type="text"
                value={quoteCustomerName}
                onChange={(e) => setQuoteCustomerName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <Input
                type="email"
                value={quoteCustomerEmail}
                onChange={(e) => setQuoteCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Company</label>
              <Input
                type="text"
                value={quoteCustomerCompany}
                onChange={(e) => setQuoteCustomerCompany(e.target.value)}
                placeholder="Acme Co."
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Address</label>
              <Textarea
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
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-400">
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
            {isGenerating ? 'Generating…' : 'Generate Quote'}
          </Button>
        </div>
      </div>
    </div>
  );
}
