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

// RED placeholders (47.1-01 Task 2): signatures only, deliberately wrong behavior
// so the new tests fail on their assertions. Replaced in the GREEN commit.
export function sanitizeManualLines(_value: unknown): ManualCostLine[] {
  return [];
}

export function normalizeManualLinesForSave(_lines: readonly ManualCostLine[]): ManualLinesSaveResult {
  return { ok: false, reason: 'missing-cost' };
}
