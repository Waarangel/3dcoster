import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal } from './ui';
import {
  parseCustomerCsv,
  buildCustomersForImport,
  type ParsedCustomerRow,
  type CustomerCsvParseResult,
} from '../utils/customerCsv';
import { generateSampleCustomerCsv, downloadCsv } from '../utils/csvHelpers';
import type { Customer } from '../types';

/**
 * Phase 15.1 — CL-03 customer CSV importer modal.
 *
 * Sibling of `CsvImportModal.tsx` (assets) — not a genericized CsvImportModal<T>
 * per D-08. Same two-step Upload → Preview flow, same outer chrome, but a
 * customer-specific parser/validator/row renderer and submit handler.
 *
 * Locked copy is sourced verbatim from UI-SPEC §Copywriting Contract.
 */

interface CustomerCsvImportModalProps {
  isOpen: boolean;
  existingCustomers: Customer[];
  onImportCustomers: (toImport: Customer[]) => Promise<void>;
  onClose: () => void;
}

type Step = 'upload' | 'preview';

// SEC: cap raw CSV size at 5 MB (zip-bomb / renamed-binary guard). Module scope
// = stable identity, so the file handler's useCallback needs no dependency on it.
const MAX_CSV_BYTES = 5 * 1024 * 1024;

export function CustomerCsvImportModal({
  isOpen,
  existingCustomers,
  onImportCustomers,
  onClose,
}: CustomerCsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CustomerCsvParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite'>('skip');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on close — Modal unmounts children, but explicit reset is clearer.
  useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setIsDragOver(false);
      setError(null);
      setParseResult(null);
      setSelected(new Set());
      setDuplicateMode('skip');
      setIsImporting(false);
    }
  }, [isOpen]);

  // ---- File processing ----------------------------------------------------
  // WR-06 fix: cap raw CSV size at 5 MB so a stray Excel/log file renamed
  // to .csv can't pull a 200 MB blob into memory and crash the tab on
  // low-RAM devices. Customer CSVs at the scales we target (hundreds to
  // a few thousand rows) are well under this cap; users with larger
  // datasets are nudged to split into batches.
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a .csv file.');
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      setError(
        `File is ${sizeMb} MB. Keep customer CSVs under 5 MB — split a larger file into smaller batches.`
      );
      return;
    }
    setError(null);
    try {
      const text = await file.text();
      const result = await parseCustomerCsv(text, existingCustomers);
      if (result.globalErrors.length > 0 && result.rows.length === 0) {
        setError(result.globalErrors.join('\n'));
        return;
      }
      setParseResult(result);
      // Pre-select all valid, non-duplicate rows.
      const initialSelection = new Set<number>();
      for (const row of result.rows) {
        if (row.customer && row.errors.length === 0) {
          initialSelection.add(row.rowNumber);
        }
      }
      setSelected(initialSelection);
      setStep('preview');
    } catch {
      setError("Failed to read CSV file. Check the file isn't corrupted and try again.");
    }
  }, [existingCustomers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input value so picking the same file twice re-fires onChange.
    if (e.target) e.target.value = '';
  }, [processFile]);

  // ---- Selection helpers ---------------------------------------------------
  const toggleRow = useCallback((rowNumber: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }, []);

  // ---- Derived state -------------------------------------------------------
  const stats = useMemo(() => {
    if (!parseResult) return { total: 0, okCount: 0, dupCount: 0, errCount: 0 };
    let okCount = 0;
    let dupCount = 0;
    let errCount = 0;
    for (const row of parseResult.rows) {
      if (row.errors.length > 0) errCount++;
      if (row.isDuplicate) dupCount++;
      if (row.customer && !row.isDuplicate && row.errors.length === 0) okCount++;
    }
    return { total: parseResult.rows.length, okCount, dupCount, errCount };
  }, [parseResult]);

  // importCount = rows that will actually land in db.customers.bulkPut.
  // Mirrors buildCustomersForImport's skip rules — kept in sync for the button label.
  const importCount = useMemo(() => {
    if (!parseResult) return 0;
    let count = 0;
    for (const row of parseResult.rows) {
      if (!row.customer) continue;
      if (!selected.has(row.rowNumber)) continue;
      if (row.isDuplicate && duplicateMode === 'skip') continue;
      count++;
    }
    return count;
  }, [parseResult, selected, duplicateMode]);

  // ---- Import handler ------------------------------------------------------
  const handleImport = useCallback(async () => {
    if (!parseResult || importCount === 0) return;
    const existingById = new Map<string, Customer>();
    for (const c of existingCustomers) existingById.set(c.id, c);
    const toImport = buildCustomersForImport(parseResult.rows, existingById, selected, duplicateMode);
    setIsImporting(true);
    try {
      await onImportCustomers(toImport);
      onClose();
    } catch (e) {
      setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsImporting(false);
    }
  }, [parseResult, importCount, existingCustomers, selected, duplicateMode, onImportCustomers, onClose]);

  // ---- Render --------------------------------------------------------------
  // WR-04 fix: the Back button used to be smuggled inside the `title` prop,
  // which put a <Button> inside <h3>. That polluted the dialog's accessible
  // name (aria-labelledby on the dialog points at the h3, so screen readers
  // would read "Back to upload Preview customer import"). Move the button
  // to Modal's new `headerLeft` slot so it sits OUTSIDE the heading.
  const title = step === 'upload' ? 'Import customers from CSV' : 'Preview customer import';
  const headerLeft = step === 'preview' ? (
    <Button
      variant="ghost"
      btnSize="sm"
      onClick={() => { setStep('upload'); setParseResult(null); setError(null); }}
      aria-label="Back to upload"
      title="Back to upload"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </Button>
  ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} headerLeft={headerLeft} size="xl">
      {/* Body */}
      <div className="p-4">
        {step === 'upload' && (
          <UploadStep
            isDragOver={isDragOver}
            error={error}
            fileInputRef={fileInputRef}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
          />
        )}

        {step === 'preview' && parseResult && (
          <PreviewStep
            parseResult={parseResult}
            stats={stats}
            selected={selected}
            duplicateMode={duplicateMode}
            onToggleRow={toggleRow}
            onDuplicateModeChange={setDuplicateMode}
            error={error}
          />
        )}
      </div>

      {/* Footer (preview only) */}
      {step === 'preview' && (
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={importCount === 0 || isImporting}
          >
            {isImporting
              ? 'Importing...'
              : `Import ${importCount} customer${importCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </Modal>
  );
}

// =============================================================================
// UPLOAD STEP
// =============================================================================

interface UploadStepProps {
  isDragOver: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function UploadStep({
  isDragOver,
  error,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
}: UploadStepProps) {
  return (
    <div className="space-y-4">
      {/* Template download */}
      <div className="bg-slate-700/50 rounded-lg p-3">
        <p className="text-sm text-slate-300 mb-2">Download a sample template to get started:</p>
        <Button
          type="button"
          variant="ghost"
          btnSize="sm"
          onClick={async () => downloadCsv(await generateSampleCustomerCsv(), 'customer-template.csv')}
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          👥 Customer template
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 whitespace-pre-line">
          {error}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-500/10 text-blue-300'
            : 'border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300'
        }`}
      >
        <svg className="w-12 h-12 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm font-medium">Drop a .csv file here, or click to browse</p>
        {/* allow-raw-html: hidden file picker — primitive base styles would bleed through `hidden` */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {/* Accepted columns reference */}
      <p className="text-xs text-slate-400 mt-4">
        Accepted columns: name, email, company, address, notes. Column order doesn&apos;t matter. Headers are case-insensitive. Either name or email is required per row.
      </p>
    </div>
  );
}

// =============================================================================
// PREVIEW STEP
// =============================================================================

interface PreviewStats {
  total: number;
  okCount: number;
  dupCount: number;
  errCount: number;
}

interface PreviewStepProps {
  parseResult: CustomerCsvParseResult;
  stats: PreviewStats;
  selected: Set<number>;
  duplicateMode: 'skip' | 'overwrite';
  onToggleRow: (rowNumber: number) => void;
  onDuplicateModeChange: (mode: 'skip' | 'overwrite') => void;
  error: string | null;
}

function PreviewStep({
  parseResult,
  stats,
  selected,
  duplicateMode,
  onToggleRow,
  onDuplicateModeChange,
  error,
}: PreviewStepProps) {
  return (
    <div className="space-y-4">
      {/* Global parser warnings */}
      {parseResult.globalErrors.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
          {parseResult.globalErrors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      {/* Import error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats line */}
      <p className="text-sm text-slate-400">
        Found {stats.total} rows · {stats.okCount} ready to import · {stats.dupCount} duplicates · {stats.errCount} with errors
      </p>

      {/* Duplicate-mode radio + explainer (always rendered per D-10) */}
      <div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">Duplicates:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            {/* allow-raw-html: native radio grouping via name= attribute; accent-blue-500 would break under Input base styles (L-4) */}
            <input
              type="radio"
              name="customerDuplicateMode"
              checked={duplicateMode === 'skip'}
              onChange={() => onDuplicateModeChange('skip')}
              className="accent-blue-500"
            />
            <span className="text-slate-300">Skip duplicates</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            {/* allow-raw-html: native radio grouping via name= attribute; accent-blue-500 would break under Input base styles (L-4) */}
            <input
              type="radio"
              name="customerDuplicateMode"
              checked={duplicateMode === 'overwrite'}
              onChange={() => onDuplicateModeChange('overwrite')}
              className="accent-blue-500"
            />
            <span className="text-slate-300">Update duplicates</span>
          </label>
        </div>
        {duplicateMode === 'skip' ? (
          <p className="text-xs text-slate-400 mt-1">
            Existing customers matched by email will not change.
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-1">
            Existing customers matched by email will be updated (only non-empty incoming fields overwrite — empty cells keep existing values).
          </p>
        )}
      </div>

      {/* Row list */}
      <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
        {/* IN-05: pass the memoized onToggleRow directly (stable identity from useCallback)
            so RowItem's React.memo can skip re-renders when its row props are unchanged.
            Previously a fresh `() => onToggleRow(row.rowNumber)` arrow per render busted
            referential equality and re-rendered every row on every toggle. */}
        {parseResult.rows.map(row => (
          <RowItem
            key={row.rowNumber}
            row={row}
            isSelected={selected.has(row.rowNumber)}
            onToggle={onToggleRow}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ROW ITEM
// =============================================================================

// IN-05: React.memo + (rowNumber) signature for onToggle so toggling one row
// doesn't re-render the other 999 rows in a 1000-row CSV import. The parent
// passes the memoized `onToggleRow` from useCallback (stable identity), and
// each RowItem captures its own rowNumber via the `row` prop — so as long
// as a given row's `row`, `isSelected`, and `onToggle` references are
// unchanged, the row skips re-render.
const RowItem = memo(function RowItem({
  row,
  isSelected,
  onToggle,
}: {
  row: ParsedCustomerRow;
  isSelected: boolean;
  onToggle: (rowNumber: number) => void;
}) {
  const hasErrors = row.errors.length > 0;
  const isInvalid = row.customer === null;

  const name = row.customer?.name || row.data.name?.trim() || '(no name)';
  const subline = [row.customer?.email || row.data.email?.trim(), row.customer?.company || row.data.company?.trim()]
    .filter(Boolean)
    .join(' · ');

  // Bind rowNumber at the row level; passing the stable onToggle reference
  // up to React.memo is what avoids the per-row arrow allocation. The local
  // handler is recreated when row.rowNumber or onToggle changes — both rare.
  const handleChange = useCallback(() => {
    onToggle(row.rowNumber);
  }, [onToggle, row.rowNumber]);

  return (
    <div
      className={`flex items-start gap-3 p-2.5 rounded-lg border text-sm transition-colors ${
        hasErrors
          ? 'border-red-500/20 bg-red-500/5'
          : row.isDuplicate
            ? 'border-yellow-500/20 bg-yellow-500/5'
            : 'border-slate-700 bg-slate-700/30'
      }`}
    >
      {/* allow-raw-html: row-selection checkbox; accent-blue-500 would break under Input base styles (L-4) */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleChange}
        disabled={isInvalid}
        className="mt-0.5 accent-blue-500 disabled:opacity-30"
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{name}</div>
        {subline && (
          <div className="text-xs text-slate-400 truncate">{subline}</div>
        )}
      </div>

      {/* Status chip */}
      <div className="shrink-0">
        {hasErrors ? (
          <span className="text-xs px-2 py-0.5 rounded border bg-red-500/20 text-red-400 border-red-500/30">
            Error: {row.errors[0]}
          </span>
        ) : row.isDuplicate ? (
          <span className="text-xs px-2 py-0.5 rounded border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            Duplicate
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded border bg-green-500/20 text-green-400 border-green-500/30">
            OK
          </span>
        )}
      </div>
    </div>
  );
});
