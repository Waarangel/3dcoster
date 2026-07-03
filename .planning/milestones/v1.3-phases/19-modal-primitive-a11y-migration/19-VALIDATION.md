---
phase: 19
slug: modal-primitive-a11y-migration
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
backfilled: true
backfill_phase: 26-v1-3-cleanup
---

# Phase 19 — Validation Strategy

> Per-phase validation contract. Backfilled retroactively by Phase 26 (2026-05-28); per-task map points to 19-VERIFICATION.md observable truths per CONTEXT.md D-06.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 + raw createRoot + act (project convention) |
| **Config file** | `vite.config.ts` (vitest config inline) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run build` (runs `tsc -b && vite build` after `vitest run`) |
| **Estimated runtime** | ~5s for `npm test`, ~30s for `npm run build` |

---

## Sampling Rate

- **After every task commit:** `npm test`
- **After every plan wave:** `npm run build`
- **Phase gate:** `npm run build` exit 0 + VERIFICATION.md status: passed

---

## Per-Task Verification Map

> Backfill: rows reference 19-VERIFICATION.md "Observable Truths" table verbatim per D-06.

| Req ID | Plan | Wave | Observable Truth (from VERIFICATION.md) | Test Type | Automated Command | Evidence Source | Status |
|--------|------|------|------------------------------------------|-----------|-------------------|-----------------|--------|
| A11Y-01 | 19-01 | 1 | `Modal.tsx` exists with props `{isOpen, onClose, title, children, size?}`; produces `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}` via `useId()`; auto-renders `<h3 id={titleId}>{title}</h3>` | unit | `npx vitest run src/components/ui/Modal.test.tsx && npx tsc -b` | 19-VERIFICATION.md SC#1 | passed |
| A11Y-02 | 19-01 | 1 | Modal on mount focuses first focusable child via ref; on close restores focus to previously-active element captured on mount | unit | `npx vitest run src/components/ui/Modal.test.tsx && npx tsc -b` | 19-VERIFICATION.md SC#2 | passed |
| A11Y-03 | 19-04, 19-05 | 1 | While open: Tab/Shift+Tab cycle within focusable descendants (no escape to background); Escape invokes onClose | unit | `npx vitest run src/components/ui/Modal.test.tsx && npx tsc -b` | 19-VERIFICATION.md SC#3 | passed |
| A11Y-04 | 19-03 | 1 | 10 modal surfaces migrated to `<Modal>`: PrintQuoteModal, SettingsModal, UserProfileModal, CustomerEditModal, CustomerCsvImportModal, DeclineQuoteModal, MaintenanceAlertModal, CsvImportModal + 3 JobsManager inline overlays | unit | `npx vitest run src/components/ui/{Modal,InfoTooltip,auto-id,CollapsibleSection}.test.* && npx tsc -b` | 19-VERIFICATION.md SC#4 | passed |
| A11Y-05 | 19-06 | 1 | InfoTooltip uses `useId()` for tooltip span id; multiple instances produce unique ids | unit | `npx vitest run src/components/ui/{Modal,InfoTooltip,auto-id,CollapsibleSection}.test.* && npx tsc -b` | 19-VERIFICATION.md SC#5 | passed |
| A11Y-06 | 19-04 | 1 | react-window virtualized lists (JobsManager, CustomerLibrary, AssetLibrary) have `role="list"` + `aria-rowcount={totalCount}`; rows have `role="listitem"`; AssetLibrary desktop table parent has `role="grid"` | unit | `npx vitest run src/components/ui/{Modal,InfoTooltip,auto-id,CollapsibleSection}.test.* && npx tsc -b` | 19-VERIFICATION.md SC#6 | passed |
| A11Y-07 | 19-04, 19-05 | 1 | SettingsModal and UserProfileModal close buttons have `aria-label="Close"` | unit | `npx vitest run src/components/ui/{Modal,InfoTooltip,auto-id,CollapsibleSection}.test.* && npx tsc -b` | 19-VERIFICATION.md SC#7 | passed |
| A11Y-08 | 19-03 | 1 | Every label in Record Sale modal form and CustomerEditModal form is paired with input via `htmlFor`/`id`; Input/Textarea/Select primitives auto-generate `id` via `useId()` and accept explicit override | unit | `npx vitest run src/components/ui/{Modal,InfoTooltip,auto-id,CollapsibleSection}.test.* && npx tsc -b` | 19-VERIFICATION.md SC#8 | passed |
| HYG-09 | 19-01 | 1 | CollapsibleSection body always rendered with `hidden={!open}` so `aria-controls` references a real DOM id | unit | `npx vitest run src/components/ui/{Modal,InfoTooltip,auto-id,CollapsibleSection}.test.* && npx tsc -b` | 19-VERIFICATION.md SC#9 | passed |

---

## Wave 0 Requirements

Backfilled phase — Wave 0 was satisfied during the original phase execution. All test files referenced in the Per-Task Map exist in `src/`. No new test files required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Outcome |
|----------|-------------|------------|---------|
| VoiceOver UAT against all 10 modal surfaces (full 11-surface + 3-list test plan per 19-06-UAT.md) | A11Y-01..A11Y-08 (screen-reader layer) | Screen-reader behavior requires live assistive technology in a real browser session; cannot verify in headless agent context | Deferred — 19-06-UAT.md status: deferred per CONTEXT.md discretion block; accepted by user 2026-05-26; follow-on scoped for v1.4+. Per 19-VERIFICATION.md `overrides_applied: 1`: structural a11y work (role=dialog, aria-modal, focus trap, label pairing, role=list/listitem/grid) is complete and unit-tested. Override accepted by user (in-task deferral) at 2026-05-26. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or were satisfied during original execution
- [x] Sampling continuity preserved
- [x] Wave 0 satisfied retroactively
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] VoiceOver UAT override accepted per 19-VERIFICATION.md `overrides_applied: 1` (user deferral to v1.4+; structural a11y complete and unit-tested)

**Approval:** backfilled 2026-05-28 by Phase 26 per CONTEXT.md D-05/D-06

---

## Backfill Audit Trail

Backfilled by Phase 26 plan 26-02 on 2026-05-28. Source of truth for verification claims:
- `.planning/phases/19-modal-primitive-a11y-migration/19-VERIFICATION.md` (status: passed)
- `.planning/v1.3-MILESTONE-AUDIT.md` §requirements coverage
- CONTEXT.md decisions D-05 (template choice) and D-06 (pointer-doc semantics)
