# Phase 40: Insight Layer - Research

**Researched:** 2026-07-08
**Domain:** Pure-derivation analytics UI on an existing React + Vite + Tailwind + Dexie (IndexedDB) app — no backend, no new stores.
**Confidence:** HIGH (all core formulas, types, and integration points verified directly against the codebase; one number — the $1–5/print-hour benchmark — is externally corroborated but not a single authoritative citation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Product grouping & ranking (INS-01)**
- D-01: Product = normalized job title. Group saved jobs on trimmed, case-insensitive title match. Deterministic, zero setup, no false merges. "phone stand v2" is intentionally a separate product from "Phone Stand". No fuzzy matching this phase.
- D-02: Ranking uses sold jobs and actual profit only. Products with ≥1 recorded sale rank by real sale prices net of marketplace fees (v1.9 `pricingInterlink` net-of-fees treatment). Unsold products appear in a separate "no sales yet" list — never mixed into the earnings ranking with modeled numbers.
- D-03: True hourly wage = aggregate headline + optional target. One headline stat (effective hourly wage across the period) plus an optional target wage field in Settings showing the gap ("earning $14/hr vs your $20 target"). No per-product wage column, no judgment score — just the number and the gap.
- D-04: All-time default + reuse the v1.8 Reports period picker (month/quarter/year/YTD/custom) to narrow. One shared component, consistent pattern.

**Payback math (INS-02)**
- D-05: Payback basis = cumulative NET PROFIT, not revenue. ROADMAP's "revenue against purchase cost" wording is imprecise — update ROADMAP success criterion 2 accordingly. A printer is "paid off" when cumulative net profit from its sold jobs ≥ purchase price.
- D-06: Full research pattern: actual + projected + celebration. Show the actual break-even date once crossed; project the date from recent profit pace when not yet crossed; fire a one-time "paid for itself" toast when crossing. Toast suppressed for printers already paid off at feature launch. NOTE (research correction — see Pitfall P-03): shared toast system is now VERIFIED LIVE on `main`, contrary to the original context note — use `useToast()` directly, no fallback mechanism needed.
- D-07: ROI subtracts the Phase 39 ledgers. Per-printer net profit subtracts logged maintenance costs AND scrap cost of logged failures for that printer. Printers with empty ledgers lose nothing. This is the anticipated "Phase 40 consumes failure/maintenance data" hook from 39-CONTEXT.
- D-08: Missing data = inline CTA + honest labels. Printer without a purchase price shows "Add purchase price to track payback" linking to Printer Settings. Sales from jobs not linked to a printer roll into an "Unassigned" line so totals stay honest. Nothing silently dropped; never require printer assignment to enable the section (locked anti-feature).

**What-if simulator (INS-03)**
- D-09: Two entry points, one component. "What-if" icon action on JobsManager job rows (shared icon-button primitives, required label) AND a job picker inside the Insights tab. Mirrors Phase 39's job-row + ledger dual-surface pattern.
- D-10: Live values + delta chips vs saved. Margin, profit, and break-even recompute live as sliders move, each with an explicit delta against the saved job's numbers ("margin 31% → 24%, −7pts"). No side-by-side column layout this phase.
- D-11: Exactly 3 sliders, ephemeral. Filament price, electricity rate, failure rate (the INS-03 trio). Closing the simulator discards the scenario — no "save as scenario", no extra sliders (deferred).
- D-12: Container = shared Modal primitive (Phase 19) — focus trap, Escape, aria wiring free; identical behavior from both entry points.

**Phase 33 branch absorption**
- D-13: Port the three pure utils + tests from `feat/insight-pricing-coach` — `printHourProfit.ts`, `pricingCoach.ts`, `costAllocation.ts` (+ their `.test.ts` files) — as foundation math for insights. The ~113 lines of old-CostCalculator UI wiring are NOT re-attached (the component they targeted was dissolved in Phase 38). `pricingCoach`/`costAllocation` calculator-UI ideas are logged as deferred for Phase 45 launch polish.
- D-14: Benchmark grading ships with provenance. INS-01's top/bottom earner distinction uses printHourProfit's researched $1–5/hr community benchmark ("$8.10/hr — above the $1–5/hr community range") with an InfoTooltip citing the source. Planner verifies the benchmark's sourcing in the Phase 33 SPEC/plans before reuse (no-arbitrary-numbers rule). **Research finding: no single external citation exists in the Phase 33 docs — see Pitfall P-04 for the corroboration this research performed and the recommended tooltip framing.**
- D-15: Retire the branch + archive its GSD records. Copy `.planning/phases/33-insight-pricing-coach/` docs from the branch into main's `.planning/phases/`, marked "absorbed into Phase 40"; update the ROADMAP "Phase 33 reserved" note; delete the branch after porting. Check for live worktrees/sessions on that branch before deletion (coordinate-with-spawned-agents rule). **Research note: a live worktree exists at `/Users/marcusdickinson/Projects/3DCoster-insight` on this branch — confirm it is not mid-session before deletion.**

### Claude's Discretion
- Insights tab internal layout (section order/hierarchy for ranking, ROI cards, simulator entry), empty states for users with no sales/printers, and NEW-badge placement (must follow `src/features.ts` registry + absolute-overlay rules).
- Slider ranges, steps, formatting, reset affordance, and keyboard accessibility details (must be keyboard-operable per house a11y bar).
- `insights.ts` module decomposition (one file vs `insights/` folder) and how ported Phase 33 utils integrate with it.
- Exact projection formula for break-even date ("recent profit pace" window choice) — must be explainable in a tooltip, no black-box smoothing. See Open Question 2 for a recommended starting point.
- How the target-wage Settings field is grouped in the Settings modal (likely near default-margin, Pricing section) — research confirms this is the "Costs & Rates" tab in `SettingsModal.tsx` where `laborHourlyRate` already lives.
- ROADMAP wording update mechanics for D-05.

### Deferred Ideas (OUT OF SCOPE)
- "Save as new scenario" job duplication from the simulator (DUP-02 helper exists) — revisit if users ask
- Selling-price / labor-rate sliders in the simulator (research mentions both; INS-03 trio kept)
- Per-product hourly-wage column in the ranking (D-03 chose aggregate-only)
- Fuzzy product grouping with user-tunable threshold (D-01 chose normalized exact)
- Pricing coach + cost-allocation %-bar calculator UI from Phase 33 — utils ported, UI re-attachment deferred to Phase 45 launch polish
- Maintenance cost trend chart ("are repairs getting more expensive?") — carried from 39-CONTEXT deferred list; natural future Insights addition
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| INS-01 | User can see true hourly wage + product profitability ranking ("phone stands earn $8.10/printer-hour; dragons $1.50/hr") derived from existing job/sale data — pure derivations in `src/utils/insights.ts`, own panel/tab (NOT more props through App.tsx) | `printHourProfit.ts` (ported) supplies the profit-per-hour formula + $1–5/hr grading (Pattern 2); `salesReportAggregates.ts`'s actual-profit formula supplies the net-of-fees profit (Pattern 1); period-picker extraction (Pattern 3) supplies D-04's date narrowing; Pitfall P-05 flags the labor-hours denominator ambiguity for the wage headline |
| INS-02 | User can see per-printer payback/ROI ("this X1C earned back its purchase price; net +$340") from existing depreciation + sales data | `computePrinterPayback` design in Architecture Patterns; Pitfall P-01 identifies and resolves the conflict with the existing `PrinterSettings.tsx` recovery bar; `costCalc.ts`'s `actualPurchasePrice ?? config?.purchasePrice ?? 0` resolution order (Code Examples) |
| INS-03 | User can play what-if margin sensitivity — sliders for filament price / electricity / failure rate with live margin response | Pattern 4 (JobsManager LogFailure precedent for the two entry points); Modal primitive (verified props/sizes); Don't Hand-Roll table mandates reusing `costCalc.ts` pure functions per PITFALLS.md C-03 |
</phase_requirements>

## Summary

Phase 40 is architecturally simple (three read-only derivations over data that already exists) but has three integration traps that matter more than the math: (1) a **payback/ROI feature already exists** in `PrinterSettings.tsx` using different, less accurate math than what CONTEXT.md's D-05/D-07 specify — this phase must reconcile the two, not build a second, disagreeing number; (2) the **v1.8 Reports period picker is not actually reusable today** — it's local state inline in `ReportsSection.tsx`, so D-04's "one shared component" requires an extraction, not a reuse; (3) the **shared toast system is live on `main`** (mounted in `App.tsx`, already used by `JobsManager.tsx`) — CONTEXT.md's D-06 note that it "might still be on `staged/toast-x1c-banner`" is stale and can be discarded; `useToast()` is safe to use directly.

The three insight surfaces map cleanly onto existing pure-function precedent: `printHourProfit.ts` (ported from the `feat/insight-pricing-coach` branch) already computes the exact "profit per printer-hour" metric INS-01's ranking needs, graded against a $1–5/hr desktop-FDM benchmark that is externally corroborated (not house-invented, but also not a single primary source — tag it `[CITED]`, not `[VERIFIED]`). The "actual profit from a sale" formula (net revenue − marketplace fee − job cost) already has one canonical implementation in `salesReportAggregates.ts` that both INS-01 (product ranking) and INS-02 (printer payback) should reuse rather than reimplementing — this is the same formula the existing (soon-to-be-superseded) `PrinterSettings.tsx` recovery bar gets *wrong* today by using `job.sellingPrice` (the asking price) instead of the actual `Sale.unitPrice`/`totalRevenue` (what was really charged).

**Primary recommendation:** Build one `src/utils/insights.ts` (+ port the three Phase 33 utils) as the single source of truth for all profit/payback math, consumed by both the new `InsightsPanel` (Insights tab) AND a refactored `PrinterSettings.tsx` recovery section — do not let two different payback numbers exist for the same printer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Product profit/printer-hour ranking (INS-01) | Browser / Client (pure derivation) | — | All data already local in IndexedDB; no server round-trip; matches existing `salesReportAggregates.ts` pattern |
| True hourly wage headline (INS-01) | Browser / Client (pure derivation) | — | Same — aggregate over existing jobs/sales |
| Printer payback/ROI (INS-02) | Browser / Client (pure derivation) | — | Reads `PrinterInstance`, `PrintJob`, `Sale`, `FailureEvent`, `MaintenanceEvent` — all local Dexie stores |
| What-if margin simulator (INS-03) | Browser / Client (pure derivation, ephemeral local state) | — | Reuses `costCalc.ts`/`pricingInterlink.ts`; never persists; no Dexie writes |
| Insights tab shell + routing | Frontend Server tier N/A (this is a client-only SPA) — Browser / Client | — | Slots into Phase 38's `?tab=` URL routing, itself client-side `useSearchParams` |

*(This app has no SSR/backend tier for this phase — everything is Browser/Client, consistent with the "free floor never requires a backend call" invariant.)*

## Standard Stack

No new libraries. This phase is pure TypeScript derivation + existing React/Tailwind UI primitives.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18 (existing) | Component tree | Already the project stack |
| Dexie + dexie-react-hooks | existing (`useLiveQuery`) | Live IndexedDB subscriptions | Established pattern (`useAllSales`, `usePrinterInstances`, `useFailureEvents`, `useMaintenanceEvents`) |
| Vitest | existing | Unit tests for `insights.ts` pure functions | Matches `costCalc.test.ts` / `pricingInterlink.test.ts` precedent |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | — |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled slider inputs (INS-03) | A slider library (e.g. `@radix-ui/react-slider`) | Project has zero UI-component-library dependencies today (all primitives are hand-built in `src/components/ui/`); a native `<input type="range">` styled with existing Tailwind tokens is consistent with house style and avoids a new dependency for 3 sliders |

**Installation:** none required — zero new `package.json` dependencies for this phase.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new npm packages. Skip the legitimacy gate.

## Architecture Patterns

### System Architecture Diagram

```
User opens /app?tab=insights
        │
        ▼
App.tsx  ──(VALID_TABS includes 'insights')──▶  InsightsPanel.tsx (orchestrator, owns its
        │                                         own Dexie subscriptions — NOT prop-drilled
        │                                         from App.tsx per INS-01's explicit rule)
        │
        ├─▶ useAllJobs() / useAllSales() / usePrinterInstances() /
        │   useFailureEvents() / useMaintenanceEvents()  (existing hooks, unmodified)
        │
        ▼
insights.ts (pure derivations, no React, no Dexie)
        │
        ├─▶ computeProductRanking(jobs, sales) ──▶ ProductRanking.tsx
        │     groups by normalized job.name (D-01), ranks sold products by
        │     profit-per-printer-hour (printHourProfit.ts, ported),
        │     separates "no sales yet" list (D-02)
        │
        ├─▶ computeWageHeadline(jobs, sales, targetHourlyRate) ──▶ WageInsight.tsx
        │     aggregate (netProfit / laborHours) across the selected period
        │     (D-03, D-04 — reuses/extracts the period-picker pattern)
        │
        ├─▶ computePrinterPayback(instance, jobs, sales, failureEvents,
        │     maintenanceEvents) ──▶ PrinterROI.tsx
        │     cumulative net profit (sales − fees − cost − ledger costs, D-07)
        │     vs purchase price; actual/projected break-even date (D-06);
        │     ALSO consumed by the refactored PrinterSettings.tsx recovery bar
        │     (single source of truth — see Pitfall P-01 below)
        │
        └─▶ WhatIfSimulator.tsx (INS-03)
              two entry points (JobsManager row icon + Insights job picker, D-09)
              both open the same Modal (Phase 19 primitive, D-12) with 3 sliders
              (filament price / electricity rate / failure rate, D-11) that call
              costCalc.ts's calculateCost()-equivalent pure functions live,
              rendering delta chips vs the saved job's stored values (D-10)
              — NEVER writes to Dexie
```

### Recommended Project Structure
```
src/
├── components/
│   └── insights/                      # NEW
│       ├── InsightsPanel.tsx          # ~150 LOC orchestrator, owns Dexie subscriptions
│       ├── WageInsight.tsx            # headline stat + target gap
│       ├── ProductRanking.tsx         # ranked list + "no sales yet" section
│       ├── PrinterROI.tsx             # per-printer payback cards
│       └── WhatIfSimulator.tsx        # Modal-based slider simulator (2 entry points)
├── hooks/
│   ├── useProductRanking.ts           # NEW — thin hook wrapping insights.ts + useLiveQuery reads
│   ├── usePrinterPayback.ts           # NEW — same, printer-scoped
│   └── useWageInsight.ts              # NEW
└── utils/
    ├── insights.ts                    # NEW — orchestration-level pure derivations (or insights/ folder — Claude's discretion, D-13 area)
    ├── printHourProfit.ts             # PORTED from feat/insight-pricing-coach (+ .test.ts)
    ├── pricingCoach.ts                # PORTED, utils-only (+ .test.ts) — not wired to UI this phase
    ├── costAllocation.ts              # PORTED, utils-only (+ .test.ts) — not wired to UI this phase
    └── periodRange.ts                 # NEW (extracted from ReportsSection.tsx — see Pitfall P-02)
```

### Pattern 1: Reuse the established "actual profit" formula, don't reinvent it
**What:** `src/utils/salesReportAggregates.ts` (`computeSalesReport`) already implements the canonical "actual profit from a recorded sale" formula used by the v1.8 Reports tab: `profit = Σconvert(sale.totalRevenue) − Σconvert(sale.marketplaceFee ?? 0) − Σconvert(job.costPerUnit × sale.quantity)`, with FX conversion via `convert()` and a `hasPartialData` flag when any conversion has no rate (never silently drops/guesses).
**When to use:** Both INS-01 (product ranking, D-02 "real sale prices net of marketplace fees") and INS-02 (printer payback, D-05 "cumulative NET PROFIT") should build on this exact shape — either by importing a shared per-sale-profit helper factored out of `computeSalesReport`, or by mirroring its FX-null-safety contract precisely. This is the "true cost" convention already established; `pricingInterlink.ts`'s `priceFromMargin`/`priceFromProfit`/`marginFromPrice` are for the *forward* pricing problem (deriving a price from a target margin) and are NOT the right tool for re-deriving profit from an already-recorded `Sale` — do not use them for INS-01/INS-02's historical-profit math.
**Example:**
```typescript
// Source: src/utils/salesReportAggregates.ts:96-108 (existing, verified)
const from = sale.currency ?? userCurrency;
const g = convert(sale.totalRevenue, from, userCurrency, fxTable);
const f = convert(sale.marketplaceFee ?? 0, from, userCurrency, fxTable);
// ... accumulate gross, fees ...
const job = jobsById.get(sale.jobId);
const costNative = (job?.costPerUnit ?? 0) * sale.quantity;
const c = convert(costNative, job?.currency ?? userCurrency, userCurrency, fxTable);
// profit = gross - fees - cost, null if any conversion unavailable (hasPartialData)
```

### Pattern 2: Grade against `printHourProfit.ts`'s benchmark for INS-01 (per D-14)
**What:** `computePrintHourProfit({ sellingPrice, cost, printTimeHours })` → `{ value, tone: 'bad'|'warn'|'good'|'na' }`, graded against `PRINT_HOUR_SWEET_SPOT = { min: 1, max: 5 }`.
**When to use:** For INS-01's top/bottom earner distinction (success criterion 1). Pass the actual per-sale `cost` as `job.costPerUnit + (sale.marketplaceFee / quantity)` to keep it NET, matching the branch's own precedent (`profitPerHour` memo was deliberately net-of-fee — see 33-02-SUMMARY.md "Net (not gross) profit/hr").
**Example:**
```typescript
// Source: feat/insight-pricing-coach branch, src/utils/printHourProfit.ts (verified, to be ported)
export function computePrintHourProfit(input: PrintHourProfitInput): PrintHourProfitResult {
  const hrs = finite(input.printTimeHours);
  if (hrs === null || hrs <= 0) return { value: null, tone: 'na' };
  const value = ((finite(input.sellingPrice) ?? 0) - (finite(input.cost) ?? 0)) / hrs;
  // tone: value < 0 → 'bad'; value < 1 → 'warn'; else → 'good'
}
```

### Pattern 3: Extract the period picker (D-04) — it does not exist as a shared component yet
**What:** `ReportsSection.tsx` implements `RangeMode = 'month' | 'quarter' | 'year' | 'ytd' | 'custom'` with local `useState` for `mode`/`year`/`month`/`quarter`/`customStart`/`customEnd` and two local helpers `nowParts()` / `isoDay()` (lines 25–57). This is **not** a reusable component or util today — it is inline JSX + local state inside `ReportsSection.tsx`.
**When to use:** D-04 says "reuse the v1.8 Reports period picker... one shared component, consistent pattern." The planner must task an **extraction**: pull the `RangeMode` type, the range-resolution logic, and the `<Select>`-based UI into a new `src/utils/periodRange.ts` (pure `resolveDateRange(mode, parts): SalesReportRange`) + a `src/components/ui/PeriodPicker.tsx` (or `insights/`-local) component, then have `ReportsSection.tsx` consume the extracted version too (avoids duplicating the mode/year/month/quarter/custom state machine a second time inside `InsightsPanel.tsx`).
**Example:** (extraction target — not existing code)
```typescript
// NEW: src/utils/periodRange.ts
export type RangeMode = 'month' | 'quarter' | 'year' | 'ytd' | 'custom';
export function resolveDateRange(mode: RangeMode, parts: {...}): SalesReportRange { ... }
```

### Pattern 4: The what-if simulator entry point mirrors the Phase 39 log-failure pattern exactly (D-09)
**What:** `JobsManager.tsx` already has a working precedent for "icon action on a job row → opens a Modal pre-filled from that job, with a NewBadge overlay": `LogFailureModal` (state: `showLogFailureModal`, `logFailurePrefill`; handler: `handleLogFailure(job)` builds a prefill object then sets `showLogFailureModal(true)`; row action: `<IconButton onClick={(e) => { e.stopPropagation(); onLogFailure(job); }}>` + `<NewBadge feature="log-failure" className="absolute -top-1 -right-1 pointer-events-none" />`).
**When to use:** Copy this exact shape for the What-If action: `onWhatIf(job)` prop threaded the same way `onLogFailure` is, a `WhatIfSimulatorModal` with a prefill built from the job, and a new `features.ts` key (e.g. `'what-if-simulator'`) for the NewBadge.
**Example:**
```typescript
// Source: src/components/JobsManager.tsx:814-835 (existing pattern to mirror)
<IconButton
  label={`What-if ${job.name}`}
  icon={<SlidersIcon />}
  onClick={(e) => { e.stopPropagation(); onWhatIf(job); }}
/>
<NewBadge feature="what-if-simulator" className="absolute -top-1 -right-1 pointer-events-none" />
```

### Anti-Patterns to Avoid
- **Reimplementing profit-from-sale math a third time:** `PrinterSettings.tsx`'s existing recovery bar (see Pitfall P-01) uses `job.sellingPrice - job.costPerUnit` × `job.copiesSold` — this is the ASKING price, not the actual sale price, and ignores marketplace fees entirely. Do not copy this pattern into the new Insights tab; fix it at the source (see P-01).
- **Prop-drilling insight data through App.tsx:** INS-01 explicitly forbids this (REQUIREMENTS.md: "own panel/tab (NOT more props through App.tsx)"). `InsightsPanel.tsx` must call its own hooks (`useAllJobs`, `useAllSales`, `usePrinterInstances`, `useFailureEvents`, `useMaintenanceEvents`) directly, matching the `JobsManager`/`ReportsSection` precedent of feature-level data ownership, not receiving them as props from `App.tsx`.
- **A second, disagreeing "period picker" state machine:** don't hand-roll a fresh month/quarter/year/YTD/custom picker inside `InsightsPanel.tsx` — extract per Pattern 3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Actual profit from a recorded sale (FX-safe) | A new profit-summing loop in `insights.ts` | Factor a shared helper out of `salesReportAggregates.ts`'s per-sale accumulation loop (or import/reuse it directly) | Single source of truth for money math; the `hasPartialData`/null-on-missing-FX-rate contract is easy to get subtly wrong (e.g. silently treating a missing rate as 0) |
| Product-profit-per-hour grading | A new tone-threshold function | `printHourProfit.ts`'s `computePrintHourProfit` (ported) | Already tested, already benchmarked, D-14 explicitly mandates reuse |
| Toast for the "paid off" celebration (D-06) | A new inline `fixed top-4 right-4` toast | `useToast()` from `src/components/ui/toast/` (verified live on `main`, mounted in `App.tsx`, already used in `JobsManager.tsx`) | Project convention (`project_toast_system` memory) explicitly forbids hand-rolled inline toasts; the CONTEXT.md D-06 fallback concern is stale (see Pitfall P-03) |
| Slider UI | A slider library | Native `<input type="range">` + existing Tailwind tokens, matching house `Input`/`Select` styling conventions | Only 3 sliders needed (D-11); zero existing UI-library dependency to build on; adding one for 3 controls is disproportionate |
| Margin/cost recompute for the simulator | A parallel cost formula inside `WhatIfSimulator.tsx` | `costCalc.ts` pure functions (`calculateFilamentCost`, `calculateElectricityCost`, etc.) fed with the saved job's snapshot values overridden by slider state | PITFALLS.md C-03 explicitly warns against a second pricing implementation — "the simulator must reuse pure cost math... never fork a second pricing implementation" |

**Key insight:** Every money number in this phase has already been computed correctly exactly once elsewhere in the codebase (`salesReportAggregates.ts` for actual sale profit, `costCalc.ts`/`pricingInterlink.ts` for forward pricing, `printHourProfit.ts` for the per-hour grade). The entire job of Phase 40 is *composition and presentation* of existing pure functions, not new math — treat any new formula as a smell.

## Common Pitfalls

### Pitfall P-01: A payback/ROI feature already exists and disagrees with the CONTEXT.md spec
**What goes wrong:** `PrinterSettings.tsx` (lines ~427–554, verified in current `main`) already renders a per-printer "recovery progress bar" with `recoveryPercent`, `remainingToRecover`, and text like `"✓ Fully recovered! $X profit from N sales"` / `"No sales yet · $X to recover"`. If the planner builds INS-02 as a brand-new feature in the Insights tab without touching this existing code, the app will show **two different payback numbers for the same printer** — the old one using `job.sellingPrice × copiesSold` (asking price, gross, no ledger deduction) and the new one using `Sale.totalRevenue − marketplaceFee` net of Phase 39 maintenance/failure costs (D-05/D-07). These will diverge as soon as a job sells below/above its asking price, or once any maintenance/failure cost is logged.
**Why it happens:** The existing feature was built organically as part of printer depreciation settings (v1.x era, before Phase 39's ledgers or the "actual sale price" convention existed) and was never revisited.
**How to avoid:** Task the planner to (1) extract a single `computePrinterPayback(instance, jobs, sales, failureEvents, maintenanceEvents): PrinterPaybackResult` in `insights.ts` implementing D-05 (cumulative net profit) + D-07 (subtract ledger costs) + D-08 (missing-purchase-price handling), (2) have BOTH `PrinterROI.tsx` (new, full detail: actual/projected date, celebration toast per D-06) and a refactored `PrinterSettings.tsx` recovery section (compact display) consume it. Decide explicitly whether `PrinterSettings.tsx` keeps a mini version or just links to the Insights tab — either is fine, but silence on this decision guarantees drift.
**Warning signs:** A plan that creates `PrinterROI.tsx` without a corresponding diff to `PrinterSettings.tsx`.

### Pitfall P-02: D-04's "reuse the v1.8 period picker" requires an extraction, not a reuse
**What goes wrong:** A plan that assumes `PeriodPicker` is already an importable component (it is not — see Pattern 3) will either (a) silently duplicate the `RangeMode`/`nowParts`/`isoDay` state machine a second time inside `InsightsPanel.tsx`, or (b) block on discovering mid-implementation that no such component exists.
**Why it happens:** CONTEXT.md's D-04 wording ("reuse the v1.8 Reports period picker... one shared component") reads as if the component already exists as a reusable unit; it doesn't.
**How to avoid:** Plan an explicit extraction task before the ranking/wage tasks that depend on it: `src/utils/periodRange.ts` (pure) + `src/components/ui/PeriodPicker.tsx` (or wherever the team prefers), with `ReportsSection.tsx` migrated to consume the extracted version in the same task (proves behavioral equivalence, avoids two copies).
**Warning signs:** Any new file that redeclares `type RangeMode = 'month' | 'quarter' | ...` outside `periodRange.ts`.

### Pitfall P-03: CONTEXT.md's toast-system caveat is stale — verify before trusting old context notes
**What goes wrong:** D-06 says "shared toast system is still on `staged/toast-x1c-banner` — planner must decide mechanism if it hasn't landed." Taking this at face value could lead to building a redundant fallback inline announcement.
**Why it happens:** The project's own MEMORY.md is also stale on this point (says "NOT live"). Direct inspection shows the toast system merged to `main` on 2026-06-15 (`git log` commit `753fbf6`, "refactor: extract shared toast system, migrate inline toasts") and is mounted (`<ToastProvider>` wraps the whole app in `App.tsx`) and actively used (`JobsManager.tsx` calls `useToast()` for other Phase 39 features already).
**How to avoid:** Use `useToast()` directly for the D-06 "paid for itself" celebration toast — no fallback mechanism needed. `toast.success(content, { duration })`. Requires no infrastructure work.
**Warning signs:** Any plan step that says "build a minimal inline announcement because the toast system isn't confirmed live" — that premise is false as of this research date.

### Pitfall P-04: `printHourProfit`'s $1–5/hr benchmark is a rule-of-thumb, not a single citable source
**What goes wrong:** D-14 requires "Planner verifies the benchmark's sourcing... no-arbitrary-numbers rule" before reusing the number in an InfoTooltip with provenance. No Phase 33 planning doc traces this number to an external source — it is asserted as "the industry $1–5/print-hour machine benchmark" without a URL, and the milestone-level `FEATURES.md` research doesn't cite a specific figure either (it only cites SlicePrice3D's UI *pattern* of showing profit/hr, not a numeric range).
**Why it happens:** The number shipped once already (on the parked branch) without a traced citation, and got carried forward as "confirmed."
**How to avoid:** This research session ran an external check: multiple independent maker-business sources (LayerMath, financialmodelslab, others) independently converge on "$1–3/hr" to "$2–4/hr" for consumer-grade desktop FDM machine time, corroborating (not proving) the $1–5/hr range. **Tag the benchmark `[CITED: layermath.com + convergent secondary sources]`, not `[VERIFIED]`, in the InfoTooltip copy or its documentation** — e.g. "based on typical desktop-FDM machine-hour rates reported across several maker-business guides" rather than implying a single authoritative source. Do not claim a precise external citation the phase doesn't actually have.
**Warning signs:** InfoTooltip copy that cites a specific named source/URL for the $1–5 figure — none was found; don't fabricate one.

### Pitfall P-05: True Hourly Wage's "labor_hours" denominator is ambiguous for multi-copy jobs
**What goes wrong:** `PrintJob.prepTimeMinutes`/`postProcessingMinutes` are logged once per saved job (per print/batch run), while `copiesSold`/`Sale.quantity` can be >1 for that same job. If the wage aggregate naively sums `prepTimeMinutes + postProcessingMinutes` per SALE (multiplying by quantity), it will overstate labor for batch jobs where prep/post-processing was actually a one-time cost for the whole batch; if it sums per JOB regardless of quantity sold, it understates the real per-unit time investment reflected in the profit total (which does scale with quantity sold).
**Why it happens:** The data model doesn't distinguish "labor per unit" from "labor per production run" — this is a genuine data-quality/semantic gap, not a bug.
**How to avoid:** Recommend labor hours be aggregated **per job** (not multiplied by quantity), summed once per unique saved job that has ≥1 sale in the period, while net profit is summed across all sales in the period (which naturally scales with quantity). This is the more defensible reading of FEATURES.md's "(sale_price − true_cost) / total_labor_hours_on_job" (singular "job," not "per unit"). Flag this as an assumption for user/planner confirmation — it is a genuine judgment call, not a verified fact.
**Warning signs:** A formula that multiplies `prepTimeMinutes` by `sale.quantity`.

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (new tab, new pure derivations), not a rename/refactor/migration phase. No existing stored data, live service config, OS-registered state, or build artifacts reference anything being renamed or moved.

## Code Examples

### Existing "actual profit from sale" precedent (reuse target)
```typescript
// Source: src/utils/salesReportAggregates.ts (verified on main, lines 85-108)
const job = jobsById.get(sale.jobId);
const costNative = (job?.costPerUnit ?? 0) * sale.quantity;
const c = convert(costNative, job?.currency ?? userCurrency, userCurrency, fxTable);
// profit = gross - fees - cost; null-safe on missing FX rate (hasPartialData)
```

### Existing depreciation/purchase-price resolution precedent (reuse for INS-02's purchase price)
```typescript
// Source: src/utils/costCalc.ts calculateDepreciation (verified on main)
const purchasePrice = selectedInstance?.actualPurchasePrice ?? selectedPrinter?.purchasePrice ?? 0;
// NOTE: PrinterInstance's field is `actualPurchasePrice`, NOT `purchasePrice` (that
// field lives on the PrinterAsset/PrinterConfig catalog entry, referenced via
// printerConfigId). CONTEXT.md's canonical_refs line "PrinterInstance.purchasePrice"
// is imprecise — always resolve via `instance.actualPurchasePrice ?? config?.purchasePrice ?? 0`.
```

### Existing tab registry insertion point (App.tsx)
```typescript
// Source: src/App.tsx (verified on main)
type Tab = 'calculator' | 'jobs' | 'materials' | 'customers' | 'reports' | 'settings';
const VALID_TABS: Tab[] = ['calculator', 'jobs', 'materials', 'customers', 'reports', 'settings'];
// Add 'insights' to both the union and the array; the roving-tabindex tablist and
// URL-fallback logic (D-07 from Phase 38) require zero other changes.
```

### Existing icon-action-opens-modal precedent (mirror for What-If, D-09)
```typescript
// Source: src/components/JobsManager.tsx (verified on main, LogFailure precedent)
const [showLogFailureModal, setShowLogFailureModal] = useState(false);
const [logFailurePrefill, setLogFailurePrefill] = useState<LogFailureModalPrefill | null>(null);
const handleLogFailure = useCallback((job: PrintJob) => {
  setLogFailurePrefill({ /* derived from job */ });
  setShowLogFailureModal(true);
}, [/* deps */]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `PrinterSettings.tsx` recovery bar using `job.sellingPrice × copiesSold` (gross, asking price) | `insights.ts`'s `computePrinterPayback` using actual `Sale` records net of fees + Phase 39 ledger costs | This phase (proposed) | Payback numbers become accurate and match the "true cost" convention already used elsewhere; removes a silent divergence between two UI surfaces |
| Toast system on a feature branch (`staged/toast-x1c-banner`) | Toast system merged to `main`, mounted, in active use | 2026-06-15 (commit `753fbf6`) | D-06's fallback concern is moot; use `useToast()` directly |

**Deprecated/outdated:**
- The MEMORY.md note `project_toast_system.md` saying "Branch not merged/tagged as of 2026-06-15" is stale for the merge status (though the exact tag/release status of the *desktop* build is a separate question, irrelevant here — the *code* is on `main`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | True Hourly Wage's labor-hours denominator should be summed **per job** (not multiplied by quantity sold) — see Pitfall P-05 | Pitfall P-05 / Architecture Pattern (WageInsight) | If wrong, the headline wage number is off by a multiplicative factor for any product sold >1×; low risk to correctness of other features, but could make the headline stat look implausible (too high or too low) to users with batch products |
| A2 | The $1–5/print-hour benchmark should be framed as a corroborated rule-of-thumb (`[CITED]`) rather than implying a single authoritative source | Pitfall P-04 / Common Pitfalls | Low — cosmetic/copy risk only (InfoTooltip wording), not a math risk |
| A3 | `PrinterSettings.tsx`'s existing recovery bar should be refactored to consume the new `computePrinterPayback`, rather than left untouched | Pitfall P-01 | Medium — if left untouched, ships two disagreeing payback numbers, which is a worse UX outcome than either building INS-02 alone or refactoring; this is a judgment call the planner/user should explicitly confirm, not something CONTEXT.md decided |
| A4 | `insights.ts`'s module decomposition (single file vs `insights/` folder) is unresolved by CONTEXT.md (explicitly "Claude's Discretion") — this research does not recommend one over the other, given the phase's small function count (~4-6 derivations) a single file is likely sufficient | Recommended Project Structure | Low — pure code-organization choice, no behavioral risk |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Should `PrinterSettings.tsx`'s existing recovery bar be refactored in this phase, or left as a known-divergent legacy display?**
   - What we know: The existing bar computes payback with different (less accurate) math than D-05/D-07 specify (Pitfall P-01).
   - What's unclear: CONTEXT.md doesn't mention `PrinterSettings.tsx` at all in its canonical_refs or decisions — this may be an oversight in phase scoping, or a deliberate "leave it alone, it's out of scope" choice.
   - Recommendation: Surface this to the user/planner explicitly before planning — the cheapest fix (swap `PrinterSettings.tsx`'s existing calculation to call the new `computePrinterPayback` util) is low-cost and prevents a confusing UX regression; recommend including it as an in-scope task unless the user says otherwise.

2. **Exact projection formula for the break-even date (D-06 "recent profit pace window choice")**
   - What we know: CONTEXT.md explicitly defers this to Claude's Discretion, requiring only that it be "explainable in a tooltip, no black-box smoothing."
   - What's unclear: No existing precedent in the codebase for a trailing-window profit-pace projection (the closest analog, WEAR-02's "next likely swap" prediction, projects from *hours*, not *time*, and lives in Phase 39 code not yet fully explored in this research pass).
   - Recommendation: A simple, explainable choice — e.g. "average net profit per sold unit over the last 90 days (or all-time if <90 days of sales history) × recent sales pace" — should be specified precisely in the plan, with the exact window named in code comments and the InfoTooltip, per the no-black-box-smoothing constraint.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the existing project stack (React/Vite/Dexie, already installed and verified working). No new CLI tools, databases, or APIs are introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing — confirmed via `costCalc.test.ts`, `salesReportAggregates.test.ts`, `pricingInterlink.test.ts` precedent) |
| Config file | existing `vite.config.ts` / `vitest` config (unchanged) |
| Quick run command | `npx vitest run src/utils/insights.test.ts` (once created) |
| Full suite command | `npm test` (or project's existing `vitest run` script — verify exact script name in `package.json` at plan time) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INS-01 | Product ranking groups by normalized title, ranks by net profit/printer-hour, separates unsold products | unit | `npx vitest run src/utils/insights.test.ts` | ❌ Wave 0 |
| INS-01 | True hourly wage aggregate + target gap | unit | `npx vitest run src/utils/insights.test.ts` | ❌ Wave 0 |
| INS-02 | Printer payback = cumulative net profit (net of fees, net of Phase 39 ledger costs) vs purchase price | unit | `npx vitest run src/utils/insights.test.ts` | ❌ Wave 0 |
| INS-02 | Missing purchase price → CTA; unassigned sales → separate line | unit + manual UAT | `npx vitest run src/utils/insights.test.ts` | ❌ Wave 0 |
| INS-03 | Simulator computes live margin/profit/break-even deltas without mutating the saved job | unit + manual UAT | `npx vitest run src/utils/insights.test.ts` (pure math) + human check (no Dexie write) | ❌ Wave 0 |
| Ported Phase 33 utils | `printHourProfit`, `pricingCoach`, `costAllocation` byte-identical to branch behavior | unit | `npx vitest run src/utils/printHourProfit.test.ts src/utils/pricingCoach.test.ts src/utils/costAllocation.test.ts` | ✅ (exists on `feat/insight-pricing-coach`, port as-is) |

### Sampling Rate
- **Per task commit:** targeted `insights.test.ts` + any touched util's test file
- **Per wave merge:** full `vitest run`
- **Phase gate:** full suite green + manual UAT script (rapid tab switching, simulator slider interaction, printer-without-purchase-price empty state, product-with-no-sales empty state) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/insights.ts` + `src/utils/insights.test.ts` — new file, covers INS-01/02/03 core derivations
- [ ] Port `src/utils/printHourProfit.ts(.test.ts)`, `src/utils/pricingCoach.ts(.test.ts)`, `src/utils/costAllocation.ts(.test.ts)` from `feat/insight-pricing-coach` branch (git-worktree path: `/Users/marcusdickinson/Projects/3DCoster-insight`, or `git show feat/insight-pricing-coach:src/utils/printHourProfit.ts`)
- [ ] `src/utils/periodRange.ts` + test — extracted from `ReportsSection.tsx` (Pitfall P-02)
- [ ] Framework: none — Vitest already configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No accounts in this phase (free floor, local-only) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | Single-user local app, no multi-tenant boundary |
| V5 Input Validation | Yes (light) | Slider inputs (INS-03) must clamp to sane numeric ranges client-side (existing `Input compact` pattern already validates numeric fields elsewhere in the app) |
| V6 Cryptography | No | No secrets, no crypto operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/extreme slider input causing NaN/Infinity propagation into displayed money values | Tampering (self-inflicted, not adversarial — local single-user app) | `costCalc.ts`'s existing finite-guard conventions (`Number.isFinite` checks throughout `printHourProfit.ts`/`costAllocation.ts`) — mirror this pattern in any new `insights.ts` function |

*(This phase has no network-facing attack surface — it's entirely local IndexedDB reads and pure computation. The security domain is intentionally thin.)*

## Sources

### Primary (HIGH confidence — verified directly against the codebase)
- `src/types.ts` — `PrintJob`, `Sale`, `PrinterInstance`, `FailureEvent`, `MaintenanceEvent`, `UserProfile` field shapes (read in full)
- `src/utils/salesReportAggregates.ts` — canonical actual-profit-from-sale formula (read in full)
- `src/utils/costCalc.ts` — `CalcInput`, `calculateDepreciation` purchase-price resolution precedent (read in full)
- `src/utils/pricingInterlink.ts` — `FeeShape`, `priceFromMargin`/`priceFromProfit`/`marginFromPrice` (read in full)
- `src/components/PrinterSettings.tsx` lines 400–560 — existing (to-be-reconciled) payback bar (read in full)
- `src/components/ReportsSection.tsx` — period-picker local-state pattern (grepped + spot-read)
- `src/components/JobsManager.tsx` — LogFailure icon-action precedent (grepped + spot-read)
- `src/App.tsx` — `VALID_TABS`/`Tab` type tab-registry insertion point (grepped)
- `src/components/ui/Modal.tsx`, `IconButton.tsx`, `InfoTooltip.tsx`, `ui/toast/` — shared primitives (read/grepped)
- `src/db/database.ts` — confirmed Dexie schema at v12 (Phase 39's `failureEvents`/`maintenanceEvents` stores already shipped)
- `git log` on `src/components/ui/toast/ToastProvider.tsx` — confirmed merged to `main` 2026-06-15, commit `753fbf6`
- `feat/insight-pricing-coach` branch (via worktree `/Users/marcusdickinson/Projects/3DCoster-insight`) — `printHourProfit.ts`, `pricingCoach.ts`, `costAllocation.ts` + their `.test.ts` files, and `.planning/phases/33-insight-pricing-coach/*.md` (SPEC, PLAN, SUMMARY docs) read in full for benchmark-sourcing verification

### Secondary (MEDIUM confidence — WebSearch cross-checked against multiple independent sources)
- [LayerMath — 3D Printing Hourly Rate 2026](https://layermath.com/blog/3d-printing-hourly-rate) — "$1 to $5 per hour is common for consumer-grade machines"
- [GrandpaCAD 3D Printing Business Calculator](https://grandpacad.com/en/tools/3d-printing-business-calculator) — machine-hour ROI/break-even pattern reference (cited already in milestone FEATURES.md)
- Convergent secondary sources (financialmodelslab.com, siraya.tech, shopify.com blog) independently citing $1–4/hr rule-of-thumb ranges for consumer-grade FDM machine time

### Tertiary (LOW confidence — flagged, not used as a primary basis for any recommendation)
- None used without corroboration in this research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all patterns verified directly in the codebase
- Architecture: HIGH — tab registry, hook patterns, Modal/IconButton primitives all directly read from `main`
- Pitfalls: HIGH for P-01/P-02/P-03 (all verified via direct code inspection); MEDIUM for P-04 (externally corroborated, not singularly sourced) and P-05 (a genuine semantic ambiguity in the data model, not resolvable by code inspection alone)

**Research date:** 2026-07-08
**Valid until:** 2026-08-07 (30 days — stable internal codebase, low external-dependency churn risk for this phase)
