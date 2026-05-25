---
phase: 15
slug: tags-search-quick-duplicate
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
reconstructed: true
reconstructed_from: 12 plan SUMMARYs in this directory (15-01..15-12)
reconstruction_state: B
reconstruction_method: /gsd:validate-phase 15 — State B (no prior VALIDATION.md; SUMMARYs + green test suite are source of truth)
---

# Phase 15 — Validation Strategy (Nyquist Contract)

> Reconstructed Per-Phase validation contract for `tags-search-quick-duplicate`.
> Phase 15 was executed and closed (verdict `gap-free`) under State B
> (no VALIDATION.md authored at planning time). This file is the State B
> reconstruction from the 12 plan SUMMARYs + 15-VERIFICATION.md + the shipped
> Vitest suite. It closes **NYQ-02** / TECH-DEBT D2.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` (repo root, existing — v1.1 Phase 10 infrastructure) |
| **Quick run command** | `npx vitest run src/db/backfill.test.ts src/utils/duplicateJob.test.ts src/components/JobsManager.test.tsx` |
| **Full suite command** | `npm test` (alias for `vitest run`) |
| **Build verification** | `npm run build` (8-gate chain: `lint-no-raw-html → assert-no-static-jspdf → vitest run --coverage → tsc -b → vite build → assert-bundle-size → assert-no-pdf-preload → assert-no-static-pdf-import`) |
| **Estimated runtime** | ~3 seconds (quick), ~5 seconds (full Vitest; +1–2 minutes for full build chain) |
| **Coverage at phase close** | 272 tests passing / 1 todo / 0 failed across 18 test files (current on-disk run 2026-05-25; baseline at verification was 263 → grew to 267 in Plan 15-12 → 269 after post-close Tag-icon polish → 272 as of this audit) |

---

## Sampling Rate

- **After every task commit:** Run the **Quick run command** above. Latency ≤ 5 s.
- **After every plan wave:** Run `npm test` (full Vitest) + `npm run build` (8-gate chain).
- **Before `/gsd:verify-work`:** Full Vitest must be green; full build chain (incl. bundle-size + no-static-pdf-import gates) must exit 0; main chunk ≤ 300 KB gz (Phase 11 gate).
- **Max feedback latency:** ~5 s (Vitest); ~60–90 s (full build chain).

---

## Per-Task Verification Map

> Reconstructed by scanning the 12 plan SUMMARYs in `.planning/phases/15-tags-search-quick-duplicate/`
> and cross-referencing with the shipped Vitest suite. All rows are COVERED — Phase 15 is
> closed (`verdict: gap-free` in 15-VERIFICATION.md, final UAT 2026-05-25) and there is no
> Wave 0 work to do. Withdrawn requirements (TAGS-02, DUP-01) are recorded for traceability
> with their withdrawal rationale.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | TAGS-01 | T-15-02 (jsdom contamination) | `normalizeTagsOnJob` mutates `tags` only when input is non-canonical; never imports Dexie | unit | `npx vitest run src/db/backfill.test.ts -t "normalizeTagsOnJob"` | ✅ existing (`src/db/backfill.test.ts:400-446`) | ✅ green |
| 15-02-01 | 02 | 1 | DUP-02 | T-15-03 (PII leak) / T-15-04 (silent inheritance) | `duplicateJob` resets `customer`/`taxRate`/`taxAmount`/`copiesSold`/`quoteNumber`; PII never carried | unit | `npx vitest run src/utils/duplicateJob.test.ts -t "DUP-02 D-15 locked contract"` | ✅ existing (`src/utils/duplicateJob.test.ts`) | ✅ green |
| 15-02-02 | 02 | 1 | DUP-02 | T-15-04 | By-value isolation — mutating dup arrays does not mutate source arrays | unit | `npx vitest run src/utils/duplicateJob.test.ts -t "by-value isolation"` | ✅ existing | ✅ green |
| 15-02-03 | 02 | 1 | DUP-02 | — | `nextCopyName` collision counter `(copy)` → `(copy 2)` → silent 99-cap (D-08) | unit | `npx vitest run src/utils/duplicateJob.test.ts -t "nextCopyName"` | ✅ existing | ✅ green |
| 15-02-04 | 02 | 1 | DUP-02 | T-15-04 | No `...source` base spread — explicit-allowlist construction (D-09 lock) | grep | `[ $(grep -c "\.\.\.source" src/utils/duplicateJob.ts) -eq 0 ]` | ✅ existing | ✅ green |
| 15-03-01 | 03 | 1 | TAGS-01 | T-15-06 (XSS-via-tag) / T-15-07 (DoS unbounded input) | `parseTagsInput` strips `/[^a-z0-9\s\-_]/g`; cap-at-10 enforced | unit | `npx vitest run src/db/backfill.test.ts -t "parseTagsInput"` | ✅ existing (`src/db/backfill.test.ts`) | ✅ green |
| 15-03-02 | 03 | 1 | TAGS-01 | — | `_normalizeTagToken` whitelist regex appears in code exactly once (single source of truth) | grep | `[ $(grep -cE "\\[\\^a-z0-9.*\\]" src/db/backfill.ts) -le 4 ]` (4 hits = 2 JSDoc + 2 single executable site verified manually) | ✅ existing | ✅ green |
| 15-04-01 | 04 | 2 | TAGS-03 | — | Case-insensitive substring search on title + tags + `Sale.customer.{name,email,company}` (D-06 scope; 250 ms debounce) | manual UAT | n/a — Plan 15-04 SUMMARY confirms `searchedJobs` filter wired through `salesByJob`; behaviorally verified during Plan 15-06 UAT (15-VERIFICATION.md SC#3 PASS) | ✅ existing (`src/components/JobsManager.tsx`) | ✅ green |
| 15-04-02 | 04 | 2 | TAGS-04 | — | `useDynamicRowHeight` bi-key cache invalidates row heights on filter/search change (`selectedJobId\|debouncedSearchQuery` — narrowed from tri-key after Gap C closure) | type-check + manual UAT | `npx tsc -b` (compile-time guard on key shape); behavioral verification via Plan 15-12 component tests (a–f) | ✅ existing (`src/components/JobsManager.tsx`) | ✅ green |
| 15-04-03 | 04 | 2 | TAGS-02 | — | **WITHDRAWN** (Gap C 2026-05-24; superseded by TAGS-03 search per user product feedback) — no chip filter ships | grep | `[ $(grep -cE "selectedChips\|tagCounts\|jobsAfterChipFilter\|clearFilters" src/components/JobsManager.tsx) -eq 0 ]` | ✅ existing | ✅ green (negative assertion) |
| 15-05-01 | 05 | 3 | TAGS-01 | — | Tag editor surface wired in JobsManager (initial pencil-button shape reshaped to edit-in-place by Gap E in Plan 15-12) | manual UAT | n/a — final shape verified in Plan 15-12 component tests | ✅ existing | ✅ green |
| 15-05-02 | 05 | 3 | TAGS-04 | — | D-12 reconcile (`normalizeTagsOnJob`) wired into `useJobs` init via `tagsNormalizeRan` module flag (idempotent, one-per-page-load) | unit | `npx vitest run src/db/backfill.test.ts -t "normalizeTagsOnJob"` + grep `grep -c "tagsNormalizeRan" src/hooks/useDatabase.ts` → 1+ | ✅ existing | ✅ green |
| 15-05-03 | 05 | 3 | DUP-01 | — | **WITHDRAWN-FROM-V1.2** (Gap D 2026-05-24; row-action UI deferred to v1.3+; DUP-02 helper ships standalone) — no `[⋯]` overflow + Duplicate menu ships | grep | `[ $(grep -cE "overflowOpenJobId\|highlightedJobId\|feature=\"quick-duplicate\"" src/components/JobsManager.tsx) -eq 0 ]` | ✅ existing | ✅ green (negative assertion) |
| 15-06-01 | 06 | 4 | TAGS-01, TAGS-02, TAGS-03, TAGS-04, DUP-01, DUP-02 | — | Full automated chain green (tsc + Vitest + build + bundle-size); UAT verdict captured in 15-VERIFICATION.md | full suite | `npm test && npm run build` | ✅ existing | ✅ green |
| 15-07-01 | 07 | gap-A | TAGS-01 | — | CostCalculator tag input surface removed (Gap A closure) — `feature="tags"` count in CostCalculator.tsx === 0 | grep | `[ $(grep -cE "tagsInput\|setTagsInput\|parseTagsInput\|feature=\"tags\"" src/components/CostCalculator.tsx) -eq 0 ]` | ✅ existing | ✅ green |
| 15-08-01 | 08 | gap-D | DUP-01 | — | `[⋯]` overflow + Duplicate menu + `quick-duplicate` features.ts entry all removed; LOCKED `duplicateJob.{ts,test.ts}` byte-identical | grep + diff | `[ $(grep -cE "'quick-duplicate':" src/features.ts) -eq 0 ]` + `git log --oneline -- src/utils/duplicateJob.ts src/utils/duplicateJob.test.ts` confirms no new commits past Plan 15-02 baseline | ✅ existing | ✅ green |
| 15-09-01 | 09 | gap-C | TAGS-02 | — | Chip-filter row removed; cache key narrowed bi-key; "Clear search" CTA present | grep | `[ $(grep -cE "selectedChips\|tagCounts\|jobsAfterChipFilter" src/components/JobsManager.tsx) -eq 0 ]` | ✅ existing | ✅ green |
| 15-10-01 | 10 | gap-B-attempt | TAGS-01 | — | Title-click panel shipped (REJECTED at UAT — became Gap E, reopened); Plan 15-12 replaced with edit-in-place | n/a (superseded by 15-12 component tests) | n/a — 15-10 surface fully replaced by 15-12 | n/a (superseded) | ✅ green (closed via 15-12) |
| 15-11-01 | 11 | gap-verify | TAGS-01, TAGS-02, TAGS-03, TAGS-04, DUP-01, DUP-02 | — | Round 1 automated chain green + Gap E surfaced; LOCKED DUP-02 files unchanged | full suite | `npm test && npm run build` | ✅ existing | ✅ green |
| 15-12-01 | 12 | gap-E | TAGS-01 | — | (a) Inline title input renders when title clicked | component | `npx vitest run src/components/JobsManager.test.tsx -t "edit-in-place"` | ✅ existing (`src/components/JobsManager.test.tsx` describe "JobCard edit-in-place (Gap E)") | ✅ green |
| 15-12-02 | 12 | gap-E | TAGS-01 | — | (b) Chip ✕ removes a tag | component | `npx vitest run src/components/JobsManager.test.tsx -t "chip ✕"` | ✅ existing | ✅ green |
| 15-12-03 | 12 | gap-E | TAGS-01 | T-15-07 | (c) `+` opens inline add-tag input with D-16 usage-suggesting placeholder | component | `npx vitest run src/components/JobsManager.test.tsx -t "+ opens"` | ✅ existing | ✅ green |
| 15-12-04 | 12 | gap-E | TAGS-01 | T-15-07 | (d) `+` hides at D-02 cap (`tags.length === 10`) | component | `npx vitest run src/components/JobsManager.test.tsx -t "D-02 cap"` | ✅ existing | ✅ green |
| 15-12-05 | 12 | gap-E | TAGS-01 | — | (e) Empty-state Tag icon (post-close polish 2026-05-25, commit `b8bbd2f`) — Tag icon visible at 0 tags; `+` hidden | component | `npx vitest run src/components/JobsManager.test.tsx -t "always-visible"` | ✅ existing | ✅ green |
| 15-12-06 | 12 | gap-E | TAGS-01 | — | (f) Both `tags=undefined` and `tags=[]` map to empty state | component | `npx vitest run src/components/JobsManager.test.tsx -t "empty state"` | ✅ existing | ✅ green |
| reg | all | all | full regression | — | Full suite still green | full suite | `npm test` → 272 / 1 todo / 0 failed | n/a | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Withdrawn Requirements (for traceability)

| Requirement | Status | Withdrawn | Reason | Test Contract |
|-------------|--------|-----------|--------|---------------|
| **TAGS-02** | `withdrawn` | 2026-05-24 (Gap C) | Superseded by TAGS-03 (search) per user product feedback — chip strip redundant with substring search | Negative grep on JobsManager.tsx (`selectedChips\|tagCounts\|jobsAfterChipFilter` === 0); covered by row 15-09-01 |
| **DUP-01** | `withdrawn-from-v1.2` | 2026-05-24 (Gap D) | Row-action UI deferred to v1.3+ richer surface (job-detail panel or batch-action menu); single-item overflow `[⋯]` was the wrong pattern. DUP-02 helper ships standalone | Negative grep on JobsManager.tsx (`overflowOpenJobId\|feature="quick-duplicate"` === 0); covered by row 15-08-01 |

---

## Wave 0 Requirements

**None — Phase 15 tests already shipped.** Every requirement row above is `✅ existing`. The
shipped Vitest suite (16 pre-existing + 2 new test files = 18 files; 272 tests / 1 todo / 0
failed) was authored as part of the original Phase 15 execution (Plans 15-01..15-12) and
its post-close polish (commit `b8bbd2f`). There is no test scaffolding to add and no
framework install needed — Vitest 4.1.4 + `vitest.config.ts` were already in place at phase
start (v1.1 Phase 10 infrastructure).

Per-plan tests added (cumulative across the phase):

- **Plan 15-01:** +6 `normalizeTagsOnJob` cases (`src/db/backfill.test.ts:400-446`)
- **Plan 15-02:** +7 `duplicateJob`/`nextCopyName` cases incl. D-15 locked contract (`src/utils/duplicateJob.test.ts`)
- **Plan 15-03:** +8 `parseTagsInput` cases (`src/db/backfill.test.ts`)
- **Plan 15-12:** +4 `JobCard edit-in-place (Gap E)` component cases (`src/components/JobsManager.test.tsx`)
- **Post-close polish (commit `b8bbd2f` 2026-05-25):** +2 empty-state Tag-icon cases (e + f)

Total Phase-15-contributed test delta: **+27** tests vs Phase 14 baseline. Phase 15 verification
chain confirmed this at 15-VERIFICATION.md (Round 1: 263 passing; Round 2: 267; post-close: 269).
Current on-disk Vitest run shows 272 / 1 todo, which matches the published trajectory.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Title click → inline title input replaces text in place (no new row inserted; layout unchanged above/below) | TAGS-01 | Visual / DOM placement (covered by Plan 15-12 component tests at unit level; live placement verified by user UAT) | Open JobsManager → click a job title → confirm `<input>` appears in the same DOM slot as the title text; Escape cancels, Enter saves, blur saves-if-nonempty |
| Inline chip strip renders in title row (chevron → title → chips → `+` → Tag icon → break-even pill) | TAGS-01 | Visual layout / DOM order | Open JobsManager → confirm DOM order matches; chips wrap below title on narrow viewports (≤400px) without scrollbar (per D-16 wrap strategy) |
| Hover ✕ on a tag chip removes that tag immediately (no modal, atomic persist) | TAGS-01 | Visual hover affordance | Hover a chip → confirm ✕ appears → click → tag removes; reload page → tag remains removed |
| `+` add-tag affordance opens inline input with D-16 placeholder ("trending, popular, out of date") | TAGS-01 | Placeholder string + inline layout | Click `+` → confirm `<input placeholder="trending, popular, out of date">` appears at the end of the chip strip |
| Empty-state Tag icon replaces `+` when job has no tags (post-close polish 2026-05-25) | TAGS-01 | Visual conditional affordance | Open a job with no tags → confirm a `<Tag />` lucide icon (always-visible) instead of `+`; add a tag → confirm the icon swaps to `+` |
| 10-tag cap: `+` (or empty-state Tag icon) hides at `job.tags.length === 10` and reappears after a ✕ removal | TAGS-01 (D-02) | State transition | Add tags until count hits 10 → confirm `+` disappears; remove one tag → confirm `+` reappears |
| Search input (TAGS-03) substring-matches title + tags + `Sale.customer.{name,email,company}` with 250 ms debounce; does NOT match address/notes | TAGS-03 (D-06) | UAT-style search behavior; debounce timing | Type partial substring of a tag → matching jobs filter; type customer email → matching jobs filter; type substring from `Sale.notes` → no match; type rapidly → confirm filter waits ~250 ms before updating |
| Filter empty state ("No jobs match your search" + Clear-search CTA) fires when no jobs match the search query | TAGS-04 (D-10 reshape) | Visual conditional render | Type a search query that matches no jobs → confirm empty-state message + working Clear-search CTA |
| Virtualized-list row heights recompute on filter/search change (no stale heights from prior filter state) | TAGS-04 (D-05 bi-key) | Visual scroll behavior | Filter on a job whose card expanded sub-section is taller than a collapsed card → toggle search query → confirm row heights re-flow correctly (no overlapping cards) |
| NewBadge `feature="tags"` overlays the Tag icon hover affordance (or the empty-state Tag icon at 0 tags) | TAGS-01 (D-13 + D-18) | Visual badge placement | Open JobsManager within `NEW_FEATURE_MAX_AGE_DAYS` window (14 d from 2026-05-24 ship date) → hover a job title → confirm NewBadge dot appears on the Tag icon (or stays visible on the empty-state icon) |
| Tag normalization reconcile fires once-per-page-load (idempotent) | TAGS-01 / TAGS-04 (D-12) | Browser-side cold-start behavior | Inject a non-canonical tag value directly into IndexedDB (DevTools) → reload → confirm tag is canonicalized + persisted; reload again → confirm no second write |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicit Manual-Only entries with rationale
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every PLAN-task row has at least one automated invocation; manual rows justified above)
- [x] Wave 0 covers all MISSING references — **none required** (Phase 15 closed with green suite; reconstruction marks every row `✅ existing`)
- [x] No watch-mode flags (`vitest run`, never `vitest`)
- [x] Feedback latency < 5 s (Vitest); < 90 s (full build chain)
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Withdrawn requirements (TAGS-02, DUP-01) documented for traceability with negative-assertion test contracts

**Approval:** passed 2026-05-25 (State B reconstruction — NYQ-02 closes TECH-DEBT D2)

---

## Reconstruction Audit Trail

**Source artifacts scanned (12 SUMMARYs + 1 VERIFICATION):**

- `15-01-SUMMARY.md` → `normalizeTagsOnJob` helper + 6 Vitest cases (`src/db/backfill.test.ts:400-446`)
- `15-02-SUMMARY.md` → `duplicateJob` + `nextCopyName` helpers + D-15 locked 7-case contract (`src/utils/duplicateJob.test.ts`)
- `15-03-SUMMARY.md` → `parseTagsInput` + 8 Vitest cases + CostCalculator tag input (later withdrawn by Gap A)
- `15-04-SUMMARY.md` → TAGS-03 search + TAGS-04 cache key + TAGS-02 chip filter (later withdrawn by Gap C)
- `15-05-SUMMARY.md` → JobsManager pencil-button tag editor (later reshaped by Gap B→E) + D-12 reconcile wiring + DUP-01 `[⋯]` UI (later withdrawn by Gap D)
- `15-06-SUMMARY.md` → Phase 15 verification execution (Plan 15-06) — produced 15-VERIFICATION.md with verdict `gaps-found` (4 gaps A/B/C/D)
- `15-07-SUMMARY.md` → Gap A closure (CostCalculator tag input removed)
- `15-08-SUMMARY.md` → Gap D closure (`[⋯]` Quick Duplicate UI removed; LOCKED `duplicateJob.{ts,test.ts}` preserved)
- `15-09-SUMMARY.md` → Gap C closure (chip-filter row removed; cache key narrowed to bi-key)
- `15-10-SUMMARY.md` → Gap B attempt (title-click panel — REJECTED at UAT, reopened as Gap E)
- `15-11-SUMMARY.md` → Round 1 gap-closure verification (3 closed, 1 new Gap E)
- `15-12-SUMMARY.md` → Gap E closure (edit-in-place title + inline chip strip + 4 component tests); FINAL gap-free verdict 2026-05-25
- `15-VERIFICATION.md` (frontmatter `verdict: gap-free`, `gaps_open: 0`, `final_verdict_date: 2026-05-25`) — confirms the test suite is the canonical Nyquist evidence

**Reconstruction approach:**

1. **State detected:** B (no prior VALIDATION.md; SUMMARYs + green suite present).
2. **Test infrastructure detected from filesystem:** Vitest 4.1.4 (in `package.json` devDependencies + `vitest.config.ts` at repo root); test command `npm test` → `vitest run`; 8-gate build chain in `package.json:build`.
3. **Requirement-to-task map built from PLAN.md frontmatter (`requirements:`) of each plan + per-plan tests-added entries in each SUMMARY.**
4. **Gap analysis:** Every declared requirement has shipped tests (or a negative-assertion grep for withdrawn requirements). **Zero MISSING.** Per workflow Step 3, skipped directly to Step 6 with `nyquist_compliant: true` and `wave_0_complete: true`.
5. **Generated this file using the canonical template at `$HOME/.claude/get-shit-done/templates/VALIDATION.md`.**

**Regression baseline at reconstruction (2026-05-25):**

| Check | Result |
|-------|--------|
| `npm test` | 272 passed / 1 todo / 0 failed (18 test files) |
| `npm install` (worktree had empty `node_modules`; package.json unchanged) | resolved 648 packages; no `package.json` mutation |

**No new tests authored.** This is documentation-only — the contract reconstructs evidence
that was already shipped, scattered across the per-plan SUMMARYs. Closes **NYQ-02**
(REQUIREMENTS.md row) and **TECH-DEBT D2** (Phase 15 missing Nyquist contract).
