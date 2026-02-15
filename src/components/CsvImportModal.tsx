import { useState, useCallback, useRef, useEffect } from 'react';
import type { Asset } from '../types';
import {
  parseCsvFile,
  generateSampleCsv,
  downloadCsv,
  buildAssetsForImport,
  type ParsedRow,
  type CsvParseResult,
} from '../utils/csvHelpers';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAssets: Asset[];
  onImportAssets: (assets: Asset[]) => Promise<void>;
}

type Step = 'upload' | 'preview';

export function CsvImportModal({ isOpen, onClose, existingAssets, onImportAssets }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite'>('skip');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setError(null);
      setParseResult(null);
      setSelected(new Set());
      setDuplicateMode('skip');
      setIsImporting(false);
      setIsDragOver(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Process uploaded CSV file
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a .csv file');
      return;
    }

    setError(null);

    try {
      const text = await file.text();
      const result = parseCsvFile(text, existingAssets);

      if (result.globalErrors.length > 0 && result.rows.length === 0) {
        setError(result.globalErrors.join('\n'));
        return;
      }

      setParseResult(result);

      // Pre-select all valid, non-duplicate rows
      const validIndices = new Set<number>();
      for (const row of result.rows) {
        if (row.asset && row.errors.length === 0) {
          validIndices.add(row.rowNumber);
        }
      }
      setSelected(validIndices);
      setStep('preview');
    } catch {
      setError('Failed to read CSV file');
    }
  }, [existingAssets]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (e.target) e.target.value = '';
  }, [processFile]);

  // Selection helpers
  const toggleRow = (rowNumber: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!parseResult) return;
    const all = new Set<number>();
    for (const row of parseResult.rows) {
      if (row.asset && row.errors.length === 0) {
        all.add(row.rowNumber);
      }
    }
    setSelected(all);
  };

  const deselectAll = () => setSelected(new Set());

  // Import handler
  const handleImport = async () => {
    if (!parseResult) return;
    setIsImporting(true);

    try {
      const assets = buildAssetsForImport(parseResult.rows, selected, duplicateMode);
      await onImportAssets(assets);
      onClose();
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsImporting(false);
    }
  };

  // Stats
  const stats = parseResult ? computeStats(parseResult.rows) : null;
  const importCount = parseResult
    ? buildAssetsForImport(parseResult.rows, selected, duplicateMode).length
    : 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {step === 'preview' && (
              <button
                onClick={() => { setStep('upload'); setParseResult(null); setError(null); }}
                className="text-slate-400 hover:text-white transition-colors"
                title="Back to upload"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h3 className="text-lg font-semibold text-white">
              {step === 'upload' ? 'Import Assets from CSV' : 'Preview Import'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'upload' && (
            <UploadStep
              isDragOver={isDragOver}
              error={error}
              fileInputRef={fileInputRef}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onFileSelect={handleFileSelect}
              onDismissError={() => setError(null)}
            />
          )}

          {step === 'preview' && parseResult && stats && (
            <PreviewStep
              parseResult={parseResult}
              stats={stats}
              selected={selected}
              duplicateMode={duplicateMode}
              onToggleRow={toggleRow}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onDuplicateModeChange={setDuplicateMode}
              error={error}
              onDismissError={() => setError(null)}
            />
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="shrink-0 flex items-center justify-between p-4 border-t border-slate-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importCount === 0 || isImporting}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isImporting
                ? 'Importing...'
                : `Import ${importCount} Asset${importCount !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// UPLOAD STEP
// ============================================

interface UploadStepProps {
  isDragOver: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDismissError: () => void;
}

function UploadStep({
  isDragOver, error, fileInputRef,
  onDragOver, onDragLeave, onDrop, onFileSelect, onDismissError,
}: UploadStepProps) {
  return (
    <div className="space-y-4">
      {/* Template download links */}
      <div className="bg-slate-700/50 rounded-lg p-3">
        <p className="text-sm text-slate-300 mb-2">Download a sample template to get started:</p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => downloadCsv(generateSampleCsv('material'), '3dcoster-materials-template.csv')}
            className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            📦 Materials template
          </button>
          <button
            onClick={() => downloadCsv(generateSampleCsv('printer'), '3dcoster-printers-template.csv')}
            className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            🖨️ Printers template
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
          <button onClick={onDismissError} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          cursor-pointer border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver
            ? 'border-blue-500 bg-blue-500/10 text-blue-300'
            : 'border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300'
          }
        `}
      >
        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm font-medium">Drop .csv file here or click to browse</p>
        <p className="text-xs text-slate-500 mt-1">
          Supports materials, consumables, finishing, tools, packaging, and printers
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {/* Help text */}
      <div className="text-xs text-slate-500 space-y-1">
        <p><strong>Tip:</strong> Use pipe <code className="bg-slate-700 px-1 rounded">|</code> to separate tags (e.g., <code className="bg-slate-700 px-1 rounded">pla|white|1kg</code>)</p>
        <p>Supported currencies: CAD, USD, EUR, GBP, AUD, NZD, CHF, SEK, NOK, DKK, PLN, CZK, JPY, CNY, INR, BRL, MXN, ZAR</p>
      </div>
    </div>
  );
}

// ============================================
// PREVIEW STEP
// ============================================

interface Stats {
  total: number;
  valid: number;
  errors: number;
  duplicates: number;
}

function computeStats(rows: ParsedRow[]): Stats {
  let valid = 0;
  let errors = 0;
  let duplicates = 0;
  for (const row of rows) {
    if (row.errors.length > 0) {
      errors++;
    } else {
      valid++;
    }
    if (row.isDuplicate) duplicates++;
  }
  return { total: rows.length, valid, errors, duplicates };
}

interface PreviewStepProps {
  parseResult: CsvParseResult;
  stats: Stats;
  selected: Set<number>;
  duplicateMode: 'skip' | 'overwrite';
  onToggleRow: (rowNumber: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDuplicateModeChange: (mode: 'skip' | 'overwrite') => void;
  error: string | null;
  onDismissError: () => void;
}

function PreviewStep({
  parseResult, stats, selected, duplicateMode,
  onToggleRow, onSelectAll, onDeselectAll, onDuplicateModeChange,
  error, onDismissError,
}: PreviewStepProps) {
  return (
    <div className="space-y-4">
      {/* Global errors from parsing */}
      {parseResult.globalErrors.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
          {parseResult.globalErrors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
          <button onClick={onDismissError} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 text-xs rounded-full bg-slate-700 text-slate-300">
          {stats.total} total
        </span>
        <span className="px-2.5 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
          {stats.valid} valid
        </span>
        {stats.errors > 0 && (
          <span className="px-2.5 py-1 text-xs rounded-full bg-red-500/20 text-red-400">
            {stats.errors} error{stats.errors !== 1 ? 's' : ''}
          </span>
        )}
        {stats.duplicates > 0 && (
          <span className="px-2.5 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
            {stats.duplicates} duplicate{stats.duplicates !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Duplicate handling + selection controls */}
      <div className="flex flex-wrap items-center gap-4">
        {stats.duplicates > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Duplicates:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="duplicateMode"
                checked={duplicateMode === 'skip'}
                onChange={() => onDuplicateModeChange('skip')}
                className="accent-blue-500"
              />
              <span className="text-slate-300">Skip</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="duplicateMode"
                checked={duplicateMode === 'overwrite'}
                onChange={() => onDuplicateModeChange('overwrite')}
                className="accent-blue-500"
              />
              <span className="text-slate-300">Update existing</span>
            </label>
          </div>
        )}

        <div className="flex gap-2 ml-auto">
          <button
            onClick={onSelectAll}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Select all valid
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={onDeselectAll}
            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            Deselect all
          </button>
        </div>
      </div>

      {/* Row list */}
      <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
        {parseResult.rows.map(row => (
          <RowItem
            key={row.rowNumber}
            row={row}
            isSelected={selected.has(row.rowNumber)}
            onToggle={() => onToggleRow(row.rowNumber)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// ROW ITEM
// ============================================

function RowItem({ row, isSelected, onToggle }: { row: ParsedRow; isSelected: boolean; onToggle: () => void }) {
  const hasErrors = row.errors.length > 0;
  const isValid = !hasErrors && row.asset;

  return (
    <div className={`
      flex items-start gap-3 p-2.5 rounded-lg border text-sm transition-colors
      ${hasErrors
        ? 'border-red-500/20 bg-red-500/5'
        : row.isDuplicate
          ? 'border-yellow-500/20 bg-yellow-500/5'
          : 'border-slate-700 bg-slate-700/30'
      }
    `}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        disabled={hasErrors}
        className="mt-0.5 accent-blue-500 disabled:opacity-30"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-medium truncate">
            {row.data.name || '(unnamed)'}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-slate-300">
            {row.data.category || '?'}
          </span>
          {row.data.brand && (
            <span className="text-xs text-slate-400">{row.data.brand}</span>
          )}

          {/* Status badge */}
          {hasErrors && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Error</span>
          )}
          {isValid && row.isDuplicate && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Duplicate</span>
          )}
          {isValid && !row.isDuplicate && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">New</span>
          )}
        </div>

        {/* Cost info */}
        {isValid && row.asset && (
          <div className="text-xs text-slate-400 mt-0.5">
            {row.asset.category === 'printer'
              ? `$${row.asset.purchasePrice} · ${row.asset.wattage}W`
              : row.asset.packageCost !== undefined && row.asset.unitsPerPackage !== undefined
                ? `$${row.asset.packageCost} / ${row.asset.unitsPerPackage} ${row.asset.unit || 'units'}`
                : ''
            }
            {row.asset.currency && ` (${row.asset.currency})`}
          </div>
        )}

        {/* Errors */}
        {hasErrors && (
          <div className="text-xs text-red-400 mt-1">
            {row.errors.map((e, i) => <span key={i} className="block">⚠ {e}</span>)}
          </div>
        )}

        {/* Warnings */}
        {row.warnings.length > 0 && (
          <div className="text-xs text-yellow-400 mt-1">
            {row.warnings.map((w, i) => <span key={i} className="block">⚠ {w}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
