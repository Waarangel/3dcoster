import { useState, useCallback, useRef, useEffect } from 'react';
import type { Asset } from '../types';
import { parseGcode, matchFilamentType, findBestFilamentMatch, readGcodeFile } from '../utils/gcodeParser';
import { NewBadge } from './NewBadge';

interface GcodeImportProps {
  assets: Asset[];
  onImport: (result: {
    filamentGrams: number;
    printTimeHours: number;
    filamentId?: string;
    printName?: string;
  }) => void;
}

const SLICER_LABELS: Record<string, string> = {
  bambu: 'Bambu Studio',
  prusa: 'PrusaSlicer',
  cura: 'Cura',
  orca: 'OrcaSlicer',
  superslicer: 'SuperSlicer',
  ideamaker: 'IdeaMaker',
  unknown: 'Unknown Slicer',
};

export function GcodeImport({ assets, onImport }: GcodeImportProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    slicer: string;
    grams: number;
    time: string;
    type: string | null;
    matched: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss success banner after 8 seconds
  useEffect(() => {
    if (!successInfo) return;
    const timer = setTimeout(() => setSuccessInfo(null), 8000);
    return () => clearTimeout(timer);
  }, [successInfo]);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gcode') && !file.name.toLowerCase().endsWith('.gc')) {
      setError('Please select a .gcode file');
      return;
    }

    setIsParsing(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const content = await readGcodeFile(file);
      const result = parseGcode(content);

      if (!result.filamentGrams && !result.printTimeHours && !result.filamentType) {
        setError('Could not extract any print data from this G-code file. The slicer format may not be supported.');
        setIsParsing(false);
        return;
      }

      // Auto-match filament from user's library
      const matchId = findBestFilamentMatch(
        result.filamentType,
        result.filamentVendor,
        assets,
        result.filamentSettingsId
      );

      // Extract print name from filename: "Body3_PETG_8h40m.gcode" → "Body3"
      const printName = file.name
        .replace(/\.(gcode|gc)$/i, '')
        .replace(/_\d+\.\d+mm.*/i, '') // Remove layer height suffix and everything after
        .replace(/_[A-Z]{2,}[^_]*.*/i, '') // Remove filament type suffix and everything after
        .replace(/_\d+h\d+m.*/i, '') // Remove time suffix like _8h40m
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const matchedType = result.filamentType
        ? matchFilamentType(result.filamentType, result.filamentSettingsId)
        : null;

      const matchedFilament = matchId ? assets.find(a => a.id === matchId) : null;

      // Auto-apply to form immediately
      onImport({
        filamentGrams: result.filamentGrams ?? 0,
        printTimeHours: result.printTimeHours ?? 0,
        filamentId: matchId ?? undefined,
        printName: printName || undefined,
      });

      // Show brief success banner
      setSuccessInfo({
        slicer: SLICER_LABELS[result.slicer] || result.slicer,
        grams: result.filamentGrams ?? 0,
        time: result.rawPrintTimeString || `${(result.printTimeHours ?? 0).toFixed(2)}h`,
        type: matchedType,
        matched: matchedFilament?.name ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? `Failed to read G-code file: ${err.message}` : 'Failed to read G-code file');
    } finally {
      setIsParsing(false);
    }
  }, [assets, onImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    if (e.target) e.target.value = '';
  }, [processFile]);

  return (
    <div className="mb-4">
      {/* Success toast — fixed position, no layout shift */}
      {successInfo && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-green-500/40 rounded-lg p-3 shadow-lg shadow-black/30 flex items-center justify-between max-w-sm animate-in">
          <div className="flex items-center gap-3 text-sm">
            <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
                {successInfo.slicer}
              </span>
              {successInfo.grams > 0 && (
                <span className="text-green-300">{successInfo.grams.toFixed(1)}g</span>
              )}
              {successInfo.time && (
                <span className="text-green-300">{successInfo.time}</span>
              )}
              {successInfo.type && (
                <span className="text-green-300">{successInfo.type}</span>
              )}
              {successInfo.matched && (
                <span className="text-slate-400">→ {successInfo.matched}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSuccessInfo(null)}
            className="text-slate-500 hover:text-slate-300 ml-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-2">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Drop zone */}
      {!isParsing && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            cursor-pointer border-2 border-dashed rounded-lg p-4 text-center transition-colors
            ${isDragOver
              ? 'border-blue-500 bg-blue-500/10 text-blue-300'
              : 'border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300'
            }
          `}
        >
          <svg className="w-6 h-6 mx-auto mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm flex items-center justify-center gap-1.5">Drop .gcode file here or click to browse <NewBadge feature="gcode-import" /></p>
          <p className="text-xs text-slate-500 mt-1">Supports Bambu Studio, PrusaSlicer, Cura, OrcaSlicer, SuperSlicer, IdeaMaker</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gcode,.gc"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Loading state */}
      {isParsing && (
        <div className="border border-slate-600 rounded-lg p-4 text-center">
          <div className="animate-spin w-5 h-5 border-2 border-slate-400 border-t-blue-500 rounded-full mx-auto mb-2" />
          <p className="text-sm text-slate-400">Parsing G-code...</p>
        </div>
      )}
    </div>
  );
}
