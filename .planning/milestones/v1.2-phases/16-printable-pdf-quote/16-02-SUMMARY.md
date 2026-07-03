---
phase: 16-printable-pdf-quote
plan: "02"
subsystem: pdf-utilities
tags: [utilities, formatting, tax-labels, type-extension, feature-flag]
dependency_graph:
  requires:
    - 16-01 (Wave 0 scaffolds — format.test.ts + taxResolution.test.ts it.todo placeholders)
  provides:
    - src/utils/format.ts — formatQuoteNumber + customerNameSlug (consumed by plan 03)
    - src/utils/taxResolution.ts — taxLabelFor + EU_COUNTRY_CODES (consumed by plan 03)
    - src/types.ts — UserProfile.defaultTerms?: string (consumed by plan 04)
    - src/features.ts — 'pdf-quote' entry dated 2026-05-23 (consumed by plan 04 NewBadge)
  affects:
    - src/utils/format.test.ts (Wave 0 it.todo flipped to 15 real tests)
    - src/utils/taxResolution.test.ts (Wave 0 taxLabelFor it.todo flipped to 16 real tests)
tech_stack:
  added: []
  patterns:
    - Pure string utility functions following src/utils/currency.ts style
    - Section divider pattern for grouping helpers in utility files
    - Leading/trailing hyphen strip for whitespace-only customerNameSlug input (Rule 1 fix)
key_files:
  created:
    - src/utils/format.ts
  modified:
    - src/utils/format.test.ts
    - src/utils/taxResolution.ts
    - src/utils/taxResolution.test.ts
    - src/types.ts
    - src/features.ts
decisions:
  - "EU_COUNTRY_CODES uses GR (ISO 3166-1 alpha-2) not EL (Eurostat notation) — matches ISO standard used throughout codebase"
  - "ES → VAT (EU check fires first) — deliberate trade-off; EU sellers expect VAT not IVA on their PDFs per RESEARCH.md Pattern 9"
  - "customerNameSlug strips leading/trailing hyphens to handle whitespace-only input → '' edge case"
  - "pdf-quote ship date: 2026-05-23"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-23"
  tasks_completed: 3
  files_created: 1
  files_modified: 5
  commits: 3
---

# Phase 16 Plan 02: Utility Plumbing — Format Helpers, Tax Labels, Type Extension, Feature Flag Summary

**One-liner:** formatQuoteNumber + customerNameSlug + taxLabelFor pure functions added with 31 new tests; UserProfile.defaultTerms field and pdf-quote feature flag registered.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | formatQuoteNumber + customerNameSlug + real tests | 131513e | src/utils/format.ts created, format.test.ts 15 real tests |
| 2 | taxLabelFor + real tests | 9e668c1 | taxResolution.ts appended, taxResolution.test.ts 16 new tests |
| 3 | UserProfile.defaultTerms + pdf-quote feature entry | 3a54604 | types.ts field, features.ts 8 entries |

## Function Specifications

### `formatQuoteNumber(n: number): string`

| Input | Output |
|-------|--------|
| 1 | `'Q-0001'` |
| 42 | `'Q-0042'` |
| 1000 | `'Q-1000'` |
| 10000 | `'Q-10000'` (overflow passthrough — >4 digits) |
| 0 | `'Q-0000'` (edge case) |

### `customerNameSlug(name?: string): string`

| Input | Output |
|-------|--------|
| `undefined` | `''` |
| `''` | `''` |
| `'Alice Test'` | `'alice-test'` |
| `'Acme Co.'` | `'acme-co'` |
| `'Jean-François'` | `'jean-franois'` |
| `'Ça va'` | `'a-va'` |
| `'A'.repeat(50)` | `'a'.repeat(30)` |
| `'   '` | `''` (whitespace-only → empty after strip) |

### `taxLabelFor(countryCode?: string): 'VAT' | 'GST' | 'IVA' | 'Sales Tax' | 'Tax'`

Branch order (EU check fires FIRST):

| Code(s) | Label |
|---------|-------|
| EU27 (AT/BE/BG/HR/CY/CZ/DK/EE/FI/FR/DE/GR/HU/IE/IT/LV/LT/LU/MT/NL/PL/PT/RO/SK/SI/ES/SE) | `'VAT'` |
| GB | `'VAT'` |
| AU, NZ, IN, CA | `'GST'` |
| MX (ES is in EU set — EU wins) | `'IVA'` |
| US | `'Sales Tax'` |
| undefined/empty/unknown | `'Tax'` |

## EU_COUNTRY_CODES Set (27 members)

`AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE`

Note: GR (ISO 3166-1 alpha-2) used, not EL (Eurostat notation).

## Test Coverage

| File | Tests before | Tests after | it.todo remaining |
|------|-------------|-------------|-------------------|
| src/utils/format.test.ts | 0 (9 todos) | 15 | 0 |
| src/utils/taxResolution.test.ts | 29 (10 todos) | 45 | 0 |

**Total new tests: 31** (15 format + 16 taxLabelFor)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added leading/trailing hyphen strip in customerNameSlug for whitespace-only input**

- **Found during:** Task 1 (RED phase — test failed)
- **Issue:** `customerNameSlug('   ')` returned `'-'` instead of `''`. The whitespace-only string was converted to hyphens by `.replace(/\s+/g, '-')` then stripped of all non-`[a-z0-9-]` chars, leaving `'-'` — but the expected behavior per plan is `''`.
- **Fix:** Added `.replace(/^-+|-+$/g, '')` to strip leading/trailing hyphens before slicing. This correctly handles whitespace-only → empty output.
- **Files modified:** src/utils/format.ts
- **Commit:** 131513e (part of Task 1 commit)

## Known Stubs

None — all three functions are fully implemented with real behavior. No hardcoded fallbacks, no placeholder returns.

## Threat Flags

- T-16-04 (mitigate): `defaultTerms` field added to UserProfile. Plan 03 must use `doc.text()` (plain text only — NOT `doc.html()`). This threat is tracked in plan 03's execution.
- T-16-06 (mitigate): taxLabelFor has 16 unit tests covering all branches including the deliberate ES → VAT EU-first ordering.

No new unplanned threat surface introduced beyond what was in the threat model.

## Self-Check

- [x] src/utils/format.ts exists with exactly two named exports: `formatQuoteNumber`, `customerNameSlug`: VERIFIED
- [x] src/utils/format.test.ts has 15 real tests, 0 it.todo: VERIFIED
- [x] src/utils/taxResolution.ts exports `taxLabelFor` + retains all prior exports: VERIFIED
- [x] EU_COUNTRY_CODES is a Set<string> with exactly 27 ISO codes: VERIFIED (9+9+9)
- [x] src/utils/taxResolution.test.ts has 45 passing tests, 0 it.todo in taxLabelFor block: VERIFIED
- [x] src/types.ts UserProfile contains `defaultTerms?: string` before `nextQuoteNumber`: VERIFIED
- [x] src/features.ts has exactly 8 entries (pdf-quote added): VERIFIED
- [x] vitest run — 157 passing, 0 failures (8 remaining Wave 0 todos in other files): VERIFIED
- [x] tsc -b — no new type errors (pre-existing react-window/visualizer errors excluded): VERIFIED
- [x] All 3 task commits exist: 131513e, 9e668c1, 3a54604: VERIFIED

## Self-Check: PASSED
