# Architecture Research

**Domain:** Local-first desktop/PWA cost calculator — v2.0 integration analysis
**Researched:** 2026-07-03
**Confidence:** HIGH — all findings grounded in direct codebase reading (CostCalculator.tsx 1814 LOC, useDatabase.ts 1384 LOC, database.ts v11, App.tsx, types.ts, costCalc.ts)

---

## Existing Architecture (Confirmed from Source)

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  React Router Shell  (main.tsx → LandingPage / /app)        │
├─────────────────────────────────────────────────────────────┤
│  App.tsx  — tab state (useState<Tab>), all Dexie hooks,     │
│             prop-drilling 15+ props into every tab panel    │
├──────────┬──────────┬───────────┬────────────┬─────────────┤
│  Cost    │  Jobs    │  Asset    │ Customers  │  Reports    │
│  Calc    │  Mgr     │  Library  │  Library   │  Section    │
│ 1814 LOC │ 1474 LOC │  (~800)   │  (~400)    │  (~600)     │
├──────────┴──────────┴───────────┴────────────┴─────────────┤
│  useDatabase.ts (1384 LOC) — all Dexie hooks in one file    │
│  useAssets · useJobs · usePrinterInstances · useCustomers   │
│  useQuotes · useAllSales · useUserProfile · useAllSettings  │
├─────────────────────────────────────────────────────────────┤
│  Dexie v11 (IndexedDB)  — 9 stores                         │
│  materials · printerInstances · jobs · sales · settings    │
│  customers · quotes · stockEvents · printers (legacy)      │
├─────────────────────────────────────────────────────────────┤
│  Vercel (web)  /  Tauri 2 (desktop)  /  PWA service worker  │
└─────────────────────────────────────────────────────────────┘
```

### God-Components (Confirmed Sizes)

| File | LOC | Core problem |
|------|-----|-------------|
| `src/components/CostCalculator.tsx` | 1814 | ~25 useState calls, sessionStorage persistence, pricing interlink useEffects, cost derivation useMemos, save flow, break-even, tax, Etsy checklist, filament rows, materials rows, shipping, marketplace — all in one component |
| `src/hooks/useDatabase.ts` | 1384 | All Dexie hooks co-located; 6 process-lifetime `*Ran` flags for one-time reconciles; seed/migration logic interleaved with CRUD |
| `src/components/JobsManager.tsx` | ~1474 | Already decomposed once in v1.3 (extracted RecordSaleModal, SaleRow, useCustomerPicker, useAllSales) but still large |

### Key Architectural Facts That Constrain v2.0 Design

1. **Tab state is not in the URL.** `App.tsx` owns `activeTab` as `useState<Tab>`. Browser Back exits `/app` entirely to the marketing site. React Router is present in `main.tsx` but unused for intra-app navigation.

2. **App.tsx is the single subscriber.** All 12 Dexie hooks run at the App level. Every tab panel receives its data via prop drilling (15+ props into CostCalculator alone). Adding an Insight tab means adding more hooks to App.tsx unless we change the pattern.

3. **`costCalc.ts` is already a clean pure function.** `calculateCost(CalcInput): CostBreakdown` is fully extracted, no React, no Dexie. The `failureRate` field on `CalcInput` is a flat percentage — the seam for the empirical engine already exists.

4. **Display-time FX conversion is the established pattern.** All prices stored in native currency; `useFxRates` + `convert(amount, from, to, fxTable)` converts at render time. This must not be broken by v2.0 additions.

5. **`pricingInterlink.ts` is correct.** The closed-form solvers (`priceFromMargin`, `priceFromProfit`, `marginFromPrice`) are in their own file and unit-tested. The PERF-11 dep-trim regression that was reverted in v1.9 review is a CostCalculator internal problem — the fix belongs in the split, not in pricingInterlink.

6. **Reconcile-legacy-data rule is active.** Every new derived field on an existing stored entity either defaults safely to `undefined` with read-side fallback, or ships with a one-time reconcile helper following the established `*Ran` + WR-01 pattern (flag set only after writes complete).

7. **Dexie schema is at v11.** `src/db/database.ts` defines versions 1 through 11. Any new store requires `db.version(12)`.

8. **No backend exists anywhere.** Vercel deploys are static front-end. Zero server-side code today.

9. **`SeedState` is the established migration flag pattern.** Persisted in `db.settings` as JSON; module-scope flag for within-session dedup. New catalog migrations follow this pattern.

---

## Integration Architecture for v2.0 Features

### 1. CostCalculator God-Component Split

Reading all 1814 lines confirms these concrete extraction boundaries:

**Lines 1–250:** Props interface, session storage helpers, row key utilities, useState declarations (~25 fields)

**Lines 250–350:** Edit-job population effect, printer auto-select effect

**Lines 350–600:** Derived value memos (materials conversion, cost calculation, shipping, packaging, marketplace fees, feeShapeRef, break-even, tax)

**Lines 600–870:** Pricing interlink useEffects (two effects: trueCost-driven and fee-shape-driven)

**Lines 870–1780:** JSX — six visually distinct sections (Job Details, Filaments, Cost Parameters, Shipping, Marketplace/Pricing, Etsy)

**Lines 1780–1814:** Save button + cancel

**Proposed extraction:**

```
CostCalculator.tsx  (1814 LOC)
│
├── useCostForm.ts  (NEW hook — ~150 LOC)
│   Owns: all ~25 useState declarations + sessionStorage persistence effect
│   Returns: typed state object + setters + clearForm()
│   No derived math — purely form state
│
├── useCostDerivedValues.ts  (NEW hook — ~200 LOC) — THE PERF-11 FIX HOME
│   Inputs: form values from useCostForm + materials + electricity + fxTable
│   Owns all useMemos:
│     convertToProfile, materialsInProfile, filamentRowsForCalc
│     costs (via calculateCost), trueCost, fixedCosts
│     shippingCost, packagingCost, totalShippingCost
│     marketplaceFeeParts, marketplaceFee, feeShapeRef
│     breakEvenInfo, taxSource, tax, inheritedTaxRate
│   Owns both pricing interlink useEffects
│   Returns: stable derived-values object
│   WHY PERF-11 FIX WORKS HERE: The effect dep array
│   [trueCost, lastEdited, profitMarginPercent, targetProfit, sellingPrice]
│   is correct in a scoped hook where those are the only reactive values.
│   The "consecutive same-field edit" desync that caused the revert was a
│   consequence of the 1814-LOC component re-rendering for unrelated reasons.
│
├── CostFormSection.tsx  (NEW ~200 LOC)
│   Renders: Print Name, Printer select, Model URL/cost, G-code import
│   Props: form state + setters from useCostForm
│
├── CostParametersSection.tsx  (NEW ~200 LOC)
│   Renders: Print time, failure rate, prep/post time, materials rows
│   v2.0 addition: empirical failure rate hint row
│
├── ShippingSection.tsx  (NEW ~150 LOC)
│   Renders: shipping method, distance, carrier cost, packaging rows
│
├── PricingSection.tsx  (NEW ~250 LOC)
│   Renders: marketplace picker, interlinked price/margin/profit fields, tax row
│
├── CostSummaryPanel.tsx  (NEW ~150 LOC)
│   Renders: cost breakdown table, break-even widget, Etsy section, save button
│
└── CostCalculator.tsx  (BECOMES ~150 LOC orchestrator)
    Imports: useCostForm, useCostDerivedValues
    Owns: editingJob population effect, bannerRef, handleSaveJob
    Renders: editing banner + section components via composition
```

**Build dependency within the split:** useCostForm extracts first (no dependencies). useCostDerivedValues second (depends on form state shape). Section components after both hooks (depend on both). The orchestrator last.

**No Dexie changes required.** Pure component/hook refactor. `FORM_STORAGE_KEY` in sessionStorage stays unchanged. Existing Vitest contracts on `costCalc.ts` are unaffected.

---

### 2. Failure-Cost Engine

**New Dexie store: `failureEvents` — requires `db.version(12)`**

```typescript
// types.ts addition
export interface FailureEvent {
  id: string;
  printerInstanceId: string;
  materialId: string;        // dominant filament used
  failedAt: Date;
  printTimeHours: number;    // hours into the print when it failed
  reason?: string;           // 'stringing' | 'adhesion' | 'mechanical' | 'other' | free text
  costEstimate?: number;     // optional manual wasted-material cost
}
```

```typescript
// database.ts addition
db.version(12).stores({
  // all existing stores unchanged...
  failureEvents: 'id, printerInstanceId, materialId, failedAt',
});
// No upgrade() needed — new empty store
```

**Integration into cost pipeline — the hint layer, not a replacement:**

The existing `PrintJob.failureRate` field is a user-entered flat percentage. The empirical engine adds a suggestion, it does NOT overwrite the user's value:

```
useFailureRate(printerInstanceId, materialId) [NEW hook]
  reads: failureEvents where printerInstanceId + materialId match
  reads: jobs where printerInstanceId + filaments[].filamentId match
  derives: empiricalRate = failureCount / (savedJobCount + failureCount)
  returns: { empiricalRate: number | null, sampleSize: number }

CostParametersSection renders:
  Failure Rate input (user entry, unchanged)
  + hint when sampleSize >= 3:
    "Your X1C prints PLA at 3.2% empirically ({sampleSize} prints) — apply?"
    [Apply] button sets failureRate in form state
```

**costCalc.ts is unchanged.** `calculateCost(CalcInput)` already accepts `failureRate: number`. The empirical engine feeds the input; the pure function is untouched.

**Reconcile rule:** `PrintJob.failureRate` is an input field (user-entered), not a derived snapshot. No backfill needed. Existing jobs keep their manually-entered rate. If v2.0 ever adds `empiricalFailureRateAtSave` as a snapshot field, that would require a reconcile helper with `null` backfill — defer that decision to the implementation phase.

---

### 3. Insight Layer (Hourly Wage, ROI, What-If)

**Pattern: one new tab, thin orchestrator, small focused hooks deriving from existing stores.**

Do not create a God-component. The lesson from CostCalculator is that co-locating all state in one file creates the problem we are now spending a phase to fix.

```
App.tsx: add 'insights' to Tab union type, add tab button
  ↓
InsightsPanel.tsx  (~150 LOC orchestrator)
  ├── WageInsight.tsx
  │   hook: useWageInsight()
  │     reads: jobs (prepTimeMinutes + postProcessingMinutes per job)
  │     reads: sales (sellingPrice per sale, matched to jobs for quantity)
  │     derives: totalLaborHours, totalNetRevenue, effectiveHourlyWage
  │     compares against: userProfile.laborHourlyRate
  │
  ├── ProductRanking.tsx
  │   hook: useProductRanking()
  │     reads: jobs + sales
  │     derives: copiesSold × sellingPrice per job → revenue rank
  │     filter: last N days from URL param (?insights_range=90d)
  │
  ├── PrinterROI.tsx
  │   hook: usePrinterROI(instanceId)
  │     reads: printerInstances, jobs (filtered by printerInstanceId), sales
  │     derives: totalRevenueAttributed, depreciationPaid, paybackProgress
  │
  └── WhatIfSimulator.tsx
      Local state only (no Dexie) — inputs: trueCost from context or URL param
      Allows user to slide margin/price, shows break-even sensitivity
      No new stores; no Dexie subscription
```

**Data flow:** All insight hooks use `useLiveQuery` on existing stores. No new stores for read-only analytics. Pure derivation functions go in `src/utils/insights.ts` (testable, no React).

**Insight hooks do NOT go in App.tsx.** They live inside `InsightsPanel.tsx` and call their hooks directly. App.tsx adds one more panel render to its `activeTab` switch — nothing else.

---

### 4. Backend Seam (Hosted Quote Pages, Pro Tier)

**Core invariant: the free floor is offline/no-account forever.**

The cleanest boundary is: **share-link publish is the only write path into the backend.**

```
Free floor (IndexedDB, unchanged):
  Quote.status = 'sent'  → PDF download (today, unchanged)

Pro hosted (new backend, additive):
  Quote.status = 'published'  [NEW RuntimeQuoteStatus value]
    → POST Quote.lineItemsSnapshot to backend
    → backend returns short URL
    → Quote.publishedUrl saved locally (new optional field on Quote, no version bump)
    → Quote.publishedAt saved locally (new optional field on Quote, no version bump)
```

**Why `lineItemsSnapshot` is the right payload:** It already carries a full by-value snapshot (jobTitle, sellingPrice, shippingCost, resolvedTaxRate, taxAmount, currency, notes, terms). No FK dependencies. The backend can serve a static read-only page from this JSON blob without any understanding of the local schema.

**New optional fields on `Quote` interface (no Dexie version bump needed — optional fields on a JSON entity in IndexedDB are transparent):**

```typescript
// Add to Quote interface in types.ts
publishedUrl?: string;   // returned by backend after successful POST
publishedAt?: Date;      // timestamp of publish action
```

**Auth model — thinnest viable:**

```
Phase 1 (launch): Magic-link email only
  POST /auth/magic-link { email } → one-time token → httpOnly session cookie
  No password storage, no OAuth complexity
  Backend: Vercel Edge Functions + Supabase Auth (built-in magic link)
  Database: Supabase Postgres — one table: hosted_quotes(id, token, snapshot_json, expires_at)

Phase 2 (growth): Add Google OAuth as an alternative
  Never add before magic link is proven working in production
```

**Local → hosted data mapping:**

```
PrintJob (IndexedDB)            → does NOT sync to backend (local only)
Quote.lineItemsSnapshot         → POST to hosted_quotes on explicit publish action
Customer (IndexedDB)            → does NOT sync to backend
UserProfile (IndexedDB)         → Pro account metadata only (name, billing, email)
                                   stored server-side, never synced back down
```

One-way push. Local Dexie is the source of truth. No pull, no merge in v2.0.

**GDPR gate:** The moment any user data leaves the device (publish action), the Pro tier enters GDPR scope. The consent banner (section 6 below) must be deployed before the backend goes live.

---

### 5. Tab-in-URL Routing

**Current state confirmed from App.tsx:** `activeTab` is `useState<Tab>`. React Router `BrowserRouter` wraps the whole app in `main.tsx` but no `useSearchParams` is used. Pressing browser Back at any tab exits `/app` to the marketing site.

**Minimal-change fix: replace `useState<Tab>` with `useSearchParams`**

```typescript
// App.tsx — the only change to this file for this feature
import { useSearchParams } from 'react-router-dom';

// Remove:
const [activeTab, setActiveTab] = useState<Tab>('calculator');
// Add:
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = (searchParams.get('tab') as Tab) ?? 'calculator';
const setActiveTab = useCallback((tab: Tab) => {
  setSearchParams({ tab }, { replace: false });
}, [setSearchParams]);
```

**URL shape:** `/app?tab=calculator` | `/app?tab=jobs` | `/app?tab=insights`

**Why not nested routes (`/app/calculator`):** The current architecture renders all tab panels from one App component that holds all Dexie hooks. Converting to nested routes would require either keeping the God-hook-fetching at a layout level (awkward) or splitting hooks per route (large refactor). Search params are the minimal-invasive migration that fixes the browser-Back bug without a routing architecture overhaul.

**History semantics:**
- `replace: false` on tab changes → each tab is a browser history entry → Back goes to previous tab
- `replace: true` for `handleEditJob` navigation (switching to calculator to edit is not a "real" navigation the user should Back out of; use `setSearchParams({ tab: 'calculator' }, { replace: true })`)

**Keyboard nav:** The existing `handleTablistKeyDown` roving-tabindex logic is unchanged — it calls `setActiveTab(nextTab.id)` which now writes a search param. Behavior is identical.

**OnboardingOverlay URL param:** Use `?onboarding=1` as a separate param alongside the tab: `/app?tab=calculator&onboarding=1`. The wizard overlay reads this param; closing the wizard removes it.

---

### 6. GDPR Consent Layer

**What currently runs without consent:** Vercel Analytics (aggregate, anonymized, low GDPR risk but technically in scope). No other third-party scripts today.

**What requires consent before backend launch:** any API call that sends data off-device (the publish action), any error tracking (Sentry), any analytics beyond Vercel.

**Pattern: consent context + localStorage**

```
src/
├── components/
│   └── CookieConsentBanner.tsx  (~100 LOC)
│       renders: fixed bottom bar on first visit
│       buttons: "Accept all" | "Essential only" | "Manage"
│       on decision: writes ConsentState to localStorage, dispatches storage event
│
├── hooks/
│   └── useConsent.ts  (~40 LOC)
│       reads: ConsentState from localStorage
│       exports: hasConsent(category: ConsentCategory): boolean
│       listens: storage events for cross-tab sync
│
└── utils/
    └── consent.ts  (~30 LOC)
        types: ConsentCategory = 'analytics' | 'functional'
        interface ConsentState { version: 1; decidedAt: string; analytics: boolean; functional: boolean }
        const CONSENT_KEY = 'cookie_consent_v1'
```

**Gating Vercel Analytics in main.tsx:**

```tsx
// main.tsx — current: <Analytics /> is always mounted
// After consent: gate it reactively
import { hasConsent } from './hooks/useConsent';
function AnalyticsGate() {
  const consent = useConsent();
  return consent.analytics ? <Analytics /> : null;
}
```

**GDPR requirements for v2.0 backend launch:**
- Granular opt-in (analytics vs functional, separately)
- Revocable via Settings → Privacy page
- No pre-ticked boxes (opt-in by default is illegal in EU)
- Privacy Policy page on marketing site
- Terms of Service page on marketing site

**Tauri desktop:** Banner is web-only (`{!__IS_TAURI__ && <CookieConsentBanner />}`). Desktop users do not participate in browser analytics.

**Timing:** Deploy consent infrastructure before any backend call that touches user data. It can ship earlier — even just gating Vercel Analytics — to establish the pattern and satisfy users in strict-consent jurisdictions (DE, FR, NL) before it becomes legally urgent.

---

### 7. Onboarding Wizard

**First-run detection — no new Dexie version bump needed.**

`UserProfile` is stored as JSON in `db.settings` (key `'userProfile'`). Adding optional fields to the JSON shape requires no Dexie version bump:

```typescript
// Add to UserProfile in types.ts (optional — backward compatible)
onboardingStep?: number;          // last completed step; undefined = not started
onboardingCompletedAt?: string;   // ISO date; if present, wizard never shows
```

The existing `updateUserProfile` hook in useDatabase.ts writes these via `setUserProfile`. No new hooks needed.

**Overlay vs route:** Overlay. Reasons:
- The wizard needs to highlight actual UI underneath (point at the Printers tab, the Asset Library, the calculator)
- A route would require duplicating the Dexie hook subscriptions or lifting them further up the tree
- An overlay can use `?onboarding=1` URL param (see section 5) for resumability without a dedicated route

**Resumability:** The wizard reads `userProfile.onboardingStep` on mount and renders the correct step. If the user closes the browser mid-wizard, the next session resumes from `onboardingStep`. Completing all steps writes `onboardingCompletedAt` and removes the `?onboarding=1` param.

**Component structure:**

```
src/components/onboarding/
  OnboardingOverlay.tsx      (~150 LOC) — fixed overlay, reads onboardingStep, renders steps
  OnboardingStep.tsx         (~80 LOC) — reusable step card with progress, title, next button
  useOnboarding.ts           (~50 LOC) — reads onboardingStep, writes via updateUserProfile
```

The overlay mounts in `App.tsx` immediately after `<ToastProvider>`, reads `userProfile.onboardingCompletedAt` from the already-subscribed `useUserProfile` hook (no extra subscription needed).

**Suggested steps (to be confirmed at plan phase):**
1. Currency + region (sets userProfile.currency, address.country)
2. Add your first printer (navigates to `?tab=settings`)
3. Add a filament (navigates to `?tab=materials`)
4. Price your first print (navigates to `?tab=calculator`)
5. Done — surfaces the "share" or "save job" CTA

---

### 8. File-Based Sync (Multi-Device Without Backend)

**What is realistic vs not for v2.0:**

The existing schema has 9 stores with complex relationships, by-value snapshots (Quotes, Customer on Sale), append-only ledgers (stockEvents), and the reconcile-legacy-data rule. A full CRDT implementation would take months and risks correctness regressions. The "good enough" solution for v2.0 is explicit user-action merge.

**Recommended approach: structured JSON export/import with last-write-wins per record**

```typescript
// Extend existing backup format in src/utils/backup.ts
export interface SyncExport {
  exportedAt: string;           // ISO — used to detect which file is newer
  deviceId: string;             // random UUID stored in localStorage, stable per device
  schemaVersion: number;        // db.verno at export time
  data: {
    jobs: PrintJob[];
    sales: Sale[];
    quotes: Quote[];
    customers: Customer[];
    materials: Asset[];
    printerInstances: PrinterInstance[];
    stockEvents: StockEvent[];
    settings: { key: string; value: string }[];   // EXCLUDES seedState key
  };
}
```

**Merge strategy per store:**

| Store | Merge rule | Rationale |
|-------|-----------|-----------|
| `jobs`, `sales`, `quotes`, `customers` | Incoming `updatedAt` > local `updatedAt` → put; else skip | By-value snapshots are never edited retroactively; last-write-wins is correct |
| `printerInstances` | Same as above | `printHours` is the critical field; last write wins |
| `materials` | Put by id, always | Material edits are low-stakes; the user would see incoming catalog updates |
| `stockEvents` | Union by id; never overwrite | Append-only ledger; dedup by id is correct and safe |
| `settings` | Per key; local wins for `seedState`, `fxRateTable`; incoming wins for user-set values | SeedState flags must never be overwritten by an import (would re-run migrations) |

**Conflict documentation:** Two devices editing the same job's `sellingPrice` simultaneously → last-write-wins is wrong but acceptable for v2.0. Document the limitation: "Editing the same job on two devices before syncing may lose changes from the earlier device." CRDT semantics are a v3.0 consideration.

**What to NOT build in v2.0:**
- Auto-sync via watched folder (Tauri-only, complex, adds an always-on background process)
- Conflict UI or three-way merge
- Real-time sync (requires the backend)

**User-facing flow:** "Export to sync file" (saves `.3dcoster-sync.json`) on device A → user copies file to device B (AirDrop, USB, cloud storage of their choice) → "Import from sync file" on device B runs the merge. Market as "multi-device without a cloud account — you control the file."

---

## Recommended Project Structure for New v2.0 Files

```
src/
├── components/
│   ├── calculator/              (NEW — CostCalculator extraction)
│   │   ├── CostCalculator.tsx   (orchestrator, shrinks to ~150 LOC)
│   │   ├── CostFormSection.tsx
│   │   ├── CostParametersSection.tsx
│   │   ├── ShippingSection.tsx
│   │   ├── PricingSection.tsx
│   │   └── CostSummaryPanel.tsx
│   ├── insights/                (NEW)
│   │   ├── InsightsPanel.tsx
│   │   ├── WageInsight.tsx
│   │   ├── ProductRanking.tsx
│   │   ├── PrinterROI.tsx
│   │   └── WhatIfSimulator.tsx
│   └── onboarding/              (NEW)
│       ├── OnboardingOverlay.tsx
│       └── OnboardingStep.tsx
│
├── hooks/
│   ├── useCostForm.ts           (NEW — extracted from CostCalculator)
│   ├── useCostDerivedValues.ts  (NEW — extracted from CostCalculator, PERF-11 fix)
│   ├── useFailureRate.ts        (NEW — empirical failure rate from failureEvents)
│   ├── useWageInsight.ts        (NEW)
│   ├── useProductRanking.ts     (NEW)
│   ├── usePrinterROI.ts         (NEW)
│   ├── useOnboarding.ts         (NEW)
│   ├── useConsent.ts            (NEW)
│   └── useDatabase.ts           (MODIFIED — add useFailureEvents; consider splitting
│                                  into per-domain files once further hooks are added)
│
└── utils/
    ├── insights.ts              (NEW — pure derivation functions for insight hooks)
    ├── consent.ts               (NEW — ConsentState type + localStorage helpers)
    ├── costCalc.ts              (MODIFIED — add new cost inputs for TOU electricity,
    │                             abrasive wear; existing CalcInput fields unchanged)
    └── syncMerge.ts             (NEW — last-write-wins merge logic for file-based sync)
```

---

## Suggested Build Order

Feature dependencies determine sequencing. Wave notation groups work that can proceed in parallel within a wave.

### Wave 1 — Foundation (blocks all new UI)

1. **Tab-in-URL routing** — one targeted change in `App.tsx` (`useState` → `useSearchParams`); must land before any new tab is added; fixes the browser-Back bug before users experience it on the new Insight tab. No other feature blocks this.

2. **CostCalculator God-component split** — extract `useCostForm` first (no deps), then `useCostDerivedValues` (the PERF-11 fix, deps on useCostForm), then section components, then the orchestrator. No behavior change. This gates: PERF-11 close, clean surface for adding failure-cost hint row in Wave 2, correct dep array for the pricing interlink.

### Wave 2 — Cost Realism (the moat; all free floor)

3. **Failure-cost engine** — new `failureEvents` store (`db.version(12)`), `useFailureRate` hook, hint UI in `CostParametersSection`. Depends on CostCalculator split (section component must exist to add the hint row to).

4. **Time-of-use electricity + abrasive wear + maintenance amortization** — extends `CalcInput` in `costCalc.ts` with new fields; new UI inputs in `CostParametersSection`. Depends on CostCalculator split. Can run in parallel with failure-cost engine.

### Wave 3 — Insight Layer (depends on tab-in-URL, needs real data from existing jobs)

5. **Insight tab + hooks** — `InsightsPanel`, `useWageInsight`, `useProductRanking`, `usePrinterROI`. Depends on tab-in-URL (Tab union type needs 'insights'). Can start immediately after Wave 1.

6. **What-if simulator** — pure local state; no new Dexie dependency; ships as part of the Insight tab or immediately after.

### Wave 4 — Connected Cost (benefits from Wave 2 data quality)

7. **Filament-price reprice alerts** — reads `materials` + `jobs`; new `useRepriceAlerts` hook. No new stores.

8. **Spool lifecycle / moisture tracking** — extends `StockEvent` with new event kinds, or adds a thin new store. New UI in Asset Library.

### Wave 5 — GDPR + Onboarding (must precede backend launch)

9. **GDPR consent banner + Privacy Policy + ToS pages** — self-contained; no Dexie dependency; must ship before Wave 6.

10. **Onboarding wizard** — depends on tab-in-URL (wizard navigates between tabs by setting the `?tab=` param); depends on consent being in place for any analytics gate inside the wizard. Can run in parallel with Wave 4.

### Wave 6 — Backend Launch (depends on GDPR consent being live in production)

11. **Pro backend infrastructure** — Supabase Auth (magic-link), `hosted_quotes` table, Edge Functions for publish + serve. Depends on Wave 5 (GDPR gate must be live first).

12. **Instant-quote share link UI** — new `[Share]` button in `PrintQuoteModal`, posts `Quote.lineItemsSnapshot` to backend, stores `publishedUrl` on the local Quote record. Depends on backend being live.

13. **Marketing site redesign** (`test/design-skills-experiment` branch) — merge alongside or immediately after backend launch.

### Wave 7 — File-Based Sync (independent; no backend dependency)

14. **File-based sync** — extends existing backup/restore flow; can ship at any point after the schema is stable (after Wave 2 at earliest, to include failureEvents in the sync format).

---

## Component Boundaries Map (New vs Modified)

| Component / Hook | Status | Owns | v2.0 Change |
|-----------------|--------|------|-------------|
| `App.tsx` | MODIFIED | Tab routing, global hook subscriptions | Replace `useState<Tab>` with `useSearchParams`; add 'insights' to Tab union; mount `OnboardingOverlay` |
| `CostCalculator.tsx` | REFACTORED | Orchestrates form + derived values + save | Shrinks to ~150 LOC orchestrator; imports useCostForm + useCostDerivedValues |
| `useCostForm.ts` | NEW | All form useState declarations + sessionStorage | Extracted from CostCalculator |
| `useCostDerivedValues.ts` | NEW | All useMemos + pricing interlink effects | Extracted from CostCalculator; PERF-11 fix |
| `CostParametersSection.tsx` | NEW | Print time, failure rate, prep/post, materials | Add empirical failure rate hint in Wave 2 |
| `useDatabase.ts` | MODIFIED | All Dexie CRUD hooks | Add `useFailureEvents` hook; consider splitting into domain files (useJobsDb.ts, useAssetsDb.ts, etc.) once the file exceeds ~1600 LOC |
| `costCalc.ts` | MODIFIED | Pure cost math | Add new CalcInput fields (TOU electricity, abrasive wear) in Wave 2; existing fields unchanged; `calculateCost` stays pure |
| `InsightsPanel.tsx` | NEW | Insight tab orchestrator | New |
| `useWageInsight.ts` | NEW | Hourly wage derivation | Reads jobs + sales; no new stores |
| `useProductRanking.ts` | NEW | Revenue rank per product | Reads jobs + sales; no new stores |
| `usePrinterROI.ts` | NEW | Printer payback progress | Reads printerInstances + jobs + sales; no new stores |
| `insights.ts` (utils) | NEW | Pure derivation functions | Testable, no React |
| `OnboardingOverlay.tsx` | NEW | First-run wizard overlay | Mounts in App.tsx; reads userProfile.onboardingStep |
| `useOnboarding.ts` | NEW | Wizard state + profile writes | Thin wrapper over updateUserProfile |
| `CookieConsentBanner.tsx` | NEW | Consent UI | Web-only (`!__IS_TAURI__`) |
| `useConsent.ts` | NEW | Consent state reads | localStorage; gating layer for analytics + backend |
| `consent.ts` (utils) | NEW | ConsentState type + helpers | Pure |
| `syncMerge.ts` (utils) | NEW | File-based sync merge logic | Last-write-wins per store; pure; testable |

---

## Data Flow Changes

### Existing flows (unchanged)

```
User input → CostCalculator useState → calculateCost() → CostBreakdown → render
                    ↓
             sessionStorage (form persistence)
                    ↓
             onSaveJob → db.jobs.put (IndexedDB)
```

### New in v2.0

```
Failure event logged manually
  → db.failureEvents (v12 store)
  → useFailureRate(printerInstanceId, materialId)
  → empiricalRate derived (not stored)
  → hint shown in CostParametersSection

Jobs + Sales
  → useWageInsight → effectiveHourlyWage
  → useProductRanking → revenue rank per product
  → usePrinterROI → payback progress
  All in InsightsPanel (read-only; no Dexie writes)

URL ?tab=X
  → App.tsx reads searchParams.get('tab')
  → renders correct panel

URL ?onboarding=1
  → OnboardingOverlay mounts on top of current panel
  → reads userProfile.onboardingStep
  → writes step progress via updateUserProfile

Quote (local, status='sent')
  → Pro: POST /api/quotes { snapshot: Quote.lineItemsSnapshot, token }
  → backend stores in hosted_quotes table
  → returns { url: 'https://3dcoster.com/q/xyz123' }
  → locally: db.quotes.put({ ...quote, publishedUrl: url, publishedAt: now })
  → Quote.status updated to 'published' (new RuntimeQuoteStatus value)

SyncExport.json (created by user)
  → syncMerge(localDb, incomingExport) → last-write-wins per store
  → db.transaction('rw', all-stores) → bulkPut winners
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding More Props to App.tsx

**What people do:** Add the failure events hook, insight hooks, and consent hook to App.tsx and pass them as props into every tab panel.

**Why it's wrong:** App.tsx already prop-drills 15+ values into CostCalculator. The pattern is at its structural limit. Every new hook added here widens every tab panel's props interface, even panels that don't use the data.

**Do this instead:** Individual panels own their own hooks. `InsightsPanel.tsx` calls `useWageInsight()` directly. The CostCalculator orchestrator (after the split) calls `useFailureRate()` directly. App.tsx owns only what must be genuinely shared across multiple tabs (assets, userProfile, fxTable) — same rule as today.

### Anti-Pattern 2: Storing Derived Insight Values in Dexie

**What people do:** Pre-compute hourly wage, product ranking, printer ROI into a new Dexie store for fast reads.

**Why it's wrong:** Derived values go stale. Dexie indexes cannot auto-update derived stores when source stores change. Maintaining a materialized view requires invalidation logic, reconcile helpers, and migration gates — all the complexity of caching with none of the index benefits (these datasets are too small to benefit).

**Do this instead:** Derive in `useMemo` inside insight hooks. `useLiveQuery` on source stores gives reactive updates automatically. Pure derivation is testable in Vitest without Dexie.

### Anti-Pattern 3: Making the Backend a Sync Target

**What people do:** Build two-way sync: local Dexie ↔ Supabase. Every job save pushes to the backend, every page load pulls.

**Why it's wrong:** This codebase has 9 Dexie stores with complex relationships (quotes FK jobs FK printerInstances), by-value snapshots that must never mutate, and an append-only ledger. Two-way sync requires CRDT semantics or optimistic locking for every entity, across every future schema migration. The reconcile-legacy-data rule alone would require careful audit of every sync endpoint.

**Do this instead:** Backend is publish-only in v2.0. `Quote.lineItemsSnapshot` (self-contained, no FK) is the only payload. Local data is authoritative. File-based sync handles multi-device for the free tier.

### Anti-Pattern 4: Breaking the Reconcile-Legacy-Data Rule for Insight Fields

**What people do:** Add `empiricalFailureRateAtSave` to `PrintJob` as a new snapshot field, only populating it going forward.

**Why it's wrong:** Old jobs with `undefined` cause silent rendering bugs in the insight layer (a wage chart that shows $0 for 80% of a user's history). The v1.9 audit caught this pattern repeatedly.

**Do this instead:** Use option (a) for insight fields: default safely to `undefined` with read-side fallback that shows "no data" or "not enough history yet" rather than wrong data. Insight hooks already handle sparse data (return `null` when `sampleSize < 3`). Only use the full reconcile helper for correctness fields where `undefined` would produce an incorrect calculation.

---

## Sources

All findings are from direct inspection of the current codebase (2026-07-03, branch `v1.9-hardening`):

- `src/components/CostCalculator.tsx` (read lines 1–870, 1700–1814 — full structure confirmed)
- `src/hooks/useDatabase.ts` (read lines 1–500, 1284–1384 — all hooks confirmed)
- `src/db/database.ts` (read lines 1–399 — v1 through v11 confirmed, v11 is the last)
- `src/types.ts` (read lines 1–293 — all interfaces confirmed)
- `src/utils/costCalc.ts` (read fully — pure function interface confirmed)
- `src/App.tsx` (read fully — tab state pattern confirmed, React Router imports confirmed)
- `.planning/PROJECT.md` (v2.0 scope decision, PERF-11 deferral note)

*Architecture research for: 3DCoster v2.0 Cost-Truth & Insight integration*
*Researched: 2026-07-03*
