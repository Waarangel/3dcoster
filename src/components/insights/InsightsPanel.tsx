import { useMemo, useState } from 'react';
import type { PrintJob } from '../../types';
import { useJobs, useAllSales, usePrinterInstances, usePrinters, useMaterials, useUserProfile } from '../../hooks/useDatabase';
import { useFailureEvents } from '../../hooks/useFailureEvents';
import { useMaintenanceEvents } from '../../hooks/useMaintenanceEvents';
import { useFxRates } from '../../hooks/useFxRates';
import type { SalesReportRange } from '../../utils/salesReportAggregates';
import { resolveDateRange } from '../../utils/periodRange';
import { computeProductRanking, computeWageHeadline, computePrinterPayback } from '../../utils/insights';
import { EmptyState, PeriodPicker } from '../ui';
import { TrendingUpIcon } from '../ui/icons';
import { WageInsight } from './WageInsight';
import { ProductRanking } from './ProductRanking';
import { PrinterROI } from './PrinterROI';

interface InsightsPanelProps {
  /** 'jobs' for the empty-state CTA (40-03); 'settings' for the printer-payback missing-price CTA (40-04). */
  onSwitchTab: (tab: 'jobs' | 'settings') => void;
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
  const { instances: printerInstances } = usePrinterInstances();
  const { printers: printerConfigs } = usePrinters();
  const { materials } = useMaterials();
  const { events: failureEvents } = useFailureEvents();
  const { events: maintenanceEvents } = useMaintenanceEvents();
  const { profile: userProfile } = useUserProfile();
  const fxTable = useFxRates();

  // D-04: all-time is the default scope; the shared PeriodPicker (40-02) narrows it.
  const [range, setRange] = useState<SalesReportRange>(() => resolveDateRange('all-time', ALL_TIME_PARTS));

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    for (const s of allSales) years.add(s.soldAt.getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [allSales]);

  // insights.ts's compute* functions (40-01) take a plain sales array with no
  // range parameter — the same filter-before-call pattern ReportsSection uses
  // for its CSV export narrows scope to the selected period.
  const salesInRange = useMemo(
    () => allSales.filter(s => s.soldAt >= range.start && s.soldAt <= range.end),
    [allSales, range],
  );

  const wageHeadline = useMemo(
    () => computeWageHeadline(jobs, salesInRange, userProfile.currency, fxTable, userProfile.targetHourlyRate),
    [jobs, salesInRange, userProfile.currency, fxTable, userProfile.targetHourlyRate],
  );

  const productRanking = useMemo(
    () => computeProductRanking(jobs, salesInRange, userProfile.currency, fxTable),
    [jobs, salesInRange, userProfile.currency, fxTable],
  );

  // D-05/D-06/D-07: printer payback is a LIFETIME cumulative metric — it
  // deliberately ignores the PeriodPicker's `range` (which only scopes the
  // wage headline + product ranking above) and always uses the full sales
  // history, or "this month" would reset every printer's payback progress.
  const printerPayback = useMemo(
    () => computePrinterPayback(
      jobs,
      allSales,
      printerInstances,
      printerConfigs,
      failureEvents,
      maintenanceEvents,
      materials,
      userProfile.currency,
      fxTable,
    ),
    [jobs, allSales, printerInstances, printerConfigs, failureEvents, maintenanceEvents, materials, userProfile.currency, fxTable],
  );

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WageInsight headline={wageHeadline} userCurrency={userProfile.currency} />
        <ProductRanking ranking={productRanking} userCurrency={userProfile.currency} />
      </div>

      <PrinterROI payback={printerPayback} userCurrency={userProfile.currency} onSwitchTab={onSwitchTab} />

      {/* 40-05: what-if simulator section extends this orchestrator here. */}
    </div>
  );
}
