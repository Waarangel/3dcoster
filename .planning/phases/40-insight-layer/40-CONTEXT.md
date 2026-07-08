# Phase 40: Insight Layer - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship a new **Insights tab** in the app's tab bar (slotting into the Phase 38 `?tab=` URL routing) delivering three decision-grade analytics derived purely from EXISTING jobs/sales/printer/ledger data — zero new data entry: **product profitability ranking** by profit per printer-hour with true-hourly-wage headline (INS-01), **per-printer payback/ROI tracker** ("paid off" / "net ±$X") (INS-02), and a **what-if margin simulator** on saved jobs with sliders for filament price, electricity rate, and failure rate — live margin, never overwriting the saved job (INS-03).

All math lives as pure derivations in `src/utils/insights.ts` (+ ported Phase 33 utils); the tab gets its own panel component — NOT more props through App.tsx. This phase also **absorbs and retires the parked Phase 33 branch** (`feat/insight-pricing-coach`): its three pure utils port in; its calculator-UI wiring does not. No backend, no new data-entry surfaces, no calculator changes beyond none-at-all (the simulator reuses the pure cost math, not the calculator UI).

</domain>

<decisions>
## Implementation Decisions

### Product grouping & ranking (INS-01)
- **D-01: Product = normalized job title.** Group saved jobs on trimmed, case-insensitive title match. Deterministic, zero setup, no false merges. "phone stand v2" is intentionally a separate product from "Phone Stand". No fuzzy matching this phase.
- **D-02: Ranking uses sold jobs and actual profit only.** Products with ≥1 recorded sale rank by real sale prices net of marketplace fees (v1.9 `pricingInterlink` net-of-fees treatment). Unsold products appear in a separate "no sales yet" list — never mixed into the earnings ranking with modeled numbers.
- **D-03: True hourly wage = aggregate headline + optional target.** One headline stat (effective hourly wage across the period) plus an optional target wage field in Settings showing the gap ("earning $14/hr vs your $20 target"). No per-product wage column, no judgment score — just the number and the gap.
- **D-04: All-time default + reuse the v1.8 Reports period picker** (month/quarter/year/YTD/custom) to narrow. One shared component, consistent pattern.

### Payback math (INS-02)
- **D-05: Payback basis = cumulative NET PROFIT, not revenue.** ROADMAP's "revenue against purchase cost" wording is imprecise — update ROADMAP success criterion 2 accordingly. A printer is "paid off" when cumulative net profit from its sold jobs ≥ purchase price.
- **D-06: Full research pattern — actual + projected + celebration.** Show the actual break-even date once crossed; project the date from recent profit pace when not yet crossed; fire a one-time "paid for itself" toast when crossing. Toast suppressed for printers already paid off at feature launch. NOTE: shared toast system is still on `staged/toast-x1c-banner` — planner must decide mechanism if it hasn't landed (a minimal inline announcement is acceptable; do NOT hand-roll a fixed toast).
- **D-07: ROI subtracts the Phase 39 ledgers.** Per-printer net profit subtracts logged maintenance costs AND scrap cost of logged failures for that printer. Printers with empty ledgers lose nothing. This is the anticipated "Phase 40 consumes failure/maintenance data" hook from 39-CONTEXT.
- **D-08: Missing data = inline CTA + honest labels.** Printer without a purchase price shows "Add purchase price to track payback" linking to Printer Settings. Sales from jobs not linked to a printer roll into an "Unassigned" line so totals stay honest. Nothing silently dropped; never require printer assignment to enable the section (locked anti-feature).

### What-if simulator (INS-03)
- **D-09: Two entry points, one component.** "What-if" icon action on JobsManager job rows (shared icon-button primitives, required label) AND a job picker inside the Insights tab. Mirrors Phase 39's job-row + ledger dual-surface pattern.
- **D-10: Live values + delta chips vs saved.** Margin, profit, and break-even recompute live as sliders move, each with an explicit delta against the saved job's numbers ("margin 31% → 24%, −7pts"). No side-by-side column layout this phase.
- **D-11: Exactly 3 sliders, ephemeral.** Filament price, electricity rate, failure rate (the INS-03 trio). Closing the simulator discards the scenario — no "save as scenario", no extra sliders (deferred).
- **D-12: Container = shared Modal primitive** (Phase 19) — focus trap, Escape, aria wiring free; identical behavior from both entry points.

### Payback surface reconciliation (INS-02)
- **D-16: Reconcile the existing PrinterSettings.tsx cost-recovery bar with the new payback math.** Research found PrinterSettings.tsx (~lines 427–554) already ships a payback display using gross asking-price × copies-sold — different math than D-05/D-07. One shared `computePrinterPayback()` lives in the insights module and is consumed by BOTH the Insights tab and the PrinterSettings bar, so the app never shows two disagreeing payback numbers for the same printer. (User decision 2026-07-08, post-research; C-03 no-second-pricing-implementation rule.)

### Phase 33 branch absorption
- **D-13: Port the three pure utils + tests from `feat/insight-pricing-coach`** — `printHourProfit.ts`, `pricingCoach.ts`, `costAllocation.ts` (+ their `.test.ts` files) — as foundation math for insights. The ~113 lines of old-CostCalculator UI wiring are NOT re-attached (the component they targeted was dissolved in Phase 38). `pricingCoach`/`costAllocation` calculator-UI ideas are logged as deferred for Phase 45 launch polish.
- **D-14: Benchmark grading ships with provenance.** INS-01's top/bottom earner distinction uses printHourProfit's researched $1–5/hr community benchmark ("$8.10/hr — above the $1–5/hr community range") with an InfoTooltip citing the source. Planner verifies the benchmark's sourcing in the Phase 33 SPEC/plans before reuse (no-arbitrary-numbers rule).
- **D-15: Retire the branch + archive its GSD records.** Copy `.planning/phases/33-insight-pricing-coach/` docs from the branch into main's `.planning/phases/`, marked "absorbed into Phase 40"; update the ROADMAP "Phase 33 reserved" note; delete the branch after porting. Check for live worktrees/sessions on that branch before deletion (coordinate-with-spawned-agents rule).

### Claude's Discretion
- Insights tab internal layout (section order/hierarchy for ranking, ROI cards, simulator entry), empty states for users with no sales/printers, and NEW-badge placement (must follow `src/features.ts` registry + absolute-overlay rules).
- Slider ranges, steps, formatting, reset affordance, and keyboard accessibility details (must be keyboard-operable per house a11y bar).
- `insights.ts` module decomposition (one file vs `insights/` folder) and how ported Phase 33 utils integrate with it.
- Exact projection formula for break-even date ("recent profit pace" window choice) — must be explainable in a tooltip, no black-box smoothing.
- How the target-wage Settings field is grouped in the Settings modal (likely near default-margin, Pricing section).
- ROADMAP wording update mechanics for D-05.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research
- `.planning/research/FEATURES.md` §2 — True Hourly Wage / Printer Payback / What-If Simulator: formulas ((sale_price − true_cost) / labor_hours; purchase price vs cumulative net profit; sensitivity pattern), sub-feature tables, and the LOCKED anti-features (no forecasting, no judgment score, never require printer assignment)
- `.planning/research/ARCHITECTURE.md` — insights derivation-layer placement, "own panel/tab NOT more props through App.tsx" rule
- `.planning/research/PITFALLS.md` — C-03 pricing-desync class: the simulator must reuse pure cost math (`costCalc.ts` / `pricingInterlink.ts`), never fork a second pricing implementation

### Requirements & prior context
- `.planning/REQUIREMENTS.md` — INS-01/02/03 exact wording (incl. `src/utils/insights.ts` and no-props-through-App.tsx requirements)
- `.planning/ROADMAP.md` — Phase 40 goal + 3 success criteria (criterion 2 wording to be corrected per D-05)
- `.planning/phases/39-cost-realism/39-CONTEXT.md` — D-04 (Insights tab reserved for profitability analytics; Failures ledger stays in Reports), maintenance/failure ledger shapes D-07 consumes
- `.planning/phases/38-foundation/38-CONTEXT.md` — tab registry / URL routing decisions the new tab plugs into (D-05..D-08 there)

### Phase 33 branch (absorption source)
- Branch `feat/insight-pricing-coach`: `src/utils/printHourProfit.ts(.test.ts)`, `src/utils/pricingCoach.ts(.test.ts)`, `src/utils/costAllocation.ts(.test.ts)` — port targets
- Branch `.planning/phases/33-insight-pricing-coach/SPEC.md` + plans/summaries — benchmark sourcing to verify (D-14); archive to main per D-15

### Source of truth in code
- `src/App.tsx` — `VALID_TABS` registry + roving-tabindex tab bar the Insights tab joins (FOUND-03 pattern; a11y semantics must be preserved)
- `src/utils/costCalc.ts` + `src/utils/pricingInterlink.ts` — pure math the simulator and net-of-fees profit reuse; NEVER reimplement pricing
- `src/utils/salesReportAggregates.ts` — v1.8 aggregation precedent + the period-picker data patterns D-04 reuses
- `src/hooks/useDatabase.ts` — `useAllSales`, printer instance CRUD (`purchasePrice`, `printHours`), Phase 39 `useFailureEvents`/`useMaintenanceEvents`
- `src/types.ts` — `PrintJob.printerInstanceId`/`printTimeHours`, `Sale`, `PrinterInstance.purchasePrice`/`printHours`
- `src/features.ts` — NEW-badge registry for the Insights tab

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 33 branch utils** (printHourProfit / pricingCoach / costAllocation + tests) — finished, tested pure functions; the profit/hr math and $1–5/hr benchmark grading port directly (D-13/D-14)
- **v1.8 Reports period picker + `salesReportAggregates.ts`** — period selection UI and jobs×sales aggregation patterns for D-04
- **Phase 19 `Modal` primitive** — simulator container (D-12)
- **Phase 39 `failureEvents`/`maintenanceEvents` stores + hooks** — per-printer cost ledgers D-07 subtracts
- **Shared UI**: icon buttons with required labels (JobsManager what-if action), `InfoTooltip` (benchmark provenance), Input `compact`, `useToast` (staged — see D-06 note)
- `useAllSales` hook + App.tsx one-level Dexie subscription pattern

### Established Patterns
- **Data flows down from App.tsx-level hooks** but INS-01 requirement explicitly forbids more prop-drilling — the Insights panel owns its own Dexie subscriptions (matches JobsManager/Reports precedent of feature-level hooks)
- **Never silently reprice / never mutate saved data** — the simulator is read-only over saved jobs (INS-03 + Phase 39 suggestion-not-mutation lineage)
- **No arbitrary numbers** — benchmark bands must trace to the Phase 33 research sourcing (D-14); projection formulas must be explainable
- **NEW-badge registry + absolute-overlay placement** for the new tab
- **Tab additions** go through the FOUND-03 `VALID_TABS` single source of truth; roving-tabindex + `aria-selected` semantics preserved

### Integration Points
- App.tsx tab bar + `?tab=insights` URL routing (Phase 38)
- JobsManager job rows — what-if icon action (alongside v1.9 edit/delete + Phase 39 log-failure)
- Settings — target hourly wage field (D-03)
- Printer Settings — "Add purchase price" CTA target (D-08)
- Phase 41 (reprice alerts) and Phase 45 (launch polish; pricing-coach UI ideas) consume this phase's insights module

</code_context>

<specifics>
## Specific Ideas

- The ranking should read decision-grade and blunt: "phone stands earn $8.10/printer-hour; dragons $1.50/hr" (REQUIREMENTS wording) — top and bottom earners visually distinguished, benchmark context with provenance, no editorializing score
- Payback verdicts in plain words: "paid off on 2026-03-14" or "net −$180, projected to pay off ~Nov 2026"
- Delta chips are the soul of the simulator: every slider move answers "vs what I saved" without the user holding numbers in their head
- The whole tab is the payoff moment for data users already entered — it must render something meaningful even for small datasets, and honest empty states where data is missing ("no sales recorded yet — record a sale to see rankings")

</specifics>

<deferred>
## Deferred Ideas

- **"Save as new scenario"** job duplication from the simulator (DUP-02 helper exists) — revisit if users ask
- **Selling-price / labor-rate sliders** in the simulator (research mentions both; INS-03 trio kept)
- **Per-product hourly-wage column** in the ranking (D-03 chose aggregate-only)
- **Fuzzy product grouping** with user-tunable threshold (D-01 chose normalized exact)
- **Pricing coach + cost-allocation %-bar calculator UI** from Phase 33 — utils ported, UI re-attachment deferred to Phase 45 launch polish
- **Maintenance cost trend chart** ("are repairs getting more expensive?") — carried from 39-CONTEXT deferred list; natural future Insights addition

</deferred>

---

*Phase: 40-insight-layer*
*Context gathered: 2026-07-08*
