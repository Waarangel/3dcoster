---
phase: 38
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing, 819 tests green) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <changed-area> --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-area> --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(filled by planner)_ | | | FOUND-01/02/03 | — | N/A | unit/sequence/render-count | `npx vitest run …` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Golden-fixture capture tests — fixtures recorded from the CURRENT CostCalculator BEFORE any refactor commit (D-01..D-03)
- [ ] Sequence-test harness for interlinked price/margin/profit keystrokes using the existing `createRoot` + `act` pattern (D-04)
- [ ] Render-count probe scaffolding for the once-per-keystroke assertion (D-15)

*Existing vitest + fake-indexeddb infrastructure covers the runner; new test files are phase deliverables.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rapid-typing feel on interlinked fields | FOUND-02 | Real keyboard latency/IME differs from synthetic events | UAT script: type quickly in price → margin → profit; displayed values stay consistent (D-12) |
| React DevTools Profiler spot-check | FOUND-02 | Profiler is a manual tool | One-time check that pricing sections render once per keystroke (D-15) |
| Tab Back/Forward + bookmark + PWA start_url | FOUND-03 | Browser history + PWA install behavior | UAT script: switch tabs, press Back/Forward, bookmark `?tab=jobs`, launch installed PWA (D-12) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
