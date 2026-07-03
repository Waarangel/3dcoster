---
phase: 17
slug: close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed from artifacts (State B, trivial case) by `/gsd:validate-phase 17` —
> Phase 17's declared requirements (PDF-04 + D-01/D-02/D-03) are all satisfied by
> pre-existing global guards in the 8-gate build chain. No Wave 0 work was required;
> no MISSING tests were authored. NYQ-04 closes TECH-DEBT D4 by documenting the
> inheritance of global guards as a permanent artifact.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (jsdom env) + `@vitest/coverage-v8` 4.1.4 |
| **Config file** | `vitest.config.ts` (repo root, existing — v1.1 Phase 10 infrastructure) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npm run build` (runs the 8-gate chain — see below) |
| **Build verification** | 8-gate chain in `package.json:8` — see Wave 0 Requirements |
| **Estimated runtime** | ~3-6 s (quick); ~15-30 s (full build chain) |

The full 8-gate build chain (`package.json:8`) is the canonical verification surface
for this phase. Each gate is an independent automated check; together they enforce
the entire post-build invariant set:

1. `node scripts/lint-no-raw-html.mjs` — raw-HTML safety (Phase 13)
2. `node scripts/assert-no-static-jspdf.mjs` — no static jspdf import in source (Phase 16)
3. `vitest run --coverage` — 269 vitest cases + coverage gate
4. `tsc -b` — TypeScript project-references build (per CLAUDE.md, stricter than `--noEmit`)
5. `vite build` — Rollup chunking + tree-shake + minify
6. `node scripts/assert-bundle-size.mjs` — main chunk ≤ 300 KB gz (Phase 11 PERF gate)
7. `node scripts/assert-no-pdf-preload.mjs` — no `<link rel="modulepreload">` for pdf chunk in `dist/index.html` (Phase 16 PDF-04)
8. **`node scripts/assert-no-static-pdf-import.mjs`** — **the Phase 17 D-02 gate** — no static `import`/`from` of `./pdf-*.js` from any non-pdf chunk in `dist/assets/`

---

## Sampling Rate

- **After every task commit:** Run `tsc -b && npx vitest run` (cheapest fast-fail signal)
- **After every plan wave:** Run `npm run build` (full 8-gate chain)
- **Before `/gsd:verify-work`:** Full 8-gate chain green, including both `assert-no-pdf-preload.mjs` and `assert-no-static-pdf-import.mjs` success lines
- **Max feedback latency:** ~6 s (quick); ~30 s (full)

---

## Per-Task Verification Map

> One row per declared requirement. State B trivial-case reconstruction: every
> requirement is satisfied by an existing global guard already wired into the
> 8-gate build chain. No new test files were authored; `file_exists` reads
> `✅ existing` for every row.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 17-01 | 1 | D-01 | T-17-01 (accept) | manualChunks ordering prevents jspdf from leaking into vendor chunk; `hoistTransitiveImports:false` prevents Rollup from hoisting pdf chunk as a static side-effect import into other chunks | build gate | `npm run build` | ✅ existing | ✅ green |
| 17-01-T2 | 17-01 | 1 | D-02 | T-17-02 (accept) | post-build CI gate scans `dist/assets/*.js` (excluding pdf chunk) for static `import`/`from` of `./pdf-*.js` — exits 1 if any match | build gate | `npm run build` (chains through `node scripts/assert-no-static-pdf-import.mjs`) | ✅ existing | ✅ green |
| 17-01-T3 | 17-01 | 1 | D-03 | — | `PrintQuoteModal.tsx` and `CostCalculator.tsx` compute byte-identical `taxAmount` for same `(sellingPrice, ratePercent)` inputs (both call `calculateTax` from `src/utils/costCalc.ts`) | unit + types | `npm run build` (chains through `vitest run --coverage` covering 269 tests incl. tax-rounding + `tsc -b` enforcing helper return-shape) | ✅ existing | ✅ green |
| 17-01-T1..3 | 17-01 | 1 | PDF-04 | T-17-01 (accept) | dist contract — no static reference to `./pdf-*.js` from any non-pdf chunk; the only allowed reference is the dynamic `import("./pdf-*.js")` in `index-*.js` | build gate (compound) | `npm run build` (chains through `node scripts/assert-no-pdf-preload.mjs` + `node scripts/assert-no-static-pdf-import.mjs`) | ✅ existing | ✅ green |
| 17-02-T1 | 17-02 | 2 | PDF-04 (doc closure) | T-17-04 (mitigate) | REQUIREMENTS.md checkbox `[x]` for PDF-04 reflects the satisfied build-contract; Traceability row reads `Complete` | grep | `grep -c "^- \[x\] \*\*PDF-04\*\*" .planning/REQUIREMENTS.md` returns 1 | ✅ existing | ✅ green |
| 17-02-T2 | 17-02 | 2 | PDF-04 (doc closure) | T-17-04 (mitigate) | ROADMAP.md Phase 16 row reads `12/12 \| Complete    \| 2026-05-23` with exact column-spacing convention | grep | `grep -c "12/12 \| Complete    \| 2026-05-23" .planning/ROADMAP.md` returns ≥1 | ✅ existing | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing 8-gate build chain (`package.json:8`) + `scripts/assert-no-static-pdf-import.mjs` cover all Phase 17 requirements.

The Phase 17 D-02 gate (`scripts/assert-no-static-pdf-import.mjs`) was added DURING Phase 17 as the closure mechanism for PDF-04 (per Plan 17-01 Task 2). It is now a permanent member of the global 8-gate build chain — every subsequent phase's `npm run build` invocation benefits from this gate transparently. There is no separate Wave 0 work to author tests for PDF-04 / D-01 / D-02 / D-03: each requirement is verified by the build chain that any future phase will already run.

This validation contract therefore documents inheritance of global guards as a permanent artifact (Phase 24 D-03; closes TECH-DEBT D4).

---

## Manual-Only Verifications

None — all phase behaviors have automated verification.

The build-output contract (no static import of `./pdf-*.js` from any non-pdf chunk; modulepreload absent for pdf chunk; main chunk under 300 KB gz; tax math byte-identical between surfaces) is verifiable entirely by file/grep checks against the built `dist/` directory and the source tree. No browser network-tab observation or visual UAT is required to confirm the phase contract — the static analysis of the built bundle IS the runtime guarantee. The CI gate prevents regressions of this class going forward.

The audit-driven origin symptom ("PDF lazy-load defeated for marketing-page visitors" — pdf chunk fetched eagerly) is the runtime behavior that follows from the bundle-shape contract; verifying the contract verifies the symptom is gone. See `17-VERIFICATION.md` truth #1, behavioral spot-checks rows 4-7.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify command — all 6 Per-Task Map rows route to `npm run build` or grep
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — all tasks have automated verify
- [x] Wave 0 covers all MISSING references — N/A (no MISSING gaps; auditor returned GAPS FILLED with empty list)
- [x] No watch-mode flags (`vitest run` / `npm run build`, not `vitest` / dev-mode)
- [x] Feedback latency < 30 s (full build chain) / < 6 s (quick `tsc -b && vitest run`)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Phase 17 VERIFICATION.md status `passed` (score 10/10) confirms the build chain is green and the contract holds in the shipped state

**Approval:** approved 2026-05-25

---

## Validation Audit 2026-05-25

State B reconstruction (no prior `17-VALIDATION.md` existed). Audit run by `/gsd:validate-phase 17` per Phase 24 Plan 24-04 (NYQ-04).

| Metric | Count |
|--------|-------|
| Requirements scanned | 4 (PDF-04, D-01, D-02, D-03) |
| Plans scanned | 2 (`17-01-PLAN.md`, `17-02-PLAN.md`) |
| Summaries scanned | 2 (`17-01-SUMMARY.md`, `17-02-SUMMARY.md`) |
| Gaps found | 0 |
| Resolved | 0 (no gaps to resolve) |
| Escalated | 0 |
| New test files created | 0 |
| Inherited global guards | 2 (`scripts/assert-no-static-pdf-import.mjs` + the 8-gate build chain in `package.json:8`) |

**Audit outcome:** The phase's 4 declared requirements (PDF-04 + D-01/D-02/D-03) are each satisfied by a pre-existing global guard already wired into `npm run build`. The auditor's gap analysis returned zero MISSING tests. The workflow proceeded directly to step 6 to write this file with `nyquist_compliant: true`, `status: passed`, `wave_0_complete: true`.

**Reference shape:** `13-VALIDATION.md` (Per-Task Map row format, Test Infrastructure table convention). This file is the minimum-viable State B output specified in 24-RESEARCH.md §1 ("Minimum-Viable VALIDATION.md (the Phase 17 case)").

**Inheritance documented:** This file is the permanent artifact recording that Phase 17's requirements are covered by global guards. Future phases that touch the PDF-04 surface (lazy-load contract, manualChunks ordering, tax-rounding parity) will continue to be validated by the same 8-gate build chain; this contract makes that inheritance explicit and auditable.
