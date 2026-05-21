---
phase: 14
slug: customer-details-etsy-helper
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD | TBD | TBD | CUST-01 | — | N/A (UI form, no auth surface) | unit | `npm run test -- --run` | TBD | ⬜ pending |
| TBD | TBD | TBD | CUST-02 | — | N/A (display-only) | unit | `npm run test -- --run` | TBD | ⬜ pending |
| TBD | TBD | TBD | ETSY-01 | — | N/A (static data file) | unit | `npm run test -- --run` | TBD | ⬜ pending |
| TBD | TBD | TBD | ETSY-02 | — | N/A (informational link) | unit | `npm run test -- --run` | TBD | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills the table above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers `.test.ts` (not `.tsx`) scaffolding per vitest config quirk
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills task map

**Approval:** pending
