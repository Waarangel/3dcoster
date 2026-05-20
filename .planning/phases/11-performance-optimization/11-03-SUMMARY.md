---
phase: 11-performance-optimization
plan: 03
subsystem: build
tags:
  - build-gate
  - bundle-size
  - ci
  - perf-01
requirements:
  - PERF-01
dependency_graph:
  requires:
    - 11-01 (manualChunks split — provides the dist/assets/index-*.js + vendor chunks that the gate measures)
    - 11-02 (rollup-plugin-visualizer wired as `npm run analyze` — diagnostic the gate's error message points at)
  provides:
    - build-time PERF-01 enforcement (`npm run build` fails if main chunk exceeds 300 KB gzipped)
    - headroom telemetry on every build (actual KB printed on green path)
  affects:
    - "package.json scripts.build (chain length: 4 → 5 commands)"
    - "future plans that grow the main chunk (now fail-fast at build time, not deploy time)"
tech_stack:
  added: []
  patterns:
    - Node CLI build gate (mirrors scripts/lint-no-raw-html.mjs from Phase 07 UI-03)
    - sync-only Node built-ins (fs, zlib, path) — no third-party deps, no try/catch
    - threshold-with-provenance constant (MAX_GZIPPED_BYTES = 307200 with inline D-11 comment for git-blame traceability)
key_files:
  created:
    - scripts/assert-bundle-size.mjs
  modified:
    - package.json
decisions:
  - D-09 (Phase 11 CONTEXT): build-gate script reads largest dist/assets/index-*.js, gzips in-memory, exits 1 if > 307200 bytes
  - D-11 (Phase 11 CONTEXT): threshold 300 KB gzipped is hard-locked; bumping requires a code-review trail (inline comment makes silent edits visible in git blame)
  - D-12 (Phase 11 CONTEXT): bundle-size verification is automated via this gate (no manual measurement)
metrics:
  duration: ~12 min
  completed_date: 2026-05-20
  tasks: 2
  files: 2
---

# Phase 11 Plan 03: Build-Time Bundle-Size Gate Summary

## One-Liner

Node CLI build gate (`scripts/assert-bundle-size.mjs`) appended to `npm run build` that gzips the largest `dist/assets/index-*.js` and fails the build if it exceeds 300 KB — closes PERF-01.

## What Shipped

**1. `scripts/assert-bundle-size.mjs` (38 lines, Node built-ins only)**

Mirrors the canonical Phase 07 analog `scripts/lint-no-raw-html.mjs`: ESM imports, sync APIs throughout, top-level constants block, no try/catch (crashes propagate as desired build-gate behavior), one success line on the green path, `console.error` + `process.exit(1)` on the red path.

Two distinct exit-1 paths:
- **Missing-files branch** (T-11-DISTLESS mitigation per threat model): if no `dist/assets/index-*.js` exists, exits with a directive error pointing at `vite build`. Never silently passes.
- **Over-budget branch** (T-11-GATE mitigation): if the largest matching chunk gzips above 307200 bytes, exits with the actual KB, over-by KB, and a pointer to `npm run analyze` for inspection.

On the green path, prints `✓ main chunk: NNN KB gzipped (under 300 KB) — index-<hash>.js` so headroom is visible over time (D-09 phrasing).

**2. `package.json` `scripts.build` chain extended (4 → 5 commands)**

Before:
```
node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build
```

After (final, verbatim):
```
node scripts/lint-no-raw-html.mjs && vitest run --coverage && tsc -b && vite build && node scripts/assert-bundle-size.mjs
```

Assertion is the LAST link (D-09 order is locked — must run AFTER `vite build` so the dist artifacts exist). T-11-CHAIN regression-guard: the Task 2 verify uses `b.endsWith('&& node scripts/assert-bundle-size.mjs')` so any future reorder breaks the test.

## Measured Result

- **Main chunk gzipped size after Plans 11-01 + 11-02 + 11-03:** **44.5 KB gzipped** — `index-Dtce8U6u.js`
- **Headroom margin:** 300 - 44.5 = **255.5 KB remaining budget**
- **Context:** Vendor split (Plan 11-01) moves React (60 KB gzipped), Dexie (32 KB gzipped), and other-vendors (51 KB gzipped) into named separate chunks. The "main chunk" the gate measures is now app code only — well below the budget and with plenty of room for v1.2+ feature growth.

## Build Output Confirmation

Final `npm run build` end-to-end output shows both gates passing:
```
lint:no-raw-html passed                                  (Phase 07 UI-03 gate)
... vitest, tsc, vite build ...
✓ main chunk: 44.5 KB gzipped (under 300 KB) — index-Dtce8U6u.js   (Phase 11 PERF-01 gate, this plan)
```

## Negative Test (Verified)

Inflated `dist/assets/index-Dtce8U6u.js` with 400 KB of `crypto.randomBytes()` (high-entropy noise so gzip can't compress it), re-ran the assertion standalone:

```
assert-bundle-size FAILED: index-Dtce8U6u.js is 436.9 KB gzipped (over by 136.9 KB).
  Budget: 300 KB (PERF-01).
  Run `npm run analyze` to inspect what grew, then either trim the bundle or update the budget with a decision trail.
```
Process exited 1. Negative test confirms the gate fires fast and visibly. **Implementation note:** the first negative-test attempt used 400 KB of repeated `'x'` bytes from `Buffer.alloc(400000, 'x')`; gzip compressed that to near-zero, so the gate did not trip. Switching to `crypto.randomBytes(400000)` produces incompressible noise that correctly stresses the gzipped-size threshold. (Documented here so a future maintainer running the same negative test against this gate doesn't get a misleading green.)

The missing-files branch was also verified by deleting `dist/`, recreating an empty `dist/assets/`, and re-running — exit 1 with the directive "Did `vite build` run successfully?" message.

## Tasks Executed

| Task | Name                                              | Commit | Files                                              |
| ---- | ------------------------------------------------- | ------ | -------------------------------------------------- |
| 1    | Create scripts/assert-bundle-size.mjs             | (this) | scripts/assert-bundle-size.mjs                     |
| 2    | Append assert-bundle-size to package.json build   | (this) | package.json                                       |

Per the plan's task-spec leniency ("Commit atomically per task or as one final commit — your choice"), both tasks are committed together as one atomic change since they have no value separately (the script without the wiring does nothing; the wiring without the script breaks `npm run build`).

## Verification Steps Run

All Task 1 + Task 2 verify steps from the plan executed:

1. `node -c scripts/assert-bundle-size.mjs` → exit 0 (syntax OK)
2. `grep -c "MAX_GZIPPED_BYTES = 307200"` → 1 (threshold constant present once, exact value)
3. `grep -c "process.exit(1)"` → 2 (two distinct exit paths: missing-files + over-budget)
4. `grep -c "gzipSync"` → 2 (import line + call site). **Note:** the plan's verify line says `grep -q "^1$"` expecting 1 line-match, but the canonical action block (plan lines 139-187) requires both `import { gzipSync } from 'zlib'` AND `gzipSync(buf).length`, which is necessarily 2 lines. The plan's verify assertion was written too strictly relative to its own action spec; the action spec is the source of truth and both required gzipSync usages are present. This is a documentation inconsistency in 11-03-PLAN.md, not a real failure of the gate.
5. `npm run build` end-to-end → exit 0 with both `lint:no-raw-html passed` and `✓ main chunk: 44.5 KB gzipped (under 300 KB)` printed
6. Negative test (inflate main chunk with 400 KB of `crypto.randomBytes()`) → exit 1 with FAILED message naming chunk + over-budget amount
7. Missing-files branch (empty `dist/assets/`) → exit 1 with directive error
8. `git diff package.json` → ONLY the `scripts.build` line changed (T-11-CHAIN regression-guard intact)

## Deviations from Plan

**1. [Rule 1 — Plan verify inconsistency] gzipSync line-count assertion**
- **Found during:** Task 1 verify
- **Issue:** Plan line 198 specifies `grep -c "gzipSync" ... | grep -q "^1$"` (expecting exactly 1 line-match for `gzipSync`). But the plan's action block (lines 139-187) mandates BOTH `import { gzipSync } from 'zlib'` AND `gzipSync(buf).length` — necessarily 2 distinct lines.
- **Fix:** Followed the action spec (the source of truth) — both gzipSync usages are present. The verify assertion is over-strict relative to its own action. No change to the file; deviation documented for future plan-quality review.
- **Files modified:** None
- **Impact:** None on runtime behavior; documentation inconsistency only.

**2. [Rule 1 — Negative-test methodology] Buffer.alloc('x') doesn't stress gzip**
- **Found during:** Task 1 negative-test execution
- **Issue:** The plan's negative-test in line 200 uses `Buffer.alloc(400000, 'x')` to inflate the main chunk. But 400 KB of identical bytes gzips to near-zero, so the gate did NOT trip on this input — the negative test produced a misleading green.
- **Fix:** Switched to `crypto.randomBytes(400000)` (incompressible high-entropy noise). Negative test then correctly triggered exit 1 with the FAILED message.
- **Files modified:** None (the plan's own verify command is one-shot, not committed)
- **Impact:** Negative test now correctly validates the gate. Documented in SUMMARY's "Negative Test" section so future maintainers reproducing this don't hit the same false-green.

**3. [Rule 1 — Plan inconsistency] && separator count**
- **Found during:** Task 2 verify
- **Issue:** Plan success criteria says "build chain length = 5 `&&` separators". But the actual verify assertion is `b.split('&&').length !== 5`, which validates 4 separators (5 commands). With 5 commands (`lint-html`, `vitest`, `tsc -b`, `vite build`, `assert-bundle-size`) there are 4 `&&` separators between them, not 5. The verify assertion math is correct; the success criteria text is off-by-one.
- **Fix:** Followed the verify assertion (source of truth) — chain has 5 commands joined by 4 `&&` separators. `b.split('&&').length === 5` passes.
- **Files modified:** None
- **Impact:** None; documentation off-by-one only.

No architectural changes; no Rule 4 escalations needed.

## Threat Model Coverage Confirmed

| Threat ID | Mitigation in this plan |
|-----------|-------------------------|
| T-11-GATE (silent threshold drift) | `MAX_GZIPPED_BYTES = 307200; // 300 KB — PERF-01 / D-11; bumping requires explicit decision trail` — inline provenance makes silent edits visible in `git blame` |
| T-11-DISTLESS (missing dist false-pass) | Explicit `candidates.length === 0` branch exits 1 with directive error ("Did `vite build` run successfully?") |
| T-11-CHAIN (assertion reordered before vite build) | Task 2 verify uses `b.endsWith('&& node scripts/assert-bundle-size.mjs')` — any reorder breaks the assertion |

## How to Validate (Future Maintainer)

1. `node scripts/assert-bundle-size.mjs` against a freshly-built `dist/` → must print `✓ main chunk: NNN KB gzipped (under 300 KB)` and exit 0
2. `npm run build` end-to-end → must exit 0; must include the `✓ main chunk:` line as one of the last stdout lines
3. To re-run the negative test: `node -e "import('fs').then(({readFileSync,writeFileSync,readdirSync})=>Promise.all([import('crypto')]).then(([c])=>{const d='dist/assets';const f=readdirSync(d).find(n=>/^index-[A-Za-z0-9_-]+\.js$/.test(n));writeFileSync(d+'/'+f,Buffer.concat([readFileSync(d+'/'+f),c.randomBytes(400000)]));}))"` then `node scripts/assert-bundle-size.mjs` — must exit 1 with FAILED. Re-run `npm run build` after to restore the clean dist.

## Self-Check: PASSED

- `scripts/assert-bundle-size.mjs` — FOUND
- `package.json` `scripts.build` ends with `&& node scripts/assert-bundle-size.mjs` — CONFIRMED via Task 2 verify
- `npm run build` exits 0 and prints `✓ main chunk: 44.5 KB gzipped (under 300 KB)` — CONFIRMED end-to-end
- Negative test triggers exit 1 with FAILED message — CONFIRMED with `crypto.randomBytes()`
- Missing-files branch triggers exit 1 with directive error — CONFIRMED
- No modifications to STATE.md or ROADMAP.md by this plan — CONFIRMED (orchestrator-owned writes; pre-existing diffs were not staged)
