---
phase: 14
slug: customer-details-etsy-helper
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by gsd-planner after PLAN.md files are produced.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x |
| **Config file** | vitest.config.ts (note: includes only `src/**/*.test.ts` — NOT `.test.tsx`) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && tsc -b && npm run build` |
| **Estimated runtime** | ~60 seconds (test+typecheck+build) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run` (touched-file subset preferred)
- **After every plan wave:** Run `npm run test -- --run && tsc -b`
- **Before `/gsd:verify-work`:** Full suite + production build must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Populated by gsd-planner from PLAN.md `<acceptance_criteria>` blocks. Each task gets one row mapping to a CUST-/ETSY- requirement, the verification command, and whether the test target file exists or needs Wave 0 scaffolding.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01/T1 | 14-01 | 1 | CUST-01, ETSY-01 | — | N/A (UI primitive) | unit | `npm run test -- --run src/components/ui/CollapsibleSection.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 14-01/T2 | 14-01 | 1 | CUST-01, ETSY-01 | — | N/A (type + registry additions) | static | `tsc -b && grep -c "^\s*{" src/features.ts` (= 6) | ✅ | ⬜ pending |
| 14-02/T1 | 14-02 | 2 | ETSY-01, ETSY-02 | — | N/A (static data file) | unit | `npm run test -- --run src/data/etsyToS.test.ts` | ❌ W0 (created by task) | ⬜ pending |
| 14-02/T2 | 14-02 | 2 | ETSY-01, ETSY-02 | — | N/A (CostCalculator Etsy section + 6-site etsyChecks wiring) | build+lint | `tsc -b && npm run build` (covers raw-html lint) | ✅ | ⬜ pending |
| 14-03/T1 | 14-03 | 3 | CUST-01, CUST-02 | — | N/A (Customer card + 6-site customer wiring; clearForm is PII-leak guard) | build+lint | `tsc -b && npm run build && grep -E "setCustomer\\(\\{\\}\\)" src/components/CostCalculator.tsx` | ✅ | ⬜ pending |
| 14-03/T2 | 14-03 | 3 | CUST-02 | — | N/A (JobsManager subline + expanded Customer block) | build | `tsc -b && npm run build` | ✅ | ⬜ pending |
| 14-04/T1 | 14-04 | 4 | CUST-01, CUST-02, ETSY-01, ETSY-02 | — | N/A (static-audit gate: UI-10 grep, Dexie v6 integrity, date sync, lint/test/tsc/build) | static | scripted bash gate (see 14-04 PLAN) | ✅ | ⬜ pending |
| 14-04/T2 | 14-04 | 4 | CUST-01, CUST-02, ETSY-01, ETSY-02 | — | N/A (8-scenario human UAT at port 4173) | manual | `checkpoint:human-verify` (npm run dev → port 4173) | n/a | ⬜ pending |
| 14-04/T3 | 14-04 | 4 | all | — | N/A (write VERIFICATION.md / SUMMARY.md + close REQUIREMENTS+ROADMAP+STATE) | static | `gsd-sdk query state.complete-phase --phase 14` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/ui/CollapsibleSection.test.ts` — render+toggle test, MUST be `.test.ts` (not `.tsx`) per vitest.config.ts include glob
- [ ] `src/data/etsyToS.test.ts` — shape/id-stability test (5 locked ids per D-16)
- [ ] No framework install required — vitest + react-dom/server pattern already in use (see `src/components/ui/EmptyState.test.ts`, `src/components/ui/Skeleton.test.ts`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Both new sections collapsed by default on first render and every reload | ROADMAP success criterion #1, #3 (D-03) | DOM-only check possible but reload-state is more honest as eyeball | `npm run dev` → reload page, confirm Customer + Etsy sections both rendered as collapsed cards after Pricing block |
| Customer name+email visible on JobsManager row subline; truncates without clipping the right-side revenue block | CUST-02 (D-12, D-13) | Visual truncation behavior with narrow viewports is layout-sensitive | Save job with long name+email at 4K and 1280px widths; confirm subline truncates with ellipsis, right block unaffected |
| Etsy disclaimer renders with yellow tint and exact wording | ETSY-02 (D-17) | Visual styling check | Open Etsy section; confirm slate-700 background + yellow border + exact text "Etsy's policies change — this is a reminder, not legal advice." |
| Etsy check state persists across save/load | ETSY-01 (D-18) | Round-trip through IndexedDB | Check 3 of 5 items → Save → reload → reopen job → confirm same 3 items checked |
| UI-10 carry-over: features.ts has exactly Phase 13's 4 entries + Phase 14's 2 entries, all with live JSX consumers | ROADMAP success criterion #5 (D-19, D-20) | grep-driven but auditor judgment confirms no stale entries | `grep -c "id:" src/features.ts` → 6; for each id, `grep -r 'feature="<id>"' src/` → at least 1 hit |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (plan-checker Dim 8 PASS)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task except the 14-04/T2 human checkpoint has an automated command)
- [x] Wave 0 covers `.test.ts` (not `.tsx`) scaffolding per vitest config quirk (14-01/T1 + 14-02/T1 create the test files)
- [x] No watch-mode flags (`--run` flag explicit in every vitest command)
- [x] Feedback latency < 60s (vitest+tsc+build ≈ 60s on 3DCoster)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-21 by gsd-plan-checker (VERIFICATION PASSED)
