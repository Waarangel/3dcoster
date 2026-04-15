---
phase: 4
slug: jobs-display
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + `tsc -b` |
| **Config file** | tsconfig.json (existing) |
| **Quick run command** | `tsc -b` |
| **Full suite command** | `tsc -b && vite build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `tsc -b`
- **After every plan wave:** Run `tsc -b && vite build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | JOBS-01 | manual + compile | `tsc -b` | ✅ | ⬜ pending |
| TBD | 01 | 1 | JOBS-02 | manual + compile | `tsc -b` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

No new test framework needed — this project uses TypeScript compilation (`tsc -b`) as its automated verification and manual browser testing for UI behavior.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-filament display shows "PETG 200g + PLA 50g" format | JOBS-01 | Visual UI rendering | 1. Save a multi-material job. 2. View jobs list. 3. Confirm all filaments shown with `+` separator and gram values |
| Single-filament display unchanged from pre-Phase-3 | JOBS-01 | Visual regression check | 1. View a migrated single-filament job. 2. Confirm display matches previous format |
| Empty filaments array shows fallback text | JOBS-01 | Edge case display | 1. If any job has `filaments: []`, confirm "No filament data" or similar fallback |
| Edit restore loads all filament rows | JOBS-02 | UI state verification | 1. Click edit on multi-material job. 2. Confirm all filament rows appear with correct grams and prices |
| Migrated job edit uses asset-library fallback price | JOBS-02 | Price fallback chain | 1. Edit a job migrated from old schema. 2. Confirm price loads from asset library (not 0) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
