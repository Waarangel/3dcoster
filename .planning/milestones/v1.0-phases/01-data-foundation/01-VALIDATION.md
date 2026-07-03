---
phase: 1
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (TypeScript compiler only) |
| **Config file** | tsconfig.json |
| **Quick run command** | `tsc -b` |
| **Full suite command** | `tsc -b && npm run lint` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `tsc -b`
- **After every plan wave:** Run `tsc -b && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DATA-01 | TypeScript compile | `tsc -b` | N/A | ⬜ pending |
| 1-01-02 | 01 | 1 | DATA-02 | TypeScript compile | `tsc -b` | N/A | ⬜ pending |
| 1-01-03 | 01 | 1 | DATA-03 | Manual | Open app, inspect IndexedDB | N/A | ⬜ pending |
| 1-01-04 | 01 | 1 | DATA-04 | Manual | Create edge case jobs, run migration | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installation needed — `tsc -b` is the automated gate and manual inspection validates migration correctness.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing jobs survive migration | DATA-03 | IndexedDB migration is runtime-only, no unit test infra | 1. Create a job with old schema, 2. Reload app (triggers migration), 3. Open DevTools → Application → IndexedDB → 3DCosterDB → jobs, 4. Verify job has `filaments` array with correct data |
| Empty filamentId migrates to empty array | DATA-04 | Edge case requires specific DB state | 1. Manually insert job with empty filamentId in IndexedDB, 2. Reload app, 3. Verify `filaments: []` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
