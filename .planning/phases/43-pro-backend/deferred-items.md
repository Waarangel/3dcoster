# Deferred Items — Phase 43 Pro Backend

## 43-04: `outputEquivalence.test.tsx` full-suite timeout flake (out of scope)

**Found during:** 43-04 Task 2 final `npm run build` verification.

**Issue:** `src/components/calculator/outputEquivalence.test.tsx` ("mounts every
curated + random scenario and captures well-formed rendered readouts")
intermittently exceeds the default 5000ms Vitest timeout when run as part of
the FULL suite with `--coverage` (as `npm run build` does), but passes
reliably (~2s) when run in isolation, with or without coverage, both before
and after this plan's changes.

**Root cause (assessed, not fixed):** resource contention across ~106
parallel test files under coverage instrumentation on this machine, not a
logic regression. This test predates Phase 43 entirely (CostCalculator
output-equivalence oracle, Phase 38 D-01/D-03) and this plan's changes never
touch `CostCalculator`, `useCostDerivedValues`, or `costCalc.ts`.

**Scope decision:** out of scope for 43-04 (Rule 1/2/3 only cover issues
directly caused by the current task's changes — see executor scope-boundary
rule). Not fixed. Logged here per that rule rather than silently ignored.

**Suggested resolution (future plan):** either raise this specific test's
timeout (`it(..., { timeout: 15000 })`) or set a global `testTimeout` in
`vitest.config.ts` scaled for coverage runs.
