---
phase: 22-jobsmanager-decomposition-perf
plan: 06
subsystem: hook
tags: [perf, hook, refactor, dexie, useLiveQuery, perf-07, hyg]

requires:
  - phase: 22-jobsmanager-decomposition-perf
    provides: "Plan 22-03 extracted RecordSaleModal — JobsManager.tsx already shrunk to 1474 LOC; Plan 22-05's perf bundle landed and left JobsManager.tsx at 1491 LOC, RecordSaleModal.tsx at 640 LOC, CustomerLibrary.tsx at 405 LOC. Plan 22-06 closes the final PERF-07 lift on top of that base."

provides:
  - "src/hooks/useDatabase.ts — new exported `useAllSales(): Sale[]` hook at line 666 (between useSales and useCustomers). Plain `Sale[]` return shape — explicit, not destructured."
  - "src/components/JobsManager.tsx — global sales subscription is now an explicit `useAllSales()` call (no longer a destructure-rename of `useSales()`); cumulative LOC = 1494 (ROADMAP success criterion #2 met)."
  - "src/components/JobsManager.test.tsx — vi.mock factory for '../hooks/useDatabase' now exposes `useAllSales: () => []` (plain Sale[] per D-24 / Pitfall 4)."
  - ".planning/ROADMAP.md — Phase 22 success criterion #1 prop list synced to the implemented D-06 signature; stale `customers, customersByEmail` references removed."

affects:
  - "phase 23 (test coverage hardening) — JobsManager.test.tsx mock factory now has the full hook surface; any future component test that needs the global sales array can rely on the documented `useAllSales: () => []` shape."

tech-stack:
  added: []
  patterns:
    - "Named-export single-purpose hook: when a multi-purpose hook (useSales(jobId)) exposes both a scoped CRUD surface and an implicit global read via no-arg invocation, lift the global-read branch into a dedicated hook with an explicit return type (Sale[]). Replaces destructure-rename idioms that hide intent. Mirrors useCustomers/useQuotes return-shape pattern."
    - "Atomic test-mock + consumer commit (D-27): consumer wiring and the matching vi.mock factory entry land in the same commit so the intermediate state can never run."

key-files:
  created: []
  modified:
    - "src/hooks/useDatabase.ts (961 → 983 LOC, +22 — new useAllSales hook + JSDoc block)"
    - "src/components/JobsManager.tsx (1491 → 1494 LOC, +3 — import addition + comment block; the call site itself is a 1-line swap)"
    - "src/components/JobsManager.test.tsx (one new mock entry + JSDoc comment, +6)"
    - ".planning/ROADMAP.md (one-line prop list replacement on Phase 22 success criterion #1)"

key-decisions:
  - "useAllSales returns Sale[] directly (not { sales: [...] }) per D-23(a). Mocking becomes `useAllSales: () => []` — a single-line array literal, no nested-object boilerplate. Production callers do `const allSales = useAllSales()` — intent is unambiguous."
  - "Empty dep array `[]` on the useLiveQuery — db.sales liveQuery already subscribes to changes, so the function body should never re-run. Mirrors the global branch of `useSales(undefined)` byte-identically."
  - "JobsManager.tsx kept `useSales(selectedJobId || undefined)` for the scoped CRUD surface (sales + deleteSale); the duplication was only on the global-read side. PERF-07 closure does not require migrating the scoped call."
  - "The `const { sales: allSales } = useSales()` destructure-rename pattern is gone from the production code. A documentary comment above the new `useAllSales()` call site explains the migration; the literal pattern is paraphrased (not quoted) to keep the grep gate clean."
  - "Atomic commit per D-27: JobsManager.tsx + JobsManager.test.tsx land together (commit `e085621`). Splitting them would have produced a transient `TypeError: useAllSales is not a function` state."
  - "ROADMAP.md edit is surgical — only criterion #1's prop list text changed. The criterion numbering, indentation, and the other 10 Phase 22 success criteria are untouched. Cross-checked against the live `RecordSaleModalProps` interface (9 fields, exact match)."

patterns-established:
  - "Explicit-named over destructure-rename for global-read hooks: when a hook is read-only and the consumer wants the data with no CRUD handlers, prefer a dedicated `useAll*` hook (Sale[] return) over destructure-renaming a CRUD hook (`const { sales: allSales } = useSales()`). The explicit form is searchable, mockable, and self-documenting."

requirements-completed: [PERF-07]

duration: 9min
completed: 2026-05-27
---

# Phase 22 Plan 06: useAllSales lift + JobsManager dedup + ROADMAP D-06 sync Summary

**Lifts the duplicate global `useSales()` subscription out of JobsManager into a dedicated `useAllSales(): Sale[]` hook (PERF-07 close); JobsManager now has exactly one scoped `useSales(selectedJobId)` for CRUD and one explicit `useAllSales()` for the global sales array — no more destructure-rename to obscure intent. Cumulative `wc -l JobsManager.tsx = 1494` clears the ROADMAP <1500 gate (success criterion #2). ROADMAP.md Phase 22 success criterion #1 RecordSaleModal prop list synced to the D-06 implemented signature. tsc -b clean; 428 passed + 1 todo (identical to pre-22-06 baseline). Manual UAT (break-even pill + revenue + Record Sale modal + Convert-from-Quote + CustomerLibrary search) is the outstanding human-verify gate — see ## CHECKPOINT REACHED below.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-27T16:53:00Z (worktree spawn)
- **Completed (code work):** 2026-05-27T17:00:33Z (Task 3 commit `b941f56`)
- **Tasks:** 3 of 3 code tasks complete; 1 manual-UAT checkpoint (Task 4) deferred to orchestrator
- **Files modified:** 4 (no new files created)
- **LOC delta:**
  - src/hooks/useDatabase.ts: 961 → 983 LOC (+22 — new useAllSales hook + 12-line JSDoc)
  - src/components/JobsManager.tsx: 1491 → 1494 LOC (+3 — `useAllSales` import + comment block; call site is a 1-line swap)
  - src/components/JobsManager.test.tsx: +6 (new mock entry + comment)
  - .planning/ROADMAP.md: 1 line replaced
  - Net code delta: +31 LOC (almost entirely comments/JSDoc; the executable surface change is a single function definition + a 1-line import swap + a 1-line call-site swap + a 1-line mock entry).

## Accomplishments

- **PERF-07 closed (CODE-AUDIT #30):** `useAllSales(): Sale[]` exported from useDatabase.ts at line 666, inserted between `useSales` (569) and `useCustomers` (676). Body mirrors the no-arg branch of `useSales(undefined)` byte-identically: `useLiveQuery(() => db.sales.orderBy('soldAt').reverse().toArray(), [])`. JobsManager's `const { sales: allSales } = useSales()` destructure-rename at line 985 (pre-22-06) is replaced by `const allSales = useAllSales()` — explicit, named, and aligns with the existing useCustomers / useQuotes return-shape pattern for non-CRUD reads. Audit verified zero other no-arg `useSales()` callers exist in `src/` (the two remaining grep hits at `src/components/RecordSaleModal.tsx:339` and `src/db/backfill.ts:400` are JSDoc reference text, not executable calls).
- **ROADMAP success criterion #2 (cumulative <1500 LOC) closed:** `wc -l src/components/JobsManager.tsx = 1494` after this plan's edits. Pre-22-06 base was 1491; the +3 delta is one import addition + a 3-line documentary comment above the new call site. The cumulative Phase 22 reduction from 2067 → 1494 LOC is **-573 LOC / -27.7%** vs. start of phase.
- **ROADMAP success criterion #1 (prop list documentation) closed:** Phase 22 success criterion #1 RecordSaleModal prop list now reads `{ job, userProfile, userCurrency, shippingConfig, editingSale, convertingFromQuote, isOpen, onClose, onSaved? }` (9 fields) — exact match to the live `RecordSaleModalProps` interface at `src/components/RecordSaleModal.tsx:58-68`. Stale `customers, customersByEmail` reference removed.
- **Test mock update (D-24 / Pitfall 4):** `JobsManager.test.tsx` vi.mock factory adds `useAllSales: () => []` — plain `Sale[]`, NOT `{ sales: [] }`. Comment in the test file documents the shape gate. Atomic commit with the consumer change (D-27) — intermediate state where consumer was updated but mock was not would have surfaced as `TypeError: useAllSales is not a function`.
- **Build / test green:** `npx tsc -b` exits 0. Full vitest 428 passed + 1 todo (identical to pre-22-06 baseline 428/1). JobsManager.test.tsx 31/31. No regressions across the 28 test files.

## Task Commits

1. **Task 1: Add useAllSales hook to useDatabase.ts** — `7dd5322` (feat)
2. **Task 2: Replace duplicate useSales() in JobsManager + update test mock + cumulative <1500 LOC assertion** — `e085621` (perf, atomic per D-27)
3. **Task 3: Update ROADMAP.md Phase 22 success criterion #1 prop list (D-06 sync)** — `b941f56` (docs)
4. **Task 4: Manual UAT — break-even pill + revenue numbers match pre-Phase-22 behavior** — **DEFERRED to orchestrator (checkpoint:human-verify, blocking)**. See `## CHECKPOINT REACHED` below.

## Files Created/Modified

### Modified

- **`src/hooks/useDatabase.ts`** (961 → 983 LOC, +22) — One addition: new exported `useAllSales(): Sale[]` function at line 666, immediately after the closing `}` of `useSales(jobId?)` (which ends at line 650) and before the `// Hook for customer library (Phase 15.1 — D-03 + UI-SPEC discretion #15).` comment block above `useCustomers` (which now starts at line 676). The function body is 5 lines (useLiveQuery + return), plus a 12-line JSDoc block documenting PERF-07 closure rationale. Imports unchanged — `useLiveQuery`, `db`, and `Sale` were already imported (lines 2, 3, 4). No other function in useDatabase.ts was modified.

- **`src/components/JobsManager.tsx`** (1491 → 1494 LOC, +3) — Three coordinated edits:
  - Line 5: import statement updated from `import { useSales, useQuotes } from '../hooks/useDatabase';` to `import { useSales, useAllSales, useQuotes } from '../hooks/useDatabase';`.
  - Line 985 (pre-22-06: `const { sales: allSales } = useSales();`) → replaced with a 3-line documentary comment + `const allSales = useAllSales();` (1-line call). Net +3 lines.
  - No other call site in JobsManager.tsx references `useSales()` (no-arg). The scoped CRUD call `useSales(selectedJobId || undefined)` is untouched on line 984.

- **`src/components/JobsManager.test.tsx`** (+6) — One mock factory entry added to `vi.mock('../hooks/useDatabase', ...)`:
  ```typescript
  // D-24 / Pitfall 4: useAllSales returns a plain Sale[] (NOT { sales: [] }) —
  // mirrors the production hook contract in useDatabase.ts. Getting the shape
  // wrong here surfaces as `TypeError: useAllSales is not a function` or
  // runtime errors when JobsManager destructures non-existent properties.
  useAllSales: () => [],
  ```
  Inserted adjacent to the existing `useSales: () => ({...})` entry (line 47-52 pre-22-06). The `useCustomers` / `useQuotes` / `useSales` mock entries are unchanged.

- **`.planning/ROADMAP.md`** (1 line replaced) — Phase 22 "Success Criteria" criterion #1 (line 145) updated from `accepts props { ..., customers, customersByEmail, onSave, onClose }` to the actual D-06 implemented signature `{ job, userProfile, userCurrency, shippingConfig, editingSale, convertingFromQuote, isOpen, onClose, onSaved? }` with a parenthetical noting that `customers/customersByEmail` are not on the prop surface (RecordSaleModal subscribes to useCustomers internally per D-06). Criterion numbering and surrounding criteria untouched.

## Decisions Made

1. **`useAllSales(): Sale[]` return shape — plain array, not `{ sales: [...] }`.** Per D-23(a). Reasoning: when a consumer needs only a read with no CRUD handlers, the destructure-rename pattern (`const { sales: allSales } = useSales()`) obscures intent and adds boilerplate. A dedicated hook with `Sale[]` return matches the implicit contract `useCustomers().customers` already exposes (the customers array is just the consumed value; the destructure isn't telling you anything). Mocking becomes a 1-character literal: `() => []`.

2. **Empty dep array on the useLiveQuery — mirrors the global branch of useSales(undefined).** db.sales liveQuery already subscribes to all sale-table changes, so the function body should never re-run. Identical to the existing useCustomers / useAllSettings / useQuotes pattern in the same file.

3. **JSDoc block documents PERF-07 closure intent inline.** Future readers can find the rationale (PERF-07 + the JobsManager.tsx:984-985 reference) without grepping the planning docs. Mirrors the JSDoc style on the other useDatabase.ts hooks (useCustomers has a similar 5-line header).

4. **D-27 atomic commit for Task 2.** JobsManager.tsx (consumer) and JobsManager.test.tsx (mock) land in the same commit `e085621`. Splitting them would have produced a transient broken state: with the mock updated first, the consumer's destructure-rename would survive (works against the old `useSales: () => ({sales: []})` mock); with the consumer updated first, the production code's `useAllSales is not defined` would surface as a TypeScript error, but no test would have caught it because the mock factory wouldn't include the new entry yet.

5. **Documentary comment on the new call site, not the old pattern verbatim.** My initial first-pass comment quoted the old destructure-rename pattern in the comment. This tripped the literal acceptance-criterion grep (`grep -cE "const \{ sales: allSales \} = useSales\(\)"`) — the grep matched the comment, not the production code. Paraphrased the comment to describe the migration without quoting the literal pattern; final grep count is `0` (true zero, not false-positive zero).

6. **Cumulative LOC budget: +3 net on JobsManager.tsx (1491 → 1494).** Well clear of the <1500 ROADMAP gate. Plan 22-05's SUMMARY warned of "~9 LOC of slack" — Task 2 consumes 3 of that 9, leaving 6 LOC of slack. No additional trimming required; the cumulative target is met without invoking the "if close, trim further" fallback in the plan's Step 4.

7. **ROADMAP.md edit is surgical — only criterion #1 prop list changed.** No restructure, no renumbering, no other criterion touched. Per the orchestrator's spawn prompt, this is the ONE ROADMAP edit permitted in plan 22-06; all other phase tracking writes are deferred to the orchestrator.

8. **No NewBadge entry added.** Pure hygiene/perf milestone — zero user-visible UI change per project memory rule ("If end users will never see the change ... DO NOT add an entry to `src/features.ts`"). Future user-perceptible improvements bundled into desktop release tags surface via the release process, not features.ts.

## Deviations from Plan

### Annotations (not deviations — first-pass adjustments folded into the same commit)

**1. [Annotation] First-pass call-site comment briefly tripped the criterion-#3 grep gate**
- **Found during:** Task 2 verification, after Edit.
- **Issue:** My initial comment above the new `const allSales = useAllSales()` call quoted the old destructure-rename pattern literally — `\`const { sales: allSales } = useSales()\`` inside backticks. The acceptance criterion `grep -cE "const \{ sales: allSales \} = useSales\(\)" == 0` matched the comment, not the production code.
- **Fix:** Paraphrased the comment to "replacing the previous destructure-rename of the no-arg useSales hook" — no literal pattern reproduction. Re-ran the grep; result is `0` (true zero).
- **Files modified:** `src/components/JobsManager.tsx`
- **Commit:** folded into Task 2 commit `e085621` before staging.

### Worktree environment fix

**1. [Worktree environment fix] Ran `npm install` to seed worktree `node_modules`**
- **Found during:** baseline check before Task 1.
- **Issue:** Worktree spawned without `node_modules`; tsc -b would have flooded output with module-not-found errors and masked any real diagnostics on the new useAllSales code.
- **Fix:** `npm install --no-audit --no-fund --prefer-offline` — 648 packages in 5s. Standard worktree bootstrap (same pattern documented in plan 22-03 and 22-05 SUMMARYs). Not a plan deviation — Rule 3's package-install exclusion targets *new* packages, not bootstrapping existing ones.
- **Files modified:** none (node_modules is gitignored).
- **Commit:** none — environment-only.

No Rule 1 (bug) / 2 (missing critical functionality) / 3 (blocking issue) / 4 (architectural) deviations. No new auth gates. No surprises from the perf landed by plan 22-05.

## Authentication Gates

None — pure code-only execution. No external services, no API keys, no auth-protected resources touched.

## Issues Encountered

None of substance. Two procedural notes documented above:
- The first-pass call-site comment tripped a literal-text acceptance grep — paraphrased and re-verified before commit (annotation #1).
- Worktree `node_modules` needed seeding before tsc could run cleanly (standard bootstrap).

## User Setup Required

None.

## TDD Gate Compliance

This plan is `type: execute` (not `type: tdd`) and individual tasks do not carry `tdd="true"`. The MVP+TDD gate from `execute-mvp-tdd.md` does not apply. Verification of behavioral correctness relies on:
- Existing `JobsManager.test.tsx` 31-test suite (which exercises the JobCard render path that reads `salesByJob`, derived from `allSales` — now sourced from `useAllSales()`).
- Existing `RecordSaleModal.test.tsx` 9-test suite (which exercises RecordSaleModal in isolation — unaffected by this plan).
- The mandatory **Task 4 manual UAT** (break-even pill + revenue numbers + Record Sale modal + Convert-from-Quote + CustomerLibrary search) covers the cumulative Phase 22 visual contract.

## Threat Flags

None — pure structural refactor. No new network, file, auth, or schema surface. The `useAllSales` hook reads from `db.sales` via the same `useLiveQuery` mechanism the codebase has used since Phase 1; the only DB-write surface in this plan is none (no writes added or removed).

## Known Stubs

None — every change rewires an existing data flow into a more explicit form; no placeholders, no TODOs, no empty-data fallbacks introduced. The `?? []` fallback in `useAllSales` mirrors the production behavior of every other useLiveQuery-backed hook in `useDatabase.ts`.

## Deferred Issues

None.

## Next Phase Readiness

- **Phase 22 complete after Task 4 UAT approval:** all 10 requirement IDs (HYG-02/03/06/07/08, PERF-01/02/03/04/07) closed in plans 22-01 through 22-06. ROADMAP success criteria 1-11 met (criterion #11 — new RecordSaleModal test file — was delivered by plan 22-03's RecordSaleModal.test.tsx).
- **Phase 23 (test coverage hardening) can start once Phase 22 closes.** The decomposed structure makes the 3 missing Customer-UI test files (CustomerEditModal, CustomerCsvImportModal, CustomerLibrary) easier to author against — no inline 600-LOC modal blocks to contend with.
- **JobsManager.test.tsx mock factory is now complete** for the surfaces JobsManager consumes. Any Phase 23 component test that mounts JobsManager will inherit the documented `useAllSales: () => []` mock shape.
- **Plan 22-06's cumulative LOC slack:** +6 LOC of headroom remain under the <1500 gate. Future micro-touches to JobsManager.tsx have a small but non-zero budget; significant additions should be extracted to new files or hooks.

---

## CHECKPOINT REACHED

**Type:** human-verify
**Plan:** 22-06
**Progress:** 3/4 tasks complete (Task 4 is the deferred manual UAT)

### Completed Tasks

| Task | Name                                                                                     | Commit    | Files                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| 1    | Add useAllSales hook to useDatabase.ts                                                   | `7dd5322` | src/hooks/useDatabase.ts                                                                               |
| 2    | Replace duplicate useSales() in JobsManager + update test mock + cumulative <1500 assert | `e085621` | src/components/JobsManager.tsx, src/components/JobsManager.test.tsx                                    |
| 3    | Update ROADMAP.md Phase 22 success criterion #1 prop list (D-06 sync)                    | `b941f56` | .planning/ROADMAP.md                                                                                   |
| 4    | Manual UAT — break-even pill + revenue + Record Sale + Convert-from-Quote + CL search    | DEFERRED  | (no files modified — verification only)                                                                |

### Current Task

**Task 4:** Manual UAT — break-even pill + revenue numbers match pre-Phase-22 behavior
**Status:** awaiting verification (human-only — executor cannot render the UI)
**Blocked by:** human verification gate per checkpoint:human-verify protocol

### Checkpoint Details

**What was built:**

PERF-07 closure (the global `useSales()` duplication at `JobsManager.tsx:984-985` is replaced by an explicit `useAllSales(): Sale[]` hook), the cumulative Phase 22 LOC target (`JobsManager.tsx < 1500`, now 1494), and the D-06 ROADMAP prop-list sync. Additionally, Phase 22 as a whole reorganized rendering paths: `breakEvenMap` (PERF-01, plan 22-05) replaced per-call `getBreakEvenInfo` recomputation; the `<RecordSaleModal>` (22-03) and `<SaleRow>` (22-04) extractions changed the JSX tree composition. This is the **only manual UAT for Phase 22** — it confirms the cumulative behavior is identical to the pre-phase baseline.

**Why the executor cannot complete Task 4:**

Plan 22-06 is `autonomous: false` and Task 4 is `type="checkpoint:human-verify" gate="blocking"`. The orchestrator's spawn prompt explicitly instructs the executor: *"For the manual UAT portions, do NOT attempt to render the UI. Stop at the relevant boundary, write a checkpoint structured-state return per checkpoints.md, and surface what the human needs to confirm."* The UAT requires running `npm run dev` on port 4173, navigating to the Jobs Manager tab with real IndexedDB data, and visually confirming five contracts (A–E below). This must be performed by a human.

### Awaiting

The human verifier needs to:

1. **Kill any running dev server first** (project rule):
   ```bash
   lsof -i :4173 | grep LISTEN | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
   ```
2. **Start the dev server:** `npm run dev` (port 4173, pinned).
3. **Open** `http://localhost:4173` and navigate to the **Jobs Manager** tab.
4. **Pre-check:** IndexedDB should contain real data (jobs + sales). If empty, import a backup or create at least 3 jobs with mixed states: one with no sales, one partway to break-even, one over break-even.
5. **Verify the 5 visual contracts:**
   - **Contract A — break-even pill values:** For each visible job row, the colored "X / Y break-even" pill shows correct text + color (neutral when no sales; warning when partway; success/green when revenue >= cost). No NaN, undefined, or $0.00 when sales exist; no wrong colors.
   - **Contract B — recent sales list:** Click into a job that has sales; expand the recent sales accordion. Each sale row shows `{quantity}x @ ${price} ({customerName})` summary + right-aligned `${totalRevenue.toFixed(2)}` + (when applicable) `(from quote Q-NNNN)` subtext. Clicking into a sale's `<details>` rotates the chevron, expands the customer block, and shows Edit/Delete buttons.
   - **Contract C — Record Sale modal:** Click "Record Sale" on a job. Modal opens via the new `<RecordSaleModal>`. Customer picker: typing opens dropdown, ArrowDown navigates, Enter picks → Name/Email/Company/Address populate, Notes stays empty (D-05). Escape closes dropdown first, then modal on second press (no double-close glitch). Fill fields, click Save → new sale recorded; recent sales list updates; break-even pill refreshes.
   - **Contract D — Convert from Quote:** Find a job with a Pending quote (or create one via Print Quote). Click "Convert to Sale". Modal opens with the blue "Converting Q-NNNN — review and adjust if needed." helper banner. Save → new Sale appears in recent sales; Quote disappears from Pending list; job's copiesSold counter increments by saved quantity.
   - **Contract E — CustomerLibrary search (PERF-04):** Navigate to the Customer Library tab. Pre-check: >5 customers with varied address/notes lengths. Type into the search box and progressively narrow. Filtered list's row heights should compute correctly for each filtered subset — no visible "stale tall row" from a previously-visible customer leaking into the new layout.
6. **Verdict:**
   - All 5 contracts visually identical to pre-Phase-22? → Type **"approved"**
   - Any deltas? → Describe the issue + the affected contract.

**Re-start instructions if dev server crashes:** `npm run dev` (it auto-reloads on file change; port 4173 should be free if the kill at step 1 worked).

### Note on SUMMARY.md timing (executor → orchestrator handoff)

The plan's `<output>` block says SUMMARY.md should be created only after Task 4 UAT approval. **The orchestrator's spawn prompt, however, requires SUMMARY.md to be committed before the worktree is force-removed** (the worktree is destroyed when this executor returns, so a deferred SUMMARY.md would be lost — no continuation agent could recover it). This SUMMARY is therefore committed now with Task 4 documented as the outstanding human-verify gate. If the UAT verdict is **approved**, the orchestrator can close Phase 22 / mark PERF-07 done with no further executor pass. If the UAT surfaces issues, the orchestrator can author a follow-up task (gap-closure plan) referencing this SUMMARY as the pre-UAT baseline.

---

## Self-Check: PASSED

- `src/hooks/useDatabase.ts` — modified (961 → 983 LOC) — FOUND
  - `grep -c '^export function useAllSales' src/hooks/useDatabase.ts` = 1 — PASS
  - `grep -c "function useAllSales(): Sale\\[\\]" src/hooks/useDatabase.ts` = 1 — PASS
  - `grep -c "db.sales.orderBy('soldAt').reverse().toArray()" src/hooks/useDatabase.ts` = 2 (useSales global branch + useAllSales) — PASS
  - Order check `grep -nE 'export function use(Sales|AllSales|Customers)\b' src/hooks/useDatabase.ts` = `569: useSales`, `666: useAllSales`, `676: useCustomers` (correct order) — PASS
- `src/components/JobsManager.tsx` — modified (1491 → 1494 LOC, < 1500 ROADMAP gate) — FOUND
  - `grep -c 'useAllSales' src/components/JobsManager.tsx` = 3 (1 import + 1 call + 1 comment ref) — PASS (≥ 2 required)
  - `grep -c 'const allSales = useAllSales()' src/components/JobsManager.tsx` = 1 — PASS
  - `grep -cE "const \{ sales: allSales \} = useSales\(\)" src/components/JobsManager.tsx` = 0 (production code AND comments clean) — PASS
  - `wc -l src/components/JobsManager.tsx` = 1494 < 1500 — PASS (ROADMAP success criterion #2)
- `src/components/JobsManager.test.tsx` — modified (mock factory + JSDoc comment)
  - `grep -cE "useAllSales:\s*\(\)\s*=>\s*\[\]" src/components/JobsManager.test.tsx` = 1 — PASS
  - `grep -c '@testing-library/react' src/components/JobsManager.test.tsx` = 0 (project convention preserved) — PASS
- `.planning/ROADMAP.md` — modified (1 line)
  - `grep -c "customers, customersByEmail" .planning/ROADMAP.md` = 0 — PASS
  - `grep -c "editingSale, convertingFromQuote, isOpen, onClose" .planning/ROADMAP.md` = 1 — PASS
- Commit `7dd5322` (Task 1, feat) — FOUND in `git log`
- Commit `e085621` (Task 2, perf, atomic) — FOUND in `git log`
- Commit `b941f56` (Task 3, docs) — FOUND in `git log`
- `npx tsc -b` exits 0 — PASS
- `npx vitest run` → 428 passed + 1 todo (identical to pre-22-06 baseline) — PASS
- JobsManager.test.tsx 31/31 — PASS (mock + consumer atomic; no `TypeError: useAllSales is not a function`)
- No other no-arg `useSales()` consumers outside JobsManager (verified — RecordSaleModal.tsx:339 and src/db/backfill.ts:400 are JSDoc reference text) — PASS

---
*Phase: 22-jobsmanager-decomposition-perf*
*Plan: 06*
*Completed (code work): 2026-05-27 — Task 4 manual UAT pending human verification*
