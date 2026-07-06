# Phase 39: Cost Realism - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 20 (new + modified)
**Analogs found:** 20 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/hooks/useFailureEvents.ts` | hook (Dexie CRUD) | CRUD | `src/hooks/useStockEvents.ts` | exact |
| `src/hooks/useMaintenanceEvents.ts` | hook (Dexie CRUD) | CRUD | `src/hooks/useStockEvents.ts` | exact |
| `src/hooks/useFailureRate.ts` | hook (pure derivation) | transform | `src/hooks/useStockEvents.ts` (`deriveStockByAsset` half) | role-match |
| `src/hooks/useMaintenanceAmortization.ts` | hook (pure derivation) | transform | `src/hooks/useStockEvents.ts` (`deriveStockByAsset` half) | role-match |
| `src/hooks/useTouTariff.ts` | hook (settings CRUD) | CRUD | `src/db/database.ts` (`getElectricity`/`setElectricity` + `isElectricityConfig`) | exact |
| `src/utils/touElectricity.ts` | utility (pure math) | transform | `src/utils/costCalc.ts` (`calculateElectricityCost`) | exact |
| `src/db/database.ts` (MODIFIED — `db.version(12)`) | migration | batch | `src/db/database.ts` `db.version(11)` stanza (this session) | exact |
| `src/db/backfill.ts` (MODIFIED — new TOU reconcile helper) | migration/utility | batch | `reconcileFixedCostsAtSave` (same file) | exact |
| `src/utils/backupSchema.ts` (MODIFIED) | config/schema | batch | same file, `BACKUP_STORES`/`DATE_FIELDS` (v1.8 `stockEvents` addition) | exact |
| `src/utils/costCalc.ts` (MODIFIED — extend `CalcInput`, TOU-aware electricity) | utility (pure function) | transform | same file, `calculateElectricityCost`/`calculateNozzleWear` | exact |
| `src/components/calculator/CostParametersSection.tsx` (MODIFIED — 3 hint rows) | component (presentational section) | request-response (props-in/callbacks-out) | same file (current failure-rate input block) | exact |
| `src/components/calculator/CostCalculator.tsx` / `useCostDerivedValues.ts` (MODIFIED — wire new hooks, pass props down) | component/hook (orchestrator) | request-response | same files (Phase 38 orchestrator layer) | exact |
| `src/components/LogFailureModal.tsx` | component (form modal) | CRUD (create) | `ConfirmModal` + `RecordSaleModal`-style form modal (see Shared Patterns) | role-match |
| `src/components/LogMaintenanceModal.tsx` | component (form modal) | CRUD (create) | same as above | role-match |
| `src/components/JobsManager.tsx` (MODIFIED — log-failure icon action per row) | component (list/controller) | event-driven (click handler) | same file, existing `EditButton`/`DeleteButton` row actions (lines ~804-816) | exact |
| `src/components/ReportsSection.tsx` (MODIFIED — new "Failures" section) | component (report/read view) | request-response | same file, existing sales-report section pattern | exact |
| `src/components/PrinterSettings.tsx` (MODIFIED — per-printer Maintenance drill-in) | component (settings/detail view) | CRUD | same file, existing per-instance card + `EditButton`/`DeleteButton` | exact |
| `src/components/SettingsModal.tsx` (MODIFIED — TOU tariff band editor) | component (settings form) | CRUD | same file, existing `ElectricityConfig` editor block | exact |
| `src/types.ts` (MODIFIED — `FailureEvent`, `MaintenanceEvent`, `PrintJob.touStartTime`/`touRateUsedPerKwh`, `Asset.isAbrasive`, `PrinterInstance.nozzleType`) | model | — | same file, `StockEvent` interface + `PrintJob.fixedCostsAtSave` | exact |
| `src/components/calculator/__fixtures__/goldenScenarios.ts` (MODIFIED — new scenarios) | test fixture | batch | same file, `CURATED_SCENARIOS` array | exact |

## Pattern Assignments

### `src/hooks/useFailureEvents.ts` / `src/hooks/useMaintenanceEvents.ts` (hook, CRUD)

**Analog:** `src/hooks/useStockEvents.ts` (full file, 43 lines — read in full this session)

**Imports pattern** (lines 1-5):
```typescript
import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { deriveStockByAsset } from '../db/stockEvents';
import type { StockEvent } from '../types';
```
For the new hooks: replace `deriveStockByAsset`/`StockEvent` imports with the new pure derivation helper (`deriveFailureRate` / `deriveMaintenanceAmortization`, ideally placed in `src/db/` alongside `stockEvents.ts`'s sibling convention) and `FailureEvent`/`MaintenanceEvent` types.

**Stable empty-array sentinel** (line 7) — reuse this exact idiom so `useLiveQuery`'s default never allocates a new array reference every render (avoids downstream `useMemo` thrash):
```typescript
const EMPTY: StockEvent[] = [];
// → const EMPTY: FailureEvent[] = []; / const EMPTY: MaintenanceEvent[] = [];
```

**Deterministic id pattern** (lines 9-13) — reuse verbatim for new event ids:
```typescript
function newManualId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `manual-${crypto.randomUUID()}`
    : `manual-${Date.now()}`;
}
```
(`PrinterSettings.tsx` lines 17-21 has an equivalent `makeId(prefix)` variant — prefer the prefixed form for two new stores so ids are visually distinguishable, e.g. `makeId('failure')` / `makeId('maint')`.)

**Core CRUD pattern — hook shape** (lines 21-42):
```typescript
export function useStockEvents() {
  const events = useLiveQuery(() => db.stockEvents.toArray(), [], EMPTY);
  const stockByAssetId = useMemo(() => deriveStockByAsset(events), [events]);

  const logManualAdjustment = useCallback(async (assetId: string, delta: number, note?: string) => {
    if (!Number.isFinite(delta)) {
      console.error(`[logManualAdjustment] ignored non-finite delta for asset ${assetId}:`, delta);
      return;
    }
    const id = newManualId();
    await db.stockEvents.add({ id, assetId, delta, kind: 'manual', refId: id, timestamp: new Date(), note });
  }, []);

  return { events, stockByAssetId, logManualAdjustment };
}
```
Apply this exact three-part shape to both new hooks: `useLiveQuery(() => db.<store>.toArray(), [], EMPTY)` → `useMemo` derivation → `useCallback` write function(s) with a `Number.isFinite` guard on every numeric field (percentComplete, gramsWasted, cost, printerHoursAtEvent — per Security Domain V5/Known Threat Patterns in RESEARCH.md).

**Error handling pattern:** No try/catch around the Dexie write itself — `useStockEvents.ts` relies on the input guard (`Number.isFinite`) to prevent bad writes rather than catching Dexie exceptions. Follow this same "guard before write, don't catch after" convention for `logFailure`/`logMaintenanceEvent`.

**Delete-with-reversal note (D-03 / stock-deduction reversal):** `useStockEvents.ts` does not itself show a delete path in this excerpt — the deterministic-`refId` idempotency pattern it establishes (`refId: id` for manual events) is what `useFailureEvents`'s delete-and-reverse-stock-deduction must reuse: construct the paired stockEvent's `refId` deterministically from the failure event's id (e.g. `` `failure-${failureEventId}` ``) so deleting the failure event can look up and delete the matching stockEvent by that same refId, exactly like the v1.8 deduct-on-job / delete-reversal machinery the RESEARCH.md "Don't Hand-Roll" table references.

---

### `src/hooks/useFailureRate.ts` / `src/hooks/useMaintenanceAmortization.ts` (hook, pure derivation)

**Analog:** `src/hooks/useStockEvents.ts`'s `useMemo(() => deriveStockByAsset(events), [events])` half, plus the "Pattern 1: Suggestion-Not-Mutation" example already drafted in RESEARCH.md (verified consistent with the codebase's actual hook shape).

**Core derivation pattern** (mirrors RESEARCH.md's own worked example, itself modeled on the `useStockEvents` `useMemo` shape):
```typescript
const { empiricalRate, sampleSize, provenance } = useFailureRate(printerInstanceId, dominantMaterialId);
```
Internally this hook must:
1. `useLiveQuery` the indexed subset of `jobs`/`failureEvents` (see Pitfall 4 in RESEARCH.md — use `db.jobs.where('printerInstanceId').equals(id)`, not `.toArray()` on the whole table).
2. `useMemo` the D-05..D-08 rate/threshold/fallback math over that subset.
3. Return a plain derived object — **never write into Dexie from this hook.**

**CRITICAL constraint (Pitfall 2 in RESEARCH.md, verified against the actual component contract):** these hooks must be called in `CostCalculator.tsx` / `useCostDerivedValues.ts` (the orchestrator), **never inside `CostParametersSection.tsx`**. `CostParametersSection.tsx`'s own header comment (line 29 of that file, read this session) states the contract explicitly: *"Props-in, callbacks-out; no Dexie access, no business math (D-11)."* Any `useLiveQuery`/`db.` import appearing inside that file is a contract violation.

---

### `src/utils/touElectricity.ts` (utility, pure math)

**Analog:** `src/utils/costCalc.ts::calculateElectricityCost` (lines 58-66, full function read this session)

**Existing function to extend from, not duplicate:**
```typescript
// Electricity cost: (wattage / 1000) × printTimeHours × costPerKwh; 0 if no printer
// (matches CostCalculator.tsx:382-384).
export function calculateElectricityCost(
  printTimeHours: number,
  selectedPrinter: PrinterConfig | undefined,
  electricity: ElectricityConfig,
): number {
  return selectedPrinter
    ? (selectedPrinter.wattage / 1000) * printTimeHours * electricity.costPerKwh
    : 0;
}
```
**Pattern to follow:** `touElectricity.ts` should export a pure function like `resolveWeightedCostPerKwh(bands, flatRate, startTime, durationHours): number` that `calculateElectricityCost` calls INSTEAD of `electricity.costPerKwh` when TOU bands + a start time are present, preserving the exact same `(wattage/1000) × printTimeHours × <rate>` multiplication — the wattage/duration math is untouched; only the rate resolution is TOU-aware. No React, no Dexie — same "pure module, no IO" contract stated in `costCalc.ts`'s own file-header comment (lines 12-14): *"Pure cost-calculation module... No React, no Dexie, no IO."*

**Testing convention to mirror:** `src/utils/costCalc.test.ts` (referenced throughout RESEARCH.md) is the direct sibling-test-file precedent — `touElectricity.test.ts` should follow the same `describe`/override-factory style, with explicit coverage for the overnight-wrap-around case per RESEARCH.md's "Don't Hand-Roll" guidance.

---

### `src/db/database.ts` (MODIFIED — `db.version(12)`)

**Analog:** the same file's `db.version(11)` stanza (lines 246-259, read in full this session) — the most recent migration and the direct template for a new-empty-store version bump.

**Exact precedent to copy the shape of:**
```typescript
// v11 (v1.8): add the inventory `stockEvents` ledger. New empty store, so no
// upgrade/backfill — existing users start at zero derived stock and set their
// levels via the one-time Asset Library prompt.
db.version(11).stores({
  materials: 'id, category, brand, filamentType, currency',
  printers: 'id, name',
  printerInstances: 'id, printerConfigId, nickname',
  jobs: 'id, name, createdAt, printerInstanceId',
  sales: 'id, jobId, soldAt',
  settings: 'key',
  customers: 'id, name, email, lastUsedAt',
  quotes: 'id, quoteNumber, status, printJobId, customerId, sentAt',
  stockEvents: 'id, assetId, refId, timestamp',
});
```
**Apply directly:** `db.version(12).stores({ ...all v11 stores unchanged..., failureEvents: 'id, printerInstanceId, materialId, jobId, failedAt', maintenanceEvents: 'id, printerInstanceId, partType, occurredAt' });` — no `.upgrade()` block needed (both new stores start empty), matching v11's own comment: *"New empty store, so no upgrade/backfill."* The `EntityTable` type intersection at the top of the file (lines 13-23) must also add `failureEvents: EntityTable<FailureEvent, 'id'>;` and `maintenanceEvents: EntityTable<MaintenanceEvent, 'id'>;`, and the `import type {...}` line (line 2) must add `FailureEvent, MaintenanceEvent` alongside the existing `StockEvent` import.

**Do NOT touch:** `handleVersionchange` (lines 269-273) — this generic multi-tab-reload handler needs no changes for a new-empty-store version bump; it already fires on any version change.

---

### `src/db/backfill.ts` (MODIFIED — new TOU reconcile helper, D-12)

**Analog:** `reconcileFixedCostsAtSave` (same file, lines 519-630, read in full this session) — this is the closest possible precedent: it backfills a NEW snapshot-at-save field (`fixedCostsAtSave`) onto legacy `PrintJob` records, with an explicit "leave it computed-but-zeroed, never silently guess a real value" edge case, exactly analogous to D-12's "null = flat rate" requirement.

**Structural pattern to copy:**
```typescript
export function reconcileFixedCostsAtSave(
  jobs: PrintJob[],
  printerInstances: PrinterInstance[],
  printers: PrinterConfig[],
  materials: Material[],
): PrintJob[] {
  const out: PrintJob[] = [];
  for (const job of jobs) {
    // Job-level idempotency — already snapshotted, leave alone.
    if (job.fixedCostsAtSave !== undefined) continue;
    // ...compute snapshot...
    // Spread-copy — NEVER mutate the input job (could be a liveQuery cache entry).
    out.push({ ...job, fixedCostsAtSave: { depreciation, nozzleWear } });
  }
  return out;
}
```

**Key rules to carry over verbatim for the new `reconcileTouSnapshot` helper (D-12, Pitfall 5 in RESEARCH.md):**
1. **Idempotency guard first** — `if (job.touStartTime !== undefined || job.touRateUsedPerKwh !== undefined) continue;` (skip already-reconciled jobs).
2. **Explicit absence, not a guessed value** — per RESEARCH.md Pitfall 5, the reconcile helper must leave `touStartTime`/`touRateUsedPerKwh` **`undefined`** on legacy jobs (do NOT backfill today's flat rate as a number) — this mirrors `fixedCostsAtSave`'s own precedent of writing a real computed value ONLY when derivable, but the TOU case is simpler: legacy jobs by definition never used TOU, so the correct backfill is "leave absent," not "compute something."
3. **Never mutate the input** — always `{ ...job, ... }` spread-copy (comment at line 627 of `backfill.ts`: *"Spread-copy — NEVER mutate the input job (could be a liveQuery cache entry)."*).
4. **Pure, jsdom-safe, no Dexie import** — file-header constraint already established (lines 527-531): *"Pure helper. No imports from `dexie` or `./database`... keeps this module jsdom-safe."*
5. **JSDoc example block convention** — every reconcile helper in this file (see `reconcileQuoteCurrency`, `reconcileAssetCurrency`, `reconcileCustomerEmailLowercase`, `reconcileCopiesSoldFromSales`, all following the identical doc shape) includes 2-3 `Examples:` lines showing input → output pairs. Follow this exact JSDoc convention for the new helper.

**Wire-up location:** the migration-caller site (wherever `reconcileFixedCostsAtSave` is invoked on app boot — grep `App.tsx` or `useDatabase.ts` for its call site) is the integration point the new TOU reconcile helper must also be called from.

---

### `src/utils/backupSchema.ts` (MODIFIED — add both new stores)

**Analog:** same file, full 86-line file read this session — the v1.8 `stockEvents` addition is the direct, most-recent precedent for adding a store to this contract.

**Three extension points, all in this one file (confirmed the single source of truth per RESEARCH.md):**
```typescript
export interface BackupData {
  materials: unknown[];
  printers: unknown[];
  printerInstances: unknown[];
  jobs: unknown[];
  sales: unknown[];
  settings: { key: string; value: string }[];
  customers: unknown[];
  quotes: unknown[];
  stockEvents: unknown[];
  // ADD: failureEvents: unknown[]; maintenanceEvents: unknown[];
}

export const BACKUP_STORES = [
  'materials', 'printers', 'printerInstances', 'jobs',
  'sales', 'settings', 'customers', 'quotes', 'stockEvents',
  // ADD: 'failureEvents', 'maintenanceEvents',
] as const;

export const DATE_FIELDS: Record<BackupStoreName, readonly string[]> = {
  materials: [], printers: [], printerInstances: ['purchaseDate'],
  jobs: ['createdAt', 'updatedAt'], sales: ['soldAt'], settings: [],
  customers: ['createdAt', 'lastUsedAt'],
  quotes: ['createdAt', 'sentAt', 'decisionAt', 'convertedAt'],
  stockEvents: ['timestamp'],
  // ADD: failureEvents: ['failedAt'], maintenanceEvents: ['occurredAt'],
};
```
**No other file needs changes** — `src/utils/backupExport.ts` was confirmed (RESEARCH.md Sources) to iterate `BACKUP_STORES` generically, so extending these three constants in this ONE file is the complete, sufficient change for both new stores to round-trip through backup/restore, exactly as `stockEvents` did in v1.8.

---

### `src/components/calculator/CostParametersSection.tsx` (MODIFIED — 3 hint rows)

**Analog:** same file, full 171-line file read this session — the existing Failure Rate input block (lines 68-80) is the exact attachment point for the empirical-rate hint row.

**Contract header comment to preserve (lines 25-30):**
```typescript
/**
 * Print parameters (time / failure rate / prep / post-processing minutes) +
 * Post-Processing Materials list. Props-in, callbacks-out; no Dexie access,
 * no business math (D-11). Per D-10, this is the section Phase 39's
 * failure/TOU/wear inputs attach to as ordinary additions — no speculative
 * extension props are added ahead of that need.
 */
```
This comment literally names Phase 39 as its own intended extension point — confirming the plan should add new PROPS (not new internal hooks) to this component's existing `CostParametersSectionProps` interface (lines 6-23).

**Existing failure-rate input to attach the hint row beside** (lines 68-80):
```tsx
<div>
  <label htmlFor={ids.failureRate} className="block text-xs text-slate-400 mb-1">Failure Rate (%)</label>
  <Input
    id={ids.failureRate}
    type="number"
    min="0"
    max="99"
    compact
    value={failureRate || ''}
    onChange={e => onFailureRateChange(Math.min(parseFloat(e.target.value) || 0, 99))}
    placeholder="5"
  />
</div>
```
**New props to add (props-in, no internal Dexie/hooks):** `empiricalFailureRate: { rate: number; sampleSize: number; provenance: 'exact' | 'printer-fallback' } | null`, `onApplyEmpiricalFailureRate: () => void`, and equivalent shapes for the TOU start-time picker + savings hint and the maintenance-$/hr hint — all computed upstream in the orchestrator (see Pitfall 2) and passed down exactly like every other prop already on this component.

**Existing shared-component imports to reuse** (line 2): `import { Button, Input, RemoveButton, Select, InfoTooltip } from '../ui';` — the Apply-suggestion hint rows should reuse `InfoTooltip` for provenance text and a small `Button` (or a plain text-link-styled button) for "Apply," not a new bespoke component.

---

### `src/components/JobsManager.tsx` (MODIFIED — log-failure icon action per row)

**Analog:** same file, existing per-row action block (lines 783-816, read this session)

**Exact icon-button row pattern to extend:**
```tsx
<div className="flex gap-2 flex-wrap relative">
  <Button variant="success" btnSize="sm" onClick={(e) => { e.stopPropagation(); onOpenSaleForm(job); }}>
    Record Sale
  </Button>
  {/* ... Create Quote button ... */}
  {/* D-31: Edit/Delete are row/item actions on the job — iconified (pencil/trash)
      per the UI Conventions in .claude/CLAUDE.md, sitting after the primary
      CTAs (Record Sale / Create Quote) which keep their text. */}
  <EditButton
    label={job.name}
    className="border border-slate-600 hover:!bg-slate-600"
    onClick={(e) => { e.stopPropagation(); onEdit(job); }}
  />
  <DeleteButton
    label={job.name}
    onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
  />
</div>
```
**Apply directly:** the new "Log Failure" row action is a per-item icon action exactly like Edit/Delete — per `.claude/CLAUDE.md`'s mandatory Action Buttons & Icons convention ("Row/item actions use shared icon buttons, not words... use the generic `IconButton` for any other repeated icon action... Every icon-only control needs a descriptive `aria-label`"). Use the shared `IconButton` primitive (from `src/components/ui`) with `label={job.name}` (building `aria-label="Log Failure {job.name}"` or similar), styled/positioned alongside `EditButton`/`DeleteButton`, with `e.stopPropagation()` in the handler exactly like its siblings — **never a raw `<button>` or hand-rolled SVG**.

**Import line to extend** (line 7): `import { Button, EditButton, DeleteButton, Input, EmptyState, Skeleton, shouldShowEmptyState, Modal, useToast } from './ui';` — add `IconButton` (or a purpose-built icon export if one doesn't already exist in `src/components/ui`).

---

### `src/components/ReportsSection.tsx` (MODIFIED — new "Failures" section)

**Analog:** same file — `ReportsSectionProps` interface (line 10) and the `ReportsSection` component (line 34) establish the existing props-in shape (`allSales`, `jobs`, `userCurrency`, `fxTable`) for report data. The new "Failures" section slots in as an additional prop-driven sub-section following the same shape: accept `failureEvents` (and whatever derived per-printer/per-material grouping the orchestrator computes) as new props, render a new section beneath/alongside the existing sales-report content — do not introduce a new top-level tab (D-04).

---

### `src/components/PrinterSettings.tsx` (MODIFIED — per-printer Maintenance drill-in)

**Analog:** same file, `PrinterSettingsProps` interface (lines 28-38) and the per-instance card pattern implied by the existing `EditButton`/`DeleteButton` imports (line 4) and `PrinterListSkeleton` layout (lines 40-63).

**Pattern to extend:** each printer-instance card already renders inline stat rows (nickname, config, purchase info) with an actions row (`EditButton`/`DeleteButton` per instance, matching the `JobsManager.tsx` icon-button convention). The new "Maintenance" drill-in section (log button + event history + cumulative cost + abrasive-hours + next-swap prediction) is a NEW collapsible sub-block within each existing printer-instance card, following the same props-down data flow: `PrinterSettings` receives `maintenanceEvents`/derived-amortization data as new props from the orchestrator (via `useMaintenanceEvents`/`useMaintenanceAmortization` called at the App/page level, not inside `PrinterSettings` itself, per the same "Dexie hooks live in the orchestrator" discipline as Pitfall 2) and passes the relevant per-instance slice down.

**Existing 500h fallback alert to preserve, not replace (D-15):**
```typescript
// src/App.tsx line 20
import { isMaintenanceDismissed, markMaintenanceDismissed, MAINTENANCE_INTERVAL } from './utils/maintenanceDismissed';
// src/App.tsx lines 184-191 (addPrintHours call site)
if (printHours > 0) {
  const hoursAfter = hoursBefore + printHours;
  const intervalsBefore = Math.floor(hoursBefore / MAINTENANCE_INTERVAL);
  const intervalsAfter = Math.floor(hoursAfter / MAINTENANCE_INTERVAL);
  // ... crossedAt / isMaintenanceDismissed / markMaintenanceDismissed ...
}
```
This existing mechanism (`src/utils/maintenanceDismissed.ts`, `MAINTENANCE_INTERVAL`) is the generic fallback D-15 explicitly keeps for printers with no logged maintenance events — the new per-part-category prediction is ADDITIVE, layered in the new Maintenance drill-in UI, and must not remove or modify this existing App.tsx block.

---

### `src/utils/costCalc.ts` (MODIFIED — extend `CalcInput`; TOU-aware electricity)

**Analog:** same file, full 202-line file read this session.

**File-header contract to preserve exactly** (lines 12-14):
```typescript
// Pure cost-calculation module. Mirrors the math in
// src/components/CostCalculator.tsx:374-446 (the `useMemo((): CostBreakdown => {…})`)
// with byte-for-byte identical semantics. No React, no Dexie, no IO.
```
Any Phase 39 change to this file must preserve "pure function, no React/Dexie/IO."

**Existing failureRate consumption — DO NOT touch this mechanism** (lines 181-185, load-bearing per FAIL-02/FAIL-03):
```typescript
// Failure-adjusted per-unit cost (clamp to 0-99 to prevent division by zero).
// Clamp lives INSIDE calculateCost per D-02 — matches CostCalculator.tsx:428-431.
const clampedFailureRate = Math.min(Math.max(input.failureRate, 0), 99);
const failureMultiplier = 1 / (1 - clampedFailureRate / 100);
const failureAdjusted = perUnitSubtotal * failureMultiplier;
```
FAIL-02/FAIL-03 are satisfied by feeding a BETTER `input.failureRate` via the Apply button — this formula itself is unchanged.

**`CalcInput` interface to extend additively** (lines 28-45) — add new OPTIONAL fields only (TOU rate override / start time / duration context needed by `calculateElectricityCost`; wear/abrasive surcharge inputs), following the exact style of the existing field list (flat, typed, no nesting beyond what's already there, e.g. `electricity: ElectricityConfig` already groups related settings — a `touBands`/similar addition should follow that same grouping instinct per RESEARCH.md Open Question 2's recommendation to extend `ElectricityConfig` rather than fork a parallel settings key).

**`calculateElectricityCost` extension point** (lines 58-66) — this is the SPECIFIC function TOU-02 modifies; see the `touElectricity.ts` pattern assignment above for the exact extension shape (rate resolution swapped out, wattage×duration math untouched).

**Anti-pattern warning to carry into the plan (RESEARCH.md Pitfall 1, verified against `calculateNozzleWear`, lines 86-100):** the abrasive/wear surcharge must be an ADDITIVE new cost line in the `calculateCost` orchestrator (lines 142-202), never a silent modification to the existing `calculateNozzleWear` formula, which every historical CF/GF job already depends on for its displayed nozzle-wear cost.

---

### `src/components/calculator/__fixtures__/goldenScenarios.ts` (MODIFIED — new scenarios)

**Analog:** same file, `CURATED_SCENARIOS` array (starts line 302, full array structure read via grep this session).

**Structural convention to follow exactly (frozen-order rule, lines 38-51 — CRITICAL, read in full):**
```typescript
// *** SCENARIO ORDER IS FROZEN (WR-05) — DO NOT reorder, insert, or remove ***
// outputEquivalence.test.tsx renders ALL scenarios into the SAME React root
// without remounting... Reordering/inserting/removing ANY scenario silently
// changes the effective inputs of every scenario after it.
```
**New Phase 39 scenarios (TOU-active print, CF/GF-on-brass-nozzle print, empirical-rate-applied print) MUST be APPENDED to the end of `CURATED_SCENARIOS`, never inserted/interleaved** — matching the existing append-only growth pattern visible in the array's own naming convention (`none-01`..`none-04`, then `multi-material`, `fx-*`, `high-failure`, `tax-*`, `break-even`, `combined`, `editing-job` — each block was itself appended, never reordered). The plan must also note: per the file's own instructions, the output-equivalence baseline snapshot must be re-captured in a dedicated, auditable commit when new scenarios are appended (never `--update` in passing).

**Override-factory idiom to reuse** (lines 98-109, `makeMaterial`):
```typescript
function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-pla', name: 'PLA Spool', category: 'filament', filamentType: 'PLA',
    unit: 'g', costPerUnit: 0.02, currency: 'USD', ...overrides,
  };
}
```
New scenarios needing a CF/GF material should call `makeMaterial({ filamentType: 'PLA-CF', ... })` (or the project's actual CF-type literal) rather than hand-writing a new object shape — same idiom as `petgMaterial`/`tpuMaterial` (lines 291-292).

## Shared Patterns

### Suggestion-Not-Mutation (Apply-gated derived hint)
**Source:** Established by CONTEXT.md D-05..D-08 (failure rate), D-14 (maintenance $/hr); the existing `CostParametersSection.tsx` failure-rate input (lines 68-80) is the manual-input-is-authoritative half already in place.
**Apply to:** `useFailureRate`, `useMaintenanceAmortization`, `useTouTariff`'s savings-hint output — every derived suggestion in this phase.
**Rule:** compute in a read-only hook, render as a hint beside the manual input, require an explicit click to copy the value in via the SAME setter a manual edit would use (`onFailureRateChange`, etc.). Never auto-write.

### Append-Only Ledger with Deterministic refId
**Source:** `src/hooks/useStockEvents.ts` (full file) + `src/db/database.ts` v11 stanza.
**Apply to:** `failureEvents`, `maintenanceEvents` schema/hook design; `failureEvents`'s stock-deduction reversal on delete.
```typescript
db.version(12).stores({
  // ...all v11 stores unchanged...
  failureEvents: 'id, printerInstanceId, materialId, jobId, failedAt',
  maintenanceEvents: 'id, printerInstanceId, partType, occurredAt',
});
```

### Snapshot-at-Save for Derived Money Fields
**Source:** `src/types.ts` `PrintJob.fixedCostsAtSave` (Phase 22.1) + `src/db/backfill.ts::reconcileFixedCostsAtSave` (lines 519-630, full precedent read this session).
**Apply to:** D-12's `touStartTime`/`touRateUsedPerKwh` snapshot fields + their reconcile helper.
```typescript
fixedCostsAtSave?: { depreciation: number; nozzleWear: number };
// NEW, Phase 39 (D-12) — same pattern:
touStartTime?: string;      // "HH:MM" or undefined = flat rate was used
touRateUsedPerKwh?: number; // undefined on legacy jobs = flat rate (reconcile backfills null, not a number)
```

### Numeric Input Guard (Number.isFinite before Dexie write)
**Source:** `src/hooks/useStockEvents.ts::logManualAdjustment` (lines 33-36).
**Apply to:** every new numeric write path — failure `percentComplete`/`gramsWasted`, maintenance `cost`/`printerHoursAtEvent`.
```typescript
if (!Number.isFinite(delta)) {
  console.error(`[logManualAdjustment] ignored non-finite delta for asset ${assetId}:`, delta);
  return;
}
```

### Icon-Only Row Actions (NEVER raw `<button>`, always a required `label`)
**Source:** `.claude/CLAUDE.md` "Action buttons & icons" convention + `src/components/JobsManager.tsx` lines 807-815 (`EditButton`/`DeleteButton` usage).
**Apply to:** the new "Log Failure" job-row icon action; any per-event edit/delete affordance in the Failures ledger and Maintenance drill-in.
```tsx
<EditButton
  label={job.name}
  className="border border-slate-600 hover:!bg-slate-600"
  onClick={(e) => { e.stopPropagation(); onEdit(job); }}
/>
```

### Reconcile-Helper JSDoc Convention (idempotent, example-documented, pure)
**Source:** `src/db/backfill.ts` — every reconcile helper in the file (`reconcileFixedCostsAtSave`, `reconcileQuoteCurrency`, `reconcileAssetCurrency`, `reconcileCustomerEmailLowercase`, `reconcileCopiesSoldFromSales`) shares this shape.
**Apply to:** the new TOU reconcile helper (D-12).
Required elements: idempotency guard as the FIRST line of the loop body; spread-copy (never mutate); a JSDoc `Examples:` block with 2-3 input→output pairs; no `dexie`/`./database` imports (jsdom-safe).

### Structural Settings Validator (`is<Config>` type guard)
**Source:** `src/db/database.ts` — `isElectricityConfig` (lines 411-415), `isShippingConfig`, `isMarketplaceFees` (all following the identical `typeof o.field === 'number'` / `Array.isArray` shape).
**Apply to:** if TOU bands extend `ElectricityConfig` per RESEARCH.md's Open Question 2 recommendation, `isElectricityConfig` must be extended to validate the new optional `touBands` array shape (`Array.isArray(o.touBands)` guard, matching the `isShippingConfig`/`isMarketplaceFees` precedent for optional-array fields).
```typescript
export function isElectricityConfig(x: unknown): x is ElectricityConfig {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.costPerKwh === 'number';
  // EXTEND: && (o.touBands === undefined || Array.isArray(o.touBands))
}
```

## No Analog Found

None. Every file in this phase's scope has a strong, directly-read-from-source analog in the existing codebase — consistent with RESEARCH.md's own conclusion: *"Every 'hard part' of this phase... already has a working, tested precedent somewhere in this codebase."*

## Metadata

**Analog search scope:** `src/hooks/`, `src/db/`, `src/utils/`, `src/components/calculator/`, `src/components/` (JobsManager, ReportsSection, PrinterSettings, SettingsModal), `src/types.ts`
**Files scanned (full or targeted read this session):** `src/hooks/useStockEvents.ts` (full), `src/db/database.ts` (full), `src/utils/costCalc.ts` (full), `src/components/calculator/CostParametersSection.tsx` (full), `src/utils/backupSchema.ts` (full), `src/db/backfill.ts` (targeted, lines 1-40 grep + 519-630 read), `src/components/JobsManager.tsx` (targeted, lines 760-840), `src/components/PrinterSettings.tsx` (targeted, lines 1-80), `src/components/ReportsSection.tsx` (grep only — interface/component signature), `src/App.tsx` (grep only — maintenance alert call sites), `src/components/calculator/__fixtures__/goldenScenarios.ts` (targeted, lines 1-120 + grep for scenario names)
**Pattern extraction date:** 2026-07-06
