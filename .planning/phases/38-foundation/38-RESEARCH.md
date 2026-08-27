# Phase 38: Foundation — Research

**Researched:** 2026-08-27
**Domain:** React 18 component decomposition — CostCalculator split, pricing-interlink state design (PERF-11 done right), tab-in-URL routing
**Confidence:** HIGH — every finding grounded in direct source reading of `CostCalculator.tsx` (all 1,814 LOC), `pricingInterlink.ts`, `App.tsx`, `main.tsx`, plus the v1.9 post-mortem trail (36-RESEARCH.md Option A/B analysis, the PERF-11 revert, PITFALLS C-03)

---

## Summary

Phase 38 is three requirements: FOUND-01 (split the 1,814-LOC CostCalculator with zero behavioral change), FOUND-02 (eliminate the pricing double-render — the deferred PERF-11 — without reintroducing the desync that forced the v1.9 revert), FOUND-03 (tab-in-URL).

The single highest-risk decision — **how the pricing interlink state is structured after the split** — is settled here: a **reducer** (`usePricingInterlink`) whose edit actions derive the sibling fields *synchronously in the state transition*, plus **one** rebase effect keyed only on `[trueCost, pctFees, fixedFees]`. This eliminates both current pricing `useEffect`s, the `feeShapeRef` escape hatch, the eslint-disable, and the double render — while preserving the editingJob rebase path and the `trueCost <= 0` guard byte-for-byte. Section "The PERF-11 Post-Mortem" explains *why* the v1.9 dep-trim failed and why the reducer cannot fail the same way.

The correctness gate is a **mount-based output-equivalence harness** written BEFORE any refactor commit: it mounts the real CostCalculator (project convention: raw `createRoot` + `act`, no testing-library), drives inputs through DOM events, and locks the displayed pricing/cost outputs for ~10 scenarios — including the exact interaction that killed PERF-11 (consecutive same-field edits). The harness tests behavior, not structure, so it survives the split unchanged and is the pass/fail oracle for FOUND-01.

FOUND-03 is low-risk: the app already runs under `BrowserRouter`; the change is `useState<Tab>` → a `useSearchParams`-backed tab state in App.tsx, with a redirect guard for the bare `/app`, unknown tab values, and the desktop `/` route.

---

## Architectural Responsibility Map

| Unit | After Phase 38 | Owns |
|------|----------------|------|
| `CostCalculator.tsx` | ~150 LOC orchestrator | editingJob banner + population effect, save/update flow, composition of hooks + sections |
| `useCostForm.ts` (NEW) | ~200 LOC hook | all non-pricing form `useState`s, filament/material row helpers, `clearForm`, sessionStorage persistence effect |
| `usePricingInterlink.ts` (NEW) | ~120 LOC reducer hook | `{margin, profit, price, lastEdited}` + synchronous derivation on edit + single rebase effect — **the PERF-11 fix home** |
| `useCostDerivedValues.ts` (NEW) | ~150 LOC hook | all derived memos: `materialsInProfile`, `filamentRowsForCalc`, `costs`, `trueCost`, `fixedCosts`, shipping/packaging, `marketplaceFeeParts`, `breakEvenInfo`, tax chain |
| Section components ×5 (NEW) | ~150–250 LOC each | pure presentation; props in, callbacks out; no state |
| `App.tsx` | edited | tab state moves from `useState` to URL search param |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Split along researched seams, zero behavioral change, gated by output-equivalence tests | Seam map verified against source (line ranges below); harness design settled (mount-based, project-convention `createRoot`); harness ships and passes against the CURRENT component before the first refactor commit |
| FOUND-02 | Pricing double-render eliminated — PERF-11 done right (`useReducer`/event-handler, `exhaustive-deps` at error level) | Reducer design fully specified below; proof it cannot reproduce the v1.9 desync; eslint scoping decision made |
| FOUND-03 | Active tab in the URL (`useSearchParams`); Back/Forward navigates tabs; bookmarkable; PWA start_url keeps working | App.tsx/main.tsx routing verified; 6 `setActiveTab` call sites enumerated; start_url `/` + desktop `/` route + unknown-param fallback covered |
</phase_requirements>

---

## Verified Source Map (CostCalculator.tsx @ d2d12a8)

The extraction seams, confirmed by reading all 1,814 lines:

| Lines | Content | Destination |
|-------|---------|-------------|
| 1–75 | imports, props interface, `FORM_STORAGE_KEY`, `getStoredValue`, `rowKeySeq`/`nextRowKey`, `FilamentRow`/`MaterialRow` types | `useCostForm.ts` (helpers move with the state) |
| 77–106 | `currencySymbol`, `distanceUnit`, 18 `useId` calls, `bannerRef` | ids move to their section components; bannerRef stays in orchestrator |
| 111–118 | scroll-to-banner effect (FIX-04) | orchestrator |
| 130–159 | `convertToProfile`, `materialsInProfile`, `makeDefaultRow`, `toMaterialRow`/`stripRowKey` | `useCostDerivedValues` (convert/materials), `useCostForm` (row helpers) |
| 161–246 | ~25 `useState` declarations (incl. lazy sessionStorage initializers), row add/remove/update helpers, `useToast`, `useStockEvents` | `useCostForm` (state); `useStockEvents` stays where consumed (filament section needs `stockByAssetId`) |
| 249–284 | sessionStorage persistence effect (guarded on `!editingJob`) | `useCostForm` |
| 287–337 | editingJob population effect (sets ALL form fields; seeds margin/profit from saved basis; `setLastEdited('price')`) — has an existing intentional `eslint-disable` `[editingJob]` | orchestrator (it writes into both hooks) |
| 341–351 | printer auto-select effect | `useCostForm` |
| 354–364 | `selectedInstance`/`selectedPrinter` resolution, materials filters | `useCostDerivedValues` |
| 367–439 | `shippingCost`, `packagingCost`, `totalShippingCost`, `availableMarketplaces` | `useCostDerivedValues` (available* are render helpers → their sections) |
| 441–461 | `marketplaceFeeParts` memo + **`feeShapeRef`** (the PERF-11-revert workaround — DELETED by the reducer design) | `useCostDerivedValues`; ref removed |
| 464–511 | `availableShippingMethods`, `filamentRowsForCalc` | sections / `useCostDerivedValues` |
| 513–610 | `costs` (calculateCost), `trueCost`, `fixedCosts`, `breakEvenInfo`, `taxSource`/`tax`/`inheritedTaxRate` | `useCostDerivedValues` |
| 613–668 | `clearForm`, `finishAfterSave`, `handleClearForm` | `useCostForm` (clear), orchestrator (save UX) |
| 671–787 | `handleSaveJob` (validation, FilamentUsage mapping, create/update PrintJob incl. `fixedCostsAtSave` snapshot) | orchestrator |
| 789–852 | **the two pricing interlink effects** (locked-dep effect + fee-shape effect with eslint-disable) | REPLACED by `usePricingInterlink` |
| 854–874 | material/packaging row mutators | `useCostForm` |
| 876–1814 | JSX: Editing banner · Print Job Details (G-code import, identity row, model row, filament rows, print params) · Post-Processing Materials · Shipping (+packaging, totals) · Marketplace · Set Financial Targets · Cost Breakdown (+fee note, fixed costs, break-even) · Etsy CollapsibleSection · Save/Clear buttons | 5 section components (below) |

### Section component cut (JSX lines 876–1814)

1. `JobDetailsSection` (~900–1230): G-code import, print name/printer, model URL/cost/author-min, filament rows, print parameters (time, failure %, prep/post). Consumes `stockByAssetId`.
2. `PostProcessingSection` (~1175–1230): materials-used rows.
3. `ShippingSection` (~1230–1385): method, distance, carrier override, packaging rows, totals summary.
4. `PricingSection` (~1385–1560): marketplace picker + the three interlinked fields + `authorMinPrice` warning. Talks to `usePricingInterlink` via callbacks.
5. `CostSummarySection` (~1561–1814): cost breakdown table, tax row, fee note, fixed costs, break-even banner, Etsy CollapsibleSection, Save/Clear.

Six sections were floated in the milestone research; the code reads as five natural `<Card>`-level blocks (Etsy + save button are glued to the summary). Five is the recommendation; the plan may split Etsy out as a sixth if `CostSummarySection` exceeds ~300 LOC.

---

## The PERF-11 Post-Mortem — Why the v1.9 Analysis Was Wrong, and What That Teaches Phase 38

This is the heart of the research flag. 36-RESEARCH.md (v1.9) analyzed the pricing effect and concluded **"Option A (dep trim to `[trueCost, lastEdited]`) — Safe."** It shipped, passed all 744 tests, and was reverted in release review. The flaw in the analysis:

> "Since the user's last keystroke on that field would have updated `profitMarginPercent` in the same render batch as `trueCost` recomputing, the closure should be fresh."

The missed case: **consecutive edits to the same field**. Type `25` into Selling Price, then `30`. `lastEdited` is already `'price'` (unchanged). `trueCost` doesn't depend on pricing fields (unchanged). With the trimmed deps the effect NEVER re-fires — profit and margin keep showing the derivation of `25` while price reads `30`. The full dep array wasn't accidental re-render noise; `sellingPrice` in the deps was **load-bearing**: it is what makes the second keystroke re-derive. The "benign double render" and the correctness were coupled in the effect design — which is precisely why an *effect* can't fix PERF-11, and a *reducer* can.

**Lesson encoded in the FOUND-02 design:** derivation must be driven by *events* (the user edited field X to value V; the cost basis changed), never by *observing* the values it itself writes.

---

## FOUND-02 — `usePricingInterlink` Reducer Design (SETTLED)

### State & actions

```typescript
interface PricingState {
  profitMarginPercent: number;
  targetProfit: number;
  sellingPrice: number;
  lastEdited: 'margin' | 'profit' | 'price';
}

interface PricingCtx { trueCost: number; fee: FeeShape }  // FeeShape from pricingInterlink.ts

type PricingAction =
  | { type: 'editMargin'; value: number; ctx: PricingCtx }
  | { type: 'editProfit'; value: number; ctx: PricingCtx }
  | { type: 'editPrice';  value: number; ctx: PricingCtx }
  | { type: 'rebase';     ctx: PricingCtx }                     // trueCost or fee shape changed
  | { type: 'load';       state: PricingState }                  // editingJob population / clearForm
```

### Transition rules (each mirrors the current effect branch exactly)

- `editMargin(v)`: if `ctx.trueCost <= 0` → `{...s, profitMarginPercent: v, lastEdited: 'margin'}` (today: setState fires, effect early-returns — sibling fields untouched). Else derive via `priceFromMargin(trueCost, v, fee)` → price 2dp, profit 2dp, `lastEdited: 'margin'`. Same for the other two edits with `priceFromProfit` / `marginFromPrice` (margin 1dp).
- `rebase`: if `ctx.trueCost <= 0` → state unchanged. Else re-run the branch selected by `s.lastEdited` against current state values — identical to what BOTH current effects do (they run the same three-branch body).
- `load`: replace state wholesale (used by the editingJob effect and `clearForm`).

Rounding stays `parseFloat(x.toFixed(n))` — same functions, same call sites, so derived numbers are bit-identical.

### The one effect that remains

```typescript
useEffect(() => {
  dispatch({ type: 'rebase', ctx: { trueCost, fee: { pctFees, fixedFees } } });
}, [trueCost, pctFees, fixedFees]);   // exhaustive-deps CLEAN — dispatch is stable
```

This replaces both current effects AND `feeShapeRef`:
- trueCost-driven re-derivation (today's locked-dep effect firing on `trueCost`) ✓
- fee-shape-driven re-derivation (today's second effect on `[pctFees, fixedFees]` with its eslint-disable) ✓
- consecutive same-field edits: handled by the **edit actions themselves** — the second keystroke dispatches `editPrice(30)` which synchronously derives profit/margin. No effect involvement, no staleness possible, no double render (one dispatch = one render).

### Why this cannot reproduce the desync (proof sketch)

The v1.9 failure required an *observer* (effect) to miss a change in a value it reads. In the reducer, every derivation input arrives either (a) in the action payload at dispatch time (the freshly-typed value, current `trueCost`/fee read during render — same values the JSX is rendering), or (b) from the reducer's own previous state, which React passes to the transition function — never a closure. There is no dep array on the edit path at all. The only dep array left (`rebase`) contains only values the reducer *reads* and never *writes*, so the write-observe cycle that produced both the double render and the trim temptation is structurally gone.

### Behavioral edge cases the equivalence harness must lock

1. **Consecutive same-field edits** (the revert trigger): price → 25 → 30; also margin → 40 → 50.
2. **editingJob rebase path** (36-RESEARCH "critical correctness check", CostCalculator:311–321): population seeds margin/profit from the saved cost basis, sets `lastEdited='price'`; when `trueCost` reconciles the rebase re-derives against CURRENT cost. In the new design the population effect dispatches `load`, then the rebase effect fires on the `trueCost` change — same observable sequence.
3. **`trueCost <= 0` guard**: with no cost inputs, typing a margin leaves price/profit untouched.
4. **Marketplace switch**: selecting Etsy re-derives off `lastEdited` with the new fee shape; switching between identical-fee platforms must NOT churn values (today's effect keys on the fee *shape*, not the platform string).
5. **Fee FX conversion**: non-USD profile converts fixed fees before they hit the interlink (v1.9 ~150× fix) — `marketplaceFeeParts` feeds the reducer ctx unchanged.
6. **Mount with stored form**: sessionStorage-restored pricing state + `lastEdited` re-derives once `trueCost > 0` (today: locked effect fires post-mount) — the rebase effect's first run covers this.

### ESLint enforcement (FOUND-02's second clause)

`react-hooks/exhaustive-deps` is currently a project-wide **warn** (react-hooks recommended default). Escalating it to `error` globally would trip on ~6 pre-existing intentional disables in other files, out of Phase 38's scope. **Decision: escalate to error scoped to the new files** (`src/hooks/useCostForm.ts`, `usePricingInterlink.ts`, `useCostDerivedValues.ts`, `src/components/calculator/**`) via an eslint.config.js override block, and verify the editingJob orchestrator effect keeps its documented disable. A follow-up global escalation can ride a later hygiene phase.
*(Plan-time check: confirm the exact current rule level in `eslint.config.js` before writing the override.)*

---

## FOUND-01 — Output-Equivalence Test Strategy (SETTLED)

### Why mount-based, not source-contract

Every existing CostCalculator test is source-contract (regex over the .tsx source) — worthless across a refactor that rewrites the source. `costCalc.test.ts` (46 tests) locks the pure math but PERF-11 proved the bug class lives in the React wiring. The gate must therefore **mount the real component and drive real DOM events**.

### Harness mechanics (verified against project conventions)

- **Renderer:** raw `createRoot` + `act` from `react` — the locked project convention (FilamentSelector.test.tsx, Modal.test.tsx). No @testing-library (not in devDependencies; do not add).
- **Providers:** wrap in `ToastProvider` (useToast throws outside one — verified `toast/context.ts`).
- **Dexie isolation:** `vi.mock('../hooks/useStockEvents')` returning `{ events: [], stockByAssetId: new Map(), logManualAdjustment: vi.fn() }` (return shape verified). This is the component's ONLY Dexie edge — everything else arrives via props.
- **sessionStorage:** clear `FORM_STORAGE_KEY` in `beforeEach`; jsdom provides the API.
- **Inputs:** located by accessible label / id association (the a11y pass guarantees label↔input wiring); values driven via React's native input value setter + `input` event dispatch inside `act` (established pattern in existing mount tests).
- **Outputs read:** the three pricing field values, the cost-breakdown rows (true cost, per-unit lines), tax row, marketplace fee note, break-even banner text.
- **Fixtures:** minimal `Material`/`PrinterConfig`/`PrinterInstance`/`ElectricityConfig`/`ShippingConfig`/`MarketplaceFees`/`UserProfile` objects + a small `FxRateTable` (needed for the fee-FX scenario; `null` exercises the fallback path in a separate scenario).

### Scenario table (~10 scenarios, golden values captured from the CURRENT component)

| # | Scenario | Locks |
|---|----------|-------|
| 1 | Single filament, margin-driven (default) | baseline derivation on mount |
| 2 | Multi-filament + materials used + prep/post labor | `calculateCost` wiring, per-unit lines |
| 3 | Price-driven: type price once | `marginFromPrice` branch |
| 4 | **Price typed twice (25 → 30)** | THE PERF-11 case |
| 5 | **Margin typed twice (40 → 50)** | same-field case, margin branch |
| 6 | Profit-driven + cost input change afterwards | rebase on trueCost change |
| 7 | Etsy marketplace, USD | net-of-fee derivation, fee note |
| 8 | Etsy marketplace, EUR profile + fxTable | fixed-fee FX conversion |
| 9 | Marketplace none→etsy→none toggle | fee-shape rebase, exact round-trip restore |
| 10 | Zero cost inputs, type margin | trueCost<=0 guard (siblings untouched) |
| 11 | editingJob prop set after mount | population + rebase-against-current-cost path |
| 12 | Shipping dropoff (distance + fuel) | `Math.ceil` cent rounding into trueCost |

Golden values are asserted as **exact rendered strings** (e.g. `'25.00'`, `'37.5'`) — captured by running the harness against the pre-split component, hand-checked for sanity against `pricingInterlink` closed forms, then frozen. The file must not import any post-split module, so it runs unmodified on both sides of the refactor.

**Gate rule:** the harness lands and passes on the pre-split component in its own commit BEFORE the first extraction commit. Every extraction commit must keep it green. Any golden-value change during the split = a behavioral regression = stop and fix, never re-capture.

### Known jsdom risks (plan for them)

- `window.matchMedia` used by the banner-scroll effect — jsdom lacks it; stub in the harness setup (pattern exists in App.a11y tests — plan-time check).
- `scrollIntoView` / `window.scrollTo` — stub as no-ops.
- `GcodeImport`/`FilamentSelector` render inside JobDetails — they are prop-driven and mount fine (FilamentSelector already mount-tested); no file APIs touched unless used.

---

## FOUND-03 — Tab-in-URL (SETTLED)

Verified current state: `App.tsx:42` `useState<Tab>('calculator')`; 6 `setActiveTab` call sites (tab buttons, arrow-key nav, `onViewJobs`, edit-job jump ~line 158); `main.tsx` runs `BrowserRouter` with `/` → LandingPage (web) or App (Tauri), `/app` → App; PWA `start_url: '/'` (vite.config.ts:35).

**Design:**
- `activeTab` derives from `useSearchParams`: `const tab = isTab(params.get('tab')) ? params.get('tab') : 'calculator'` — unknown/missing values render the calculator WITHOUT redirect-looping (bare `/app` and `start_url: '/'` keep working untouched, satisfying the FOUND-03 PWA clause).
- `setActiveTab(t)` becomes `setSearchParams({ tab: t })` (default push semantics → Back/Forward walk tab history). The initial normalize (if any) must use `{ replace: true }` to avoid a trapped Back entry.
- Works identically on `/` (Tauri) and `/app` (web) since it's search-param-only — no route changes in main.tsx.
- The `Tab` type + guard live beside the existing `tabs` array; arrow-key roving-tabindex handler calls the same setter (behavior unchanged, A11Y C-01 preserved).
- Scroll behavior: `ScrollToTop` (v1.9 FIX) listens to location changes — **plan-time check**: ensure tab flips don't trigger an unwanted scroll-to-top if it keys on `pathname` only (it should); if it keys on the full location, exempt search-param-only changes are needed. Verify `src` for how ScrollToTop is keyed.
- Test: mount-based App test asserting param↔tab sync both directions + unknown-param fallback.

Risk: LOW. No data, no pricing, no schema.

---

## Build Order (dependency-verified)

1. **38-01 Equivalence harness** — lands first, passes against current component. (No refactor code in this plan.)
2. **38-02 `useCostForm` extraction** — state + persistence + row helpers move; component consumes the hook; harness green.
3. **38-03 `usePricingInterlink` + `useCostDerivedValues`** — memos move; both pricing effects + `feeShapeRef` replaced by the reducer; scoped exhaustive-deps error; harness green (FOUND-02 lands here).
4. **38-04 Section components + orchestrator shrink** — JSX moves into 5 sections; CostCalculator becomes the ~150 LOC orchestrator; harness green; source-contract tests in CostCalculator.test.tsx updated to point at the new files (they grep the source).
5. **38-05 Tab-in-URL** — independent of 1–4, can run parallel; own App-level tests.

Steps 2→3→4 are strictly sequential (each consumes the previous shape). 5 is parallel-safe.

---

## Don't Hand-Roll

- Pricing math: `pricingInterlink.ts` functions are the reducer's derivation calls — no formula duplication in the reducer body.
- Fee decomposition: `computeMarketplaceFee` stays the single fee source; the reducer only ever sees its `{pctFees, fixedFees}`.
- URL state: `useSearchParams` from react-router-dom (already a dependency) — no manual `history.pushState`.
- Row keys: keep `nextRowKey`/`uid` mechanism as-is (moves file, not design).

## Common Pitfalls

1. **Re-capturing golden values mid-split** — that converts the gate into a rubber stamp. Golden values are frozen at 38-01; changes are regressions.
2. **Moving the editingJob population effect into `useCostForm`** — it writes pricing state too (margin/profit seed + `lastEdited='price'`); it stays in the orchestrator dispatching into both hooks, keeping its one documented eslint-disable.
3. **Persistence effect ordering** — today one effect persists ALL fields (incl. pricing) guarded on `!editingJob`. After the split it must still write ONE JSON blob under `FORM_STORAGE_KEY` with the same keys (backward compat with stored sessions), sourcing pricing values from the reducer.
4. **`rebase` on every render** — the rebase effect must depend on the primitive `pctFees`/`fixedFees` numbers, NOT the `marketplaceFeeParts` object (new identity every render ⇒ infinite loop risk if object-depped).
5. **Losing the `Math.min(margin, 99.9)` clamp / `DENOM_EPSILON`** — they live inside `pricingInterlink.ts`; calling those functions (not reimplementing) keeps them.
6. **Tab param churn from `setSearchParams` object identity** — call with a fresh object but only on actual tab change; guard `if (t === activeTab) return` as today's roving handler effectively does.
7. **Section props ballooning** — pass the hook return objects (`form`, `derived`, `pricing`) as grouped props, not 30 scalars; but do NOT context-ify (App.tsx prop-drilling refactor is explicitly out of scope — ARCHITECTURE.md anti-pattern note).

## Verification Strategy

- **Primary gate:** equivalence harness (38-01) green on every commit of the phase.
- `npm run build` + `lint:no-raw-html` + full Vitest suite (819 tests) green per plan.
- Bundle gate: 300 KB gz main-chunk check still passes (split adds files, not deps).
- Human UAT before phase close: the PITFALLS C-03 checklist — rapid two-field typing, same-field consecutive typing, marketplace toggling, edit-job flow, browser Back/Forward through tabs, PWA install start.
- FOUND-02 sign-off requires: both old pricing effects gone, `feeShapeRef` gone, zero `exhaustive-deps` disables in the new pricing/derived hooks, scoped error-level lint active.

## Open Items for Planning (all small)

1. Confirm `eslint.config.js` current `exhaustive-deps` level and write the scoped override.
2. Check `ScrollToTop` keying (pathname vs full location) for search-param navigation.
3. Confirm matchMedia stub pattern available for the harness (App.a11y tests likely have one).
4. Decide 5 vs 6 sections at 38-04 planning (Etsy split-out threshold ~300 LOC).
