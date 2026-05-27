import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import type { PrintJob, Material, Sale, ShippingConfig, Currency, UserProfile, Quote, QuoteStatus } from '../types';
import { useSales, useAllSales, useQuotes } from '../hooks/useDatabase';
import { db } from '../db/database';
import { Button, Input, EmptyState, Skeleton, shouldShowEmptyState, Modal } from './ui';
import { ClipboardListIcon } from './ui/icons';
import { SearchIcon } from './ui/icons';
import { NewBadge } from './NewBadge';
import { PrintQuoteModal } from './PrintQuoteModal';
import { DeclineQuoteModal } from './DeclineQuoteModal';
import { RecordSaleModal } from './RecordSaleModal';
import { SaleRow } from './SaleRow';
import { formatQuoteNumber } from '../utils/format';
import { formatCurrency } from '../utils/currency';
import { formatRelativeDate } from '../utils/formatRelativeDate';
import { isSafeHttpUrl } from '../utils/urlSecurity';
import { parseTagsInput } from '../db/backfill';

interface JobsManagerProps {
  jobs: PrintJob[];
  isLoading: boolean;
  materials: Material[];
  shippingConfig: ShippingConfig;
  userCurrency: Currency;
  userProfile: UserProfile;
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

// PERF-01 (D-17): pure module-scope break-even calculator. Lifted from the
// in-component `getBreakEvenInfo` useCallback so `breakEvenMap` (D-18) can
// call it without capturing component-scope state. Reads only `job` fields
// and the explicit `salesByJob` arg — no other closures (RESEARCH confirmed).
function computeBreakEvenInfo(
  job: PrintJob,
  salesByJob: Map<string, Sale[]>,
): BreakEvenInfo {
  const jobSales = salesByJob.get(job.id) ?? [];
  const actualRevenue = jobSales.reduce((sum, s) => sum + s.totalRevenue, 0);

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
    isBreakEven: breakEvenCopies !== null && job.copiesSold >= breakEvenCopies,
  };
}

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
  onGeneratePdf: (job: PrintJob) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (sale: Sale) => void;
  /** Phase 16 plan 16-12: when provided, enables the Convert to Sale button on Pending Quotes in the Orders section. */
  onStartConversion?: (quote: Quote) => void;
  /** Phase 16 ext2 D-27: opens PrintQuoteModal in edit mode for the given Pending Quote. */
  onEditQuote?: (quote: Quote) => void;
  /** Phase 16 ext2 D-28: opens DeclineQuoteModal for the given Pending Quote. */
  onDeclineQuote?: (quote: Quote) => void;
  /** Phase 15 Round 2 (Gap E) — whether the title edit-in-place field is open for this row. */
  isEditingTitle: boolean;
  /** Phase 15 Round 2 (Gap E) — open the inline title edit field. */
  onStartEditTitle: (jobId: string) => void;
  /** Phase 15 Round 2 (Gap E) — close the inline title edit field without saving. */
  onCancelEditTitle: () => void;
  /** Phase 15 Round 2 (Gap E) — persist the new (trimmed, empty-guarded) title via db.jobs.put. */
  onSaveTitle: (job: PrintJob, name: string) => Promise<void>;
  /** Phase 15 Round 2 (Gap E) — whether the inline add-tag field is open for this row. */
  isAddingTag: boolean;
  /** Phase 15 Round 2 (Gap E) — open the inline add-tag field at the end of the chip strip. */
  onStartAddTag: (jobId: string) => void;
  /** Phase 15 Round 2 (Gap E) — close the inline add-tag field without committing. */
  onCancelAddTag: () => void;
  /** Phase 15 Round 2 (Gap E) — parse one tag via parseTagsInput, merge-dedupe-cap into job.tags, persist via db.jobs.put. */
  onSubmitAddTag: (job: PrintJob, tagRaw: string) => Promise<void>;
  /** Phase 15 Round 2 (Gap E) — remove a tag from job.tags via db.jobs.put. */
  onRemoveTag: (job: PrintJob, tag: string) => Promise<void>;
  style?: React.CSSProperties;
};

// ---------------------------------------------------------------------------
// Phase 16 second extension — Orders section (D-23..D-32).
//
// Replaces the prior parallel "Recent Quotes" + "Recent Sales" sections with
// a single unified "Orders" section per job. The unified section renders:
//   - Pending Quote rows (action: Convert to Sale + overflow [Edit / Decline])
//   - Declined Quote rows (action: Reopen; shows declineReason sub-line)
//   - Sale rows (existing accordion shape, with `from Q-NNNN` informational
//     subtext if convertedFromQuoteId is set)
// Sorted newest-first by sentAt / soldAt.
//
// Converted Quotes do NOT render as their own row — they're represented by
// their Sale row only (D-26). Legacy 'accepted' rows (pre-extension data)
// render as Pending (D-24).
//
// Each subcomponent calls useQuotes itself; dexie-react-hooks dedupes the
// liveQuery emitter so the per-expanded-card cost is negligible. This keeps
// JobCard's prop chain shallow.
// ---------------------------------------------------------------------------

const QUOTE_PILL_STYLES = {
  // 3 user-facing states per D-24 + 1 legacy mapping
  pending:   { label: 'Pending',   classes: 'bg-amber-700/30 text-amber-300' },
  sale:      { label: 'Sale',      classes: 'bg-emerald-700/30 text-emerald-300' },
  declined:  { label: 'Declined',  classes: 'bg-slate-700 text-slate-200' },
} as const;

type QuotePillKind = keyof typeof QUOTE_PILL_STYLES;

// Quote.status (5-wide enum) → 3-pill mapping per D-24.
// 'sent' and legacy 'accepted' both surface as Pending (the latter only
// appears in pre-second-extension data; runtime no longer writes it).
// 'converted' never appears as a separate row (D-26 — represented by Sale).
// 'draft' is migration-only and filtered out at the section level.
function quoteStatusToPill(status: QuoteStatus): QuotePillKind | null {
  switch (status) {
    case 'sent':
    case 'accepted':
      return 'pending';
    case 'declined':
      return 'declined';
    case 'converted':
    case 'draft':
      return null;  // never rendered as a Quote row
  }
}

function QuoteStatusPill({ kind }: { kind: QuotePillKind }) {
  const { label, classes } = QUOTE_PILL_STYLES[kind];
  return (
    <span
      aria-label={`Status: ${label}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

interface QuoteRowProps {
  quote: Quote;
  pillKind: QuotePillKind;
  onConvert?: () => void;
  onEdit?: () => void;
  onDecline?: () => void;
  onReopen?: () => Promise<void>;
}

function QuoteRow({ quote, pillKind, onConvert, onEdit, onDecline, onReopen }: QuoteRowProps) {
  const customerLabel = quote.customerSnapshot.name || quote.customerSnapshot.email || 'No customer';
  const currency = quote.lineItemsSnapshot.currency;
  const total = quote.lineItemsSnapshot.sellingPrice + quote.lineItemsSnapshot.shippingCost + quote.lineItemsSnapshot.taxAmount;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [overflowOpen]);

  return (
    <li
      id={`quote-row-${quote.id}`}
      className="text-sm bg-slate-800 px-3 py-2 rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-100 truncate flex items-center gap-2">
          {formatQuoteNumber(quote.quoteNumber)} · {customerLabel}
          <QuoteStatusPill kind={pillKind} />
        </div>
        <div className="text-xs text-slate-400">
          Quoted {formatRelativeDate(new Date(quote.sentAt))} · {formatCurrency(total, currency)}
        </div>
        {pillKind === 'declined' && quote.declineReason && (
          <div className="text-xs text-slate-400 mt-0.5">
            Reason: <span className="text-slate-300">{quote.declineReason}</span>
          </div>
        )}
      </div>
      <div ref={overflowRef} className="flex items-center gap-2 shrink-0 relative">
        {pillKind === 'pending' && (
          <>
            <Button
              variant="primary"
              btnSize="sm"
              onClick={(e) => { e.stopPropagation(); onConvert?.(); }}
              disabled={!onConvert}
              title={onConvert ? undefined : 'Convert to Sale is only available inside JobsManager'}
            >
              Convert to Sale
            </Button>
            {/* allow-raw-html: overflow toggle is a small icon button, not a CTA — Button primitive would dwarf the row */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOverflowOpen(o => !o); }}
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-700 text-slate-300"
            >
              ⋯
            </button>
            {overflowOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 z-10 min-w-[160px] bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1"
              >
                {/* allow-raw-html: native menuitem styling per WAI-ARIA menu pattern */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => { e.stopPropagation(); setOverflowOpen(false); onEdit?.(); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 text-slate-100"
                >
                  Edit Quote
                </button>
                {/* allow-raw-html: native menuitem styling per WAI-ARIA menu pattern */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => { e.stopPropagation(); setOverflowOpen(false); onDecline?.(); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 text-red-300"
                >
                  Mark Declined
                </button>
              </div>
            )}
          </>
        )}
        {pillKind === 'declined' && onReopen && (
          <Button variant="secondary" btnSize="sm" onClick={(e) => { e.stopPropagation(); void onReopen(); }}>
            Reopen
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Per-job Pending + Declined quote rows. Rendered ABOVE the Sale rows
 * inside the JobCard's expanded Orders section. Converted quotes are
 * filtered out (D-26 — represented by their Sale row only).
 *
 * Exported so unit tests can mount it directly without the JobsManager
 * + react-window scaffolding.
 */
export function OrdersQuoteRows({
  jobId,
  onStartConversion,
  onEditQuote,
  onDeclineQuote,
}: {
  jobId: string;
  onStartConversion?: (quote: Quote) => void;
  onEditQuote?: (quote: Quote) => void;
  onDeclineQuote?: (quote: Quote) => void;
}) {
  const { quotesByJobId, updateQuote } = useQuotes();
  const quotesForJob = quotesByJobId.get(jobId) ?? [];
  // Filter out 'converted' (D-26) and 'draft' (G6 legacy) rows — only Pending + Declined render here.
  const visible = quotesForJob.filter(q => quoteStatusToPill(q.status) !== null);
  if (visible.length === 0) return null;

  const sorted = [...visible].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  return (
    <ul className="space-y-1">
      {sorted.map(quote => {
        const kind = quoteStatusToPill(quote.status)!;
        return (
          <QuoteRow
            key={quote.id}
            quote={quote}
            pillKind={kind}
            onConvert={onStartConversion && kind === 'pending' ? () => onStartConversion(quote) : undefined}
            onEdit={onEditQuote && kind === 'pending' ? () => onEditQuote(quote) : undefined}
            onDecline={onDeclineQuote && kind === 'pending' ? () => onDeclineQuote(quote) : undefined}
            onReopen={kind === 'declined' ? async () => {
              // D-29 Reopen: clears decisionAt + declineReason; flips back to 'sent'.
              await updateQuote({ ...quote, status: 'sent', decisionAt: undefined, declineReason: undefined });
            } : undefined}
          />
        );
      })}
    </ul>
  );
}

/**
 * Wrapper that decides whether to render the per-job "Orders" section
 * heading (D-23). Hides the entire section when both Pending/Declined
 * quotes AND Sales are empty. The children prop renders the Sale rows
 * (the JobCard owns that template because each Sale row's expanded
 * customer details are interleaved with its action buttons; extracting
 * it would be a separate refactor).
 */
function OrdersSection({
  jobId,
  recentSales,
  onStartConversion,
  onEditQuote,
  onDeclineQuote,
  children,
}: {
  jobId: string;
  recentSales?: Sale[];
  onStartConversion?: (quote: Quote) => void;
  onEditQuote?: (quote: Quote) => void;
  onDeclineQuote?: (quote: Quote) => void;
  children?: React.ReactNode;  // Sale rows render block from JobCard
}) {
  const { quotesByJobId } = useQuotes();
  const quotesForJob = quotesByJobId.get(jobId) ?? [];
  const visibleQuotes = quotesForJob.filter(q => quoteStatusToPill(q.status) !== null);
  const hasQuotes = visibleQuotes.length > 0;
  const hasSales = (recentSales ?? []).length > 0;
  if (!hasQuotes && !hasSales) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-slate-300 mb-2">Orders</h4>
      <OrdersQuoteRows
        jobId={jobId}
        onStartConversion={onStartConversion}
        onEditQuote={onEditQuote}
        onDeclineQuote={onDeclineQuote}
      />
      {children}
    </div>
  );
}

// Module-scope, memoized job card. CR-01 fix: row component identity is now
// stable across parent renders, so react-window's internal memo wrapper
// caches correctly and rows only re-render when their props change.
// Exported so JobsManager.test.tsx can mount it directly (mirrors the
// OrdersQuoteRows / SaleFromQuoteSubtext export-for-test pattern).
export const JobCard = memo(function JobCard({
  job,
  isSelected,
  info,
  recentSales,
  getFilamentName,
  onToggleSelect,
  onOpenSaleForm,
  onEdit,
  onDelete,
  onGeneratePdf,
  onEditSale,
  onDeleteSale,
  onStartConversion,
  onEditQuote,
  onDeclineQuote,
  isEditingTitle,
  onStartEditTitle,
  onCancelEditTitle,
  onSaveTitle,
  isAddingTag,
  onStartAddTag,
  onCancelAddTag,
  onSubmitAddTag,
  onRemoveTag,
  style,
}: JobCardProps) {
  // Phase 15 Round 2 (Gap E): local draft state for edit-in-place affordances.
  // titleDraft re-seeds from job.name on every isEditingTitle transition (so a
  // job renamed elsewhere is never shown stale). addTagDraft always starts empty.
  const [titleDraft, setTitleDraft] = useState(() => job.name);
  const [addTagDraft, setAddTagDraft] = useState('');
  // Re-seed titleDraft when the title-edit transitions from closed → open.
  useEffect(() => {
    if (isEditingTitle) {
      setTitleDraft(job.name);
    }
  }, [isEditingTitle, job.name]);
  // Re-seed addTagDraft to empty when the add-tag input transitions from closed → open.
  useEffect(() => {
    if (isAddingTag) {
      setAddTagDraft('');
    }
  }, [isAddingTag]);

  return (
    <div
      role="listitem"
      style={style}
      className={`p-4 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-slate-700 border-blue-500'
          : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
      }`}
    >
      {/* Header row — clicking anywhere on this row toggles expand/collapse.
          Interactive descendants (chevron, title edit button, chip ✕, +, tag icon,
          inline inputs, Convert) call `e.stopPropagation()` so they don't fire
          the toggle. The chevron remains the keyboard-accessible affordance
          (aria-expanded + aria-label); this row-click is a mouse hit-target. */}
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => onToggleSelect(job.id)}
      >
        <div className="flex-1">
          {/* Phase 15 Round 2 (Gap E) — title row: chevron (selection toggle) +
              title-or-input (edit in place) + inline chip strip with hover ✕ +
              + add-tag affordance (or inline input) + hover Tag icon + break-even pill.
              D-16: flex-wrap so chips overflow gracefully on narrow viewports.
              The `group` class enables `group-hover:opacity-100` on the Tag icon. */}
          <div className="group flex items-center gap-3 flex-wrap">
            {/* allow-raw-html: chevron icon button — small affordance (w-6 h-6), not a CTA; Button primitive would be visually incorrect for an icon-only toggle */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect(job.id); }}
              aria-label={isSelected ? "Collapse job details" : "Expand job details"}
              aria-expanded={isSelected}
              className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors shrink-0"
            >
              <ChevronRightIcon className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
            </button>
            {isEditingTitle ? (
              // allow-raw-html: title edit-in-place — raw input keeps the in-place visual (no Button primitive padding/border mass)
              <input
                type="text"
                value={titleDraft}
                autoFocus
                onChange={e => setTitleDraft(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void onSaveTitle(job, titleDraft); }
                  if (e.key === 'Escape') { e.preventDefault(); onCancelEditTitle(); }
                }}
                onBlur={() => {
                  if (titleDraft.trim().length > 0) void onSaveTitle(job, titleDraft);
                  else onCancelEditTitle();
                }}
                aria-label="Edit job title"
                className="font-medium text-white bg-slate-800 border border-blue-500 rounded px-2 py-0.5 outline-none min-w-[8rem]"
              />
            ) : (
              /* allow-raw-html: title button — inline text affordance that renders job.name; Button primitive adds unwanted padding/border to what should be plain text */
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStartEditTitle(job.id); }}
                aria-label="Edit job title"
                className="font-medium text-white text-left hover:text-blue-300 transition-colors"
              >
                {job.name}
              </button>
            )}
            {/* Inline chip strip — each chip has hover ✕ (D-11 base styling preserved byte-identically) */}
            {(job.tags ?? []).map(tag => (
              <span key={tag} className="relative group/chip inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
                <span>{tag}</span>
                {/* allow-raw-html: chip ✕ button — tiny (w-3.5 h-3.5) icon affordance; Button primitive would dwarf the chip */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void onRemoveTag(job, tag); }}
                  aria-label={`Remove tag ${tag}`}
                  className="ml-1 -mr-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm hover:bg-slate-500/60 hover:text-slate-100 transition-opacity opacity-0 group-hover/chip:opacity-100 focus-visible:opacity-100 text-[10px] leading-none"
                >
                  ✕
                </button>
              </span>
            ))}
            {/* Add-tag input (shared by + and Tag-icon affordances) — opens whenever isAddingTag is true. */}
            {isAddingTag && (
              // allow-raw-html: add-tag inline — 12ch narrow affordance; Input primitive too wide for chip-row baseline
              <input
                type="text"
                value={addTagDraft}
                autoFocus
                onChange={e => setAddTagDraft(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void onSubmitAddTag(job, addTagDraft); }
                  if (e.key === 'Escape') { e.preventDefault(); onCancelAddTag(); }
                }}
                onBlur={() => {
                  if (addTagDraft.trim().length > 0) void onSubmitAddTag(job, addTagDraft);
                  else onCancelAddTag();
                }}
                placeholder={ADD_TAG_PLACEHOLDER}
                aria-label="Add tag"
                className="max-w-[12ch] px-2 py-0.5 text-xs rounded bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            )}
            {/* + add-tag button — shows only when the job has 1-9 tags. Hidden at 0 (Tag icon takes its role)
                and hidden at the D-02 cap of 10. Also hidden when isAddingTag (the input replaces it). */}
            {!isAddingTag && (job.tags?.length ?? 0) >= 1 && (job.tags?.length ?? 0) < 10 && (
              /* allow-raw-html: + add-tag button — w-5 h-5 icon affordance; Button primitive would not fit in the inline chip-row baseline */
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStartAddTag(job.id); }}
                aria-label="Add tag"
                className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-sm leading-none transition-colors"
              >
                +
              </button>
            )}
            {/* Tag icon — empty-state affordance only. Shows when the job has zero tags so a new user
                sees a labelled-by-aria, always-visible add affordance with the NEW badge. Hidden when
                the row has any chips (the + at the end of the strip takes over) or while isAddingTag is
                true (the input has the focus). NewBadge stays on this icon — it surfaces during the
                row's empty state, which is exactly when discovery matters most. */}
            {!isAddingTag && (job.tags?.length ?? 0) === 0 && (
              <div className="relative">
                {/* allow-raw-html: tag icon button — small icon affordance (w-6 h-6); Button primitive would dwarf the icon and add unwanted layout mass */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStartAddTag(job.id); }}
                  aria-label="Add tag"
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <TagIcon className="w-4 h-4" />
                </button>
                <NewBadge feature="tags" className="absolute -top-1 -right-1 pointer-events-none" />
              </div>
            )}
            {/* Break-even badge: only meaningful when the job has a fixed cost to recover.
                A job with modelCost=0 has nothing to break even on — treat as incomplete data. */}
            {job.modelCost > 0 && (
              info.isBreakEven ? (
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
              )
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
          {/* Phase 15 Round 2 (Gap E) — standalone chip strip REMOVED.
              Tag chips now render INLINE in the title row above (with hover ✕).
              D-11 styling is preserved on the inline chips (text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400). */}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-white">${info.revenueEarned.toFixed(2)}</div>
          <div className="text-xs text-slate-500">
            {job.copiesSold} sold
          </div>
        </div>
      </div>

      {/* Phase 15 Round 2 (Gap E) — the dropped-down panel block is GONE.
          Edit-in-place affordances (inline title field + chip X + add-tag) live
          directly in the title row above; no separate panel ever appears. */}

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
              {/* Phase 21 SEC-02 — render-time URL guard. Valid http(s) URLs
                  render as the existing anchor. Anything else (javascript:,
                  data:, vbscript:, file:, mailto:, plain text) falls back to
                  a muted <span title="..."> so the user can still see what
                  they typed and is told how to fix it (D-06 / D-07). */}
              {isSafeHttpUrl(job.modelUrl) ? (
                <a
                  href={job.modelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-400 hover:text-blue-300 underline break-all"
                >
                  {job.modelUrl}
                </a>
              ) : (
                <span
                  title="Link blocked: must start with http:// or https://"
                  className="text-slate-400 break-all"
                >
                  {job.modelUrl}
                </span>
              )}
            </div>
          )}

          {job.modelCost > 0 && (
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
                        width: `${Math.min(100, (job.copiesSold / info.breakEvenCopies) * 100)}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap relative">
            <Button
              variant="success"
              btnSize="sm"
              onClick={(e) => { e.stopPropagation(); onOpenSaleForm(job); }}
            >
              Record Sale
            </Button>
            <div className="relative">
              {/* D-31: Print Quote promoted to primary (blue) so it visibly separates from the bg-slate-700/50 card */}
              <Button
                variant="primary"
                btnSize="sm"
                disabled={job.sellingPrice <= 0}
                title={job.sellingPrice <= 0 ? 'Set a selling price first' : undefined}
                onClick={(e) => { e.stopPropagation(); onGeneratePdf(job); }}
              >
                Create Quote
              </Button>
              <NewBadge feature="pdf-quote" className="absolute -top-1 -right-1" />
            </div>
            {/* D-31: Edit demoted to ghost+border so the visual hierarchy reads Record Sale (green) > Print Quote (blue) > Edit (ghost) > Delete (red-tinted).
                Hover lightens background to slate-600 so it stands out against the expanded card's bg-slate-700; ghost's default hover:bg-slate-700 is invisible against that background. */}
            <Button
              variant="ghost"
              btnSize="sm"
              className="border border-slate-600 hover:!bg-slate-600"
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

          {/* D-23: Unified "Orders" section per job. OrdersSection internally
              decides whether to render the heading (when EITHER quotes OR sales
              exist). Pending/Declined quote rows render above Sales rows.
              Converted quotes don't render as separate rows (D-26) — they're
              represented by their Sale row with `from Q-NNNN` informational
              subtext (SaleFromQuoteSubtext per D-30). */}
          <OrdersSection
            jobId={job.id}
            recentSales={recentSales}
            onStartConversion={onStartConversion}
            onEditQuote={onEditQuote}
            onDeclineQuote={onDeclineQuote}
          >
            {recentSales && recentSales.length > 0 && (
              <div className="space-y-1 mt-1">
                {recentSales.slice(0, 5).map(s => (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    jobId={job.id}
                    onEdit={onEditSale}
                    onDelete={onDeleteSale}
                  />
                ))}
              </div>
            )}
          </OrdersSection>
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
  onGeneratePdf: (job: PrintJob) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (sale: Sale) => void;
  onStartConversion?: (quote: Quote) => void;
  onEditQuote?: (quote: Quote) => void;
  onDeclineQuote?: (quote: Quote) => void;
  // Phase 15 Round 2 (Gap E) — parent-owned exclusive per-row edit-in-place state
  editingTitleJobId: string | null;
  onStartEditTitle: (jobId: string) => void;
  onCancelEditTitle: () => void;
  onSaveTitle: (job: PrintJob, name: string) => Promise<void>;
  addingTagJobId: string | null;
  onStartAddTag: (jobId: string) => void;
  onCancelAddTag: () => void;
  onSubmitAddTag: (job: PrintJob, tagRaw: string) => Promise<void>;
  onRemoveTag: (job: PrintJob, tag: string) => Promise<void>;
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
  onGeneratePdf,
  onEditSale,
  onDeleteSale,
  onStartConversion,
  onEditQuote,
  onDeclineQuote,
  editingTitleJobId,
  onStartEditTitle,
  onCancelEditTitle,
  onSaveTitle,
  addingTagJobId,
  onStartAddTag,
  onCancelAddTag,
  onSubmitAddTag,
  onRemoveTag,
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
      onGeneratePdf={onGeneratePdf}
      onEditSale={onEditSale}
      onDeleteSale={onDeleteSale}
      onStartConversion={onStartConversion}
      onEditQuote={onEditQuote}
      onDeclineQuote={onDeclineQuote}
      isEditingTitle={editingTitleJobId === job.id}
      onStartEditTitle={onStartEditTitle}
      onCancelEditTitle={onCancelEditTitle}
      onSaveTitle={onSaveTitle}
      isAddingTag={addingTagJobId === job.id}
      onStartAddTag={onStartAddTag}
      onCancelAddTag={onCancelAddTag}
      onSubmitAddTag={onSubmitAddTag}
      onRemoveTag={onRemoveTag}
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

// Phase 15 plan 10 (Gap B) — ChevronRightIcon. Rotates 90° via CSS when the
// row is expanded (mirrors the Sale row `group-open:rotate-90` chevron pattern).
function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// Phase 15 plan 10 (Gap B) — TagIcon. Lucide-style tag shape; used as the
// hover affordance on the title row for opening the inline edit panel.
function TagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

// Phase 15 Round 2 (Gap E, D-16) — usage-suggesting placeholder for the inline
// add-tag input. NOT a content example (no "phone-stand, pla, gloss" — those
// vary per job); rather, this suggests the KIND of tags users should apply
// (status / popularity / lifecycle indicators) per the verbatim Product Intent
// Note in 15-VERIFICATION.md: "Tags are meant to be descriptive of what is
// going on with jobs. For example, trending, bestseller, etc."
//
// Exported so the Gap E component tests can assert the placeholder is wired
// onto the inline add-tag field without duplicating the literal string.
export const ADD_TAG_PLACEHOLDER = 'trending, popular, out of date';

export function JobsManager({ jobs, isLoading, materials, shippingConfig, userCurrency, userProfile, onDeleteJob, onEditJob, onSwitchTab }: JobsManagerProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // Print Quote modal state (plan 16-10 + D-27). Either:
  //   - { job, mode: 'create' }  → PrintQuoteModal renders in create mode
  //   - { job, mode: 'edit', editingQuote } → renders in edit mode (D-27)
  // null = closed. The combined shape avoids a separate state slot for editing.
  const [printQuoteModalState, setPrintQuoteModalState] = useState<
    | { job: PrintJob; mode: 'create' }
    | { job: PrintJob; mode: 'edit'; editingQuote: Quote }
    | null
  >(null);
  // Decline modal state (D-28). The Quote being declined, or null when closed.
  const [decliningQuote, setDecliningQuote] = useState<Quote | null>(null);
  // Convert to Sale state (plan 16-12, D-20). When non-null, the Record Sale modal
  // opens in "conversion" mode pre-populated from this Quote's snapshot; on save
  // the Sale write + Quote 'converted' patch run in one Dexie transaction.
  const [convertingFromQuote, setConvertingFromQuote] = useState<Quote | null>(null);
  // useQuotes is also consumed by the Decline modal's onConfirm handler — see below.
  const { updateQuote: updateQuoteFromHook } = useQuotes();
  // showSaleForm + editingSale + convertingFromQuote remain CONTROLLED here
  // so JobsManager owns the open/close lifecycle and the mode selection.
  // The form state itself (quantity, price, customer fields, etc.) lives
  // inside <RecordSaleModal> per HYG-06 / plan 22-03.
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState<string | null>(null);

  // Phase 15 plan 04 (TAGS-03, TAGS-04) — filter sub-header state.
  // `searchQuery` is the raw input; `debouncedSearchQuery` lags by 250ms (D-06)
  // and drives the search filter memo AND the useDynamicRowHeight cache key (D-05).
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Phase 15 Round 2 (Gap E) — edit-in-place state. Each slot is exclusive across
  // the row list; both can be set on the SAME row simultaneously (user could be
  // renaming the title AND adding a tag), but never on DIFFERENT rows.
  const [editingTitleJobId, setEditingTitleJobId] = useState<string | null>(null);
  const [addingTagJobId, setAddingTagJobId] = useState<string | null>(null);

  // D-06 debounce — 250ms. No project-wide `useDebounce` hook exists (currently
  // single-surface only); PATTERNS.md No-Analog rule says don't extract until 2+ surfaces.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Scoped per-job sales feed is still needed for the per-job sale-row list
  // rendered inside <JobCard recentSales={sales} /> and the sale-row delete
  // confirm flow (deleteSale). The Record Sale modal owns its own
  // useSales(job.id) subscription internally per plan 22-03 D-06.
  const { sales, deleteSale } = useSales(selectedJobId || undefined);
  // PERF-07 (plan 22-06): global sales subscription lifted to useAllSales —
  // explicit named hook returning Sale[] directly, replacing the previous
  // destructure-rename of the no-arg useSales hook.
  const allSales = useAllSales();
  // Phase 14 revised (2026-05-22): sales are editable so users can fix per-sale
  // customer typos after recording. Null = create mode; Sale = edit mode.
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [deleteSaleConfirmId, setDeleteSaleConfirmId] = useState<string | null>(null);

  const salesByJob = useMemo(() => {
    const map = new Map<string, Sale[]>();
    for (const sale of allSales ?? []) {
      const existing = map.get(sale.jobId);
      if (existing) existing.push(sale);
      else map.set(sale.jobId, [sale]);
    }
    return map;
  }, [allSales]);

  // Search filter (D-06 scope) — case-insensitive substring across:
  //   - job.name
  //   - every tag in job.tags
  //   - every matching Sale's customer.{name,email,company}
  // EXCLUDED per D-06: Sale.customer.address, Sale.customer.notes, deprecated PrintJob.customer.
  // Reuses the existing `salesByJob` Map<jobId, Sale[]> built upstream from `allSales`
  // (no need to rebuild the join — D-06 sales-join requirement is satisfied via this shared Map).
  // Gap C (2026-05-24): operates directly on `jobs` (no intermediate chip-filter memo).
  const searchedJobs = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    if (!q) return jobs;
    return jobs.filter(job => {
      if (job.name.toLowerCase().includes(q)) return true;
      if (job.tags?.some(t => t.toLowerCase().includes(q))) return true;
      const jobSales = salesByJob.get(job.id) ?? [];
      return jobSales.some(s =>
        (s.customer?.name || '').toLowerCase().includes(q) ||
        (s.customer?.email || '').toLowerCase().includes(q) ||
        (s.customer?.company || '').toLowerCase().includes(q)
      );
    });
  }, [jobs, salesByJob, debouncedSearchQuery]);

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Sale-form helpers (shipping methods, marketplace options, fee formula,
  // shipping-cost defaults) all moved to RecordSaleModal.tsx per HYG-06.
  // The modal owns them because they are sale-form concerns only.

  // PERF-01 (D-18): pre-compute break-even info once per render for the
  // filtered job list. Replaces the per-row `getBreakEvenInfo` useCallback;
  // three consumers (rowProps arrow wrapper D-19, virtualized JobRow via
  // rowProps, non-virtualized fallback) all do O(1) Map lookups.
  const breakEvenMap = useMemo(
    () => new Map(searchedJobs.map((j) => [j.id, computeBreakEvenInfo(j, salesByJob)])),
    [searchedJobs, salesByJob],
  );

  // Close the Record Sale modal and clear mode-selecting state. The modal's
  // own form state is reset by Modal.tsx:67 unmount (children unmount on
  // close per Phase 19 D-19); we just clear the mode flags here so the next
  // open starts in the right mode.
  const handleCloseSaleModal = useCallback(() => {
    setShowSaleForm(false);
    setEditingSale(null);
    setConvertingFromQuote(null);
  }, []);

  // Phase 16 plan 16-12 (D-20): Convert to Sale flow.
  // Opens <RecordSaleModal> in convert mode by setting convertingFromQuote.
  // The modal's hydration useEffect (D-08) keyed on convertingFromQuote
  // fills its form state from the Quote snapshot on mount.
  const handleStartConversion = useCallback((quote: Quote) => {
    const job = jobs.find(j => j.id === quote.printJobId);
    if (job) setSelectedJobId(job.id);
    setConvertingFromQuote(quote);
    setEditingSale(null);
    setShowSaleForm(true);
  }, [jobs]);

  // Open the sale modal in edit mode. The modal's hydration useEffect (D-08)
  // keyed on editingSale fills its form state from the Sale on mount.
  const handleEditSale = useCallback((sale: Sale) => {
    setEditingSale(sale);
    setConvertingFromQuote(null);
    setShowSaleForm(true);
  }, []);

  // Picker memos + pick handler + keyDown handler + sale-commit handler
  // all moved to RecordSaleModal.tsx per HYG-06. The modal owns the entire
  // sale-form lifecycle including the Convert-from-Quote atomic db.transaction
  // (Pitfall 2) and the Phase 15.1 D-06 auto-create + D-07 silent-link
  // customer side-effects.

  const handleConfirmDeleteSale = useCallback(async (sale: Sale) => {
    await deleteSale(sale);
    setDeleteSaleConfirmId(null);
  }, [deleteSale]);

  // Print Quote button → open the modal (Phase 16 gap closure plan 16-10, D-18).
  // The prior silent most-recent-sale fallback is gone; the modal is the SOLE
  // entry point for creating a Quote. The createQuote hook action (16-09 Task 4)
  // owns the multi-store Dexie transaction (quotes + customers + settings) so
  // this component never touches db directly.
  const handleGeneratePdf = useCallback((job: PrintJob) => {
    setPrintQuoteModalState({ job, mode: 'create' });
  }, []);

  // D-27: Edit Quote — opens PrintQuoteModal in edit mode for the given Pending Quote.
  const handleStartEditQuote = useCallback((quote: Quote) => {
    const job = jobs.find(j => j.id === quote.printJobId);
    if (!job) return;  // data anomaly: quote points to a deleted job — silent no-op
    setPrintQuoteModalState({ job, mode: 'edit', editingQuote: quote });
  }, [jobs]);

  // D-28: Mark Declined click → open DeclineQuoteModal to capture optional reason.
  const handleStartDecline = useCallback((quote: Quote) => {
    setDecliningQuote(quote);
  }, []);

  // D-28: DeclineQuoteModal onConfirm — writes status='declined' + decisionAt + declineReason atomically.
  const handleConfirmDecline = useCallback(async ({ reason }: { reason: string }) => {
    if (!decliningQuote) return;
    await updateQuoteFromHook({
      ...decliningQuote,
      status: 'declined',
      decisionAt: new Date(),
      declineReason: reason || undefined,  // empty string → leave undefined for cleanliness
    });
  }, [decliningQuote, updateQuoteFromHook]);

  // Stable callbacks so React.memo on JobCard can skip rows whose data
  // didn't change. State setters are already stable; only derived handlers
  // need useCallback wrapping.
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedJobId(prev => prev === id ? null : id);
  }, []);

  const handleOpenSaleForm = useCallback((job: PrintJob) => {
    setSelectedJobId(job.id);
    // RecordSaleModal hydrates its salePrice from job.sellingPrice on mount
    // via its hydration useEffect (D-08) — no need to set form state here.
    setEditingSale(null);
    setConvertingFromQuote(null);
    setShowSaleForm(true);
  }, []);

  const handleDeleteJob = useCallback((id: string) => {
    setDeleteConfirmJobId(id);
  }, []);

  // Phase 15 Round 2 (Gap E) — Title edit-in-place handlers.
  const handleStartEditTitle = useCallback((jobId: string) => {
    setEditingTitleJobId(jobId);
  }, []);

  const handleCancelEditTitle = useCallback(() => {
    setEditingTitleJobId(null);
  }, []);

  // Empty-name guard: trim, fall back to job.name if empty; skip the write when
  // the safe name equals job.name (avoid noop write + updatedAt bump).
  const handleSaveTitle = useCallback(async (job: PrintJob, name: string) => {
    const trimmed = name.trim();
    const safeName = trimmed.length > 0 ? trimmed : job.name;
    if (safeName !== job.name) {
      await db.jobs.put({ ...job, name: safeName, updatedAt: new Date() });
    }
    setEditingTitleJobId(null);
  }, []);

  // Phase 15 Round 2 (Gap E) — Add-tag inline input handlers.
  const handleStartAddTag = useCallback((jobId: string) => {
    setAddingTagJobId(jobId);
  }, []);

  const handleCancelAddTag = useCallback(() => {
    setAddingTagJobId(null);
  }, []);

  // Uses parseTagsInput to share the D-02 normalize pipeline. Takes the first
  // parsed token (commas are treated as separators per D-02 — only the first
  // token is added). Dedupes against existing tags and enforces D-02 cap-at-10.
  const handleSubmitAddTag = useCallback(async (job: PrintJob, tagRaw: string) => {
    const parsed = parseTagsInput(tagRaw);
    const newTag = parsed?.[0];
    if (!newTag) {
      setAddingTagJobId(null);
      return;
    }
    const existing = job.tags ?? [];
    if (existing.includes(newTag)) {
      setAddingTagJobId(null);
      return;
    }
    if (existing.length >= 10) {
      setAddingTagJobId(null);
      return;
    }
    const merged = [...existing, newTag];
    await db.jobs.put({ ...job, tags: merged, updatedAt: new Date() });
    setAddingTagJobId(null);
  }, []);

  // Phase 15 Round 2 (Gap E) — Chip ✕ removal handler.
  // Persists `tags: undefined` (NOT `tags: []`) when the filtered result is empty
  // (D-02 line 43 "empty input → tags: undefined" semantic). Defensive guard
  // against race conditions where the chip ✕ fires twice for the same tag.
  const handleRemoveTag = useCallback(async (job: PrintJob, tag: string) => {
    const existing = job.tags ?? [];
    if (!existing.includes(tag)) return;
    const next = existing.filter(t => t !== tag);
    const nextTags = next.length > 0 ? next : undefined;
    await db.jobs.put({ ...job, tags: nextTags, updatedAt: new Date() });
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
  //
  // Phase 15 plan 04 (D-05 lock for TAGS-04), reshaped by Gap C (2026-05-24):
  // key encodes selectedJobId + debounced search — pipe-delimited bi-key so the
  // two segments can never collide (e.g. `job123foo` vs `job12|3foo`).
  // Either changing invalidates the cache → react-window resets
  // row heights → the list scrolls to top (TAGS-04 cache invalidation contract).
  const rowHeightCache = useDynamicRowHeight({
    defaultRowHeight: 88,
    key: `${selectedJobId ?? ''}|${debouncedSearchQuery}`,
  });

  // Bundle everything the row needs through rowProps. react-window v2 does
  // a shallow comparison and re-renders rows when these values change —
  // selecting a different job updates selectedJobId, which flips isSelected
  // for the two affected rows and leaves the rest memoized (CR-03 fix).
  // Stable callbacks for per-sale actions so JobCard's React.memo can short-circuit.
  const handleEditSaleStable = useCallback((sale: Sale) => handleEditSale(sale), [handleEditSale]);
  const handleDeleteSaleStable = useCallback((sale: Sale) => setDeleteSaleConfirmId(sale.id), []);

  // Phase 15 plan 04 — feed `searchedJobs` (the chip+search filtered list) to the
  // virtualized rows so JobRow's `jobs[index]` resolves against the visible set.
  // Phase 15 plan 05 — extend with one-at-a-time tag-edit state so JobCard renders
  // the inline tag editor on the correct row without per-row local state.
  const rowProps = useMemo<JobRowProps>(() => ({
    jobs: searchedJobs,
    selectedJobId,
    selectedSales: sales,
    getFilamentName,
    // PERF-01 (D-19, Pitfall 6): preserve JobRowProps shape with an arrow
    // wrapper so JobCard's prop interface stays unchanged.
    getBreakEvenInfo: (job: PrintJob) => breakEvenMap.get(job.id)!,
    onToggleSelect: handleToggleSelect,
    onOpenSaleForm: handleOpenSaleForm,
    onEdit: onEditJob,
    onDelete: handleDeleteJob,
    onGeneratePdf: handleGeneratePdf,
    onEditSale: handleEditSaleStable,
    onDeleteSale: handleDeleteSaleStable,
    onStartConversion: handleStartConversion,
    onEditQuote: handleStartEditQuote,
    onDeclineQuote: handleStartDecline,
    editingTitleJobId,
    onStartEditTitle: handleStartEditTitle,
    onCancelEditTitle: handleCancelEditTitle,
    onSaveTitle: handleSaveTitle,
    addingTagJobId,
    onStartAddTag: handleStartAddTag,
    onCancelAddTag: handleCancelAddTag,
    onSubmitAddTag: handleSubmitAddTag,
    onRemoveTag: handleRemoveTag,
  }), [searchedJobs, selectedJobId, sales, getFilamentName, breakEvenMap, handleToggleSelect, handleOpenSaleForm, onEditJob, handleDeleteJob, handleGeneratePdf, handleEditSaleStable, handleDeleteSaleStable, handleStartConversion, handleStartEditQuote, handleStartDecline, editingTitleJobId, handleStartEditTitle, handleCancelEditTitle, handleSaveTitle, addingTagJobId, handleStartAddTag, handleCancelAddTag, handleSubmitAddTag, handleRemoveTag]);

  // Search-only clearer — used by the filter-empty-state CTA below the sticky sub-header
  // (Gap C: TAGS-02 withdrawn 2026-05-24).
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

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
        ) : (
          <>
            {/* Phase 15 plan 04 — Sticky filter sub-header (search-input-only after Gap C).
                Sits ABOVE the virtualized List per PATTERNS.md No-Analog note
                (react-window's List doesn't natively render headers above rows;
                page-level scroll provides the stickiness). */}
            <div className="sticky top-0 z-10 bg-slate-800 pb-3">
              {/* D-06 search input — mirrors CustomerLibrary.tsx:234-253.
                  Phase 15 plan 05 D-13: NewBadge `search-jobs` lives as
                  absolute-overlay on this wrapper (already has `relative`).
                  Per project memory rule, absolute-overlay is the right
                  placement for square / icon-button surfaces; the search
                  input wrapper is treated as a single tappable affordance. */}
              <div className="relative mb-3">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search jobs by title, tag, or customer"
                  className="pl-9 pr-8 placeholder-slate-500"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    btnSize="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none"
                  >
                    {'×'}
                  </Button>
                )}
                <NewBadge feature="search-jobs" className="absolute -top-1 -right-1" />
              </div>

            </div>

            {/* D-10 filter-empty-state — renders BELOW the (still-visible) filter sub-header,
                NOT the `<EmptyState>` primitive (D-10 explicit). The filter UI stays mounted
                so the user can adjust without losing context. */}
            {searchedJobs.length === 0 && jobs.length > 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-semibold text-white">No jobs match your search</h3>
                <p className="text-sm text-slate-400 mt-2">Try a different search term, or clear search to see all jobs.</p>
                {/* allow-raw-html: inline link styling, not a CTA — mirrors the search clear-X affordance on the input */}
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-4 text-sm text-blue-300 hover:text-blue-200 underline"
                >
                  Clear search
                </button>
              </div>
            ) : searchedJobs.length > 100 ? (
              // WR-01 fix: aria-rowcount is only valid on grid/table/treegrid
              // per WAI-ARIA 1.2 — silently ignored on role="list". Drop it
              // and let screen readers report list length naturally.
              <List
                role="list"
                rowComponent={JobRow}
                rowCount={searchedJobs.length}
                rowHeight={rowHeightCache}
                rowProps={rowProps}
                overscanCount={4}
                style={{ height: '70vh' }}
                className="space-y-0"
              />
            ) : (
              <div className="space-y-3">
                {searchedJobs.map((job) => {
                  const isSelected = selectedJobId === job.id;
                  return (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSelected={isSelected}
                      info={breakEvenMap.get(job.id)!}
                      recentSales={isSelected ? sales : undefined}
                      getFilamentName={getFilamentName}
                      onToggleSelect={handleToggleSelect}
                      onOpenSaleForm={handleOpenSaleForm}
                      onEdit={onEditJob}
                      onDelete={handleDeleteJob}
                      onGeneratePdf={handleGeneratePdf}
                      onEditSale={handleEditSaleStable}
                      onDeleteSale={handleDeleteSaleStable}
                      onStartConversion={handleStartConversion}
                      onEditQuote={handleStartEditQuote}
                      onDeclineQuote={handleStartDecline}
                      isEditingTitle={editingTitleJobId === job.id}
                      onStartEditTitle={handleStartEditTitle}
                      onCancelEditTitle={handleCancelEditTitle}
                      onSaveTitle={handleSaveTitle}
                      isAddingTag={addingTagJobId === job.id}
                      onStartAddTag={handleStartAddTag}
                      onCancelAddTag={handleCancelAddTag}
                      onSubmitAddTag={handleSubmitAddTag}
                      onRemoveTag={handleRemoveTag}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Record Sale modal — HYG-06 / plan 22-03. Owns form state + sale-commit
          logic (including the Convert-from-Quote atomic db.transaction) + the
          Phase 15.1 D-06 auto-create + D-07 silent-link customer side-effects
          internally. JobsManager only controls open/close + which mode the
          modal is in via the editingSale / convertingFromQuote props. */}
      {selectedJob && (
        <RecordSaleModal
          job={selectedJob}
          userProfile={userProfile}
          userCurrency={userCurrency}
          shippingConfig={shippingConfig}
          editingSale={editingSale}
          convertingFromQuote={convertingFromQuote}
          isOpen={showSaleForm}
          onClose={handleCloseSaleModal}
        />
      )}

      <Modal
        isOpen={deleteConfirmJobId !== null}
        onClose={() => setDeleteConfirmJobId(null)}
        title="Delete Job"
        size="sm"
      >
        <div className="p-4">
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
      </Modal>

      <Modal
        isOpen={deleteSaleConfirmId !== null}
        onClose={() => setDeleteSaleConfirmId(null)}
        title="Delete Sale"
        size="sm"
      >
        <div className="p-4">
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
      </Modal>

      {/* PrintQuoteModal — handles both create (D-18) and edit (D-27) modes via the shared state slot */}
      {printQuoteModalState && (
        <PrintQuoteModal
          job={printQuoteModalState.job}
          userProfile={userProfile}
          shippingConfig={shippingConfig}
          isOpen={true}
          onClose={() => setPrintQuoteModalState(null)}
          editingQuote={printQuoteModalState.mode === 'edit' ? printQuoteModalState.editingQuote : undefined}
        />
      )}

      {/* D-28: DeclineQuoteModal — captures optional decline reason via free-form Textarea */}
      <DeclineQuoteModal
        quote={decliningQuote}
        onConfirm={handleConfirmDecline}
        onClose={() => setDecliningQuote(null)}
      />

    </div>
  );
}
