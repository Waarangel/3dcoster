---
phase: 16-printable-pdf-quote
plan: "06"
subsystem: cost-calculator-pdf-removal
tags: [pdf, gap-closure, d-13, cleanup, refactor]
dependency_graph:
  requires:
    - 16-04 (GeneratePdfButton wiring to remove — committed as 8bd4681 + 74579da on pedantic-ride)
  provides:
    - src/components/CostCalculator.tsx — CostCalculator without Generate PDF surface (D-13)
    - src/components/CostCalculator.test.tsx — Test file with GeneratePdfButton suite removed
  affects:
    - src/App.tsx (onPersistQuoteNumber prop no longer passed to CostCalculator; JobsManager still receives it)
tech_stack:
  added: []
  patterns:
    - Removal of GeneratePdfButton subcomponent pattern — surface responsibility moved to JobsManager
    - it.todo placeholder for retired test suite (Wave 0 scaffold rule compliance)
key_files:
  created: []
  modified:
    - src/components/CostCalculator.tsx
    - src/components/CostCalculator.test.tsx
    - src/App.tsx
decisions:
  - "GeneratePdfButton subcomponent, handleGeneratePdf handler, isGenerating state, and onPersistQuoteNumber prop removed from CostCalculator per D-13 — CostCalculator runs pre-save and pre-customer; quote from this surface is wrong-by-default"
  - "NewBadge import retained in CostCalculator.tsx — still used by model-url and etsy-helper badges"
  - "UserProfile import retained in CostCalculator.tsx — still used by userProfile: UserProfile prop (line 24)"
  - "handlePersistQuoteNumber function kept in App.tsx — JobsManager still consumes it via onPersistQuoteNumber prop"
  - "App.tsx comment block at handlePersistQuoteNumber retained unchanged — describes both CostCalculator and JobsManager history; no functional impact"
metrics:
  duration_minutes: 12
  completed_date: "2026-05-23"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
  commits: 2
---

# Phase 16 Plan 06: Remove Generate PDF Surface from CostCalculator Summary

**One-liner:** Removed GeneratePdfButton subcomponent, handleGeneratePdf handler, isGenerating state, and onPersistQuoteNumber prop from CostCalculator per D-13 — only JobsManager retains the PDF entry point.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Remove Generate PDF surface from CostCalculator.tsx | 45ce1af | CostCalculator.tsx (−81 lines: subcomponent, handler, state, prop) |
| 2 | Remove GeneratePdfButton tests + update App.tsx prop chain | 7cdf7cd | CostCalculator.test.tsx (→ it.todo placeholder), App.tsx (prop removed) |

## What Was Removed

### CostCalculator.tsx deletions

| Item | Lines removed | Description |
|------|--------------|-------------|
| `GeneratePdfButtonProps` interface | ~6 lines | Props interface for extracted subcomponent |
| `GeneratePdfButton` exported function | ~22 lines | Button subcomponent with disabled-state logic + NewBadge overlay |
| `onPersistQuoteNumber` prop in `CostCalculatorProps` | 5 lines (incl. comment) | REQUIRED callback that no longer belongs on this surface |
| `onPersistQuoteNumber` in function destructure | 1 token | Removed from signature |
| `isGenerating` useState | 2 lines | Double-click prevention flag — no longer needed |
| `handleGeneratePdf` async handler | 28 lines | Entire PDF generation logic + dynamic import |
| `<GeneratePdfButton .../>` JSX | 5 lines | Replaced with 1-line comment per D-13 |

### CostCalculator.test.tsx

All 4 real tests deleted; file now contains a single `describe` block with `it.todo` placeholder per Wave 0 scaffold rule.

### App.tsx

`onPersistQuoteNumber={handlePersistQuoteNumber}` removed from `<CostCalculator>` JSX only. `handlePersistQuoteNumber` function and its pass to `<JobsManager>` are untouched.

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c 'GeneratePdfButton' CostCalculator.tsx` | 0 |
| `grep -c "await import('../pdf/generateQuotePdf')" CostCalculator.tsx` | 0 |
| `grep -c 'isGenerating' CostCalculator.tsx` | 0 |
| `grep -c 'onPersistQuoteNumber' CostCalculator.tsx` | 0 |
| Global dynamic PDF import count across src/ | 1 (JobsManager.tsx:781 only) |
| `npx tsc -b` | EXIT 0 (clean) |
| `npx vitest run` | 177 passing, 1 todo, 0 failures |

## Deviations from Plan

### Minor plan-stated count discrepancy

**Found during:** Task 2 verification  
**Issue:** The plan acceptance criterion states `grep -c "onPersistQuoteNumber" src/App.tsx` returns "exactly 2 (the function definition handlePersistQuoteNumber and the JobsManager prop pass — NOT 3 as before)". The actual count after Task 2 is **1** (JobsManager prop pass only). The function is named `handlePersistQuoteNumber`, not `onPersistQuoteNumber`, so it does not appear in the grep. The plan's count of 2 was a miscount of the initial state (there were already only 2 occurrences before 16-06: CostCalculator JSX + JobsManager JSX; the plan claimed 3 as the "before" state).  
**Impact:** None — the functional intent is correct: CostCalculator no longer receives the prop; JobsManager still does.  
**Fix:** Documented as deviation. No code change needed.

## Known Stubs

None — this plan is purely a deletion plan. No new stubs introduced.

## Threat Flags

No new threat surface introduced. Per T-16-21 (Information Disclosure): removing the CostCalculator PDF entry point eliminates the wrong-by-default code path that could generate quotes without customer/snapshot context. Dynamic import audit count drops from 2 → 1 as planned.

## Self-Check

- [x] `grep -c 'GeneratePdfButton' CostCalculator.tsx` → 0: VERIFIED
- [x] `grep -c "await import('../pdf/generateQuotePdf')" CostCalculator.tsx` → 0: VERIFIED
- [x] `grep -c 'isGenerating' CostCalculator.tsx` → 0: VERIFIED
- [x] `grep -c 'onPersistQuoteNumber' CostCalculator.tsx` → 0: VERIFIED
- [x] Global dynamic PDF import count across src/ → 1 (JobsManager.tsx only): VERIFIED
- [x] CostCalculator.test.tsx GeneratePdfButton count → 0: VERIFIED
- [x] App.tsx still has handlePersistQuoteNumber function (line 161): VERIFIED
- [x] App.tsx still passes onPersistQuoteNumber to JobsManager (line 328): VERIFIED
- [x] App.tsx no longer passes onPersistQuoteNumber to CostCalculator: VERIFIED
- [x] `npx tsc -b` exits 0: VERIFIED
- [x] `npx vitest run` — 177 passing, 1 todo, 0 failures: VERIFIED
- [x] Task 1 commit 45ce1af exists: VERIFIED
- [x] Task 2 commit 7cdf7cd exists: VERIFIED

## Self-Check: PASSED
