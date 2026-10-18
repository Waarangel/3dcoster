import type { Asset, AssetCategory, Currency, ManualCostLine } from '../types';

// Phase 47.1: pure helpers for manual one-off cost lines. No React, no Dexie.

// Ids are persisted on the PrintJob, so they must be unique across sessions
// (a session-scoped row-key counter is NOT acceptable here). Mirrors the
// jsdom-safe fallback shape in duplicateJob.ts.
function generateLineId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * A fresh, blank one-off cost line with a persisted-unique id.
 *
 * Examples:
 *   newManualLine() // { id: '3f2b…', name: '', cost: 0 }
 */
export function newManualLine(): ManualCostLine {
  return { id: generateLineId(), name: '', cost: 0 };
}

export type ManualLinesSaveResult =
  | { ok: true; lines: ManualCostLine[] }
  | { ok: false; reason: 'missing-name' | 'missing-cost'; lineName?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Clamp to a finite, non-negative number WITHOUT rounding (drafts keep what was typed).
const clampCost = (cost: number): number => (Number.isFinite(cost) && cost > 0 ? cost : 0);

/**
 * Trust boundary for any value that did not come from this session's own UI:
 * sessionStorage drafts and saved/synced/restored job records (T-47.1-02).
 * Non-arrays become []; malformed entries are dropped; each output object is built
 * fresh from the four known keys only (never spread), so hostile keys such as
 * "__proto__"/"constructor" cannot propagate. Costs are clamped finite and >= 0
 * without rounding; duplicate ids keep the first occurrence.
 *
 * Examples:
 *   sanitizeManualLines(undefined) // []
 *   sanitizeManualLines([{ id: 'a', name: 'Auger', cost: 200, extra: 1 }]) // [{ id: 'a', name: 'Auger', cost: 200 }]
 *   sanitizeManualLines([{ id: 'a', name: 'X', cost: -4 }]) // [{ id: 'a', name: 'X', cost: 0 }]
 *
 * Returns: ManualCostLine[] (new objects; the input is never mutated).
 */
export function sanitizeManualLines(value: unknown): ManualCostLine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const lines: ManualCostLine[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const { id, name, cost, libraryPrompted } = entry;
    if (typeof id !== 'string' || id === '' || typeof name !== 'string' || typeof cost !== 'number') continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const line: ManualCostLine = { id, name, cost: clampCost(cost) };
    if (libraryPrompted === true) line.libraryPrompted = true;
    lines.push(line);
  }
  return lines;
}

/**
 * Save boundary: the single tested normalization/validation authority for one-off
 * lines. Trims names, rounds costs to cents, silently drops fully blank rows, and
 * rejects half-filled rows with the FIRST failure found.
 *
 * Examples:
 *   normalizeManualLinesForSave([{ id: 'a', name: ' Auger ', cost: 19.999 }]) // { ok: true, lines: [{ id: 'a', name: 'Auger', cost: 20 }] }
 *   normalizeManualLinesForSave([{ id: 'a', name: '', cost: 12 }]) // { ok: false, reason: 'missing-name' }
 *   normalizeManualLinesForSave([{ id: 'a', name: 'Auger', cost: 0 }]) // { ok: false, reason: 'missing-cost', lineName: 'Auger' }
 *
 * Returns: { ok: true, lines } or { ok: false, reason, lineName? }.
 */
export function normalizeManualLinesForSave(lines: readonly ManualCostLine[]): ManualLinesSaveResult {
  const normalized: ManualCostLine[] = [];
  for (const line of lines) {
    const name = line.name.trim();
    const cost = Number.isFinite(line.cost) && line.cost > 0 ? Math.round(line.cost * 100) / 100 : 0;
    if (name === '' && cost === 0) continue;
    if (name === '') return { ok: false, reason: 'missing-name' };
    if (cost === 0) return { ok: false, reason: 'missing-cost', lineName: name };
    const out: ManualCostLine = { id: line.id, name, cost };
    if (line.libraryPrompted === true) out.libraryPrompted = true;
    normalized.push(out);
  }
  return { ok: true, lines: normalized };
}

// ---------------------------------------------------------------------------
// 47.1-04: Save Job "Add to your asset library?" prompt (D-03 / D-04).
// Pure decision logic only; the orchestrator performs the writes.
// ---------------------------------------------------------------------------

export type ManualLineSection = 'postProcessing' | 'packaging';

export interface ManualLinePromptItem {
  line: ManualCostLine;
  section: ManualLineSection;
}

export interface LibraryChoice {
  lineId: string;
  section: ManualLineSection;
  add: boolean;
  category: AssetCategory;
}

/** Categories offered for a post-processing one-off (labels match AssetLibrary). */
export const POST_PROCESSING_ASSET_CATEGORIES: readonly { value: AssetCategory; label: string }[] = [
  { value: 'tool', label: 'Tools' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'consumable', label: 'Consumables' },
];

/** The founder's motivating item (an auger) is a tool. */
export const DEFAULT_POST_PROCESSING_ASSET_CATEGORY: AssetCategory = 'tool';

/**
 * Case-insensitive, trimmed comparison key for a line/asset name.
 *
 * Examples:
 *   normalizeLineName('  Auger ') // 'auger'
 */
export function normalizeLineName(name: string): string {
  return name.trim().toLowerCase();
}

interface PromptableLinesArgs {
  manualMaterials: readonly ManualCostLine[];
  manualPackaging: readonly ManualCostLine[];
  postProcessingLibrary: readonly { name: string }[];
  packagingLibrary: readonly { name: string }[];
}

/**
 * Which one-off lines should the Save Job prompt ask about (D-04)? Skips lines already
 * asked (libraryPrompted), blank names, names already in THAT section's library list
 * (case-insensitive), and repeats of the same name within a section. Post-processing
 * lines come first, then packaging.
 *
 * Examples:
 *   promptableLines({ manualMaterials: [{ id: 'a', name: 'Auger', cost: 200 }], manualPackaging: [],
 *     postProcessingLibrary: [], packagingLibrary: [] }) // [{ line: {...}, section: 'postProcessing' }]
 *   promptableLines({ manualMaterials: [{ id: 'a', name: 'small box', cost: 1 }], manualPackaging: [],
 *     postProcessingLibrary: [{ name: 'Small Box' }], packagingLibrary: [] }) // []
 *
 * Returns: ManualLinePromptItem[] (references the input line objects; nothing is copied).
 */
export function promptableLines({
  manualMaterials,
  manualPackaging,
  postProcessingLibrary,
  packagingLibrary,
}: PromptableLinesArgs): ManualLinePromptItem[] {
  const items: ManualLinePromptItem[] = [];
  const collect = (
    lines: readonly ManualCostLine[],
    library: readonly { name: string }[],
    section: ManualLineSection,
  ) => {
    const known = new Set(library.map(asset => normalizeLineName(asset.name)));
    for (const line of lines) {
      if (line.libraryPrompted === true) continue;
      const key = normalizeLineName(line.name);
      if (key === '' || known.has(key)) continue;
      known.add(key); // also dedupes repeats within the section (first kept)
      items.push({ line, section });
    }
  };
  collect(manualMaterials, postProcessingLibrary, 'postProcessing');
  collect(manualPackaging, packagingLibrary, 'packaging');
  return items;
}

/**
 * The library asset created when the user accepts a one-off (D-03: the job's line stays
 * by value; this asset only serves FUTURE jobs). One "ea" per package at the typed cost.
 * No stock fields are set (RESEARCH Open Question 6).
 *
 * Examples:
 *   buildLibraryAsset({ id: 'a', name: ' Auger ', cost: 200 }, 'postProcessing', 'tool', 'USD')
 *     // { id: 'material-…', name: 'Auger', category: 'tool', unit: 'ea', unitsPerPackage: 1, packageCost: 200, costPerUnit: 200, currency: 'USD' }
 *   buildLibraryAsset({ id: 'p', name: 'Gift wrap', cost: 3 }, 'packaging', 'tool', 'USD').category // 'packaging'
 *
 * Returns: Asset.
 */
export function buildLibraryAsset(
  line: ManualCostLine,
  section: ManualLineSection,
  category: AssetCategory,
  currency: Currency,
): Asset {
  return {
    id: `material-${generateLineId()}`,
    name: line.name.trim(),
    category: section === 'packaging' ? 'packaging' : category,
    unit: 'ea',
    unitsPerPackage: 1,
    packageCost: line.cost,
    costPerUnit: line.cost,
    currency,
  };
}

/**
 * Flags (libraryPrompted: true) every line whose normalized name is in `promptedNames`.
 * Returns new objects for flagged lines and the same reference for the rest; the input
 * array and its lines are never mutated.
 */
export function markLinesPrompted(
  lines: readonly ManualCostLine[],
  promptedNames: ReadonlySet<string>,
): ManualCostLine[] {
  return lines.map(line =>
    promptedNames.has(normalizeLineName(line.name)) ? { ...line, libraryPrompted: true } : line,
  );
}
