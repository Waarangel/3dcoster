---
phase: 36-performance-tier-5
verified: 2026-06-26T10:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Type a value into a cost input (filament grams, electricity rate, etc.) and watch price/profit/margin"
    expected: "Fields update once and settle — no visible double-flicker or secondary re-derivation cycle"
    why_human: "Double-render is a timing artifact visible in devtools or via React DevTools profiler, not observable in static code analysis"
  - test: "Open a job for editing (click pencil) — observe the Editing banner and check the profit + margin fields"
    expected: "Profit and margin rebase correctly against the current trueCost after filaments reconcile; the saved sellingPrice is the anchor, not a stale margin"
    why_human: "The editingJob rebase path involves async Dexie reconciliation; the closure-at-effect-time correctness of the dep-trimmed array can only be confirmed by observing live state transitions"
  - test: "With 10+ job rows visible, write/update a quote on any job and observe JobsManager responsiveness"
    expected: "The list does not stutter or visibly lag — only one re-render cycle, not N (one per row)"
    why_human: "Subscription count reduction from O(N rows) to O(1) is a runtime improvement; no static analysis can prove perceived performance"
---

# Phase 36: Performance Tier 5 — Verification Report

**Phase Goal:** Remove the three render/subscription hotspots that bite at scale so the Jobs and Calculator surfaces stay responsive with large datasets, with no behavioral change.
**Verified:** 2026-06-26T10:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `useQuotes()` is lifted to the `JobsManager` parent; a single subscription covers the whole list | ✓ VERIFIED | `JobsManager.tsx:1011` — only one actual `useQuotes()` call exists (grep confirmed; 5 other hits are comments/JSDoc); `getQuotesForJob` callback at `:1017-1020` is `useCallback([quotesByJobId])`; `rowProps` dep array at `:1372` includes both `getQuotesForJob` and `updateQuoteFromHook` |
| 2 | `getFilamentName` resolves via a `materialsById` Map (O(1)) with identical output including `'Unknown'` fallback | ✓ VERIFIED | `JobsManager.tsx:1301-1309` — `materialsById` is `useMemo(() => new Map(materials.map(m => [m.id, m])), [materials])`; `getFilamentName` uses `materialsById.get(filamentId)`; string format and `'Unknown'` fallback are character-identical to former `Array.find` version; no `materials.find` call remains in that function |
| 3 | Pricing `useEffect` dep array trimmed to `[trueCost, lastEdited]`; no double-render per keystroke | ✓ VERIFIED | `CostCalculator.tsx:832` — dep array is exactly `}, [trueCost, lastEdited]);`; PERF-11 rationale comment at `:825-831`; `// eslint-disable-next-line react-hooks/exhaustive-deps` at `:831`; effect body (guard + three branches) unchanged at `:804-824`; `trueCost` is a plain derived const at `:559` (no async setter) |

**Score: 3/3 truths verified**

---

### Behavioral Equivalence Audit

**PERF-09 behavioral equivalence:**

- `OrdersQuoteRows` component: `quotesForJob` prop is now the data source; no internal `useQuotes()` call remains. The `visible` filter (`quoteStatusToPill !== null`) is applied to the prop at `:352` — identical filter to the former `quotesByJobId.get(jobId) ?? []` derivation.
- `OrdersSection` component: `quotesForJob` prop drives `visibleQuotes`/`hasQuotes` at `:409-412` — same logic, same guard (`!hasQuotes && !hasSales`).
- Reopen action at `:371-374`: calls `updateQuote` prop with `{ ...quote, status: 'sent', decisionAt: undefined, declineReason: undefined }` — same payload as before, same path to `db.quotes.put` through `updateQuoteFromHook`.
- Non-virtualized fallback at `:1559-1586`: `getQuotesForJob` and `updateQuote: updateQuoteFromHook` are both passed — this render path was caught by `tsc -b` (auto-fixed in commit `26a4d95`).
- The false dedup comment claiming `dexie-react-hooks` deduplicates subscriptions has been replaced at `:167-171` with a correct note that the parent holds the single subscription.
- `jobId` kept in `OrdersQuoteRows` type signature (renamed to `_jobId` in destructure) for API stability.

**PERF-10 behavioral equivalence:**

- Map format: `new Map(materials.map(m => [m.id, m]))` — same key (material id), same value (full material object).
- Lookup expression: `filament ? \`${filament.brand || ''} ${filament.filamentType || filament.name}\`.trim() : 'Unknown'` — character-identical to the former `Array.find` version.
- `getFilamentName` dep array is now `[materialsById]` instead of `[materials]`; identity is stable whenever `materials` is unchanged (a strict improvement — `materialsById` ref is stable, `getFilamentName` ref is stable, `rowProps` is not invalidated on unrelated renders).

**PERF-11 behavioral equivalence:**

- Effect body at `:804-824` is unchanged: `trueCost <= 0` guard, `lastEdited === 'margin'` / `'profit'` / `'price'` branches, all `set*` calls identical.
- `editingJob` rebase path confirmed intact: `CostCalculator.tsx:319` still calls `setLastEdited('price')` in the editingJob population effect, which triggers the pricing effect to re-derive `targetProfit` and `profitMarginPercent` against current `trueCost`.
- Stale-closure safety confirmed: `trueCost` is a plain derived const (`:559` — `costs.failureAdjusted + totalShippingCost`); `costs` is a `useMemo`; there is no async setter. React 18 batches all `setState` calls in event handlers before the effect commits, so the closure is never stale at keystroke time.
- eslint-disable is correctly scoped to one line (`// eslint-disable-next-line react-hooks/exhaustive-deps`) immediately before the dep array closing line `:832`.

**Behavioral equivalence verdict: PASS on all three refactors — no silent behavioral change found.**

---

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `src/components/JobsManager.tsx` | ✓ VERIFIED | Single `useQuotes()` call; `materialsById` Map; `getQuotesForJob` callback; `OrdersSection`/`OrdersQuoteRows` use props, not hook; both JobCard render paths pass required props |
| `src/components/JobsManager.test.tsx` | ✓ VERIFIED | PERF-09 describe block at line 1405: renders-from-prop, empty-state, Reopen tests; source-contract test at line 1459 asserting single call; PERF-10 describe block at line 1479: 3 output-equivalence cases (brand+type, name-fallback, Unknown) |
| `src/components/CostCalculator.tsx` | ✓ VERIFIED | Dep array `[trueCost, lastEdited]` at line 832; PERF-11 rationale comment at lines 825-831; eslint-disable-next-line at line 831; effect body lines 804-824 unchanged |
| `src/components/CostCalculator.test.tsx` | ✓ VERIFIED | PERF-11 describe block at line 78: 6 source-contract tests covering dep array shape, removed-deps absent from dep line, eslint-disable comment, PERF-11 token, guard, three branch keywords |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `JobsManager useQuotes()` single call | `OrdersSection` / `OrdersQuoteRows` `quotesForJob` prop | `getQuotesForJob(jobId)` callback threaded through `rowProps` → `JobRow` → `JobCard` | ✓ WIRED | `:1011` (call) → `:1017` (callback) → `:1348` (rowProps) → `:783` (JobCard passes to OrdersSection) → `:419` (OrdersSection passes to OrdersQuoteRows) |
| `JobsManager updateQuoteFromHook` | `OrdersQuoteRows` Reopen handler | `updateQuote` prop threaded through `rowProps` → `JobCard` → `OrdersSection` → `OrdersQuoteRows` | ✓ WIRED | `:1011` (destructured) → `:1349` (rowProps) → `:784` (JobCard) → `:420` (OrdersSection) → `:338` (OrdersQuoteRows prop) → `:373` (Reopen handler) |
| `getFilamentName` | `materialsById` Map | `materialsById.get(filamentId)` | ✓ WIRED | `:1301` (Map built) → `:1307` (.get call) → `:1309` (useCallback dep) |
| Pricing `useEffect` | `[trueCost, lastEdited]` dep array | dep array at closing line | ✓ WIRED | `:832` — exact form `}, [trueCost, lastEdited]);` confirmed |

---

### Data-Flow Trace (Level 4)

Not applicable for this phase — no components that render dynamic data from remote APIs were added. The refactors are internal to existing components; data sources (Dexie subscriptions, `materials` prop, `trueCost` derived const) are unchanged.

---

### Behavioral Spot-Checks

Step 7b — the phase produces no new runnable entry points. The key spot-check is the test suite.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite (744 tests per SUMMARY) | `npx vitest run` (run by executor, not re-run in this verification) | 744 passed / 0 failures (reported in 36-02-SUMMARY) | ✓ PASS (trust: executor self-check + tsc -b + lint gates all green per SUMMARYs; commits verified to exist) |
| tsc -b | `tsc -b` | Exit 0 (confirmed in both SUMMARYs) | ✓ PASS |
| npm run lint | `npm run lint` | 0 errors, 21 pre-existing warnings (36-02-SUMMARY); exhaustive-deps warning on pricing effect correctly silenced | ✓ PASS |

---

### Probe Execution

Step 7c — no probe scripts declared in either PLAN or SUMMARY. No `scripts/*/tests/probe-*.sh` files relevant to this phase. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERF-09 | 36-01-PLAN.md | `useQuotes()` lifted to parent; one subscription per list | ✓ SATISFIED | Single `useQuotes()` call at `JobsManager.tsx:1011`; `quotesForJob` prop chain intact; source-contract test asserts exactly 1 non-comment call |
| PERF-10 | 36-01-PLAN.md | `getFilamentName` via `materialsById` Map (O(1)) | ✓ SATISFIED | `useMemo` Map at `:1301`; `.get()` at `:1307`; no `materials.find` in that function; output-equivalence tests pass |
| PERF-11 | 36-02-PLAN.md | Pricing `useEffect` dep array trimmed to `[trueCost, lastEdited]` | ✓ SATISFIED | Dep array at `CostCalculator.tsx:832`; old fat dep array absent; 6 source-contract tests confirm shape, guard, branches, eslint-disable, PERF-11 token |

---

### Anti-Patterns Found

Scanned modified files for stub/debt markers:

| File | Pattern | Finding |
|------|---------|---------|
| `src/components/JobsManager.tsx` | TBD/FIXME/XXX | None found |
| `src/components/JobsManager.tsx` | `TODO` | Pre-existing only (not introduced by this phase) |
| `src/components/JobsManager.tsx` | `return null` / empty impl | `OrdersQuoteRows` returns `null` when `visible.length === 0` — this is correct conditional rendering, not a stub |
| `src/components/CostCalculator.tsx` | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Intentional, scoped to one line, with PERF-11 rationale — not a debt marker |
| `src/components/JobsManager.test.tsx` | stub patterns | None — all tests are substantive with real assertions |
| `src/components/CostCalculator.test.tsx` | `it.todo` | Pre-existing stub `'CostCalculator tests TBD — PDF button retired per D-13'` — not introduced by this phase; pre-dates Phase 36 |

**No new debt markers or stubs introduced by this phase.**

---

### Human Verification Required

The automated checks (tsc, vitest, lint) and static code analysis confirm the structural correctness of all three refactors. Three runtime behaviors require human observation:

#### 1. PERF-11 Double-Render Elimination

**Test:** Open the calculator, type a series of values into cost inputs (filament grams, electricity rate, print time). Watch price, profit, and margin fields.
**Expected:** Each keystroke produces exactly one update — the three derived fields update simultaneously with no visible secondary flicker or re-derivation.
**Why human:** The double-render was a timing artifact (two effect runs per keystroke). Static analysis confirms the dep array is trimmed and the closure is safe, but the actual single-render behavior can only be confirmed at runtime (or via React DevTools Profiler showing one commit per keystroke).

#### 2. editingJob Rebase Path

**Test:** Create a job with a specific selling price (e.g. $25.00). Change the electricity rate in Settings so the trueCost changes. Then click the edit pencil on that job.
**Expected:** The calculator opens with sellingPrice=$25.00 anchored. Profit and margin fields then rebase to reflect the new trueCost — they do NOT remain at the historically-saved margin%. The "Editing..." banner scrolls into view.
**Why human:** The rebase path involves `setLastEdited('price')` in the editingJob effect triggering the pricing effect, which reads `sellingPrice` via closure at the moment trueCost settles. This multi-effect sequence is not practically testable without mounting the full CostCalculator (Dexie + ~30 props). The source-contract analysis confirms the rebase seeds are intact, but correctness under varying trueCost values requires live observation.

#### 3. PERF-09 Subscription Scale Reduction

**Test:** With 10 or more job rows visible (or use React DevTools Profiler), update a quote on one job (e.g. Reopen a declined quote). Observe list responsiveness.
**Expected:** The list re-renders once per quote write — not once per visible row. With React DevTools Profiler, only the rows whose data changed should show a "why did this render?" commit.
**Why human:** The subscription count reduction from O(N rows) to O(1) is a runtime metric. Static analysis confirms the architecture is correct, but confirming perceived performance improvement requires devtools observation or a performance profile.

---

### Gaps Summary

No gaps found. All three requirements (PERF-09, PERF-10, PERF-11) are verified to be structurally correct, substantively implemented, and correctly wired. Behavioral equivalence is confirmed by source-contract and output-equivalence tests plus direct code inspection.

The phase has three human verification items for runtime confirmation of (a) the double-render elimination, (b) the editingJob rebase path, and (c) the subscription reduction at scale. These are verification items, not gaps — the implementation is correct. Status is `human_needed` per the verification decision tree (Step 9).

---

_Verified: 2026-06-26T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
