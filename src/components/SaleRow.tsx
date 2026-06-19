import type { Sale, Currency } from '../types';
import { EditButton, DeleteButton } from './ui';
import { useQuotes } from '../hooks/useDatabase';
import { formatQuoteNumber } from '../utils/format';
import { formatRelativeDate } from '../utils/formatRelativeDate';
import { formatCurrency } from '../utils/currency';

/**
 * Informational text rendered next to a Sale's customer name when the
 * Sale was created via Convert to Sale (D-30). Replaces the prior
 * SaleBackRefLink clickable button — per user direction, this is purely
 * informational ("when was the quote last created"), not interactive.
 *
 * Exported so unit tests can mount it directly. Phase 22 plan 22-04 (D-13)
 * relocated this from JobsManager.tsx to live next to its only consumer
 * (the <SaleRow> accordion below).
 */
export function SaleFromQuoteSubtext({ convertedFromQuoteId, jobId }: { convertedFromQuoteId: string; jobId: string }) {
  const { quotesByJobId } = useQuotes();
  const linkedQuote = quotesByJobId.get(jobId)?.find(q => q.id === convertedFromQuoteId);
  if (!linkedQuote) return null;  // data anomaly — render nothing
  return (
    <span className="ml-2 text-xs text-slate-400">
      from {formatQuoteNumber(linkedQuote.quoteNumber)} · Quoted {formatRelativeDate(new Date(linkedQuote.sentAt))}
    </span>
  );
}

interface SaleRowProps {
  sale: Sale;
  jobId: string;
  /** Fallback currency for legacy sales whose snapshot `currency` is unset. */
  userCurrency: Currency;
  onEdit: (s: Sale) => void;
  onDelete: (s: Sale) => void;
}

/**
 * Per-sale `<details>` accordion row, extracted from JobCard's recentSales
 * map body (Phase 22 plan 22-04, HYG-07, D-11/D-12/D-14). Sibling-not-generic
 * component matching the <QuoteRow> precedent — purely presentational, with
 * the parent supplying onEdit/onDelete callbacks.
 *
 * Visual contract preserved verbatim: native `<details>` accordion, hidden
 * webkit details-marker, rotating chevron via group-open:rotate-90, customer
 * block body with legacy `sale.customerName` fallback per Phase 14 D-21.
 */
export function SaleRow({ sale, jobId, userCurrency, onEdit, onDelete }: SaleRowProps) {
  const saleCurrency = sale.currency ?? userCurrency;
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
  const unitPriceLabel = formatCurrency(sale.unitPrice, saleCurrency);
  const summaryLabel = saleCustomerName
    ? `${sale.quantity}x @ ${unitPriceLabel} (${saleCustomerName})`
    : `${sale.quantity}x @ ${unitPriceLabel}`;
  return (
    <details
      className="text-sm text-slate-400 bg-slate-800 px-3 py-2 rounded group"
      onClick={e => e.stopPropagation()}
    >
      <summary className="flex justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="text-xs text-slate-500 group-open:rotate-90 transition-transform">▸</span>
          {summaryLabel}
          {/* D-30: informational subtext (NOT clickable). Replaces the prior SaleBackRefLink button. */}
          {sale.convertedFromQuoteId && (
            <SaleFromQuoteSubtext convertedFromQuoteId={sale.convertedFromQuoteId} jobId={jobId} />
          )}
        </span>
        <span className="font-mono">{formatCurrency(sale.totalRevenue, saleCurrency)}</span>
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
          <EditButton
            label={saleCustomerName ? `sale for ${saleCustomerName}` : 'sale'}
            onClick={e => { e.stopPropagation(); onEdit(sale); }}
          />
          <DeleteButton
            label={saleCustomerName ? `sale for ${saleCustomerName}` : 'sale'}
            onClick={e => { e.stopPropagation(); onDelete(sale); }}
          />
        </div>
      </div>
    </details>
  );
}
