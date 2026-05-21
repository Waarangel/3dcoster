/**
 * Backfill `tags = []` on a job record that came from a pre-v6 schema.
 *
 * Used by the v6 Dexie upgrade callback in `database.ts` (Plan 03). Extracted
 * as a pure function so it can be unit-tested under jsdom (Vitest's environment),
 * which does NOT implement IndexedDB and therefore cannot run a full Dexie
 * migration test (RESEARCH Pitfall 3).
 *
 * Uses `Array.isArray` (not `??=`) so a manually-edited IndexedDB row with
 * `tags: "some-string"` or `tags: 42` is also normalised to `[]`.
 * The nullish-coalesce-assign operator (`??=`) only catches `null`/`undefined`;
 * the `Array.isArray` guard handles all non-array corruption modes that DevTools
 * can produce (RESEARCH Pitfall 5).
 *
 * No imports from `dexie` or `./database` — keeps this module jsdom-safe so
 * the sibling test can `import { backfillTagsOnJob } from './backfill'` without
 * triggering the `new Dexie('3DCosterDB')` top-level side effect (RESEARCH Pitfall 4).
 *
 * Examples:
 *   const j = {}; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: ['a', 'b'] }; backfillTagsOnJob(j); // j.tags === ['a', 'b'] (unchanged)
 *   const j = { tags: 'oops' }; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: null }; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: 42 }; backfillTagsOnJob(j); // j.tags === []
 */
export function backfillTagsOnJob(job: Record<string, unknown>): void {
  if (!Array.isArray(job.tags)) job.tags = [];
}
