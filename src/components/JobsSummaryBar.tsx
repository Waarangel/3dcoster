import type { ReactNode } from 'react';
import type { Currency } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatFilament, formatHours, type JobsAggregates } from '../utils/jobsAggregates';

// ---------------------------------------------------------------------------
// Jobs summary totals bar — all-jobs aggregates shown above the jobs list.
// The math lives in utils/jobsAggregates.ts (pure, unit-tested); this file is
// purely presentational. Lives OUTSIDE JobsManager.tsx so that file keeps
// only its own component exports (react-refresh/only-export-components) and
// tests can mount the bar without the react-window scaffolding.
// ---------------------------------------------------------------------------

/** Exported for the test contract — the sr-only explanation must match. */
export const FX_UNAVAILABLE_TITLE =
  'Exchange rates unavailable — jobs or sales were recorded in another currency and cannot be converted yet';

function SummaryStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );
}

function MoneyValue({ amount, userCurrency, signColor }: { amount: number | null; userCurrency: Currency; signColor?: boolean }) {
  if (amount === null) {
    // WCAG 1.3.1: the "why is this missing" explanation must be in the
    // accessibility tree, not a mouse-only title attribute. The visible dash
    // is aria-hidden so AT users hear the explanation, not a bare "dash";
    // the title stays as a hover affordance for sighted users.
    return (
      <div className="mt-1 text-2xl font-bold text-slate-500">
        <span aria-hidden="true" title={FX_UNAVAILABLE_TITLE}>—</span>
        <span className="sr-only">{FX_UNAVAILABLE_TITLE}</span>
      </div>
    );
  }
  const color = signColor ? (amount >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white';
  return <div className={`mt-1 text-2xl font-bold ${color}`}>{formatCurrency(amount, userCurrency)}</div>;
}

/**
 * All-jobs summary totals bar. Pure presentational — receives precomputed
 * aggregates from JobsManager's useMemo over computeJobsAggregates.
 */
export function JobsSummaryBar({ aggregates, userCurrency }: { aggregates: JobsAggregates; userCurrency: Currency }) {
  return (
    <div role="group" aria-label="Summary totals across all jobs" className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SummaryStat label="Total Revenue">
        <MoneyValue amount={aggregates.totalRevenue} userCurrency={userCurrency} />
      </SummaryStat>
      <SummaryStat label="Total Profit">
        <MoneyValue amount={aggregates.totalProfit} userCurrency={userCurrency} signColor />
      </SummaryStat>
      <SummaryStat label="Filament Used">
        <div className="mt-1 text-2xl font-bold text-white">{formatFilament(aggregates.totalGrams)}</div>
      </SummaryStat>
      <SummaryStat label="Print Time">
        <div className="mt-1 text-2xl font-bold text-white">{formatHours(aggregates.totalHours)}h</div>
      </SummaryStat>
    </div>
  );
}
