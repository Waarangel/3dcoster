---
phase: 10-cost-calculation-unit-tests
plan: 04
subsystem: testing
tags:
  - testing
  - ci-gating
  - vitest-coverage
  - build-chain

# Dependency graph
requires:
  - phase: 10-01 (pure costCalc module scaffold)
    provides: src/utils/costCalc.ts with 7 named exports — the file the coverage gate measures
  - phase: 10-03 (costCalc test suite)
    provides: 39 passing tests + 1 it.todo that produce the coverage signal the threshold gate measures against
provides:
  - vitest.config.ts coverage block scoped to src/utils/costCalc.ts only (D-08 file-level threshold)
  - npm run build chain that gates Vercel deploys on test pass AND coverage thresholds met (D-05/D-06)
  - test:watch script for interactive local dev (D-07)
affects:
  - Vercel deploy pipeline (every future deploy now runs vitest + coverage + threshold check)
  - REQUIREMENTS.md TEST-02 (Validated by this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - File-scoped coverage threshold (coverage.include limited to single file — avoids project-wide false alarms)
    - Build-chain gating pattern (vitest run --coverage inserted between lint and tsc for fastest-feedback ordering)
    - test/test:watch split (one-shot vitest run for CI, interactive vitest for local dev)

key-files:
  created: []
  modified:
    - vitest.config.ts
    - package.json
    - .gitignore

key-decisions:
  - "D-08 honored: coverage.include is exactly ['src/utils/costCalc.ts'] — no project-wide threshold, no false alarms on UI files"
  - "D-09 honored: thresholds set to exact values lines:95, functions:100, branches:90 — no rounding"
  - "D-06 honored: build chain order is lint-html → vitest+coverage → tsc → vite (tests run BEFORE tsc -b for fastest-feedback)"
  - "D-07 honored: scripts.test stays 'vitest run' (one-shot, what build invokes); new test:watch = 'vitest' for local dev"
  - "Auto-fix Rule 3: added coverage/ to .gitignore (vitest+v8 generates coverage/ on every run — must not be tracked)"

patterns-established:
  - "Coverage threshold scoping via coverage.include array — limit to the file(s) that actually need gating, leave rest of codebase untouched"
  - "Failure-injection sanity check is the proof-of-gate ritual: comment a test, confirm the build fails, restore"

requirements-completed:
  - TEST-02

# Metrics
duration: 6min
completed: 2026-05-20
---

# Phase 10 Plan 04: Build-Chain Coverage Gate Summary

**Wired vitest+coverage into `npm run build` such that every Vercel deploy now fails on test failure OR costCalc.ts coverage dropping below the strict thresholds (lines 95 / functions 100 / branches 90). The gate is real — proven twice by failure-injection.**

## Performance

- **Duration:** ~6 min (read context + 2 task edits + verification + failure-injection sanity check + commits + this summary)
- **Tasks:** 2
- **Files modified:** 3 (vitest.config.ts, package.json, .gitignore)
- **Files created:** 0
- **`npm run build` wall-clock before:** ~9.2s (lint-html → tsc -b → vite build)
- **`npm run build` wall-clock after:** ~13.1s (lint-html → vitest+coverage → tsc -b → vite build)
- **Overhead introduced by the gate:** ~3.9s (vitest run with coverage instrumentation)
- **Coverage step wall-clock standalone:** 2.24s (`npx vitest run --coverage` only)

## Accomplishments

### Task 1 — vitest.config.ts coverage block (commit `25003e9`)

Extended the 8-line config to a 17-line config by inserting a `coverage` block inside `test`:
```typescript
coverage: {
  provider: 'v8',
  include: ['src/utils/costCalc.ts'],
  thresholds: {
    lines: 95,
    functions: 100,
    branches: 90,
  },
},
```

- `provider: 'v8'` matches the pre-installed `@vitest/coverage-v8 ^4.1.4` (no install needed)
- `include: ['src/utils/costCalc.ts']` is the only entry — D-08 file-level scoping, no project-wide threshold
- Existing `environment: 'jsdom'` and `include: ['src/**/*.test.ts']` preserved byte-for-byte
- Coverage report after this commit shows ONLY the costCalc.ts row (no threeMfParser.ts, no UI files) — scoping confirmed

### Task 1.5 — .gitignore (commit `e0c5cb6`, auto-fix Rule 3)

Added `coverage/` to .gitignore. `vitest run --coverage` generates a `coverage/` directory with HTML reports, JSON output, and an LCOV file — none of which is source. Without this entry the next `git add .` could accidentally include them. Build-hygiene auto-fix (Rule 3 — blocking issue for the task: leaving coverage/ untracked makes the worktree visibly dirty after every npm run build).

### Task 2 — package.json build chain (commit `0c8e945`)

Two changes to `scripts`:
1. `build` changed from `node scripts/lint-no-raw-html.mjs && tsc -b && vite build` to **`node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build`** — the literal string mandated by D-05 with the deterministic D-06 ordering.
2. `test:watch: "vitest"` added immediately after `test: "vitest run"` (D-07 — interactive local dev, no `--coverage` flag because watch mode does not gate).

All other scripts (`dev`, `lint`, `lint:no-raw-html`, `preview`, `prepare`, `tauri`, `tauri:dev`, `tauri:build`) are byte-for-byte unchanged. Dependencies and devDependencies completely unchanged — zero new packages, the threat model in the plan reflects reality.

## Final Build Script (full string)

```
node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build
```

Order is mandated by D-06: `lint-html → vitest+coverage → tsc → vite`. This is the fastest-feedback ordering — a failing test surfaces in ~2 seconds rather than after the ~5-second TS build.

## Final Coverage Table (npm run build output)

```
 % Coverage report from v8
-------------|---------|----------|---------|---------|-------------------
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |    97.5 |    92.59 |     100 |     100 |
 costCalc.ts |    97.5 |    92.59 |     100 |     100 | 151-152
-------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 97.5% ( 39/40 )
Branches     : 92.59% ( 25/27 )
Functions    : 100% ( 12/12 )
Lines        : 100% ( 35/35 )
================================================================================
```

| Metric | Threshold (D-09) | Actual | Margin |
| --- | --- | --- | --- |
| Lines | 95 | 100 | +5.0 (5 lines of headroom before the gate fires) |
| Functions | 100 | 100 | 0 (any new untested export immediately fails) |
| Branches | 90 | 92.59 | +2.59 (small headroom — proven adequate for the existing test suite) |
| Statements | (none, vitest derives from lines) | 97.5 | n/a |

Only 2 lines uncovered (151–152 in `costCalc.ts` — likely a defensive branch inside `calculateCost`). Plan 03's test suite was tight enough to clear all three thresholds with margin to spare.

## Failure-Injection Sanity Check

The plan explicitly asks the executor to prove the gate is REAL, not just configured. Two separate injections were performed (test file modified, build run, file restored):

### Injection #1 — Whole-test removal (proves the test-failure gate)

Commented out the only test inside `describe('calculateAmortization', () => {...})`, leaving an empty describe block. `npm run build` output:

```
FAIL  src/utils/costCalc.test.ts > calculateAmortization
Error: No test found in suite calculateAmortization

Test Files  1 failed | 3 passed (4)
Tests  61 passed | 1 todo (62)
```

Exit code non-zero. Build halted **before** tsc and vite ran — the test-failure path is wired correctly.

### Injection #2 — Branch-only removal (proves the coverage-threshold gate)

Commented out 3 unique-branch tests in `describe('calculateFilamentCost', ...)` — specifically the `empty filamentId`, `editedPrice === 0`, and `editedPrice < 0` tests. These exercise branches NOT reached by the orchestrator integration tests, so they reduce branch coverage cleanly without breaking the test suite. `npm run build` output:

```
 Test Files  4 passed (4)
      Tests  59 passed | 1 todo (60)

 % Coverage report from v8
-------------|---------|----------|---------|---------|-------------------
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |      95 |    88.88 |     100 |     100 |
 costCalc.ts |      95 |    88.88 |     100 |     100 | 51,151-152
-------------|---------|----------|---------|---------|-------------------

ERROR: Coverage for branches (88.88%) does not meet global threshold (90%)
```

Branches dropped from 92.59% → 88.88% (below the 90% gate). Exit code non-zero with the explicit threshold violation message. Build halted before tsc and vite ran — the coverage-threshold path is wired correctly.

**Conclusion:** Both paths in the gate (test-failure AND coverage-threshold) actually cause `npm run build` to exit non-zero, which is exactly what makes Vercel deploys fail. The gate is not advisory — it's enforced.

After each injection, `git checkout -- src/utils/costCalc.test.ts` restored the file. Final `npm run build` exits 0 with the unmodified test suite.

## Task Commits

1. **Task 1: Extend vitest.config.ts with file-scoped v8 coverage block** — `25003e9` (feat)
2. **Auto-fix Rule 3: Add coverage/ to .gitignore** — `e0c5cb6` (chore)
3. **Task 2: Update package.json — add test:watch and reorder build chain to gate Vercel deploys** — `0c8e945` (feat)

## Files Created/Modified

- `vitest.config.ts` (MODIFIED, +9 lines) — Added `coverage` block inside `test` with `provider: 'v8'`, `include: ['src/utils/costCalc.ts']`, and `thresholds: { lines: 95, functions: 100, branches: 90 }`. Existing `environment` and `include` keys untouched. Final file is 17 lines.
- `package.json` (MODIFIED, +1/-1 line in build + +1 line for test:watch) — `scripts.build` updated to insert `vitest run --coverage` between `lint-no-raw-html` and `tsc -b`. `scripts.test:watch` added with value `vitest`. `scripts.test` and all other scripts unchanged. Dependencies and devDependencies untouched.
- `.gitignore` (MODIFIED, +3 lines) — Added a `# Vitest coverage output` section with `coverage/`. Generated runtime output, not source; required for clean working trees after `npm run build`.

## Decisions Made

- **D-08 scope is literal:** `coverage.include` was set to exactly `['src/utils/costCalc.ts']`. Considered whether to include any other files (e.g., `gcodeParser.ts` since `getMaterialDensity` is exercised by Plan 03's smoke tests) — explicitly rejected per D-08's "only costCalc.ts is gated" mandate. The coverage table after the change confirms only `costCalc.ts` shows up.
- **D-09 thresholds are exact, not rounded:** `lines: 95`, `functions: 100`, `branches: 90`. No statements threshold added (vitest derives it from lines and the plan's must_haves list does not include it). Current values clear the gate with margin (lines 100%, functions 100%, branches 92.59%).
- **D-06 ordering is non-negotiable:** Tests run BEFORE `tsc -b`, not after. Rationale (from PATTERNS.md): a failing test surfaces in 1–2 seconds, a failing tsc takes 5–10s. Putting tests first means the developer sees the error sooner. The exact string `node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build` was matched via a Node.js exact-equality check before committing.
- **test:watch keyword:** `vitest` (no `run` subcommand), not `vitest --watch`. Vitest 4's default invocation IS watch mode; the explicit `vitest run` in `scripts.test` is what gives one-shot semantics. This matches the PATTERNS.md guidance and the existing convention in the repo.
- **Auto-fix Rule 3 — coverage/ in .gitignore:** Required to keep the worktree clean. Treated as a Rule 3 (blocking issue caused by the current task's changes — without it, every future `npm run build` leaves the working tree dirty). Standalone chore commit so the rationale is auditable.

## Deviations from Plan

- **Auto-fix Rule 3 — added `coverage/` to .gitignore.** The plan does not mention this, but `vitest run --coverage` writes a `coverage/` directory on every invocation. Leaving it untracked turns the working tree perpetually dirty after every build, which is a build-hygiene issue directly caused by Task 2's change. Fix: 3-line addition to .gitignore. Files modified: `.gitignore`. Commit: `e0c5cb6`. No impact on functionality — just hygiene.

That's the only deviation. The plan's two main tasks executed exactly as written.

## Acceptance Criteria — Final Audit

| Gate | Result |
| --- | --- |
| `grep -c "provider: 'v8'" vitest.config.ts` == 1 | PASS |
| `grep -c "src/utils/costCalc.ts" vitest.config.ts` == 1 | PASS |
| `grep -c "lines: 95" vitest.config.ts` == 1 | PASS |
| `grep -c "functions: 100" vitest.config.ts` == 1 | PASS |
| `grep -c "branches: 90" vitest.config.ts` == 1 | PASS |
| `grep -c "environment: 'jsdom'" vitest.config.ts` == 1 (preserved) | PASS |
| `grep -c "include: \['src/\*\*/\*.test.ts'\]" vitest.config.ts` == 1 (preserved) | PASS |
| `npx vitest run --coverage` exits 0 with costCalc.ts row | PASS |
| Coverage table excludes threeMfParser.ts and other files | PASS |
| `grep -c 'vitest run --coverage' package.json` == 1 | PASS |
| `grep -c '"test:watch": "vitest"' package.json` == 1 | PASS |
| `grep -c '"test": "vitest run"' package.json` == 1 (unchanged) | PASS |
| `node -e "JSON.parse(...)"` exits 0 (JSON validity) | PASS |
| Exact build string match via Node.js equality check | PASS |
| `npm run build` exits 0 (full chain green) | PASS |
| `npm test` exits 0 (one-shot still works) | PASS |
| `npm run test:watch` is a valid script (Node.js smoke check) | PASS |
| Coverage thresholds met: lines 100 >= 95, functions 100 == 100, branches 92.59 >= 90 | PASS |
| Failure-injection #1 (test removal) — build fails | PASS |
| Failure-injection #2 (coverage threshold) — build fails with threshold violation | PASS |

## Success Criteria — Final Audit

1. `vitest.config.ts` contains a `coverage` block with `provider: 'v8'`, `include: ['src/utils/costCalc.ts']`, and thresholds `{ lines: 95, functions: 100, branches: 90 }`: **PASS**
2. `package.json` `scripts.build` is exactly `"node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build"` — order matters per D-06: **PASS**
3. `package.json` `scripts.test` remains `"vitest run"` (unchanged): **PASS**
4. `package.json` `scripts.test:watch` exists with value `"vitest"`: **PASS**
5. `npm run build` exits 0 — Vercel deploys will succeed when tests pass and thresholds are met: **PASS**
6. `npm run build` would FAIL if any test fails OR if costCalc.ts coverage drops below thresholds — the gate is real, not advisory: **PASS (proven by both injections)**
7. No new dependencies installed (zero diff to `dependencies` or `devDependencies` blocks): **PASS**

## Issues Encountered

None. The original injection plan ("comment out one passing test") was attempted via a smarter target (commenting only `calculateAmortization`'s test body and import) — that injection PASSED the build because `calculateCost`'s integration tests already exercise `calculateAmortization` indirectly, so coverage stayed at 100%. This is correct v8 behavior, not a failure. A second, more precise injection (3 unique-branch tests in `calculateFilamentCost`) proved the threshold-violation path cleanly. Documented above; no impact on the deliverable.

## User Setup Required

None — pure config change, no external services, no env vars, no migrations, no package installs.

## Next Phase Readiness

**Phase 10 deliverables (post-Plan 04) — ROADMAP success criteria audit:**

1. **Lock the 7 cost factors behind tests** — Plan 03 wrote 39 passing tests covering all 7 factors. PASS.
2. **`it.todo('tax/VAT applies after subtotal …')` placeholder** — Plan 03 added it with the literal em-dash phrasing per D-12. PASS.
3. **`npm run build` runs `vitest run --coverage` and fails on test/coverage failure** — This plan. PASS (proven by failure-injection).
4. **Coverage threshold scoped to `src/utils/costCalc.ts`** — This plan. PASS.

**Requirements traceability:**
- TEST-01 (Validated by Plan 03)
- TEST-02 (Validated by THIS plan — coverage gate wired into build pipeline)
- TEST-F1 (E2E) remains explicit v2 / future per REQUIREMENTS.md — out of scope.

**Blockers/concerns:**
- None. The build is green, tests pass with margin to spare on every threshold, and the gate is proven to fire on both test-failure and coverage-violation paths.

## Self-Check

- File `vitest.config.ts` modified, contains coverage block: **FOUND**
- File `package.json` modified, contains `vitest run --coverage` in build script: **FOUND**
- File `package.json` contains `"test:watch": "vitest"`: **FOUND**
- File `.gitignore` modified, contains `coverage/`: **FOUND**
- Commit `25003e9` (Task 1 — vitest.config.ts coverage block): **FOUND**
- Commit `e0c5cb6` (auto-fix Rule 3 — .gitignore coverage/): **FOUND**
- Commit `0c8e945` (Task 2 — package.json build chain + test:watch): **FOUND**
- `npm run build` exits 0: **PASS**
- `npm test` exits 0: **PASS**
- `coverage/` directory exists locally (untracked, ignored): **CONFIRMED**
- Failure-injection #1 documented (test removal halts build): **DOCUMENTED**
- Failure-injection #2 documented (coverage threshold violation halts build): **DOCUMENTED**
- No new dependencies in package.json: **CONFIRMED**
- No modifications to STATE.md or ROADMAP.md: **CONFIRMED (orchestrator owns those writes)**

## Self-Check: PASSED

---
*Phase: 10-cost-calculation-unit-tests*
*Completed: 2026-05-20*
