# Phase 10: Cost-Calculation Unit Tests - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the existing cost-calculation math behind an automated vitest test suite so it cannot silently regress. Goal is **verification of existing behavior**, not new features and not a refactor for its own sake. The 7 cost factors listed in ROADMAP success criterion 1 are pulled into a pure module (`src/utils/costCalc.ts`) and exhaustively tested.

**In scope:**
- Extract the cost-math `useMemo` block at [src/components/CostCalculator.tsx:374](src/components/CostCalculator.tsx:374) into pure functions in `src/utils/costCalc.ts`
- Public API: one coarse entrypoint `calculateCost(input: CalcInput): CostBreakdown` PLUS named sub-helpers per factor — `calculateFilamentCost`, `calculateElectricityCost`, `calculateDepreciation`, `calculateNozzleWear`, `calculateLabor`, `calculateAmortization` (failure-rate clamp lives inside `calculateCost`)
- Co-located test file `src/utils/costCalc.test.ts` matching the existing pattern (`threeMfParser.test.ts`, `Skeleton.test.ts`, `EmptyState.test.ts`)
- `it.todo('tax/VAT applies after subtotal …')` placeholder satisfying ROADMAP success criterion 2 — activates when v1.2 lands
- Wire `vitest run --coverage` into `npm run build` BEFORE `tsc -b`, with scoped coverage threshold on `src/utils/costCalc.ts` (lines 95 / functions 100 / branches 90)
- Add `test:watch: vitest` package.json script for local dev (`test: vitest run` stays one-shot)
- CostCalculator.tsx refactored only enough to import-and-call the new module — no UI changes, no behavior changes

**Out of scope:**
- Pricing pipeline (packaging, shipping, marketplace fees, profit margin, target profit, selling price) — stays inline in CostCalculator
- React Testing Library / `@testing-library/react` — not installing; pure-function tests don't need a DOM driver
- Project-wide coverage threshold — only `src/utils/costCalc.ts` is gated; rest of codebase has no threshold (no false alarms on untested UI)
- GitHub Actions workflow for PRs — Vercel's `npm run build` is the single gate this phase; PR Actions are a future phase if desired
- Pre-commit / pre-push hooks for tests — Vercel-side gate is sufficient
- E2E tests (TEST-F1 is explicitly v2 / future per REQUIREMENTS.md)
- NEW badge — invisible feature (D-08 pattern from Phase 9 applies)

</domain>

<decisions>
## Implementation Decisions

### Test Architecture
- **D-01:** Extract cost math from `CostCalculator.tsx` (the `useMemo((): CostBreakdown => {…})` at line 374) into a new pure module `src/utils/costCalc.ts`. CostCalculator imports and calls it — same UI, same behavior, math now isolated.
- **D-02:** API shape — one coarse `calculateCost(input: CalcInput): CostBreakdown` entrypoint + named sub-helpers per factor (`calculateFilamentCost`, `calculateElectricityCost`, `calculateDepreciation`, `calculateNozzleWear`, `calculateLabor`, `calculateAmortization`). Strict TS types on `CalcInput` and `CostBreakdown`.
- **D-03:** Test file location — co-located at `src/utils/costCalc.test.ts`. Matches existing pattern; matches `vitest.config.ts` include `src/**/*.test.ts` without config edits.
- **D-04:** Extraction scope — **cost-only**. The 7 ROADMAP-listed factors (material, electricity, depreciation, nozzle wear, labor, failure-rate, model amortization) move into `costCalc.ts`. Packaging, shipping, marketplace fees, profit margin, target profit, selling price stay inside CostCalculator.tsx for this phase.

### CI Gating
- **D-05:** Wire tests into `npm run build`. New build script: `node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build`. Vercel deploys fail on test or coverage-threshold failure. No GitHub Actions workflow added in this phase (Vercel-side gate satisfies ROADMAP criterion 3).
- **D-06:** Test step runs **before `tsc -b`** in the build chain — fastest-feedback ordering. Order is: lint-html → tests+coverage → tsc → vite.
- **D-07:** Add `test:watch: vitest` to `package.json` scripts for interactive local development. Keep `test: vitest run` unchanged (one-shot, what the build script invokes).

### Coverage Threshold
- **D-08:** Configure `@vitest/coverage-v8` (already installed, version `^4.1.4`). Set coverage thresholds **only** on `src/utils/costCalc.ts` — no project-wide threshold. Use `coverage.include: ['src/utils/costCalc.ts']` to scope the report.
- **D-09:** Threshold numbers — `lines: 95`, `functions: 100`, `branches: 90`. Strict but reachable for pure math; forces real coverage, not just happy paths.
- **D-10:** Coverage runs **during every `npm run build`** (i.e. `vitest run --coverage` is the in-build test invocation, not plain `vitest run`). Threshold violations fail the build / Vercel deploy. ~2–3s slower local builds, real gate.

### Fixture Strategy
- **D-11:** Hybrid fixtures — most tests use **synthetic hand-built inputs** where the math is verifiable by eye (e.g., `{ grams: 500, pricePerKg: 20 }` → expect `$10.00`). Plus 3–4 **real-data smoke tests** against `getMaterialDensity` (from `src/utils/gcodeParser.ts:64`) using actual material strings — locks the density table that the v1.0 nozzle-wear fix established.
- **D-12:** Tax/VAT placeholder — `it.todo('tax/VAT applies after subtotal — activates in v1.2', ...)`. Vitest's `it.todo()` shows up as `✎ todo` in the test report. Activates by changing `todo` → `it` once v1.2 tax logic exists. Matches ROADMAP success criterion 2 literally.
- **D-13:** Edge cases to test explicitly:
  - **Multi-filament loop:** 1 filament (v0 migration path), 2 filaments (generic multi-color), 16 filaments (Bambu AMS Hub max per PROJECT.md v1.0 decision).
  - **Failure-rate clamp:** 0%, 99%, and an over-100 input that should clamp to 99 — locks the `Math.min(Math.max(failureRate, 0), 99)` logic currently at [src/components/CostCalculator.tsx:429](src/components/CostCalculator.tsx:429) (will move into `calculateCost`).
  - **Per-material density:** PLA, PETG, ABS, and an unrecognized string (fallback path) — smoke-tests `getMaterialDensity` to lock the table that fixed the v1.0 PLA-only nozzle-wear bug.
  - **Defensive guards (zero / null):** Test ONLY the paths the extracted module actually has. Do NOT add defensive code (zero filament weight, no printer selected, etc.) just to test it — if the planner finds those branches exist after extraction, add tests; if not, skip.

### Claude's Discretion
- Exact `CalcInput` / `CostBreakdown` TypeScript shapes — planner derives from what the `useMemo` block at line 374 currently uses (must preserve the existing `CostBreakdown` consumer contract — anything that consumes `costs.material`, `costs.electricity`, etc. stays unchanged).
- Defensive guards in the extracted module — extract only what's there; don't add new branches just for test coverage. If an existing branch is purely defensive and untestable, use `/* c8 ignore next */` rather than write a low-value test.
- Floating-point precision — use `toBeCloseTo` for monetary assertions where rounding is unavoidable; use `toBe` for exact integer / pre-rounded values. Planner picks per assertion.
- Whether to convert `failureRate` clamp into a sub-helper or keep inline — both acceptable; planner chooses based on test ergonomics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` (Phase 10 entry) — Goal, success criteria, the canonical list of 7 cost factors that MUST be covered, and the tax/VAT pending-test requirement
- `.planning/REQUIREMENTS.md` — TEST-01 and TEST-02 traceability (must mark as Validated once phase ships)
- `.planning/PROJECT.md` — v1.0 decisions still load-bearing: "Export `getMaterialDensity` for nozzle wear" + "Max 16 filament rows (Bambu AMS Hub max)" + tech stack constraints

### Source files to extract from / test
- `src/components/CostCalculator.tsx:374` — the `useMemo((): CostBreakdown => {…})` block to extract into `costCalc.ts`. Preserve every existing `CostBreakdown` field consumer expects.
- `src/components/CostCalculator.tsx:429` — failure-rate clamp `Math.min(Math.max(failureRate, 0), 99)` — locks the boundary test for D-13.
- `src/utils/gcodeParser.ts:64` — `getMaterialDensity` (already exported, ready to test).

### Test pattern reference
- `src/utils/threeMfParser.test.ts` — existing pattern (helpers + describe + `import { describe, it, expect } from 'vitest'`)
- `src/components/ui/Skeleton.test.ts` — `React.createElement` pattern (only relevant if React is needed; not expected for cost math)
- `src/components/ui/EmptyState.test.ts` — second existing reference

### Build + test configuration
- `vitest.config.ts` — current config; will gain a `coverage` block scoped to `src/utils/costCalc.ts`
- `package.json` scripts.build — current chain to modify per D-05 / D-06
- `package.json` scripts.test — stays `vitest run`; new `test:watch: vitest` per D-07

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getMaterialDensity(filamentType)`** at `src/utils/gcodeParser.ts:64` — already exported; smoke-test target for D-13's per-material density edge cases. Locks the v1.0 nozzle-wear fix.
- **`src/data/defaultMaterials.ts` + `src/data/bambuFilaments.ts`** — real-world densities/prices available for the few real-data fixtures in D-11. Avoid coupling math assertions to these files; use only for density-lookup smoke tests.
- **`@vitest/coverage-v8 ^4.1.4`** — already in devDependencies. No new install needed for coverage; just config.
- **`jsdom ^29.0.2`** — already in devDependencies. Cost-calc tests don't need it, but it's there if any React-touching tests are ever added.

### Established Patterns
- Test files end in `.test.ts` (not `.test.tsx`) and may NOT use JSX — `React.createElement` only if React is involved (it shouldn't be for cost math).
- `import { describe, it, expect } from 'vitest'` is the standard test header.
- `useMemo` blocks with closures hold business logic in CostCalculator.tsx — extracting them into pure modules is the established escape hatch (no precedent yet, but the calc block is the obvious first candidate).
- `tsc -b` (not `--noEmit`) per user global CLAUDE.md — enforces stricter checks Vercel runs.
- No project-wide test config beyond `vitest.config.ts`; adding a `coverage` block scoped to a single file file matches the project's minimal-config style.

### Integration Points
- `CostCalculator.tsx`'s `useMemo((): CostBreakdown => {…})` at line 374 is the single integration seam. After extraction, the `useMemo` becomes `useMemo(() => calculateCost({…inputs}), [deps])`. No other components consume the math directly.
- The build script in `package.json` is the only place CI gating lives in this repo — modifying it propagates to Vercel automatically.
- `getMaterialDensity` is already imported by `CostCalculator.tsx` (used for nozzle wear); no new wiring needed for the extracted `calculateNozzleWear` sub-helper.

</code_context>

<specifics>
## Specific Ideas

- Tax/VAT pending test placeholder name: `it.todo('tax/VAT applies after subtotal — activates in v1.2', ...)` — exact phrasing per D-12 so the test report surfaces it clearly.
- Coverage thresholds locked to `src/utils/costCalc.ts` only — the vitest config's `coverage.include` array is the scoping mechanism (D-08).
- Build script order is deterministic per D-06: `lint-html → vitest run --coverage → tsc -b → vite build`. Don't reorder without re-discussing.
- Bambu AMS Hub max of 16 filaments comes from a locked v1.0 PROJECT.md decision — the multi-filament edge-case test at 16 is non-negotiable per D-13.

</specifics>

<deferred>
## Deferred Ideas

- **Pricing pipeline extraction** (packaging, shipping, marketplace fees, profit margin, target profit, selling price) — could move to a `pricingCalc.ts` module in a follow-up if the cost-side extraction proves the pattern useful. Tracked as a possible Phase 11+ or a v1.2 dependency.
- **GitHub Actions workflow for PRs** — Vercel-side gate is sufficient for v1.1 per D-05. Adding `.github/workflows/ci.yml` is a future phase if PR-gated review becomes valuable.
- **React Testing Library smoke tests** — explicitly rejected for this phase. Could revisit if a "math fed to UI" regression ever ships despite the pure-test coverage.
- **Project-wide coverage threshold** — explicitly rejected for this phase per D-08; only `costCalc.ts` is gated. If broader gating becomes valuable, a separate phase can add file-by-file thresholds.
- **E2E tests (Playwright/Cypress)** — REQUIREMENTS.md TEST-F1; explicit v2 / future scope.
- **Pre-commit / pre-push hooks for tests** — discussed and rejected per D-05; Vercel-side gate is sufficient.

</deferred>

---

*Phase: 10-cost-calculation-unit-tests*
*Context gathered: 2026-05-20*
