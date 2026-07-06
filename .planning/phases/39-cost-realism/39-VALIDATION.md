---
phase: 39
slug: cost-realism
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — 855 tests green at Phase 38 close) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <changed-test-files>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <affected test files>`
- **After every plan wave:** Run `npx vitest run` (full suite) + `npx tsc -b`
- **Before `/gsd:verify-work`:** Full suite must be green, `tsc -b` clean, `npm run build` green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled by planner — one row per task)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `goldenScenarios.ts` fixtures so the 120-scenario output-equivalence oracle covers any new `CalcInput` fields (TOU tariff, maintenance $/hr) — without this the oracle silently stops covering new code paths
- [ ] Test stubs for new Dexie stores (`failureEvents`, `maintenanceEvents`) at `db.version(12)` including migration test
- [ ] Backup/restore round-trip test extension for the two new stores in `backupSchema.ts`

*Existing vitest infrastructure covers the framework; no new tooling install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One-tap failure logging feels one-tap from a job row | FAIL-01 | UX judgment | Open Jobs tab, log a failure from a job, count interactions |
| Empirical failure-rate suggestion renders beside manual input without layout shift | FAIL-03 | Visual | Open calculator with ≥1 failure logged, inspect suggestion chip |
| TOU tariff window editor usability in Settings | TOU-01 | UX judgment | Define peak/off-peak windows, verify overlap handling messaging |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
