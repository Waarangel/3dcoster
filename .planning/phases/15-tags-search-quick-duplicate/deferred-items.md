# Phase 15 — Deferred Items (Out of Scope)

Pre-existing issues discovered during Phase 15 plan execution. Per the
SCOPE BOUNDARY rule, these are NOT auto-fixed because they were caused
by prior phases / unrelated dependency-install state and would expand
this plan beyond its objective.

## Pre-existing `tsc -b` TS2307 module-resolution errors

Discovered while running `npx tsc -b` as a Plan 15-02 verification step.
All errors point to missing `@types/...` declarations or uninstalled
runtime modules — none are caused by anything written in 15-02. Resolved
by `npm install` (the worktree was spawned without a fresh `npm install`
and these packages are present in package.json but missing from
node_modules).

`tsc -b` still exits **0** despite these warnings being printed (they
are non-fatal in the current tsconfig setup), so they do NOT block
plan-level verification.

| File | Missing module | Source phase |
|------|----------------|--------------|
| `src/components/AssetLibrary.tsx:2` | `react-window` | Phase 11 (virtualization) |
| `src/components/CustomerLibrary.tsx:3` | `react-window` | Phase 15.1 (customer library) |
| `src/components/JobsManager.tsx:2` | `react-window` | Phase 11 |
| `src/pdf/generateQuotePdf.ts:12` | `jspdf` | Phase 16 (PDF quote) |
| `src/pdf/generateQuotePdf.ts:13` | `jspdf-autotable` | Phase 16 |
| `src/pdf/generateQuotePdf.ts:320` | `@tauri-apps/plugin-dialog` | Phase 16 (Tauri save dialog) |
| `src/pdf/generateQuotePdf.ts:321` | `@tauri-apps/plugin-fs` | Phase 16 |
| `vite.config.ts:5` | `rollup-plugin-visualizer` | Phase 11 (bundle analyzer) |

**Recommendation:** the wave-1 orchestrator (or wave-2 setup) should run
`npm install` once before any plan that imports these modules executes.
Plan 15-02 itself does NOT import any of them — `duplicateJob.ts` only
imports `type { PrintJob }` from `../types` — so this is logged for
information, not for action by 15-02.
