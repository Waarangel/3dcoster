# 3DCoster Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.3 — Hardening

**Shipped:** 2026-05-28
**Phases:** 10 (18, 19, 20, 21, 22, 22.1, 23, 24, 25, 26) | **Plans:** 43 | **Sessions:** multiple over 4 days

### What Was Built

- `<Modal>` WAI-ARIA primitive + 10-surface migration with focus trap, scroll-lock, dev-mode single-modal guard, 17 contract tests
- JobsManager decomposition: 2067 → 1474 LOC via `<RecordSaleModal>`, `<SaleRow>`, `useCustomerPicker`, `<SearchIcon>`, `useAllSales`, `breakEvenMap` pre-compute
- Dexie atomicity sweep: `addSale` + `createQuote` + v9 upgrade callback wrapped in `db.transaction('rw',...)` ; defensive trio (`parsePositiveNumber`, async `versionchange`, `getSetting<T>` validator)
- CSV + URL security: `sanitizeCsvCell` at all 4 Papa.unparse boundaries; `isSafeHttpUrl` render-time guard; 5 parser-passthrough regression tests including Unicode + formula-injection
- Test coverage hardening: first Customer-UI test files (CustomerEditModal, CustomerCsvImportModal, CustomerLibrary) using raw `createRoot` + `act` scaffold; real-Dexie migration test via `fake-indexeddb@^6.2.5` locks D-17 G7 contract at the transaction boundary
- Break-even formula reconciliation (Phase 22.1, inserted): JobsManager pill and Calculator widget now compute the same number for the same job; round-trip test locks agreement
- Nyquist contracts backfilled for Phase 13/15/15.1/17 (v1.2 carryover) + Phase 13's 8 deferred visual-contract UAT items closed
- Tauri 2.11.x Rust crate upgrade + `@tauri-apps/api ^2.11.0` re-pin eliminates dual-copy `@tauri-apps/api` from Phase 18
- v1.3 audit cleanup (Phase 26): 8 VALIDATION.md files Nyquist-compliant + REQUIREMENTS.md doc-lag sync + CustomerCsvImportModal layout parity

### What Worked

- **Foundation-first sequencing**: shipping the `<Modal>` primitive in Phase 19 BEFORE the JobsManager decomposition in Phase 22 meant `<RecordSaleModal>` extraction was straightforward — extracting before the primitive existed would have been wasted work.
- **Decimal phase insertion for mid-milestone surprises**: Phase 22.1 (break-even reconciliation) and Phase 26 (audit cleanup) both inserted via `/gsd:phase --insert` rather than expanding existing-phase scope. Kept the audit trail coherent and let each surprise be its own atomic deliverable with its own SUMMARY/VERIFICATION.
- **Wave-based parallel execution**: Phases 22 and 26 each had 4+ plans dispatch as parallel worktrees, completing in 5-10 minutes wall-clock vs. 30+ minutes serial. Files-modified non-overlap check at planning-time made this safe by default.
- **Cleanup-phase-before-tag pattern**: Re-running `/gsd:audit-milestone` to verify `tech_debt → passed` after Phase 26 (rather than shipping with `tech_debt`) caught a subtle "what would the audit say if rerun now?" gap. Worth doing every milestone close.
- **HUMAN-UAT surfaced real product gaps**: Phase 21 UAT exposed that SC#5 referenced an unbuilt feature (customer CSV export) AND surfaced a real UI parity gap (asset vs customer import modal layout). Both were honest findings rather than rubber-stamps.

### What Was Inefficient

- **Executor agent worktree isolation hiccups**: Plan 26-01's executor committed directly to the orchestrator branch instead of its isolated worktree (silent fallback when worktree creation failed). Work was correct but the orchestrator had to manually commit the SUMMARY.md the agent left behind. Same pattern observed in Phase 23-01 earlier in the milestone. Worth a workflow defect investigation if it happens again.
- **Decision-coverage gate textual mismatch**: Phase 26 plans cited all 12 D-XX decisions in `<action>` and `<objective>` blocks but the gate looked for `D-NN:` in `must_haves` specifically. Required a user override that the plan-checker had independently validated. Gate could be more lenient or planner could be instructed to mirror citations into `must_haves.truths`.
- **Auto-generated MILESTONES.md entry was unusable**: `gsd-sdk query milestone.complete` extracted accomplishments from SUMMARY one-liners, but ~40% of v1.3 SUMMARY files had `"One-liner:"` placeholder text instead of a real one-liner. Orchestrator had to manually curate the 10-bullet accomplishments list. Worth fixing at the planner level (require executor to author a real one-liner in SUMMARY.md frontmatter).
- **Stale milestone audit**: The first `/gsd:audit-milestone v1.3` was 1 day old and predated Phase 22/23/24/25 completion — its `gaps_found` verdict was wrong. `/gsd:complete-milestone` flagged it as stale and prompted re-running, which produced the correct `tech_debt` verdict. Audit-on-completion would prevent this.
- **STATE.md "Current focus" pointer lag**: STATE.md's `Current focus` and `Current Position` fields tracked the active phase but didn't auto-advance when a phase was already complete on-disk. Multiple times this milestone the pointer was 1-2 phases behind reality. Cosmetic but confusing.

### Patterns Established

- **Cleanup phase before milestone tag**: When `/gsd:audit-milestone` returns `tech_debt`, insert a cleanup phase to close it before tagging. Cheaper than shipping `tech_debt` and explaining each item in the audit narrative forever.
- **Pointer-VALIDATION.md backfill**: When a phase shipped without authoring its VALIDATION.md upfront, the backfill can be a thin pointer document citing VERIFICATION.md observable truths verbatim — no re-verification work required. Pattern demonstrated by Phase 24 (4 phases backfilled) and Phase 26-02 (4 more).
- **HUMAN-UAT outcomes get recorded as `outcome:` field per test item**: Phase 21 + Phase 25 demonstrated the pattern of adding `outcome: PASS/SKIPPED/FAIL — narrative` to each `human_verification` entry in VERIFICATION.md, alongside the original `why_human` field. Gives a permanent audit trail of "manual test ran, result was X, evidence Y".
- **`👥` emoji for bulk operations on customer entities**: Decided on `👥` (multiple people) over `👤` (single person) or `📇` (rolodex) for Customer template button — fits bulk-import semantic. Recommend: 1 emoji per entity-type per UI surface, consistent across modals.
- **`autonomous: false` only when a *human* must intervene**: Phase 23-03 had `autonomous: false` because the npm package legitimacy gate genuinely required a human (not Claude) to validate the package via npmjs.com + GitHub. Most other plans are `autonomous: true`. Pattern: human-verify gates ≠ "I want a confirmation", they're "the gate can ONLY be cleared by a person".

### Key Lessons

1. **Run `/gsd:audit-milestone` immediately before `/gsd:complete-milestone`**. The audit's verdict is the most reliable signal for "is this milestone ready to ship?" — stale audits mislead. If the audit returns `tech_debt`, insert a cleanup phase rather than ship with debt.
2. **Decimal phase insertion is the right tool when scope creep is real but in-scope**. Phase 22.1 (formula reconciliation discovered mid-UAT) and Phase 26 (audit cleanup) both used `/gsd:phase --insert`. Result: each surprise gets its own SUMMARY/VERIFICATION/audit-trail entry. Resist the urge to bolt onto the existing phase.
3. **Worktree isolation is fragile**. Multiple executor agents this milestone fell back to the orchestrator's working tree when worktree creation failed silently. The orchestrator must spot-check `git worktree list` and recover gracefully. Future improvement: have executors verify worktree creation succeeded as part of their boot sequence.
4. **Test-coverage phases reveal real bugs**. Phase 23's first Customer-UI test files (TEST-01 through TEST-06) found a real divergence between `CustomerEditModal` saving raw email vs `customerCsv.ts` lowercasing the email — same logical customer would have two Library entries. Wouldn't have surfaced without the test files. Lesson: don't defer test coverage indefinitely; the act of writing tests is its own gap-finder.
5. **HUMAN-UAT items should be self-cleaning**. The `21-HUMAN-UAT.md` and `25-HUMAN-UAT.md` files contained tests for already-shipped code; running them this session flipped both verifications from `human_needed` → `passed` in minutes. The 2-day lag between phase ship and UAT close cost very little. Future: maybe `/gsd:execute-phase` auto-prompts for HUMAN-UAT immediately after the agent-verification passes, not at milestone-close time.

### Cost Observations

- Model mix: planner=opus (4 plan files), executor=sonnet (43+ runs), verifier=sonnet (~10 runs), researcher=sonnet (limited use this milestone — most phases skipped research)
- Sessions: ~5 working sessions over 4 days
- Notable: parallel-worktree execution (4 simultaneous sonnet executors per wave) consistently completed 4 plans in 5-10 minutes; serial execution would have been 30-40 minutes. Cost roughly equivalent, wall-clock 4x faster.
- One agent connection drop required `SendMessage` resume (Phase 26 planner) — recovered cleanly without re-running the entire plan generation

---

## Milestone: v1.9 — Hardening

**Shipped:** 2026-07-03 (desktop tag `v1.9.0`, web same day)
**Phases:** 4 (34–37) | **Plans:** 11 | **Requirements:** 14/15 (PERF-11 reverted → v2.0)

*(Note: v1.8 shipped 2026-06-25 without a retrospective section — GSD was revived mid-v1.8; its summary lives in MILESTONES.md.)*

### What Was Built

No new features — the sequel to v1.3 Hardening. Live papercut fixes (PWA Reload, ScrollToTop, styled confirms, edit-job scroll), A11Y Tier 4 (roving tabindex, role=alert, labels, target sizes), perf Tier 5 (subscription lift, O(1) lookups), code health (immutability, validated narrowing). The review/audit/UAT gate then contributed as much as the planned scope: scoped Asset-Library reset (data-loss fix), deleted-defaults persistence, marketplace-fee FX + net-of-fees margin, 19→0 CVEs, Tauri fs scope, 3MF zip-bomb guards.

### What Worked

- **The ~1-week pre-release hold.** Founder-imposed gate (review + UAT before tag) caught: a real pricing regression (PERF-11 desync), a silent data-loss bug (custom-category reset), a ~150× currency error for non-USD sellers, and 19 CVEs — all before any user saw them. The hold is now a validated pattern, not overhead.
- **Multi-lens review beats single-pass.** 4-parallel-reviewer release review + 5-parallel-lens app audit (security/React/cost-logic/data-integrity/a11y) each surfaced findings the other missed.
- **Conversational UAT in the browser** surfaced the data-loss bug no reviewer or test caught — reading code ≠ clicking the app.
- **Delta re-review before tag** — 2 commits landed after the "final" review PASS; a targeted react-reviewer pass kept the gate honest at trivial cost.

### What Was Inefficient

- **Source-string/contract tests gave false confidence.** PERF-11's tests asserted the dep array's *shape*, not pricing *behavior* — the regression sailed through green. Lesson codified: contract tests don't substitute for behavioral tests on money math.
- **Stale service worker repeatedly served old JS during browser verification** (the recurring 4173-preview trap) — cost a debugging detour before being re-diagnosed.
- **Milestone-close hygiene debt:** 11 stale open artifacts from v1.0–v1.3 phases surfaced at close (old UAT/verification flags, one orphaned quick-task) — acknowledged as deferred rather than swept.

### Patterns Established

- Pre-release checklist as a hard sequence: release-diff review (parallel reviewers) → conversational UAT → full app audit → fix Tiers → delta re-review → CHANGELOG date → deploy → tag with explicit approval.
- Founder decisions recorded at audit time (deleted defaults STICK; fees FOLD into net margin) — decisions made once, applied everywhere.
- Revert-and-defer over patch-in-place when a perf change regresses correctness (PERF-11 → v2.0 with the proper refactor).

### Key Lessons

1. Build-green + tests-green ≠ reviewed. The gate exists because it keeps catching what CI can't.
2. Money math changes need output-equivalence proofs (the no-marketplace path was proven byte-identical before the net-margin fold shipped).
3. UAT the empty/custom/reset states — data-loss hides in the paths tests rarely model.

### Cost Observations

- Sessions: ~4 working sessions over 8 days (2026-06-25 → 07-03), incl. the deliberate 1-week hold
- Notable: review/audit agents (4+5 parallel reviewers + 1 delta reviewer) were the highest-value spend of the milestone — they found the only shipped-blocking bugs

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v1.0 | (pre-GSD) | 6 | - | Pre-GSD-archive — built without milestone planning workflow |
| v1.1 | (pre-GSD) | 5 | - | Pre-GSD-archive — built without milestone planning workflow |
| v1.2 | ~10 sessions | 7 | 45 | First milestone fully under GSD workflow. Mid-milestone phase insertion debuted (Phase 15.1 Customer Library, Phase 17 PDF-04 closure). 2 rounds of gap closure on Phase 15. |
| v1.3 | ~5 sessions | 10 | 43 | Decimal phase insertion (Phase 22.1) for in-scope surprises. Cleanup-phase-before-tag pattern (Phase 26). Wave-based parallel worktree execution scaled to 4-6 simultaneous agents per wave. First milestone to close with `passed` verdict (v1.2 closed with `tech_debt`). |
| v1.8 | ~3 sessions | 6 | — | GSD revived after the v1.4–v1.7 ad-hoc lapse. 3-reviewer release-diff review pattern established. (No retrospective section written.) |
| v1.9 | ~4 sessions | 4 | 11 | **1-week pre-release hold** (review + UAT + audit before tag) debuted and validated — caught a pricing regression, a data-loss bug, and 19 CVEs. Revert-and-defer pattern (PERF-11). Delta re-review before tag. |

### Cumulative Quality

| Milestone | Tests | Test Files | Bundle (main, gz) | Audit Verdict |
|-----------|-------|------------|-------------------|---------------|
| v1.0 | (unknown) | (unknown) | (pre-budget) | (pre-GSD) |
| v1.1 | ~200 | ~12 | ~50 KB | (pre-GSD) |
| v1.2 | ~380 | ~26 | 61.5 KB | tech_debt (7 deferred — all rolled into v1.3) |
| v1.3 | 466 (+1 todo) | 31 | 56.5 KB | passed (4 accepted deferrals carried to v1.4) |
| v1.8 | ~730 | ~55 | ~70 KB | (no formal audit — release-diff review only) |
| v1.9 | 819 (+1 todo) | 64 | 72.8 KB | no formal milestone audit — superseded by 2 release reviews + 5-lens app audit + full UAT (0 CRIT/HIGH at ship); 0 npm CVEs |

### Tech Debt Trajectory

- **v1.2 → v1.3 transition**: 7 v1.2 deferred items closed in v1.3 (Phase 13 visual UAT, Nyquist contracts for 13/15/15.1/17, doc-state lag for TAGS-01/04 and CUST-01/02, Customer Library row alignment, Customer CSV template button, jspdf cast, overflow menu close, Rollup circular-chunk). Two carried forward: TAGS-F4 tag colors + DUP-F1 quick-duplicate UI.
- **v1.3 → v1.4 transition**: 4 accepted deferrals — Customer CSV export (Phase 21 SC#5 spec gap), VoiceOver UAT (Phase 19), pre-v1.3 carryover (Phase 04/09 human_needed + Phase 15/17/20 stale CONTEXT questions), 1 pre-existing CostCalculator `it.todo`. All documented in audit; none are blockers.
- Pattern observation: tech debt closure per milestone has roughly matched tech debt generation — net debt is approximately constant despite 110+ plans shipped. Healthy.

### Bundle Health

- v1.2 ended at 61.5 KB gzipped main. v1.3 ends at 56.5 KB despite +13,221 LOC added — Phase 22's JobsManager decomposition and Phase 25's bundle health work netted a ~8% reduction. The 300 KB gz gate set in Phase 11 stays comfortably intact.
- Dexie schema progression: v1.2 ended at v8 (3 migrations within the milestone: v6/v7/v8 for optional fields, customers store, quotes store). v1.3 adds v9 (currency reconcile). Each migration is unit-tested at the helper layer (`backfill.test.ts`) and v1.3 added real-Dexie integration test via fake-indexeddb (`database.migrations.test.ts`).

### Recurring Theme: Wave-based Parallel Execution

v1.3 was the first milestone to make heavy use of wave-based parallel worktree dispatch. Phases 19, 22, 23, 26 each had 4-6 plans dispatched as simultaneous worktree-isolated executors. Observations:

- **Speedup is real** — 4 plans wall-clock in 5-10 min vs 30-40 min serial
- **File-overlap planning is the bottleneck** — the planner must verify `files_modified` arrays don't intersect across plans in the same wave
- **Worktree isolation is fragile** — multiple times this milestone, executors silently fell back to the orchestrator's working tree when worktree creation failed
- **Merge complexity stays low** — non-overlapping `files_modified` means merges are essentially fast-forwards; no conflicts encountered this milestone
- **Worth doing more** in v1.4+ for any phase with 3+ plans
