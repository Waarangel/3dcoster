---
phase: 6
slug: 3mf-multi-plate-project-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + jsdom (Wave 0 install) + `tsc -b` |
| **Config file** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `tsc -b && npx vitest run && npx vite build` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `tsc -b`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | - | unit test setup | `npx vitest run` | TBD | pending |
| TBD | 01 | 1 | 3MF-01 | unit | `npx vitest run` | TBD | pending |
| TBD | 01 | 1 | 3MF-03 | unit | `npx vitest run` | TBD | pending |
| TBD | 01 | 1 | 3MF-02, 3MF-04 | manual + compile | `tsc -b` | TBD | pending |

---

## Wave 0 Requirements

- [ ] `vitest` + `jsdom` installed as dev dependencies
- [ ] `vitest.config.ts` created with jsdom environment
- [ ] `src/utils/threeMfParser.test.ts` — stubs for 3MF-01, 3MF-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drop sliced 3MF populates calculator | 3MF-02 | Requires real Bambu 3MF file + browser UI | 1. Drop a sliced Bambu 3MF. 2. Verify filament rows and print time populated. 3. Verify plate count shown in toast |
| Non-sliced 3MF shows error | 3MF-03 | Also testable in unit tests with synthetic ZIP | 1. Drop a geometry-only 3MF. 2. Verify helpful error message |
| Plate count displayed | 3MF-04 | UI rendering | 1. Import multi-plate 3MF. 2. Verify toast shows "N plates" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
