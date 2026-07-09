import { useMemo, useState } from 'react';
import type { PrintJob } from '../../types';
import { useJobs, useAllSales, usePrinterInstances, usePrinters, useMaterials, useUserProfile } from '../../hooks/useDatabase';
import { useFailureEvents } from '../../hooks/useFailureEvents';
import { useMaintenanceEvents } from '../../hooks/useMaintenanceEvents';
import { useFxRates } from '../../hooks/useFxRates';
import type { SalesReportRange } from '../../utils/salesReportAggregates';
import { resolveDateRange } from '../../utils/periodRange';
import { computeProductRanking, computeWageHeadline, computePrinterPayback } from '../../utils/insights';
import { EmptyState, PeriodPicker, Select, InfoTooltip, Button } from '../ui';
import { TrendingUpIcon, SlidersIcon } from '../ui/icons';
import { NewBadge } from '../NewBadge';
import { WageInsight } from './WageInsight';
import { ProductRanking } from './ProductRanking';
import { PrinterROI } from './PrinterROI';
import { WhatIfSimulator } from './WhatIfSimulator';
import { TaxThresholdCard } from './TaxThresholdCard';

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

  // Phase 40 Plan 05 (INS-03/D-09): job picker for the shared WhatIfSimulator —
  // the SAME component the JobsManager job-row action opens, so behavior is
  // identical from either entry point.
  const [whatIfJobId, setWhatIfJobId] = useState('');
  const [showWhatIf, setShowWhatIf] = useState(false);
  const whatIfJob = jobs.find(j => j.id === whatIfJobId) ?? null;

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

      {/* Phase 41 LIFE-02 (D-13): lifetime allSales (not the PeriodPicker-scoped
          salesInRange) — a tax-year threshold is a lifetime-clock concept,
          same reasoning as printer payback above. */}
      <div className="mt-4">
        <TaxThresholdCard
          sales={allSales}
          jurisdiction={userProfile.taxJurisdiction}
          userCurrency={userProfile.currency}
          fxTable={fxTable}
          customAmount={userProfile.customTaxThresholdAmount}
          customLabel={userProfile.customTaxThresholdLabel}
        />
      </div>

      {/* Phase 40 Plan 05 (INS-03/D-09): what-if simulator job picker — opens the
          SAME shared WhatIfSimulator the JobsManager job-row action opens. */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mt-4">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-sm font-medium text-slate-300">What-if simulator</h3>
          <InfoTooltip text="Pick a saved job and drag the sliders to see how filament price, electricity rate, or failure rate would change its numbers. Nothing is saved." />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            selectSize="sm"
            value={whatIfJobId}
            onChange={(e) => setWhatIfJobId(e.target.value)}
            aria-label="Select a job to simulate"
          >
            <option value="">Select a job…</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </Select>
          <div className="relative inline-flex">
            <Button
              variant="secondary"
              btnSize="sm"
              disabled={!whatIfJobId}
              onClick={() => setShowWhatIf(true)}
            >
              <SlidersIcon className="w-4 h-4 mr-1.5" />
              Simulate
            </Button>
            <NewBadge feature="what-if-simulator" className="absolute -top-1 -right-1 pointer-events-none" />
          </div>
        </div>
      </div>

      <WhatIfSimulator job={whatIfJob} isOpen={showWhatIf} onClose={() => setShowWhatIf(false)} />
    </div>
  );
}
