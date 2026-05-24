import type { PrintJob } from '../types';

/**
 * duplicateJob — pure helper for Phase 15 DUP-02 (Quick Duplicate).
 *
 * Implements the EXPLICIT-ALLOWLIST construction pattern per CONTEXT D-09
 * (lines 82–108) — every PrintJob field is either CARRIED (by-value snapshot
 * from `source`) or RESET (new value or `undefined`). The function does NOT
 * use a base spread of the source argument because that would silently
 * inherit any future PrintJob field added in a later phase, defeating the
 * threat-model mitigation T-15-03 (PII leak) and T-15-04 (silent inheritance).
 *
 * Adding a new required field to `PrintJob` in a future phase WILL produce
 * a TypeScript "property X missing in type" compile error here — that
 * compile error is the safeguard. Fix it by deciding CARRIED vs RESET and
 * adding the field to the right block; do NOT switch to a spread.
 *
 * CARRIED (by-value from source):
 *   name (with " (copy)" suffix or `nameOverride`), filaments (per-row copy),
 *   printTimeHours, printerInstanceId, modelCost, modelCostPerUnit,
 *   authorMinPrice, modelUrl, prepTimeMinutes, postProcessingMinutes,
 *   materialsUsed (per-row copy), failureRate, costPerUnit, sellingPrice,
 *   notes, tags (per TAGS-F3 — always carries), etsyChecks (shallow object
 *   copy), shippingMethod, shippingDistanceKm, shippingOverrideCost,
 *   packagingMaterials (per-row copy), marketplace.
 *
 * RESET (new value or undefined):
 *   id            → crypto.randomUUID() (jsdom-safe fallback to `job-${Date.now()}-...`)
 *   createdAt     → new Date()
 *   updatedAt     → new Date()
 *   copiesSold    → 0
 *   customer      → undefined  (PII reset — D-15 lock, DUP-02 test contract)
 *   taxRate       → undefined  (falls back to region/Settings default on next save)
 *   taxAmount     → undefined
 *   quoteNumber   → undefined  (quote numbers are per-Quote-record; new job starts fresh)
 *
 * NOT IN SCOPE — Sale and Quote records attach to the SOURCE job by
 * Sale.jobId / Quote.printJobId. The duplicate starts at 0 sales / 0
 * quotes; callers do not re-create those records.
 *
 * Note on id-generation asymmetry: CostCalculator currently uses
 * `id: \`job-${Date.now()}\`` (line 607) when creating a new job from the
 * form. Per D-09 the duplicate path uses crypto.randomUUID() instead to
 * eliminate the (tiny) chance of two simultaneous duplicates colliding on
 * a millisecond timestamp. This asymmetry is intentional, not a bug.
 *
 * No imports from `dexie` or `../db/database` — keeps this module
 * jsdom-safe for unit tests.
 *
 * Examples:
 *   duplicateJob(job) // { id: <new uuid>, customer: undefined, copiesSold: 0, name: 'X (copy)', filaments: [...], ... }
 *   duplicateJob(job, 'My Custom Name') // overrides the " (copy)" suffix
 */
export function duplicateJob(source: PrintJob, nameOverride?: string): PrintJob {
  return {
    // RESET — new values or undefined
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    copiesSold: 0,
    customer: undefined,        // PII reset — D-15 lock, DUP-02 test contract
    taxRate: undefined,         // falls back to region/Settings default on next save
    taxAmount: undefined,
    quoteNumber: undefined,     // quote numbers are per-Quote-record; new job starts fresh

    // CARRIED — by-value snapshot from source
    name: nameOverride ?? `${source.name} (copy)`,
    filaments: source.filaments.map(f => ({ ...f })),  // shallow per-row copy
    printTimeHours: source.printTimeHours,
    printerInstanceId: source.printerInstanceId,
    modelCost: source.modelCost,
    modelCostPerUnit: source.modelCostPerUnit,
    authorMinPrice: source.authorMinPrice,
    modelUrl: source.modelUrl,
    prepTimeMinutes: source.prepTimeMinutes,
    postProcessingMinutes: source.postProcessingMinutes,
    materialsUsed: source.materialsUsed.map(m => ({ ...m })),  // shallow per-row copy
    failureRate: source.failureRate,
    costPerUnit: source.costPerUnit,
    sellingPrice: source.sellingPrice,
    notes: source.notes,
    tags: source.tags ? source.tags.slice() : undefined,  // TAGS-F3 — always carries (slice() copies by value, no base spread)
    etsyChecks: source.etsyChecks ? Object.assign({}, source.etsyChecks) : undefined,
    shippingMethod: source.shippingMethod,
    shippingDistanceKm: source.shippingDistanceKm,
    shippingOverrideCost: source.shippingOverrideCost,
    packagingMaterials: source.packagingMaterials?.map(m => ({ ...m })),  // shallow per-row copy
    marketplace: source.marketplace,
  };
}

/**
 * nextCopyName — returns the next available "{base} (copy N)" name.
 *
 * Per CONTEXT D-08:
 *   - First collision-free suffix is " (copy)" (no number)
 *   - Then " (copy 2)", " (copy 3)", ... up to " (copy 99)"
 *   - At 99 the cap is SILENT — if the user has 100 copies they have
 *     bigger problems than a name collision (D-08 explicitly accepts
 *     this trade-off; T-15-05 in the threat register is `accept`)
 *
 * Pure. No side effects. `existingNames` is a ReadonlySet so callers
 * can pass either a real Set or any structurally-compatible set
 * (e.g. constructed from `new Set(jobs.map(j => j.name))`).
 *
 * Examples:
 *   nextCopyName('Phone Stand', new Set())                            // → 'Phone Stand (copy)'
 *   nextCopyName('Phone Stand', new Set(['Phone Stand (copy)']))      // → 'Phone Stand (copy 2)'
 *   nextCopyName('X', new Set(['X (copy)', 'X (copy 2)']))            // → 'X (copy 3)'
 *   nextCopyName('X', new Set(['X (copy)', ..., 'X (copy 99)']))      // → 'X (copy 99)' (silent cap)
 */
export function nextCopyName(base: string, existingNames: ReadonlySet<string>): string {
  const baseCopy = `${base} (copy)`;
  if (!existingNames.has(baseCopy)) return baseCopy;
  for (let n = 2; n <= 99; n++) {
    const candidate = `${base} (copy ${n})`;
    if (!existingNames.has(candidate)) return candidate;
  }
  return `${base} (copy 99)`;
}
