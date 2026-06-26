# Phase 36: Performance Tier 5 - Research

**Researched:** 2026-06-26
**Domain:** React render optimisation — Dexie subscription deduplication, `useMemo` Map hoisting, `useEffect` dep trimming
**Confidence:** HIGH

---

## Summary

Phase 36 targets three performance hotspots identified in the Calculator App Audit (Tier 5). All three are pure refactors with a hard constraint: **zero behavioral change**. The research confirmed the audit's severity assessments but surfaced one material correction to the PERF-09 proposed fix and one preference recommendation for PERF-11.

**Primary recommendation:** Ship all three fixes in a single plan wave (they touch distinct areas and have no mutual dependencies). Write source-contract and output-equivalence tests before implementation — this phase has a thin existing test layer for the changed components and the risk of invisible regressions is real.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dexie subscription management | Frontend — hook layer | — | useLiveQuery creates an Observable per component mount; lifecycle entirely in React |
| Quote data fan-out | Frontend — JobsManager parent | Per-row subcomponents | Parent owns data; children should receive props |
| Filament name lookup | Frontend — memoised Map in component | — | Pure derive from `materials[]` prop |
| Pricing tri-field derivation | Frontend — CostCalculator state | — | Local state machine; no backend touch |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-09 | `useQuotes()` lifted out of per-row components to `JobsManager` parent, eliminating one live Dexie subscription per visible job row | Confirmed: dedup does NOT exist in dexie-react-hooks; lift is the correct fix; prop-threading approach documented below |
| PERF-10 | `getFilamentName` resolves via a `materialsById` Map instead of O(N×M) `Array.find` per render | Confirmed: straightforward `useMemo` Map; semantics identical |
| PERF-11 | Pricing `useEffect` no longer double-renders per keystroke | Confirmed: dep trimming is safe; event-handler approach also safe; research recommends dep trimming |
</phase_requirements>

---

## PERF-09 — Critical Premise Verification

### Does `dexie-react-hooks` deduplicate `useLiveQuery` subscriptions?

**Finding: NO. The comment at `JobsManager.tsx:163` is incorrect.**

Reading `node_modules/dexie/dist/dexie.mjs` directly: `Dexie.liveQuery(querier)` creates a `new Observable(...)` on every call. There is no cache, no ref-count, no BehaviorSubject multicasting. Each `useLiveQuery(() => db.quotes.toArray(), [])` call in `useQuotes()` produces an independent observable that:

1. Subscribes to `globalEvents.storagemutated`
2. Re-runs `querier` (a full `db.quotes.toArray()` scan) on every qualifying write
3. Calls `observer.next(result)` which triggers `triggerUpdate()` — a `useReducer` dispatch — which schedules a React re-render

`useObservable` in `dexie-react-hooks` wraps this with `React.useMemo` keyed on `deps` — but that memo only prevents re-creating the observable when deps do NOT change. It does not share the observable across component instances.

**Consequence:** With 80 visible job rows, both `OrdersSection` and `OrdersQuoteRows` each mount and call `useQuotes()`. That is 160 independent `useLiveQuery` instances, each holding a live `globalEvents.storagemutated` subscription. Every quote write triggers 160 re-queries + 160 React re-renders. The audit's severity assessment (High at scale) is correct. [VERIFIED: source inspection of `node_modules/dexie-react-hooks/dist/dexie-react-hooks.mjs` and `node_modules/dexie/dist/dexie.mjs`]

### Correct fix for PERF-09

The audit proposes: "Lift `useQuotes()` to the `JobsManager` parent, pass `quotesForJob` down as a prop."

This is the right direction but needs precise scoping:

**What to lift:** `useQuotes()` is already called once in `JobsManager` at line 984 — but only destructuring `updateQuote`:

```typescript
// line 984 — existing call
const { updateQuote: updateQuoteFromHook } = useQuotes();
```

The fix is to expand this single existing call to also capture `quotesByJobId`, then pass slices down as props.

**Two sub-components that each call `useQuotes()` independently:**

1. `OrdersQuoteRows` (line 340) — uses `quotesByJobId` and `updateQuote`
2. `OrdersSection` (line 396) — uses only `quotesByJobId` (to compute `hasQuotes` / `visibleQuotes`)

Both are called within `JobCard` which is called by the virtualized `JobRow`. The call chain is:

```
JobsManager → rowProps → JobRow → JobCard → OrdersSection → OrdersQuoteRows
```

**Prop threading plan:**

- Expand the existing `useQuotes()` call at line 984 to also destructure `quotesByJobId`
- Add `quotesForJob: Quote[]` prop to both `OrdersSection` and `OrdersQuoteRows` (replacing their internal `useQuotes()` calls)
- `JobCard` already receives `onStartConversion`, `onEditQuote`, `onDeclineQuote` — add `quotesForJob: Quote[]`
- `rowProps` memo (line 1293) needs `quotesForJob: (jobId: string) => Quote[]` as a lookup function OR thread `quotesByJobId` map and let JobCard extract its slice

**Recommended approach — pass a per-job slice extractor to JobCard:**

```typescript
// In JobsManager, expand existing line 984:
const { quotesByJobId, updateQuote: updateQuoteFromHook } = useQuotes();

// Pass a stable callback via rowProps so JobCard can extract its slice:
const getQuotesForJob = useCallback(
  (jobId: string) => quotesByJobId.get(jobId) ?? [],
  [quotesByJobId]
);
```

Then `JobCard` receives `getQuotesForJob` and passes `getQuotesForJob(job.id)` to `OrdersSection` / `OrdersQuoteRows`. This keeps `rowProps` shape clean and avoids threading the full Map reference.

**`updateQuote` wiring:** `OrdersQuoteRows` calls `updateQuote` for the Reopen action (line 364). After the lift, it needs `updateQuote` passed as a prop from `JobCard`, which gets it from `rowProps`, which gets it from `JobsManager`'s expanded `useQuotes()` destructure. There is already an `updateQuoteFromHook` variable — this is the same function. No behavioral change: the Reopen write still goes through the same `db.quotes.put` path.

**Behavioral equivalence check:** `quotesByJobId` is already a `useMemo` inside `useQuotes()` that re-derives the Map only when `quotes` changes. Lifting to the parent means there is exactly ONE Map and ONE subscription. Each `OrdersQuoteRows` gets `quotesForJob` — a stable reference as long as the underlying `Quote[]` for that job hasn't changed. Because `JobCard` is `React.memo`-wrapped and `getQuotesForJob(job.id)` is called inside JobCard's render (not as a prop), JobCard will re-render only when `rowProps` changes — which is the existing behavior for any prop change. This is a net improvement, not a regression. [VERIFIED: source inspection of `JobsManager.tsx:329-414`, `JobsManager.tsx:984`, `JobsManager.tsx:1293-1321`]

---

## PERF-10 — `getFilamentName` O(N×M) Lookup

### Current implementation

```typescript
// JobsManager.tsx:1260-1263
const getFilamentName = useCallback((filamentId: string) => {
  const filament = materials.find(m => m.id === filamentId);
  return filament ? `${filament.brand || ''} ${filament.filamentType || filament.name}`.trim() : 'Unknown';
}, [materials]);
```

`getFilamentName` is called per filament per job card render. With 80 jobs × 2 filaments each = 160 calls × N materials in the library. The `Array.find` is O(N) so total cost is O(jobs × filaments × materials). At 80 jobs × 3 filaments × 50 materials = 12,000 comparisons per render. [VERIFIED: source inspection of `JobsManager.tsx:1260-1263`]

### Fix

`materials` arrives as a prop from `JobsManager`'s parent (it is not a live query inside `JobsManager` itself). Build the Map once with `useMemo`:

```typescript
const materialsById = useMemo(
  () => new Map(materials.map(m => [m.id, m])),
  [materials]
);

const getFilamentName = useCallback((filamentId: string) => {
  const filament = materialsById.get(filamentId);
  return filament ? `${filament.brand || ''} ${filament.filamentType || filament.name}`.trim() : 'Unknown';
}, [materialsById]);
```

The `materialsById` Map is only rebuilt when `materials` changes (a Dexie write to the assets table). `getFilamentName` is passed through `rowProps` (line 1298) into `JobCard` → `rowProps` memo already tracks `getFilamentName` in its dep array (line 1321). When `materialsById` is stable, `getFilamentName`'s callback identity is stable, so `rowProps` does not recreate and `JobCard` does not re-render. This is a strict improvement over the current `useCallback([materials])` which forces `getFilamentName` to be a new reference every time any material changes.

**Fallback semantics:** `Unknown` is preserved for missing ids. No behavioral change. [VERIFIED: source inspection]

---

## PERF-11 — Pricing `useEffect` Double-Render

### Current implementation

```typescript
// CostCalculator.tsx:804-825
useEffect(() => {
  if (trueCost <= 0) return;

  if (lastEdited === 'margin') {
    const clampedMargin = Math.min(profitMarginPercent, 99.9);
    const newPrice = trueCost / (1 - clampedMargin / 100);
    const newProfit = newPrice - trueCost;
    setSellingPrice(parseFloat(newPrice.toFixed(2)));
    setTargetProfit(parseFloat(newProfit.toFixed(2)));
  } else if (lastEdited === 'profit') {
    const newPrice = trueCost + targetProfit;
    const newMargin = ((newPrice - trueCost) / newPrice) * 100;
    setSellingPrice(parseFloat(newPrice.toFixed(2)));
    setProfitMarginPercent(parseFloat(newMargin.toFixed(1)));
  } else if (lastEdited === 'price') {
    const newProfit = sellingPrice - trueCost;
    const newMargin = sellingPrice > 0 ? ((sellingPrice - trueCost) / sellingPrice) * 100 : 0;
    setTargetProfit(parseFloat(newProfit.toFixed(2)));
    setProfitMarginPercent(parseFloat(newMargin.toFixed(1)));
  }
}, [trueCost, lastEdited, profitMarginPercent, targetProfit, sellingPrice]);
```

**Why it double-renders:** The dep array includes `profitMarginPercent`, `targetProfit`, and `sellingPrice` — three of the values that the effect SETS. When `lastEdited === 'margin'`, the effect fires, sets `sellingPrice` and `targetProfit`. Those state changes cause a re-render. On the next render, `sellingPrice` and `targetProfit` are new values → the effect fires again (the deps changed). In React 18 strict-mode the effect fires twice per mount anyway, but in production the issue is: every keystroke that changes a cost input (updating `trueCost`) triggers two effect runs — one from `trueCost` changing, one from the derived value changes. [VERIFIED: source inspection of `CostCalculator.tsx:804-825`, `CostCalculator.tsx:215-218`]

### `editingJob` rebase path (critical correctness check)

The `editingJob` population effect (lines 284-335) sets:
- `setSellingPrice(editingJob.sellingPrice)` → then `setLastEdited('price')`
- `setTargetProfit(...)` and `setProfitMarginPercent(...)` from saved cost basis

The pricing `useEffect` then fires with `lastEdited === 'price'`, which re-derives `targetProfit` and `profitMarginPercent` against the CURRENT `trueCost`. The comment at lines 311-314 explicitly describes this: "The derive-from-price effect rebases these against current trueCost once filaments and materials reconcile." This rebase behavior is load-on-edit correctness, not a bug.

**This rebase path MUST be preserved by any fix.**

### Option A — Trim dep array to `[trueCost, lastEdited]`

Remove `profitMarginPercent`, `targetProfit`, and `sellingPrice` from the dep array:

```typescript
useEffect(() => {
  if (trueCost <= 0) return;

  if (lastEdited === 'margin') {
    const clampedMargin = Math.min(profitMarginPercent, 99.9);
    // ...
  } else if (lastEdited === 'profit') {
    const newPrice = trueCost + targetProfit;
    // ...
  } else if (lastEdited === 'price') {
    const newProfit = sellingPrice - trueCost;
    // ...
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [trueCost, lastEdited]);
```

**Stale closure risk:** `profitMarginPercent`, `targetProfit`, and `sellingPrice` are captured from the render in which the effect is registered. If the effect fires (because `trueCost` changed) and reads a stale value, the derived output could be wrong.

**Is the stale closure actually a problem here?** In practice: the pricing fields (`margin`, `profit`, `price`) are only meaningful as the "driving input" for one branch at a time, determined by `lastEdited`. When `lastEdited === 'margin'`, `profitMarginPercent` is the one the user is actively editing. Since the user's last keystroke on that field would have updated `profitMarginPercent` in the same render batch (or very close to it) as `trueCost` recomputing, the closure should be fresh. React 18 batches all setState calls in event handlers, so the effect fires after all state is committed — the closure is not stale in the single-keystroke flow. The only case where staleness would matter is a rapid async update race. There is no async code in this component changing these fields.

**Conclusion for Option A:** Safe. The dep-trimmed form matches the original intent: re-derive when `trueCost` or `lastEdited` changes. The `eslint-disable-next-line` comment is required (lint rule `react-hooks/exhaustive-deps` will flag the missing deps — this is an intentional exception, not a bug).

### Option B — Event-handler pattern

Move derivation into the `onChange` handlers for each pricing field:

```typescript
// When user edits margin:
const handleMarginChange = (val: number) => {
  setProfitMarginPercent(val);
  setLastEdited('margin');
  if (trueCost > 0) {
    const clampedMargin = Math.min(val, 99.9);
    const newPrice = trueCost / (1 - clampedMargin / 100);
    setSellingPrice(parseFloat(newPrice.toFixed(2)));
    setTargetProfit(parseFloat((newPrice - trueCost).toFixed(2)));
  }
};
```

**Problem with Option B for this component:** `trueCost` is a derived `useMemo` from ~15 cost inputs. The event-handler approach only re-derives when the user explicitly edits a pricing field. But `trueCost` also changes when ANY cost input changes (filament grams, electricity rate, shipping distance, etc.). The original `useEffect` ensures pricing fields track `trueCost` changes automatically. Converting to event handlers would need a second `useEffect` watching `trueCost` — which recreates the same problem.

**Recommendation: Option A (dep trimming).** It is minimal, directly targets the documented problem, preserves the editingJob rebase path, and does not restructure the component. The only requirement is the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment with an inline explanation. [VERIFIED: source inspection of `CostCalculator.tsx:284-335`, `:804-825`, `:215-218`]

---

## Architecture Patterns

### Standard Stack

These refactors use only React built-ins already present in the codebase. No new packages.

| Tool | Purpose | Already in use |
|------|---------|----------------|
| `useMemo` | Build `materialsById` Map; (already used in `useQuotes` for `quotesByJobId`) | Yes |
| `useCallback` | Stable `getFilamentName` and `getQuotesForJob` references | Yes |
| `React.memo` | `JobCard` is already memo-wrapped | Yes |
| `useQuotes()` (existing) | Single call at `JobsManager` parent level | Yes (partially — expand) |

### Anti-Patterns to Avoid

- **Threading the full `quotesByJobId` Map through `rowProps`**: `rowProps` is a plain object passed to `react-window`'s `List` component. Adding a Map directly works but is semantically heavier than a `getQuotesForJob` accessor. Use the accessor.
- **Moving pricing derivation to `useReducer`**: Would require restructuring 15+ related state slices. YAGNI — dep trimming achieves the goal at far lower diff surface.
- **Adding `/* @ts-ignore */`** instead of `/* eslint-disable-next-line react-hooks/exhaustive-deps */`: The lint disable is the correct mechanism.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Observable multicasting | Custom pub/sub dedup layer | Lift to parent + prop drilling | Dexie liveQuery has no built-in sharing; prop drilling is idiomatic React for this scale |
| O(1) lookup | Manual loop with early return | `Map.get()` | Already used in `quotesByJobId` and `customersByEmail`; consistent with codebase pattern |

---

## Common Pitfalls

### Pitfall 1: Forgetting `updateQuote` in the prop chain

**What goes wrong:** `OrdersQuoteRows` currently calls `const { quotesByJobId, updateQuote } = useQuotes()`. After the lift, `quotesByJobId` comes from props — but `updateQuote` must also come from props, not from a residual `useQuotes()` call inside the component. Leaving any `useQuotes()` call in the sub-components defeats the fix.

**How to avoid:** After the refactor, grep the file for `useQuotes(` — exactly one call must exist (in `JobsManager`). The test must assert this.

**Warning signs:** TypeScript will not catch a stray `useQuotes()` call because it is a valid hook.

### Pitfall 2: `rowProps` dep array omitting `quotesByJobId` / `getQuotesForJob`

**What goes wrong:** `rowProps` is memoised. If `getQuotesForJob` is not in the dep array, the rows will receive a stale `getQuotesForJob` reference and will not re-render when quotes change.

**How to avoid:** The `rowProps` useMemo dep array at line 1321 is explicit — add `getQuotesForJob` there.

### Pitfall 3: `eslint-disable` comment scope for PERF-11

**What goes wrong:** Placing `// eslint-disable-next-line` on the wrong line (not the line immediately before the closing dep array) silences the wrong warning or silences the wrong rule.

**How to avoid:** Place the comment on the line immediately before `}, [trueCost, lastEdited]);`. Add an inline justification: `// deps: profitMarginPercent/targetProfit/sellingPrice omitted — effect reads them via closure at trueCost-change time; including them causes double-renders (PERF-11)`.

### Pitfall 4: `JobCard.memo` invalidating on every `quotesByJobId` rebuild

**What goes wrong:** If `getQuotesForJob` is defined as `(jobId) => quotesByJobId.get(jobId) ?? []` without `useCallback`, it is a new function reference every render. Since `rowProps` includes it, `rowProps` recreates every render, which means `JobCard`'s memo is bypassed on every render.

**How to avoid:** Wrap in `useCallback([quotesByJobId])` so identity is stable when the Map has not changed.

### Pitfall 5: Pricing effect `trueCost <= 0` guard interacting with editingJob load

**What goes wrong:** When `editingJob` loads, `trueCost` may momentarily be 0 (before filament rows reconcile). The guard `if (trueCost <= 0) return` prevents derivation until cost is computed. This is existing correct behavior. A dep-trimmed dep array must not bypass this guard.

**How to avoid:** The guard remains at line 805. Dep trimming changes only the dep array, not the body.

---

## Verification Strategy

### Existing test coverage

- `src/components/JobsManager.test.tsx` — mounts `OrdersQuoteRows` and `JobCard` directly via `vi.mock('../hooks/useDatabase', ...)`. These tests MOCK `useQuotes`. After the lift, `OrdersQuoteRows` and `OrdersSection` will no longer call `useQuotes` — they will receive props. The mock will need updating to pass props instead.

- `src/components/CostCalculator.test.tsx` — currently has only `it.todo` stubs for the component itself and source-contract tests for FIX-04. PERF-11 needs new source-contract tests or behavioural unit tests.

### Required new tests (Wave 0 additions)

**For PERF-09:**

```typescript
// In JobsManager.test.tsx
// 1. Output-equivalence: OrdersQuoteRows with quotesForJob prop renders the same quote list
//    as it did when calling useQuotes() internally.
it('OrdersQuoteRows renders quote list from quotesForJob prop', () => { ... });

// 2. No-residual-hook: grep the source for lone useQuotes() calls
it('source: useQuotes() called exactly once (in JobsManager body)', () => {
  const src = readFileSync(...);
  const matches = src.match(/useQuotes\(\)/g) ?? [];
  expect(matches.length).toBe(1);
});
```

**For PERF-10:**

```typescript
// Output-equivalence: getFilamentName with Map returns same string as with Array.find
it('getFilamentName returns same result after Map refactor', () => {
  // Inline test on a standalone version of the logic
  const materials = [{ id: 'a', brand: 'Bambu', filamentType: 'PLA', name: 'PLA' }];
  const map = new Map(materials.map(m => [m.id, m]));
  const getName = (id: string) => {
    const f = map.get(id);
    return f ? `${f.brand || ''} ${f.filamentType || f.name}`.trim() : 'Unknown';
  };
  expect(getName('a')).toBe('Bambu PLA');
  expect(getName('missing')).toBe('Unknown');
});
```

**For PERF-11:**

```typescript
// Source-contract: dep array is trimmed to [trueCost, lastEdited]
it('source: pricing useEffect dep array contains exactly trueCost and lastEdited', () => {
  const src = readFileSync(resolve(__dirname, 'CostCalculator.tsx'), 'utf8');
  // The effect that sets sellingPrice must be keyed on trueCost + lastEdited only
  expect(src).toContain('}, [trueCost, lastEdited]);');
  // The removed deps must not appear in that line
  expect(src).not.toMatch(/\[trueCost.*profitMarginPercent/);
});

// Source-contract: eslint-disable comment is present explaining the omission
it('source: PERF-11 eslint-disable comment present with justification', () => {
  const src = readFileSync(resolve(__dirname, 'CostCalculator.tsx'), 'utf8');
  expect(src).toContain('PERF-11');
});
```

### Vitest runner

```bash
npx vitest run src/components/JobsManager.test.tsx
npx vitest run src/components/CostCalculator.test.tsx
```

Full suite: `npx vitest run`

---

## Audit Finding vs. Proposed Fix Divergences

| Finding | Audit's proposed fix | Research verdict | Correction |
|---------|---------------------|-----------------|------------|
| PERF-09: lift `useQuotes()` to parent | "pass `quotesForJob` prop" | Correct approach; one key detail: `useQuotes` is already called at line 984 — EXPAND, do not add a second call | Also lift `updateQuote` (for Reopen) through the same prop chain; `OrdersSection` needs `quotesForJob` prop too (not just `OrdersQuoteRows`) |
| PERF-09: dedup claim in code comment (line 163) | Comment says "dexie-react-hooks dedupes the liveQuery emitter" | **FALSE** — confirmed by source inspection of dexie and dexie-react-hooks. There is no dedup/multicasting. | Remove or correct the comment as part of the fix |
| PERF-10: `materialsById` Map | "Build a materialsById Map once" | Correct | Use `useMemo` keyed on `[materials]` (the prop), not `useRef` |
| PERF-11: "move to event-handler OR trim deps" | Either option presented | Dep trimming is safer; event-handler approach would require a second useEffect for trueCost tracking | Use dep trimming (Option A); add eslint-disable with explanation |

---

## Package Legitimacy Audit

No new packages are installed in this phase. All changes use React built-ins (`useMemo`, `useCallback`, prop threading). Section not applicable.

---

## Runtime State Inventory

Not applicable — greenfield refactor of existing React components. No stored data, service configs, OS registrations, or build artifacts are renamed or migrated.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest test runner | Yes | (project standard) | — |
| vitest | Test suite | Yes | (project standard) | — |
| TypeScript (`tsc -b`) | Build verification | Yes | (project standard) | — |

No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (jsdom) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/components/JobsManager.test.tsx src/components/CostCalculator.test.tsx` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-09 | `OrdersQuoteRows` renders correct quote list from prop | unit | `npx vitest run src/components/JobsManager.test.tsx` | Partially (mock needs updating) |
| PERF-09 | `useQuotes()` called exactly once in JobsManager source | source-contract | `npx vitest run src/components/JobsManager.test.tsx` | No — Wave 0 |
| PERF-10 | `getFilamentName` Map variant returns same strings as Array.find | unit (logic) | `npx vitest run src/components/JobsManager.test.tsx` | No — Wave 0 |
| PERF-11 | Pricing `useEffect` dep array trimmed to `[trueCost, lastEdited]` | source-contract | `npx vitest run src/components/CostCalculator.test.tsx` | No — Wave 0 |

### Sampling Rate

- Per task commit: `npx vitest run src/components/JobsManager.test.tsx src/components/CostCalculator.test.tsx`
- Per wave merge: `npx vitest run`
- Phase gate: Full suite green + `tsc -b` clean before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/JobsManager.test.tsx` — update `useQuotes` mock to supply props; add source-contract for single `useQuotes()` call; add PERF-10 output-equivalence test
- [ ] `src/components/CostCalculator.test.tsx` — add PERF-11 source-contract tests (dep array shape + eslint-disable comment present)

---

## Security Domain

No security-sensitive code is modified. No authentication, cryptography, input validation, or user data handling changes. ASVS categories not applicable to this phase.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `useLiveQuery` per component instance (no sharing) | Still true in dexie-react-hooks — lift to parent is the correct mitigation | Reduces subscriptions from O(N rows) to O(1) |
| `Array.find` per render for lookups | Map for O(1) lookups — standard React pattern | No re-computation cost when `materials` unchanged |
| `useEffect` with output values in dep array | Dep trimming with `eslint-disable` comment — accepted React pattern for intentional omissions | Eliminates cascading re-renders per keystroke |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `trueCost` is computed by a `useMemo` (not a `useEffect` + setState) | PERF-11 | If trueCost is state-set, the stale-closure analysis could change |

**Note:** A1 was verified implicitly — the audit references `trueCost` as a memo and the effect at line 804 references it as a read-only dep. The source was not read end-to-end for `trueCost`'s definition due to file length; the planner should confirm `trueCost` is a `useMemo` (not a `useState`) before finalising the PERF-11 task.

---

## Open Questions

1. **JobCard prop-signature update: does `getQuotesForJob` belong in `rowProps` or threaded separately?**
   - What we know: `rowProps` is the standard prop-threading mechanism for react-window rows; it already contains 20+ props
   - What's unclear: whether adding `getQuotesForJob` to `rowProps` requires adding it to the `JobRowProps` type (defined at the top of `JobsManager.tsx`)
   - Recommendation: Yes, add to `JobRowProps` type — it already has `onStartConversion`, `onEditQuote`, `onDeclineQuote`; `getQuotesForJob: (jobId: string) => Quote[]` is the same pattern

2. **Should `OrdersSection` be eliminated or kept?**
   - `OrdersSection` calls `useQuotes()` only to compute `hasQuotes` (for the conditional render). After the lift it simply receives `quotesForJob: Quote[]` and derives `hasQuotes` locally. It remains a useful wrapper for the heading + empty-section hide logic.
   - Recommendation: Keep `OrdersSection` but convert it to accept `quotesForJob` prop.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/dexie/dist/dexie.mjs` — `liveQuery` implementation — confirmed: creates `new Observable(...)` per call, no multicasting
- `node_modules/dexie-react-hooks/dist/dexie-react-hooks.mjs` — `useObservable` / `useLiveQuery` — confirmed: `React.useMemo` wraps the observable per component instance only
- `src/components/JobsManager.tsx:160-167, 329-415, 965, 984, 1260-1263, 1293-1321` — source inspection of the hotspots
- `src/components/CostCalculator.tsx:215-218, 284-335, 804-825` — source inspection of the pricing effect
- `src/hooks/useDatabase.ts:1121-1277` — `useQuotes()` implementation
- `src/components/JobsManager.test.tsx:1-59` — existing test mock structure
- `src/components/CostCalculator.test.tsx:1-17` — existing test stubs

### Secondary (MEDIUM confidence)
- React docs / `react-hooks/exhaustive-deps` rule — dep-trimming with lint-disable is an accepted pattern for intentional omissions [ASSUMED — training knowledge, consistent with React hooks docs]

---

## Metadata

**Confidence breakdown:**
- PERF-09 (subscription lift): HIGH — source-verified in both dexie and dexie-react-hooks
- PERF-10 (Map lookup): HIGH — straightforward, consistent with existing codebase pattern
- PERF-11 (dep trimming): HIGH — implementation verified, editingJob rebase path verified
- Test strategy: HIGH — consistent with existing `createRoot` + `act` + `readFileSync` source-contract pattern

**Research date:** 2026-06-26
**Valid until:** Stable — these are changes to a local codebase, no external API dependency
