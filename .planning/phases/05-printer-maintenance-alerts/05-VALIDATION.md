---
phase: 5
slug: printer-maintenance-alerts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 5 — Validation Strategy

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
| TBD | 01 | 1 | MAINT-01 | compile + manual | `tsc -b` | TBD | pending |
| TBD | 01 | 1 | MAINT-02 | compile + manual | `tsc -b` | TBD | pending |

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Alert popup appears at 500h boundary | MAINT-01 | Requires saving a job with a printer near a 500h boundary | 1. Set printer printHours to 498. 2. Save a 3h job. 3. Verify maintenance alert popup appears |
| Alert is dismissable and doesn't re-trigger | MAINT-02 | UI state + localStorage persistence | 1. Dismiss the alert. 2. Navigate away and back. 3. Verify alert does not reappear for same interval |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
