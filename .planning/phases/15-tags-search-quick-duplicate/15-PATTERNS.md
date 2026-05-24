# Phase 15: Tags, Search + Quick Duplicate — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8 (all exact role + data-flow matches inside this repo)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/utils/duplicateJob.ts` (NEW) | utility (pure helper) | transform | `src/db/backfill.ts` (`backfillQuotesFromJobs`) | exact role + same purity contract |
| `src/utils/duplicateJob.test.ts` (NEW) | test | transform | `src/db/backfill.test.ts` (`backfillTagsOnJob` block) | exact |
| `src/db/backfill.ts` (MODIFY — add `normalizeTagsOnJob`) | utility (pure helper) | transform | `backfillTagsOnJob` in same file | exact — sibling pattern |
| `src/db/backfill.test.ts` (MODIFY — add `normalizeTagsOnJob` block) | test | transform | existing `backfillTagsOnJob` describe block (lines 5–35) | exact |
| `src/hooks/useDatabase.ts` (MODIFY — wire `normalizeTagsOnJob` into `useJobs` init) | hook (init/reconcile wiring) | event-driven (one-shot useEffect) | `useJobs` `copiesSoldReconcileRan` block (lines 14–16, 443–485) | exact — verbatim template |
| `src/components/CostCalculator.tsx` (MODIFY — add tag input near Print Name) | component (form field) | request-response (user input) | Print Name field block (lines 754–763) + Model URL block (lines 788–801, has `<NewBadge>`) | exact |
| `src/components/JobsManager.tsx` (MODIFY — search bar, chip filter, `[⋯]` menu, inline tag edit, cache key, tag chips on summary) | component (multi-surface) | request-response + state filter + overflow menu | per-surface analogs below | mixed exact |
| `src/features.ts` (MODIFY — 3 new entries) | config (registry) | static | existing entries (lines 5–15) | exact |

---

## Pattern Assignments

### 1. `src/utils/duplicateJob.ts` (NEW — utility, transform)

**Analog:** `src/db/backfill.ts` — `backfillQuotesFromJobs` (lines 63–125) for the pure-explicit-construction pattern.
**Why this and NOT a spread:** D-09 lock — explicit allowlist prevents silently inheriting new `PrintJob` fields added in future phases. The `backfillQuotesFromJobs` precedent constructs an explicit `out.push({ id: …, quoteNumber: …, … })` literal (line 95) instead of spreading the source — this is the exact pattern to mirror.

**Pure-helper module conventions** (from `backfillTagsOnJob` JSDoc at `src/db/backfill.ts:1–30`):
```typescript
import type { PrintJob, Sale, Quote, QuoteStatus, Customer } from '../types';

/**
 * [one-line description]
 *
 * Examples:
 *   const j = {}; backfillTagsOnJob(j); // j.tags === []
 *   const j = { tags: ['a', 'b'] }; backfillTagsOnJob(j); // unchanged
 *
 * No imports from `dexie` or `./database` — keeps this module jsdom-safe so
 * the sibling test can import it without triggering the `new Dexie(...)`
 * top-level side effect.
 */
```

**ID generation convention** (from `src/hooks/useDatabase.ts:803–805`):
```typescript
id: typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `customer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
```
NOTE: CostCalculator currently uses `id: \`job-${Date.now()}\`` (line 607) for jobs. D-09 says use `crypto.randomUUID()`. Follow the useDatabase pattern with the `typeof crypto !== 'undefined'` guard for jsdom safety in tests.

**Explicit-allowlist construction template** (mirror this shape — D-09 carries vs resets are spelled out in CONTEXT D-09):
```typescript
// Build the duplicate with explicit field-by-field assignment. Do NOT spread the source.
// Every PrintJob field is either CARRIED (listed below) or RESET (listed in the second block).
// Adding a new field to PrintJob in a future phase WILL force a compile review here — that's the point.
export function duplicateJob(source: PrintJob, nameOverride?: string): PrintJob {
  return {
    // RESET (new values)
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    copiesSold: 0,
    customer: undefined,        // PII reset — D-09 lock, DUP-02 test contract
    taxRate: undefined,         // falls back to region/Settings default on next save
    taxAmount: undefined,
    quoteNumber: undefined,     // quote numbers are per-Quote-record; new job starts fresh

    // CARRIED (by-value snapshot from source)
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
    materialsUsed: source.materialsUsed.map(m => ({ ...m })),
    failureRate: source.failureRate,
    costPerUnit: source.costPerUnit,
    sellingPrice: source.sellingPrice,
    notes: source.notes,
    tags: source.tags ? [...source.tags] : undefined,  // TAGS-F3 — always carries
    etsyChecks: source.etsyChecks ? { ...source.etsyChecks } : undefined,
    shippingMethod: source.shippingMethod,
    shippingDistanceKm: source.shippingDistanceKm,
    shippingOverrideCost: source.shippingOverrideCost,
    packagingMaterials: source.packagingMaterials?.map(m => ({ ...m })),
    marketplace: source.marketplace,
  };
}
```

**Name-collision helper** (D-08 — separate pure function so the caller can pass the current jobs list):
```typescript
// Returns the next available "{base} (copy N)" name, capped at 99.
// Cap is silent — at 100 copies the user has bigger problems than a name collision.
export function nextCopyName(base: string, existingNames: ReadonlySet<string>): string {
  const baseCopy = `${base} (copy)`;
  if (!existingNames.has(baseCopy)) return baseCopy;
  for (let n = 2; n <= 99; n++) {
    const candidate = `${base} (copy ${n})`;
    if (!existingNames.has(candidate)) return candidate;
  }
  return `${base} (copy 99)`;
}
```

---

### 2. `src/utils/duplicateJob.test.ts` (NEW — test, transform)

**Analog:** `src/db/backfill.test.ts:46–77` (`makeMinimalJob` fixture) + lines 5–35 (`backfillTagsOnJob describe` block).

**Imports template** (`src/db/backfill.test.ts:1–3`):
```typescript
import { describe, it, expect } from 'vitest';
import { duplicateJob, nextCopyName } from './duplicateJob';
import type { PrintJob } from '../types';
```

**Fixture factory template** (mirror `src/db/backfill.test.ts:46–65`):
```typescript
function makeMinimalJob(overrides: Partial<PrintJob>): PrintJob {
  return {
    id: 'job-x',
    name: 'Job X',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    filaments: [],
    printTimeHours: 1,
    printerInstanceId: 'p-1',
    modelCost: 0,
    prepTimeMinutes: 0,
    postProcessingMinutes: 0,
    materialsUsed: [],
    failureRate: 0,
    costPerUnit: 1,
    sellingPrice: 10,
    copiesSold: 0,
    ...overrides,
  } as PrintJob;
}
```

**D-15 LOCKED test contract** (copy verbatim from CONTEXT.md lines 149–159):
```typescript
describe('duplicateJob (DUP-02 D-15 locked contract)', () => {
  const jobWithCustomerAndTaxRate = makeMinimalJob({
    id: 'job-original',
    name: 'Original',
    createdAt: new Date('2026-01-01'),
    customer: { name: 'Alice', email: 'alice@example.com' },
    taxRate: 13,
    taxAmount: 1.30,
    copiesSold: 5,
    tags: ['phone-stand', 'pla'],
  });

  it('resets PII, tax, copiesSold, id; preserves tags (TAGS-F3)', () => {
    const dup = duplicateJob(jobWithCustomerAndTaxRate);
    expect(dup.customer).toBeUndefined();
    expect(dup.taxRate).toBeUndefined();
    expect(dup.copiesSold).toBe(0);
    expect(dup.id).not.toBe(jobWithCustomerAndTaxRate.id);
    expect(dup.createdAt.getTime()).toBeGreaterThan(jobWithCustomerAndTaxRate.createdAt.getTime());
    expect(dup.tags).toEqual(jobWithCustomerAndTaxRate.tags);  // TAGS-F3 lock
  });
});
```

**Additional coverage** (not in D-15 but required for D-08 and D-09 completeness):
- `nextCopyName` returns `"X (copy)"` when no collision, `"X (copy 2)"` when `"X (copy)"` exists, `"X (copy 99)"` cap behaviour.
- Filaments / materialsUsed arrays are copied by value — mutating `dup.filaments[0]` does NOT mutate `source.filaments[0]`.
- `quoteNumber: undefined` even when source had one.

---

### 3. `src/db/backfill.ts` (MODIFY — add `normalizeTagsOnJob`)

**Analog:** `backfillTagsOnJob` at lines 28–30 in the SAME file. Mirror the JSDoc convention exactly.

**Existing sibling for reference** (`src/db/backfill.ts:21–30`):
```typescript
/**
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
```

**`normalizeTagsOnJob` template** (per D-02 + D-12 — must apply the SAME normalize rules the input parser will use, so the two paths can't drift):
```typescript
/**
 * normalizeTagsOnJob — Phase 15 D-12 reconcile (per [[reconcile-legacy-data]]).
 *
 * Phase 12's backfillTagsOnJob set tags=[] but never enforced D-02's normalization
 * rules (lowercase + trim + dedupe + cap-at-10 + whitelist /[^a-z0-9\s\-_]/g)
 * because those rules didn't exist yet. Any pre-Phase-15 record with hand-edited
 * tags via DevTools could carry uppercase, untrimmed, or punctuation-laced values
 * that the chip filter would treat as distinct from their normalized equivalents.
 *
 * Pure. Idempotent — no-op when tags already conform. Returns true if a write
 * is needed (caller decides whether to bulkPut), false otherwise.
 *
 * Mirrors the SAME normalization rules the CostCalculator + JobsManager inline
 * tag inputs apply on save (D-02). The shared normalizer SHOULD be extracted
 * to one place (this file is the natural home — the input parsers can import it).
 *
 * Examples:
 *   normalizeTagsOnJob({ tags: ['PLA', ' phone-stand '] }) → mutates to ['pla', 'phone-stand'], returns true
 *   normalizeTagsOnJob({ tags: ['pla', 'pla', 'pla'] })   → mutates to ['pla'], returns true
 *   normalizeTagsOnJob({ tags: ['pla'] })                  → no change, returns false
 *   normalizeTagsOnJob({ tags: undefined })                → no change, returns false
 */
export function normalizeTagsOnJob(job: { tags?: string[] }): boolean {
  if (!Array.isArray(job.tags)) return false;  // backfillTagsOnJob already ran; nothing to normalize
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of job.tags) {
    if (typeof raw !== 'string') continue;
    const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9\s\-_]/g, '');
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(normalized);
    if (cleaned.length >= 10) break;  // D-02 cap
  }
  // Idempotency check — bail out without mutating when input is already canonical.
  if (cleaned.length === job.tags.length && cleaned.every((t, i) => t === job.tags![i])) {
    return false;
  }
  job.tags = cleaned;
  return true;
}
```

**Naming consistency note for the planner:** Phase 12 named its helper `backfillTagsOnJob` (set-default semantic). The Phase 15 helper is `normalizeTagsOnJob` (transform-existing semantic). The two co-exist — both safe to run, in either order, multiple times. `backfillTagsOnJob` runs FIRST in the Dexie upgrade callback (already wired in `database.ts`); `normalizeTagsOnJob` runs LATER in `useJobs` init (Phase 15 work).

---

### 4. `src/db/backfill.test.ts` (MODIFY — add `normalizeTagsOnJob` describe block)

**Analog:** `backfillTagsOnJob` describe block at lines 5–35 of the same file.

**Template** (mirror the structure verbatim, swap helper name):
```typescript
describe('normalizeTagsOnJob (Phase 15 D-12)', () => {
  it('lowercases + trims existing tags', () => {
    const job = { tags: ['PLA', '  Phone-Stand  '] };
    const changed = normalizeTagsOnJob(job);
    expect(changed).toBe(true);
    expect(job.tags).toEqual(['pla', 'phone-stand']);
  });

  it('dedupes case-insensitively', () => {
    const job = { tags: ['pla', 'PLA', 'Pla'] };
    normalizeTagsOnJob(job);
    expect(job.tags).toEqual(['pla']);
  });

  it('strips emoji and punctuation via /[^a-z0-9\\s\\-_]/g whitelist', () => {
    const job = { tags: ['pla!!', 'phone💀stand', '@@@'] };
    normalizeTagsOnJob(job);
    expect(job.tags).toEqual(['pla', 'phonestand']);  // '@@@' → '' → dropped
  });

  it('caps at 10 tags, silently dropping the rest', () => {
    const job = { tags: Array.from({ length: 15 }, (_, i) => `tag${i}`) };
    normalizeTagsOnJob(job);
    expect(job.tags).toHaveLength(10);
  });

  it('returns false (no mutation) when already canonical', () => {
    const job = { tags: ['pla', 'phone-stand'] };
    const changed = normalizeTagsOnJob(job);
    expect(changed).toBe(false);
    expect(job.tags).toEqual(['pla', 'phone-stand']);
  });

  it('returns false when tags is undefined (Phase 12 backfill not yet run)', () => {
    const job: { tags?: string[] } = {};
    const changed = normalizeTagsOnJob(job);
    expect(changed).toBe(false);
  });
});
```

---

### 5. `src/hooks/useDatabase.ts` — wire `normalizeTagsOnJob` into `useJobs` init

**Analog:** `useJobs` `copiesSoldReconcileRan` block at lines 14–16 (module flag) + 443–485 (the effect).

**Module-scope flag template** (`src/hooks/useDatabase.ts:14–16`):
```typescript
// Process-lifetime flag for the copiesSold reconcile (post-Convert-to-Sale
// regression hotfix). Same one-per-page-load pattern as the customer backfill.
let copiesSoldReconcileRan = false;
```

**Effect template** (`src/hooks/useDatabase.ts:443–485` — copy this shape verbatim, swap the helper call):
```typescript
useEffect(() => {
  if (copiesSoldReconcileRan) return;
  if (jobs === undefined) return;  // wait for the first liveQuery emission
  copiesSoldReconcileRan = true;
  let cancelled = false;
  (async () => {
    try {
      const allSales = await db.sales.toArray();
      if (cancelled) return;
      const patches = reconcileCopiesSoldFromSales(jobs, allSales);
      if (patches.length > 0) {
        await db.transaction('rw', db.jobs, async () => {
          for (const patch of patches) {
            const current = await db.jobs.get(patch.id);
            if (current) {
              await db.jobs.put({ ...current, copiesSold: patch.copiesSold, updatedAt: new Date() });
            }
          }
        });
      }
    } catch (err) {
      console.error('copiesSold reconcile failed:', err);
      copiesSoldReconcileRan = false;  // allow retry on next mount
    }
  })();
  return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [jobs === undefined]);
```

**Phase 15 adaptation** — add a sibling `tagsNormalizeRan` flag at module scope and a sibling effect inside `useJobs`. The Phase 15 helper is in-place mutation + boolean-return (NOT a patches array), so the loop is slightly simpler:
```typescript
// Module scope, sibling to copiesSoldReconcileRan at line 16
let tagsNormalizeRan = false;

// Inside useJobs(), sibling to the copiesSold reconcile effect (after line 485)
useEffect(() => {
  if (tagsNormalizeRan) return;
  if (jobs === undefined) return;
  tagsNormalizeRan = true;
  let cancelled = false;
  (async () => {
    try {
      const dirty: PrintJob[] = [];
      for (const job of jobs) {
        // Work on a SHALLOW COPY so we don't mutate the liveQuery cache.
        const copy: PrintJob = { ...job, tags: job.tags ? [...job.tags] : undefined };
        if (normalizeTagsOnJob(copy)) {
          dirty.push({ ...copy, updatedAt: new Date() });
        }
      }
      if (cancelled) return;
      if (dirty.length > 0) {
        await db.transaction('rw', db.jobs, async () => {
          for (const job of dirty) await db.jobs.put(job);
        });
      }
    } catch (err) {
      console.error('tag normalize reconcile failed:', err);
      tagsNormalizeRan = false;
    }
  })();
  return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [jobs === undefined]);
```

**Import update** at `src/hooks/useDatabase.ts:6`:
```typescript
import { backfillCustomersFromSales, reconcileCopiesSoldFromSales, normalizeTagsOnJob } from '../db/backfill';
```

---

### 6. `src/components/CostCalculator.tsx` — add tag input field

**Analog A — field positioned alongside Print Name:** `src/components/CostCalculator.tsx:754–763` (the Print Name field).

**Analog B — label with `<NewBadge>` + `<InfoTooltip>`:** `src/components/CostCalculator.tsx:788–801` (the Model URL field — has both badge AND tooltip on the label).

**Model URL pattern to mirror** (lines 788–801):
```typescript
<div className="flex-1 min-w-[220px] max-w-md">
  <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
    <span>Model URL</span>
    <InfoTooltip text="Save the source link so you can find it again later (works for free models too)" />
    <NewBadge feature="model-url" />
  </label>
  <Input
    type="url"
    value={modelUrl}
    onChange={e => setModelUrl(e.target.value)}
    placeholder="https://makerworld.com/..."
  />
</div>
```

**Critical NewBadge placement rule** (from project CLAUDE.md memory — see Shared Patterns below). The Model URL precedent puts `<NewBadge>` INLINE inside the label flex, and it works there because the label is a flex container with `gap-1.5` and the badge participates in the flex without disrupting siblings. **Mirror this exact pattern for the tag input label** — it's a label with InfoTooltip + NewBadge inline, NOT an `absolute -top-1 -right-1` overlay. The `absolute` pattern is for buttons (see JobsManager pdf-quote badge in Shared Patterns). The label-inline pattern is the right call when the badge appears on a label that already uses `flex items-center gap-1.5`.

**Save-block wiring** (lines 561–633): the tag input's local state (`tagsInput: string`) gets parsed/normalized AT save time. The parse helper should call `normalizeTagsOnJob` so the input path and the reconcile path share one canonical implementation. Save-block insertion sites for the `tags` field are lines 593 (Update branch) and 632 (Create branch — right next to `marketplace`).

**Save flow integration:** Per `CostCalculator.tsx:574–597` and `608–633`, add to both job object literals:
```typescript
tags: parseTagsInput(tagsInput),  // returns string[] | undefined per D-02 empty-input rule
```

---

### 7. `src/components/JobsManager.tsx` — multi-surface (search bar, chip filter, `[⋯]` menu, inline tag editor, cache key, tag chips)

#### 7a. Search bar — analog: `src/components/CustomerLibrary.tsx:115, 141–150, 234–253`

**State + memoized filter pattern** (`CustomerLibrary.tsx:115, 141–150` — CONTEXT names this as the canonical analog):
```typescript
const [searchQuery, setSearchQuery] = useState('');

const searchedCustomers = useMemo(() => {
  const q = searchQuery.toLowerCase().trim();
  if (!q) return sortedCustomers;
  return sortedCustomers.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.company || '').toLowerCase().includes(q)
  );
}, [sortedCustomers, searchQuery]);
```

**Search input UI** (`CustomerLibrary.tsx:234–253` — includes search icon, clear-X button):
```typescript
<div className="relative mb-4">
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
  <Input
    type="text"
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    placeholder="Search by name, email, or company"
    className="pl-9 pr-8 placeholder-slate-500"
  />
  {searchQuery && (
    <Button
      variant="ghost"
      btnSize="sm"
      onClick={() => setSearchQuery('')}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-lg leading-none"
    >
      {'×'}
    </Button>
  )}
</div>
```

**Phase 15 adaptation** (per D-06 — search joins job name + tags + Sales' customer fields):
```typescript
const searchedJobs = useMemo(() => {
  const q = debouncedSearchQuery.toLowerCase().trim();  // D-06: 250ms debounce
  if (!q) return jobsAfterChipFilter;
  const salesByJobId = new Map<string, Sale[]>();
  for (const sale of sales) {
    const list = salesByJobId.get(sale.jobId);
    if (list) list.push(sale); else salesByJobId.set(sale.jobId, [sale]);
  }
  return jobsAfterChipFilter.filter(job => {
    if (job.name.toLowerCase().includes(q)) return true;
    if (job.tags?.some(t => t.toLowerCase().includes(q))) return true;
    const jobSales = salesByJobId.get(job.id) ?? [];
    return jobSales.some(s =>
      (s.customer?.name || '').toLowerCase().includes(q) ||
      (s.customer?.email || '').toLowerCase().includes(q) ||
      (s.customer?.company || '').toLowerCase().includes(q)
    );
  });
}, [jobsAfterChipFilter, sales, debouncedSearchQuery]);
```

**Debounce — no existing project utility.** Implement inline with `useEffect` + `setTimeout(setDebouncedSearchQuery, 250)`. Do NOT add a `useDebounce` hook to a `src/hooks/` file unless the planner explicitly decides it lands in 2+ surfaces.

#### 7b. Chip filter row — analog: AssetLibrary tag-chip render at `src/components/AssetLibrary.tsx:192–198`

**Chip render pattern** (lines 192–198, also lines 290–297 — both render the SAME chip with the locked styling):
```typescript
{asset.tags && asset.tags.length > 0 && (
  <div className="flex flex-wrap gap-1 mb-2">
    {asset.tags.map(tag => (
      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400">
        {tag}
      </span>
    ))}
  </div>
)}
```

**D-11 lock — chip styling MUST be byte-identical to this:** `text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400`. Used for BOTH the JobCard summary-line chips (D-11, non-interactive) AND the filter chips at the top of JobsManager (D-03, interactive — wrap in a button with the selected-state variant).

**Selected-state chip variant** (no existing analog — extend the locked base with a selected outline; this is "claude's discretion" per CONTEXT's open questions):
```typescript
// Suggested selected style — keep the base palette so the eye reads "same family":
className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
  isSelected
    ? 'bg-blue-500/30 text-blue-200 border border-blue-400/50'
    : 'bg-slate-600/50 text-slate-400 hover:bg-slate-600/80'
}`}
```

**Tag-count derivation** (D-03 — sort alphabetically, show count per tag):
```typescript
const tagCounts = useMemo(() => {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const tag of job.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}, [jobs]);
```

#### 7c. `[⋯]` overflow menu (D-07) — analog: `QuoteRow` overflow menu at `src/components/JobsManager.tsx:130, 152–199`

**State** (line 130):
```typescript
const [overflowOpen, setOverflowOpen] = useState(false);
```

**Trigger button + menu** (lines 164–199 — CONTEXT D-07 names this as the canonical template):
```typescript
{/* allow-raw-html: overflow toggle is a small icon button, not a CTA — Button primitive would dwarf the row */}
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); setOverflowOpen(o => !o); }}
  aria-label="More actions"
  aria-haspopup="menu"
  aria-expanded={overflowOpen}
  className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-700 text-slate-300"
>
  ⋯
</button>
{overflowOpen && (
  <div
    role="menu"
    className="absolute right-0 top-full mt-1 z-10 min-w-[160px] bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1"
  >
    {/* allow-raw-html: native menuitem styling per WAI-ARIA menu pattern */}
    <button
      type="button"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); setOverflowOpen(false); onEdit?.(); }}
      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 text-slate-100"
    >
      Edit Quote
    </button>
    {/* ... more menuitems ... */}
  </div>
)}
```

**Phase 15 adaptation** — the parent container `<div className="flex items-center gap-2 shrink-0 relative">` (line 152) provides the positioning context for `absolute right-0 top-full`. The JobCard action row at lines 455–492 currently uses `<div className="flex gap-2 flex-wrap">` — change to add `relative` and append the `[⋯]` button + menu after the Delete button.

**D-07 menu items:** just `Duplicate` for v1.2 (single item — no Edit/Delete duplication, those have their own row buttons already).

**NewBadge for `quick-duplicate`** — per D-13, badge goes on the `[⋯]` trigger. Use the absolute-overlay variant per project memory (since the trigger is a square button, not a label):
```typescript
<div className="relative">
  <button type="button" aria-label="More actions" ...>⋯</button>
  <NewBadge feature="quick-duplicate" className="absolute -top-1 -right-1" />
</div>
```

#### 7d. `useDynamicRowHeight` cache key — analog: `src/components/JobsManager.tsx:1227–1235`

**Existing site** (lines 1227–1235 — D-05 cache-key contract EXTENDS this):
```typescript
// Dynamic row-height cache for virtualized rendering. The `key` arg
// invalidates the cache whenever selection changes, so the previously-
// expanded row collapses back to ~88px and the newly-selected row grows
// to its measured height. defaultRowHeight: 88 honors D-08's bias toward
// fixed sizing for the pre-measurement initial render.
const rowHeightCache = useDynamicRowHeight({
  defaultRowHeight: 88,
  key: selectedJobId ?? '',
});
```

**D-05 LOCKED contract** — extend the key to encode all three filter dimensions, pipe-delimited (per CONTEXT.md line 59 to avoid collisions):
```typescript
const selectedChipsKey = useMemo(
  () => [...selectedChips].sort().join(','),
  [selectedChips]
);

const rowHeightCache = useDynamicRowHeight({
  defaultRowHeight: 88,
  key: `${selectedJobId ?? ''}|${selectedChipsKey}|${debouncedSearchQuery}`,
});
```

#### 7e. Inline tag editor on JobCard — analog: existing JobCard inline blocks at `src/components/JobsManager.tsx:398–453`

No clean precedent for inline-edit-on-click in this file. **Claude's-discretion call (per CONTEXT open question):** the planner picks between (a) tiny inline `<Input>` revealed on a pencil-icon click, or (b) a small modal. CONTEXT recommends a stable hover target for the NewBadge — a small wrapper `<div className="relative">` around the inline-edit affordance is the minimal pattern.

**Pattern for the inline edit affordance** (mirror CustomerLibrary edit affordance at `src/components/CustomerLibrary.tsx:64–67`):
```typescript
<Button variant="ghost" btnSize="sm" onClick={() => onEdit(customer)}>
  <PencilIcon className="w-4 h-4" />
  <span className="hidden sm:inline ml-1">Edit</span>
</Button>
```

#### 7f. Filter empty state (D-10) — analog: `src/components/CustomerLibrary.tsx:265–273`

**Empty-filter state template** (NOT `<EmptyState>` primitive — per D-10 the filter UI must stay visible above):
```typescript
{searchedCustomers.length === 0 ? (
  <div className="text-center py-12">
    <h3 className="text-lg font-semibold text-white">
      No customers match &quot;{searchQuery}&quot;
    </h3>
    <p className="text-sm text-slate-400 mt-2">
      Try a different name, email, or company.
    </p>
  </div>
) : (
  <List ... />
)}
```

**Phase 15 adaptation** — add a `Clear filters` action button below the message that resets both `searchQuery` and `selectedChips`.

#### 7g. Tag chips on JobCard summary line (D-11) — analog: `src/components/AssetLibrary.tsx:192–198`

**Already covered in 7b.** Position: after the filament+print-time meta line (`JobsManager.tsx:378–388`), before the `isSelected` expanded block at line 398. Wrapper: `<div className="flex flex-wrap gap-1 mt-1">` (matches `AssetLibrary.tsx:293`'s `mt-1` choice for a tighter follow-on rendering vs `mb-2` when it leads).

---

### 8. `src/features.ts` — three new entries (D-13)

**Analog:** existing entries at lines 5–15 of the same file.

**Append pattern** (mirror format exactly — date strings as `new Date('YYYY-MM-DD')`):
```typescript
export const featureReleases: Record<string, Date> = {
  // ... existing entries ...
  'pdf-quote': new Date('2026-05-23'),
  // Phase 15 — D-13
  'tags': new Date('2026-05-24'),
  'search-jobs': new Date('2026-05-24'),
  'quick-duplicate': new Date('2026-05-24'),
};
```

**ONE badge per feature key** (D-13). The mappings are:
- `tags` → tag input field label (CostCalculator + JobsManager inline)
- `search-jobs` → search input
- `quick-duplicate` → `[⋯]` overflow trigger

---

## Shared Patterns

### Authentication / Authorization
**Not applicable** — 3DCoster is a local-first IndexedDB-only app with no auth surface.

### Error Handling (one-shot reconcile effects in hooks)
**Source:** `src/hooks/useDatabase.ts:476–485`
**Apply to:** Phase 15's new `normalizeTagsOnJob` effect in `useJobs`.
```typescript
} catch (err) {
  // Reconcile failures must NOT break the app — the UI still works
  // against stale counters; users can manually edit a Sale to retrigger.
  console.error('copiesSold reconcile failed:', err);
  copiesSoldReconcileRan = false;  // allow retry on next mount
}
```
**Rule:** every reconcile effect MUST swallow errors with `console.error` and reset its flag for retry. Never throw to React — the rest of the app keeps working.

### NewBadge placement (CRITICAL — project memory rule)
**Source:** project CLAUDE.md memory + 2 in-repo examples.

| Surface type | Pattern | Example |
|--------------|---------|---------|
| Button (square / icon) | `<div className="relative"> + <NewBadge className="absolute -top-1 -right-1" /> | JobsManager Create Quote button at `JobsManager.tsx:463–475` |
| Label (flex container with InfoTooltip) | Inline child of `<label className="flex items-center gap-1.5">` — NO position class | CostCalculator Model URL label at `CostCalculator.tsx:790–794` |

**Anti-pattern** (will break layout — DO NOT do this on flex-1 tab bars / equal-width nav):
```typescript
// BAD — widens sibling, forces wrap
<div className="flex-1">
  <Tab>Jobs</Tab>
  <NewBadge feature="..." />  {/* inline child consumes layout width */}
</div>
```

**Phase 15 mappings recap:**
- `tags` badge → label-inline pattern (CostCalculator Print-Name-adjacent + JobsManager inline editor)
- `search-jobs` badge → absolute-overlay on the search input wrapper
- `quick-duplicate` badge → absolute-overlay on the `[⋯]` trigger

### Module-scope one-per-page-load flag pattern
**Source:** `src/hooks/useDatabase.ts:8–16` (TWO existing examples — `saleCustomerBackfillRan`, `copiesSoldReconcileRan`)
**Apply to:** Phase 15's `tagsNormalizeRan`.
```typescript
// Process-lifetime flag so the [X] backfill/reconcile only runs ONCE per page load.
// The helper is idempotent so a second pass would be a harmless no-op, but skipping
// the Dexie reads is still a perf win for every subsequent hook mount in the session.
let xRan = false;
```

### Pure-helper module convention
**Source:** `src/db/backfill.ts:11–19`
**Apply to:** `src/utils/duplicateJob.ts` AND the new `normalizeTagsOnJob` in `src/db/backfill.ts`.
> No imports from `dexie` or `./database` — keeps this module jsdom-safe so the sibling test can import it without triggering the `new Dexie('3DCosterDB')` top-level side effect.

This is non-negotiable for jsdom unit-testability. Both new pure helpers MUST follow it.

### `allow-raw-html` comment guard
**Source:** `src/components/JobsManager.tsx:164–165, 180`
The project lints raw `<button>` / `<input>` elements (everything should go through the `ui/Button` primitive). When a raw element is genuinely needed (overflow trigger too small for the Button primitive, checkbox not covered by Input primitive), prefix the line with:
```typescript
{/* allow-raw-html: overflow toggle is a small icon button, not a CTA — Button primitive would dwarf the row */}
```
**Apply to:** the new `[⋯]` overflow trigger in JobsManager's JobCard action row (mirror the QuoteRow precedent verbatim).

---

## No Analog Found

Files / patterns with no clean in-repo precedent (planner should use claude's-discretion judgment + the CONTEXT decision):

| Pattern | Reason | Suggested approach |
|---------|--------|--------------------|
| 250ms search debounce | No `useDebounce` hook exists; no other surface debounces | Inline `useEffect` + `setTimeout` inside JobsManager. Don't extract to `src/hooks/` unless 2+ surfaces need it. |
| Inline-edit-on-click for a small field on a card | JobCard currently uses dedicated Edit button → CostCalculator round-trip; CustomerLibrary uses modal | Claude's-discretion (CONTEXT open question). Tiny inline `<Input>` revealed on pencil-icon click is the minimum-surface choice. |
| Mobile horizontal-scroll chip strip (`overflow-x-auto`) | No existing chip-bar in the codebase to mirror | D-14 lock spells out the rule: `overflow-x-auto` on the chip row at `<640px`. Tailwind primitives only; no new component needed. |
| Toast on duplicate success | No toast utility exists in the project (CustomerLibrary uses `confirm()`) | Either reuse the existing `justSaved` ephemeral-message pattern from `CostCalculator.tsx:1576–1580`, or have JobsManager scroll-into-view + transient highlight class (D-07 wording suggests both: "small toast + scrolls to and highlights the new row"). The scroll+highlight is the lower-risk option since no toast infra exists. |
| Sticky sub-header on a virtualized list | react-window's `<List>` doesn't natively render headers above the virtualized area; the header sits OUTSIDE the `<List>` and the `<List>` provides its own scroll container | Put the search + chip row in a `<div className="sticky top-0 z-10 bg-slate-800 pb-3">` ABOVE the `<List>`, not inside its rowComponent. The page-level scroll (not the List scroll) is what makes the header sticky. |

---

## Metadata

**Analog search scope:**
- `src/components/` (entire directory)
- `src/db/` (entire directory)
- `src/hooks/useDatabase.ts`
- `src/utils/` (entire directory)
- `src/features.ts`, `src/types.ts`, `src/components/NewBadge.tsx`

**Files scanned:** 8 source files read in full or in targeted ranges; codebase-wide grep for `useDynamicRowHeight`, `crypto.randomUUID`, `NewBadge`, module-scope flags, `Ran\b`, `overflow-menu`, search-state patterns.

**Pattern extraction date:** 2026-05-24

**Project skills loaded:** none — neither `.claude/skills/` nor `.agents/skills/` exists in this worktree.

**Project memory rules applied:**
- [[NewBadge placement]] — absolute overlay on buttons, inline-flex on labels; never widen flex-1 siblings.
- [[reconcile-legacy-data]] — Phase 15 D-12's `normalizeTagsOnJob` follows this rule (paired with the new D-02 normalization constraint).
- [[refinement-vs-contradiction]] — Phase 15 CONTEXT D-01 through D-15 are LOCKED; the planner treats them as scope, not as starting points for re-debate.
