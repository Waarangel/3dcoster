# Phase 33 — Insight & Pricing Coach ("Insight Slice")

> **Milestone:** v2.0 (Cost-Truth & Insight Engine) — *not yet formally scoped; this is the proposed first v2.0 phase. Run `/gsd:new-milestone` to slot it + the v2.0 candidates ([../../milestones/v2.0-CANDIDATES.md](../../milestones/v2.0-CANDIDATES.md)).*
> **Branch:** feature branch off `test/design-skills-experiment` (v2.0 / Cost-Truth Dark).
> **Status:** SPEC (pre-execution). Authored 2026-06-24.

## Goal

Turn the calculator from a **cost engine** into an **insight engine**: at-a-glance cost allocation, an *actionable* profit-per-hour gauge, and a **dynamic** pricing coach that reacts to the user's own numbers. This is the deliberate counter to SlicePrice3D — our most direct competitor wins on breadth, so we win on **guidance, simplicity, and trust**.

## Why (context)

- **Competitive wedge.** SlicePrice3D (see [[project_competitor_sliceprice3d]]) has the same features but an **overwhelming, confusing UX** ("a lot in here… can't believe there are 500 users") and a **purely static** pricing guide. Contextual guidance + simplicity is the gap. Their cost-allocation bar and "is this worth my time" hourly-rate goals are good ideas worth adapting.
- **On-theme.** Fits the v2.0 "Cost-Truth & Insight Engine" vision and ties into its greenlit "true hourly wage" idea.
- **Low effort, high trust.** Nearly all data already exists — `costs: CostBreakdown` and `fixedCosts` (`CostCalculator.tsx:517`/`:547`), `printTimeHours`, and the margin/profit/price interlink (`:1390`). This is wiring + content, not new cost math.

## Scope — three sub-features

### 1. Cost-allocation visualization
- In the existing **Cost Breakdown** section (`CostCalculator.tsx:1524`), render each component's **% share** as a slim stacked horizontal bar + a legend with %.
- Components: filament/material, labor, electricity, depreciation, nozzle/parts wear, failure buffer, shipping — whatever `calculateCost()` returns. Pure render of `costs`; **no new math**.
- Edge: empty form / total = 0 → no bar (or "—"), never NaN/Infinity.

### 2. Profit/hr-vs-target gauge
- Add a **Target Hourly Rate** (and optional **Minimum Hourly Rate**) to settings — adapted from SlicePrice3D's "Hourly Rate Goals."
- In the **Pricing** section, show `profit/hr = (sellingPrice − trueCost) ÷ printTimeHours`.
- State: **green** when `profit/hr ≥ target`, **amber** between min and target, **red** below min. Caption reads like a decision: *"$18/hr — below your $25 target."*
- Edge: `printTimeHours = 0` → "—" (can't compute per-hour).

### 3. Dynamic "Why this price?" coach
- Keep the margin-vs-markup explainer, but make the guidance **react to the user's current margin** instead of being a wall of fixed text (the explicit differentiator vs SlicePrice3D's static guide).
- Show a contextual line keyed to the current margin against healthy bands, e.g. *"45% — healthy for wholesale (30–50%)"* or *"⚠ 22% — below the wholesale floor; no room to discount later."* Voice: MJ / Cost-Truth.
- Collapsible, under the suggested price. **Channel-awareness is out of scope here** (arrives with the later Channel Presets phase); for now the coach is margin-driven.

## Non-goals (explicitly deferred)
- **Channel presets** (Direct/Etsy/Wholesale/Consignment) — separate v2.0 phase; coach stays margin-driven for now.
- **Per-tier profit/hr** across every suggested-margin tier — start with the current selling price; per-tier later.
- **Pro / hosted / branded** variants — ship as a **free floor**; the Pro ceiling (automated/hosted/branded) is a later, additive layer per the freemium model ([[project_free_paid_line_open_question]]).
- **Overhead-cost modeling** — SlicePrice3D's confusing overhead step is an anti-pattern we are deliberately NOT replicating here.

## Design decisions (locked with user 2026-06-24)
1. Profit/hr uses **total print hours**, computed for the **current selling price** (not per-tier) in v1.
2. Allocation = **stacked bar + % legend**.
3. Coach is **dynamic**, not static — the moat.
4. **Free floor**; offline; no account.
5. Build on a feature branch off `test/design-skills-experiment`.
6. NEW badges + `src/features.ts` entries per the badge rule.

## Success criteria
- **SC1** Cost Breakdown shows accurate per-component % allocation that sums to 100% for any non-empty job; degrades cleanly at total = 0.
- **SC2** Profit/hr renders with correct green/amber/red state vs target/min; shows "—" when print time = 0.
- **SC3** "Why this price?" guidance line **changes as the margin changes** (proven dynamic, not fixed).
- **SC4** Target/Minimum Hourly Rate **persists** in settings and is included in backup/restore (`BACKUP_STORES`/`DATE_FIELDS` if a new store is introduced — one-time reconcile per [[feedback_reconcile_legacy_data]]).
- **SC5** Everything is free, local, offline-safe.
- **SC6** `tsc -b` + tests + build gates green; NEW badges + `features.ts` added.

## Verification / UAT
- **Unit:** allocation % math (incl. 0-total guard); profit/hr value + threshold states; coach guidance selection by margin band.
- **UAT:** enter a job → see the allocation bar; set a target rate → watch the gauge flip color; change the margin → watch the coach text change.

## Suggested build sequence
1. **Cost-allocation viz** (pure render) — smallest, ship first.
2. **Target Hourly Rate setting + profit/hr gauge.**
3. **Dynamic coach.**

## Open questions
- Exact healthy-margin bands for the coach. Starting reference (from SlicePrice3D + general maker pricing): Direct-to-customer 65–85%, Wholesale 30–50%, Consignment 50–70%. **Confirm with user / domain expertise before locking copy.**
- Home for Target Hourly Rate: user profile vs labor/shipping settings (lean: labor settings, next to `laborHourlyRate`).
