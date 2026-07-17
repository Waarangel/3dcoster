---
phase: 44
slug: sync-stl-instant-quote
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-16
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (unit/integration, jsdom) + Playwright 1.61.1 (E2E) |
| **Config file** | `vitest.config.ts` (includes `src/**/*.test.{ts,tsx}`, `tests/**/*.test.ts`, `api/**/*.test.ts`); `playwright.config.ts` |
| **Quick run command** | `npx vitest run <relevant new test file>` (e.g. `src/utils/syncMerge.test.ts`, `src/utils/stlParser.test.ts`) |
| **Full suite command** | `npm test` (vitest run — also wired into `npm run build` as a gate) |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick-run vitest command for the file(s) touched
- **After every plan wave:** Run `npm test` (full vitest suite)
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` (chains lint-no-raw-html, assert-no-static-jspdf, coverage, `tsc -b`, vite build, assert-bundle-size, assert-no-pdf-preload, assert-no-static-pdf-import — the new `assert-no-static-three-import.mjs` joins this chain)
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled by planner — see RESEARCH.md § Validation Architecture for the requirements→test map)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/syncMerge.test.ts` — SYNC-01 LWW / tombstone / schema-version behavior
- [ ] `src/utils/syncLock.test.ts` — SYNC-01 multi-tab race safety (mocked `navigator.locks`)
- [ ] `src/utils/syncFileIO.test.ts` — SYNC-01 atomic-write behavior (both platforms, mocked I/O)
- [ ] `src/components/SyncMergeSummary.test.tsx` — SYNC-01 merge-summary UI
- [ ] `src/utils/stlParser.test.ts` — CONN-02 volume/area/non-manifold math (needs fixtures: unit-cube STL, non-manifold STL, one real slicer-exported STL)
- [ ] `src/utils/unitsHeuristic.test.ts` — CONN-02 mm/inch guard
- [ ] `src/utils/meshWeightModel.test.ts` — CONN-02 shells+infill weight model
- [ ] `src/workers/meshEstimate.worker.test.ts` — CONN-02 non-blocking guarantee
- [ ] `scripts/assert-no-static-three-import.mjs` — new CI gate, cloned from the jsPDF-family scripts
- [ ] Framework install: none needed (Vitest/Playwright already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File System Access API directory-handle persistence across browser restarts | SYNC-01 | Real browser permission UI cannot be automated in jsdom | Chrome: pick sync folder, restart browser, relaunch app, confirm no re-prompt (or single re-confirm) and sync status shows folder |
| Tauri sync-folder persistence across app restarts (persisted-scope) | SYNC-01 | Requires real desktop build + restart cycle | `npm run tauri:dev`: pick folder, write sync file, quit, relaunch, confirm auto-write still permitted |
| 3D preview renders and rotates; units warning visibly matches preview size | CONN-02 | Visual/WebGL behavior not assertable in jsdom | Upload known STL, rotate preview, toggle mm/inch, confirm dimensions overlay updates |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (gsd-plan-checker verified: every task in all 6 plans carries an `<automated>` command)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no broken Wave-0 refs; test files are created by their own plans during execution — `wave_0_complete` flips then)
- [x] No watch-mode flags
- [x] Feedback latency < 90s for per-task quick-runs (full `npm run build` chain in 44-02/44-05/44-06 exceeds this — accepted as WARNING per dimension 8b threshold, runs at wave/phase boundaries)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-16 (gsd-plan-checker VERIFICATION PASSED, 2 non-blocking warnings closed)
