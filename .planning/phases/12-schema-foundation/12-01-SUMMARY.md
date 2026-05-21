---
phase: 12-schema-foundation
plan: "01"
subsystem: types
tags:
  - schema
  - types
  - dexie-v6
dependency_graph:
  requires: []
  provides:
    - "JobCustomer interface (src/types.ts)"
    - "PrintJob.customer, tags, taxRate, taxAmount, quoteNumber optional fields"
    - "UserProfile.defaultTaxRate, nextQuoteNumber optional fields"
  affects:
    - "src/db/database.ts (Plan 03 v6 migration will reference PrintJob/UserProfile)"
    - "Phase 13 (taxRate/taxAmount/defaultTaxRate)"
    - "Phase 14 (customer/JobCustomer)"
    - "Phase 15 (tags)"
    - "Phase 16 (quoteNumber/nextQuoteNumber)"
tech_stack:
  added: []
  patterns:
    - "Additive optional-field pattern: field?: Type with no deprecated stubs (v1.0 Phase 01 locked decision)"
key_files:
  created: []
  modified:
    - "src/types.ts"
decisions:
  - "quoteNumber?: number added beyond SCHEMA-01 explicit field list per D-05/D-07 — field must land in v6 schema before Phase 16 (PDF) starts to avoid re-numbering on PDF regeneration"
  - "No imports added to types.ts — downstream phases will use import type per verbatimModuleSyntax setting (RESEARCH Pitfall 6)"
  - "No migration code for UserProfile new fields — getUserProfile fallback-merges missing keys via settings JSON blob (D-02 / Pattern S4)"
metrics:
  duration: "2m"
  completed: "2026-05-21"
  tasks_completed: 2
  files_modified: 1
---

# Phase 12 Plan 01: Type Definitions — Schema Foundation Summary

Pure additive TypeScript type declarations: `JobCustomer` interface plus 5 `PrintJob` fields and 2 `UserProfile` fields that give v1.2 downstream phases a stable type contract before the v6 Dexie migration runs in Plan 03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add JobCustomer interface and extend PrintJob | 2c80bc4 | src/types.ts |
| 2 | Extend UserProfile with defaultTaxRate and nextQuoteNumber | 605a2cf | src/types.ts |

## Changes Made

### New Interface: JobCustomer

Added immediately above `PrintJob` (mirrors the `FilamentUsage`-above-`PrintJob` layout):

```typescript
export interface JobCustomer {
  name?: string;
  email?: string;
  address?: string;  // Freeform multi-line; PDF prints verbatim (D-08)
  company?: string;
}
```

All 4 fields optional per D-09 (no runtime validation; Phase 14 adds form-level validation).

### PrintJob Extensions (5 new optional fields)

Final field ordering chosen per PATTERNS.md suggestion and CONTEXT.md "Claude's Discretion":

| Field | Position | Phase | Rationale |
|-------|----------|-------|-----------|
| `customer?: JobCustomer` | After `updatedAt`, before `filaments` | 14 | Job-identity grouping |
| `tags?: string[]` | After `customer?`, before `filaments` | 15 | Job-identity grouping |
| `taxRate?: number` | After `sellingPrice` | 13 | Per-job pricing override |
| `taxAmount?: number` | After `taxRate?` | 13 | Computed alongside taxRate |
| `quoteNumber?: number` | After `notes?` (end of interface) | 16 | Assigned on first PDF gen, reused on regeneration (D-05) |

Note: `quoteNumber?: number` was added **beyond the SCHEMA-01 explicit field list** per D-05/D-07. The field must land in v6 schema before Phase 16 (PDF) starts — assigning a new number on every PDF regeneration would be a UX bug. Field stays undefined on existing v5 records; Phase 16 assigns it on first PDF generation.

### UserProfile Extensions (2 new optional fields)

Added after `assetLibraryItemsPerPage?`, before the closing brace:

| Field | Phase | Note |
|-------|-------|------|
| `defaultTaxRate?: number` | 13 | Seeds per-job tax row when set in Settings |
| `nextQuoteNumber?: number` | 16 | D-06: first quote is #1, read via `?? 1` |

No migration code required — `getUserProfile(defaultValue)` fallback-merges missing keys via the existing `getSetting` JSON-parse path (Pattern S4).

## Verification

`tsc -b` reports zero errors in `src/types.ts` after both tasks. Three pre-existing TypeScript errors exist in the worktree environment (missing `node_modules` symlinks for `react-window` and `rollup-plugin-visualizer`) — confirmed pre-existing on the base commit, unrelated to this plan's changes, and absent in the main project repo where `node_modules` is installed.

All acceptance criteria checks pass:
- `export interface JobCustomer` present — 1 match
- All 4 `JobCustomer` fields present
- `customer?: JobCustomer` in `PrintJob`
- `tags?: string[]` in `PrintJob`
- `taxRate?: number` in `PrintJob`
- `taxAmount?: number` in `PrintJob`
- `quoteNumber?: number` in `PrintJob`
- Exactly 1 `export interface PrintJob`
- `notes?: string` preserved in `PrintJob`
- `defaultTaxRate?: number` in `UserProfile`
- `nextQuoteNumber?: number` in `UserProfile`
- Exactly 1 `export interface UserProfile`
- `assetLibraryItemsPerPage?: number` preserved
- `address?` nested type with all 5 sub-fields preserved
- No imports added to `types.ts`

## Deviations from Plan

None — plan executed exactly as written. All 7 new fields added in the ordering specified by PATTERNS.md. No existing fields removed, renamed, or required-ified.

## Known Stubs

None — `src/types.ts` contains only type declarations; no runtime values, no placeholder text.

## Threat Flags

None — this plan modifies compile-time types only. No runtime input, no external data, no transport. Pre-existing threat model T-12-01-01 applies (tampering at edit time caught by `tsc -b`).

## Self-Check: PASSED

- `src/types.ts` modified: FOUND (git status confirms)
- Task 1 commit 2c80bc4: FOUND
- Task 2 commit 605a2cf: FOUND
- `export interface JobCustomer` in types.ts: FOUND
- All 7 new fields in types.ts: FOUND
- No errors in types.ts from tsc: CONFIRMED
