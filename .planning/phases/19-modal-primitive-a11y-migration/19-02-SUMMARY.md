---
phase: 19-modal-primitive-a11y-migration
plan: "02"
subsystem: ui-primitives
tags: [a11y, primitives, useId, input, textarea, select, vitest]
dependency_graph:
  requires: []
  provides: [auto-id-primitives]
  affects: [Input, Textarea, Select]
tech_stack:
  added: []
  patterns: [useId-auto-id, forwardRef-id-resolution]
key_files:
  created:
    - src/components/ui/auto-id.test.tsx
  modified:
    - src/components/ui/Input.tsx
    - src/components/ui/Textarea.tsx
    - src/components/ui/Select.tsx
decisions:
  - "Consumer-supplied id always wins (resolvedId = id ?? generatedId); generated id is purely a fallback"
  - "id is destructured from props before the ...props spread so the underlying element's explicit id={resolvedId} cannot be overridden by the spread"
  - "No public interface (InputProps/TextareaProps/SelectProps) was modified; id was already present via HTMLAttributes"
metrics:
  duration: "2m"
  completed: "2026-05-26"
  tasks: 1
  files: 4
---

# Phase 19 Plan 02: UI Primitive Auto-ID (A11Y-07 Foundation) Summary

**One-liner:** Input, Textarea, and Select primitives now auto-generate a stable `id` via `useId()` when the consumer doesn't supply one, with consumer-supplied id always winning as the override.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add useId() auto-id to Input/Textarea/Select + priority-ordering test | `0a68d1a` | Input.tsx (+7), Textarea.tsx (+7), Select.tsx (+7), auto-id.test.tsx (+92) |

## Files Modified

| File | LOC Delta | Change |
|------|-----------|--------|
| `src/components/ui/Input.tsx` | +7 / -3 | Added `useId` import, destructured `id`, added `generatedId`/`resolvedId`, passed `id={resolvedId}` before spread |
| `src/components/ui/Textarea.tsx` | +7 / -3 | Same useId pattern as Input |
| `src/components/ui/Select.tsx` | +7 / -3 | Same useId pattern, `id` destructured alongside `children` |
| `src/components/ui/auto-id.test.tsx` | +92 (new) | 6 Vitest tests (2 per primitive) asserting the priority-ordering contract |

## Test Coverage

`src/components/ui/auto-id.test.tsx` — **6 tests, 6 passing**

All tests use raw `createRoot` + `act` per D-21 convention (no `@testing-library/react`).

| Test | Assertion |
|------|-----------|
| Input: consumer-supplied id wins | `id="custom-id"` → DOM `id` is `"custom-id"` |
| Input: generates a non-empty id when none is supplied | No `id` prop → DOM `id` is truthy, length > 0 |
| Textarea: consumer-supplied id wins | Same contract for `<textarea>` |
| Textarea: generates a non-empty id when none is supplied | Same contract for `<textarea>` |
| Select: consumer-supplied id wins | Same contract for `<select>` (with required `<option>` child) |
| Select: generates a non-empty id when none is supplied | Same contract for `<select>` |

## Verification Results

| Check | Result |
|-------|--------|
| `tsc -b` on modified files | 0 errors on Input/Textarea/Select/auto-id.test.tsx |
| `vitest run src/components/ui/auto-id.test.tsx` | 6/6 passed |
| `vitest run` (full suite) | 228 passed, 1 todo; 2 pre-existing failures unrelated to this plan (react-window + @tauri-apps/plugin-* not installed in worktree) |
| No public interface changes | Confirmed: `InputProps`, `TextareaProps`, `SelectProps` unchanged |
| `id` in consumer-supplied wins | Confirmed by test and by destructure-before-spread order |

**Note on `tsc -b` pre-existing errors:** The worktree's `node_modules` does not have `react-window`, `jspdf-autotable`, or `@tauri-apps/plugin-*` installed. These produce TS2307 errors in `JobsManager.tsx`, `generateQuotePdf.ts`, and `vite.config.ts` — all pre-existing before this plan, none related to the three primitives modified here.

## Retrofit Note

This plan closes the **primitive-side** half of A11Y-07. The retrofit of `<label htmlFor>` pairs in `CustomerEditModal` and the Record Sale form happens in **plans 19-04 / 19-05** — no consumer files were touched here.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three primitives fully implement the auto-id behavior with no placeholders.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `src/components/ui/Input.tsx` — FOUND
- `src/components/ui/Textarea.tsx` — FOUND
- `src/components/ui/Select.tsx` — FOUND
- `src/components/ui/auto-id.test.tsx` — FOUND
- Commit `0a68d1a` — FOUND (`git log --oneline | grep 0a68d1a`)
