# Phase 39: Cost Realism - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the cost-realism moat, all free-floor, all local: an **empirical failure engine** (one-tap failure logging → `failureEvents` Dexie store → derived per-printer × material failure rate suggested in the calculator with one-click Apply → scrap cost folded into true cost → reviewable failure ledger; FAIL-01..04), **time-of-use electricity** (user-entered peak/off-peak tariff bands in Settings; jobs with a start time use a weighted rate, flat rate stays the default; TOU-01/02), and **maintenance/wear amortization** (maintenance event log per printer → amortized real cost-per-hour surfaced in the calculator → abrasive-hours tracking for CF/GF on brass nozzles → next-swap prediction; WEAR-01/02).

Two new Dexie stores (`failureEvents`, `maintenanceEvents`) with migration + backup/restore inclusion. New calculator inputs attach to the Phase 38 section components as ordinary additions. `costCalc.ts` stays a pure function — new fields extend `CalcInput`; callers feed it. No backend, no accounts, no new top-level tabs (Insights is Phase 40).

</domain>

<decisions>
## Implementation Decisions

### Failure logging & ledger (FAIL-01, FAIL-04)
- **D-01: Logging surfaces = job row + ledger.** An icon action on each saved job row in JobsManager (pre-fills printer + dominant material from the job) PLUS a standalone "Log failure" button in the failure ledger view for failures that never became saved jobs. No calculator-side logging surface.
- **D-02: Entry fields = required trio + reason enum + notes.** % completion, printer, material (required per FAIL-01) plus a small fixed reason enum (adhesion, stringing/quality, clog, mechanical, power loss, other) and optional free-text notes. No photos, no per-entry cost override.
- **D-03: Logging a failure deducts wasted filament from v1.8 stock.** A failure logged from a job writes a stockEvent deducting (job filament grams × % completion), reusing the deduct-on-job machinery. Standalone failures (no job) skip deduction unless the user enters grams.
- **D-04: The failure ledger lives as a "Failures" section inside the existing Reports tab** — per printer, per material, over time. No new top-level tab; Phase 40's Insights tab stays free for profitability analytics.

### Empirical rate derivation (FAIL-02)
- **D-05: rate = failures ÷ (saved jobs + failures)** for the printer × material combo, all-time. Every saved job counts as one successful attempt. No % completion weighting (severity drives scrap cost separately, not the rate), no rolling window.
- **D-06: Suggestion threshold = ≥5 attempts** (jobs + failures) for the combo. Below threshold the hint is hidden entirely — no scary small-sample rates.
- **D-07: One-level fallback with provenance.** If the exact printer × material combo is below threshold but the printer's all-materials rate clears it, suggest that, explicitly labeled (e.g. "X1C overall: 4.1%"). Never cascade to a global all-printers rate.
- **D-08: Multi-material jobs key off the dominant (highest-weight) filament.** Failure logging pre-selects it (user can change); the calculator suggestion keys off the currently-dominant filament in the form. One material per failure event, matching the research sketch.
- **Locked by requirements (not re-decided):** manual failure-rate input stays authoritative; empirical rate is a suggestion with one-click Apply; saved jobs/quotes are never silently repriced (FAIL-03).

### TOU tariff modeling (TOU-01, TOU-02)
- **D-09: Tariff structure = flat default rate + up to 3 named bands**, each with a rate and a daily time window (covers 2-band Economy 7 and 3-band SCE/Octopus plans). No seasonal or per-day-of-week variants this phase.
- **D-10: Start time = optional time-of-day picker** in the cost-parameters section, visible only when a TOU tariff is configured. Empty = flat rate (the required default). Weighted rate computed from start time + print duration (bands crossed proportionally, including overnight wrap-around).
- **D-11: Inline savings hint.** When a TOU tariff exists and the chosen start time isn't optimal, show a one-line hint with the cheapest start window and the dollar saving ("start at 10pm: saves $0.34"). Pure derivation, no extra data entry.
- **D-12: Saved jobs snapshot BOTH the start time and the weighted electricity rate used** (fixedCostsAtSave precedent, Phase 22.1). Later tariff edits never silently reprice history. Ships with the mandatory one-time reconcile helper for existing jobs (null = flat rate) per the locked milestone money-math rule.

### Maintenance & wear model (WEAR-01, WEAR-02)
- **D-13: Abrasive detection = auto-detect + override.** Auto-flag materials whose type/name matches CF/GF/glow/metal-fill patterns; per-material `isAbrasive` toggle for corrections. Zero setup for the common case.
- **D-14: Amortized $/hr = suggestion + Apply**, mirroring the failure-rate pattern: the derived rate (total maintenance cost ÷ printer hours) appears as a hint beside the existing manual maintenance-budget field with one-click Apply. Manual input stays authoritative; no automatic replacement, no separate double-counting line item.
- **D-15: Next-swap prediction = per-part intervals.** Each part category's average interval derives from its own swap history (nozzle vs belt vs bed separately), projected from current printer hours + recent print pace; abrasive-hours accelerate the nozzle projection on brass. The existing generic 500h alert stays as the fallback for printers with no logged events — it is NOT removed.
- **D-16: Maintenance UI = per-printer drill-in in Printer Settings.** Each printer gets a "Maintenance" section: log button + event history + cumulative cost + abrasive-hours + next-swap prediction. Reports stays focused on the failure ledger.

### Claude's Discretion
- Exact Apply-button behavior details (rounding/precision of applied rates), rate display formatting.
- What counts as an "attempt" for jobs saved before Phase 39 (all historical saved jobs presumably count — confirm feasibility at plan time).
- `failureEvents`/`maintenanceEvents` schema field details beyond the decided fields; Dexie version number (research assumed v12 — verify current version).
- Whether nozzle type (brass/hardened/ruby) becomes a field on the printer record to gate the abrasive surcharge (research suggests yes — planner decides shape).
- Editing/deleting ledger entries (failures and maintenance events) — expected but mechanism is free; stock-deduction reversal on failure-entry delete should follow the v1.8 self-correcting stockEvents pattern.
- Exact placement/wording of hints inside `CostParametersSection` and the NEW-badge treatment (must follow the NEW-badge overlay rules).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (grounds this phase's architecture)
- `.planning/research/ARCHITECTURE.md` — §2 Failure-Cost Engine: `FailureEvent` interface, `db.version(12)` sketch, `useFailureRate` hook contract, hint-layer integration into `CostParametersSection`, "costCalc.ts unchanged / CalcInput extended" rule; component boundaries map (which files are NEW vs MODIFIED for TOU + wear)
- `.planning/research/FEATURES.md` — §8 Time-of-Use Electricity (band patterns, weighted-rate example, savings-comparison motivator) and §9 Abrasive Wear + Maintenance Amortization (real-world nozzle-life data, table-stakes vs differentiators, anti-features: no auto wear detection, amortization stays opt-in)
- `.planning/research/PITFALLS.md` — C-03 pricing-desync class (any new calculator input touching derived pricing must respect the Phase 38 render-count + sequence-test tripwires and exhaustive-deps posture)

### Requirements & prior context
- `.planning/REQUIREMENTS.md` — FAIL-01..04, TOU-01/02, WEAR-01/02 exact wording + locked milestone decisions (user-entered tariffs NO price APIs; money-math changes ship with output-equivalence tests + reconcile helper)
- `.planning/ROADMAP.md` — Phase 39 goal + 5 success criteria
- `.planning/phases/38-foundation/38-CONTEXT.md` — D-10 (no speculative extension points were left; Phase 39 inputs join as ordinary additions), D-14 (exhaustive-deps at error level in the calculator folder), D-15 (render-count tripwire must keep passing)

### Source of truth in code
- `src/components/calculator/CostParametersSection.tsx` — where the failure-rate suggestion, TOU start-time picker, and amortized-maintenance hint attach
- `src/components/calculator/` (useCostForm/useCostDerivedValues via CostCalculator.tsx) — the Phase 38 architecture; new inputs flow form → derived values → costCalc
- `src/utils/costCalc.ts` — pure cost function; extend `CalcInput` (TOU electricity, wear), never impurify; existing `failureRate` clamp/multiplier at lines ~183-185
- `src/hooks/useDatabase.ts` — Dexie CRUD hooks home; add `useFailureEvents`/`useMaintenanceEvents` following the stockEvents pattern
- `src/utils/backupExport.ts` (+ its test) — new stores MUST be included in backup/restore
- `src/App.tsx` lines ~175-195 — existing `printHours` odometer (`addPrintHours`) + 500h maintenance-alert logic the prediction extends and falls back to

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v1.8 stockEvents ledger + deduct-on-job machinery** — the template for both new event stores AND the mechanism D-03 reuses for failure filament deduction (self-corrects on edit/delete)
- **Phase 38 calculator sections** (`CostFormSection`, `CostParametersSection`, `PricingSection`, `CostSummaryPanel`, `ShippingSection`) — clean, documented props seams; Phase 39 inputs are ordinary additions
- **Phase 38 test harness** — 120-scenario output-equivalence oracle, `pricingSequence.test.tsx`, `renderCount.test.tsx`: new inputs must keep these green and extend fixtures where money math changes
- **`printerInstances.printHours` odometer + `addPrintHours` + `isMaintenanceDismissed`** — existing per-printer hours tracking the amortization and prediction build on
- **Reports tab** — existing surface the Failures ledger section slots into
- Shared UI: icon buttons (`EditButton`/`DeleteButton`/`IconButton` with required labels), `ConfirmModal`, `InfoTooltip`, Input `compact` for rates/currency

### Established Patterns
- **Suggestion-not-mutation**: manual input authoritative + derived hint + one-click Apply — now the phase-wide pattern (failure rate D-05..08, amortized maintenance D-14)
- **Snapshot-at-save** (`fixedCostsAtSave`, Phase 22.1) — D-12 TOU rate snapshot follows it; every derived-money change ships a reconcile helper (locked rule)
- **Dexie migrations**: new empty stores need no upgrade(); backup/restore + (Phase 44) sync format must include them
- **NEW-badge rule**: register user-facing features in `src/features.ts`, absolute-overlay placement only
- **No arbitrary numbers**: abrasive nozzle-life defaults etc. must come from the research data (FEATURES.md §9) or be user-entered

### Integration Points
- `CostParametersSection` — failure-rate hint row, TOU start-time picker, maintenance $/hr hint
- Settings modal — TOU tariff band editor (rates + windows)
- JobsManager job rows — log-failure icon action
- Reports tab — Failures ledger section
- Printer Settings — per-printer Maintenance drill-in
- Phase 40 consumes: failure/maintenance data enriches printer ROI; Phase 44 sync format includes both new stores

</code_context>

<specifics>
## Specific Ideas

- The failure hint should read like the research sketch: "Your X1C prints PLA at 3.2% empirically (12 prints) — apply?" with provenance always visible, especially for the printer-level fallback ("X1C overall: 4.1%")
- TOU savings hint is the motivator for setting tariffs up at all — "If you print off-peak: saves $0.34" style, at the decision moment in the calculator, not buried in Reports
- The whole phase runs on one mental model: the app suggests from your real history; you stay in control of the number that prices the job

</specifics>

<deferred>
## Deferred Ideas

- Seasonal / per-day-of-week tariff variants (D-09 capped at 3 daily bands) — future TOU enhancement if users ask
- Photo attachments and per-entry wasted-cost overrides on failure entries (D-02 kept entry lean)
- Maintenance cost trend chart ("are repairs getting more expensive?") — FEATURES.md §9 differentiator; natural Phase 40 Insights candidate
- Read-only maintenance roll-up in Reports (D-16 chose Printer Settings only this phase)
- Weekday/weekend-aware TOU via full date-time input (D-10 chose time-of-day only)

</deferred>

---

*Phase: 39-cost-realism*
*Context gathered: 2026-07-05*
