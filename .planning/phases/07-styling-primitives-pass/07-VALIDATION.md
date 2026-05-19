---
phase: 7
slug: styling-primitives-pass
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `07-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc -b`) + Vite build + custom Node.js lint script |
| **Config file** | `tsconfig.json`, `vite.config.ts`, `scripts/lint-no-raw-html.mjs` (Wave 0 creates) |
| **Quick run command** | `npm run lint:no-raw-html` |
| **Full suite command** | `npm run build` (runs `tsc -b && vite build`; lint guard wired in via npm script) |
| **Estimated runtime** | ~10–20 seconds (build), <1s (lint) |

No unit-test framework runs against this phase. Phase 7 is a refactor onto strongly-typed primitives — TypeScript compilation is the primary correctness gate. Visual smoke testing at port 4173 is the manual gate (per CONTEXT D-06: visual change is acceptable, behavioral change is not).

---

## Sampling Rate

- **After every task commit:** Run `npm run lint:no-raw-html` (when the script exists) and `tsc -b` for type errors.
- **After every plan wave:** Run `npm run build` (full build with lint guard).
- **Before `/gsd:verify-work`:** Full build green + visual smoke test of refactored components at port 4173.
- **Max feedback latency:** <20 seconds for `npm run build` on incremental builds.

---

## Per-Task Verification Map

Tasks are scoped to per-file refactors. Each task's verify command is the same (build + lint) — the executor knows the task succeeded when build + lint stay green AND the target file's raw-element count drops to 0 (or matches `// allow-raw-html` opt-out count).

| Task ID Pattern | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|-----------------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-W0-* (Wave 0) | 03 | 0 | UI-03 | infra | `node scripts/lint-no-raw-html.mjs` exits 0 | ❌ W0 | ⬜ pending |
| 7-01-* (heaviest files) | 01 | 1 | UI-01, UI-02 | smoke + lint | `npm run build` exits 0 | ✅ | ⬜ pending |
| 7-02-* (high-count files) | 02 | 1 | UI-01, UI-02 | smoke + lint | `npm run build` exits 0 | ✅ | ⬜ pending |
| 7-03-* (lint + remaining files) | 03 | 2 | UI-01, UI-02, UI-03 | smoke + lint | `npm run build` exits 0; `node scripts/lint-no-raw-html.mjs` exits 0 | ✅ (after W0) | ⬜ pending |
| 7-*-LINT-VERIFY | 03 | 2 | UI-03 | adversarial | Add raw `<button>` → script exits 1; revert | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The planner fills in concrete task IDs (e.g., `7-01-01`, `7-01-02`, ...) when it splits the work in PLAN.md files.

---

## Wave 0 Requirements

Wave 0 must complete before any per-file refactor runs, because the lint guard must exist to enforce the no-raw-html invariant on each subsequent task.

- [ ] `scripts/lint-no-raw-html.mjs` — Node.js script that greps `src/components/**/*.tsx` (excluding `src/components/ui/`) for raw `<button|<input|<select|<textarea` and excludes matches where the preceding line contains `// allow-raw-html`. Exit non-zero on violation.
- [ ] `package.json` updated: add `"lint:no-raw-html": "node scripts/lint-no-raw-html.mjs"` to `scripts`; chain it into `build` (e.g., `"build": "tsc -b && vite build && npm run lint:no-raw-html"`).
- [ ] `.git/hooks/pre-commit` — shell script that runs `npm run lint:no-raw-html`, exits non-zero on violation. Made executable (`chmod +x`).
- [ ] `package.json` `prepare` script — sets the hook executable on `npm install` for fresh-clone portability.

---

## Manual-Only Verifications

Per CONTEXT D-06, visual change is the goal — no pixel-diff test required. But behavior must be preserved, which means a human must click through the refactored UI.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calculator inputs accept and coerce numeric values | UI-01, UI-02 | Browser-native coercion (`type="number"`) isn't asserted in a build | Open port 4173, enter values in CostCalculator, verify totals recalculate |
| Disabled states render with correct cursor/opacity | UI-01, UI-02 | Visual styling not asserted in build | Trigger disabled buttons/inputs (e.g., empty form), confirm visual feedback |
| AssetLibrary form submit works (only `<form>` in app) | UI-01 | Native form submission flow | Add a filament asset via the form, confirm save |
| CsvImportModal radio group still toggles | UI-01 | Radios kept as `// allow-raw-html` per L-4 | Open CSV import, toggle replace/skip/append, confirm exclusive selection |
| Hidden file inputs still trigger file picker | UI-02 | Hidden refs (GcodeImport, CsvImportModal) per L-5 | Click "Import G-code" / "Import CSV", confirm OS picker opens |
| SettingsModal tab switching | UI-01 | Tabs kept as `// allow-raw-html` per A1 | Click each settings tab, confirm active-state indicator and pane swap |

---

## Adversarial Lint Tests (UI-03)

These are required to prove the lint guard actually works — not just "exists and exits 0 on a clean tree." Each must be performed by the executor before Plan 03 is marked complete.

| # | Test | Expected | Cleanup |
|---|------|----------|---------|
| 1 | Insert `<button onClick={() => {}}>x</button>` into `src/components/CostCalculator.tsx` | `npm run lint:no-raw-html` exits 1, names the violation | Revert insertion |
| 2 | Insert same `<button>` with `// allow-raw-html` on the line above | Script exits 0 (opt-out honored) | Revert insertion |
| 3 | Insert `<input>` into `src/components/ui/Button.tsx` | Script exits 0 (ui/ excluded) | Revert insertion |
| 4 | Insert `<button>` into `src/pages/LandingPage.tsx` | Script exits 0 (pages/ excluded — out of scope per D-02) | Revert insertion |
| 5 | `git commit` with a violation staged | Pre-commit hook rejects the commit | Reset HEAD |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (build + lint) or are explicit Wave 0 dependencies
- [ ] Sampling continuity: every task ends with `npm run build` (no 3 consecutive tasks without automated verify)
- [ ] Wave 0 covers all MISSING references (lint script, package.json wiring, pre-commit hook)
- [ ] No watch-mode flags (`tsc -w`, `vite` dev) — all gates use one-shot commands
- [ ] Feedback latency < 20s for incremental `npm run build`
- [ ] Adversarial lint tests 1–5 documented in PLAN 03 as a final task
- [ ] `nyquist_compliant: true` set in frontmatter once planner completes task mapping

**Approval:** pending
