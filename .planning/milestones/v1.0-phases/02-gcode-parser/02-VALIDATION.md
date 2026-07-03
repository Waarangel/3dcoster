---
phase: 2
slug: gcode-parser
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no vitest/jest installed) |
| **Config file** | None — `tsc -b` is the build gate |
| **Quick run command** | `tsc -b` |
| **Full suite command** | `tsc -b && npm run lint` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `tsc -b`
- **After every plan wave:** Run `tsc -b && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser test with multi-material .gcode file
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | GCODE-01 | type-check + manual | `tsc -b` | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | GCODE-02 | type-check + manual | `tsc -b` | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | GCODE-03 | type-check + manual | `tsc -b` | N/A | ⬜ pending |
| 02-01-04 | 01 | 1 | GCODE-04 | type-check + manual | `tsc -b` | N/A | ⬜ pending |
| 02-01-05 | 01 | 1 | GCODE-05 | type-check | `tsc -b` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework installation needed — `tsc -b` is the build gate and manual browser verification handles functional testing (consistent with Phase 1 pattern).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-material .gcode yields correct filamentTypes[] array | GCODE-01 | No test framework; visual/console verification | Drop a Bambu multi-color .gcode in the import UI; check DevTools console for parseGcode() return |
| Per-extruder weights populate filamentGramsPerExtruder[] | GCODE-02 | Same | Drop multi-material .gcode; verify array length matches extruder count in console |
| filamentVendors[] and filamentSettingsIds[] populated | GCODE-03 | Same | Drop multi-material .gcode with vendor data; verify arrays in console |
| Total-only weight → [total, 0, ...0] distribution | GCODE-04 | Requires specific Bambu file with only header total | Drop Bambu file without per-extruder grams; verify distribution |
| Scalar aliases unchanged for single-material files | GCODE-05 | Regression check | Drop a known single-material .gcode; verify filamentType/filamentGrams still work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
