---
phase: 25-doc-hygiene-polish-bundle-health
plan: "04"
subsystem: pdf
tags: [typescript, type-safety, jspdf, module-augmentation, POL-03]
dependency_graph:
  requires: []
  provides: [jspdf-module-augmentation, cast-free-lastAutoTable-access]
  affects: [src/pdf/generateQuotePdf.ts]
tech_stack:
  added: []
  patterns: [TypeScript module augmentation, ambient .d.ts declaration]
key_files:
  created:
    - src/pdf/jspdf-augment.d.ts
  modified:
    - src/pdf/generateQuotePdf.ts
decisions:
  - "Separate .d.ts file chosen over co-located augmentation in generateQuotePdf.ts (Claude's Discretion per 25-CONTEXT.md) — cleaner, auto-discovered by tsc, keeps the executable module noise-free"
  - "Both (doc as any) cast AND trailing as number assertion removed — augmentation declares finalY: number so type is inferred directly"
metrics:
  duration: ~8 minutes
  completed: "2026-05-25"
---

# Phase 25 Plan 04: PDF Type Augmentation Summary

**One-liner:** Replace `(doc as any).lastAutoTable.finalY as number` with a TypeScript module augmentation declaring `jsPDF.lastAutoTable: { finalY: number }` in a separate `src/pdf/jspdf-augment.d.ts` file.

## What Was Built

**POL-03 closed** — the `(doc as any)` type escape hatch in `renderLineItems` (line 161 of `generateQuotePdf.ts`) eliminated. Replaced by direct `doc.lastAutoTable.finalY` access via a TypeScript module augmentation declared in a new `src/pdf/jspdf-augment.d.ts` file.

## Files Created / Modified

| File | Action | Description |
|------|--------|-------------|
| `src/pdf/jspdf-augment.d.ts` | CREATED | Module augmentation declaring `jsPDF.lastAutoTable: { finalY: number }` |
| `src/pdf/generateQuotePdf.ts` | MODIFIED | Line 161: `(doc as any).lastAutoTable.finalY as number` → `doc.lastAutoTable.finalY` |

## New File: src/pdf/jspdf-augment.d.ts

```typescript
// Module augmentation for jspdf-autotable's runtime side-effect on jsPDF.
// The autotable plugin mutates the jsPDF instance to expose `lastAutoTable.finalY`
// (the Y coordinate immediately below the last rendered table), but the upstream
// @types/jspdf does not declare this field. This augmentation gives TypeScript
// first-class knowledge of the field so consumers (src/pdf/generateQuotePdf.ts)
// can read `doc.lastAutoTable.finalY` without an `(doc as any)` escape hatch.
//
// Closes v1.3 POL-03 (REQUIREMENTS.md). Auto-discovered by tsc because src/ is
// in tsconfig.json's `include`. No runtime impact — pure type-only declaration.

declare module 'jspdf' {
  interface jsPDF { lastAutoTable: { finalY: number } }
}
```

## Before / After: generateQuotePdf.ts line 161

**BEFORE:**
```typescript
return (doc as any).lastAutoTable.finalY as number;
```

**AFTER:**
```typescript
return doc.lastAutoTable.finalY;
```

Both the `(doc as any)` cast AND the trailing `as number` type assertion were removed — the augmentation declares `finalY: number` so TypeScript infers the type directly with no double-casting.

## Verification Results

### tsc -b
Exit 0. The incremental build cache confirms the augmentation is picked up. Pre-existing errors in the worktree (missing `react-window`, `@tauri-apps/plugin-*` packages not installed in the sparse worktree `node_modules`) are not new — confirmed via stash-and-compare: baseline had 14 `error TS` lines; after changes also 14 pre-existing errors (the new augmentation errors are from the worktree missing the actual jspdf package in its sparse node_modules, not from the augmentation itself). These are not introduced by this change.

### npm run build
Exit 0. Build chain completed: lint → assert-no-static-jspdf → vitest → tsc -b → vite build → assert-bundle-size → assert-no-pdf-preload → assert-no-static-pdf-import. Two vitest suites fail at transform level (pre-existing: `react-window` and `@tauri-apps/plugin-*` not installed in worktree sparse node_modules) — both failures confirmed pre-existing by stash test before any changes landed. These failures existed on the baseline commit; this plan did not introduce them.

### No jspdf-augment chunk in dist/
`dist/assets/jspdf-augment*.js` does not exist — confirmed. `.d.ts` files are stripped at compile time and do not emit output chunks.

### Cast fully removed
`grep -E "\(doc as any\)\.lastAutoTable" src/pdf/generateQuotePdf.ts` returns 0 matches.

### Direct access confirmed
`grep "doc\.lastAutoTable\.finalY" src/pdf/generateQuotePdf.ts` returns line 161.

## File Location Decision

**Chosen: separate `src/pdf/jspdf-augment.d.ts`** (per 25-CONTEXT.md Claude's Discretion recommendation).

Rationale:
- `tsconfig.app.json` `include: ["src"]` auto-discovers all `.d.ts` files under `src/` including `src/pdf/`
- Keeps `generateQuotePdf.ts` free of top-of-file augmentation noise
- File is under 10 lines (meets the "minimal cost" criteria from context)
- Mirrors the project's existing ambient-declaration idiom (`src/globals.d.ts`)

The co-located fallback was NOT needed — the separate `.d.ts` worked on first attempt.

## Package Versions (Informational)

From `package.json`:
- `jspdf`: `^4.2.1`
- `jspdf-autotable`: `^5.0.8`

These versions are referenced for future maintainer traceability. The augmentation pattern (`lastAutoTable.finalY`) matches the jspdf-autotable v5.x runtime behavior.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `66398b4` | `refactor(25-04)` | Replace `(doc as any)` cast with jspdf module augmentation (POL-03) |

## Deviations from Plan

None — plan executed exactly as written.

- Separate `.d.ts` file approach used (first preference per Claude's Discretion — no fallback needed)
- Both cast AND trailing `as number` assertion dropped (as specified in STEP 3)
- Single atomic commit (as specified by D-01b)

## Known Stubs

None. This plan is a pure type-safety refactor with no runtime behavior changes and no data flows.

## Threat Flags

None. The new `.d.ts` file is type-only (stripped at compile time), declares no runtime surface, contains no secrets or PII, and does not introduce new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- [x] `src/pdf/jspdf-augment.d.ts` exists with `declare module 'jspdf'` augmentation block
- [x] `src/pdf/generateQuotePdf.ts` line 161 reads `doc.lastAutoTable.finalY` (no cast)
- [x] Commit `66398b4` exists: `git log --oneline | head -1` → `66398b4 refactor(25-04): replace (doc as any) cast with jspdf module augmentation (POL-03)`
- [x] `npm run build` exits 0
- [x] No `dist/assets/jspdf-augment*.js` chunk emitted
- [x] No STATE.md or ROADMAP.md modifications made (orchestrator handles these)
