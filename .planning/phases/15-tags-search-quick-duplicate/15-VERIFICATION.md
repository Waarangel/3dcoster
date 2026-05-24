---
phase: 15-tags-search-quick-duplicate
type: verification
verified: 2026-05-24
verdict: gaps-found
requirements_evaluated: [TAGS-01, TAGS-02, TAGS-03, TAGS-04, DUP-01, DUP-02]
withdrawn_requirements: [TAGS-02, DUP-01]
gaps_open: 1
gaps_closed: [A, C, D]
gap_closure_round: 1
amended: 2026-05-24
---

# Phase 15 Verification — Tags, Search + Quick Duplicate

**Verdict:** `gaps-found` (4 gaps — A, B, C, D)
**Verified:** 2026-05-24 (amended same day to add Gap D)
**Plan:** 15-06 (Wave 4 — checkpoint:human-verify)

This is the audit trail for the Phase 15 UAT. Verdict is `gaps-found`. Phase 15 remains
OPEN until the gap-closure round lands; the next command is `/gsd:plan-phase 15 --gaps`
(which reads this file). Do NOT run `/gsd:complete-milestone v1.2` yet.

---

## Automated Chain

Task 1 of Plan 15-06 ran the full automated verification chain on commit `c464538`. All four steps green.

| Step | Command | Result | Notes |
|------|---------|--------|-------|
| TypeScript | `npx tsc -b` | exit 0, 0 errors | log: `/tmp/15-verify-tsc.log` |
| Vitest | `npm test -- --run` | **263 passed / 1 todo / 0 failed** across 18 test files | log: `/tmp/15-verify-vitest.log` |
| Build | `npm run build` | clean (`✓ built in 2.29s`); all 5 build-time assertion scripts passed | log: `/tmp/15-verify-build.log` |
| Bundle gate | main chunk gz | **62.0 KB** (`dist/assets/index-DYo3ekog.js`) — Phase 11 gate is 300 KB → **~238 KB headroom** | log: `/tmp/15-verify-bundle.log` |

**Test-count delta vs Phase 14 baseline:** **+21 tests** (Plan 15-01 +6 normalizeTagsOnJob cases, Plan 15-02 +7 duplicateJob cases including D-15 locked contract, Plan 15-03 +8 parseTagsInput cases). Meets the acceptance threshold (≥ 19).

**Coverage on `src/utils/costCalc.ts` (sampled):** 97.82% stmts / 100% funcs / 100% lines.

**Conclusion of automated chain:** The shipped code is structurally correct and all locked contracts (D-15 in particular) pass. The gaps below are **product-design gaps surfaced during human UAT**, not implementation defects.

---

## Per Success Criterion (5)

One row per ROADMAP Phase 15 Success Criterion (SC#1..5).

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| **SC#1** | TAGS-01 — tag input lifecycle (lowercase, trim, dedupe, emoji strip, cap-at-10, empty→undefined) | **PARTIAL** | Normalization rules verified by Vitest (Plan 15-01: 6 cases on normalizeTagsOnJob; Plan 15-03: 8 cases on parseTagsInput). The **tag-input surface on CostCalculator** is being WITHDRAWN per Gap A (user product feedback: tags are not entered during costing). The **tag-input surface on JobsManager** needs UX rework per Gap B (move from pencil-button to title-click inline panel + hover tag icon). After gap closure, SC#1 will be rescoped to "JobsManager-only tag input lifecycle". |
| **SC#2** | TAGS-02 — multi-select chip filter with AND logic across tags-in-use | **WITHDRAWN** | Superseded per Gap C. User product feedback: the chip-filter strip is redundant with the search bar (TAGS-03), which already substring-matches tag names. ROADMAP SC#2 will be marked withdrawn; REQUIREMENTS.md will mark TAGS-02 as `withdrawn` with reason "superseded by TAGS-03 search per user product feedback 2026-05-24". |
| **SC#3** | TAGS-03 — case-insensitive substring search across title + customer + tags (250 ms debounce) | **PASS** | Automated chain green; user product feedback explicitly affirms the search input is the canonical filter mechanism. D-06 search scope (title + tag + Sale.customer.{name,email,company}; NOT address/notes) holds. |
| **SC#4** | TAGS-04 — virtualized-list cache invalidation on filter/search change (no stale row heights) | **PASS PENDING UAT** | Automated chain green (tsc + Vitest exercise the pure helpers; the cache key is unit-coverage-free but type-checked). Live browser behavior NOT exercised — Task 2 paused at gap discovery before this could be visually validated. After Gap C lands, the D-05 cache key narrows from pipe-delimited tri-key (`selectedJobId\|selectedChipsKey\|debouncedSearchQuery`) to pipe-delimited bi-key (`selectedJobId\|debouncedSearchQuery`); re-verify in the gap-closure UAT pass. |
| **SC#5** | DUP-01 + DUP-02 — Quick Duplicate from `[⋯]` row action + PII reset locked test contract | **SPLIT — DUP-02 PASS / DUP-01 WITHDRAWN** | Vitest D-15 contract passes (Plan 15-02: 7 cases — `duplicateJob(job).customer === undefined`, `taxRate === undefined`, `copiesSold === 0`, `id !== source.id`, `tags` preserved). The **helper (DUP-02) ships as-is**. The **row-action UI (DUP-01) is being WITHDRAWN** per Gap D (user product feedback: the `[⋯]` overflow pattern is wrong for a single-item menu; the row already carries Record Sale / Create Quote / Edit / Delete and gains nothing from a hidden affordance). The clone-and-tweak workflow is deferred to v1.3+ where a richer job-detail surface can host it. ROADMAP SC#5 will be rescoped to **"helper-only"** (no row-action UI requirement). |

---

## Per Decision (D-01..D-15)

One row per locked decision from `15-CONTEXT.md`.

| # | Decision (short) | Status | Notes |
|---|------------------|--------|-------|
| **D-01** | Tag input on BOTH CostCalculator save form AND JobsManager inline editor | **WITHDRAWN / RESHAPED** | Gap A removes the CostCalculator surface entirely. Gap B reshapes the JobsManager surface from a pencil-button to a title-click inline panel + hover tag-icon shortcut. Post-gap-closure D-01 should describe a **single JobsManager surface only**, accessible via two affordances (title click + hover icon) that open the same inline panel containing both title-rename and tag editor. |
| **D-02** | Tag normalization rules (split/trim/lowercase/dedupe/cap-at-10/strip-non-[a-z0-9_\- ]) | **PASS** | Confirmed by Vitest (Plan 15-01 + Plan 15-03). `normalizeTagsOnJob` and `parseTagsInput` share the same `_normalizeTagToken` helper; whitelist regex `/[^a-z0-9\s\-_]/g` appears exactly once in `src/db/backfill.ts:55`. |
| **D-03** | Sticky sub-header layout — search input on top, chip row below | **PARTIAL** | Search-bar layout PASS. Chip row WITHDRAWN per Gap C. Post-gap-closure D-03 collapses to "search-input-only sticky sub-header". |
| **D-04** | AND combination across chip selections | **WITHDRAWN** | No chip strip → no combination semantics. Removed alongside D-03 chip row and TAGS-02. |
| **D-05** | `useDynamicRowHeight` cache key = `selectedJobId\|selectedChipsKey\|debouncedSearchQuery` (pipe-delimited tri-key) | **RESHAPED** | Gap C removes the `selectedChipsKey` segment. Cache key narrows to `selectedJobId\|debouncedSearchQuery` after gap closure. Contract remains valid (pipe-delimited, collision-proof); just one fewer segment. |
| **D-06** | Search scope: name + tags + Sale.customer.{name,email,company}; NOT address/notes | **PASS** | Confirmed canonical by user feedback #4. Already passing in shipped code (Plan 15-04 wires it through `salesByJob`). |
| **D-07** | `[⋯]` overflow menu UX (single-item Duplicate; no modal; toast/highlight) | **WITHDRAWN** | Per Gap D: a single-item overflow menu is the wrong pattern. The pattern was carried forward from Phase 16 ext2 D-29 (Pending Quote rows with 3+ hidden actions) where overflow earns its keep; on JobsManager rows with one action it becomes a labelless mystery button. The entire `[⋯]` trigger + menu + click-outside handler is being REMOVED. |
| **D-08** | Collision counter `(copy)` → `(copy 2)` → `(copy 99)` then silent cap | **PASS** | Vitest (Plan 15-02 — `nextCopyName` covered for the empty-list case, the `(copy)` collision case, and the `(copy 2)` collision case). |
| **D-09** | DUP-02 explicit-allowlist — `customer`/`taxRate`/`taxAmount`/`copiesSold`/`quoteNumber` reset | **PASS** | Vitest (Plan 15-02 + D-15 locked contract). |
| **D-10** | Filter empty state (`No jobs match your filter` + Clear-filters link, with filter UI staying visible) | **RESHAPED** | Empty state still fires for search misses; the "Clear filters" link becomes "Clear search" — or is removed if the search input grows an inline clear button. Gap-closure planning decides which. |
| **D-11** | Chip rendering on JobCard summary line (mirrors AssetLibrary.tsx:192-198 styling exactly) | **PASS PENDING UAT** | Shipped in Plan 15-05; byte-identical chip class string per Plan 15-05 SUMMARY decisions. Re-verify visual parity with AssetLibrary in gap-closure UAT. |
| **D-12** | Tag normalization reconcile (idempotent, one-per-page-load) wired into `useJobs` init | **PASS** | Wired in Plan 15-05 via `tagsNormalizeRan` module flag mirroring `copiesSoldReconcileRan`; will fire on next page load. UI-side correctness unverified live but contract is locked + Vitest-covered. |
| **D-13** | NewBadge wiring (`tags` + `search-jobs` + `quick-duplicate`) | **RESHAPED** | `search-jobs` entry unchanged. The `tags` JSX consumer **moves** from the CostCalculator tag input label (removed by Gap A) and the JobsManager pencil-button (removed by Gap B) to a **new absolute-overlay** on the JobsManager hover tag icon (created by Gap B). The **`quick-duplicate` entry is REMOVED** from `src/features.ts` per Gap D (no row-action UI to badge); its JSX consumer on the `[⋯]` button is removed alongside the button itself. `tags` and `search-jobs` keep their 2026-05-24 release dates. |
| **D-14** | Mobile chip strip scrolls horizontally at <640px | **WITHDRAWN** | No chip strip to make scrollable. Withdrawn with Gap C. |
| **D-15** | DUP-02 locked Vitest contract | **PASS** | Plan 15-02 test asserts the full contract verbatim; passes in Task 1's Vitest run. |

---

## Requirement Closure

Status of each of the 6 requirements this phase claims to address.

| ID | Status | Reason |
|----|--------|--------|
| **TAGS-01** | **OUTSTANDING** | Input surface needs redesign per Gap A (remove CostCalculator surface) + Gap B (reshape JobsManager surface to title-click inline panel + hover tag icon). Pure-helper normalization (Plan 15-01 + 15-03) is correct and stays; only the UI surface needs rework. |
| **TAGS-02** | **WITHDRAWN** | Superseded by TAGS-03 (search) per user product feedback 2026-05-24. To be marked `withdrawn` in REQUIREMENTS.md with reason. |
| **TAGS-03** | **COMPLETE** | Search behavior shipped in Plan 15-04 (D-06 scope; 250 ms debounce; case-insensitive substring) and user explicitly affirmed it as the canonical filter mechanism. |
| **TAGS-04** | **OUTSTANDING-PENDING-UAT** | Cache key narrows from tri-key to bi-key after Gap C closure (drops the chip segment). Live cache-invalidation flow NOT exercised in browser — re-verify in gap-closure UAT. |
| **DUP-01** | **WITHDRAWN** | Row-action UI withdrawn per Gap D. The `[⋯]` overflow + Duplicate menu item + post-duplicate scroll/highlight + `quick-duplicate` NewBadge are all REMOVED. The clone-and-tweak workflow is deferred to v1.3+ where a richer job-detail surface can host it. REQUIREMENTS.md marks DUP-01 as `withdrawn-from-v1.2` with reason "UI deferred to v1.3+; helper (DUP-02) ships standalone for future consumers". |
| **DUP-02** | **COMPLETE** | D-15 locked Vitest contract passes (Plan 15-02). Pure-helper allowlist (`duplicateJob`) does not depend on Gaps A/B/C/D; ships as-is. Will be consumed by a future v1.3+ surface (job-detail panel, batch-action menu, or wherever clone-and-tweak fits naturally). |

---

## Gaps

Four product-design gaps surfaced during human UAT (2026-05-24, amended same day to add
Gap D). All are UX-shape gaps, not implementation defects — the underlying pure helpers
are correct. Gap-closure planning should treat each as a **scope refinement** of the
original D-01 / D-03 / D-04 / D-07 / D-11 / D-13 / D-14 contracts.

---

### Gap A — Tag input surface should not exist on CostCalculator save form

- **Severity:** scope-refinement (user product feedback)
- **Symptom:** Plan 15-03 added a Tags input row to the CostCalculator save form on both
  the Create and Update branches. User product feedback: tags are not entered during
  costing — they belong on the My Jobs page only. The user reasons about cost on the
  calculator; they reason about library organization on JobsManager.
- **Violates:** D-01 **surface a** (CostCalculator save form tag input) — surface is being
  WITHDRAWN. ROADMAP SC#1 will be rescoped from "two-surface" to "JobsManager-only".
- **Recommended fix surface:**
  - Remove the Tags `<label>` + `<input>` row from `src/components/CostCalculator.tsx`
    (both the Update branch and the Create branch).
  - Remove the `tagsInput` state and the two `parseTagsInput(tagsInput)` call sites in
    the save handlers.
  - **Keep** `parseTagsInput` exported from `src/db/backfill.ts` — it is still used by
    the JobsManager inline editor (Plan 15-05) and will continue to be used by the
    Gap-B-reshaped surface.
  - **Keep** the `tags` entry in `src/features.ts` (don't bump or remove the release date)
    — only the JSX consumer site moves (handled by Gap B).

---

### Gap B — Tag editor on JobCard should use title-click inline panel + hover tag icon (not the pencil button)

- **Severity:** scope-refinement (user product feedback)
- **Symptom:** Plan 15-05 placed the tag editor behind a pencil button in the JobCard
  action row, next to Record Sale / Create Quote / Edit / Delete. User product feedback:
  editing the job (title + tags) should be accessible by **clicking the job title**, which
  opens an inline edit panel containing **both** the title-rename field and the tag editor
  in one place. Additionally, a small **tag icon appears on title hover** as a shortcut
  affordance into the same panel.
- **Violates:** D-01 **surface b** UX intent (the JobsManager inline editor surface). The
  pencil-button trigger is being WITHDRAWN; the title-click + hover-icon pattern is
  REPLACING it.
- **Recommended fix surface:**
  - In `src/components/JobsManager.tsx`:
    - Remove the pencil-button trigger from the JobCard action row.
    - Add a **title-click handler** on the job-name span that opens an inline edit panel.
      The panel contains both the title-rename input AND the tag editor in a single
      coherent surface (one Save / Cancel pair, or auto-save on blur — gap-closure
      planner decides).
    - Add a **small `Tag` icon** (lucide-react `Tag` or a local SVG) that appears on
      title hover, positioned inline with the title. Clicking the icon opens the same
      inline panel.
    - The current click-to-expand affordance on the title (which opens the accordion
      sub-section) needs to move to a separate region of the card (e.g. an explicit
      chevron, or click-outside-title) — gap-closure planning resolves the click-target
      conflict.
  - **Re-target** `<NewBadge feature="tags" />` to overlay the hover tag icon
    (absolute-overlay positioning per project memory rule; do NOT push the title or
    cause any layout reflow). One badge total; remove the existing inline badge inside
    the pencil-button affordance.

---

### Gap C — Multi-select chip-filter row in JobsManager sub-header is redundant with search and should be removed

- **Severity:** scope-refinement (user product feedback) — withdraws TAGS-02
- **Symptom:** Plan 15-04 added a chip-filter row below the search bar in the JobsManager
  sticky sub-header (multi-select with AND logic, sorted alphabetically with counts like
  `pla · 3`, plus a Clear-filters link). User product feedback: the search input already
  substring-matches tag names; the chip strip is redundant clutter that takes vertical
  space without adding capability.
- **Violates:**
  - D-03 (sticky sub-header chip row — chip row removed)
  - D-04 (AND combination across chips — no longer applies)
  - D-14 (mobile chip strip horizontal scroll — N/A; nothing to scroll)
  - **WITHDRAWS** REQUIREMENT TAGS-02
  - **WITHDRAWS** ROADMAP Phase 15 Success Criterion #2
- **Recommended fix surface:**
  - In `src/components/JobsManager.tsx`:
    - Remove the multi-select chip-filter `<div>` row beneath the search input.
    - Remove the `selectedChips` state, the `selectedChipsKey` memo, and the
      chip-tag-derivation memo (the alphabetical-with-counts derivation).
    - Remove the chip-filter branch from the filter chain (`searchedJobs` reduces to
      a search-only filter).
    - **Keep** the search input.
    - **Keep** the filter-empty-state block (it still fires for search misses).
  - Narrow `useDynamicRowHeight` cache key from
    `${selectedJobId ?? ''}|${selectedChipsKey}|${debouncedSearchQuery}` to
    `${selectedJobId ?? ''}|${debouncedSearchQuery}` (D-05 reshape — still pipe-delimited,
    just one fewer segment).
  - Decide in gap-closure: keep the "Clear filters" link as "Clear search", OR replace
    with a built-in clear-X button on the search input, OR remove entirely if the search
    input gets a native clear affordance.
  - Update `.planning/REQUIREMENTS.md`: mark **TAGS-02** as `withdrawn` with reason
    "superseded by TAGS-03 search per user product feedback 2026-05-24".
  - Update `.planning/ROADMAP.md`: mark Phase 15 Success Criterion #2 as withdrawn
    (annotated or struck through).

---

### Gap D — Quick Duplicate row-action UI is poorly shaped and should be removed (helper stays)

- **Severity:** scope-refinement (user product feedback) — withdraws DUP-01 (the UI requirement only; DUP-02 helper is unaffected)
- **Symptom:** Plan 15-05 shipped a `[⋯]` overflow-menu button on every JobCard action row,
  hosting a single `Duplicate` item. User product feedback (with screenshot): the button is
  visually orphaned — labelless, iconless, with a floating NEW badge that adds confusion
  rather than guidance. A single-item overflow is the wrong shape: overflow earns its keep
  when ≥3 actions are hidden (the Phase 16 ext2 D-29 Pending Quote row, where this pattern
  originated); a single hidden action is just an unlabeled mystery affordance.
- **Underlying product question raised during UAT:** *"Why are we duplicating a job?"*
  The answer is the clone-and-tweak workflow (start a near-identical job — same model,
  different filament/customer/print speed — without retyping the cost inputs). But the user
  judgment is that this workflow does not justify its own row-action button at v1.2 scope.
  A richer surface (job-detail panel, batch-action menu, command palette) is a better host
  and will be designed in v1.3+. The helper exists and is locked, so the workflow can be
  re-surfaced cheaply later.
- **Violates:**
  - D-07 (`[⋯]` overflow menu UX) — pattern removed entirely
  - D-13 (`quick-duplicate` NewBadge wiring) — entry + JSX consumer removed
  - **WITHDRAWS** REQUIREMENT DUP-01 (the row-action UI requirement)
  - **RESCOPES** ROADMAP Phase 15 Success Criterion #5 to "helper-only" — keeps the
    locked Vitest contract (`duplicateJob(job).customer === undefined`, etc.) but drops
    the live UI assertion
- **Does NOT violate:**
  - DUP-02 (the helper + locked Vitest contract) — these survive untouched in
    `src/utils/duplicateJob.ts` and `src/utils/duplicateJob.test.ts`. The 7 passing tests
    stay green.
- **Recommended fix surface:**
  - In `src/components/JobsManager.tsx`:
    - Remove the `[⋯]` overflow-menu button from the JobCard action row.
    - Remove the `overflowOpenJobId` parent state, the click-outside-on-window handler,
      the dropdown menu DOM, and the post-duplicate scroll/highlight ring effect
      (`ring-2 ring-blue-400` 2-second timeout).
    - Remove the `Duplicate` menu item handler that calls `duplicateJob` + `nextCopyName`
      + `bulkPut` + scroll-and-highlight.
    - **Keep** the imports of `duplicateJob` and `nextCopyName` IF a different surface in
      this file will consume them after gap closure (e.g. a Gap B inline panel "Duplicate"
      button). If no consumer remains, remove the imports.
  - In `src/utils/duplicateJob.ts` and `src/utils/duplicateJob.test.ts`:
    - **DO NOT TOUCH.** These are the locked DUP-02 helper + tests. The 7 Vitest cases
      must continue to pass.
  - In `src/features.ts`:
    - Remove the `quick-duplicate` entry (release-date row) — no consumer left.
    - **Keep** the `tags` and `search-jobs` entries.
  - Update `.planning/REQUIREMENTS.md`: mark **DUP-01** as `withdrawn-from-v1.2` with
    reason "UI deferred to v1.3+ where a richer surface (job-detail panel, batch-action
    menu) can host clone-and-tweak; DUP-02 helper ships standalone".
  - Update `.planning/ROADMAP.md`: rescope Phase 15 Success Criterion #5 from
    "user can quick-duplicate from row action" to "duplicateJob helper exists with locked
    PII-reset contract (DUP-02)"; remove the row-action UI claim. Add a note that DUP-01
    is deferred.

---

## Product Intent Note (informational)

This is **not a gap** — it is a guiding constraint that future planners must respect when
authoring the gap-closure plan set. Captured verbatim from user product feedback during
the 2026-05-24 UAT:

> "Tags are meant to be descriptive of what is going on with jobs. For example, trending,
> bestseller, etc. Describing attributes already associated with the job is redundant."

**Implication:** Gap-closure planning must NOT re-introduce tag-as-attribute UX (e.g. an
"auto-tag from filament" feature, or chip-style facet filters that effectively duplicate
information already on the JobCard summary line). The legitimate use case for tags is
**curatorial signals** (trending, bestseller, archive, retired, seasonal, etc.) that the
user attaches **deliberately** to organize their library — not a structured taxonomy
derived from job fields.

This constraint may also influence the eventual v1.3 decision on `click-chip-to-filter`
(currently deferred in 15-CONTEXT.md): if curatorial tags are the only legitimate use,
click-to-filter from a JobCard chip might still be welcome — but auto-derived tag chips
would not be. Gap-closure does **not** decide this; v1.3 planning will.

---

## Next Steps

1. **Do NOT mark Phase 15 complete.** Phase 15 remains OPEN in STATE.md
   (`completed_phases` stays at 4; `percent` stays at 67). Do not run
   `/gsd:complete-milestone v1.2`.

2. **Next command:** `/gsd:plan-phase 15 --gaps` — this will read this VERIFICATION.md
   and author gap-closure plans for Gap A, Gap B, Gap C, **and Gap D**. The gap-closure
   planner has the recommended fix surface for each gap encoded above.

3. **After gap-closure plans land + execute:** re-run Plan 15-06 (or equivalent verification
   wave) to UAT the rescoped surface. On `gap-free` verdict, advance STATE.md
   `completed_phases` to 5 and `percent` to 83.

4. **REQUIREMENTS.md updates landing with this commit:**
   - TAGS-02 marked `Withdrawn` (superseded by TAGS-03 search per user product feedback)
   - **DUP-01 marked `Withdrawn-from-v1.2`** (UI deferred to v1.3+; DUP-02 helper ships standalone) — added in the Gap D amendment

5. **ROADMAP.md updates landing with this commit:**
   - Phase 15 Success Criterion #2 marked withdrawn
   - **Phase 15 Success Criterion #5 rescoped** from "user can quick-duplicate from row action" to "duplicateJob helper exists with locked PII-reset contract" — added in the Gap D amendment

---

*Verification authored: 2026-05-24*
*Verifier: Plan 15-06 Task 3 (executor agent)*
*Automated chain: Task 1 (commit `c464538`)*
*Human UAT: Task 2 — verdict `approved-with-gaps` (initially 3 gaps; amended same day to add Gap D after UI critique of the `[⋯]` Quick Duplicate button)*

---

## Gap-Closure Round 1 (2026-05-24 amendment)

**Plans landed:** 15-07 (Gap A), 15-08 (Gap D), 15-09 (Gap C), 15-10 (Gap B attempt), 15-11 (this verification).

**Outcome:** 3 of 4 gaps closed (A, C, D). **Gap B regresses into a new Gap E** — the shipped Gap B fix (title-click inline edit panel below the title row) was rejected at UAT as "a weird expand field". User wants edit-in-place: title becomes an `<input>` where the title sits, tag chips become an editable chip row in place, no separate panel ever appears. Tag icon hover affordance stays as a shortcut into tag edit.

### Round 1 Automated Chain (Plan 15-11 Task 1)

Captured to `/tmp/15-gap-closure-{tsc,vitest,build,bundle}.log`.

| Step | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc -b` | exit 0, 0 errors |
| Vitest | `npm test -- --run` | **263 passed / 1 todo / 0 failed** (18 test files) |
| Build | `npm run build` | clean (`✓ built in 2.31s`); all 5 assertion scripts passed |
| Bundle gate | main chunk gz | **60.8 KB** (`dist/assets/index-WZRhf7n2.js`, 257 KB raw) — Phase 11 gate is 300 KB → 239 KB headroom |

### DUP-02 LOCKED File Integrity

`git log --oneline -- src/utils/duplicateJob.ts src/utils/duplicateJob.test.ts`:
```
13c6e1a refactor(15-02): satisfy D-09 grep -c '...source' === 0 acceptance criterion
6ae4a4d test(15-02): add D-15 locked contract + by-value isolation + nextCopyName tests
940935b feat(15-02): add explicit-allowlist duplicateJob + nextCopyName pure helpers
```

Zero new commits past the Plan 15-02 baseline. Both files byte-identical to pre-gap-closure state. DUP-02 contract preserved.

### Per-Gap Closure Status After Round 1

| Gap | Status | Evidence |
|-----|--------|----------|
| **A** — CostCalculator tag input | **CLOSED** | `grep -cE 'tagsInput\|setTagsInput\|parseTagsInput\|feature="tags"' src/components/CostCalculator.tsx` → 0. Plan 15-07 commits `45d98c0` + `690e0be`. Form still saves jobs; Update branch passes through `editingJob.tags` unchanged. |
| **B** — JobsManager tag editor reshape | **REOPENED AS GAP E** | Plan 15-10 shipped a title-click panel that opens BELOW the title row with two inputs + Save/Cancel. User UAT verdict: "It's close. The functionality is there, but it should be inline, not a weird expand field for title and tags." The dropped-down panel is the wrong shape. See Gap E below for the new contract. |
| **C** — Chip-filter row removal | **CLOSED** | `grep -cE 'selectedChips\|tagCounts\|jobsAfterChipFilter\|clearFilters' src/components/JobsManager.tsx` → 0. Cache key narrowed to bi-key (`selectedJobId\|debouncedSearchQuery`). Filter-empty-state reads "No jobs match your search" with "Clear search" CTA. Plan 15-09 commit `c03fbb5`. |
| **D** — `[⋯]` Quick Duplicate UI | **CLOSED** | `grep -cE 'overflowOpenJobId\|handleDuplicate\|handleToggleOverflow\|highlightedJobId\|feature="quick-duplicate"\|ring-2 ring-blue-400' src/components/JobsManager.tsx` → 0. `'quick-duplicate':` removed from features.ts. DUP-02 LOCKED files untouched. Plan 15-08 commits `0f4c8d3` + `14ec22d`. |

### Gap E — Title + tag edit must be edit-in-place, not a dropped-down panel

**Severity:** medium (UX shape).

**Observed (after Plan 15-10):**
- Hover on title row reveals a Tag icon ✓ (good — keep)
- Clicking the Tag icon OR the title text opens an inline edit panel **below the title row** with two `<input>` fields (Title + Tags) and a Cancel/Save pair.
- The panel is structurally outside `{isSelected && (...)}` — visible whether expanded or not.

**User feedback (2026-05-24):**
> "It's close. The functionality is there, but it should be inline, not a weird expand field for title and tags."

**Required behavior for Round 2:**

1. **Title click → edit in place.** The title text itself (the `<button>` that currently shows the job name) should become an `<input>` in the same location, replacing the text node. No new row appears. Pressing Enter saves; Escape cancels.

2. **Tag chips render INLINE BESIDE the title, not below it.** (Refined 2026-05-24 post-Round-1.) The current JobCard layout renders tag chips in their own strip below the filament meta line — that placement is rejected. Tag chips must instead render inline in the title row, in this order: `[chevron] [title] [tag chip] [tag chip] [tag chip] [add-tag +] [Tag icon on hover] [break-even pill]`. The existing standalone chip strip below filament meta is REMOVED.

3. **Tag chip hover interactions — ✕ to remove, `+` to add.**
   - Each tag chip shows a small **✕** on hover (single click removes that tag from the job; persists atomically via `db.jobs.put({...job, tags: newTags})`).
   - At the **end of the chip strip**, a small **`+` affordance** is always visible (or fades in on title-row hover — pick one, document it). Clicking the `+` produces a small inline `<input>` where the user types a new tag name and commits with Enter (or blur). Escape cancels.
   - With tag cap at 10 (D-02), the `+` hides when `job.tags.length === 10` and reappears when a tag is removed.

4. **Placeholder text for the add-tag input must suggest domain-relevant tag use-cases.** (Refined 2026-05-24 post-Round-1.) When the `+` opens its inline input, the `placeholder` attribute should suggest the KIND of tags users might apply — status / popularity / lifecycle indicators. Example value: `"trending, popular, out of date"`. The placeholder is suggestive, not prescriptive — it tells the user what tags are FOR. Do not hard-code "phone-stand, pla, gloss"-style content-specific examples; those vary per job. The placeholder string is a constant in JobsManager.tsx; if the Round 2 planner wants it externalized to a constants file, that is acceptable.

5. **Tag icon hover affordance — keep, but its role narrows.** The small Tag icon next to the title on hover stays as a discoverability shortcut, but with the inline-chip pattern it now scrolls the title-row affordances into focus (or focuses the `+` directly). NewBadge `tags` continues to overlay the Tag icon. If the planner determines the icon is redundant once chips render inline (chips themselves are the affordance), the icon MAY be removed in Round 2 — but the NewBadge then needs a new host (re-target to the chip strip or to the `+`). Decide and document.

6. **Chevron, action row, accordion behavior — keep.** Chevron toggles expansion. Card-body clicks do not toggle. Action row stays Record Sale / Create Quote / Edit / Delete.

7. **No dropped-down panel anywhere.** Remove `editPanelOpenJobId`, `editPanelDraftName`, `editPanelDraftTags`, the panel JSX, the handlers (`handleOpenPanel`, `handleSavePanel`, `handleCancelPanel`) — replace with inline-edit state scoped to each editable surface (title input scoped to one `editingTitleJobId`; add-tag input scoped to one `addingTagJobId`).

### Open questions for the Round 2 planner

- **Title-row overflow with many tags:** with up to 10 chips inline plus the title, the chip strip can push the break-even pill off the row on narrow screens. Decide: wrap chips below the title (acceptable — still "inline with title row" semantically), truncate chips with `…` overflow indicator, or scroll horizontally. The planner picks one and documents it as a D-XX decision before Round 2 plans are authored.
- **Add-tag input width / position:** the `+` opens an inline `<input>` — does it grow to fill remaining row width, or stay narrow (e.g., 8ch)? Planner picks.
- **Mobile / narrow-screen behavior:** with title + chips + Tag icon + break-even pill, narrow viewports get crowded. Planner picks the wrap/truncate strategy from the previous bullet and confirms it works at 320px+ viewport widths (existing breakpoint per Phase 13 UI sweep).

**Recommended fix surface:**
- `src/components/JobsManager.tsx` — replace the title `<button>` with conditional title-input rendering; replace the read-only tag chip strip with an editable chip row.
- Reuse `parseTagsInput` from `src/db/backfill.ts` for the "add tag" affordance.
- Persist with the same atomic `db.jobs.put({...job, name, tags})` pattern.
- Preserve all locked files: `src/utils/duplicateJob.ts`, `src/utils/duplicateJob.test.ts`, `src/db/backfill.ts`, `src/features.ts` (the `tags` feature key stays as-is).

**Acceptance contract for Round 2:**
- `grep -cE 'editPanelOpenJobId\|editPanelDraftName\|editPanelDraftTags\|handleSavePanel\|handleCancelPanel' src/components/JobsManager.tsx` → 0 (panel-based edit fully removed)
- The standalone tag chip strip rendered today below the filament meta line is REMOVED — tag chips render inline in the title row instead
- The title row contains, in DOM order: chevron → title (or title-input when editing) → tag chip(s) → `+` add-tag affordance → Tag icon (on hover, if retained) → break-even pill
- Each tag chip has a hover `<button aria-label="Remove tag X">✕</button>` that calls `db.jobs.put({...job, tags: tags.filter(t => t !== X)})` on click
- The `+` add-tag affordance opens an inline `<input>` whose `placeholder` attribute is a domain-relevant suggestion such as `"trending, popular, out of date"`. The exact string is decided by the Round 2 planner but MUST be a usage suggestion, not a content example
- The title-input replaces the title text in place when clicked — no new row appears, layout above/below the title row is unchanged
- A new UI test or component test asserts: (a) title-input renders in the title row when title is clicked, (b) chip ✕ removes a tag, (c) `+` opens an input with the suggested-usage placeholder, (d) tag cap of 10 is enforced (the `+` hides at 10 tags)
- Tag icon hover affordance + NewBadge overlay both preserved OR explicitly re-targeted (Round 2 planner decides; if removed, NewBadge moves to a new host)
- Vitest still passes ≥ 263 / 1 / 0; bundle gate still ≤ 300 KB gz
- LOCKED files still byte-identical (no new commits on `duplicateJob.ts`, `duplicateJob.test.ts`)
- Round 2 includes a D-XX decision documenting the title-row overflow strategy (wrap / truncate / scroll) for >5 chips on narrow viewports

---

## Next Steps (after Round 1)

1. **Do NOT mark Phase 15 complete.** Phase 15 remains OPEN. STATE.md stays at `completed_phases: 4`, `percent: 67`. Do not run `/gsd:complete-milestone v1.2`.

2. **Next command:** `/gsd:plan-phase 15 --gaps` — re-read this VERIFICATION.md, author Round 2 gap-closure plans targeting Gap E only (Gaps A, C, D are closed; do not re-plan them). The Round 2 plan replaces the dropped-down panel with edit-in-place affordances per the Gap E contract above.

3. **After Round 2 lands + executes:** re-run Plan 15-11 (or equivalent) to UAT the edit-in-place surfaces. On `gap-free` verdict, advance STATE.md `completed_phases` to 5 and `percent` to 83.

---

*Round 1 amendment authored: 2026-05-24*
*Verifier: Plan 15-11 Task 2 (orchestrator-handled checkpoint)*
*Automated chain: Plan 15-11 Task 1 (logs at /tmp/15-gap-closure-*.log)*
*Human UAT: Plan 15-11 Task 2 — verdict `approved-with-gaps` (3 closed, 1 new — Gap E)*
