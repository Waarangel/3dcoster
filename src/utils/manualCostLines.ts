import type { ManualCostLine } from '../types';

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
