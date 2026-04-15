---
phase: 3
slug: calculator-ui-import
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc -b`) + Vite build — no unit test framework installed |
| **Config file** | `tsconfig.json` (project references via `-b` mode) |
| **Quick run command** | `npx tsc -b 2>&1 \| head -20` |
| **Full suite command** | `npm run build` (`tsc -b && vite build`) |
| **Estimated runtime** | ~15 seconds |

*Note: Vitest is not installed in this project. `tsc -b` is the primary quality gate per CLAUDE.md. Vercel runs `tsc -b && vite build` for production builds.*

---

## Sampling Rate

- **After every task commit:** Run `npx tsc -b 2>&1 | head -20`
- **After every plan wave:** Run `npm run build` (full production build)
- **Before `/gsd:verify-work`:** `npm run build` must succeed
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 03-01-01 | 01 | 1 | IMPORT-01, IMPORT-02, IMPORT-03 | type-check | `cd /Users/marcusdickinson/Projects/3DCoster && npx tsc -b 2>&1 \| grep -E '(GcodeImport\|error TS)' \| head -20` | pending |
| 03-02-01 | 02 | 1 | UI-01, UI-02, UI-03, UI-04, UI-05 | type-check | `cd /Users/marcusdickinson/Projects/3DCoster && npx tsc -b 2>&1 \| head -20` | pending |
| 03-02-02 | 02 | 1 | UI-02, UI-03 | type-check | `cd /Users/marcusdickinson/Projects/3DCoster && npx tsc -b 2>&1 \| head -20` | pending |
| 03-03-01 | 03 | 2 | COST-01, COST-02, COST-03 | type-check | `cd /Users/marcusdickinson/Projects/3DCoster && npx tsc -b 2>&1 \| head -20` | pending |
| 03-03-02 | 03 | 2 | PERSIST-01, PERSIST-02 | type-check + build | `cd /Users/marcusdickinson/Projects/3DCoster && npm run build 2>&1 \| tail -5` | pending |
| 03-03-03 | 03 | 2 | — | human-verify | `npm run build` + browser test at localhost:5173 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

None. This phase uses `tsc -b` as the primary quality gate (per CLAUDE.md: "always use `tsc -b` for TypeScript verification"). No test framework installation is required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast lists all materials with weights | IMPORT-03 | Visual toast rendering depends on browser | Import multi-material gcode, verify toast shows each material name and weight |
| Filament selector dropdown UX | UI-04 | Interactive dropdown behavior | Add 3 rows, change material in each, verify independent selection |
| Add/remove filament rows | UI-02, UI-03 | Interactive DOM manipulation | Click "+ Add Filament", verify row appears; click X on row 2+, verify removal |
| Full save/restore cycle | PERSIST-01 | End-to-end state persistence | Add 3 filament rows, save job, edit it, verify all rows restored |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands using `tsc -b` or `npm run build`
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
