# Phase 41: Quick-Win Features - Research

**Researched:** 2026-07-09
**Domain:** Local-first cost-calculator feature additions (reprice alerting, PDF tier tables, material-lifecycle tracking, jurisdiction tax-threshold tracking) inside an existing React + TypeScript + Dexie codebase — no new libraries, no backend
**Confidence:** HIGH for code-integration points (read directly from source); MEDIUM for moisture-risk day-thresholds (industry sources disagree by 2-10x); MEDIUM for tax-threshold currency (verified UK 2026/27 value, other 3 jurisdictions trust the 2026-07-03 milestone research, re-verified structurally not numerically)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reprice alerts (CONN-01)**
- D-01: Trigger = material price save only. The scan fires in the Asset Library save handler when a price actually changes. FX-rate-drift scans are deferred (scope refinement vs CONN-01's "or FX rate changes" wording).
- D-02: Target = global `UserProfile.defaultProfitMargin`. No per-material threshold this phase. Users without a default margin set get a sensible fallback prompt rather than silence.
- D-03: Alert UX = toast → review modal. Toast on save ("3 jobs now under your 30% target — review?") opens a shared-Modal list: job title, old → new margin, per-job actions. The modal must also be re-openable after the toast is dismissed (mechanism = planner discretion) so a dismissed toast isn't a lost alert. Use the live `useToast` system — never hand-roll.
- D-04: Per-job reprice Apply. Each affected row shows the suggested new selling price to restore target margin (`new_price = new_true_cost / (1 − target_margin)`) with an explicit per-job Apply button. No bulk apply this phase. Follows the Phase 39 suggestion-not-mutation pattern — nothing is ever auto-repriced (FAIL-03 lineage).

**Quote Variants (CONN-03)**
- D-05: Quantities editable, default 1/10/50. Three quantity fields pre-filled with the roadmap defaults; users can change them.
- D-06: Tier math = per-tier discount %. Unit price = the job's saved selling price × (1 − discount%), with user-entered discounts per tier, remembered as defaults for next time. Explicitly NOT cost-amortization-at-quantity — no cost-model changes, no C-03 pricing-desync risk.
- D-07: Flow lives as a "Quantity variants" section/toggle inside the existing PrintQuoteModal. One quote flow to maintain.
- D-08: Persistence = variants snapshot on the Quote record + tier picker on convert. The Quote interface gains an optional by-value variants snapshot (quantities, discounts, unit prices — v1.2 D-17 snapshot rule applies). Recent Quotes shows it as one quote. Convert-to-Sale asks which tier the customer took and records quantity + unit price accordingly.

**Spool lifecycle (LIFE-01)**
- D-09: Model = asset IS the active spool. Bolt `openedAt` / storage location / drying log onto the material `Asset` record. Opening a fresh spool resets the clock (reset affordance = planner discretion). Zero new Dexie stores; known accepted gap: can't track two open spools of one material (deferred).
- D-10: Drying log = date-only entries that reset the risk clock. One-tap "log drying"; risk counts from `max(openedAt, last dried)`. No method/duration fields this phase.
- D-11: Hygroscopicity class = auto from `filamentType` + per-material override — the exact Phase 39 `isAbrasive` D-13 pattern. The class mapping (Nylon HIGH, PETG/TPU MEDIUM, PLA LOW) and the day-thresholds behind HIGH/MEDIUM/LOW must trace to research — no arbitrary numbers.
- D-12: UI = risk badge on the Asset Library filament card + "Spool" section in the material edit modal. Badge shows risk level + days open; openedAt/location/drying log live in the edit modal; one-tap "log drying" also available from the card.

**Tax-threshold tracker (LIFE-02)**
- D-13: Progress bar lives in the Insights tab (Phase 40) as a threshold card — pure derivation over sales data. Jurisdiction is configured in Settings.
- D-14: Jurisdiction-aware tax year. Year boundary derives from the jurisdiction (UK: Apr 6, AU: Jul 1, US/DE: Jan 1) via a small fixed, research-sourced lookup table. Calendar-year-everywhere was rejected as materially wrong for UK/AU.
- D-15: Gross sale revenue drives the bar — sum of `Sale.totalRevenue` in home currency for the tax year, matching how UK/DE/AU thresholds are legally defined (gross turnover, not profit). An InfoTooltip explains why marketplace fees aren't deducted.
- D-16: Jurisdictions = roadmap 4 + custom "Other". UK £1k trading allowance / DE Kleinunternehmer / AU GST / US badges-of-trade informational note (no bar for US), plus an "Other" option where the user enters their own threshold amount + label and gets the same progress bar. "Not tax advice" disclaimer + "data current as of" note are non-negotiable and appear on the card.

### Claude's Discretion
- Reprice review modal re-open mechanism and where the affected-jobs state lives between sessions (ephemeral vs derived-on-open both acceptable; no new Dexie store required for alert state)
- Handling of multi-material jobs in the reprice scan (a job is affected if ANY of its filaments' price changed — exact display treatment free)
- Variants PDF layout (tier table design within the existing branded template), discount-default persistence location
- "New spool" reset affordance wording/placement; risk-badge visual treatment; whether non-filament asset categories get lifecycle fields (default: filament only)
- Crossing-alert mechanics for the tax threshold (one-time toast on crossing + persistent state on the card is the expected shape; exact once-only semantics free)
- NEW-badge placement for four features at once (must follow `src/features.ts` registry + absolute-overlay rules; avoid badge spam — planner may badge the most visible surface per feature)
- Dexie schema details (which fields on Asset/Quote/UserProfile, version bump number — verify current version at plan time; this research confirms current version is 12 and no bump is required for non-indexed optional fields)

### Deferred Ideas (OUT OF SCOPE)
- FX-rate-drift reprice scan (CONN-01 full wording) — needs a stored rate snapshot to diff against; revisit when FX-sensitive users ask
- Per-material alert threshold override (research differentiator)
- Bulk "reprice all" in the review modal
- Price history sparkline on material cards (research differentiator)
- Multi-spool tracking (lightweight spools store) — clean upgrade from asset-as-active-spool if users ask
- Drying method/duration fields on drying log entries
- Link failed prints to "suspected wet filament" (research differentiator; feeds the failure engine)
- Last-used date + stale-stock alert (research differentiator)
- Canada jurisdiction (CAD 30k / 4 rolling quarters — genuinely different math)
- Multi-year revenue trend for the US 3-of-5-years rule (research differentiator)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| CONN-01 | When a material price or FX rate changes, the app flags saved products whose margin falls below target (scope-refined to material-price-only per D-01) | Pattern 2 (`priceFromMargin` reuse), Pattern 3 (`reconcileFixedCostsAtSave` reconstruction precedent), Pitfall 2 (`pricePerGram` override exclusion) |
| CONN-03 | User can generate a Quote Variants PDF — 1pc/10pc/50pc tiered pricing in one branded document (rides the existing jsPDF quote engine) | Pitfall 3 (`renderLineItems` single-row hardcode + required branch), Architecture Diagram (PrintQuoteModal → Quote.variantsSnapshot → PDF flow) |
| LIFE-01 | User can track spool lifecycle — opened date, drying sessions, storage location — and see a moisture-risk indicator derived from material hygroscopicity class + exposure time | Pattern 1 (`abrasive.ts` override-resolver mirror), Pitfall 1 (FilamentType nylon gap), Code Examples (sourced day-threshold table), Pitfall 4 (`DATE_FIELDS` backup gap) |
| LIFE-02 | User can set their jurisdiction and see cumulative-revenue progress toward its hobby→business tax threshold, with an alert on crossing — all local, "not tax advice" | Pattern 4 (`resolveDateRange` mirror for tax-year window), Pattern 5 (`convert()` reuse for revenue sum), Code Examples (verified UK threshold + tax-year boundary table) |
</phase_requirements>

## Summary

Phase 41 ships four additive, local-only features onto an already-mature Dexie + React 18 codebase. None of the four require a new Dexie store, a new npm package, or backend access — they are new **fields** on `Asset`, `Quote`, and `UserProfile`, plus new pure derivation modules and UI surfaces that plug into existing containers (`AssetLibrary`, `PrintQuoteModal`, `InsightsPanel`, `SettingsModal`). The codebase already has the exact patterns each feature needs: `src/utils/abrasive.ts` is the literal template for the hygroscopicity-class resolver (D-11); `src/utils/pricingInterlink.ts#priceFromMargin` is the exact function the reprice "Apply" suggestion should call instead of hand-rolling `new_price = new_true_cost / (1 - margin)`; `src/db/backfill.ts#reconcileFixedCostsAtSave` is the precedent for reconstructing a job's true cost from stored fields + current asset prices outside `CostCalculator.tsx`; `src/utils/salesReportAggregates.ts` + `src/utils/fxConvert.ts#convert` is the precedent for summing `Sale.totalRevenue` into home currency for the tax tracker; and `src/utils/periodRange.ts#resolveDateRange` is the precedent for a pure jurisdiction-aware date-range resolver.

Two research gaps flagged in CONTEXT.md are closed below: the moisture-risk day-threshold table (§ Common Pitfalls / Code Examples — sourced from Bambu/Prusa/community guides, explicitly MEDIUM confidence because sources disagree) and confirmation that the UK £1,000 trading allowance is still current for the 2026/27 tax year (verified live 2026-07-09). The Dexie schema is currently at version 12 (Phase 39 added `failureEvents`/`maintenanceEvents`); this phase's new fields are all non-indexed optional additions to existing stores and — following the v11/v12 precedent — need **no version bump and no `.upgrade()` migration**, only default-fallback handling at the read site (mirrors `isAbrasive`/`lowStockThreshold`'s `undefined = fall back` pattern already used throughout `Asset`).

**Primary recommendation:** Build all four features as pure derivation/resolver modules (mirroring `abrasive.ts`, `pricingInterlink.ts`, `periodRange.ts`) consumed by thin container components that already own their own Dexie subscriptions (`AssetLibrary`, `InsightsPanel`) — do not add new props through `App.tsx`, do not fork the pricing math, and do not add a Dexie version bump unless a genuinely new indexed field is needed (none currently identified).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reprice alert scan (CONN-01) | Client (React + Dexie) | — | Pure client-side scan triggered from the Asset Library save handler; no network |
| Reprice suggested price | Client (pure util) | — | `priceFromMargin` already exists in `pricingInterlink.ts`; reused, never forked |
| Quote Variants PDF (CONN-03) | Client (jsPDF, lazy-loaded) | — | Existing `generateQuotePdf.ts` dynamic-import module; extends, does not fork |
| Spool lifecycle fields (LIFE-01) | Client (Dexie `materials` store) | — | Bolts onto existing `Asset` record; zero new stores per D-09 |
| Moisture-risk derivation | Client (pure util) | — | Render-time computation from `openedAt`/drying log + hygroscopicity class; never persisted |
| Tax-threshold tracker (LIFE-02) | Client (Insights tab) | — | Pure derivation over existing `Sale` records; jurisdiction stored in `UserProfile` |
| NEW-badge registration | Client (`src/features.ts`) | — | Static release-date registry, no runtime dependency |
| Backup/restore coverage | Client (`backupExport.ts`/`backupSchema.ts`) | — | Generic per-store `toArray()` already covers new fields; only `DATE_FIELDS` needs an update if a new field is a `Date` |

## Standard Stack

This phase adds **zero new npm dependencies**. All four features are built entirely on the existing stack:

### Core (existing, reused)
| Library | Version | Purpose | Why Standard (for this phase) |
|---------|---------|---------|--------------------------------|
| dexie / dexie-react-hooks | (pinned in package.json — unchanged) | `Asset`/`Quote`/`UserProfile` field storage | Already the sole persistence layer; no new store needed |
| jspdf / jspdf-autotable | (pinned — unchanged) | Quote Variants PDF table rendering | `generateQuotePdf.ts` already lazy-loads this; variants extend the same module |
| React 18 + TypeScript | (pinned — unchanged) | All new UI surfaces | Matches every existing component in the codebase |

**Version verification:** No new packages are introduced, so there is nothing to verify against a registry for this phase. Confirm via:
```bash
cat /Users/marcusdickinson/Projects/3DCoster/package.json | grep -E '"dexie"|"jspdf"'
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new `spools` Dexie store for lifecycle tracking | Fields bolted onto `Asset` (D-09, locked) | A dedicated store would support multi-spool tracking but is explicitly deferred; do not build it this phase |
| A new `priceHistory` Dexie store for reprice alerts | Ephemeral/derived-on-open scan state (Claude's Discretion, locked as "no new Dexie store required") | Persisted alert history is a research differentiator, explicitly deferred |

**Installation:** None required.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. `none`

## Project Constraints (from CLAUDE.md)

- **No arbitrary numbers rule** (global CLAUDE.md): every numeric threshold (moisture-risk days, tax thresholds, tax-year boundaries) must trace to a cited source or be flagged `[ASSUMED]`/`not tax advice` — never invented. See § Common Pitfalls and § Code Examples below for the sourced tables.
- **Action buttons/icons** (project CLAUDE.md): the reprice review modal's per-job Apply and the drying-log "log drying" one-tap action are repeated row/item actions — use `IconButton`/existing icon-button components where the action is icon-only; primary CTAs (e.g. "Review" in the toast, "Apply" if rendered as text) keep text per the existing convention. Every icon-only control needs a descriptive `aria-label`.
- **Shared toast system**: `useToast()` from `src/components/ui/toast/` is LIVE on main — never hand-roll a toast for the reprice alert or the tax-threshold crossing alert (CONTEXT.md D-03/D-16 discretion).
- **SQL/diagnostic scripts**: not applicable — this phase touches no SQL, only Dexie/IndexedDB.
- **Release process**: per project CLAUDE.md, any `v*` tag requires a code review of the diff and CHANGELOG.md entry — not a phase-41 concern directly, but the eventual release containing this phase must follow that gate.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  AssetLibrary.tsx (materials tab)                                    │
│  handleSubmit() ─┬─> onUpdateAsset(material)  [existing]            │
│                   │                                                  │
│                   └─> [NEW] reprice scan (D-01)                     │
│                         reads: old material, new material, all jobs, │
│                                userProfile.defaultProfitMargin       │
│                         calls: reconstructCalcInput-style recompute  │
│                                (mirrors reconcileFixedCostsAtSave)   │
│                         → affected PrintJob[] with old/new margin    │
│                         → useToast().info(...) with a "Review" CTA   │
│                         → opens shared <Modal> review list           │
│                              each row: old→new margin,                │
│                              suggested price = priceFromMargin(...)  │
│                              [Apply] → updateJob(...) [existing hook]│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PrintQuoteModal.tsx                                                 │
│  [NEW] "Quantity variants" section/toggle (D-07)                    │
│    3 qty fields (default 1/10/50) × discount % fields (default 0)   │
│    unitPrice[i] = job.sellingPrice × (1 - discount[i]/100)          │
│  handleGenerateQuote() ─> createQuote({ ..., variantsSnapshot })    │
│                             [NEW optional field on Quote, D-08]      │
│                         ─> generateQuotePdf(quote)                  │
│                              [EXTENDED] renderLineItems branches:    │
│                              variantsSnapshot present → tier table   │
│                              absent → existing single-row layout     │
│  Convert-to-Sale flow (JobsManager) ─> [NEW] tier picker when the   │
│    source Quote has a variantsSnapshot (D-08)                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  AssetLibrary.tsx → MaterialRow (per-filament row, D-12)             │
│    [NEW] moisture risk badge (mirrors existing <StockBadge>)         │
│      resolveHygroscopicityClass(filamentType, name, override)       │
│      daysSince(max(openedAt, lastDriedAt)) → risk lookup table       │
│    edit modal → [NEW] "Spool" section: openedAt, location,           │
│      drying log (one-tap "log drying" resets clock, D-10)           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  InsightsPanel.tsx (Insights tab)                                    │
│    [NEW] Tax-threshold card (D-13)                                   │
│      jurisdiction ← userProfile.jurisdiction (set in SettingsModal)  │
│      taxYearRange ← resolveTaxYearRange(jurisdiction, now())         │
│        [NEW pure util, mirrors periodRange.ts's resolveDateRange]    │
│      revenue ← Σ convert(sale.totalRevenue, sale.currency ?? ...,   │
│                          userCurrency, fxTable)                      │
│        for sales where soldAt ∈ taxYearRange  [mirrors              │
│        salesReportAggregates.ts's convert() usage]                  │
│      progress bar + crossing-alert via useToast()                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new top-level folders. New pure modules alongside existing siblings:

```
src/
├── utils/
│   ├── abrasive.ts               # existing — pattern to mirror for hygroscopicity
│   ├── hygroscopicity.ts         # NEW — resolveHygroscopicityClass, resolveMoistureRisk
│   ├── pricingInterlink.ts       # existing — priceFromMargin reused for reprice Apply
│   ├── repriceAlert.ts           # NEW — pure scan: (oldAsset, newAsset, jobs, targetMargin) → affected[]
│   ├── periodRange.ts            # existing — pattern to mirror for tax-year window
│   ├── taxThreshold.ts           # NEW — resolveTaxYearRange, threshold table, progress calc
│   └── salesReportAggregates.ts  # existing — convert() pattern reused for tax revenue sum
├── components/
│   ├── AssetLibrary.tsx          # EXTENDED — save-handler hook, MaterialRow badge, edit-modal Spool section
│   ├── PrintQuoteModal.tsx       # EXTENDED — variants section
│   ├── RepriceReviewModal.tsx    # NEW — shared <Modal> for D-03's affected-jobs list
│   └── insights/
│       ├── InsightsPanel.tsx     # EXTENDED — tax card slot
│       └── TaxThresholdCard.tsx  # NEW
├── pdf/
│   └── generateQuotePdf.ts       # EXTENDED — renderLineItems variant branch
├── hooks/
│   └── useDatabase.ts            # EXTENDED — no new hook needed; existing updateAsset/updateJob/useUserProfile suffice
└── features.ts                   # EXTENDED — 4 new featureReleases entries
```

### Pattern 1: Override-aware auto-detect resolver (mirror `abrasive.ts` for hygroscopicity)

**What:** A pure function pair — `detectX` (pattern match, no override) and `resolveX` (override-aware) — exactly like `detectIsAbrasive`/`resolveIsAbrasive`.
**When to use:** D-11's hygroscopicity class needs the identical shape: auto-detect from `filamentType`/`name`, with an explicit per-material override (`Asset.hygroscopicityOverride?: 'HIGH' | 'MEDIUM' | 'LOW'`, undefined = auto-detect).
**Example (existing code to mirror, not to modify):**
```typescript
// Source: src/utils/abrasive.ts (verified in this repo, 2026-07-09)
export function resolveIsAbrasive(asset: Pick<Asset, 'filamentType' | 'name' | 'isAbrasive'>): boolean {
  if (asset.isAbrasive !== undefined) return asset.isAbrasive;
  return detectIsAbrasive(asset.filamentType, asset.name);
}
```
**Key gap to note:** `FilamentType` (src/types.ts) has **no plain "Nylon"/"PA" entry** — only `'PA6-CF'` and `'PPA-CF'` (both carbon-fiber nylon variants), and the default catalog (`src/data/defaultMaterials.ts`) ships **zero nylon rows at all**. A hygroscopicity classifier that only switches on `FilamentType` will silently classify every plain-nylon spool as `'Other'` → LOW/undefined. The classifier MUST also pattern-match on `asset.name` (substrings like "nylon", "PA6", "PA12", "PA11") exactly as `ABRASIVE_PATTERNS` does for "CF|GF|carbon|glass|glow|metal" — do not rely on `filamentType` alone.

### Pattern 2: Reuse existing pricing math for the reprice suggestion (D-04)

**What:** `priceFromMargin(trueCost, marginPercent, fee)` in `src/utils/pricingInterlink.ts` already computes `price = (trueCost + fixedFees) / (1 - pctFees - margin/100)`, which reduces to the CONTEXT.md-specified `new_price = new_true_cost / (1 - target_margin)` exactly when `fee = NO_FEE` (the function's own default).
**When to use:** For the reprice review modal's per-job suggested price. Do NOT hand-roll the formula — call `priceFromMargin(newTrueCost, userProfile.defaultProfitMargin ?? 30)`.
**Example:**
```typescript
// Source: src/utils/pricingInterlink.ts (verified in this repo, 2026-07-09)
export function priceFromMargin(trueCost: number, marginPercent: number, fee: FeeShape = NO_FEE): { price: number; netProfit: number } {
  const clampedMargin = Math.min(marginPercent, MARGIN_CAP);
  const denom = Math.max(1 - fee.pctFees - clampedMargin / 100, DENOM_EPSILON);
  const price = (trueCost + fee.fixedFees) / denom;
  const netProfit = price - trueCost - (fee.fixedFees + price * fee.pctFees);
  return { price, netProfit };
}
```
**Consideration:** the current reprice-alert scope (D-01/D-02) is material-price-only, not marketplace-fee-aware — pass `fee = NO_FEE` (the default) unless the plan explicitly wants fee-aware suggestions, which is out of CONTEXT.md's locked scope.

### Pattern 3: Reconstructing a job's true cost outside `CostCalculator.tsx` (precedent for the reprice scan)

**What:** `reconcileFixedCostsAtSave` in `src/db/backfill.ts` (lines ~519-600) is a pure, Dexie-agnostic function that reconstructs part of a `PrintJob`'s cost snapshot (`depreciation`, `nozzleWear`) from stored job fields + current `PrinterInstance`/`PrinterConfig`/`Material[]` data — the exact shape of problem the reprice scan faces (recompute `costPerUnit` for a job using an *updated* material price).
**When to use:** The reprice scan (D-01) needs to recompute `trueCost` for every job that references the changed material, then compare against `job.sellingPrice` via `marginFromPrice` (also in `pricingInterlink.ts`) to get the new margin. This requires assembling a `CalcInput` (or a narrower subset) from the stored `PrintJob.filaments` array + the full `materials: Material[]` list — mirror the read-only reconstruction style of `reconcileFixedCostsAtSave`, not a live `CostCalculator` re-render.
**Filament-row nuance:** `FilamentUsage.pricePerGram` is a **per-row user override** — `undefined` falls back to the asset's `costPerUnit`. A job is only "affected" by a material price change if at least one of its `filaments[]` rows (a) references the changed `materialId` AND (b) has `pricePerGram === undefined` (i.e., it was using the live asset price, not a frozen override). Rows with an explicit `pricePerGram` are insulated from the price change by design — the scan must check this per CONTEXT.md's "multi-material jobs: affected if ANY filament's price changed" discretion note, refined to exclude override-pinned rows.
**Example structure:**
```typescript
// Source: src/db/backfill.ts reconcileFixedCostsAtSave (verified in this repo, 2026-07-09)
// Mirror this shape for the new repriceAlert.ts module:
export function reconcileFixedCostsAtSave(
  jobs: PrintJob[],
  printerInstances: PrinterInstance[],
  printers: PrinterConfig[],
  materials: Material[],
): PrintJob[] { /* pure reconstruction, no Dexie import */ }
```

### Pattern 4: Pure jurisdiction-aware date-range resolver (mirror `periodRange.ts`)

**What:** `resolveDateRange(mode, parts)` in `src/utils/periodRange.ts` is a pure function returning `{ start: Date, end: Date, label: string }` — already the shared implementation for both the Reports tab and the Insights tab (Phase 40 D-04).
**When to use:** D-14's jurisdiction-aware tax year needs the identical shape: `resolveTaxYearRange(jurisdiction, referenceDate = new Date())` → `{ start, end, label }`, using the fixed lookup table (UK Apr 6, AU Jul 1, US/DE/Other Jan 1).
**Example:**
```typescript
// Source: src/utils/periodRange.ts (verified in this repo, 2026-07-09) — pattern to mirror
export function resolveDateRange(mode: RangeMode, parts: PeriodParts): SalesReportRange {
  if (mode === 'year') {
    return {
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
      label: String(year),
    };
  }
  // ...
}
```
**Do NOT reuse `PeriodPicker` state directly for the tax-year window** — CONTEXT.md's canonical refs explicitly note "tax year ≠ PeriodPicker periods; tracker computes its own jurisdiction-aware window." `PeriodPicker` is for the user-facing Insights date filter; the tax card's window is jurisdiction-derived and independent.

### Pattern 5: Currency-converted revenue sum (mirror `salesReportAggregates.ts`)

**What:** `convert(sale.totalRevenue, sale.currency ?? userCurrency, userCurrency, fxTable)` from `src/utils/fxConvert.ts`, already used inside `computeSalesReport`/`computePerSaleProfit`.
**When to use:** D-15's "gross sale revenue drives the bar" — sum `convert(sale.totalRevenue, ...)` over `Sale[]` filtered to the jurisdiction's tax-year window. This is a **currency conversion**, not a money-math derivation — it does not violate the Phase 40-01 "money math has exactly two homes" rule (`computePerSaleProfit` for historical profit, `calculateCost` for live cost), because the tax card computes **gross revenue**, a different quantity than either of those two, using the same currency-conversion primitive both of them already call.
**Example:**
```typescript
// Source: src/utils/salesReportAggregates.ts (verified in this repo, 2026-07-09) — pattern to mirror
const g = convert(sale.totalRevenue, from, userCurrency, fxTable);
```

### Anti-Patterns to Avoid
- **Forking pricing math:** never write a second `new_price = ...` formula anywhere — always call `priceFromMargin`/`marginFromPrice` from `pricingInterlink.ts` (Pitfall C-03 lineage: PERF-11 desync class).
- **Auto-repricing saved jobs:** the reprice Apply is explicit, per-job, and writes through the existing `updateJob` hook (D-04) — never bulk-mutate `job.sellingPrice` from inside the scan itself.
- **New Dexie store for spools:** D-09 locks the "asset IS the active spool" model — do not introduce a `spools` store this phase.
- **Threading new insight/lifecycle state through `App.tsx` props:** `AssetLibrary` and `InsightsPanel` already own their own Dexie subscriptions (`useAssets`, `useJobs`, `useAllSales`, `useUserProfile`) — extend those, do not add new props to the parent.
- **Reusing `PeriodPicker`'s range for the tax year:** explicitly wrong per CONTEXT.md — build a separate jurisdiction-derived window.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Suggested reprice selling price | A new `newTrueCost / (1 - margin)` formula | `priceFromMargin()` in `pricingInterlink.ts` | Already handles the margin-cap/epsilon edge cases; forking it re-opens the PERF-11/C-03 desync failure class |
| Toast notifications | A hand-rolled `fixed` div toast | `useToast()` from `src/components/ui/toast/` | LIVE on main; the shared queue, auto-dismiss, and portal viewport already exist |
| Job cost reconstruction for the reprice scan | A parallel copy of `CostCalculator.tsx`'s pricing `useMemo` | Mirror `reconcileFixedCostsAtSave`'s reconstruction style, calling into `costCalc.ts`'s pure functions | `costCalc.ts` is the single pure-math source; the component's `useMemo` is not reusable outside React render |
| Tax-year date math | Hand-written `if (jurisdiction === 'UK') { ... }` scattered across the card component | A single `resolveTaxYearRange()` pure util, mirroring `resolveDateRange()` | Keeps the date logic testable in isolation and out of JSX |
| Currency-converted revenue sum | A second FX conversion helper | `convert()` from `src/utils/fxConvert.ts` | Single conversion primitive already used by every money-aggregation path in the app |
| Abrasive-style override UI | A new Select-pattern from scratch | Mirror the existing `abrasiveOverrideId` Select block in `AssetLibrary.tsx` (lines ~1345-1368) verbatim in structure | Established, tested UX pattern for "Auto-detect (X) / Yes / No"-shaped overrides |

**Key insight:** every one of the four features in this phase has a near-identical existing pattern already shipped in Phases 22.1, 39, and 40. The highest-risk mistake is re-deriving something that already exists in `costCalc.ts`/`pricingInterlink.ts`/`periodRange.ts`/`fxConvert.ts`/`abrasive.ts` instead of importing it.

## Common Pitfalls

### Pitfall 1: FilamentType has no plain-nylon entry — hygroscopicity classifier must match on name, not just type
**What goes wrong:** A classifier written to switch only on `FilamentType` (`'PA6-CF'`/`'PPA-CF'` → HIGH, else → auto by type) will silently misclassify every plain nylon spool (name contains "Nylon" or "PA12" but `filamentType` is unset or `'Other'`) as LOW/undefined risk.
**Why it happens:** The codebase's `FilamentType` union (src/types.ts) only has CF-nylon variants; there is no bare Nylon/PA entry, and the default catalog ships zero nylon rows, so this gap is easy to miss without reading the type union first.
**How to avoid:** Pattern-match on `asset.name` (substrings: "nylon", "pa6", "pa12", "pa11", "polyamide") in addition to `filamentType`, exactly mirroring `ABRASIVE_PATTERNS`'s dual match in `abrasive.ts`.
**Warning signs:** A hygroscopicity resolver function with only a `switch (filamentType)` and no `name.match(...)` fallback.

### Pitfall 2: Reprice scan must exclude filament rows with a `pricePerGram` override
**What goes wrong:** Flagging a job as "affected" purely because it references the changed `materialId`, without checking `FilamentUsage.pricePerGram`, will incorrectly flag jobs that pinned their own price and are therefore unaffected by the asset's new list price.
**Why it happens:** `FilamentUsage.pricePerGram` (types.ts:241) is an easy-to-miss per-row override field — `undefined` means "use the live asset price," a set value means "frozen, ignore future asset price changes."
**How to avoid:** The scan's affected-row predicate must be `filaments.some(f => f.filamentId === changedMaterialId && f.pricePerGram === undefined)`.
**Warning signs:** A reprice-affected count that includes jobs the user manually overrode a filament price on.

### Pitfall 3: `renderLineItems` in `generateQuotePdf.ts` currently hardcodes a single qty=1 row
**What goes wrong:** The existing `renderLineItems` function (generateQuotePdf.ts:129-162) always renders exactly one row at `qty=1` — there is no branch for multiple tiers. A naive extension might try to loop `autoTable`'s `body` without also updating the "Description"/layout assumptions baked into `renderTotals`/`renderMetaAndCustomer`, which read only `quote.lineItemsSnapshot` (the single-tier snapshot).
**Why it happens:** D-17 G4's strict by-value-snapshot rule (`generateQuotePdf(quote: Quote)` single-argument signature) means the variants data must live on `Quote` itself (a new optional `variantsSnapshot` field per D-08), and `_buildDoc`'s render pipeline (`renderHeader → renderMetaAndCustomer → renderLineItems → renderTotals → ...`) needs `renderLineItems` (and potentially `renderTotals`) to branch on whether `variantsSnapshot` is present.
**How to avoid:** Add `Quote.variantsSnapshot?: { quantities: number[]; discountsPercent: number[]; unitPrices: number[] }` (by-value, computed at Generate time per D-08), and give `renderLineItems` an early branch: if `quote.variantsSnapshot` is present, render an `autoTable` with one row per tier (Qty / Unit Price / Amount) instead of the single collapsed row. Keep `renderTotals` reading `lineItemsSnapshot` for the base/qty=1 figures unless the plan decides variants also need their own "totals" treatment (Claude's Discretion per CONTEXT.md — layout is open).
**Warning signs:** A PDF that renders correctly for non-variant quotes but silently ignores the variants data because `renderLineItems` was never touched.

### Pitfall 4: `backupExport.ts`'s `DATE_FIELDS['materials']` is currently `[]` — new Date-typed lifecycle fields must be added
**What goes wrong:** If `openedAt` (and any drying-log timestamps) are stored as `Date` objects on `Asset`, and `DATE_FIELDS.materials` is not updated to list them, the backup restore path will NOT rehydrate them from ISO strings back into `Date` objects — they will silently stay as strings, breaking any `daysSince()` arithmetic downstream on a restored backup.
**Why it happens:** `backupSchema.ts`'s `DATE_FIELDS` is an explicit per-store allowlist (deliberately not a blanket ISO-string reviver, per its own doc comment) — a new Date field on an existing store is invisible to restore unless someone remembers to list it.
**How to avoid:** When adding `Asset.openedAt` and any drying-log entry dates, add the field name(s) to `DATE_FIELDS.materials` in `src/utils/backupSchema.ts` in the same plan/task that adds the field to `Asset`. Note: `buildBackupFile`/`downloadBackup` in `backupExport.ts` itself need NO change (they already iterate `BACKUP_STORES` generically) — only the restore-side `DATE_FIELDS` map needs the addition.
**Warning signs:** A restored backup where every spool shows "opened 20776 days ago" (epoch-string-as-number) or a moisture badge that never updates after restore.

### Pitfall 5: Moisture-risk day-thresholds have no single industry-standard value — sources disagree by 2-10x
**What goes wrong:** Treating any single source's number as ground truth risks either a badge that cries "HIGH RISK" on day 1 for every nylon spool (alarm fatigue) or one that stays LOW for weeks past the point where prints are actually failing.
**Why it happens:** Moisture absorption rate depends heavily on ambient humidity, which the app has no sensor data for (Anti-Feature, correctly declined). Published guidance ranges from "nylon saturates in 24 hours" (worst-case, near-saturated humid room) to "nylon reaches problematic levels in 3-5 days at 50% RH" to the milestone research's own "4-8 hours" figure — all directionally consistent (nylon fastest, PETG/TPU middle, PLA slowest) but numerically inconsistent.
**How to avoid:** Ship a defensible, cited, conservative-middle table (below) with the same "data current as of" + informational framing already established for the tax card — moisture risk is guidance, not lab-measured fact, and should read as such in any tooltip copy.
**Warning signs:** Marketing copy or UI text that states a moisture-risk day count as a hard fact rather than "typically" / "consider drying."

## Code Examples

### Sourced day-threshold table for moisture risk (closes CONTEXT.md D-11 research gap)

`.planning/research/FEATURES.md` §5 gives **hours-to-saturation** figures (Nylon 4-8h, PETG 12-24h, PLA resistant) but — as CONTEXT.md flagged — no **days-since-opened → HIGH/MEDIUM/LOW** mapping, which is what the UI badge needs. Live web research (2026-07-09) surfaced a range of published figures per hygroscopicity class:

| Class (D-11 mapping) | Sourced guidance | Confidence |
|---|---|---|
| HIGH (Nylon/PA — matched by name, no plain FilamentType exists) | "Saturation in ~24h of open-air exposure" (filamentcheatsheet.com); "problematic in 50% RH within 3-5 days" (multiple sources); milestone research's "4-8h" | MEDIUM — sources disagree 3x |
| MEDIUM (PETG, TPU) | "Reaches noticeable degradation in 3-5 days at 50% RH"; "dry before a critical print if open >1 week" (siraya.tech) | MEDIUM |
| LOW (PLA) | "Problematic in 50% RH within 2-3 weeks"; "degradation over weeks of exposure" | MEDIUM |

`[CITED: Bambu Lab Wiki, Prusa Knowledge Base via search, filamentcheatsheet.com, siraya.tech]` — **recommend the following defensible day-threshold table** as the shipped default (a specific, sourced, conservative-middle choice — not an arbitrary invention, but genuinely MEDIUM confidence and worth a `checkpoint:human-verify`-style confirmation with the user before lock, since published guidance varies 2-3x):

```typescript
// Proposed src/utils/hygroscopicity.ts shape (illustrative — plan owns final numbers)
export type HygroscopicityClass = 'HIGH' | 'MEDIUM' | 'LOW';
export type MoistureRisk = 'HIGH' | 'MEDIUM' | 'LOW';

// Day thresholds derive from the cited guidance above, taking the conservative
// middle of the published ranges per class. Ships with an InfoTooltip noting
// these are general guidance, not lab-measured for the user's specific ambient
// humidity — mirrors the tax card's "data current as of" framing.
const RISK_THRESHOLDS: Record<HygroscopicityClass, { mediumAtDays: number; highAtDays: number }> = {
  HIGH:   { mediumAtDays: 1, highAtDays: 3 },   // Nylon/PA: MEDIUM after 1 day, HIGH after 3
  MEDIUM: { mediumAtDays: 3, highAtDays: 7 },   // PETG/TPU: MEDIUM after 3 days, HIGH after 7
  LOW:    { mediumAtDays: 14, highAtDays: 30 }, // PLA: MEDIUM after 14 days, HIGH after 30
};

export function resolveMoistureRisk(hygroClass: HygroscopicityClass, daysSinceOpened: number): MoistureRisk {
  const t = RISK_THRESHOLDS[hygroClass];
  if (daysSinceOpened >= t.highAtDays) return 'HIGH';
  if (daysSinceOpened >= t.mediumAtDays) return 'MEDIUM';
  return 'LOW';
}
```

**Recommendation for the plan:** surface this as an explicit `checkpoint:human-verify` (or at minimum a discuss-phase confirmation) before lock, since the underlying published data has real variance — this is exactly the kind of "MEDIUM confidence, multiple valid approaches" case the assumptions-log exists for.

### Verified UK trading allowance (closes currency-of-data concern for D-14/D-16)

`[VERIFIED: gov.uk/litrg.org.uk via WebSearch, 2026-07-09]` — the UK £1,000 trading allowance is confirmed current for the 2026/27 tax year (6 April 2026 – 5 April 2027), applied to **gross** income before expenses — matching `.planning/research/FEATURES.md` §6 exactly. No drift since the 2026-07-03 milestone research. The other three jurisdictions (DE €25,000 Kleinunternehmer, AU GST AUD 75,000, US badges-of-trade) were not re-verified numerically in this session (only structurally cross-checked against FEATURES.md) — treat their exact figures as `[CITED: FEATURES.md §6]`, not independently re-verified this session, and carry the "data current as of [date]" disclaimer regardless per D-16 (non-negotiable).

### Tax-year boundary lookup table (D-14, locked shape)

```typescript
// Proposed src/utils/taxThreshold.ts shape (illustrative)
export type Jurisdiction = 'UK' | 'DE' | 'AU' | 'US' | 'OTHER';

// Source: FEATURES.md §6 + live-verified UK figure (2026-07-09).
const TAX_YEAR_START: Record<Jurisdiction, { month: number; day: number }> = {
  UK: { month: 3, day: 6 },   // April 6 (0-indexed month)
  AU: { month: 6, day: 1 },   // July 1
  DE: { month: 0, day: 1 },   // January 1
  US: { month: 0, day: 1 },   // January 1
  OTHER: { month: 0, day: 1 }, // Calendar year default for custom jurisdictions
};

const THRESHOLDS: Record<Exclude<Jurisdiction, 'US' | 'OTHER'>, { amount: number; currency: string; label: string }> = {
  UK: { amount: 1000, currency: 'GBP', label: 'Trading Allowance' },
  DE: { amount: 25000, currency: 'EUR', label: 'Kleinunternehmer threshold' },
  AU: { amount: 75000, currency: 'AUD', label: 'GST registration threshold' },
};
// US: no fixed-dollar threshold — informational "badges of trade" note only, no progress bar (D-16).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Static failure-rate guess only | Empirical failure log (Phase 39) | 2026-07-06 (Phase 39) | Not directly relevant to Phase 41, but establishes the "log event → derive rate → suggest, never auto-apply" pattern that D-04's reprice Apply should mirror |
| Manual TOU cost entry only | TOU bands feeding calculator (Phase 39) | 2026-07-06 | Establishes precedent for optional, non-indexed `UserProfile`/`Asset` fields with `undefined = existing default behavior` semantics — same pattern Phase 41's new fields should follow |
| No jurisdiction concept anywhere | This phase introduces `UserProfile.jurisdiction` | Phase 41 | First jurisdiction-aware feature in the app; sets precedent for any future multi-jurisdiction work (Canada is explicitly deferred) |

**Deprecated/outdated:** None — this phase adds new capability, nothing existing is replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Moisture-risk day-thresholds (HIGH: 1/3 days, MEDIUM: 3/7 days, LOW: 14/30 days) | Code Examples — sourced day-threshold table | Badge could feel either alarmist or too lax; sources vary 2-3x. Low functional risk (display-only, no money math), but should be confirmed with the user before lock per the "no arbitrary numbers" rule and D-11's explicit research-gap flag |
| A2 | DE/AU/US threshold figures not independently re-verified this session (trusted from FEATURES.md §6, dated 2026-07-03) | Code Examples — tax-year boundary table | Regulations could have drifted in the ~1 week since the milestone research; low likelihood given the short window, but the "data current as of" disclaimer (D-16, already locked) covers this regardless |
| A3 | Proposed `Asset.hygroscopicityOverride` field name/shape | Pattern 1 | Naming only — the plan should confirm the exact field name against `types.ts` conventions (mirrors `isAbrasive`'s boolean shape but hygroscopicity is a 3-value enum, so the override field is necessarily a different shape — `'HIGH' | 'MEDIUM' | 'LOW' | undefined'`, not a boolean) |
| A4 | Proposed `Quote.variantsSnapshot` field shape (quantities/discountsPercent/unitPrices arrays) | Pitfall 3 / Architecture Diagram | Exact shape is Claude's Discretion per CONTEXT.md D-08; the plan should finalize field names before implementation, but the by-value-snapshot principle (not a live recompute) is locked |

## Open Questions

1. **Exact hygroscopicity day-thresholds (A1 above)**
   - What we know: directional consensus (Nylon fastest, PETG/TPU middle, PLA slowest) across all sources; the numeric thresholds vary 2-3x between sources.
   - What's unclear: whether the project wants a conservative (alarms early) or lenient (alarms late) default.
   - Recommendation: ship the proposed table above with an `InfoTooltip` disclaiming "general guidance, not measured for your environment," and treat as `checkpoint:human-verify`-worthy before final lock — this mirrors how the tax card already carries a similar disclaimer for a similar reason (published-data variance, not app-measured fact).

2. **Does the reprice scan need to run on FX-rate-adjacent currency changes to non-native-currency assets?**
   - What we know: D-01 locks the scope to "material price save only," explicitly deferring FX-rate-drift scans.
   - What's unclear: whether a material whose `currency` differs from the user's profile currency, and whose *converted* price moves solely due to a currency mismatch at read time (not a stored price edit), should be in scope. CONTEXT.md's D-01 wording implies no — only an explicit price-field edit in the save handler triggers the scan.
   - Recommendation: scope strictly to `packageCost`/`costPerUnit` field changes detected in `handleSubmit` (old material vs new material comparison), not to any FX-driven display delta. This matches D-01's locked wording.

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependencies beyond the existing project toolchain (Node/npm, Vite, Dexie, jsPDF — all already installed and verified working by prior phases 38-40).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing — confirmed via `*.test.ts`/`*.test.tsx` siblings throughout `src/`, e.g. `abrasive.test.ts`, `generateQuotePdf.test.ts`, `PrintQuoteModal.test.tsx`, `useDatabase.test.ts`) |
| Config file | `vite.config.ts` (existing, Vitest configured alongside Vite per project convention) |
| Quick run command | `npm run test -- <path>` (run a single new test file) |
| Full suite command | `npm run test` (or `npx vitest run` — confirm exact script name in `package.json` at plan time) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONN-01 | Reprice scan flags affected jobs correctly (respects `pricePerGram` override exclusion, Pitfall 2) | unit | `npx vitest run src/utils/repriceAlert.test.ts` | ❌ Wave 0 — new file |
| CONN-01 | Suggested price matches `priceFromMargin` output exactly | unit | `npx vitest run src/utils/repriceAlert.test.ts` | ❌ Wave 0 |
| CONN-03 | `generateQuotePdfBytes` renders N tier rows when `variantsSnapshot` present, 1 row when absent (byte-count / autoTable row assertions, mirrors existing `generateQuotePdf.test.ts` style) | unit | `npx vitest run src/pdf/generateQuotePdf.test.ts` | ✅ extend existing file |
| CONN-03 | PrintQuoteModal variants section computes `unitPrice[i]` correctly from discount % | unit/component | `npx vitest run src/components/PrintQuoteModal.test.tsx` | ✅ extend existing file |
| LIFE-01 | `resolveHygroscopicityClass` matches name-substring for nylon (no `FilamentType` entry exists, Pitfall 1) | unit | `npx vitest run src/utils/hygroscopicity.test.ts` | ❌ Wave 0 — new file |
| LIFE-01 | `resolveMoistureRisk` returns correct tier at day boundaries | unit | `npx vitest run src/utils/hygroscopicity.test.ts` | ❌ Wave 0 |
| LIFE-02 | `resolveTaxYearRange` returns correct window per jurisdiction (UK Apr 6, AU Jul 1, DE/US/Other Jan 1) | unit | `npx vitest run src/utils/taxThreshold.test.ts` | ❌ Wave 0 — new file |
| LIFE-02 | Tax revenue sum correctly converts multi-currency sales into home currency for the window | unit | `npx vitest run src/utils/taxThreshold.test.ts` | ❌ Wave 0 |
| ALL | Backup round-trip preserves new `Asset`/`Quote`/`UserProfile` fields (esp. `openedAt` Date rehydration, Pitfall 4) | unit | `npx vitest run src/utils/backupExport.test.ts` | ✅ extend existing file |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched-test-file>`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/repriceAlert.test.ts` — covers CONN-01
- [ ] `src/utils/hygroscopicity.test.ts` — covers LIFE-01
- [ ] `src/utils/taxThreshold.test.ts` — covers LIFE-02
- [ ] No framework install needed — Vitest already configured and used project-wide

## Security Domain

`security_enforcement` not explicitly disabled in `.planning/config.json` (not inspected this session — treat as enabled per default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Free floor, no accounts, no backend this phase |
| V3 Session Management | No | No sessions introduced |
| V4 Access Control | No | Single-user local app; no multi-tenant concern |
| V5 Input Validation | Yes | Discount % fields (0-100 clamp), tax threshold "Other" custom amount (positive number), spool location free-text (existing `Textarea`/`Input` patterns already sanitize via React's default text escaping — no `dangerouslySetInnerHTML` introduced) |
| V6 Cryptography | No | No new secrets/crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Unvalidated numeric input (discount %, custom tax threshold amount) causing `NaN`/negative propagation into PDF or progress bar math | Tampering (self-inflicted, not adversarial — single-user local app) | Mirror existing `Number.isFinite(v) && v >= 0` guards already used throughout `AssetLibrary.tsx`/`PrintQuoteModal.tsx` (e.g. `quoteShippingCost` handler) |
| XSS via free-text spool "location" or drying-log notes rendered unescaped | Tampering/Information Disclosure | React's default JSX text-node escaping already covers this — do not introduce `dangerouslySetInnerHTML` for these fields (none of the existing patterns do) |

No new attack surface: this phase adds no network calls, no new external inputs, no new auth surface, and no crypto. The only genuinely new "input" is user-typed jurisdiction custom-threshold amounts and discount percentages, both purely local numeric fields following existing validation conventions in the codebase.

## Sources

### Primary (HIGH confidence — read directly from this repository, 2026-07-09)
- `src/utils/abrasive.ts` — override-aware auto-detect pattern (Pattern 1)
- `src/utils/pricingInterlink.ts` — `priceFromMargin`/`marginFromPrice` (Pattern 2)
- `src/db/backfill.ts` — `reconcileFixedCostsAtSave` (Pattern 3)
- `src/utils/periodRange.ts` — `resolveDateRange` (Pattern 4)
- `src/utils/salesReportAggregates.ts` + `src/utils/fxConvert.ts` — `convert()` (Pattern 5)
- `src/db/database.ts` — Dexie schema, confirmed at version 12
- `src/types.ts` — `Asset`, `Quote`, `UserProfile`, `Sale`, `FilamentUsage`, `FilamentType` definitions
- `src/utils/backupSchema.ts` / `src/utils/backupExport.ts` — backup coverage + `DATE_FIELDS` gap (Pitfall 4)
- `src/components/AssetLibrary.tsx` — `handleSubmit` save handler, `MaterialRow`, abrasive override UI block
- `src/components/PrintQuoteModal.tsx` — modal structure, `handleGenerateQuote`
- `src/pdf/generateQuotePdf.ts` — `renderLineItems` single-row hardcode (Pitfall 3)
- `src/components/insights/InsightsPanel.tsx` — Insights tab orchestration pattern
- `src/components/ui/toast/*` — `useToast` API shape
- `src/components/SettingsModal.tsx` — existing `targetHourlyRate`/`defaultProfitMargin` settings UI pattern
- `src/features.ts` — NEW-badge registry shape

### Secondary (MEDIUM confidence — WebSearch, verified against/cross-checked with milestone research)
- [Trading allowance | Low Incomes Tax Reform Group](https://www.litrg.org.uk/working/self-employment/trading-allowance) — UK £1,000 threshold, gross-income basis, confirmed current for 2026/27
- [Tax-free allowances on property and trading income - GOV.UK](https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income) — official UK source
- [Filament Cheat Sheet — How to Dry and Store 3D Printing Filament](https://filamentcheatsheet.com/blog/how-to-dry-and-store-filament/) — Nylon 24h saturation figure
- [How to Dry PETG Filament for Perfect Prints — Siraya Tech](https://siraya.tech/blogs/news/how-to-dry-petg) — PETG 1-week guidance

### Tertiary (LOW confidence — cross-cited in WebSearch aggregate, not independently fetched)
- Bambu Lab Wiki filament drying guidance (fetch blocked by paywall in this session — cited via search-result summary only)
- Prusa Knowledge Base drying guidance (not independently fetched this session)
- `.planning/research/FEATURES.md` §5/§6 (2026-07-03 milestone research) — DE/AU/US threshold figures trusted, not re-verified numerically this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all existing patterns read directly from source
- Architecture: HIGH — every integration point (save handler, PDF render pipeline, Insights tab, Asset Library row) verified by reading the actual current code
- Pitfalls: HIGH for code-structural pitfalls (FilamentType gap, pricePerGram override, DATE_FIELDS, renderLineItems hardcode) — all verified by reading source; MEDIUM for the moisture-risk numeric thresholds (genuine source disagreement, flagged as Assumption A1)

**Research date:** 2026-07-09
**Valid until:** 30 days for the code-integration findings (stable, tied to this specific codebase state); the moisture-risk and tax-threshold numeric claims should be re-confirmed with the user at discuss-phase / plan time regardless of date, per the "no arbitrary numbers" rule and their explicit MEDIUM-confidence tagging.
