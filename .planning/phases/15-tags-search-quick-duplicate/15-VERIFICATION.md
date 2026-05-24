---
phase: 15-tags-search-quick-duplicate
type: verification
verified: 2026-05-24
verdict: gaps-found
requirements_evaluated: [TAGS-01, TAGS-02, TAGS-03, TAGS-04, DUP-01, DUP-02]
gaps_open: 3
---

# Phase 15 Verification — Tags, Search + Quick Duplicate

**Verdict:** `gaps-found` (3 gaps — A, B, C)
**Verified:** 2026-05-24
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
| **SC#5** | DUP-01 + DUP-02 — Quick Duplicate from `[⋯]` row action + PII reset locked test contract | **PASS PENDING UAT** | Vitest D-15 contract passes (Plan 15-02: 7 cases including the locked assertion that `duplicateJob(job).customer === undefined`, `taxRate === undefined`, `copiesSold === 0`, `id !== source.id`, `tags` preserved). Live `[⋯] → Duplicate` UI flow with scroll+highlight NOT exercised in browser. Re-verify in gap-closure UAT. |

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
| **D-07** | `[⋯]` overflow menu UX (single-item Duplicate; no modal; toast/highlight) | **PASS PENDING UAT** | Shipped in Plan 15-05 (overflowOpenJobId parent state; click-outside on window; 2s `ring-2 ring-blue-400` highlight). Live flow not yet exercised in browser — re-verify in gap-closure UAT. |
| **D-08** | Collision counter `(copy)` → `(copy 2)` → `(copy 99)` then silent cap | **PASS** | Vitest (Plan 15-02 — `nextCopyName` covered for the empty-list case, the `(copy)` collision case, and the `(copy 2)` collision case). |
| **D-09** | DUP-02 explicit-allowlist — `customer`/`taxRate`/`taxAmount`/`copiesSold`/`quoteNumber` reset | **PASS** | Vitest (Plan 15-02 + D-15 locked contract). |
| **D-10** | Filter empty state (`No jobs match your filter` + Clear-filters link, with filter UI staying visible) | **RESHAPED** | Empty state still fires for search misses; the "Clear filters" link becomes "Clear search" — or is removed if the search input grows an inline clear button. Gap-closure planning decides which. |
| **D-11** | Chip rendering on JobCard summary line (mirrors AssetLibrary.tsx:192-198 styling exactly) | **PASS PENDING UAT** | Shipped in Plan 15-05; byte-identical chip class string per Plan 15-05 SUMMARY decisions. Re-verify visual parity with AssetLibrary in gap-closure UAT. |
| **D-12** | Tag normalization reconcile (idempotent, one-per-page-load) wired into `useJobs` init | **PASS** | Wired in Plan 15-05 via `tagsNormalizeRan` module flag mirroring `copiesSoldReconcileRan`; will fire on next page load. UI-side correctness unverified live but contract is locked + Vitest-covered. |
| **D-13** | NewBadge wiring (`tags` + `search-jobs` + `quick-duplicate`) | **RESHAPED** | `search-jobs` and `quick-duplicate` entries unchanged. The `tags` JSX consumer **moves** from the CostCalculator tag input label (removed by Gap A) and the JobsManager pencil-button (removed by Gap B) to a **new absolute-overlay** on the JobsManager hover tag icon (created by Gap B). `tags` entry in `src/features.ts` keeps its 2026-05-24 release date. |
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
| **DUP-01** | **OUTSTANDING-PENDING-UAT** | Overflow-menu + post-duplicate scroll+highlight shipped in Plan 15-05; D-15 contract passes; live UI flow NOT exercised in browser — re-verify in gap-closure UAT. |
| **DUP-02** | **COMPLETE** | D-15 locked Vitest contract passes (Plan 15-02). Pure-helper allowlist (`duplicateJob`) does not depend on Gaps A/B/C; ships as-is. |

---

## Gaps

Three product-design gaps surfaced during human UAT (2026-05-24). All are UX-shape gaps, not
implementation defects — the underlying pure helpers are correct. Gap-closure planning
should treat each as a **scope refinement** of the original D-01 / D-03 / D-04 / D-11 /
D-13 / D-14 contracts.

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
   and author gap-closure plans for Gap A, Gap B, and Gap C. The gap-closure planner has
   the recommended fix surface for each gap encoded above.

3. **After gap-closure plans land + execute:** re-run Plan 15-06 (or equivalent verification
   wave) to UAT the rescoped surface. On `gap-free` verdict, advance STATE.md
   `completed_phases` to 5 and `percent` to 83.

4. **REQUIREMENTS.md updates landing with this commit:**
   - TAGS-02 marked `Withdrawn` (superseded by TAGS-03 search per user product feedback)

5. **ROADMAP.md updates landing with this commit:**
   - Phase 15 Success Criterion #2 marked withdrawn

---

*Verification authored: 2026-05-24*
*Verifier: Plan 15-06 Task 3 (executor agent)*
*Automated chain: Task 1 (commit `c464538`)*
*Human UAT: Task 2 — verdict `approved-with-gaps` (3 gaps)*
