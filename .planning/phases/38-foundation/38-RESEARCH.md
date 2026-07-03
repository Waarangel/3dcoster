# Phase 38: Foundation - Research

**Researched:** 2026-07-03
**Domain:** React 19 component decomposition (God-component split), `useEffect`/`useReducer` pricing-interlink correctness, React Router `useSearchParams` tab-in-URL routing — inside an existing local-first Vite + Dexie + Tauri 2 codebase
**Confidence:** HIGH — every finding is grounded in direct reading of the actual source files being modified (`CostCalculator.tsx` full 1815 lines, `pricingInterlink.ts`, `costCalc.ts`, `App.tsx`, `main.tsx`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`, `JobsManager.test.tsx`), not inference.

## Summary

This phase splits the 1,815-LOC `CostCalculator.tsx` God-component into `useCostForm` + `useCostDerivedValues` + section components with zero behavioral change, fixes the PERF-11 pricing-desync class of bug for good inside the new architecture, and moves the active app tab into the URL via `useSearchParams`. All three requirements are now cross-validated against the live code, not just the milestone-level research done 2026-07-03 before any file was opened.

The milestone research (`ARCHITECTURE.md`, `PITFALLS.md`, `SUMMARY.md`) already did the heavy lifting of reading this codebase and is correct in its major claims — the extraction boundaries, the tab-in-URL minimal-diff design, and the PERF-11 root-cause analysis all check out against the actual file contents read in this session. This document adds the details the milestone research necessarily omitted at synthesis level: the exact current dep arrays and eslint-disable comments that must be dissolved, the project's actual component-test harness (no `@testing-library/react` — pure `react-dom/client` + `act`), the confirmed `eslint-plugin-react-hooks@7.0.1` already-active `exhaustive-deps` rule, and the confirmed fact that `main.tsx`/`vite.config.ts` need zero changes for tab-in-URL to work on both web and Tauri.

**Primary recommendation:** Extract `useCostForm` (pure form state) first, then `useCostDerivedValues` as a `useReducer`-based hook that owns the pricing interlink as a single synchronous reducer transition (eliminating the `feeShapeRef`-plus-two-`useEffect`s architecture entirely, not just relocating it), then six section components, then shrink the orchestrator. Gate the whole split behind output-equivalence tests captured from the CURRENT component via the project's existing `createRoot`/`act` harness (no new test library needed) before deleting a single line of the original file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Form state (~25 fields, sessionStorage persistence) | Browser / Client (React state) | — | Pure UI state, no server involvement; already local-only |
| Derived cost math (`calculateCost`, `trueCost`, `fixedCosts`, `breakEvenInfo`) | Browser / Client (React hook, calls pure util) | — | `costCalc.ts` is already a pure, framework-free function; the hook layer only wires reactive inputs to it |
| Pricing interlink (margin ↔ profit ↔ price) | Browser / Client (React hook state machine) | — | Client-only reactive derivation; `pricingInterlink.ts` pure functions already exist and stay untouched |
| Tab navigation state | Browser / Client (URL via React Router) | — | `BrowserRouter` already wraps both web and Tauri renders (`main.tsx`); `useSearchParams` is a client-only routing concern, no SSR involved |
| Job persistence (save/update) | Browser / Client → Database/Storage (IndexedDB via Dexie) | — | Existing `onSaveJob`/`onUpdateJob` props call into `useDatabase.ts` hooks; untouched by this phase |
| Section component rendering | Browser / Client | — | Pure presentational split; no new data-fetching boundary introduced |

This phase touches only the Browser/Client tier. No backend, no SSR, no CDN/static changes. The map is included primarily to confirm to the planner that no task in this phase should introduce a server round-trip or a new persistence boundary — everything here is a client-side refactor.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | CostCalculator (1,815 LOC) split along researched seams (useCostForm, useCostDerivedValues, ~4-6 presentational sections), zero behavioral change, gated by output-equivalence tests | See "Extraction Boundaries — Verified Against Live Source" and "Output-Equivalence Test Strategy" below. Confirms exact line ranges, all 25 state fields, and the sessionStorage/editingJob effects that must survive the split unchanged. |
| FOUND-02 | Pricing double-render per keystroke eliminated inside the split architecture (`useReducer`/event-handler pattern, `exhaustive-deps` at error level) | See "The PERF-11 Fix — useReducer Design" below. Confirms the current two-`useEffect` + `feeShapeRef` architecture line-by-line and provides a concrete `useReducer` replacement that removes the ref-escape-hatch entirely. |
| FOUND-03 | Active app tab lives in the URL (`useSearchParams`), browser Back/Forward navigates tabs, PWA start_url and bookmarks keep working | See "Tab-in-URL — Verified Zero-Touch on main.tsx/vite.config.ts" below. Confirms `BrowserRouter` already wraps both the Tauri and web render trees so no routing-shell change is needed, and confirms the PWA manifest's `start_url: '/'` is unaffected by the D-06 bare-`/app` decision. |
</phase_requirements>

## Standard Stack

### Core (already installed — no new runtime dependencies)

| Library | Version (confirmed via `npm ls`) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.0 | Component/hook layer | Already the project's framework; `useReducer`, `useSearchParams`-consuming components, and custom hooks are all React 19-native, no new API surface needed |
| react-router-dom | ^7.17.0 | `useSearchParams` for tab-in-URL | Already wraps the whole app via `BrowserRouter` in `main.tsx`; v7's `useSearchParams` API is stable and unchanged from the v6 API the milestone research assumed |
| eslint-plugin-react-hooks | ^7.0.1 [VERIFIED: npm ls] | `exhaustive-deps` enforcement (D-14) | **Already installed and already active** — `rules-of-hooks` and `exhaustive-deps` are in the `recommended` flat config with no override, meaning they are already ERROR level project-wide today. Only the newer React-Compiler-adjacent rules (`set-state-in-effect`, `refs`, `purity`, `globals`) are downgraded to `warn` in `eslint.config.js`. D-14's "scoped to the new calculator folder" ask requires no new eslint config — the existing rule already applies at error level to every `.tsx`/`.ts` file, calculator folder included. |
| vitest | ^4.1.4 | Test runner | Existing infra; `coverage.include` in `vitest.config.ts` is currently scoped to `src/utils/costCalc.ts` only — the planner should decide whether to widen this for the new `useCostDerivedValues.ts` hook (recommend yes, since it inherits the correctness-critical pricing math). |

### Supporting — NOT needed (deliberately excluded)

| Library | Why NOT added |
|---------|----------------|
| @testing-library/react | **Confirmed absent** via `npm ls` (empty result). The project's established component-test pattern (`JobsManager.test.tsx`, `PrintQuoteModal.test.tsx`) mounts components directly with `react-dom/client`'s `createRoot` + `act` from `react`, drives interaction via native DOM `.click()`/event dispatch, and asserts via `vi.fn()` spy call counts or DOM text content — not RTL's `screen`/`userEvent`. Adding RTL now would introduce a second, inconsistent test idiom mid-codebase for a phase whose explicit goal is risk reduction. The output-equivalence and render-count tests (D-04, D-15) should use the **existing** `createRoot`/`act` pattern. See "Test Harness — Match the Existing Pattern" below. |
| @testing-library/user-event | Same rationale — not installed, not the project's pattern; native DOM events fired inside `act()` already exercise real `input`/`change` event listeners identically for the purposes of the sequence tests D-04 requires. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useReducer` for the pricing interlink | Keep `useEffect` + `feeShapeRef`, just move it into `useCostDerivedValues` unchanged | Rejected per FOUND-02's explicit mandate and PITFALLS.md C-03: relocating the effect without changing its shape reproduces the exact stale-closure risk class that caused PERF-11. A reducer's transition is a single synchronous pure function — no dep-array curation, no ref-escape-hatch needed to dodge "locked" deps. |
| Project's `createRoot`/`act` harness | `@testing-library/react` `render()` | Rejected to avoid a second test idiom (see above) and because the milestone explicitly scopes this phase to "zero behavioral change" — introducing a new test dependency is out of scope for a foundation phase whose job is risk reduction, not tooling migration. |

**Installation:** None required — every library used in this phase is already a `dependencies`/`devDependencies` entry in `package.json`.

**Version verification:** `npm ls eslint-plugin-react-hooks react-router-dom dexie dexie-react-hooks vitest` run 2026-07-03 confirms: `eslint-plugin-react-hooks@7.0.1`, `react-router-dom@7.17.0`, `dexie@4.2.1`, `dexie-react-hooks@4.2.0`, `vitest@4.1.4`. `npm ls @testing-library/react @testing-library/user-event @testing-library/jest-dom` returns empty (not installed). [VERIFIED: npm ls]

## Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** All work uses libraries already present in `package.json` and confirmed via `npm ls` above. No `slopcheck` run was needed since no `npm install` occurs in this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ main.tsx — BrowserRouter (UNCHANGED)                            │
│   Tauri:  "/" and "/app" both → <App/>                          │
│   Web:    "/" → LandingPage,  "/app" → <App/>                   │
└───────────────────────────┬───────────────────────────────────-─┘
                             │
┌────────────────────────────▼──────────────────────────────────┐
│ App.tsx                                                         │
│   BEFORE: const [activeTab, setActiveTab] = useState<Tab>(...)  │
│   AFTER:  const [searchParams, setSearchParams] =                │
│              useSearchParams()                                  │
│           activeTab = searchParams.get('tab') ?? 'calculator'   │
│   All 12 Dexie hooks still called here (UNCHANGED — no new       │
│   subscriptions move in this phase)                              │
└───────────────┬───────────────────────────────────────────────-┘
                │ props (unchanged prop surface)
┌────────────────▼────────────────────────────────────────────────┐
│ calculator/CostCalculator.tsx  (orchestrator, ~150-200 LOC)      │
│   imports useCostForm() ────────────┐                            │
│   imports useCostDerivedValues() ───┼─── both consume form state │
│   owns: editingJob population effect, bannerRef, handleSaveJob   │
│   renders 4-6 section components via composition                │
└──┬────────────────────────────────────────────────────────────-─┘
   │
   ├─▶ useCostForm.ts          (~150 LOC) — 25 useState fields +
   │                              sessionStorage persist effect,
   │                              NO derived math
   │
   ├─▶ useCostDerivedValues.ts (~200-250 LOC) — THE PERF-11 FIX HOME
   │      Input: form state (from useCostForm) + materials + fxTable
   │      useMemo chain: materialsInProfile → costs (calculateCost)
   │        → trueCost → fixedCosts → breakEvenInfo → taxSource/tax
   │      useReducer: pricingReducer(state, action) — single state
   │        machine replacing BOTH useEffects + feeShapeRef
   │      Returns: { costs, trueCost, fixedCosts, breakEvenInfo,
   │                 pricing: {sellingPrice, targetProfit,
   │                 profitMarginPercent}, dispatchPricing }
   │
   ├─▶ CostFormSection.tsx      — Print Name, Printer select,
   │                               Model URL/cost, G-code import
   ├─▶ CostParametersSection    — Print time, failure rate, prep/post
   │                               time, materials rows
   ├─▶ ShippingSection.tsx      — shipping method/distance/cost,
   │                               packaging rows
   ├─▶ PricingSection.tsx       — marketplace picker, interlinked
   │                               price/margin/profit fields, tax row
   └─▶ CostSummaryPanel.tsx     — cost breakdown, break-even widget,
                                   Etsy section, save button
```

A reader can trace the primary use case (user types in a pricing field → new price/margin/profit render) by following: `PricingSection` input `onChange` → `dispatchPricing({type:'EDIT_MARGIN', value})` → `useCostDerivedValues`'s reducer computes new `{sellingPrice, targetProfit, profitMarginPercent}` synchronously in one transition → re-render with the new values. No `useEffect` round-trip, no second render pass.

### Extraction Boundaries — Verified Against Live Source

Reading `CostCalculator.tsx` in full (1815 lines) confirms ARCHITECTURE.md's line-range claims are accurate. The concrete inventory the planner needs:

**State owned by `useCostForm` (lines 162-244, ~19 `useState` calls + 2 helper closures):**
`printName`, `filamentRows` (+ `addFilamentRow`/`removeFilamentRow`/`updateFilamentRow`), `selectedInstanceId`, `printTimeHours`, `modelCost`, `modelCostPerUnit`, `authorMinPrice`, `modelUrl`, `prepTimeMinutes`, `postProcessingMinutes`, `failureRate`, `materialsUsed`, `profitMarginPercent`, `targetProfit`, `sellingPrice`, `lastEdited`, `taxRateOverride`, `shippingMethod`, `shippingDistanceKm`, `shippingOverrideCost`, `packagingMaterials`, `marketplace`, `etsyChecks`. All are seeded via `getStoredValue(key, default)` reading `sessionStorage[FORM_STORAGE_KEY]` — this helper (lines 43-55) and the `FORM_STORAGE_KEY` constant (line 40) must move into `useCostForm.ts` unchanged.

**Effects that must move with the form state (`useCostForm`):**
- The sessionStorage persistence effect (lines 249-284) — depends on all 23 form fields plus `editingJob`; fires on every field change, skips when `editingJob` is truthy.
- The editingJob-population effect (lines 287-337) — has an existing `// eslint-disable-next-line react-hooks/exhaustive-deps` on line 336, keyed only on `[editingJob]`. **This eslint-disable is a pre-existing exception, not new debt** — it exists because the effect intentionally does NOT want to re-run when `materials` or `userCurrency` change (only when the user selects a different job to edit). D-14 ("exhaustive-deps at error for the new calculator folder") does not mean deleting this disable; it means no *new* undisclosed disables are introduced during the split. Document this one's continuation explicitly in the plan.
- The printer auto-select effect (lines 341-351) — depends on `[printerInstances, selectedInstanceId, editingJob]`, no existing disable.

**Derived-value memos that must move to `useCostDerivedValues` (lines 367-610, ~15 `useMemo`/`useCallback` blocks):**
`convertToProfile` (useCallback, line 130), `materialsInProfile` (line 138), `shippingCost` (line 367), `packagingCost` (line 409), `totalShippingCost` (plain const, line 418), `availableMarketplaces` (line 421 — arguably UI-list-only, candidate for staying in `PricingSection` since it derives only from `userCurrency`, not form state — planner should confirm), `marketplaceFeeParts`/`marketplaceFee` (line 447), `feeShapeRef` (line 460 — **eliminated** by the `useReducer` redesign, see below), `availableShippingMethods` (line 464 — same UI-list-only candidacy as `availableMarketplaces`), `filamentRowsForCalc` (line 504), `costs` (line 516, calls `calculateCost` from `costCalc.ts` — untouched), `trueCost` (plain const, line 542), `fixedCosts` (line 546), `breakEvenInfo` (line 560), `taxSource` (line 584), `tax` (line 594), `inheritedTaxRate` (line 602).

**JSX sections (lines 876-1814), six visually and functionally distinct blocks confirmed by direct read:**
1. Editing banner (876-898) — orchestrator-owned, not a section (tiny, tightly coupled to `bannerRef`/`onCancelEdit`)
2. Print Job Details (900-1173) — G-code import, print name/printer select, model URL/cost, filament rows, print time/failure rate/prep/post minutes → `CostFormSection` + part of `CostParametersSection`
3. Post-Processing Materials (1175-1228) → part of `CostParametersSection`
4. Shipping + Packaging + Marketplace selection (1230-1422) → `ShippingSection`
5. Set Financial Targets (pricing fields + live totals, 1424-1559) → `PricingSection`
6. Cost Breakdown + Fixed Costs + Break-even (1561-1725) → `CostSummaryPanel`
7. Etsy checklist (1727-1775, conditional on `marketplace === 'etsy'`) → part of `CostSummaryPanel` or its own tiny component; low-risk either way
8. Save/Cancel/Clear buttons (1777-1811) — orchestrator-owned (calls `handleSaveJob`, which needs `trueCost`, `fixedCosts`, `filamentRows`, etc. from both hooks)

This confirms D-09's expected "4-6 sections" is realistic: 4 clean sections (`CostFormSection`, `CostParametersSection`, `ShippingSection`, `PricingSection`) plus `CostSummaryPanel`, with the editing-banner and save-button chrome staying in the ~150-200 LOC orchestrator per D-11.

**Nothing else references `CostCalculator` internals.** `App.tsx` passes exactly the 17 props already declared in `CostCalculatorProps` (lines 20-37) and calls nothing else — the external contract does not change in this phase.

### Pattern 1: `useReducer`-based pricing interlink (the PERF-11 fix)

**What:** Replace the current two-`useEffect` + `feeShapeRef` architecture with a single `useReducer` whose reducer function is a pure, synchronous state transition. Every field edit (margin, profit, price, or an indirect trigger like `trueCost` or `marketplaceFeeParts` changing) dispatches an action; the reducer computes the new `{sellingPrice, targetProfit, profitMarginPercent}` triple in one pass using the existing `pricingInterlink.ts` pure functions (`priceFromMargin`, `priceFromProfit`, `marginFromPrice`) — which stay completely untouched, since they are already pure and already unit-tested.

**When to use:** Any time 3+ pieces of state are mutually derived from each other and from external inputs (here: `trueCost`, `marketplaceFeeParts`) with a "last edited wins" precedence rule — this is a textbook `useReducer` case per the project's own React hooks rule ("Use `useReducer` once state transitions are conditional on the previous state or there are 3+ related values").

**Why this fixes PERF-11 structurally, not just by relocation:** The current code (verified, `CostCalculator.tsx` lines 789-852) has TWO separate `useEffect`s computing the exact same three-branch `if (lastEdited === 'margin'/'profit'/'price')` derivation:
- Effect 1 (797-823): dep array `[trueCost, lastEdited, profitMarginPercent, targetProfit, sellingPrice]`, comment explicitly says this array is **"LOCKED"** — this is the exact dep array PERF-11 tried to trim to `[trueCost, lastEdited]` and was reverted for.
- Effect 2 (832-852): dep array `[marketplaceFeeParts.pctFees, marketplaceFeeParts.fixedFees]` with an **existing** `// eslint-disable-next-line react-hooks/exhaustive-deps` (line 851) — this effect intentionally reads `trueCost`/`lastEdited`/pricing state WITHOUT depping on them, relying on Effect 1 to "already own" those triggers.
- A `feeShapeRef` (line 460) exists purely so Effect 1's "locked" dep array doesn't need to include the fee shape — a ref-based escape hatch that lets the effect read a value without depping on it.

This is precisely the anti-pattern class PITFALLS.md C-03 and the project's own `react-hooks` rule file warn about ("Deep Nesting… Avoid `// eslint-disable-next-line react-hooks/exhaustive-deps` in pricing effects — never in pricing effects"). Two effects computing the same derivation from different trigger sets, one of them via a ref to dodge exhaustive-deps, is structurally the double-render-with-desync-risk architecture — it happened to work in production because both effects independently converge on the same math, but every future edit to this file carries a live risk of one effect's dep array silently drifting from the other's, at which point PERF-11 recurs.

**Example (target shape, not verbatim code — planner/implementer should verify exact typing at implementation time):**
```typescript
// Source: React docs (https://react.dev/reference/react/useReducer) +
// project's own react/hooks.md rule ("useReducer once state transitions
// are conditional on previous state or 3+ related values")

type PricingState = {
  sellingPrice: number;
  targetProfit: number;
  profitMarginPercent: number;
  lastEdited: 'margin' | 'profit' | 'price';
};

type PricingAction =
  | { type: 'EDIT_MARGIN'; value: number }
  | { type: 'EDIT_PROFIT'; value: number }
  | { type: 'EDIT_PRICE'; value: number }
  | { type: 'RECALC'; trueCost: number; fee: FeeShape }; // fired when trueCost
                                                            // or fee shape changes
                                                            // but the user didn't
                                                            // touch a pricing field

function pricingReducer(state: PricingState, action: PricingAction, trueCost: number, fee: FeeShape): PricingState {
  if (trueCost <= 0) return state; // matches existing `if (trueCost <= 0) return;` guard
  switch (action.type) {
    case 'EDIT_MARGIN': {
      const { price, netProfit } = priceFromMargin(trueCost, action.value, fee);
      return { sellingPrice: round2(price), targetProfit: round2(netProfit), profitMarginPercent: action.value, lastEdited: 'margin' };
    }
    case 'EDIT_PROFIT': {
      const { price, marginPercent } = priceFromProfit(trueCost, action.value, fee);
      return { sellingPrice: round2(price), targetProfit: action.value, profitMarginPercent: round1(marginPercent), lastEdited: 'profit' };
    }
    case 'EDIT_PRICE': {
      const { netProfit, marginPercent } = marginFromPrice(trueCost, action.value, fee);
      return { sellingPrice: action.value, targetProfit: round2(netProfit), profitMarginPercent: round1(marginPercent), lastEdited: 'price' };
    }
    case 'RECALC': {
      // Re-derive off the CURRENT lastEdited branch — this replaces Effect 2
      // (the marketplace-fee-shape-change trigger) with an explicit dispatch
      // instead of a second effect reading refs.
      switch (state.lastEdited) {
        case 'margin': { const { price, netProfit } = priceFromMargin(trueCost, state.profitMarginPercent, fee); return { ...state, sellingPrice: round2(price), targetProfit: round2(netProfit) }; }
        case 'profit': { const { price, marginPercent } = priceFromProfit(trueCost, state.targetProfit, fee); return { ...state, sellingPrice: round2(price), profitMarginPercent: round1(marginPercent) }; }
        case 'price': { const { netProfit, marginPercent } = marginFromPrice(trueCost, state.sellingPrice, fee); return { ...state, targetProfit: round2(netProfit), profitMarginPercent: round1(marginPercent) }; }
      }
    }
  }
}
```

A `useEffect` with dep array `[trueCost, marketplaceFeeParts.pctFees, marketplaceFeeParts.fixedFees]` dispatches `RECALC` when those external values change — this is the ONE remaining effect, and its dep array is now honest (every value it reads is a dep) with no eslint-disable, because the reducer itself (not a second effect) owns re-deriving off `lastEdited`. Field-level `onChange` handlers dispatch `EDIT_MARGIN`/`EDIT_PROFIT`/`EDIT_PRICE` directly from the event handler — not from an effect at all — which is the React-idiomatic fix the project's own hooks rule already prescribes ("`useEffect` is for synchronizing with external systems… not the right tool for… notifying parents of state changes — call the callback in the event handler").

**Anti-pattern eliminated:** No `feeShapeRef`. No two effects computing the same branch logic. No eslint-disable on the pricing interlink at all — every dependency is either a genuine reducer input or an explicit dispatch action.

### Pattern 2: Tab-in-URL — Verified Zero-Touch on main.tsx/vite.config.ts

**What:** Replace `App.tsx`'s `const [activeTab, setActiveTab] = useState<Tab>('calculator')` (line 42) with `useSearchParams()`.

**Confirmed from direct read of `main.tsx`:** `BrowserRouter` already wraps the entire render tree for BOTH platforms. The Tauri branch renders `<Route path="/" element={<App/>} />` AND `<Route path="/app" element={<App/>} />` — both already inside the same `BrowserRouter`. The web branch renders `<Route path="/app" element={<App/>} />` inside the same `BrowserRouter`. `useSearchParams` is a `react-router-dom` hook that works identically wherever `BrowserRouter` (or any Router) is an ancestor — **no changes to `main.tsx` are needed for D-08 (one code path for web and Tauri)**. This was ARCHITECTURE.md's claim and it is now directly confirmed by reading the file, not inferred.

**Confirmed from direct read of `vite.config.ts`:** The PWA manifest sets `start_url: '/'` and `scope: '/'`, not `/app`. D-06 ("bare `/app` = calculator tab, no normalization redirect") does not conflict with this — `start_url: '/'` for a Tauri/web PWA install lands on `/`, which for Tauri renders `<App/>` directly and for web renders `LandingPage`. Neither path touches `/app?tab=`. **No manifest change is required by this phase.** (PITFALLS.md M-02 raises a hypothetical `start_url` conflict under a `/app/calculator` nested-route design — that design was explicitly rejected in ARCHITECTURE.md section 5 in favor of `?tab=` query params specifically to avoid this exact problem. The chosen design sidesteps M-02 entirely; the planner does not need a start_url migration task.)

**Example (verified against the actual `App.tsx` lines being replaced):**
```typescript
// Source: react-router-dom v7 useSearchParams (https://reactrouter.com/api/hooks/useSearchParams)
// Replaces App.tsx line 42: const [activeTab, setActiveTab] = useState<Tab>('calculator');
import { useSearchParams } from 'react-router-dom';

const VALID_TABS: Tab[] = ['calculator', 'jobs', 'materials', 'customers', 'reports', 'settings'];

const [searchParams, setSearchParams] = useSearchParams();
const rawTab = searchParams.get('tab');
const activeTab: Tab = (rawTab && VALID_TABS.includes(rawTab as Tab)) ? (rawTab as Tab) : 'calculator';

// D-07: invalid ?tab= value falls back AND the URL is replaced to bare /app
useEffect(() => {
  if (rawTab && !VALID_TABS.includes(rawTab as Tab)) {
    setSearchParams({}, { replace: true }); // strips the bad param, no history entry
  }
}, [rawTab, setSearchParams]);

const setActiveTab = useCallback((tab: Tab) => {
  // D-05: push semantics — every tab switch is a real history entry
  setSearchParams(tab === 'calculator' ? {} : { tab }, { replace: false });
  // D-06: calculator is the bare-/app alias — omit ?tab= entirely when
  // navigating TO calculator so `/app` and `/app?tab=calculator` both work
  // and Back-to-calculator doesn't leave a redundant ?tab=calculator entry.
}, [setSearchParams]);
```

The existing `handleTablistKeyDown` roving-tabindex logic (lines 185-205) calls `setActiveTab(nextTab.id)` — unchanged, since the function signature is identical; only its internal implementation changes from `useState` setter to the wrapped `setSearchParams` call above. The `handleEditJob` call site (line 156-159) that currently does `setActiveTab('calculator')` when jumping into edit mode should use `{ replace: true }` per ARCHITECTURE.md's guidance ("switching to calculator to edit is not a 'real' navigation the user should Back out of") — this requires either an overload or a second setter (e.g., `navigateToTab(tab, {replace: true})`) that the planner should design explicitly as its own task, since D-05's "push per tab switch" and this replace-case are two different call sites with different semantics.

### Recommended Project Structure

```
src/components/calculator/          (NEW folder)
├── CostCalculator.tsx               orchestrator, ~150-200 LOC
├── CostFormSection.tsx
├── CostParametersSection.tsx
├── ShippingSection.tsx
├── PricingSection.tsx
└── CostSummaryPanel.tsx

src/hooks/
├── useCostForm.ts                   NEW — form state + sessionStorage persist
├── useCostDerivedValues.ts          NEW — useMemo chain + useReducer pricing
└── useDatabase.ts                   UNCHANGED in this phase
```

Existing imports of `CostCalculator` (only `App.tsx`) must update their path from `./components/CostCalculator` to `./components/calculator/CostCalculator`. `git mv` or an editor-driven move (not a delete+recreate) preserves file history for the eventual git-blame trail on this correctness-critical code.

### Anti-Patterns to Avoid

- **Adding a third `useEffect` to "help" the reducer:** If a new derived pricing behavior seems to need its own effect, that is a sign it belongs as a reducer action, not a new effect — the entire point of D-14/FOUND-02 is to have exactly one effect (the `RECALC` dispatcher) touching pricing state.
- **Widening `materialsInProfile`/`filamentRowsForCalc` recomputation scope during the split:** These `useMemo`s are correctness-sensitive currency-conversion boundaries (per code comments at lines 120-133). Moving them into `useCostDerivedValues` must preserve their exact dep arrays (`[userCurrency, fxTable]` for `convertToProfile`, etc.) — do not "simplify" them while relocating.
- **Silently dropping the existing `eslint-disable` on the editingJob-population effect (line 336):** That disable is intentional (see above) — removing it and adding `materials`/`userCurrency` to the dep array would change behavior (the form would re-populate from `editingJob` on every currency/materials change, which is not the current behavior and is out of scope for "zero behavioral change").
- **Treating `availableMarketplaces`/`availableShippingMethods` as pricing-critical:** These are UI option lists, not part of the interlink math — don't route them through the reducer or `useCostDerivedValues`; they can stay as simple `useMemo`s local to `PricingSection`/`ShippingSection` if that reduces prop-drilling, since they derive only from `userCurrency` and `shippingConfig.customCarriers` (props already available to those sections).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interlinked derived pricing state (3+ mutually-dependent fields) | A new custom "sync engine" or additional refs/effects | `useReducer` (React built-in) | This is the textbook use case per both React's own docs and the project's own hooks rule file; no library needed, and it is the one the milestone research already converged on |
| Detecting whether a query param is a valid enum value | Ad-hoc string matching scattered across the component | A single `VALID_TABS.includes()` guard co-located with the `Tab` type | Keeps D-07's fallback/replace logic in one place, testable in isolation |
| Component render-count assertions | A custom render-counting HOC or global mutable counter | A `useRef`-based counter incremented in the render body of the section component under test, read via the exported test-only prop, OR a `vi.fn()` render-tracking wrapper — see "Render-Count Regression Test" below | The project already uses `vi.fn()` call-count assertions extensively (`JobsManager.test.tsx`); reuse that idiom rather than inventing a new counting mechanism |

**Key insight:** Every "don't hand-roll" item in this phase resolves to "use what's already in React or already established in this codebase's test suite" — this phase introduces zero new abstractions beyond what FOUND-02 explicitly names (`useReducer`).

## Common Pitfalls

### Pitfall 1: Relocating the two-effect architecture instead of replacing it

**What goes wrong:** The split extracts `useCostDerivedValues` and moves both existing `useEffect`s into it verbatim, keeping the `feeShapeRef` escape hatch. Tests pass (they test the same behavior, now in a new file). PERF-11's exact failure mode remains latent — a future edit to either effect's dep array can re-desync pricing, and nothing about the split itself prevented it.

**Why it happens:** "Split the file" reads as a mechanical extraction task; "fix PERF-11 architecturally" is a design task. Under time pressure, the mechanical version looks done (LOC moved, tests green) while the architectural fix (FOUND-02's actual mandate) is skipped.

**How to avoid:** Treat `useReducer` as a hard requirement of this phase, not a nice-to-have — FOUND-02's exact wording specifies `useReducer`/event-handler pattern. The output-equivalence tests (below) must include the exact PERF-11 repro sequence (same-field rapid re-edit) as a first-class test case, not an afterthought.

**Warning signs:** Any `// eslint-disable-next-line react-hooks/exhaustive-deps` appears on a *new* effect inside `useCostDerivedValues.ts` (the one pre-existing disable on the editingJob effect in `useCostForm.ts` is expected and documented above — a NEW one on pricing logic is the red flag).

### Pitfall 2: Output-equivalence fixtures captured after the refactor, not before

**What goes wrong:** D-01 requires fixtures captured from the CURRENT component BEFORE any code changes. If the plan sequences "extract hooks" before "capture fixtures," the fixtures would be generated from partially-refactored code, defeating their entire purpose as an independent oracle.

**Why it happens:** It's tempting to write fixtures alongside the new hooks since "you're already in the code." But fixtures generated from code you're simultaneously modifying can't catch regressions in that same modification.

**How to avoid:** Sequence the plan so fixture capture is Wave/Task 1, against the untouched `CostCalculator.tsx`, committed to the fixture files before any extraction begins. This mirrors D-01's explicit wording ("Feed N input scenarios to the CURRENT CostCalculator and record all outputs into fixture files").

**Warning signs:** A fixture file's git history shows it was added in the same commit as `useCostForm.ts`/`useCostDerivedValues.ts` rather than before them.

### Pitfall 3: Assuming `@testing-library/react` is available for the sequence/render-count tests

**What goes wrong:** D-04 and D-15 both describe "userEvent-driven" and RTL-flavored testing language. A planner or implementer unfamiliar with this specific codebase's conventions could reach for `@testing-library/user-event`/`screen`, triggering an `npm install` mid-phase for a foundation phase that should introduce zero new dependencies.

**Why it happens:** RTL is the default assumption for "React component testing" industry-wide (see the org's own `react/testing.md` rule file, which recommends RTL as "the standard"). This project is a deliberate, longstanding exception — confirmed by `npm ls` returning empty and by the actual pattern in `JobsManager.test.tsx`, `PrintQuoteModal.test.tsx`, etc.

**How to avoid:** Use the project's existing `createRoot` + `act` + native DOM event pattern (see "Test Harness" below) for both the sequence tests and the render-count test. This is a **deliberate documented deviation from the org's default React testing rule**, justified because (a) the project has an established, working alternative pattern across dozens of existing test files, and (b) introducing RTL now would fragment the test suite's idiom for a phase whose stated goal is risk *reduction*.

**Warning signs:** A `package.json` diff for this phase includes `@testing-library/*` entries.

### Pitfall 4: Render-count assertions violating the org's own anti-pattern guidance without acknowledging the tradeoff

**What goes wrong:** The org's `react/testing.md` rule explicitly lists "Asserting on number of renders — implementation detail" under Anti-Patterns. D-15 explicitly requires exactly this ("pricing sections render exactly once per keystroke, asserted in CI"). Left unaddressed, a future code-reviewer or the `code-reviewer` agent could flag the render-count test as violating org convention and ask to remove it.

**Why it happens:** The general rule (avoid brittle render-count coupling to implementation) is sound advice for typical component tests. This is not a typical case — PERF-11 is a proven, previously-shipped-then-reverted regression whose *only* prior detection mechanism was human code review, not any automated test, specifically because 819 passing tests (including behavior-level tests) did not catch it.

**How to avoid:** Frame the render-count test explicitly as a deliberate, narrow, documented exception in the plan/task description: "This assertion targets a specific historical regression class (PERF-11) that behavior-level tests provably do not catch; it is not a general house style for this codebase." Keep the assertion narrow (one specific interaction path — rapid same-field re-edit — not a blanket render-count gate on every component).

**Warning signs:** The render-count test is written generically ("component X renders N times") without a comment tying it to the PERF-11 regression it exists to pin.

### Pitfall 5: Breaking the "locked" no-marketplace-path invariant during the reducer rewrite

**What goes wrong:** `pricingInterlink.ts`'s own header comment states the no-marketplace case (`pctFees=0, fixedFees=0`) must reduce EXACTLY to the pre-fee-aware math. If the reducer redesign accidentally changes rounding order, or applies the fee shape even when `marketplace === 'none'`, previously-correct no-marketplace calculations silently shift by fractions of a cent — exactly the kind of drift D-03's "rendered string" comparison exists to catch.

**Why it happens:** Refactoring the effect-to-reducer conversion focuses attention on the marketplace-fee-aware branches (the interesting, PERF-11-prone code); the "boring" zero-fee default path gets less scrutiny even though it's the majority of real usage (most users have `marketplace: 'none'`).

**How to avoid:** Include explicit no-marketplace scenarios in both the curated fixture set (D-02) and the sequence tests (D-04) — don't let "multi-material + marketplace fees" scenarios crowd out the plain default-path cases.

**Warning signs:** All 15-20 curated fixtures involve a non-`'none'` marketplace.

## Code Examples

### Test Harness — Match the Existing Pattern (verified from `JobsManager.test.tsx`)

```typescript
// Source: src/components/JobsManager.test.tsx (existing project pattern, lines 1-2, 114-118)
// This is the harness to reuse for D-01/D-04/D-15 — NOT @testing-library/react.
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) { act(() => { root!.unmount(); }); root = null; }
  container.remove();
});

it('example: mounting + reading rendered text', async () => {
  await act(async () => {
    root!.render(<SomeComponent {...props} />);
  });
  const text = container.querySelector('[data-testid="selling-price"]')?.textContent;
  expect(text).toBe('$12.47'); // D-03: compare the RENDERED STRING, not the float
});

it('example: driving a native input change inside act (D-04 sequence test)', async () => {
  const input = container.querySelector('#profit-margin-input') as HTMLInputElement;
  await act(async () => {
    // Native DOM event dispatch — the project's established alternative to userEvent.type()
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    nativeSetter.call(input, '35');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // assert on rendered strings after each keystroke-equivalent dispatch
});
```

### Fixture Generation — Reuse the `makeCalcInput` Pattern

```typescript
// Source: src/utils/costCalc.test.ts (existing project pattern, confirmed via grep)
// The 15-20 curated + ~100 seeded-random fixtures (D-02) should build on this
// existing factory rather than inventing a new one — costCalc.test.ts already
// has a `makeCalcInput(overrides: Partial<CalcInput> = {})` helper for
// building baseline CalcInput objects with only relevant fields overridden.
import type { CalcInput } from '../../utils/costCalc';

function makeCalcInput(overrides: Partial<CalcInput> = {}): CalcInput {
  // ...existing baseline defaults...
  return { /* ...defaults..., */ ...overrides };
}

// For the CostCalculator-level fixtures (not costCalc.ts-level), the
// equivalent factory should build full CostCalculatorProps, since the
// component-level surface (marketplace, tax, currency conversion) is broader
// than calculateCost()'s pure-function surface.
```

### `useReducer` Pricing Interlink

See "Pattern 1" above for the full worked example — reproduced here as the canonical code reference for the plan's task descriptions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Two `useEffect`s + `feeShapeRef` computing the pricing interlink, one with a locked dep array and one with an eslint-disable | Single `useReducer` with explicit dispatch actions from event handlers, plus one effect (`RECALC` dispatcher) with an honest, unsuppressed dep array | This phase (38) | Eliminates the structural cause of PERF-11's failure class; removes the only `react-hooks/exhaustive-deps` suppression in the pricing-critical path |
| `useState<Tab>` for active app tab | `useSearchParams()` | This phase (38) | Browser Back/Forward navigates tabs instead of exiting `/app` to the marketing site; tab state becomes bookmarkable/shareable |
| Single 1,815-LOC `CostCalculator.tsx` | `calculator/` folder: 1 orchestrator (~150-200 LOC) + 2 hooks + 4-6 section components | This phase (38) | Clean seams for Phase 39's failure-rate hint row and TOU/wear inputs to attach without re-opening a 1,815-LOC file |

**Deprecated/outdated:** None — this phase modernizes internal architecture of a component that has no external API consumers beyond `App.tsx`, so there is no deprecation-notice or migration-window concern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `availableMarketplaces`/`availableShippingMethods` are safe to keep local to their section components rather than routing through `useCostDerivedValues` | Anti-Patterns to Avoid | LOW — if wrong, the fix is a trivial prop-drilling adjustment during implementation; no correctness risk either way since these are option lists, not derived pricing math |
| A2 | Widening `vitest.config.ts` `coverage.include` to add `useCostDerivedValues.ts` is desirable but not mandated by any locked decision | Standard Stack | LOW — purely a coverage-reporting nicety; omitting it does not affect correctness, only visibility into test coverage of the new file |
| A3 | The `handleEditJob` → calculator tab navigation should use `{ replace: true }` per ARCHITECTURE.md's reasoning, but this is not explicitly one of CONTEXT.md's locked D-05/D-06/D-07/D-08 decisions | Pattern 2 | MEDIUM — if the planner instead pushes a history entry for edit-navigation, Back from an edit-in-progress would return to the previous tab rather than canceling the edit; this is a UX nuance CONTEXT.md did not explicitly lock, so it should be confirmed with the user or decided at Claude's discretion per CONTEXT.md's discretion section, not silently assumed |

**All three assumptions above are LOW-MEDIUM risk implementation-detail judgment calls, not open questions about the phase's core architecture** — the core FOUND-01/02/03 mechanics (extraction boundaries, `useReducer` design, `useSearchParams` wiring) are all HIGH confidence, directly verified against source.

## Open Questions

1. **Exact section-component boundary for `availableMarketplaces`/`availableShippingMethods`/Etsy checklist**
   - What we know: These three JSX/logic blocks don't cleanly map to exactly one of the 4 core sections named in CONTEXT.md D-09 ("job details, materials/slots, printer & time, cost parameters, pricing, results").
   - What's unclear: Whether the Etsy checklist becomes its own micro-component (7th file) or stays folded into `CostSummaryPanel` as conditional JSX.
   - Recommendation: Leave this as an implementation-time decision per D-09's explicit framing ("not a contract") — the planner should note it as a task-level judgment call, not block on it.

2. **Whether the `RECALC` effect's dep array needs `marketplace` (the string) in addition to `marketplaceFeeParts.pctFees`/`.fixedFees`**
   - What we know: The current code deliberately keys Effect 2 on the fee SHAPE (pct + fixed), not the platform string, "so identical-fee platforms don't churn" (existing comment, line 828-829).
   - What's unclear: Whether this optimization is worth preserving in the reducer redesign, or whether it's premature optimization that the `useReducer` rewrite should drop for simplicity (since `useReducer` transitions are already cheap/synchronous, the churn-avoidance rationale that mattered for effect-based code may matter less here).
   - Recommendation: Preserve the existing behavior (key on fee shape, not platform string) as the default for "zero behavioral change" compliance — this is a `micro-optimization that already exists`, not new complexity being introduced, so removing it would be an unrequested behavior change even if benign.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/components/calculator/ src/hooks/useCostForm.test.ts src/hooks/useCostDerivedValues.test.ts` (once files exist) |
| Full suite command | `npm test` (confirm exact script name in `package.json` — existing pattern per CLAUDE.md's "819 tests" reference) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | Old vs new component produce byte-identical rendered strings for curated + seeded-random fixtures | integration (output-equivalence) | `npx vitest run src/components/calculator/outputEquivalence.test.tsx` | ❌ Wave 0 |
| FOUND-01 | userEvent-equivalent rapid same-field re-edit sequences stay consistent at every step | integration (sequence) | `npx vitest run src/components/calculator/pricingSequence.test.tsx` | ❌ Wave 0 |
| FOUND-02 | Pricing sections render exactly once per keystroke (render-count regression pin) | integration (render-count, deliberate documented exception — see Pitfall 4) | `npx vitest run src/components/calculator/renderCount.test.tsx` | ❌ Wave 0 |
| FOUND-02 | No `react-hooks/exhaustive-deps` suppression exists in the new pricing reducer/effect | static (lint) | `npx eslint src/hooks/useCostDerivedValues.ts` | N/A — lint, not a test file |
| FOUND-03 | `?tab=` reflects active tab; browser Back navigates tabs; invalid `?tab=` falls back + replaces URL | integration | `npx vitest run src/App.test.tsx` (new or extended) | ❌ Wave 0 (no existing `App.test.tsx` found) |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <changed-file-glob>`
- **Per wave merge:** `npm test` (full suite) — must stay green at 819+ tests throughout, per D-13's merge gate
- **Phase gate:** Full suite green + manual UAT script (D-12) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/calculator/outputEquivalence.test.tsx` — covers FOUND-01 (D-01, D-02, D-03)
- [ ] `src/components/calculator/pricingSequence.test.tsx` — covers FOUND-01/FOUND-02 (D-04)
- [ ] `src/components/calculator/renderCount.test.tsx` — covers FOUND-02 (D-15)
- [ ] `src/App.test.tsx` — covers FOUND-03 (no existing App-level test file was found in this codebase — confirm via `find src -iname "App.test.tsx"` before assuming one exists)
- [ ] Fixture data file(s) (e.g. `src/components/calculator/__fixtures__/goldenScenarios.ts`) — the D-01/D-02 curated + seeded-random inputs, captured from the CURRENT component before any extraction begins
- [ ] No new framework install needed — `createRoot`/`act` pattern already available via `react`/`react-dom`, already a project dependency

## Security Domain

**Not applicable for this phase.** This phase is a pure client-side refactor (component decomposition + routing state relocation) with zero new inputs from untrusted sources, zero new network calls, zero new authentication/authorization surface, and zero new data persistence. `security_enforcement` guidance (ASVS categories) is not relevant — there is no new attack surface introduced. Existing input validation on cost-calculator numeric fields is preserved unchanged (this phase does not touch validation logic, only where the state lives).

## Project Constraints (from CLAUDE.md)

- **Action buttons & icons:** Not applicable to this phase's scope — no new Edit/Delete/Remove row actions are introduced by a pure hook/component split.
- **Dev server port:** 4173, pinned in `vite.config.ts` (confirmed) — no change needed for this phase.
- **Desktop release process (CHANGELOG.md, version bumps, code-review gate before `v*` tag):** This phase is explicitly **not tagged for desktop release** per CONTEXT.md D-13 ("No desktop tag in this phase") — it merges to `main` and deploys to the web app only. The planner should NOT include a CHANGELOG.md entry task per the "NEW badge" memory rule below, since this phase is invisible to end users.
- **NEW badge requirement (from project memory MEMORY.md):** This phase is explicitly "invisible to users except that browser Back stops exiting the app" per CONTEXT.md's Phase Boundary section — per the litmus test ("Could the user describe what changed without reading the changelog?"), the answer is no for the split/PERF-11 fix, and arguably borderline-yes for "Back no longer exits the app." The planner should decide whether the tab-in-URL fix warrants a NEW badge or changelog mention; recommend treating it as internal/invisible per D-13's explicit "invisible to users" framing, consistent with no desktop tag being cut.
- **Branch workflow (D-13):** Develop on `feat/v2.0-foundation`; merge to `main` only after the equivalence gate + code review + user UAT sign-off. The planner should structure waves so the branch stays in a working, testable state throughout (each wave's commit leaves `main`-mergeable code on the feature branch, even though the merge itself is a single event at the end).
- **`react-hooks/exhaustive-deps` at error (D-14):** Already true project-wide today (see Standard Stack) — no new eslint config needed, this is a "verify it stays true" task, not a "turn it on" task.

## Sources

### Primary (HIGH confidence — direct source read, this session)
- `src/components/CostCalculator.tsx` (read in full, all 1815 lines, two passes) — extraction boundaries, exact state list, both pricing effects, `feeShapeRef`, existing eslint-disable comments
- `src/utils/pricingInterlink.ts` (read in full) — the three pure closed-form solvers, the "locked" no-marketplace invariant documented in its own header
- `src/utils/costCalc.ts` (read in full) — confirms `calculateCost` is already pure and untouched by this phase; confirms `CalcInput` shape for fixture-building
- `src/App.tsx` (read in full) — confirms current `useState<Tab>`, roving-tabindex handler, tab list, `handleEditJob` navigation call site
- `src/main.tsx` (read in full) — confirms `BrowserRouter` already wraps both Tauri and web route trees; confirms no routing-shell change is needed for D-08
- `vite.config.ts` (read in full) — confirms PWA manifest `start_url: '/'`/`scope: '/'`, confirms dev server port 4173, confirms no PWA-manifest change needed for D-06
- `eslint.config.js` (read in full) — confirms `eslint-plugin-react-hooks@7.0.1`'s `recommended` flat config already applies `rules-of-hooks`/`exhaustive-deps` at error, only newer React-Compiler-adjacent rules are downgraded
- `vitest.config.ts` (read in full) — confirms test runner config, confirms `coverage.include` currently scoped to `costCalc.ts` only
- `src/components/CostCalculator.test.tsx` (read first 120 of 221 lines) — confirms the existing "source-contract test" pattern used for PERF-11 regression guards (string-matching the source file rather than mounting the component) — an alternative/supplementary pattern to the `createRoot`/`act` mount-based tests
- `src/components/JobsManager.test.tsx` (grepped + read excerpts) — confirms the project's actual component-test harness: `createRoot`/`act` from `react-dom/client`/`react`, native DOM `.click()`, `vi.mock()` of `useDatabase.ts` hooks, `toHaveBeenCalledTimes()` assertions — NOT `@testing-library/react`
- `npm ls` output (this session) — confirms exact installed versions of `eslint-plugin-react-hooks`, `react-router-dom`, `dexie`, `dexie-react-hooks`, `vitest`, and confirms absence of `@testing-library/react`/`@testing-library/user-event`/`@testing-library/jest-dom`
- `.planning/phases/38-foundation/38-CONTEXT.md` — locked D-01 through D-15 decisions, discretion areas, deferred ideas
- `.planning/REQUIREMENTS.md` — exact FOUND-01/02/03 wording
- `.planning/STATE.md` — milestone sequencing context, confirms Phase 38 has no prior plans

### Secondary (MEDIUM confidence — milestone research, cross-validated against source in this session)
- `.planning/research/ARCHITECTURE.md` (2026-07-03) — extraction boundary sketch, tab-in-URL design rationale; cross-validated against direct source read and found accurate on every checkable claim (line ranges, hook names, dep-array design intent)
- `.planning/research/PITFALLS.md` (2026-07-03) — C-03 pitfall (pricing desync during split), PERF-11 post-mortem; cross-validated against the actual `feeShapeRef`/two-effect code and found to accurately describe the risk
- `.planning/research/SUMMARY.md` (2026-07-03) — phase sequencing, research-flag rationale

### Tertiary (LOW confidence / general guidance, not project-specific)
- Org rule `~/.claude/rules/ecc/react/hooks.md` — general `useReducer`/`useEffect` guidance, used to frame Pattern 1's justification but not itself a source of project-specific facts
- Org rule `~/.claude/rules/ecc/react/testing.md` — general RTL recommendation; explicitly NOT followed in this phase per Pitfall 3/4's documented deviation, since it conflicts with this specific project's established, working test idiom

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version number and dependency-presence claim verified via `npm ls` in this session, not assumed from training data
- Architecture: HIGH — every extraction boundary, line range, and existing pattern (both effects, `feeShapeRef`, eslint-disables, `BrowserRouter` wrapping) confirmed by direct full-file reads in this session
- Pitfalls: HIGH for the project-history-grounded ones (PERF-11 structural analysis, test-harness mismatch) — these are not speculative, they're read directly from the diff between what the milestone research assumed and what the actual file contains

**Research date:** 2026-07-03
**Valid until:** Until this phase's plan is authored — this research is tied to the exact current state of `CostCalculator.tsx`/`App.tsx`/`main.tsx`; if those files change before planning begins (unlikely, since no other work is in flight on them), re-verify the line-range claims.
