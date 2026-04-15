---
phase: 3
slug: calculator-ui-import
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — Wave 0 installs Vitest + React Testing Library |
| **Config file** | None — Wave 0 creates `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | — | infra | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | UI-01 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | UI-02 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | UI-03 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | UI-04 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-05 | 02 | 1 | UI-05 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | COST-01 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 1 | COST-02 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 1 | COST-03 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | IMPORT-01 | unit | `npx vitest run src/components/GcodeImport.test.tsx` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | IMPORT-02 | unit | `npx vitest run src/components/GcodeImport.test.tsx` | ❌ W0 | ⬜ pending |
| 03-04-03 | 04 | 2 | IMPORT-03 | unit | `npx vitest run src/components/GcodeImport.test.tsx` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 2 | PERSIST-01 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-05-02 | 05 | 2 | PERSIST-02 | unit | `npx vitest run src/components/CostCalculator.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event` — install test framework
- [ ] `vitest.config.ts` — configure jsdom environment
- [ ] `src/test/setup.ts` — RTL cleanup afterEach
- [ ] `src/components/CostCalculator.test.tsx` — stubs for UI-01–UI-05, COST-01–COST-03, PERSIST-01–PERSIST-02
- [ ] `src/components/GcodeImport.test.tsx` — stubs for IMPORT-01–IMPORT-03

*Note: `mode: "yolo"` in config — test scaffolding is optional Wave 0, not a blocker. `tsc -b` is the primary quality gate per CLAUDE.md.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast lists all materials with weights | IMPORT-03 | Visual toast rendering depends on browser | Import multi-material gcode, verify toast shows each material name and weight |
| Filament selector dropdown UX | UI-04 | Interactive dropdown behavior | Add 3 rows, change material in each, verify independent selection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
