import { useId, useMemo, useState } from 'react';
import type { Sale, PrintJob, Currency } from '../types';
import type { FxRateTable } from '../utils/fxConvert';
import { formatCurrency } from '../utils/currency';
import { computeSalesReport, type SalesReportRange } from '../utils/salesReportAggregates';
import { generateSalesExportCsv, buildExportFilename } from '../utils/jobsExport';
import { downloadCsv } from '../utils/csvHelpers';
import { Button, Select, Input, useToast } from './ui';

interface ReportsSectionProps {
  allSales: Sale[];
  jobs: PrintJob[];
  userCurrency: Currency;
  fxTable: FxRateTable | null;
}

type RangeMode = 'month' | 'quarter' | 'year' | 'ytd' | 'custom';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Module-scope so the "today" default isn't an impure call during render.
function nowParts(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function endOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function ReportsSection({ allSales, jobs, userCurrency, fxTable }: ReportsSectionProps) {
  const toast = useToast();
  const [mode, setMode] = useState<RangeMode>('month');
  const [year, setYear] = useState(() => nowParts().year);
  const [month, setMonth] = useState(() => nowParts().month);
  const [quarter, setQuarter] = useState(() => Math.floor(nowParts().month / 3));
  const [customStart, setCustomStart] = useState(() => isoDay(new Date(nowParts().year, nowParts().month, 1)));
  const [customEnd, setCustomEnd] = useState(() => isoDay(new Date()));
  const [busy, setBusy] = useState(false);

  // Associate each range control with its visible label for screen readers.
  const periodId = useId();
  const monthId = useId();
  const yearId = useId();
  const quarterId = useId();
  const fromId = useId();
  const toId = useId();

  // Guard a backwards custom range (From after To) — otherwise the report just
  // shows zero with no explanation.
  const customRangeInvalid = mode === 'custom' && customEnd < customStart;

  const yearOptions = useMemo(() => {
    const cur = nowParts().year;
    const years = new Set<number>([cur]);
    for (const s of allSales) years.add(s.soldAt.getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [allSales]);

  const range = useMemo<SalesReportRange>(() => {
    if (mode === 'quarter') {
      const sm = quarter * 3;
      return {
        start: new Date(year, sm, 1, 0, 0, 0, 0),
        end: new Date(year, sm + 3, 0, 23, 59, 59, 999),
        label: `Q${quarter + 1} ${year}`,
      };
    }
    if (mode === 'year') {
      return {
        start: new Date(year, 0, 1, 0, 0, 0, 0),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
        label: String(year),
      };
    }
    if (mode === 'ytd') {
      const y = nowParts().year;
      return { start: new Date(y, 0, 1, 0, 0, 0, 0), end: endOfToday(), label: `${y} YTD` };
    }
    if (mode === 'custom') {
      const start = new Date(`${customStart}T00:00:00`);
      const end = new Date(`${customEnd}T23:59:59.999`);
      return { start, end, label: `${start.toLocaleDateString()} – ${end.toLocaleDateString()}` };
    }
    return {
      start: new Date(year, month, 1, 0, 0, 0, 0),
      end: new Date(year, month + 1, 0, 23, 59, 59, 999),
      label: `${MONTHS[month]} ${year}`,
    };
  }, [mode, year, month, quarter, customStart, customEnd]);

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

  return (
    <div>
      <h3 className="text-base font-semibold text-white mb-1">Sales report</h3>
      <p className="text-sm text-slate-400 mb-4">A tidy summary of revenue, fees and profit for any period — for tax records or a loan application.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <label htmlFor={periodId} className="block text-xs text-slate-400 mb-1">Period</label>
          <Select id={periodId} selectSize="sm" value={mode} onChange={e => setMode(e.target.value as RangeMode)}>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
            <option value="ytd">Year to date</option>
            <option value="custom">Custom range</option>
          </Select>
        </div>
        {mode === 'month' && (
          <>
            <div>
              <label htmlFor={monthId} className="block text-xs text-slate-400 mb-1">Month</label>
              <Select id={monthId} selectSize="sm" value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor={yearId} className="block text-xs text-slate-400 mb-1">Year</label>
              <Select id={yearId} selectSize="sm" value={year} onChange={e => setYear(Number(e.target.value))}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
          </>
        )}
        {mode === 'quarter' && (
          <>
            <div>
              <label htmlFor={quarterId} className="block text-xs text-slate-400 mb-1">Quarter</label>
              <Select id={quarterId} selectSize="sm" value={quarter} onChange={e => setQuarter(Number(e.target.value))}>
                {[0, 1, 2, 3].map(q => (
                  <option key={q} value={q}>Q{q + 1} ({MONTHS[q * 3].slice(0, 3)}–{MONTHS[q * 3 + 2].slice(0, 3)})</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor={yearId} className="block text-xs text-slate-400 mb-1">Year</label>
              <Select id={yearId} selectSize="sm" value={year} onChange={e => setYear(Number(e.target.value))}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
          </>
        )}
        {mode === 'year' && (
          <div>
            <label htmlFor={yearId} className="block text-xs text-slate-400 mb-1">Year</label>
            <Select selectSize="sm" value={year} onChange={e => setYear(Number(e.target.value))}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        )}
        {mode === 'custom' && (
          <>
            <div>
              <label htmlFor={fromId} className="block text-xs text-slate-400 mb-1">From</label>
              <Input id={fromId} inputSize="sm" type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor={toId} className="block text-xs text-slate-400 mb-1">To</label>
              <Input id={toId} inputSize="sm" type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 mb-4">
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
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono ${strong ? 'text-white font-semibold' : 'text-slate-200'}`}>{value}</div>
    </div>
  );
}
