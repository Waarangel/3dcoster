# Phase 39: Cost Realism - Research

**Researched:** 2026-07-06
**Domain:** Local-first cost-derivation features (empirical failure rate, time-of-use electricity, maintenance/wear amortization) on an existing React + TypeScript + Dexie (IndexedDB) app, post-Phase-38 CostCalculator split
**Confidence:** HIGH — grounded in direct codebase reading (this session) + milestone research (`.planning/research/*.md`, 2026-07-03) + CONTEXT.md locked decisions (2026-07-05)

## Summary

Phase 39 adds three cost-realism features to the already-split CostCalculator architecture: an empirical failure-rate engine (log failures → derive per-printer×material rate → suggest with one-click Apply), time-of-use electricity tariffs (user-entered peak/off-peak bands → weighted rate by print start time), and maintenance/wear amortization (log maintenance events → amortized $/hr suggestion + next-swap prediction, with abrasive-hours tracking for CF/GF on brass nozzles). All three follow one shared mental model locked in CONTEXT.md: **manual input stays authoritative; a derived suggestion appears with one-click Apply; nothing reprices existing saved jobs silently.**

The phase requires two new Dexie stores (`failureEvents`, `maintenanceEvents`) at `db.version(12)` — confirmed correct, since `database.ts` is currently at `version(11)`. No new npm packages are needed; every requirement is satisfiable with existing dependencies (Dexie, dexie-react-hooks, React). The `costCalc.ts` pure function stays untouched in its exported surface shape except for additive `CalcInput` fields (TOU electricity rate override, wear/nozzle-surcharge inputs) — the existing `failureRate: number` field is reused as-is; the empirical engine is a suggestion layer that writes INTO that field via "Apply," never a parallel code path inside `calculateCost`.

The highest-risk decision this phase makes is where new derived-money fields snapshot onto `PrintJob` (mirroring `fixedCostsAtSave`) and how the existing 120-scenario output-equivalence oracle + render-count/sequence tripwires from Phase 38 must be extended, not bypassed. A secondary risk is the abrasive-wear/nozzle-surcharge model touching `calculateNozzleWear` in `costCalc.ts`, which already has an established (and tested) formula — Phase 39 must decide whether abrasive surcharge is a NEW cost component or a modifier to the EXISTING nozzle-wear calculation, and this needs to be explicit in the plan to avoid silently changing every abrasive-material job's cost.

**Primary recommendation:** Build all three features as pure-derivation hooks (`useFailureRate`, `useTouElectricity`/`useWeightedElectricityRate`, `useMaintenanceAmortization`) that read Dexie via `useLiveQuery`, feed a hint row into the already-existing `CostParametersSection`, and let the user's own manual inputs (`failureRate`, `costPerKwh` override, maintenance budget field) remain the values that flow into `costCalc.ts`. Never write derived values directly into `CalcInput` — only the user's Apply-click does that, through the same `useCostForm` setters Phase 38 already exposes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Failure event logging (FAIL-01) | Browser/Client (React component + Dexie write) | — | Local-first app, no backend exists; write goes straight to IndexedDB via a new hook |
| Empirical failure-rate derivation (FAIL-02) | Browser/Client (`useMemo`/`useLiveQuery` hook) | — | Pure client-side aggregation over `failureEvents` + `jobs`; no server, derived-not-stored per Architecture Anti-Pattern 2 |
| Scrap-cost fold-in (FAIL-03) | Browser/Client (`costCalc.ts` pure function) | — | Existing `failureRate` field in `CalcInput`; Apply writes the value, `calculateCost` consumes it unchanged |
| Failure ledger view (FAIL-04) | Browser/Client (Reports tab section) | — | Read-only view over `failureEvents`, reuses `useLiveQuery` |
| TOU tariff config (TOU-01) | Browser/Client (Settings modal + Dexie `settings` store) | — | User-entered, no API (locked decision); stored like existing `ElectricityConfig` |
| Weighted TOU electricity cost (TOU-02) | Browser/Client (`costCalc.ts` extension) | — | Pure function extension: given bands + start time + duration, compute weighted rate; feeds `CalcInput.electricity` |
| Maintenance event logging (WEAR-01) | Browser/Client (Printer Settings drill-in + Dexie write) | — | Local IndexedDB write, mirrors `stockEvents` ledger pattern |
| Abrasive-hours tracking (WEAR-01) | Browser/Client (derived hook over `maintenanceEvents` + job filament history) | — | Pure aggregation; no persistence of the derived total itself |
| Amortized $/hr + next-swap prediction (WEAR-02) | Browser/Client (derived hook + hint in `CostParametersSection`) | — | Pure derivation from `maintenanceEvents`; existing 500h alert (`App.tsx` ~175-195) stays as fallback, not replaced |

No tier other than Browser/Client is relevant — this project has zero backend (`ARCHITECTURE.md` fact #8) and Phase 39 introduces none. All five capabilities are client-only by design (CONTEXT.md: "No backend, no accounts").

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Failure logging & ledger (FAIL-01, FAIL-04)**
- D-01: Logging surfaces = job row + ledger. Icon action on each saved job row in JobsManager (pre-fills printer + dominant material) PLUS a standalone "Log failure" button in the failure ledger view. No calculator-side logging surface.
- D-02: Entry fields = required trio (% completion, printer, material) + reason enum (adhesion, stringing/quality, clog, mechanical, power loss, other) + optional free-text notes. No photos, no per-entry cost override.
- D-03: Logging a failure deducts wasted filament from v1.8 stock. A failure logged from a job writes a stockEvent deducting (job filament grams × % completion), reusing deduct-on-job machinery. Standalone failures (no job) skip deduction unless the user enters grams.
- D-04: The failure ledger lives as a "Failures" section inside the existing Reports tab — per printer, per material, over time. No new top-level tab.

**Empirical rate derivation (FAIL-02)**
- D-05: rate = failures ÷ (saved jobs + failures) for the printer × material combo, all-time. Every saved job counts as one successful attempt. No % completion weighting, no rolling window.
- D-06: Suggestion threshold = ≥5 attempts (jobs + failures) for the combo. Below threshold the hint is hidden entirely.
- D-07: One-level fallback with provenance. If the exact combo is below threshold but the printer's all-materials rate clears it, suggest that, explicitly labeled. Never cascade to a global all-printers rate.
- D-08: Multi-material jobs key off the dominant (highest-weight) filament. Failure logging pre-selects it (user can change); the calculator suggestion keys off the currently-dominant filament in the form.
- Locked by requirements (not re-decided): manual failure-rate input stays authoritative; empirical rate is a suggestion with one-click Apply; saved jobs/quotes are never silently repriced (FAIL-03).

**TOU tariff modeling (TOU-01, TOU-02)**
- D-09: Tariff structure = flat default rate + up to 3 named bands, each with a rate and a daily time window. No seasonal or per-day-of-week variants this phase.
- D-10: Start time = optional time-of-day picker in the cost-parameters section, visible only when a TOU tariff is configured. Empty = flat rate. Weighted rate computed from start time + print duration (bands crossed proportionally, including overnight wrap-around).
- D-11: Inline savings hint. When a TOU tariff exists and the chosen start time isn't optimal, show a one-line hint with the cheapest start window and the dollar saving.
- D-12: Saved jobs snapshot BOTH the start time and the weighted electricity rate used (fixedCostsAtSave precedent). Later tariff edits never silently reprice history. Ships with the mandatory one-time reconcile helper for existing jobs (null = flat rate).

**Maintenance & wear model (WEAR-01, WEAR-02)**
- D-13: Abrasive detection = auto-detect + override. Auto-flag materials whose type/name matches CF/GF/glow/metal-fill patterns; per-material `isAbrasive` toggle for corrections.
- D-14: Amortized $/hr = suggestion + Apply, mirroring the failure-rate pattern: the derived rate (total maintenance cost ÷ printer hours) appears as a hint beside the existing manual maintenance-budget field with one-click Apply. Manual input stays authoritative; no automatic replacement, no separate double-counting line item.
- D-15: Next-swap prediction = per-part intervals. Each part category's average interval derives from its own swap history (nozzle vs belt vs bed separately), projected from current printer hours + recent print pace; abrasive-hours accelerate the nozzle projection on brass. The existing generic 500h alert stays as the fallback — NOT removed.
- D-16: Maintenance UI = per-printer drill-in in Printer Settings. Each printer gets a "Maintenance" section: log button + event history + cumulative cost + abrasive-hours + next-swap prediction. Reports stays focused on the failure ledger.

### Claude's Discretion
- Exact Apply-button behavior details (rounding/precision of applied rates), rate display formatting.
- What counts as an "attempt" for jobs saved before Phase 39 (all historical saved jobs presumably count — confirm feasibility at plan time).
- `failureEvents`/`maintenanceEvents` schema field details beyond the decided fields; Dexie version number (research assumed v12 — verify current version).
- Whether nozzle type (brass/hardened/ruby) becomes a field on the printer record to gate the abrasive surcharge (research suggests yes — planner decides shape).
- Editing/deleting ledger entries (failures and maintenance events) — expected but mechanism is free; stock-deduction reversal on failure-entry delete should follow the v1.8 self-correcting stockEvents pattern.
- Exact placement/wording of hints inside `CostParametersSection` and the NEW-badge treatment (must follow the NEW-badge overlay rules).

### Deferred Ideas (OUT OF SCOPE)
- Seasonal / per-day-of-week tariff variants (D-09 capped at 3 daily bands) — future TOU enhancement if users ask.
- Photo attachments and per-entry wasted-cost overrides on failure entries (D-02 kept entry lean).
- Maintenance cost trend chart ("are repairs getting more expensive?") — natural Phase 40 Insights candidate.
- Read-only maintenance roll-up in Reports (D-16 chose Printer Settings only this phase).
- Weekday/weekend-aware TOU via full date-time input (D-10 chose time-of-day only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FAIL-01 | Log a print failure in one tap (job row + ledger), % completion + printer + material required, creates `failureEvents` Dexie entry | New store schema below; `useStockEvents.ts` (existing) is the direct pattern template for the new `useFailureEvents` hook; JobsManager icon-button conventions (EditButton/DeleteButton pattern) apply to the new log-failure icon action |
| FAIL-02 | Derive empirical failure rate per printer × material, show as suggestion beside manual input with one-click Apply; `costCalc.ts` untouched | `CalcInput.failureRate: number` already exists and is consumed unchanged by `calculateCost` (verified in `costCalc.ts` lines 28-45, 182-185); Apply writes via existing `useCostForm` setter, exactly like a user typing the value |
| FAIL-03 | Applied rates fold real scrap cost into true cost via % completion; saved jobs untouched until re-edited | `calculateCost`'s existing `failureMultiplier = 1 / (1 - clampedFailureRate/100)` already produces this effect — no new cost-math needed, only new suggestion UI wiring into the same input |
| FAIL-04 | Failure history/diagnostic ledger, per printer, per material, over time | D-04: lives in Reports tab as new "Failures" section; `ReportsSection.tsx` is the existing surface to extend |
| TOU-01 | Define TOU tariffs (peak/off-peak rates + windows) in Settings, user-entered, no API | New settings shape stored like `ElectricityConfig` (currently `{ costPerKwh: number }` in `db.settings`); extend via optional TOU fields, following the `SeedState`-in-settings JSON pattern (no Dexie version bump needed for settings-only additions, per Architecture fact re: JSON-in-settings) |
| TOU-02 | Job electricity cost uses TOU tariff based on start time + duration, flat rate as default | Extends `calculateElectricityCost` in `costCalc.ts` (currently `(wattage/1000) × printTimeHours × costPerKwh`) with a weighted-rate computation; D-12 requires snapshotting the resolved rate + start time onto `PrintJob`, mirroring `fixedCostsAtSave` |
| WEAR-01 | Log maintenance events (type, cost, date, printer-hours), track cumulative abrasive-hours for CF/GF on brass nozzles | New `maintenanceEvents` store; abrasive detection via `FilamentType` pattern matching (CF/GF/glow/metal-fill substrings) against the existing `FilamentType` union in `types.ts` lines 1-9; nozzle type needs a new field on printer records (Claude's discretion — recommend `PrinterInstance` or `PrinterAsset`) |
| WEAR-02 | Maintenance amortizes into real $/hr per printer, predicts next likely swap | Existing `printerInstances.printHours` odometer (`addPrintHours`, `App.tsx` ~175-195) is the hours-tracking base; existing 500h alert (`isMaintenanceDismissed`, `MAINTENANCE_INTERVAL` in `src/utils/maintenanceDismissed.ts`) is the fallback that D-15 explicitly keeps |
</phase_requirements>

## Standard Stack

### Core

No new external libraries are required for this phase. Every requirement is implementable with the existing stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie | ^4.2.1 (confirmed via `package.json`) `[VERIFIED: package.json]` | IndexedDB wrapper; new stores at `db.version(12)` | Already the project's only persistence layer; no reason to introduce a second one for two more append-style stores |
| dexie-react-hooks | (already a dependency — used by `useLiveQuery` throughout `src/hooks/`) `[VERIFIED: codebase grep]` | Reactive Dexie queries in new hooks (`useFailureEvents`, `useMaintenanceEvents`) | Matches `useStockEvents.ts` exactly; zero new API surface to learn |
| react | 18.x (project baseline) `[VERIFIED: package.json / project CLAUDE.md]` | Hooks, section components | Existing Phase 38 architecture |

### Supporting

No supporting libraries needed. Time-of-day parsing, band-crossing math (including overnight wrap-around), and swap-interval prediction are all straightforward arithmetic on native `Date`/`number` — do not reach for a datetime library (`date-fns`, `dayjs`) for this; the existing codebase does not use one and the math involved (minutes-since-midnight comparisons, modulo 1440) is simple enough that adding a dependency would be net-negative per YAGNI.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled TOU band-crossing math | `date-fns` or `dayjs` for time arithmetic | Rejected — the calculation is "how many minutes of a duration fall in band X," pure integer arithmetic; a date library adds bundle weight (violates the `< 300kb` app-page JS budget) for no capability gain |
| New `failureEvents`/`maintenanceEvents` Dexie stores | A single generic "events" store with a `type` discriminator | Rejected — the existing codebase pattern is one store per domain concept (`stockEvents`, `sales`, `jobs`); a generic events table would need query filtering by type on every read and loses Dexie's compound-index benefits for `printerInstanceId, materialId` lookups |
| Client-side derived failure rate | Storing a materialized `empiricalFailureRate` field on a printer/material record | Rejected — `ARCHITECTURE.md` Anti-Pattern 2 explicitly warns against storing derived insight values; would require invalidation logic and violates the "derive in useMemo" pattern already established for the Insight layer |

**Installation:**
No installation needed — zero new packages.

**Version verification:** Confirmed `dexie: "^4.2.1"` in `package.json` (line 25) via direct file read. Dexie's current Dexie version at `src/db/database.ts` is `db.version(11)` (last migration block starts at line 249) — Phase 39's two new stores correctly require `db.version(12)`, confirming CONTEXT.md's assumption.

## Package Legitimacy Audit

**Not applicable this phase.** No external packages are being installed — Phase 39 is implemented entirely with existing dependencies (`dexie`, `dexie-react-hooks`, `react`, native `Date`/`Intl`). The Package Legitimacy Gate protocol is skipped per its own scope condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  JobsManager (job row)          Printer Settings (drill-in)          │
│  [Log Failure icon] ──┐         [Maintenance section] ──┐            │
│                        │                                 │            │
│  Reports tab           │                                 │            │
│  [Failures section] ◄──┤ (standalone log button too)     │            │
│  [Failure ledger view] │                                 │            │
│                        ▼                                 ▼            │
│              db.failureEvents (NEW, v12)      db.maintenanceEvents(NEW, v12) │
│                        │                                 │            │
│                        ▼                                 ▼            │
│              useFailureRate(printerId, materialId)  useMaintenanceAmortization(printerId) │
│              → { empiricalRate, sampleSize,         → { amortizedPerHour, nextSwapDate,   │
│                   provenance }                          abrasiveHours }                    │
│                        │                                 │            │
│                        └──────────────┬──────────────────┘            │
│                                       ▼                                │
│                     CostParametersSection.tsx (Phase 38 section)       │
│                     ├── Failure Rate input + hint row + [Apply]        │
│                     ├── TOU start-time picker (conditional) + savings hint │
│                     └── Maintenance $/hr hint + [Apply]                │
│                                       │                                │
│                                       ▼ (Apply writes via useCostForm) │
│                     useCostForm (form state) → useCostDerivedValues    │
│                                       │                                │
│                                       ▼                                │
│                     costCalc.ts::calculateCost(CalcInput)              │
│                     ├── calculateElectricityCost (EXTENDED: TOU weighting) │
│                     ├── failureRate multiplier (UNCHANGED)             │
│                     └── nozzleWear / abrasive surcharge (EXTENDED)     │
│                                       │                                │
│                                       ▼                                │
│                     CostBreakdown → CostSummaryPanel (render)          │
│                                       │                                │
│                                       ▼ (on Save)                      │
│                     PrintJob record: failureRate (existing field,      │
│                     now possibly Applied), touStartTime + touRateUsed  │
│                     (NEW snapshot fields, D-12, mirrors fixedCostsAtSave)│
└─────────────────────────────────────────────────────────────────────┘
```

A reader can trace the primary path: a job row or ledger button writes a `failureEvents` row → `useFailureRate` re-derives on the next render (via `useLiveQuery`) → the hint appears in `CostParametersSection` → the user clicks Apply → `useCostForm`'s existing setter updates `failureRate` → `useCostDerivedValues` recomputes `costCalc.ts` output → the summary panel re-renders → on Save, the resolved values snapshot onto the `PrintJob` record.

### Recommended Project Structure

```
src/
├── components/
│   ├── calculator/
│   │   └── CostParametersSection.tsx   # MODIFIED — add 3 hint rows (failure, TOU, maintenance)
│   ├── JobsManager.tsx                  # MODIFIED — add log-failure icon action per row
│   ├── ReportsSection.tsx               # MODIFIED — add "Failures" ledger section
│   ├── PrinterSettings.tsx              # MODIFIED — add per-printer "Maintenance" drill-in
│   ├── LogFailureModal.tsx              # NEW — % completion + printer + material + reason + notes
│   ├── LogMaintenanceModal.tsx          # NEW — part type + cost + date + printer-hours
│   └── SettingsModal.tsx                # MODIFIED — TOU tariff band editor (rates + windows)
├── hooks/
│   ├── useFailureEvents.ts              # NEW — CRUD + useLiveQuery, mirrors useStockEvents.ts
│   ├── useFailureRate.ts                # NEW — derives empirical rate (D-05..D-08 logic)
│   ├── useMaintenanceEvents.ts          # NEW — CRUD + useLiveQuery
│   ├── useMaintenanceAmortization.ts    # NEW — $/hr + next-swap prediction (D-14, D-15)
│   └── useTouTariff.ts                  # NEW — reads/writes TOU settings, weighted-rate helper
├── db/
│   └── database.ts                      # MODIFIED — db.version(12).stores({ failureEvents: ..., maintenanceEvents: ... })
├── utils/
│   ├── costCalc.ts                      # MODIFIED — extend CalcInput; calculateElectricityCost TOU-aware; nozzle/abrasive surcharge
│   ├── backupSchema.ts                  # MODIFIED — BACKUP_STORES + DATE_FIELDS + BackupData add both new stores
│   └── touElectricity.ts                # NEW — pure band-crossing math (no React, no Dexie), tested standalone
└── types.ts                             # MODIFIED — FailureEvent, MaintenanceEvent interfaces; PrintJob touStartTime/touRateUsed;
                                          #            PrinterInstance/PrinterAsset nozzleType; Asset isAbrasive
```

### Pattern 1: Suggestion-Not-Mutation (established phase-wide pattern)

**What:** A derived value is computed in a read-only hook and displayed as a hint next to the authoritative manual input, with an explicit "Apply" action that copies the value into form state via the existing setter.
**When to use:** Every derived suggestion in this phase (failure rate, maintenance $/hr, TOU savings).
**Example:**
```typescript
// Source: pattern established by CONTEXT.md D-05..D-08, D-14; mirrors the
// existing manual-input-is-authoritative architecture already in useCostForm.ts
const { empiricalRate, sampleSize, provenance } = useFailureRate(printerInstanceId, dominantMaterialId);

// In CostParametersSection.tsx (rendered only when sampleSize >= 5, per D-06):
{empiricalRate !== null && (
  <div className="text-xs text-slate-400">
    Your {printerName} prints {materialName} at {empiricalRate.toFixed(1)}% empirically
    ({sampleSize} attempts{provenance === 'printer-fallback' ? ` — ${printerName} overall` : ''})
    <button onClick={() => onFailureRateChange(empiricalRate)}>Apply</button>
  </div>
)}
```

### Pattern 2: Append-Only Ledger with Deterministic refId (established v1.8 pattern)

**What:** New Dexie stores follow the `stockEvents` shape — append-only, `id` primary key, indexed foreign keys, deterministic `refId` for events tied to a job so re-saves/deletes are idempotent.
**When to use:** Both `failureEvents` (tied to a job for stock deduction, D-03) and `maintenanceEvents` (tied to a printer, standalone).
**Example:**
```typescript
// Source: src/hooks/useStockEvents.ts (existing, read in this session) —
// direct template for the new stores' schema shape
export interface FailureEvent {
  id: string;
  printerInstanceId: string;
  materialId: string;              // dominant filament (D-08)
  jobId?: string;                  // undefined for standalone failures (D-01)
  percentComplete: number;         // required (D-02)
  reason: 'adhesion' | 'stringing' | 'clog' | 'mechanical' | 'power_loss' | 'other'; // D-02 enum
  notes?: string;
  failedAt: Date;
  gramsWasted?: number;            // computed from job filament × %complete (D-03), or user-entered for standalone
}

// database.ts v12
db.version(12).stores({
  failureEvents: 'id, printerInstanceId, materialId, jobId, failedAt',
  maintenanceEvents: 'id, printerInstanceId, partType, occurredAt',
});
// No upgrade() needed — both are new empty stores.
```

### Pattern 3: Snapshot-at-Save for Derived Money Fields (established Phase 22.1 pattern)

**What:** Any field whose value depends on external, mutable state (a tariff table, a printer's current settings) must snapshot its RESOLVED value onto the `PrintJob` record at save time, not recompute live on every render of history.
**When to use:** TOU-02 / D-12 specifically — `touStartTime` and the weighted rate actually used must both be stored on the job.
**Example:**
```typescript
// Source: src/types.ts:383 — the EXISTING fixedCostsAtSave field is the
// direct precedent this pattern extends
fixedCostsAtSave?: { depreciation: number; nozzleWear: number };

// NEW, Phase 39 (D-12) — same pattern, applied to TOU:
touStartTime?: string;      // "HH:MM" or undefined = flat rate was used
touRateUsedPerKwh?: number; // the WEIGHTED rate actually applied at save time;
                             // undefined on legacy jobs = flat rate (reconcile helper backfills null, not a number)
```

### Pattern 4: Auto-Detect + Manual Override (D-13)

**What:** A boolean/enum field that is computed by default from a pattern match, but stays user-editable to correct false positives/negatives.
**When to use:** `Asset.isAbrasive` detection from `FilamentType`.
**Example:**
```typescript
// Source: existing FilamentType union in types.ts:1-9 (CF/GF/metal-fill
// substrings already exist as literal type members: 'PLA-CF', 'PETG-CF',
// 'PET-CF', 'PA6-CF', 'PPA-CF' — no new type values needed, only a matcher)
const ABRASIVE_PATTERNS = /CF|GF|carbon|glass|glow|metal/i;

function detectIsAbrasive(filamentType: FilamentType | undefined, name: string): boolean {
  if (!filamentType) return false;
  return ABRASIVE_PATTERNS.test(filamentType) || ABRASIVE_PATTERNS.test(name);
}
// Stored as Asset.isAbrasive?: boolean — undefined means "use auto-detect,"
// explicit true/false means "user overrode." This is the SAME optional-field
// backward-compat pattern already used throughout Asset (see lowStockThreshold).
```

### Anti-Patterns to Avoid

- **Storing the empirical failure rate or amortized $/hr as a materialized field on the printer/material record:** `ARCHITECTURE.md` Anti-Pattern 2 — derive in `useMemo`/`useLiveQuery`, never persist. Going stale on every new job/failure without invalidation logic is the exact bug class this avoids.
- **Making the failure-rate suggestion auto-apply instead of requiring a click:** Directly contradicts the locked "manual input stays authoritative" rule (FAIL-02/FAIL-03) and CONTEXT.md's "one mental model" (Specifics section) — the user must stay in control of the number that prices the job.
- **Changing `calculateNozzleWear`'s existing formula in place for the abrasive surcharge:** This function is already tested and used by every existing job's `nozzleWear` cost. Adding an abrasive surcharge must be an ADDITIVE new cost component (or an explicit, tested modification with output-equivalence coverage) — never a silent formula change that shifts every historical job's live-recomputed cost on next open. See Pitfall M-04 below.
- **Re-computing TOU-weighted electricity cost live from the CURRENT tariff table when displaying a saved job:** Violates D-12 — must read the snapshotted `touRateUsedPerKwh`, not recompute from Settings' live tariff bands, or editing tariffs retroactively changes displayed history.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOU band-crossing math (a print spanning multiple tariff windows, including past-midnight wrap) | A custom recursive time-slicing algorithm from scratch without tests | A small pure function operating on "minutes since midnight" integers with explicit wrap-around modulo arithmetic, unit-tested with the exact overnight case (e.g., 11pm start + 10h duration crossing a midnight boundary) | The complexity is real but bounded — a naive implementation will get overnight wrap-around wrong on the first try; needs deliberate test coverage, not a library (no good small library exists for this narrow use case) |
| Next-swap-date prediction | A generic time-series forecasting approach (linear regression, etc.) | Simple "average interval between last N swaps of this part type" projected forward using "current printer hours + recent print pace (hours/day over the last N days of job history)" | D-15 explicitly scopes this to a simple average-interval projection per part category — a generic forecasting library is scope-inflation the phase doesn't call for |
| Failure-rate percentage math | Reinventing the wheel on `1/(1-p)` style formulas | The EXISTING `calculateCost`'s `failureMultiplier = 1 / (1 - clampedFailureRate / 100)` (costCalc.ts:183-185) | Already implemented, tested, and is the exact formula FEATURES.md documents (`true_failure_cost = material_cost × (1/(1-failure_rate) - 1)`) — do not reimplement |
| Deduct-on-job stock reversal for deleted failure entries | A bespoke delete-and-recompute routine | The existing `stockEvents` deterministic-refId pattern (`${jobId}__${assetId}` style id) — deleting/re-adding a stock event by the same refId is already self-correcting per the v1.8 pattern | `useStockEvents.ts` + the deduct-on-job machinery already solves exactly this idempotency problem; reuse the id-construction convention rather than building new reversal logic |

**Key insight:** Every "hard part" of this phase (failure-rate math, stock deduction, snapshot-at-save, append-only ledgers) already has a working, tested precedent somewhere in this codebase. The actual net-new work is: (1) two new Dexie stores following an established shape, (2) a handful of small pure derivation functions, and (3) UI wiring into an already-clean `CostParametersSection`. Resist the urge to design anything more elaborate — CONTEXT.md's Deferred Ideas section exists precisely to keep this phase narrow.

## Common Pitfalls

### Pitfall 1: Abrasive Surcharge Silently Changes Every Existing Job's Cost (mirrors milestone Pitfall M-04)

**What goes wrong:** If WEAR-01's abrasive-hours tracking is wired directly into `calculateNozzleWear` (or a new surcharge is added to the per-unit subtotal unconditionally) without a reconcile/opt-in mechanism, every previously-saved job using a CF/GF filament recomputes to a different `costPerUnit` the next time it's viewed or the calculator is loaded with those inputs.
**Why it happens:** The abrasive surcharge is naturally implemented as "if material.isAbrasive && printer.nozzleType === 'brass', add X" inside the same cost function that already runs on every render — there's no natural gate that makes it snapshot-only.
**How to avoid:** Treat the abrasive surcharge exactly like the milestone's own guidance for failure-cost model changes (Pitfall M-04): this is a NEW cost line, additive and clearly labeled, not a silent modification to `nozzleWear`. Since it's a NEW feature this phase (not previously existing on any saved job), there's no legacy-data reprice risk for it specifically — but the amortized maintenance $/hr (D-14) must remain suggestion-only (Apply-gated), never auto-injected into `costCalc.ts`'s existing "maintenance budget" field.
**Warning signs:** A saved job's displayed cost changes after Phase 39 ships, with no corresponding "Apply" click by the user; `calculateNozzleWear`'s signature or return value changes without new output-equivalence fixture coverage for CF/GF materials.

### Pitfall 2: PERF-11-Class Stale Closures When Wiring New Hint Rows Into CostParametersSection

**What goes wrong:** `CostParametersSection` currently has clean props-in/callbacks-out with no internal derived state (confirmed by direct read this session — it's pure JSX with props). Adding `useFailureRate`, `useTouTariff`, `useMaintenanceAmortization` calls *inside* this component (rather than passing their results down as props from the orchestrator) reintroduces exactly the kind of internal-hook-plus-effect complexity Phase 38 just extracted away.
**Why it happens:** It's tempting to call the new hooks directly inside `CostParametersSection` since that's where the hint UI renders, but `CostParametersSection`'s contract (per its own header comment: "Props-in, callbacks-out; no Dexie access, no business math") explicitly forbids this.
**How to avoid:** All three new hooks (`useFailureRate`, `useTouTariff`/weighted-rate helper, `useMaintenanceAmortization`) must be called in `CostCalculator.tsx` (the orchestrator) or in `useCostDerivedValues.ts`, and their results passed down as new props to `CostParametersSection`, following the exact same pattern as every existing prop on that component.
**Warning signs:** A `useLiveQuery` or `db.` import appears inside `CostParametersSection.tsx`; the component's "no Dexie access, no business math" comment is violated.

### Pitfall 3: Output-Equivalence Oracle and Render-Count Tripwires Silently Bypassed

**What goes wrong:** Phase 38 shipped a 120-scenario output-equivalence oracle (`outputEquivalence.test.tsx`) plus `renderCount.test.tsx` and `pricingSequence.test.tsx`. Any new `CalcInput` field (TOU rate, abrasive surcharge) that isn't included in `goldenScenarios.ts` fixtures means the oracle can pass while a genuine regression in the NEW code path goes completely untested.
**Why it happens:** The oracle was built for the Phase 38 field set; adding fields without extending fixtures makes the tests "green" without actually exercising the new logic (a false sense of coverage).
**How to avoid:** Any task that adds a `CalcInput` field MUST add corresponding scenarios to `goldenScenarios.ts` that vary that specific field (e.g., a TOU-tariff-active scenario, a CF-filament-on-brass-nozzle scenario), and extend `renderCount.test.tsx`/`pricingSequence.test.tsx` coverage if the new field participates in the pricing interlink (it likely does not — TOU/wear are cost inputs, not price/margin/profit interlink fields — but this must be verified per-field at plan time, not assumed).
**Warning signs:** A PR modifies `costCalc.ts` or `CalcInput` without a corresponding diff in `__fixtures__/goldenScenarios.ts`.

### Pitfall 4: Empirical Rate Query Performance at Scale (Reads Every Job on Every Keystroke)

**What goes wrong:** `useFailureRate(printerInstanceId, materialId)` needs to count "saved jobs" for the combo (D-05: rate = failures ÷ (saved jobs + failures)). A naive implementation calls `useLiveQuery(() => db.jobs.toArray())` and filters in JS on every render. At a few thousand jobs (a multi-year power user, per `PITFALLS.md`'s Performance Traps table precedent for `db.liveQuery()` on the full jobs table) this becomes a real cost, and it re-fires on ANY job change, not just changes relevant to this specific printer×material combo.
**Why it happens:** Dexie's compound-index querying is not the obvious first thing to reach for; `.toArray()` and filter is the "just make it work" path.
**How to avoid:** Query with an indexed filter where possible (`db.jobs.where('printerInstanceId').equals(id)` then filter materials in JS, since `filaments` is an array field Dexie can't compound-index directly) rather than loading the entire jobs table. This matches the existing `PITFALLS.md` guidance ("At 5000 jobs, the subscription re-fires the entire aggregate on every job change... Prevention: paginate if > 1000 rows per table" — though full pagination is likely overkill for a solo-maker's job count, an indexed `.where()` clause is a low-cost improvement worth doing from the start).
**Warning signs:** `useFailureRate` or any new hook calls `.toArray()` on the full `jobs` or `failureEvents` table without an index-scoped `.where()` clause first.

### Pitfall 5: TOU Weighted Rate Reconcile Helper Missing or Wrong Default

**What goes wrong:** D-12 requires a "mandatory one-time reconcile helper for existing jobs (null = flat rate)." If this reconcile helper is skipped, or if it backfills a NON-null value (e.g., today's flat rate) instead of explicit `undefined`/`null`, future reads of `touRateUsedPerKwh` cannot distinguish "this job predates TOU" from "this job explicitly used the flat rate at $X/kWh" — silently misattributing cost history.
**Why it happens:** The natural instinct when backfilling a new field is to compute "the best guess" value rather than an explicit absence marker; this is exactly the failure mode `feedback_reconcile_legacy_data.md` (project memory) warns about ("every schema/behavior change touching a derived field must ship with a one-time reconcile helper, not a forward-only fix").
**How to avoid:** Follow the `stampRecordCurrency`-style pattern in `src/db/backfill.ts` (read this session) — the reconcile helper should explicitly set `touStartTime = undefined` / leave `touRateUsedPerKwh` absent for pre-Phase-39 jobs, and the READ side (wherever a job's displayed electricity cost is shown) must treat `undefined` as "flat rate was used" rather than crashing or defaulting to `0`.
**Warning signs:** The reconcile helper for `touRateUsedPerKwh` computes a numeric value from today's settings rather than leaving the field genuinely absent; any UI reading this field does not have an explicit `undefined` branch.

### Pitfall 6: Nozzle Type Field Placement Ambiguity (Printer Catalog vs. Printer Instance)

**What goes wrong:** CONTEXT.md leaves "whether nozzle type becomes a field on the printer record" to Claude's discretion, but the codebase has TWO printer-related entities: `PrinterAsset`/`PrinterConfig` (the catalog model — e.g., "Bambu X1C") and `PrinterInstance` (the user's specific physical unit — e.g., "Office A1"). Nozzle type is a property of the PHYSICAL machine (a user can swap nozzles on their specific unit), not the catalog model.
**Why it happens:** It's tempting to add `nozzleType` to `PrinterAsset` since that's where `nozzleCost`/`nozzleLifespanCm3` already live (costCalc.ts:86-100 reads these from `selectedPrinter: PrinterConfig`), but those existing fields describe a DEFAULT nozzle spec for the model, while a maintenance-swap event changes what's actually installed on one physical unit.
**How to avoid:** Place `nozzleType` (brass/hardened/ruby) on `PrinterInstance`, defaulting to the catalog's implied type if unset, since maintenance events (a specific swap) are already keyed to `printerInstanceId`. Confirm this decision explicitly in the plan rather than defaulting silently to the catalog model, since it affects both the `MaintenanceEvent` schema and how `calculateNozzleWear`/abrasive surcharge reads printer state.
**Warning signs:** The plan adds `nozzleType` to `PrinterAsset`/`PrinterConfig` without discussing why a per-physical-unit swap (a `PrinterInstance`-scoped event) would update a shared catalog record that other users' instances of the same printer model also reference.

## Code Examples

### Existing failureRate consumption in costCalc.ts (unchanged contract FAIL-02/FAIL-03 must respect)

```typescript
// Source: src/utils/costCalc.ts:181-185 (read directly this session)
// Failure-adjusted per-unit cost (clamp to 0-99 to prevent division by zero).
const clampedFailureRate = Math.min(Math.max(input.failureRate, 0), 99);
const failureMultiplier = 1 / (1 - clampedFailureRate / 100);
const failureAdjusted = perUnitSubtotal * failureMultiplier;
```
This is the EXACT mechanism FAIL-03 ("folds real scrap cost... into true cost") already implements. Phase 39's job is to feed a BETTER `input.failureRate` value (via the Apply button), not to add a second, parallel cost-adjustment path.

### Existing stockEvents pattern to template failureEvents/maintenanceEvents hooks

```typescript
// Source: src/hooks/useStockEvents.ts (read directly this session) — the
// direct template for useFailureEvents.ts / useMaintenanceEvents.ts
export function useStockEvents() {
  const events = useLiveQuery(() => db.stockEvents.toArray(), [], EMPTY);
  const stockByAssetId = useMemo(() => deriveStockByAsset(events), [events]);
  const logManualAdjustment = useCallback(async (assetId, delta, note) => {
    if (!Number.isFinite(delta)) { console.error(...); return; }
    const id = newManualId();
    await db.stockEvents.add({ id, assetId, delta, kind: 'manual', refId: id, timestamp: new Date(), note });
  }, []);
  return { events, stockByAssetId, logManualAdjustment };
}
```

### Existing snapshot-at-save precedent (D-12 TOU rate must follow this exactly)

```typescript
// Source: src/types.ts:383 (read directly this session)
// Break-even fixed-cost snapshot (Phase 22.1 D-02 schema-extension pattern).
// Snapshotted at Save/Update time... Undefined on legacy v8 records until
// `reconcileFixedCostsAtSave` (src/db/backfill.ts) backfills them on next page load.
fixedCostsAtSave?: { depreciation: number; nozzleWear: number };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Static, user-guessed failure-rate percentage (v1.9 and earlier) | Empirical, per-printer×material derived rate suggested from real logged history | Phase 39 (this phase) | First-in-category feature per `FEATURES.md` competitor research — no competitor (SlicePrice3D, 3DPrintQuote) currently offers this |
| Flat electricity rate only | Optional TOU weighted rate, additive layer on top of flat default | Phase 39 (this phase) | Narrow-audience but zero-competitor differentiator per `FEATURES.md` §8 |
| Generic 500h maintenance alert (single global interval) | Per-part-category swap-interval prediction (nozzle/belt/bed tracked separately) with the 500h alert kept as fallback | Phase 39 (this phase) | D-15 explicitly does NOT remove the existing alert — it's additive, reducing regression risk |

**Deprecated/outdated:** Nothing in this phase deprecates prior functionality — every locked decision (D-05 rate formula, D-14 amortization, D-15 fallback) is explicitly additive to what exists, consistent with the milestone's "every cost-model improvement ships to the free tier, nothing is removed" posture.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dexie schema is currently at `db.version(11)`, so Phase 39's two new stores correctly land at `db.version(12)` | Standard Stack / Summary | LOW — directly verified via `grep "db.version("` on `src/db/database.ts` this session; confirmed HIGH confidence, not actually an assumption, but flagged here since CONTEXT.md asked for verification |
| A2 | Nozzle type (brass/hardened/ruby) should live on `PrinterInstance`, not `PrinterAsset`/`PrinterConfig` | Common Pitfalls, Pitfall 6 | MEDIUM — if the planner instead attaches it to the catalog model, a nozzle swap on one physical unit would incorrectly appear to affect every user's instance of that printer model; this is architectural reasoning, not verified against an explicit CONTEXT.md decision (CONTEXT.md left this to discretion) |
| A3 | All historical saved jobs count as "attempts" (successes) in the FAIL-02 empirical rate denominator, with no cutoff for pre-Phase-39 jobs | Phase Requirements table / CONTEXT.md Discretion | LOW-MEDIUM — CONTEXT.md itself flags this as "confirm feasibility at plan time"; if a job lacks `printerInstanceId` or a resolvable dominant filament (unlikely given both are required fields on `PrintJob`/`FilamentUsage`), the count query needs a null-guard, but no historical data gap is expected given both fields are non-optional on `PrintJob` |
| A4 | The abrasive-hours-accelerated nozzle-swap prediction (D-15) does not require changing `calculateNozzleWear`'s existing cost formula — it only affects the SEPARATE next-swap-date prediction shown in the Printer Settings maintenance drill-in, not the per-job cost calculation | Common Pitfalls, Pitfall 1 | MEDIUM — if the plan conflates "abrasive hours accelerate the swap PREDICTION" (a Printer Settings UI concern) with "abrasive materials cost more per job" (a `costCalc.ts` concern), it could either double-count or incorrectly gate the wrong code path; CONTEXT.md's D-14 explicitly says "no separate double-counting line item" for maintenance amortization, which supports treating these as distinct concerns, but the plan must be explicit about which surface owns which computation |

**If this table is empty:** N/A — see above; three MEDIUM/LOW items exist above HIGH-confidence baseline.

## Open Questions

1. **Does the amortized maintenance $/hr (D-14) get folded into `costCalc.ts` at all, or does it stay purely informational in Printer Settings?**
   - What we know: D-14 says the derived rate "appears as a hint beside the EXISTING manual maintenance-budget field with one-click Apply" — implying there IS an existing manual maintenance-budget field somewhere in the cost model that Apply writes into.
   - What's unclear: This session's codebase read did not locate an existing "maintenance budget" field in `CalcInput`, `costCalc.ts`, or `PrinterInstance`/`PrinterAsset`. The 500h alert (`MAINTENANCE_INTERVAL`, `isMaintenanceDismissed`) is a notification mechanism, not a cost-line input. It's possible this field lives in `UserProfile` or a printer-level setting not yet grep'd, or it may be new to this phase despite CONTEXT.md's "existing" wording.
   - Recommendation: The plan MUST grep for any field resembling "maintenance" cost/budget across `types.ts`, `costCalc.ts`, and `useDatabase.ts` before assuming one exists; if none is found, D-14's "existing manual maintenance-budget field" needs re-scoping as "a NEW manual input this phase introduces, with the derived $/hr as its suggestion" — this changes whether a new `CalcInput` field is needed (very likely yes) versus reusing something that already exists.

2. **Where exactly does the TOU tariff configuration live in Settings, and does it require a new Dexie-settings key or extend the existing `ElectricityConfig`?**
   - What we know: `ElectricityConfig` currently is `{ costPerKwh: number }` (types.ts:127-129), read/written via `useAllSettings()` in `App.tsx`. TOU-01 is user-entered in Settings (locked, no API).
   - What's unclear: Whether TOU bands should be a NEW top-level settings key (e.g., `touTariff`) or an extension of the existing `ElectricityConfig` interface (e.g., adding an optional `touBands?: TouBand[]` field). Both are architecturally valid given the JSON-blob-in-`db.settings` pattern (no Dexie version bump needed either way, per `ARCHITECTURE.md` fact re: `UserProfile` optional-field additions).
   - Recommendation: Extend `ElectricityConfig` with an optional `touBands?: TouBand[]` array (max 3, per D-09) rather than a separate settings key — this keeps "electricity configuration" as one coherent concept the same way `UserProfile.onboardingStep` extends rather than forks that entity, and avoids a second settings read/write path for a closely related concern.

3. **What is the exact shape of the "printer's recent print pace" input to the next-swap-date projection (D-15)?**
   - What we know: D-15 says the projection derives from "current printer hours + recent print pace."
   - What's unclear: "Recent" is undefined — last 30 days of job history? Last N jobs? All-time average hours/day since purchase? This affects both the query shape (which jobs count as "recent") and the accuracy of the prediction for a user whose printing cadence has changed significantly (e.g., a hobbyist who suddenly print-farms for a month).
   - Recommendation: Use "average printTimeHours per calendar day over the trailing 30 days of saved jobs for this printerInstanceId, falling back to all-time average if fewer than 5 jobs exist in that window" — simple, bounded, and consistent with FAIL-02's own precedent of using an explicit sample-size threshold (≥5) before trusting a derived number. Confirm at plan time; this is a Claude's Discretion item CONTEXT.md left open.

## Environment Availability

**Skipped** — this phase has no external service, CLI tool, or runtime dependency beyond the existing project toolchain (Node/npm/Vite/Dexie, all already verified present and in use by the shipped Phase 38 work). No environment audit is needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed via existing `*.test.ts`/`*.test.tsx` files throughout `src/`) |
| Config file | `vitest.config.ts` (project root — referenced by CONTEXT.md's `pwaRegister.ts` stub mention and by the `hooks.md`/`CLAUDE.md` `tsc -b` convention) |
| Quick run command | `npx vitest run src/utils/costCalc.test.ts src/components/calculator/` (scoped to touched files) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FAIL-01 | Logging a failure creates a `failureEvents` row with required fields | unit | `npx vitest run src/hooks/useFailureEvents.test.ts` | ❌ Wave 0 |
| FAIL-01 | Failure logged from a job deducts stock (D-03) | unit | `npx vitest run src/hooks/useFailureEvents.test.ts -t "deducts stock"` | ❌ Wave 0 |
| FAIL-02 | Empirical rate formula matches D-05 (failures ÷ (jobs+failures)); threshold hides hint below 5 (D-06); fallback provenance (D-07) | unit | `npx vitest run src/hooks/useFailureRate.test.ts` | ❌ Wave 0 |
| FAIL-03 | Applying a suggested rate flows into `costCalc.ts` unchanged; saved jobs don't reprice until re-edited | integration (output-equivalence extension) | `npx vitest run src/components/calculator/outputEquivalence.test.tsx` (extended fixtures) | ✅ exists, needs new scenarios |
| FAIL-04 | Failure ledger renders per-printer/per-material grouping | unit/component | `npx vitest run src/components/ReportsSection.test.tsx` (extended) | ✅ exists (verify), needs new section coverage |
| TOU-01 | TOU band config persists via Settings; validates ≤3 bands (D-09) | unit | `npx vitest run src/hooks/useTouTariff.test.ts` | ❌ Wave 0 |
| TOU-02 | Weighted-rate calc correct for a print spanning multiple bands, including overnight wrap-around | unit | `npx vitest run src/utils/touElectricity.test.ts` | ❌ Wave 0 |
| TOU-02 | Snapshot fields (`touStartTime`, `touRateUsedPerKwh`) persist at save, survive tariff edits (D-12) | integration | `npx vitest run src/db/backfill.test.ts` (extended for TOU reconcile) | ✅ exists, needs new reconcile helper + test |
| WEAR-01 | Maintenance event log CRUD; abrasive auto-detect matches CF/GF/glow/metal patterns (D-13) | unit | `npx vitest run src/hooks/useMaintenanceEvents.test.ts` | ❌ Wave 0 |
| WEAR-02 | Amortized $/hr formula (total cost ÷ printer hours); next-swap prediction per part category (D-15) | unit | `npx vitest run src/hooks/useMaintenanceAmortization.test.ts` | ❌ Wave 0 |
| ALL (money-math) | Output-equivalence oracle stays green with new `CalcInput` fields (Pitfall 3) | integration | `npx vitest run src/components/calculator/outputEquivalence.test.tsx src/components/calculator/renderCount.test.tsx src/components/calculator/pricingSequence.test.tsx` | ✅ all exist, need new fixture scenarios |

### Sampling Rate
- **Per task commit:** scoped Vitest run on the touched hook/component/util files
- **Per wave merge:** `npx vitest run src/components/calculator/` (full calculator suite incl. output-equivalence/render-count/sequence tripwires) + `npx vitest run src/hooks/ src/db/ src/utils/` for the new stores/derivations
- **Phase gate:** `npx vitest run` (full suite) green + `tsc -b` clean before `/gsd:verify-work`, per project CLAUDE.md's Release Steps gate discipline

### Wave 0 Gaps
- [ ] `src/hooks/useFailureEvents.test.ts` — covers FAIL-01
- [ ] `src/hooks/useFailureRate.test.ts` — covers FAIL-02
- [ ] `src/hooks/useMaintenanceEvents.test.ts` — covers WEAR-01
- [ ] `src/hooks/useMaintenanceAmortization.test.ts` — covers WEAR-02
- [ ] `src/hooks/useTouTariff.test.ts` — covers TOU-01
- [ ] `src/utils/touElectricity.test.ts` — covers TOU-02 pure band-crossing math (including the overnight-wrap edge case)
- [ ] Extend `src/components/calculator/__fixtures__/goldenScenarios.ts` with new scenarios: TOU-active print, CF/GF-on-brass-nozzle print, empirical-rate-applied print — covers the output-equivalence oracle staying meaningful for new fields
- [ ] Extend `src/db/backfill.ts` + its test — new reconcile helper for `touRateUsedPerKwh`/`touStartTime` on legacy jobs (D-12)
- [ ] Extend `src/utils/backupSchema.ts`'s `BACKUP_STORES`/`DATE_FIELDS`/`BackupData` — both new stores must round-trip through backup/restore (locked requirement, FAIL-01/WEAR-01 both say "migration + backup/restore inclusion")

## Security Domain

> `security_enforcement` config key not found in `.planning/config.json` at time of research — treating as enabled per default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts exist anywhere in this project (local-first, no backend) |
| V3 Session Management | No | No sessions — local IndexedDB only |
| V4 Access Control | No | Single-user local app; no multi-tenant boundary to enforce |
| V5 Input Validation | Yes | New form inputs (% completion 0-100 clamp, reason enum whitelist, TOU band time-window validation, maintenance cost/date validation) must validate at the boundary — mirrors the existing `failureRate` clamp (`Math.min(Math.max(input.failureRate, 0), 99)`) and the tag-input whitelist pattern in `src/db/backfill.ts` (`_normalizeTagToken`'s `/[^a-z0-9\s\-_]/g` allowlist) |
| V6 Cryptography | No | No secrets, tokens, or cryptographic material introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Free-text `notes` field on failure/maintenance events rendered unsanitized | Tampering / XSS-adjacent (Information Disclosure if rendered via `dangerouslySetInnerHTML`) | Render as plain React text (`{notes}`), never `dangerouslySetInnerHTML` — matches the project's existing plain-JSX rendering convention for all other free-text fields (job notes, decline reasons) |
| Non-finite/negative values in numeric inputs (% completion, printer-hours, maintenance cost) poisoning derived aggregates | Tampering (data integrity) | Follow the existing `Number.isFinite` guard pattern already used in `useStockEvents.ts`'s `logManualAdjustment` (`if (!Number.isFinite(delta)) { ...; return; }`) — apply the same guard to every new numeric Dexie write path (failure % completion, maintenance cost, printer-hours-at-swap) |
| TOU time-window input accepting malformed strings that break the band-crossing arithmetic | Tampering (denial of a working feature, not a security breach per se, but a correctness/DoS-of-a-feature concern) | Validate "HH:MM" format strictly before storing; reject out-of-range values (hour 0-23, minute 0-59) at the input boundary, consistent with V5 |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `src/utils/costCalc.ts` (full file read) — confirmed `CalcInput.failureRate`, `calculateElectricityCost`, `calculateNozzleWear`, `calculateCost` orchestrator, existing failure-multiplier formula
- `src/db/database.ts` (grepped `db.version(`) — confirmed current schema at `db.version(11)`, so Phase 39 correctly lands at `db.version(12)`
- `src/hooks/useStockEvents.ts` (full file read) — direct template for new event-store hooks
- `src/hooks/useDatabase.ts` (grepped, partially read via App.tsx usage) — confirmed hook location convention
- `src/types.ts` (multiple reads, lines 1-160, 280-400) — confirmed `Asset`/`Material`, `PrinterInstance`, `PrinterConfig`/`PrinterAsset`, `StockEvent`, `PrintJob`, `FilamentUsage`, `FilamentType`, existing `fixedCostsAtSave` snapshot precedent
- `src/db/backfill.ts` (partial read, ~80 lines) — confirmed reconcile-helper pattern (`stampRecordCurrency`, `backfillTagsOnJob`) as the template for the new TOU reconcile helper
- `src/utils/backupSchema.ts` (full file read) — confirmed `BACKUP_STORES`/`DATE_FIELDS`/`BackupData` as the single extension point for both new stores' backup/restore inclusion
- `src/utils/backupExport.ts` (partial read) — confirmed `buildBackupFile` iterates `BACKUP_STORES` generically, requiring no additional export-logic changes beyond the schema constants
- `src/components/calculator/CostParametersSection.tsx` (full file read) — confirmed the "props-in, callbacks-out; no Dexie access, no business math" contract Phase 39 must respect
- `src/App.tsx` (lines 1-210 read) — confirmed the existing 500h maintenance alert mechanism (`MAINTENANCE_INTERVAL`, `isMaintenanceDismissed`, `addPrintHours`) that D-15 explicitly keeps as fallback
- `package.json` (grepped) — confirmed `dexie: "^4.2.1"`, no new dependencies needed

### Secondary (MEDIUM confidence — milestone research, verified consistent with direct codebase reads)
- `.planning/research/ARCHITECTURE.md` (full read, 2026-07-03) — §2 Failure-Cost Engine sketch (largely consistent with direct code reads this session; the `db.version(12)` estimate, `FailureEvent` interface sketch, and "costCalc.ts unchanged" rule all independently confirmed)
- `.planning/research/FEATURES.md` (full read, 2026-07-03) — §1 (failure engine), §8 (TOU electricity), §9 (abrasive wear + maintenance amortization); competitor landscape, table-stakes/differentiator/anti-feature breakdowns, real-world nozzle-life data (brass 50-100h, hardened steel 1000+h)
- `.planning/research/PITFALLS.md` (full read, 2026-07-03) — Pitfall C-03 (PERF-11-class pricing desync, directly relevant to Pitfall 2/3 above), Pitfall M-04 (failure-cost model changing displayed prices, directly relevant to Pitfall 1 above)
- `.planning/phases/39-cost-realism/39-CONTEXT.md` (full read, 2026-07-05) — all locked decisions D-01 through D-16, canonical refs, code context

### Tertiary (LOW confidence — none)
- No unverified WebSearch-only claims were needed for this phase; the domain is entirely internal-codebase and milestone-research grounded. Nozzle-life figures (brass 50-100h, hardened steel 1000+h) originate from `FEATURES.md`'s own MatterHackers citation — treated as MEDIUM confidence context, not load-bearing for any Phase 39 code decision (the actual swap-interval prediction derives from the user's OWN logged history, per D-15, not from these reference figures).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; existing Dexie/React patterns directly verified in this session
- Architecture: HIGH — every integration point (CostParametersSection contract, costCalc.ts CalcInput shape, stockEvents template, fixedCostsAtSave snapshot precedent, backupSchema extension point) was read directly from source this session, not inferred
- Pitfalls: HIGH for the codebase-grounded pitfalls (1-3, directly tied to read source + milestone PITFALLS.md precedent); MEDIUM for pitfalls 4-6 (reasoned from established patterns but not yet exercised in this specific new-feature context)

**Research date:** 2026-07-06
**Valid until:** 30 days (stable local-first codebase, no external API dependencies whose behavior could drift; re-verify if Phase 38's architecture changes before Phase 39 planning begins, or if Dexie version advances past 11 for an unrelated reason before this phase starts)
