# Phase 10: Cost-Calculation Unit Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 10-cost-calculation-unit-tests
**Areas discussed:** Test architecture, CI gating, Coverage threshold, Fixture strategy

---

## Test architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Extract pure calc module | Pull `useMemo` cost-math block out of CostCalculator.tsx into `src/utils/costCalc.ts` as pure functions. Tests target the pure module — fast, deterministic, no jsdom needed. Side benefit: CostCalculator.tsx shrinks ~150 LoC. | ✓ |
| Add React Testing Library, test the component | Mount CostCalculator in jsdom, drive inputs via user-event, assert on rendered output. No source refactor. Slower, brittler. | |
| Hybrid: extract + a few RTL smoke tests | Extract the pure module AND add RTL for 2–3 high-level smoke tests. Most coverage from pure tests; integration tests catch wiring drift. | |

**User's choice:** Extract pure calc module (Recommended)
**Notes:** Foundational decision — drives everything else.

| Option | Description | Selected |
|--------|-------------|----------|
| One coarse function + named sub-helpers | `calculateCost(input): CostBreakdown` main entrypoint PLUS each factor as a named export. Tests can target individual factors or whole pipeline. | ✓ |
| One big function only | Export only `calculateCost(input): CostBreakdown`. Tests assert on properties of the returned breakdown. | |
| Many small functions only (no entrypoint) | Export each factor standalone; CostCalculator composes them itself. | |

**User's choice:** One coarse function + named sub-helpers (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located: src/utils/costCalc.test.ts | Test file sits next to the module — matches existing `threeMfParser.test.ts` and `Skeleton.test.ts` pattern. Matches vitest.config.ts include `src/**/*.test.ts`. | ✓ |
| Grouped: tests/costCalc.test.ts | Move all tests to a top-level `tests/` directory. Breaks established pattern, requires config edit. | |
| Co-located + smoke file (.integration.test.ts) | Two files — pure unit tests + end-to-end pipeline smoke tests. More ceremony. | |

**User's choice:** Co-located: src/utils/costCalc.test.ts (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Cost-only — the 7 factors from ROADMAP | Extract material, electricity, depreciation, nozzle wear, labor, failure-rate, model amortization. Pricing pipeline stays inline. | ✓ |
| Cost + pricing (full pipeline) | Extract everything: cost factors AND packaging/shipping/fees/margins/selling-price. Bigger surface, bigger refactor. | |
| Cost + amortization split into sub-helper | Same as cost-only but `calculateAmortization` lives in its own file with its own test. Slight ceremony bump. | |

**User's choice:** Cost-only — the 7 factors from ROADMAP (Recommended)

---

## CI gating

| Option | Description | Selected |
|--------|-------------|----------|
| Wire `npm test` into `npm run build` | Update build script to include `npm test`. Vercel deploys fail on test failure. No new infrastructure. | ✓ |
| Separate `ci` script + GitHub Actions on PRs | Add `npm run ci` + `.github/workflows/ci.yml`. Vercel build stays fast. More setup. | |
| Both — wire into build AND add GH Actions | Belt and suspenders. Most safety, most ceremony. | |
| Pre-commit/pre-push hook only | Husky or similar runs tests on pre-push. Easy to skip with --no-verify; doesn't gate Vercel. | |

**User's choice:** Wire `npm test` into `npm run build` (Recommended)
**Notes:** Vercel-side gate is sufficient for a solo-dev free tool. GH Actions can be added later if PR-gated review becomes valuable.

| Option | Description | Selected |
|--------|-------------|----------|
| Before tsc -b | Order: `lint-html && vitest run && tsc -b && vite build`. Test failures surface first — cheapest-check-first principle. | ✓ |
| After tsc -b, before vite build | Order: lint → tsc → tests → vite. Types verified first, then tests. | |
| After vite build (post-bundle) | Bundle first, test the result. Doesn't make sense for pure-math unit tests. | |

**User's choice:** Before tsc -b (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add `test:watch` = `vitest` | Keep `test: vitest run` (build chain). Add `test:watch: vitest` (watch mode) for DX. | ✓ |
| No — just use `npx vitest` directly | Skip the script. Anyone wanting watch mode runs `npx vitest`. | |
| Yes — add `test:watch` and `test:coverage` | Add both. Tiny scope creep but logical (coverage script useful for next area). | |

**User's choice:** Yes — add `test:watch` = `vitest` (Recommended)

---

## Coverage threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, scoped threshold on costCalc.ts | Configure vitest coverage with @vitest/coverage-v8. Set thresholds only on src/utils/costCalc.ts. Rest of codebase has no threshold (no false alarms). | ✓ |
| Yes, project-wide threshold | Set low project-wide threshold (e.g. lines: 30). Catches regressions globally. More noise than signal. | |
| No threshold this phase, just generate reports | Add `test:coverage` for on-demand reports. Build does NOT run coverage. | |
| Threshold + HTML report committed to .planning/ | Same as option 1 plus HTML report + .planning/phases/10*/10-COVERAGE.md. Ceremony cost. | |

**User's choice:** Yes, scoped threshold on costCalc.ts (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| lines 95 / functions 100 / branches 90 | Strict but reachable for pure math. Forces real coverage, not just happy paths. | ✓ |
| lines 90 / functions 95 / branches 80 | Looser. Allows a couple un-exercised lines (defensive guards). | |
| lines 100 / functions 100 / branches 100 | Perfect coverage required. Punishing — may force low-value tests for impossible inputs. | |
| lines 80 / functions 80 / branches 70 | Permissive. Locks in baseline without forcing exhaustive coverage. | |

**User's choice:** lines 95 / functions 100 / branches 90 (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Run coverage in build | Update build's test step from `vitest run` to `vitest run --coverage`. Threshold violations fail Vercel deploys. ~2–3s slower local builds. | ✓ |
| Coverage only via `test:coverage` | Build runs plain `vitest run`. Coverage threshold enforced only on explicit `npm run test:coverage`. | |
| Coverage in build, configurable via env var | Build runs coverage by default; `SKIP_COVERAGE=1` to skip locally. More moving parts. | |

**User's choice:** Run coverage in build (Recommended)

---

## Fixture strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — synthetic for math, real for density lookup | Most tests use hand-built synthetic inputs where math is verifiable by eye. Plus a few real-data smoke tests against `getMaterialDensity`. | ✓ |
| Pure synthetic — all hand-built | Every test uses hand-built inputs. No coupling to data files. Density-table correctness implicitly trusted. | |
| Real seeds — import from data files | Tests import from defaultMaterials.ts and bambuFilaments.ts. Realistic numbers; opaque assertions; fragile to data edits. | |
| Fixture file: src/utils/__fixtures__/costCalcSamples.ts | Dedicated fixtures module with named scenarios. More ceremony; cleaner if test count grows large. | |

**User's choice:** Hybrid — synthetic for math, real for density lookup (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| `it.todo('tax/VAT applies after subtotal', ...)` | Vitest's `it.todo()` registers a named pending test that shows up as `✎ todo` in output. Activates by changing `todo` → `it`. | ✓ |
| `it.skip('tax/VAT — activates in v1.2', ...)` with actual body | Write full intended test body but mark `.skip`. May cause type errors referencing nonexistent functions. | |
| Comment + `// TODO(v1.2): tax test` | No vitest construct, just a comment. Test reporter says nothing. Doesn't satisfy ROADMAP "named pending test" well. | |

**User's choice:** `it.todo('tax/VAT applies after subtotal', ...)` (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-filament: 1, 2, 16 (max) filaments | Lock the multi-filament loop. Bambu AMS Hub max of 16 per PROJECT.md v1.0 decision. | ✓ |
| Failure-rate boundary: 0%, 99% (the clamp limits) | Test both bounds plus over-100 input that should clamp. Locks the Math.min(Math.max(...)) at line 429. | Claude's discretion |
| Per-material density: PLA, PETG, ABS, unknown | Smoke-test getMaterialDensity. Locks the v1.0 nozzle-wear bug fix. | Claude's discretion |
| Zero filament weight / zero labor / no printer selected | Defensive guards. May force defensive code that wouldn't otherwise exist. | Claude's discretion (skip unless paths actually exist) |

**User's choice:** Multi-filament 1/2/16 (explicit) + "do what you think is best" (free text, delegated to Claude) for the other three.
**Notes:** Claude interpreted the delegation as: include failure-rate clamp boundary + per-material density smoke tests (high signal, low cost), and test zero/null defensive guards ONLY if extraction surfaces those branches naturally (don't add defensive code just to test it).

---

## Claude's Discretion

- **Edge cases beyond multi-filament:** failure-rate clamp (0%, 99%, over-100), per-material density (PLA/PETG/ABS/unknown), defensive guards only where paths actually exist after extraction.
- **Exact `CalcInput` / `CostBreakdown` TypeScript shapes** — planner derives from the existing `useMemo` block.
- **Floating-point precision** — `toBeCloseTo` vs `toBe` per assertion, planner's call.
- **Whether failure-rate clamp becomes a sub-helper or stays inline** — both acceptable.
- **`/* c8 ignore next */` for untestable defensive lines** rather than writing low-value tests.

## Deferred Ideas

- Pricing pipeline extraction (packaging, shipping, marketplace fees, profit margin, etc.) — possible Phase 11+ or v1.2 dependency.
- GitHub Actions workflow for PRs — future phase if PR-gated review becomes valuable.
- React Testing Library smoke tests — explicitly rejected; can revisit if a math-to-UI regression ever ships.
- Project-wide coverage threshold — explicitly rejected; only costCalc.ts gated.
- E2E tests (Playwright/Cypress) — REQUIREMENTS.md TEST-F1, v2 / future scope.
- Pre-commit / pre-push hooks for tests — Vercel-side gate is sufficient.
