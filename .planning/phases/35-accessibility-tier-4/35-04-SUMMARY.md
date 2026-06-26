---
phase: 35-accessibility-tier-4
plan: 04
subsystem: JobsManager
tags: [a11y, wcag-2.5.8, wcag-4.1.2, hit-target, progressbar, aria]
dependency_graph:
  requires: []
  provides: [A11Y-14, A11Y-15-progressbar]
  affects: [src/components/JobsManager.tsx]
tech_stack:
  added: []
  patterns:
    - WCAG 2.5.8 AA bounding box via min-w-[24px] min-h-[24px] Tailwind classes
    - WAI-ARIA progressbar role with aria-valuenow/min/max/valuetext
key_files:
  created: []
  modified:
    - src/components/JobsManager.tsx
    - src/components/JobsManager.test.tsx
decisions:
  - "24×24 hit target via min-w/min-h (not AAA 44×44) — LOCKED context decision honored"
  - "Chip glyph stays text-[10px]; bounding box enlarged without growing the visible glyph (Pitfall 7)"
  - "opacity-0 reveal pattern kept (subtle at rest, revealed on hover/focus) — LOCKED"
  - "aria-valuetext template: '{N} of {M} copies sold[ — break-even reached]'"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-26T09:56:32Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 35 Plan 04: Tag Chip Hit Target + Break-even Progressbar ARIA Summary

**One-liner:** 24×24 WCAG 2.5.8 AA hit target on tag-chip ✕ buttons via min-w/min-h + keyboard focus ring; break-even bar promoted to role=progressbar with aria-valuenow/min/max/valuetext.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| TDD RED | Failing tests for A11Y-14 + A11Y-15 | 639b9e4 | JobsManager.test.tsx (+233 lines, 14 new tests) |
| TDD GREEN | A11Y-14 chip hit target + focus ring; A11Y-15 progressbar ARIA | 82bb87d | JobsManager.tsx (7 insertions, 2 deletions) |

## What Was Built

### A11Y-14 — Tag chip ✕ hit target (WCAG 2.5.8 AA)

**Location:** `src/components/JobsManager.tsx` — the raw `<button>` inside each tag chip span (lines ~538-546).

**Change:** Replaced `w-3.5 h-3.5` (14px bounding box — below WCAG minimum) with `min-w-[24px] min-h-[24px]` (24px bounding box). Adjusted negative margin from `-mr-0.5` to `-mr-1` to keep the visual layout tight. Added `focus-visible:ring-1 focus-visible:ring-blue-400` for a clear keyboard focus ring.

The existing reveal pattern (`opacity-0` at rest → `group-hover/chip:opacity-100` on chip hover → `focus-visible:opacity-100` on keyboard focus) was preserved exactly per the LOCKED context decision. The visual glyph remains `text-[10px]` — the enlarged bounding box wraps it without making the ✕ appear larger.

**LOCKED decisions honored:**
- 24×24 AA target, not 44×44 AAA
- Glyph visually subtle at rest, revealed on hover/focus
- Keyboard-reachable at all times (no `tabIndex={-1}`)
- Stays a raw `<button>` with `allow-raw-html` comment (Button primitive's `min-h-[44px]` would dwarf the chip)

### A11Y-15 — Break-even progressbar ARIA (WCAG 4.1.2)

**Location:** `src/components/JobsManager.tsx` — the inner fill div inside the break-even progress track (lines ~707-714). Only applied in the non-null `breakEvenCopies` branch.

**Change:** Added `role="progressbar"`, `aria-valuenow={job.copiesSold}`, `aria-valuemin={0}`, `aria-valuemax={info.breakEvenCopies}`, and `aria-valuetext` with a human-readable template: `"{N} of {M} copies sold[ — break-even reached]"`.

The outer track `<div>` and color classes were left unchanged. The null branch (sell price does not exceed cost) correctly receives no progressbar role as there is no measurable progress to expose.

## Test Coverage

14 new assertions across 2 describe blocks in `JobsManager.test.tsx`:

**A11Y-14 (7 tests):**
- `min-w-[24px]` class present
- `min-h-[24px]` class present
- Old `w-3.5` / `h-3.5` classes absent
- `focus-visible:opacity-100` present
- `focus-visible:ring-1` present
- No `tabIndex="-1"`
- `aria-label` starts with "Remove tag "

**A11Y-15 (7 tests):**
- `role="progressbar"` present when `breakEvenCopies` non-null
- `aria-valuenow` equals `copiesSold`
- `aria-valuemin` is "0"
- `aria-valuemax` equals `breakEvenCopies`
- `aria-valuetext` contains both copied sold and break-even target
- `aria-valuetext` contains "break-even reached" when `isBreakEven` is true
- `aria-valuetext` does not contain "break-even reached" when `isBreakEven` is false

**Full suite:** 721 tests passed, 1 todo (pre-existing) — no regressions.

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented in a single GREEN commit since they both touch `JobsManager.tsx` and were both covered by the single RED test commit.

## Threat Flags

None. No new network endpoints, auth paths, file access, or data handling introduced. Changes are CSS class modifications and additive ARIA attributes on existing client-side UI elements.

## Self-Check: PASSED

- FOUND: src/components/JobsManager.tsx
- FOUND: src/components/JobsManager.test.tsx
- FOUND: .planning/phases/35-accessibility-tier-4/35-04-SUMMARY.md
- FOUND commit: 639b9e4 (RED — failing tests)
- FOUND commit: 82bb87d (GREEN — implementation)
- Full suite: 721 tests passed
