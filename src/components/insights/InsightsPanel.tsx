import { useMemo, useState } from 'react';
import type { PrintJob } from '../../types';
import { useJobs, useAllSales, usePrinterInstances, useUserProfile } from '../../hooks/useDatabase';
import { useFxRates } from '../../hooks/useFxRates';
import type { SalesReportRange } from '../../utils/salesReportAggregates';
import { resolveDateRange } from '../../utils/periodRange';
import { EmptyState, PeriodPicker } from '../ui';
import { TrendingUpIcon } from '../ui/icons';

interface InsightsPanelProps {
  /** Only 'jobs' is used by this plan's empty-state CTA — widen as later plans add CTAs. */
  onSwitchTab: (tab: 'jobs') => void;
  onEditJob: (job: PrintJob) => void;
}

const ALL_TIME_PARTS = { year: 0, month: 0, quarter: 0, customStart: '', customEnd: '' };

/**
 * Insights tab orchestrator (INS-01). Owns its own Dexie subscriptions —
 * insight data is NEVER prop-drilled through App.tsx (explicit plan rule).
 * This plan (40-03) wires the true-hourly-wage headline (WageInsight) and
 * the product profitability ranking (ProductRanking); the printer ROI
 * tracker (40-04) and what-if simulator (40-05) extend this same
 * orchestrator with additional sections below.
 */
export function InsightsPanel({ onSwitchTab }: InsightsPanelProps) {
  const { jobs } = useJobs();
  const allSales = useAllSales();
  usePrinterInstances(); // subscription reserved for 40-04's printer payback section
  useUserProfile(); // subscription reserved for the target-wage gap wired in Task 2
  useFxRates(); // subscription reserved for the money math wired in Task 2

  // D-04: all-time is the default scope; the shared PeriodPicker (40-02) narrows it.
  const [range, setRange] = useState<SalesReportRange>(() => resolveDateRange('all-time', ALL_TIME_PARTS));

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const s of allSales) years.add(s.soldAt.getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [allSales]);

  const hasAnyData = jobs.length > 0 || allSales.length > 0;

  if (!hasAnyData) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Insights</h2>
        <EmptyState
          icon={<TrendingUpIcon className="w-12 h-12" />}
          title="No sales recorded yet"
          description="Record a sale to see your true hourly wage and product profitability ranking."
          cta={{ label: 'Go to Jobs', onClick: () => onSwitchTab('jobs') }}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">Insights</h2>
      <p className="text-sm text-slate-400 mb-4">Decision-grade analytics from the data you&apos;ve already entered.</p>

      <div className="mb-6">
        <PeriodPicker saleYears={yearOptions} onRangeChange={setRange} defaultMode="all-time" />
        <div aria-live="polite" className="text-xs text-slate-500 mt-2">{range.label}</div>
      </div>

      {/* Task 2 wires WageInsight + ProductRanking here, driven by `range`, `jobs`, `allSales`. */}
    </div>
  );
}
