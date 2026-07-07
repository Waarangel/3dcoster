---
phase: 39-cost-realism
reviewed: 2026-07-07T00:00:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - src/App.tsx
  - src/components/BackupRestoreSection.test.tsx
  - src/components/JobsManager.test.tsx
  - src/components/JobsManager.tsx
  - src/components/LogFailureModal.test.tsx
  - src/components/LogFailureModal.tsx
  - src/components/LogMaintenanceModal.test.tsx
  - src/components/LogMaintenanceModal.tsx
  - src/components/PrinterSettings.test.tsx
  - src/components/PrinterSettings.tsx
  - src/components/ReportsSection.test.tsx
  - src/components/ReportsSection.tsx
  - src/components/SettingsModal.test.tsx
  - src/components/SettingsModal.tsx
  - src/components/calculator/CostCalculator.tsx
  - src/components/calculator/CostParametersSection.test.tsx
  - src/components/calculator/CostParametersSection.tsx
  - src/components/calculator/__fixtures__/goldenScenarios.ts
  - src/components/calculator/__snapshots__/outputEquivalence.test.tsx.snap
  - src/db/backfill.test.ts
  - src/db/backfill.ts
  - src/db/database.ts
  - src/db/failureRate.test.ts
  - src/db/failureRate.ts
  - src/db/maintenanceAmortization.test.ts
  - src/db/maintenanceAmortization.ts
  - src/features.ts
  - src/hooks/useCostDerivedValues.ts
  - src/hooks/useCostForm.ts
  - src/hooks/useDatabase.ts
  - src/hooks/useFailureEvents.test.tsx
  - src/hooks/useFailureEvents.ts
  - src/hooks/useFailureRate.test.tsx
  - src/hooks/useFailureRate.ts
  - src/hooks/useMaintenanceAmortization.test.tsx
  - src/hooks/useMaintenanceAmortization.ts
  - src/hooks/useMaintenanceEvents.test.tsx
  - src/hooks/useMaintenanceEvents.ts
  - src/hooks/useTouTariff.test.tsx
  - src/hooks/useTouTariff.ts
  - src/types.ts
  - src/utils/abrasive.test.ts
  - src/utils/abrasive.ts
  - src/utils/backupExport.test.ts
  - src/utils/backupRestore.test.ts
  - src/utils/backupSchema.test.ts
  - src/utils/backupSchema.ts
  - src/utils/costCalc.test.ts
  - src/utils/costCalc.ts
  - src/utils/touElectricity.test.ts
  - src/utils/touElectricity.ts
findings:
  critical: 3
  warning: 8
  info: 8
  total: 19
status: fixes_applied
fix_pass:
  fixed_at: 2026-07-07
  scope: critical_warning
  fixed: 11
  skipped: 0
---

# Phase 39: Code Review Report

**Reviewed:** 2026-07-07
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

Phase 39 adds the failure-cost engine, TOU electricity, and maintenance/wear features. The pure-module math (touElectricity.ts, failureRate.ts, maintenanceAmortization.ts, costCalc.ts additions) is well-structured and well-tested; the Dexie v12 migration is genuinely additive; the output-equivalence snapshot was verified append-only (diff shows only added scenario keys, no changed baseline values); Apply-gating for the failure-rate and maintenance hints is correctly wired through the existing setters.

However, three Critical issues were found: (1) the backup-store extension makes **every pre-Phase-39 backup file un-restorable** because the whole-file validator hard-requires the two new store keys; (2) the standalone-failure "Filament wasted (grams)" input is collected and stored but **never deducts stock**, contradicting the documented D-03 contract in two doc comments; (3) the abrasive auto-detect regex matches common non-abrasive filament names ("Metallic", "Carbon Black", "Glass"-colorways via the `metal|carbon|glass` substrings) and silently doubles nozzle-wear cost, while the documented `isAbrasive` user override has **no UI write path anywhere** — mispriced users have no in-app remedy.

Verified invariants (no findings): new CalcInput fields (`touStartTime`, `maintenanceCostPerHour`) are optional with byte-identical defaults; `reconcileTouSnapshot` correctly leaves legacy jobs untouched (no fabricated rates); TOU snapshot fields written only at save time from the resolved breakdown; backup export includes both new stores with correct DATE_FIELDS; no raw `<button>`s introduced; icon buttons carry aria labels via the shared components.

## Critical Issues

### CR-01: Pre-Phase-39 backups are rejected by restore — data-recovery regression

**File:** `src/utils/backupSchema.ts:64-68` (BACKUP_STORES extension), enforced at `src/utils/backupRestore.ts:107-111`
**Issue:** `validateBackupFile` iterates `BACKUP_STORES` and rejects the WHOLE file when any store key is not an array:

```ts
for (const store of BACKUP_STORES) {
  const rows = data[store];
  if (!Array.isArray(rows)) {
    return { ok: false, error: `Backup is missing the "${store}" section or it is not a list` };
  }
```

`failureEvents` and `maintenanceEvents` were appended to `BACKUP_STORES`, but `BACKUP_FORMAT_VERSION` stays `1` and no back-compat default was added. Every backup exported by v1.8/v1.9 (format-version 1, legitimately valid) lacks these keys and will now fail restore with "Backup is missing the failureEvents section". For a local-first app whose disaster-recovery story IS the backup file, this bricks all existing user backups. No test covers restoring a legacy backup missing the new keys (backupRestore.test.ts only round-trips freshly-exported files; backupSchema.test.ts asserts the constants, not legacy acceptance).
**Fix:** Default missing NEW stores to empty arrays during validation (and add a regression test with a v1.9-shaped fixture):
```ts
// backupRestore.ts — inside the store loop
const rows = data[store] ?? (isNewSinceV1Store(store) ? [] : data[store]);
// simplest safe form: treat absent failureEvents/maintenanceEvents as []
const raw = data[store];
const rows = raw === undefined && (store === 'failureEvents' || store === 'maintenanceEvents') ? [] : raw;
```

### CR-02: Standalone failure's user-entered "Filament wasted (grams)" never deducts stock — contradicts the documented D-03 contract

**File:** `src/hooks/useFailureEvents.ts:51`; contract at `src/types.ts:150-154` and `src/hooks/useFailureEvents.ts:28-31`; UI at `src/components/LogFailureModal.tsx:178-193`
**Issue:** The deduction condition requires a jobId:

```ts
if (input.jobId && input.gramsWasted !== undefined && input.gramsWasted > 0) {
```

But the documented contract says the opposite in two places — types.ts: "standalone failures skip stock deduction **unless the user also supplies gramsWasted directly**", and the hook's own doc comment: "standalone failures (no jobId) skip stock deduction **unless gramsWasted is explicitly supplied**". The LogFailureModal shows a "Filament wasted (grams, optional)" input for standalone logs and passes the value through — it is stored on the FailureEvent and then silently ignored for inventory. Result: silent stock overstatement for every standalone failure logged with grams (the v1.8 inventory feature reads SUM(delta) as gospel). The test at `useFailureEvents.test.tsx:136` locks the skip behavior, so code and test agree with each other but both contradict the written contract and the UI affordance.
**Fix:** Drop the `input.jobId` requirement (materialId is always present):
```ts
if (input.gramsWasted !== undefined && input.gramsWasted > 0) {
  await db.stockEvents.add({ ... });
}
```
Update the test title/assertion accordingly. If the skip is genuinely intended, then instead: remove the standalone grams input from LogFailureModal, fix both doc comments, and fix the ReportsSection delete-confirm copy — but shipping a form field that does nothing is not an acceptable end state.

### CR-03: Over-broad abrasive auto-detect misprices common non-abrasive filaments, and the documented override has no UI

**File:** `src/utils/abrasive.ts:14`; cost impact at `src/utils/costCalc.ts:154-164, 262`; missing override UI (no file writes `Asset.isAbrasive`)
**Issue:** The matcher runs case-insensitively against the free-text asset **name**:

```ts
const ABRASIVE_PATTERNS = /CF|GF|carbon|glass|glow|metal/i;
```

- `metal` matches "Silk **Metal**lic PLA", "Gun**metal** Grey" — extremely common, non-abrasive colorways/finishes.
- `carbon` matches "**Carbon** Black" — a standard pigment/color name on plain PLA/PETG.
- `glass` matches translucent "Glass" colorways (e.g. "PETG Glass Blue") which are not glass-fiber filled.

A false positive silently **doubles the nozzle-wear cost** (`calculateAbrasiveSurcharge` returns `calculateNozzleWear(...)` again) for every job whose dominant filament name matches — baked into `subtotal`, `failureAdjusted`, `costPerUnit`, and every saved job's price, with no visible line item (see WR-06). The type-level escape hatch `Asset.isAbrasive` (D-13: "explicit true/false = user override wins") is written by **no component in the codebase** — a grep for `isAbrasive` outside abrasive.ts/types.ts/costCalc.ts/maintenanceAmortization.ts and tests returns nothing. A mispriced user has no in-app remedy.
**Fix:** (1) Tighten the name patterns to word-bounded, fill-specific tokens:
```ts
const ABRASIVE_TYPE_PATTERNS = /-CF\b|-GF\b/i;                       // filamentType only
const ABRASIVE_NAME_PATTERNS = /\bcarbon[- ]?fib|\bglass[- ]?fib|\bglow\b|\bmetal[- ]?fill/i; // name
```
(2) Ship the `isAbrasive` override toggle in the Asset Library filament editor in this phase, not a later one — the surcharge already affects money output.

## Warnings

### WR-01: Failure log + stock deduction (and delete + reversal) are not transactional

**File:** `src/hooks/useFailureEvents.ts:45-61` (logFailure), `:66-72` (deleteFailure)
**Issue:** `db.failureEvents.add(...)` and `db.stockEvents.add(...)` are two sequential awaits with no `db.transaction`. If the second write fails (quota, tab close, versionchange reload), a failure event exists with no deduction; the modal's catch then invites a retry, which duplicates the failure event (fresh random id) — double-counting the failure rate. `deleteFailure` has the mirror problem: failure row deleted, reversal delete fails → deduction orphaned forever. v1.9 specifically hardened stock write paths to be atomic ("stock atomicity" milestone item).
**Fix:**
```ts
await db.transaction('rw', db.failureEvents, db.stockEvents, async () => {
  await db.failureEvents.add({ ...input, id });
  if (shouldDeduct) await db.stockEvents.add({ ... });
});
```
Same wrapper for deleteFailure.

### WR-02: LogMaintenanceModal seeds state at mount, never on open — stale printerHoursAtEvent/nozzleType

**File:** `src/components/LogMaintenanceModal.tsx:42-47`
**Issue:** The modal component is permanently mounted inside each `MaintenanceSection` (PrinterSettings.tsx:726-732) with an `isOpen` toggle. `printerHoursAtEvent` and `nozzleType` are `useState` initializers reading `instance` at MOUNT time. Sequence: open Printers tab (printHours=100) → edit printHours to 250 (or save jobs that bump it) → open Log Maintenance → the hours field shows 100. `resetForm()` re-reads the live prop but only runs on close/save — the FIRST open after any instance change is stale, and `printerHoursAtEvent` feeds the next-swap interval math, so a stale value corrupts predictions. LogFailureModal solved this exact problem with a reset-on-open effect (LogFailureModal.tsx:66-79).
**Fix:** Add the same reset-on-open effect:
```ts
useEffect(() => {
  if (!isOpen) return;
  resetForm();
}, [isOpen, instance.id]);
```

### WR-03: LogMaintenanceModal handleSave has no error handling — Dexie failure is an unhandled rejection

**File:** `src/components/LogMaintenanceModal.tsx:74-102`; also `src/components/PrinterSettings.tsx:711` (deleteMaintenanceEvent onClick)
**Issue:** `onLogMaintenanceEvent` (→ `db.maintenanceEvents.add`) can reject (quota, closed DB). `handleSave` awaits it with no try/catch and is invoked directly as `onClick={handleSave}` — a rejection surfaces as an unhandled promise rejection and the user gets zero feedback (modal stays open, nothing saved, no error). The `id === undefined` branch only covers the validation path, not thrown errors. LogFailureModal wraps its submit in try/catch + toast; this modal should match. The `deleteMaintenanceEvent(event.id)` onClick in MaintenanceSection has the same fire-and-forget gap.
**Fix:** Wrap the await in try/catch and route the message into `setSaveError` (and a toast), mirroring LogFailureModal.tsx:105-111.

### WR-04: predictNextSwap's doc claims abrasive-hours accelerate the nozzle projection — the code implements no such scaling

**File:** `src/db/maintenanceAmortization.ts:110-114` (claim) vs `:136-170` (implementation)
**Issue:** The doc comment states: "Brass-nozzle abrasive-hours (WEAR-01) accelerate the 'nozzle' projection only: the effective remaining-hours-until-swap is scaled down in proportion to the fraction of recent print time spent on abrasive filament." `predictForPartType` receives no abrasive data and performs no scaling — the nozzle prediction is identical to belt/bed/other. No test asserts acceleration either (maintenanceAmortization.test.ts covers abrasiveHours accumulation only). Either WEAR-01's acceptance criteria are unmet (missing feature) or the contract comment fabricates behavior that future maintainers will rely on.
**Fix:** Implement the scaling (pass `abrasiveHours` fraction into `predictForPartType` and divide `hoursUntilSwap` accordingly) with a test, or delete the paragraph from the doc comment and record the descope in the phase summary.

### WR-05: "Apply" writes the empirical failure rate unclamped and unrounded — can exceed the field's 0-99 contract

**File:** `src/components/calculator/CostCalculator.tsx:438`; source range at `src/db/failureRate.ts:104-123`
**Issue:** `deriveFailureRate` returns 0-100 (5 failures + 0 saved jobs → exactly 100). `onApplyEmpiricalFailureRate` calls `setFailureRate(empiricalFailureRate.rate)` directly, bypassing the input's own `Math.min(..., 99)` onChange clamp (CostParametersSection.tsx:127) and its `max="99"` attribute. A 100 value is stored on the form, persisted to `job.failureRate`, and only rescued inside `calculateCost`'s internal clamp (→ ×100 multiplier). Repeating-decimal rates (e.g. 28.571428571…) are also injected verbatim into the number input.
**Fix:**
```ts
onApplyEmpiricalFailureRate={() => empiricalFailureRate &&
  setFailureRate(Math.min(99, Math.round(empiricalFailureRate.rate)))}
```
Apply the same rounding to `onApplyAmortizedMaintenance` (`Math.round(x * 100) / 100`).

### WR-06: maintenanceCost and abrasiveSurcharge are inside Subtotal but never itemized — breakdown lines no longer sum, contradicting the field's own tooltip

**File:** `src/utils/costCalc.ts:262`; display at `src/components/calculator/CostSummaryPanel.tsx:64-110`; tooltip promise at `src/components/calculator/CostParametersSection.tsx:217`
**Issue:** `perUnitSubtotal` now includes `maintenanceCost + abrasiveSurcharge`, but CostSummaryPanel itemizes only Filament / Electricity / Materials / Labor / Shipping / Packaging / Model. When either new line is non-zero, the listed rows visibly do not add up to the "Subtotal" row — an unexplained gap in a money UI. The maintenance input's InfoTooltip explicitly promises the cost is "added as its own labeled cost line", and the abrasive surcharge (which the user never opted into — CR-03) is completely invisible.
**Fix:** Add two conditional rows to CostSummaryPanel mirroring the `costs.materials > 0` pattern:
```tsx
{costs.maintenanceCost > 0 && <Row label="Maintenance" value={costs.maintenanceCost} />}
{costs.abrasiveSurcharge > 0 && <Row label="Abrasive nozzle wear (brass)" value={costs.abrasiveSurcharge} />}
```

### WR-07: Overlapping TOU bands are accepted and resolve first-match-wins by array order — silent, order-dependent electricity pricing

**File:** `src/hooks/useTouTariff.ts:55-70` (no overlap validation); `src/utils/touElectricity.ts:92` (`parsedBands.find(...)`)
**Issue:** `upsertBand` validates HH:MM shape and rate finiteness but not overlap. A user entering "Off-Peak 22:00-08:00" and "Peak 17:00-23:00" gets 22:00-23:00 priced by whichever band was added first, with no warning and no way to see which won. Since this feeds saved-job cost snapshots, the ambiguity is permanent in the data. The Settings editor also offers no reordering, so the tiebreak is effectively arbitrary insertion order.
**Fix:** In `upsertBand`, reject (or warn on) a band whose minute-range intersects an existing band's range (wrap-aware — reuse `bandCoversMinute` against the candidate's start/end minutes), surfacing an inline message in SettingsModal's band editor.

### WR-08: Job-linked failure deducts the job's TOTAL grams from a single material — over-deducts on multi-material jobs

**File:** `src/components/JobsManager.tsx:1276-1283` (totalGrams summed across all filament rows), `src/components/LogFailureModal.tsx:81-83`, deduction at `src/hooks/useFailureEvents.ts:52-57`
**Issue:** `jobFilamentGrams` is the sum over ALL FilamentUsage rows, but the stockEvent deducts the entire `gramsWasted` from the ONE selected material (default: dominant). For a 300g PLA + 200g PVA job failed at 50%, 250g is deducted from PLA and 0g from PVA — PLA stock understated, PVA overstated. The user can also switch the modal's material Select to a filament not even on the job and deduct the whole amount from it.
**Fix:** For job-linked failures, write one stockEvent per filament row scaled by %complete (`f.grams × pct/100` against `f.filamentId`), or at minimum use only the dominant material's own grams (not the job total) as the basis.

## Info

### IN-01: Stale "9 store names" comment on BACKUP_STORES

**File:** `src/utils/backupSchema.ts:60-63`
**Issue:** The doc comment says "The 9 store names in fixed order" — the array now has 11.
**Fix:** Update to 11 (or drop the count to avoid future drift).

### IN-02: Failure-reason label map duplicated

**File:** `src/components/ReportsSection.tsx:363-370` (`REASON_LABELS`) vs `src/components/LogFailureModal.tsx:36-43` (`REASON_OPTIONS`)
**Issue:** The same six enum→label strings exist in two files; a label change will drift.
**Fix:** Export one map (e.g. from a `failureReasons.ts` util or from LogFailureModal) and derive both from it.

### IN-03: Hardcoded DOM ids break the calculator's useId pattern

**File:** `src/components/calculator/CostParametersSection.tsx:191, 215` (`"tou-start-time"`, `"maintenance-cost-per-hour"`)
**Issue:** Every other field id flows through the orchestrator's `useId()`-based `ids` object (CostCalculator.tsx:53-72) precisely to guarantee uniqueness; these two are string literals.
**Fix:** Add `touStartTime`/`maintenanceCost` entries to the `ids` object and thread them through like the rest.

### IN-04: LogMaintenanceModal date fields are UTC-based — off-by-one around midnight for non-UTC users

**File:** `src/components/LogMaintenanceModal.tsx:31-33` (`toISOString().slice(0,10)`), `:85` (`new Date(occurredAt)`)
**Issue:** The default "today" is the UTC date (evening in UTC-7 shows tomorrow), and `new Date('YYYY-MM-DD')` parses as UTC midnight, so `toLocaleDateString()` in the history list can render the previous day.
**Fix:** Build the input default from local date parts, and parse with `new Date(y, m-1, d)`.

### IN-05: makeId fallback collides on same-millisecond writes

**File:** `src/hooks/useFailureEvents.ts:8-12`, `src/hooks/useMaintenanceEvents.ts:8-12`
**Issue:** The non-crypto fallback `${prefix}-${Date.now()}` produces duplicate primary keys for two writes in the same millisecond (Dexie `add` would throw ConstraintError). Only reachable where `crypto.randomUUID` is absent, but a counter suffix is free.
**Fix:** `` `${prefix}-${Date.now()}-${++seq}` ``.

### IN-06: touSavingsHint memo has an unstable dep, and the Settings tooltip misdescribes the weighting

**File:** `src/components/calculator/CostCalculator.tsx:156-171`; tooltip in `src/components/SettingsModal.tsx` ("Prints that start during a band use that band's rate")
**Issue:** `touBands` is re-created each render (`electricity.touBands ?? []`), so the `useMemo` recomputes every render (correctness unaffected). Separately, the user-facing tooltip says a print "uses that band's rate", but the implementation duration-weights across every band the print passes through — the copy undersells/mis-states the actual (better) behavior.
**Fix:** Hoist `const EMPTY_BANDS: TouBand[] = []` or memo `touBands`; reword the tooltip ("each hour of the print is priced by the band it falls in").

### IN-07: LogFailureModal treats a rejected logFailure as success

**File:** `src/components/LogFailureModal.tsx:103-104`
**Issue:** `logFailure` returns `undefined` (no throw) when its Number.isFinite guards reject the input; the modal ignores the return and calls `onClose()` — silent success on a rejected write. Currently unreachable because the form clamps inputs first, but the seam is fragile.
**Fix:** `const id = await logFailure(input); if (id === undefined) { setError('Could not log the failure.'); return; } onClose();`

### IN-08: touStartTime is saved onto jobs even after TOU bands are removed — hidden sticky state

**File:** `src/components/calculator/CostCalculator.tsx:331-332`; picker gating at `CostParametersSection.tsx:189`
**Issue:** If a start time was set and the user later deletes all bands in Settings, the picker disappears but `touStartTime` state persists invisibly and is written to the saved job together with a `touRateUsedPerKwh` snapshot (the flat rate). types.ts documents `touStartTime` as "undefined if no TOU bands were configured" — this path violates that. Harmless money-wise (rate = flat) but writes off-contract data.
**Fix:** Gate the save fields on bands too: `touStartTime: touBandsConfigured && touStartTime ? touStartTime : undefined` (and the rate likewise), or clear `touStartTime` when `touBandsConfigured` flips false.

---

## Fix Pass

**Fixed:** 2026-07-07 · **Scope:** Critical + Warning (Info findings deliberately not addressed) · **Outcome:** 11/11 fixed, 0 skipped

| Finding | Outcome | Commit | Notes |
|---------|---------|--------|-------|
| CR-01 | FIXED | `6520319` | `validateBackupFile` defaults absent `failureEvents`/`maintenanceEvents` to `[]` (PRESENT-but-non-array still rejects). Legacy v1.9-shaped regression tests added. |
| CR-02 | FIXED | `76d651d` | Deduction condition no longer requires `jobId` — standalone failures with user-entered grams now deduct stock, matching the D-03 contract. Test that locked the skip behavior flipped; types.ts + hook doc comments corrected. |
| CR-03 | FIXED | `95889ba` | Chose the **override-UI approach** (per-finding guidance: pick ONE): Asset Library filament editor now has an "Abrasive (wears brass nozzles)" select (Auto-detect / Abrasive / Not abrasive) persisting `Asset.isAbrasive`, which `resolveIsAbrasive` already honors. The auto-detect regex was deliberately left unchanged — narrowing it would risk repricing the CF-on-brass golden scenario baseline. Tradeoff: names like "Carbon Black" still auto-detect abrasive by default, but the select shows what auto-detect resolves and the user now has an in-app remedy. 4 regression tests added. |
| WR-01 | FIXED | `058f5ac` | `logFailure` (add + deduction) and `deleteFailure` (delete + reversal) each wrapped in `db.transaction('rw', failureEvents, stockEvents, ...)`. |
| WR-02 | FIXED | `4399154` | Reset-on-open effect keyed on `[isOpen, instance.id]` re-seeds `printerHoursAtEvent`/`nozzleType` from the live instance (mirrors LogFailureModal). Regression test added. |
| WR-03 | FIXED | `4aae335` | `handleSave` wraps the Dexie write in try/catch → `setSaveError` (role=alert); MaintenanceSection's delete is now an async handler with its own visible `actionError`. Regression test added. |
| WR-04 | FIXED (doc) | `6732025` | The fabricated abrasive-hours-acceleration paragraph was replaced with an honest NOTE: no acceleration is implemented; nozzle projections use logged swap intervals only (which already reflect abrasive wear empirically). Implementing the scaling was judged NOT trivially safe (new data plumbing into `predictForPartType` + changed prediction outputs) — **descope recorded here** per the finding's fallback option. |
| WR-05 | FIXED | `eceb69f` | Apply now writes `Math.min(99, Math.round(rate))` for the empirical failure rate (honors the field's 0-99 contract + whole-percent display) and rounds the amortized maintenance rate to 2 decimals. |
| WR-06 | FIXED | `6059cd2` | CostSummaryPanel itemizes `Maintenance ({h}h print)` and `Abrasive nozzle wear (brass)` as conditional rows mirroring the `costs.materials > 0` pattern — listed rows sum to Subtotal again. Output-equivalence snapshot verified untouched (oracle captures True Cost/Sell Price/etc., not row layout). |
| WR-07 | FIXED | `b61500f` | New pure `bandsOverlap` helper (wrap-aware, half-open windows) in touElectricity.ts; `upsertBand` now returns `string \| null` and rejects overlapping windows (also messages for malformed/max-3); SettingsModal surfaces the message inline (role=alert) and keeps the user's inputs on rejection. Pre-existing max-3 test fixtures updated to disjoint windows (they used three identical windows, invalid under the new rule). 4 overlap tests added. |
| WR-08 | FIXED | `bbe7f43` | The job DOES carry per-material grams (`job.filaments`), so the full fix shipped: JobsManager passes `jobFilaments` in the prefill; LogFailureModal computes a per-material `materialBreakdown` (each row's grams × %completion); `logFailure` writes one stockEvent per material (`failure-{id}__{assetId}` ids, shared `failure-{id}` refId, NOT persisted on the FailureEvent row); `deleteFailure` reverses the whole set via the indexed `refId`. 5 regression tests added. |
| IN-01..IN-08 | NOT ADDRESSED | — | Info findings out of fix scope (`critical_warning`). |

**Verification at end of fix pass:** `npx tsc -b` clean · `npx vitest run` 1016 passed / 1 todo (84 files; was 997 pre-fix — 19 regression tests added) · output-equivalence / renderCount / pricingSequence tripwires green · `__snapshots__/outputEquivalence.test.tsx.snap` byte-identical · goldenScenarios.ts untouched · eslint 0 errors on all touched files (7 pre-existing warnings incl. IN-06's touBands memo note).

---

_Reviewed: 2026-07-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fix pass: 2026-07-07 — Claude (gsd-code-fixer)_
