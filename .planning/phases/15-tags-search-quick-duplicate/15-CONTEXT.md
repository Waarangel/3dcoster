---
phase: 15-tags-search-quick-duplicate
type: context
gathered: 2026-05-24
gathered_by: discuss-phase
---

# Phase 15: Tags, Search + Quick Duplicate — Context

## Domain

Organize and recall saved jobs by tags, free-text search, and one-click duplicate. JobsManager-centric work — the schema is already ready (`PrintJob.tags?: string[]` field exists from Phase 12 backfill in `src/types.ts:46`).

This is the last v1.2 phase. Closes 6 requirements (TAGS-01..04, DUP-01..02) and unlocks `/gsd:complete-milestone v1.2`.

## Carrying forward from prior phases / project lockings

| Source | Decision that applies |
|--------|----------------------|
| PROJECT.md | "Tags ship as editable strings + chip filter + free-text search (no autocomplete, no PDF chips) — minimum viable tag UX" — milestone-level lock; do NOT exceed this scope |
| PROJECT.md TAGS-F1 (deferred) | NO tag autocomplete in v1.2 — plain comma-separated input only |
| PROJECT.md TAGS-F2 (deferred) | NO tag chips on the PDF quote — out of scope |
| PROJECT.md TAGS-F3 (deferred) | Tags ALWAYS carry on Quick Duplicate (not user-configurable in v1.2) |
| `src/components/AssetLibrary.tsx:192-198` | Existing tag-chip render pattern: `bg-slate-600/50 text-slate-400 rounded text-xs px-1.5 py-0.5` — MIRROR this for JobsManager tag display so styling is consistent across the app |
| `src/components/CustomerLibrary.tsx:115, 141-150` | Existing search pattern: `useState('')` + `useMemo` + `.toLowerCase().trim().includes()` substring match — MIRROR for TAGS-03 |
| `src/components/JobsManager.tsx:1232` | Existing `useDynamicRowHeight({ key: selectedJobId ?? '' })` — TAGS-04 contract requires extending the key per D-04 below |
| Phase 15.1 picker (15.1-04) | Typeahead/combobox pattern exists but is NOT used here — TAGS-F1 forbids autocomplete in v1.2 |
| Phase 16 ext2 D-29 | Overflow menu `[⋯]` pattern used on Pending Quote rows — MIRROR for Quick Duplicate trigger (D-07 below) |
| Phase 16 ext2 D-33 | Search bar on per-job Orders sub-section was deferred to v1.3 — DIFFERENT surface from TAGS-03 (job-list level); don't conflate |
| `src/db/backfill.ts` | Reconcile-helper pattern for legacy data — applies to tags too (D-12 below) |

## Decisions (D-01 through D-15)

**D-01 (Tag input location — both surfaces):**
Tag input field appears on BOTH (a) CostCalculator's save block alongside Notes AND (b) inline-edit affordance on each JobsManager job card. Reason: power users tag on save; new users tag later when scanning. Inline edit avoids forcing Edit→CostCalculator round-trip for a 2-second re-tag.

**D-02 (Tag input format):**
- Single comma-separated input string (e.g., `phone-stand, pla, gloss-finish`)
- On save: `.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0)` → dedupe via `Set` → cap at 10
- Character whitelist: alphanumeric + hyphen + underscore + space — strip emoji and other punctuation via regex `/[^a-z0-9\s\-_]/g`
- Multi-word tags ALLOWED (e.g., `phone stand` is one tag, not two — comma is the delimiter, spaces stay)
- Max 10 tags per job. Excess silently dropped (with a one-time inline warning under the input: "Maximum 10 tags — extras ignored")
- Empty input → `tags: undefined` (not `[]`) to preserve "no tags ever set" semantic; the backfill handles both shapes

**D-03 (Chip filter + search bar layout):**
- Render at the TOP of JobsManager (above the virtualized list), as a sticky sub-header
- Search input on top (full-width); chip filter row below
- Chip filter shows every tag-in-use across saved jobs with count: `pla · 3`, `phone-stand · 1`, etc.
- Sorted alphabetically by tag name (stable; predictable scan order)
- "Clear filters" link appears when any filter is active

**D-04 (Filter combination semantics — AND across surfaces):**
- Result set = `(job matches search) AND (job has ALL selected chips)`
- Empty selected chips = no chip filter applied (only search filters)
- Empty search = no search filter applied (only chip filters)
- Both empty = full list

**D-05 (Cache invalidation key — TAGS-04 contract lock):**
`useDynamicRowHeight({ key })` where `key = ${selectedJobId ?? ''}|${selectedChipsSortedJoined}|${searchQuery}`. Any of the three components changing → cache invalidates → list scrolls to top → no stale row heights. The pipe-delimited concat avoids collisions (e.g. `job123pla` vs `job12|3pla`).

**D-06 (Search scope):**
- `PrintJob.name` (substring, case-insensitive, trimmed)
- Every tag in `PrintJob.tags` (substring against each tag)
- Every Sale's `Sale.customer.name`, `.email`, `.company` for sales whose `Sale.jobId === job.id` (joined via `useSales()`)
- NOT `Sale.customer.address` and NOT `Sale.customer.notes` — too broad, hurts precision
- NOT `PrintJob.customer` (Phase 14 deprecated this field; no live data is written there)
- Debounce: 250ms on the search input to avoid filter-refire on every keystroke

**D-07 (Quick Duplicate trigger — overflow menu):**
- New `[⋯]` overflow menu button on every JobsManager job card action row, alongside Record Sale / Create Quote / Edit / Delete
- Mirror the Phase 16 ext2 D-29 pattern (the Pending Quote row's overflow menu)
- Menu item: `Duplicate` (single action; no sub-options in v1.2)
- Click → duplicate created immediately (no confirmation modal — duplicates are reversible via Delete)
- Visual feedback: small toast `Duplicated as "{name} (copy)"` + JobsManager scrolls to and highlights the new row
- New row appears at the TOP of the list (sorted newest by `createdAt`)

**D-08 (Duplicate name format):**
- Default: `{original.name} (copy)`
- If `{original} (copy)` already exists: `{original} (copy 2)`, then `(copy 3)`, etc.
- Cap collision-counter at 99 (silent — if user has 100 copies they have bigger problems)

**D-09 (DUP-02 explicit-allowlist — what carries vs resets):**
`duplicateJob(job)` is an explicit-allowlist pure helper (NOT a spread + override pattern, to prevent silently inheriting new PrintJob fields added in future phases).

CARRIED (inherited from source):
- `name` (with " (copy)" suffix per D-08)
- `filaments` (array — by-value snapshot)
- `printTimeHours`, `printerInstanceId`
- `modelCost`, `modelCostPerUnit`, `authorMinPrice`, `modelUrl`
- `prepTimeMinutes`, `postProcessingMinutes`, `materialsUsed`
- `failureRate`, `costPerUnit`, `sellingPrice`
- `notes`
- `tags` (per TAGS-F3 lock — always carries)
- `etsyChecks`, `shippingMethod`, `shippingDistanceKm`, `shippingOverrideCost`, `packagingMaterials`, `marketplace`

RESET (new value or undefined):
- `id` → `crypto.randomUUID()`
- `createdAt` → `new Date()`
- `updatedAt` → `new Date()`
- `customer` → `undefined` (PII reset — DUP-02 explicit per the unit-test contract)
- `taxRate` → `undefined` (falls back to current region/Settings default on next save)
- `taxAmount` → `undefined`
- `copiesSold` → `0`
- `quoteNumber` → `undefined` (quote numbers are unique per Quote record; new job starts fresh)

NOT IN SCOPE (duplicate ignores):
- Associated `Sale` records (sales attach to the original job; the duplicate starts with 0 sales)
- Associated `Quote` records (same — quotes attach to the original; new job has none)

**D-10 (Empty filter / empty-list states):**
- 0 jobs in the system → existing empty state from JobsManager (`shouldShowEmptyState`)
- 0 jobs match filter → new empty state: `No jobs match your filter` with a `Clear filters` button. Renders ABOVE the (empty) virtualized list region — does NOT use the `EmptyState` primitive's full-card layout because the filter UI must stay visible for the user to adjust without losing context

**D-11 (Tag chip rendering on JobCard summary line):**
- Render every tag (no max-visible cap — TAGS-04 limit of 10 keeps wrap-overflow bounded)
- Style mirrors `AssetLibrary.tsx:192-198` exactly: `text-xs px-1.5 py-0.5 rounded bg-slate-600/50 text-slate-400`
- Position: right after the filament/print-time meta line, BEFORE the break-even progress bar
- Always wrap to next line on narrow widths (`flex flex-wrap gap-1`)
- Empty array OR undefined → no chips, no gap (Tailwind: render nothing rather than empty span)
- Chips are NOT interactive (clicking a chip does NOT add it to the filter — that's a TAGS-F1-class autocomplete extension and is deferred). They're purely visual.

**D-12 (Tag normalization backfill — apply the [[reconcile-legacy-data]] rule):**
Per the project memory rule, any new constraint on a derived field must ship with a reconcile. Since D-02 enforces lowercase + trimmed + capped-at-10, any legacy `PrintJob.tags` array written before this phase MUST be normalized on app load.

New pure helper: `normalizeTagsOnJob(job)` in `src/db/backfill.ts` — applies the same trim/lowercase/dedupe/cap rules to existing `job.tags`. Wired into `useJobs` init alongside `reconcileCopiesSoldFromSales` with the same one-per-page-load flag pattern. Idempotent (no-op when tags already conform).

Why this matters: Phase 12's backfill already set `job.tags = []` for v5-era jobs (per `backfillTagsOnJob`), but it never enforced the v1.2 normalization rules because they didn't exist yet. Some user with hand-edited tags via DevTools could have uppercase or untrimmed values; the chip filter would treat them as distinct from their normalized equivalents.

**D-13 (NewBadge per CLAUDE.md rule):**
Per the project's NEW Badge memory: every user-facing feature in v1.2 gets a badge. Add entries in `src/features.ts`:
- `tags` — release date 2026-05-24 (covers the tag input + filter + chips)
- `search-jobs` — release date 2026-05-24 (covers TAGS-03 search bar)
- `quick-duplicate` — release date 2026-05-24 (covers DUP-01 row action)

Badge placement (absolute overlay per project rule):
- `tags`: on the tag input field's label (CostCalculator + JobsManager inline)
- `search-jobs`: on the search input
- `quick-duplicate`: on the `[⋯]` overflow trigger

ONE badge per feature key. Do NOT stack badges on the JobsManager action row.

**D-14 (Mobile layout — claude's-discretion default):**
At < 640px (Tailwind `sm` breakpoint):
- Search bar stays full-width
- Chip filter row scrolls horizontally (overflow-x-auto) — keeps the chip-bar compact, scannable via swipe
- Quick Duplicate overflow menu opens with the same right-anchored dropdown as desktop (no full-screen sheet — overhead not worth it for a single action)
- Tag chips on JobCard wrap naturally

**D-15 (Test contract from DUP-02 — locked):**
A unit test (pure helper, no React mount) MUST assert:
```ts
const dup = duplicateJob(jobWithCustomerAndTaxRate);
expect(dup.customer).toBeUndefined();
expect(dup.taxRate).toBeUndefined();
expect(dup.copiesSold).toBe(0);
expect(dup.id).not.toBe(jobWithCustomerAndTaxRate.id);
expect(dup.createdAt.getTime()).toBeGreaterThan(jobWithCustomerAndTaxRate.createdAt.getTime());
expect(dup.tags).toEqual(jobWithCustomerAndTaxRate.tags);  // TAGS-F3 lock
```

## Deferred ideas (NOT in scope of Phase 15)

- **Tag autocomplete** (TAGS-F1) — comma-separated input only in v1.2; pick this up when tag usage signals demand
- **Tag chips on PDF quote** (TAGS-F2) — conflicts with PDF density; deferred indefinitely
- **User-configurable tag-carry on duplicate** (TAGS-F3) — always carries in v1.2
- **Click-chip-to-filter** — quality-of-life; v1.3 candidate (would require reframing chips as interactive)
- **Tag rename / merge across jobs** — bulk-edit feature; backlog
- **Tags on Quotes / Sales** — user mentioned this idea earlier as a way to migrate `Quote.declineReason` into a structured tag (e.g. `declined:too-expensive`). Out of Phase 15 scope (would touch Quote schema + Quote UI); revisit in v1.3 when the tag system has bedded down on jobs
- **Search bar on per-job Orders sub-section** (Phase 16 ext2 D-33) — v1.3
- **Tag-based sort options** (e.g., "sort by tag count") — backlog
- **Tag color customization** — backlog (chips render with one uniform style per D-11)

## Canonical refs (MUST be consulted by planner / researcher)

- `.planning/REQUIREMENTS.md` — TAGS-01..04 + DUP-01..02 spec lock
- `.planning/PROJECT.md` — milestone-level lock + TAGS-F1/F2/F3 deferred decisions
- `.planning/ROADMAP.md` — Phase 15 Success Criteria
- `src/types.ts:46` — `PrintJob.tags?: string[]` field declaration (already present)
- `src/components/AssetLibrary.tsx:192-198, 290-297` — chip render template
- `src/components/CustomerLibrary.tsx:115, 141-150, 240` — search pattern template (input + filter + placeholder)
- `src/components/JobsManager.tsx:1232` — `useDynamicRowHeight` cache key site (TAGS-04 D-05)
- `src/components/JobsManager.tsx:600+` (the QuoteRow overflow menu) — `[⋯]` menu template for D-07
- `src/db/backfill.ts` — `backfillTagsOnJob` + `backfillCustomersFromSales` + `reconcileCopiesSoldFromSales` patterns; D-12 adds `normalizeTagsOnJob` here
- `src/hooks/useDatabase.ts` — `useJobs` init has the reconcile-flag wiring template (line 435+)
- `.planning/phases/16-printable-pdf-quote/16-CONTEXT.md` — overflow menu UX precedent (D-29)
- Project memory: [[reconcile-legacy-data]] — applies to D-12

## Open questions for the planner

None blocking. The planner has full instruction set above. Two judgment calls the planner may need to make:
- **Tag input primitive:** new `<TagsInput>` shared component vs inline `<Input>` + parse-on-blur. Recommend the latter unless tag input lands in 3+ surfaces (currently only 2 — CostCalculator + JobsManager inline).
- **NewBadge placement on the inline JobsManager tag editor:** the inline-edit only appears on hover/click — badge needs a stable hover target. May require a small wrapper. Planner picks.

## Scope creep guards

If the user during planning or execution suggests any of the following, redirect to deferred ideas above:
- Click-chip-to-filter (autocomplete-adjacent)
- Tag color picker
- Tag rename / merge UI
- Tags on Quotes or Sales
- Per-job Orders search
- Tag-based sort orders
- Tag autocomplete from prior jobs

If a scope-creep request can't be redirected and the user insists: stop, surface the conflict with the relevant deferred-idea or milestone-level lock, and ask whether to (a) defer and continue Phase 15 as scoped, (b) descope something else from Phase 15 to make room, or (c) abandon the milestone close and pivot.

## What's next

After this CONTEXT.md commits:
- `/gsd:plan-phase 15` — authors the plans (roadmap sketch suggests ~5 plans). The planner has all decisions locked here so the discussion phase doesn't repeat.
- `/gsd:execute-phase 15` — implements.
- After Phase 15 closes: `/gsd:audit-milestone v1.2` → `/gsd:complete-milestone v1.2` → PR + v1.2.0 tag.
