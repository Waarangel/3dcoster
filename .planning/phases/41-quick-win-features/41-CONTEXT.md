# Phase 41: Quick-Win Features - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship four independent, local-only, free-floor features (CONN-01, CONN-03, LIFE-01, LIFE-02) — each delivering value in under a minute of interaction, no backend, no accounts:

1. **Reprice alerts** — when a material's price changes in the Asset Library, flag saved jobs whose margin now falls below the user's target, showing old vs new margin, with a per-job reprice Apply
2. **Quote Variants PDF** — 1pc/10pc/50pc (editable) tiered pricing in one branded document, riding the existing jsPDF quote engine
3. **Spool lifecycle** — opened date, drying sessions, storage location on the material record + a HIGH/MEDIUM/LOW moisture-risk indicator derived from hygroscopicity class + exposure time
4. **Tax-threshold tracker** — jurisdiction setting + progress bar toward the local hobby→business threshold with a crossing alert, "not tax advice" throughout

Independent of the backend phases; depends only on Phase 38 foundations. Tax threshold data is MEDIUM confidence — ships with a "data current as of" note (locked in roadmap).

</domain>

<decisions>
## Implementation Decisions

### Reprice alerts (CONN-01)
- **D-01: Trigger = material price save only.** The scan fires in the Asset Library save handler when a price actually changes. FX-rate-drift scans are deferred (noted as a scope refinement vs CONN-01's "or FX rate changes" wording — FX would need a stored rate snapshot to diff against).
- **D-02: Target = global `UserProfile.defaultProfitMargin`.** No per-material threshold this phase. Users without a default margin set get a sensible fallback prompt rather than silence.
- **D-03: Alert UX = toast → review modal.** Toast on save ("3 jobs now under your 30% target — review?") opens a shared-Modal list: job title, old → new margin, per-job actions. The modal must also be re-openable after the toast is dismissed (mechanism = planner discretion, e.g. from the material's card) so a dismissed toast isn't a lost alert. Use the live `useToast` system — never hand-roll.
- **D-04: Per-job reprice Apply.** Each affected row shows the suggested new selling price to restore target margin (`new_price = new_true_cost / (1 − target_margin)`) with an explicit per-job Apply button. No bulk apply this phase. Follows the Phase 39 suggestion-not-mutation pattern — nothing is ever auto-repriced (FAIL-03 lineage).

### Quote Variants (CONN-03)
- **D-05: Quantities editable, default 1/10/50.** Three quantity fields pre-filled with the roadmap defaults; users can change them (e.g. 1/25/100).
- **D-06: Tier math = per-tier discount %.** Unit price = the job's saved selling price × (1 − discount%), with user-entered discounts per tier (e.g. 0/10/20%), remembered as defaults for next time. Maker stays in control of the number. Explicitly NOT cost-amortization-at-quantity — no cost-model changes, no C-03 pricing-desync risk, no new money math needing equivalence tests.
- **D-07: Flow lives as a "Quantity variants" section/toggle inside the existing PrintQuoteModal.** One quote flow to maintain; discoverable where quoting happens.
- **D-08: Persistence = variants snapshot on the Quote record + tier picker on convert.** The Quote interface gains an optional by-value variants snapshot (quantities, discounts, unit prices — v1.2 D-17 snapshot rule applies). Recent Quotes shows it as one quote. Convert-to-Sale asks which tier the customer took and records quantity + unit price accordingly.

### Spool lifecycle (LIFE-01)
- **D-09: Model = asset IS the active spool.** Bolt `openedAt` / storage location / drying log onto the material `Asset` record — the lifecycle fields describe "the spool currently in use" of that material. Opening a fresh spool resets the clock (reset affordance = planner discretion). Zero new Dexie stores; aligns with v1.8 asset-level stock (a new spool is already a manual stockEvent). Known accepted gap: can't track two open spools of one material (deferred — lightweight spools store is the clean upgrade path).
- **D-10: Drying log = date-only entries that reset the risk clock.** One-tap "log drying"; risk counts from `max(openedAt, last dried)`. No method/duration fields this phase.
- **D-11: Hygroscopicity class = auto from `filamentType` + per-material override** — the exact Phase 39 `isAbrasive` D-13 pattern. The class mapping (Nylon HIGH, PETG/TPU MEDIUM, PLA LOW) and the day-thresholds behind HIGH/MEDIUM/LOW must trace to the research (FEATURES.md §5) — no arbitrary numbers.
- **D-12: UI = risk badge on the Asset Library filament card + "Spool" section in the material edit modal.** Badge shows risk level + days open; openedAt/location/drying log live in the edit modal; one-tap "log drying" also available from the card.

### Tax-threshold tracker (LIFE-02)
- **D-13: Progress bar lives in the Insights tab** (Phase 40) as a threshold card — it's a pure derivation over sales data. Jurisdiction is configured in Settings.
- **D-14: Jurisdiction-aware tax year.** Year boundary derives from the jurisdiction (UK: Apr 6, AU: Jul 1, US/DE: Jan 1) via a small fixed, research-sourced lookup table. Calendar-year-everywhere was rejected as materially wrong for UK/AU.
- **D-15: Gross sale revenue drives the bar** — sum of `Sale.totalRevenue` in home currency for the tax year, matching how UK/DE/AU thresholds are legally defined (gross turnover, not profit). An InfoTooltip explains why marketplace fees aren't deducted (deliberately different from the v1.9 net-of-fees profit treatment).
- **D-16: Jurisdictions = roadmap 4 + custom "Other".** UK £1k trading allowance / DE Kleinunternehmer / AU GST / US badges-of-trade informational note (no bar for US), plus an "Other" option where the user enters their own threshold amount + label and gets the same progress bar. "Not tax advice" disclaimer + "data current as of" note are non-negotiable and appear on the card.

### Claude's Discretion
- Reprice review modal re-open mechanism and where the affected-jobs state lives between sessions (ephemeral vs derived-on-open both acceptable; no new Dexie store required for alert state)
- Handling of multi-material jobs in the reprice scan (a job is affected if ANY of its filaments' price changed — exact display treatment free)
- Variants PDF layout (tier table design within the existing branded template), discount-default persistence location
- "New spool" reset affordance wording/placement; risk-badge visual treatment; whether non-filament asset categories get lifecycle fields (default: filament only)
- Crossing-alert mechanics for the tax threshold (one-time toast on crossing + persistent state on the card is the expected shape; exact once-only semantics free)
- NEW-badge placement for four features at once (must follow `src/features.ts` registry + absolute-overlay rules; avoid badge spam — planner may badge the most visible surface per feature)
- Dexie schema details (which fields on Asset/Quote/UserProfile, version bump number — verify current version at plan time)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research
- `.planning/research/FEATURES.md` §3 — Reprice alerts: trigger pattern, affected-list table stakes, inverse-margin formula, anti-features (no live scraping — DECLINED, no email/push)
- `.planning/research/FEATURES.md` §4 — Quote Variants pattern (borrowed from 3DPrintQuote): multiple qty options in one PDF, each a full price snapshot
- `.planning/research/FEATURES.md` §5 — Spool lifecycle: Spoolman field reference, hygroscopicity classes (Nylon 4–8h @ 50% RH, PETG 12–24h, PLA resistant), anti-features (no IoT sensors, no auto drying reminders, don't replace the catalog)
- `.planning/research/FEATURES.md` §6 — Tax thresholds table (MEDIUM confidence): UK £1,000 trading allowance (£3,000 in 2029; £1,700 platform reporting), DE €25,000 Kleinunternehmer, AU GST AUD 75,000, US badges-of-trade; tax-year starts; anti-features (never give actual tax advice, no auto-filing, single jurisdiction only)
- `.planning/research/PITFALLS.md` — C-03 pricing-desync class: D-06 tier math deliberately avoids new pricing implementations; any Apply that writes a selling price must go through existing job-save paths

### Requirements & prior context
- `.planning/REQUIREMENTS.md` — CONN-01, CONN-03, LIFE-01, LIFE-02 exact wording (note D-01 scope refinement on CONN-01's FX clause)
- `.planning/ROADMAP.md` — Phase 41 goal + 4 success criteria
- `.planning/phases/40-insight-layer/40-CONTEXT.md` — Insights tab architecture the tax card joins (own Dexie subscriptions, no props through App.tsx); Phase 41 named as a consumer of the insights module
- `.planning/phases/39-cost-realism/39-CONTEXT.md` — suggestion-not-mutation pattern (D-04 reprice Apply, D-11 hygro override mirror it); isAbrasive auto-detect + override precedent (D-13 there)
- `.planning/phases/38-foundation/38-CONTEXT.md` — tab/URL registry; calculator section seams (not touched this phase)

### Source of truth in code
- `src/pdf/generateQuotePdf.ts` + `src/components/PrintQuoteModal.tsx` — the jsPDF quote engine and modal the variants section extends (keep lazy-load discipline; CI guard `scripts/assert-no-static-pdf-import.mjs` must stay green)
- `src/types.ts` — `Asset` (lifecycle fields + hygro override attach here), `Quote.lineItemsSnapshot` (variants snapshot precedent), `Sale.totalRevenue` (tax aggregation input), `UserProfile.defaultProfitMargin` (reprice target) + new jurisdiction field
- `src/components/ui/toast/` — LIVE shared toast system (`useToast`) for the reprice alert and threshold-crossing alert; never hand-roll
- `src/utils/costCalc.ts` + `src/utils/pricingInterlink.ts` — pure math for recomputing affected-job margins in the reprice scan; NEVER fork pricing
- `src/utils/salesReportAggregates.ts` + shared `PeriodPicker` (Phase 40 D-04) — sales aggregation precedent for the tax-year total (note: tax year ≠ PeriodPicker periods; tracker computes its own jurisdiction-aware window)
- `src/utils/abrasive.ts` — the filamentType-matcher pattern D-11 mirrors for hygroscopicity
- `src/components/insights/InsightsPanel.tsx` — where the tax-threshold card slots in
- `src/hooks/useDatabase.ts` — Dexie CRUD hooks home; asset save handler (reprice trigger), `useAllSales` (tax totals)
- `src/features.ts` — NEW-badge registry (four new user-facing features to register)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useToast` (LIVE on main)** — the reprice alert and threshold-crossing alert both use it; the Phase 40 staged-branch concern is resolved
- **jsPDF quote engine** (`generateQuotePdf.ts`, lazy-loaded) + `PrintQuoteModal` — variants extend, not fork
- **Shared `Modal` primitive** (Phase 19) — the reprice review modal container
- **`pricingInterlink.ts` / `costCalc.ts`** — margin recomputation for affected jobs; inverse-margin formula for suggested prices
- **Phase 39 `isAbrasive` auto-detect + override** (`abrasive.ts`) — the exact pattern for hygroscopicity class
- **v1.8 stockEvents** — "new spool = manual stock event" already exists; D-09 lifecycle fields complement it without overlap
- **Phase 40 Insights tab** — self-subscribing panel the tax card joins; `useAllSales` for revenue totals
- Shared UI: `InfoTooltip` (gross-revenue explainer, hygro provenance, tax-data-currency note), Input `compact` (discount %, threshold amounts), icon buttons with required labels

### Established Patterns
- **Suggestion-not-mutation** — reprice Apply is explicit and per-job; saved jobs/quotes are never silently repriced (locked lineage: FAIL-03, Phase 39)
- **By-value snapshots** on Quote records (v1.2 D-17) — the variants snapshot follows it
- **No arbitrary numbers** — hygro classes/day-thresholds and tax thresholds/tax-year dates must trace to FEATURES.md research; tax card carries "data current as of"
- **NEW-badge registry + absolute-overlay placement** — four features to register in `src/features.ts`
- **Feature-level Dexie subscriptions** (JobsManager/Reports/Insights precedent) — no new props through App.tsx
- **Dexie migrations** — new optional fields on existing stores typically need no upgrade(); backup/restore must include any shape changes (verify `backupExport.ts` coverage)

### Integration Points
- Asset Library save handler — reprice scan trigger (D-01)
- Asset Library filament cards + material edit modal — spool badge + lifecycle section (D-12)
- PrintQuoteModal — variants section (D-07); Convert-to-Sale flow — tier picker (D-08)
- Insights tab — tax-threshold card (D-13); Settings — jurisdiction picker (D-13/D-16)
- Phase 44 sync format must include any new/changed fields (Asset lifecycle, Quote variants, UserProfile jurisdiction)

</code_context>

<specifics>
## Specific Ideas

- Reprice toast should read like the research sketch: "3 jobs now under your 30% target — review?" with the modal showing "old 31% → new 24%" per job and a concrete suggested price next to Apply
- Tier math stays maker-controlled: the app never invents a bulk price — the maker sets the discount, the app does the arithmetic and remembers the preference
- Moisture badge is the instant visual cue: "HIGH — Nylon, open 12 days" on the card; drying is one tap, not a form
- The tax card is deliberately conservative: gross revenue, legally-sourced year boundaries, "not tax advice" + "data current as of [date]" always visible; US users get the badges-of-trade note instead of a false-precision bar

</specifics>

<deferred>
## Deferred Ideas

- **FX-rate-drift reprice scan** (CONN-01 full wording) — needs a stored rate snapshot to diff against; revisit when FX-sensitive users ask
- **Per-material alert threshold override** (research differentiator)
- **Bulk "reprice all"** in the review modal
- **Price history sparkline** on material cards (research differentiator)
- **Multi-spool tracking** (lightweight spools store) — clean upgrade from asset-as-active-spool if users ask
- **Drying method/duration fields** on drying log entries
- **Link failed prints to "suspected wet filament"** (research differentiator; feeds the failure engine)
- **Last-used date + stale-stock alert** (research differentiator)
- **Canada jurisdiction** (CAD 30k / 4 rolling quarters — genuinely different math)
- **Multi-year revenue trend** for the US 3-of-5-years rule (research differentiator)

</deferred>

---

*Phase: 41-quick-win-features*
*Context gathered: 2026-07-09*
