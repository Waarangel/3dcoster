import { useMemo, useState } from 'react';
import type { Sale, PrintJob, Currency, FailureEvent, PrinterInstance, Material } from '../types';
import type { FxRateTable } from '../utils/fxConvert';
import { formatCurrency } from '../utils/currency';
import { computeSalesReport, type SalesReportRange } from '../utils/salesReportAggregates';
import { nowParts, resolveDateRange } from '../utils/periodRange';
import { generateSalesExportCsv, buildExportFilename } from '../utils/jobsExport';
import { downloadCsv } from '../utils/csvHelpers';
import { formatRelativeDate } from '../utils/formatRelativeDate';
import { Button, DeleteButton, ConfirmModal, PeriodPicker, useToast } from './ui';
import { LogFailureModal } from './LogFailureModal';
import { useFailureEvents } from '../hooks/useFailureEvents';

interface ReportsSectionProps {
  allSales: Sale[];
  jobs: PrintJob[];
  userCurrency: Currency;
  fxTable: FxRateTable | null;
  /** Phase 39 FAIL-04: the live failureEvents ledger — rendered as a "Failures" sub-section (D-04: no new top-level tab). */
  failureEvents: FailureEvent[];
  /** Phase 39 FAIL-04: for the printer/material Selects on the standalone Log-failure modal + row labels. */
  printerInstances: PrinterInstance[];
  filamentAssets: Material[];
}

export function ReportsSection({ allSales, jobs, userCurrency, fxTable, failureEvents, printerInstances, filamentAssets }: ReportsSectionProps) {
  const toast = useToast();
  const { deleteFailure } = useFailureEvents();
  // Phase 39 FAIL-04: standalone "Log failure" button opens the modal with no
  // job prefill (D-01) — undefined prefill means the printer/material
  // Selects default to the first available option instead of a specific row.
  const [showLogFailureModal, setShowLogFailureModal] = useState(false);
  const [deletingFailureId, setDeletingFailureId] = useState<string | null>(null);
  // PeriodPicker (Phase 40 40-02) owns the mode/year/month/quarter/custom
  // state internally and reports the resolved range + validity back here.
  // Seed with today's month so the first paint (before PeriodPicker's mount
  // effect fires) shows the same default the picker will settle on.
  const [range, setRange] = useState<SalesReportRange>(() => {
    const { year, month } = nowParts();
    return resolveDateRange('month', { year, month, quarter: 0, customStart: '', customEnd: '' });
  });
  const [customRangeInvalid, setCustomRangeInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const yearOptions = useMemo(() => {
    const cur = nowParts().year;
    const years = new Set<number>([cur]);
    for (const s of allSales) years.add(s.soldAt.getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [allSales]);

  const jobsById = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);
  const data = useMemo(() => computeSalesReport(allSales, jobsById, range, userCurrency, fxTable), [allSales, jobsById, range, userCurrency, fxTable]);

  const money = (n: number | null) => (n == null ? '—' : formatCurrency(n, userCurrency));

  const handlePdf = async () => {
    setBusy(true);
    try {
      const { generateSalesReportPdf } = await import('../pdf/generateSalesReportPdf');
      await generateSalesReportPdf(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not generate the PDF report.');
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = async () => {
    setBusy(true);
    try {
      const inRange = allSales.filter(s => s.soldAt >= range.start && s.soldAt <= range.end);
      const csv = await generateSalesExportCsv(inRange, jobsById);
      downloadCsv(csv, buildExportFilename('sales', range.label));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export the CSV.');
    } finally {
      setBusy(false);
    }
  };

  // Phase 39 FAIL-04: name lookups for the ledger rows + per-printer/per-material grouping.
  const printerNameById = useMemo(
    () => new Map(printerInstances.map(p => [p.id, p.nickname])),
    [printerInstances],
  );
  const materialNameById = useMemo(
    () => new Map(filamentAssets.map(m => [m.id, m.name])),
    [filamentAssets],
  );

  const failuresByPrinter = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of failureEvents) {
      const name = printerNameById.get(f.printerInstanceId) ?? 'Unknown printer';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [failureEvents, printerNameById]);

  const failuresByMaterial = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of failureEvents) {
      const name = materialNameById.get(f.materialId) ?? 'Unknown material';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [failureEvents, materialNameById]);

  const sortedFailures = useMemo(
    () => [...failureEvents].sort((a, b) => b.failedAt.getTime() - a.failedAt.getTime()),
    [failureEvents],
  );

  // ConfirmModal owns the busy/error UI + calls onClose() on success — this
  // just needs to perform the delete (or throw, which ConfirmModal displays).
  const handleConfirmDeleteFailure = async () => {
    if (!deletingFailureId) return;
    await deleteFailure(deletingFailureId);
  };

  return (
    <div>
      <h3 className="text-base font-semibold text-white mb-1">Sales report</h3>
      <p className="text-sm text-slate-400 mb-4">A tidy summary of revenue, fees and profit for any period — for tax records or a loan application.</p>

      <div className="mb-4">
        <PeriodPicker saleYears={yearOptions} onRangeChange={setRange} onCustomRangeInvalidChange={setCustomRangeInvalid} />
      </div>

      {/* Live preview — M-06: announce recomputed totals when the range changes */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 mb-4"
      >
        <div className="text-xs text-slate-500 mb-2">{range.label}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm">
          <Stat label="Sales" value={`${data.saleCount} (${data.itemCount} items)`} />
          <Stat label="Gross revenue" value={money(data.grossRevenue)} />
          <Stat label="Fees" value={money(data.fees)} />
          <Stat label="Net revenue" value={money(data.netRevenue)} />
          <Stat label="Cost" value={money(data.cost)} />
          <Stat label="Profit" value={money(data.profit)} strong />
        </div>
        {data.hasPartialData && (
          <p className="text-xs text-amber-400/80 mt-3">Some amounts show “—” — an exchange rate wasn’t available, so they’re omitted rather than guessed.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePdf} disabled={busy || customRangeInvalid || data.saleCount === 0}>Download PDF report</Button>
        <Button variant="secondary" onClick={handleCsv} disabled={busy || customRangeInvalid || data.saleCount === 0}>Download CSV</Button>
      </div>
      {customRangeInvalid
        ? <p className="text-xs text-amber-400/80 mt-2">“From” is after “To” — adjust the dates to see this range.</p>
        : data.saleCount === 0 && <p className="text-xs text-slate-500 mt-2">No sales recorded in this period.</p>}

      {/* Phase 39 FAIL-04: Failures ledger sub-section — lives INSIDE Reports,
          not a new top-level tab (D-04). Grouped per printer + per material,
          plus a chronological ledger with edit/delete affordances and a
          standalone "Log failure" primary-CTA button (no job prefill, D-01). */}
      <div className="mt-8 pt-6 border-t border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h3 className="text-base font-semibold text-white">Failures</h3>
          <Button btnSize="sm" onClick={() => setShowLogFailureModal(true)}>Log failure</Button>
        </div>
        <p className="text-sm text-slate-400 mb-4">Failed prints logged from a job row, or standalone — grouped by printer and material.</p>

        {failureEvents.length === 0 ? (
          <p className="text-sm text-slate-500">No failures logged yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                <div className="text-xs text-slate-500 mb-2">By printer</div>
                <ul className="space-y-1 text-sm">
                  {failuresByPrinter.map(([name, count]) => (
                    <li key={name} className="flex justify-between text-slate-200">
                      <span>{name}</span>
                      <span className="font-mono text-slate-400">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                <div className="text-xs text-slate-500 mb-2">By material</div>
                <ul className="space-y-1 text-sm">
                  {failuresByMaterial.map(([name, count]) => (
                    <li key={name} className="flex justify-between text-slate-200">
                      <span>{name}</span>
                      <span className="font-mono text-slate-400">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ul className="space-y-2">
              {sortedFailures.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 bg-slate-800 rounded-lg p-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-slate-200">
                      {printerNameById.get(f.printerInstanceId) ?? 'Unknown printer'} — {materialNameById.get(f.materialId) ?? 'Unknown material'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatRelativeDate(f.failedAt)} · {f.percentComplete}% complete · {REASON_LABELS[f.reason] ?? f.reason}
                    </div>
                    {f.notes && <div className="text-xs text-slate-400 mt-1">{f.notes}</div>}
                  </div>
                  <DeleteButton
                    label={`failure logged ${formatRelativeDate(f.failedAt)}`}
                    onClick={() => setDeletingFailureId(f.id)}
                    className="shrink-0"
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <LogFailureModal
        isOpen={showLogFailureModal}
        onClose={() => setShowLogFailureModal(false)}
        printerInstances={printerInstances}
        filamentAssets={filamentAssets}
      />

      <ConfirmModal
        isOpen={deletingFailureId !== null}
        title="Delete failure log"
        body="Delete this failure log? This also reverses any filament stock deduction tied to it. This cannot be undone."
        onConfirm={handleConfirmDeleteFailure}
        onClose={() => setDeletingFailureId(null)}
      />
    </div>
  );
}

const REASON_LABELS: Record<FailureEvent['reason'], string> = {
  adhesion: 'Bed adhesion failure',
  stringing: 'Stringing / blobs',
  clog: 'Nozzle clog',
  mechanical: 'Mechanical failure',
  power_loss: 'Power loss',
  other: 'Other',
};

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono ${strong ? 'text-white font-semibold' : 'text-slate-200'}`}>{value}</div>
    </div>
  );
}
