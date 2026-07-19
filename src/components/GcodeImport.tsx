import { useState, useCallback, useRef } from 'react';
import type { Asset, Currency } from '../types';
import { parseGcode, matchFilamentType, findBestFilamentMatch, readGcodeFile } from '../utils/gcodeParser';
import { parseThreeMf } from '../utils/threeMfParser';
import { Button, useToast } from './ui';
import { MeshEstimateCard, type MeshEstimateApplyResult } from './MeshEstimateCard';
import type { MeshEstimateWorkerMessage, MeshEstimateWorkerOutput } from '../workers/meshEstimate.worker';

interface GcodeImportProps {
  assets: Asset[];
  // D-10: density+price source for the mesh estimate — the first currently
  // selected filament row's asset, or null (PLA fallback, shown in the card).
  selectedFilament?: Asset | null;
  userCurrency?: Currency;
  currencySymbol?: string;
  onImport: (result: {
    filaments: Array<{ filamentId?: string; grams: number }>;
    printTimeHours: number;
    printName?: string;
  }) => void;
}

interface SuccessInfo {
  slicer: string;
  time: string;
  filaments: Array<{ type: string | null; matched: string | null; grams: number }>;
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

// SEC: cap 3MF size at 200 MB to prevent zip-bomb OOM (a tiny ZIP can expand to
// GB). 200 MB covers the largest real sliced 3MF files. Module scope = stable.
const MAX_THREE_MF_BYTES = 200 * 1024 * 1024;

// SEC: cap .stl size at 200 MB before handing bytes to the mesh worker — same
// ceiling as MAX_THREE_MF_BYTES above (T-44-05-01), checked here as well as
// inside meshEstimate.worker.ts (defense in depth: the worker's own cap
// covers any caller, this one avoids spinning up a worker for an obviously
// oversized file).
const MAX_STL_FILE_BYTES = 200 * 1024 * 1024;

// D-09 trust distinction: g-code/sliced-3MF numbers are exact from the
// slicer; STL/non-sliced-3MF numbers are a mesh-volume estimate. The two
// paths must never look interchangeable in the UI.
const EXACT_SOURCE_LABEL = 'exact from slicer';
const ESTIMATED_SOURCE_LABEL = 'estimated from mesh';

// Rich body for the "import succeeded" toast. The shared ToastViewport supplies
// the container, the success icon, and the dismiss button; this renders only
// the content (slicer + time + per-filament breakdown). Only used by the
// EXACT paths (g-code, sliced 3MF) — the mesh-estimate path opens
// MeshEstimateCard instead (D-12: review card, not an auto-apply toast).
function ImportSuccessToast({ info }: { info: SuccessInfo }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full">
          {info.slicer}
        </span>
        <span className="px-2 py-0.5 bg-green-900/40 text-green-300 text-xs rounded-full">
          {EXACT_SOURCE_LABEL}
        </span>
        {info.time && <span className="text-green-300">{info.time}</span>}
      </div>
      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
        {info.filaments.map((f, i) => (
          <div key={`${f.type ?? 'filament'}-${i}`} className="flex items-center gap-2">
            <span className="text-green-300">{f.grams.toFixed(1)}g</span>
            {f.type && <span className="text-green-300">{f.type}</span>}
            {f.matched && <span className="text-slate-400">-&gt; {f.matched}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Runs the mesh-estimate worker end-to-end for one file: reads it as an
 * ArrayBuffer, spins up meshEstimate.worker.ts (module worker, transferring
 * the buffer), and resolves with the parsed estimate or rejects with the
 * worker's error message. A fresh worker per parse — terminated immediately
 * after its single message — keeps this simple and avoids idle-worker
 * lifecycle management for what is an infrequent, one-shot operation.
 */
async function parseMeshEstimate(file: File, kind: 'stl' | '3mf'): Promise<MeshEstimateWorkerOutput> {
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/meshEstimate.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<MeshEstimateWorkerMessage>) => {
      worker.terminate();
      if (e.data.type === 'result') resolve(e.data.data);
      else reject(new Error(e.data.message));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error('Failed to parse mesh file'));
    };
    worker.postMessage({ buffer, kind }, [buffer]);
  });
}

interface MeshEstimateState {
  fileName: string;
  data: MeshEstimateWorkerOutput;
}

export function GcodeImport({ assets, selectedFilament, userCurrency, currencySymbol, onImport }: GcodeImportProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // D-09/D-12: the mesh-estimate review card — set only for the estimated
  // path (.stl, non-sliced .3mf). Nothing here touches the calculator form
  // until the maker clicks Apply inside the card.
  const [meshEstimate, setMeshEstimate] = useState<MeshEstimateState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleMeshApply = useCallback((result: MeshEstimateApplyResult) => {
    onImport(result);
    setMeshEstimate(null);
  }, [onImport]);

  const processStlFile = useCallback(async (file: File) => {
    // SEC: reject oversized STL files before handing bytes to the worker —
    // mirrors the MAX_THREE_MF_BYTES guard below (T-44-05-01).
    if (file.size > MAX_STL_FILE_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      setError(`File is ${sizeMb} MB. STL files must be under 200 MB.`);
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const data = await parseMeshEstimate(file, 'stl');
      setMeshEstimate({ fileName: file.name, data });
    } catch (err) {
      setError(err instanceof Error ? `Failed to parse STL: ${err.message}` : 'Failed to parse STL');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const processThreeMfFile = useCallback(async (file: File) => {
    setIsParsing(true);
    setError(null);

    try {
      const result = await parseThreeMf(file);

      if (!result.isSliced) {
        // D-09: not a slicer-sliced 3MF — route to the same mesh-estimate
        // path as .stl instead of the old "hasn't been sliced" error.
        const data = await parseMeshEstimate(file, '3mf');
        setMeshEstimate({ fileName: file.name, data });
        return;
      }

      if (result.plateCount === 0 || result.filamentsByType.length === 0) {
        setError('Could not extract print data from this 3MF. Make sure you used "Slice All" and then "Export all sliced file" in Bambu Studio or OrcaSlicer.');
        return;
      }

      // Map filamentsByType to the filaments array using asset matching
      const filaments: Array<{ filamentId?: string; grams: number }> = result.filamentsByType.map(f => ({
        filamentId: findBestFilamentMatch(f.type, null, assets, null) ?? undefined,
        grams: f.grams,
      }));

      // Extract print name from filename
      const printName = file.name
        .replace(/\.gcode\.3mf$/i, '')
        .replace(/\.3mf$/i, '')
        .replace(/_/g, ' ')
        .trim();

      onImport({
        filaments,
        printTimeHours: result.totalPrintTimeHours,
        printName: printName || undefined,
      });

      toast.success(
        <ImportSuccessToast
          info={{
            slicer: `3MF \u2014 ${result.plateCount} plate${result.plateCount !== 1 ? 's' : ''}`,
            time: `${result.totalPrintTimeHours.toFixed(2)}h`,
            filaments: result.filamentsByType.map(f => ({
              type: f.type,
              matched: (() => {
                const id = findBestFilamentMatch(f.type, null, assets, null);
                return id ? (assets.find(a => a.id === id)?.name ?? null) : null;
              })(),
              grams: f.grams,
            })),
          }}
        />,
        { duration: 8000 }
      );
    } catch (err) {
      setError(err instanceof Error ? `Failed to parse 3MF: ${err.message}` : 'Failed to parse 3MF');
    } finally {
      setIsParsing(false);
    }
  }, [assets, onImport, toast]);

  // SEC: reject oversized 3MF files before handing them to JSZip/the parser.
  // A maliciously crafted ZIP (zip-bomb) can expand gigabytes of data from a
  // small compressed blob. 200 MB covers the largest real-world sliced 3MF
  // files (Bambu multi-plate projects routinely run 50–100 MB) while keeping
  // a generous safety ceiling.
  const processFile = useCallback(async (file: File) => {
    // D-09: .stl always routes to the mesh-estimate path — there is no
    // "exact" reading for a bare mesh file (no slicer numbers exist).
    if (file.name.toLowerCase().endsWith('.stl')) {
      await processStlFile(file);
      return;
    }

    // Handle .3mf files (both .3mf and .gcode.3mf from Bambu Studio)
    if (file.name.toLowerCase().endsWith('.3mf')) {
      if (file.size > MAX_THREE_MF_BYTES) {
        const sizeMb = (file.size / 1024 / 1024).toFixed(1);
        setError(`File is ${sizeMb} MB. 3MF files must be under 200 MB.`);
        return;
      }
      await processThreeMfFile(file);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.gcode') && !file.name.toLowerCase().endsWith('.gc')) {
      setError('Please select a .gcode or .3mf file');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const content = await readGcodeFile(file);
      const result = parseGcode(content);

      if (!result.filamentGrams && !result.printTimeHours && !result.filamentType && result.filamentTypes.length === 0) {
        setError('Could not extract any print data from this G-code file. The slicer format may not be supported.');
        setIsParsing(false);
        return;
      }

      // Build per-extruder filaments array
      const filaments: Array<{ filamentId?: string; grams: number }> =
        result.filamentTypes.length > 0
          ? result.filamentTypes.map((type, i) => ({
              filamentId:
                findBestFilamentMatch(
                  type,
                  result.filamentVendors[i] ?? null,
                  assets,
                  result.filamentSettingsIds[i] ?? null
                ) ?? undefined,
              grams: result.filamentGramsPerExtruder[i] ?? 0,
            }))
          : [
              {
                filamentId:
                  findBestFilamentMatch(
                    result.filamentType,
                    result.filamentVendor,
                    assets,
                    result.filamentSettingsId
                  ) ?? undefined,
                grams: result.filamentGrams ?? 0,
              },
            ];

      // Extract print name from filename: "Body3_PETG_8h40m.gcode" → "Body3"
      const printName = file.name
        .replace(/\.(gcode|gc)$/i, '')
        .replace(/_\d+\.\d+mm.*/i, '') // Remove layer height suffix and everything after
        .replace(/_[A-Z]{2,}[^_]*.*/i, '') // Remove filament type suffix and everything after
        .replace(/_\d+h\d+m.*/i, '') // Remove time suffix like _8h40m
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Auto-apply to form immediately
      onImport({
        filaments,
        printTimeHours: result.printTimeHours ?? 0,
        printName: printName || undefined,
      });

      // Show brief success toast
      toast.success(
        <ImportSuccessToast
          info={{
            slicer: SLICER_LABELS[result.slicer] || result.slicer,
            time: result.rawPrintTimeString || `${(result.printTimeHours ?? 0).toFixed(2)}h`,
            filaments: filaments.map((f, i) => ({
              type: result.filamentTypes[i]
                ? matchFilamentType(result.filamentTypes[i], result.filamentSettingsIds[i] ?? null)
                : null,
              matched: f.filamentId ? (assets.find(a => a.id === f.filamentId)?.name ?? null) : null,
              grams: f.grams,
            })),
          }}
        />,
        { duration: 8000 }
      );
    } catch (err) {
      setError(err instanceof Error ? `Failed to read G-code file: ${err.message}` : 'Failed to read G-code file');
    } finally {
      setIsParsing(false);
    }
  }, [assets, onImport, processStlFile, processThreeMfFile, toast]);

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
      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-2 flex items-start justify-between gap-3">
          <span>{error}</span>
          <Button
            variant="ghost"
            btnSize="sm"
            onClick={() => setError(null)}
            className="underline hover:text-red-300 whitespace-nowrap shrink-0"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Mesh estimate review card (D-09/D-12) — .stl or non-sliced .3mf.
          Replaces the drop zone entirely until the maker applies or
          discards; nothing here touches the calculator form on its own. */}
      {meshEstimate && (
        <div className="mb-2">
          <p className="text-[11px] text-slate-500 mb-1 uppercase tracking-wide">{ESTIMATED_SOURCE_LABEL}</p>
          <MeshEstimateCard
            fileName={meshEstimate.fileName}
            estimate={meshEstimate.data}
            selectedFilament={selectedFilament ?? null}
            userCurrency={userCurrency ?? 'USD'}
            currencySymbol={currencySymbol ?? '$'}
            onApply={handleMeshApply}
            onDismiss={() => setMeshEstimate(null)}
          />
        </div>
      )}

      {/* Drop zone */}
      {!isParsing && !meshEstimate && (
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
          <p className="text-sm">
            Drop .gcode, .3mf, or .stl file here or click to browse
          </p>
          <p className="text-xs text-slate-500 mt-1">Supports Bambu Studio, PrusaSlicer, Cura, OrcaSlicer, SuperSlicer, IdeaMaker + Bambu/Orca 3MF projects + .stl ({ESTIMATED_SOURCE_LABEL})</p>
          {/* allow-raw-html: hidden file picker — primitive base styles would bleed through `hidden` */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".gcode,.gc,.3mf,.stl"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Loading state */}
      {isParsing && !meshEstimate && (
        <div className="border border-slate-600 rounded-lg p-4 text-center">
          <div className="animate-spin w-5 h-5 border-2 border-slate-400 border-t-blue-500 rounded-full mx-auto mb-2" />
          <p className="text-sm text-slate-400">Parsing file...</p>
        </div>
      )}
    </div>
  );
}
