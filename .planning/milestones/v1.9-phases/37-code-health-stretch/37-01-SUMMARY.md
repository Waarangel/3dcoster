---
phase: 37-code-health-stretch
plan: "01"
subsystem: CostCalculator
tags: [immutability, refactor, react-state, code-health, hyg-11, hyg-12]
dependency_graph:
  requires: []
  provides: [immutable-packaging-handlers, updatePackagingMaterial-helper]
  affects: [src/components/CostCalculator.tsx]
tech_stack:
  added: []
  patterns: [functional-updater setState(prev => prev.map(...)), named helper mirroring updateFilamentRow]
key_files:
  created: []
  modified:
    - src/components/CostCalculator.tsx
    - src/components/CostCalculator.test.tsx
decisions:
  - "Extracted updatePackagingMaterial as a named helper with keyof MaterialUsage field signature (same shape as updateMaterialUsage), mirroring updateFilamentRow at line 194 — the established canonical pattern in this codebase"
  - "Collapsed HYG-11 violations V2 + V3 into a single new helper (HYG-12.1) rather than separately rewriting each inline handler"
metrics:
  duration: "~2 minutes"
  completed: "2026-06-26T13:19:00Z"
---

# Phase 37 Plan 01: HYG-11 + HYG-12.1 Immutability Refactor Summary

Eliminated all three snapshot-setState index-mutation violations in `CostCalculator.tsx` by converting `updateMaterialUsage` to a functional updater and extracting a new `updatePackagingMaterial` helper — zero behavioral change, proven by 750 tests green and `tsc -b` clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Convert updateMaterialUsage to functional updater + extract updatePackagingMaterial helper + source-contract tests | 8e2802c | CostCalculator.tsx, CostCalculator.test.tsx |
| 2 | Full-suite + tsc -b regression gate | — (no source changes; gate passed clean) | — |

## What Was Built

### HYG-11: Three index-mutation violations eliminated

**V1 — `updateMaterialUsage` (line 840–844):**
Before: snapshot form `const updated = [...materialsUsed]; updated[index] = ...; setMaterialsUsed(updated)`.
After: `setMaterialsUsed(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))`.

**V2 + V3 — inline packaging `onChange` handlers (lines 1302–1306, 1318–1322):**
Both replaced with one-liner calls to the new `updatePackagingMaterial` helper.

### HYG-12.1: `updatePackagingMaterial` helper extracted

Declared at line 846, immediately after `updateMaterialUsage`. Mirrors `updateFilamentRow` (line 194) exactly — same functional-updater `setState(prev => prev.map(...))` pattern, same field/value signature style. Consumed by both packaging `onChange` handlers:
- `onChange={e => updatePackagingMaterial(index, 'materialId', e.target.value)}`
- `onChange={e => updatePackagingMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}`

### Source-contract tests added

New `describe('HYG-11 / HYG-12.1 immutable update handlers', ...)` block in `CostCalculator.test.tsx` with 6 assertions:
1. `setMaterialsUsed(prev =>` and `prev.map(` are present
2. `const updated = [...materialsUsed]` is absent
3. `updatePackagingMaterial` is declared and uses `setPackagingMaterials(prev =>`
4. materialId handler delegates to `updatePackagingMaterial(index, 'materialId', ...)`
5. quantity handler delegates to `updatePackagingMaterial(index, 'quantity', ...)`
6. `updated[index] =` appears zero times in the entire file

## Verification

- `npx vitest run src/components/CostCalculator.test.tsx`: 20 passed (including 6 new HYG-11/12.1 assertions), 1 todo
- `npx vitest run` (full suite): 750 passed, 58 test files, 0 failures
- `npx tsc -b`: exits 0, no new errors (noUnusedLocals/noUnusedParameters enforced)
- Manual source check: `grep "updated\[index\] ="` returns 0 matches in CostCalculator.tsx
- Manual source check: `updatePackagingMaterial` declared once, called at 2 sites

## Deviations from Plan

None — plan executed exactly as written. TDD gate followed: RED (6 source-contract tests failed), GREEN (3 source edits applied, all 6 pass).

## Known Stubs

None. This is a pure behavior-preserving refactor — no data flow, no UI changes, no stubs.

## Threat Flags

None. This is an internal React state-update refactor with no new network, auth, persistence, or external boundaries.

## Self-Check: PASSED

- [x] `src/components/CostCalculator.tsx` modified — confirmed
- [x] `src/components/CostCalculator.test.tsx` modified — confirmed
- [x] Commit `8e2802c` exists — confirmed (`git log --oneline -1` → `8e2802c refactor(37-01): convert index-mutation handlers to immutable functional updaters (HYG-11 + HYG-12.1)`)
- [x] Full suite green — 750 tests, 58 files, 0 failures
- [x] `tsc -b` clean — exits 0
- [x] `updated[index] =` appears 0 times in CostCalculator.tsx
