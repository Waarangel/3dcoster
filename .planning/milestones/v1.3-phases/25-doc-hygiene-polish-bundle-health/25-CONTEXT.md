# Phase 25: Doc + hygiene + polish + bundle health - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Sweep up the 12 remaining v1.2-audit findings into one cleanup batch — no new user-facing features. Every requirement closes a specific item in `v1.2-CODE-AUDIT.md` or `v1.2-TECH-DEBT.md`:

- **Doc state lag (3 items):** DOC-01 (TAGS-01/TAGS-04 traceability flip), DOC-02 (CUST-01/CUST-02 wording-drift archive-header verify), HYG-10 (`ui-consistency-sweep.md` todo audit — update in place, do NOT archive: 30+ subtasks still genuinely open)
- **Hygiene (3 items):** HYG-01 (`generatingJobIds` permanently-empty Set), HYG-04 (`onQuoteCreated` no-op prop), HYG-05 (ImageCarousel `image5.png` absence comment)
- **Polish (4 items):** POL-01 (CustomerLibrary "Last used" vertical centering), POL-02 (CustomerCsvImportModal template-download button + `generateSampleCustomerCsv()` helper), POL-03 (jspdf `lastAutoTable.finalY` module augmentation in new `src/pdf/jspdf-augment.d.ts`), POL-04 (QuoteRow overflow-menu outside-click/Escape handler)
- **A11Y (1 item):** A11Y-09 (`QuoteStatusPill` aria-label + Declined-pill WCAG AA 3:1 contrast on `bg-slate-700`)
- **Perf / bundle health (2 items):** PERF-05 (Rollup `vendor → react-vendor → vendor` circular-chunk warning fix via explicit `manualChunks` routing in `vite.config.ts`), PERF-06 (vendor chunk classification — explicitly OPTIONAL, time-boxed ~30 min)

**Sequencing note (acknowledged, accepted):** ROADMAP.md says Phase 25 depends on Phases 19, 20, 21, 22, 23 complete ("ordered last so accumulated v1.3 work informs it"). At time of discussion only Phases 18 + 24 are complete. User decision: **proceed now** — every Phase 25 item is fully scoped today against v1.2 audit findings (independent of whatever 19–23 ship). Risk: if 19–23 introduce new doc lag or hygiene residue, that becomes a Phase 25 follow-on or a v1.4 micro-sweep. Acceptable.

**Not in scope (redirected to other phases or backlog):**
- Wiring an actual "Quote created" toast (HYG-04 Option C — needs toast primitive design first; v1.4+)
- Full ui-consistency-sweep execution (the 30+ subtasks themselves — HYG-10 only audits and updates the todo; the work is a future phase)
- Any v1.2-audit item beyond the 12 listed in ROADMAP.md success criteria
- Any new user-facing feature

</domain>

<decisions>
## Implementation Decisions

### Sequencing (gate question)
- **D-00:** **Proceed despite roadmap dependency lag.** Phase 25 is being planned/executed before Phases 19, 20, 21, 22, 23 land. Every Phase 25 item closes an already-scoped v1.2 audit finding and is technically independent of 19–23. Risk accepted: if those phases surface new doc lag or hygiene residue, that becomes a follow-on, not a Phase 25 amendment.

### Plan Structure & Wave Layout
- **D-01:** **5 plans, surface-grouped, single wave (all parallel-safe — no file contention across plans).** The 12 success criteria cluster into 5 natural surfaces:
  - **P1 — Doc batch (DOC-01, DOC-02, HYG-10):** purely `.planning/` edits, parallel-safe with everything. HYG-10 is the audit-and-update-in-place task per D-06.
  - **P2 — Customer-UI (POL-01, POL-02):** CustomerLibrary CSS centering + CustomerCsvImportModal template-download button + new `generateSampleCustomerCsv()` helper.
  - **P3 — JobsManager hygiene (HYG-01, HYG-04, POL-04, A11Y-09) + HYG-05 one-liner:** four JobsManager surface edits bundled with the trivial ImageCarousel comment (HYG-05 has no clean home; the ImageCarousel one-line comment is tiny enough to fold in without harming reviewability).
  - **P4 — PDF type augmentation (POL-03):** new `src/pdf/jspdf-augment.d.ts` (or co-located) + remove `(doc as any).lastAutoTable.finalY` cast in `src/pdf/generateQuotePdf.ts`.
  - **P5 — Bundle health (PERF-05, PERF-06):** `vite.config.ts manualChunks` change to route all `react-*` packages into `react-vendor` (closes PERF-05); time-boxed vendor classification per D-07 (PERF-06).
- **D-01a:** All 5 plans run in **one wave** — no two plans touch the same source file. Verify before kicking off execution; if a plan grows and creates contention, split waves then.
- **D-01b:** Atomic commit per task within each plan (Phase 18/24 precedent). Use `gsd-sdk query commit` helper with project's standard footer.

### HYG-01 strategy (`generatingJobIds`)
- **D-02:** **Option B — delete the slot entirely.** Remove `generatingJobIds` (the permanently-empty Set at `JobsManager.tsx:980`), `isGeneratingPdf` prop from `JobRowProps` + `JobCardProps`, all `isGeneratingPdf={generatingJobIds.has(job.id)}` call sites (lines ~834 and ~1746), `JobCard.isGeneratingPdf` usage, the `rowProps` slot, and the inline `useMemo` comment at line 978.
- **D-02a:** **Why Option B over A (derive at parent):** PrintQuoteModal opens synchronously — there is no async window where a "Generating PDF" indicator would actually be visible to the user. Keeping a "real" indicator wired to modal-open state is solving for a UX problem that doesn't exist. If a future async PDF flow needs a row-level spinner, build it then with real backing data.
- **D-02b:** **Phase 22 collision risk:** Phase 22 decomposes JobsManager (extracts `<RecordSaleModal>`, `<SaleRow>`, `useCustomerPicker`). HYG-01 touches `JobsManager.tsx` rows 772, 803, 834, 978–980, 1628, 1650, 1746. If Phase 22 lands first and renames/extracts the affected surfaces, re-locate the slots in the extracted components and delete there. If Phase 25 lands first, Phase 22 starts from a slot-free baseline (slightly easier).

### HYG-04 strategy (`onQuoteCreated`)
- **D-03:** **Option A — make optional + drop the no-op arg.** Change `PrintQuoteModalProps.onQuoteCreated` to `onQuoteCreated?: (quote: Quote) => void`. Change the invocation at `PrintQuoteModal.tsx:283` from `onQuoteCreated(quote)` to `onQuoteCreated?.(quote)`. Remove the `onQuoteCreated={() => { /* no-op for now; could trigger a toast in a future plan */ }}` line from `JobsManager.tsx:2085` (the prop is now optional). Comment can stay as a TODO note elsewhere or be deleted with the no-op.
- **D-03a:** **Why Option A over B (remove entirely):** The prop is invoked at `PrintQuoteModal.tsx:283` with the real new `Quote` object — real data already flowing through a real extension point. The call-site comment your code already shipped ("could trigger a toast in a future plan") explicitly contemplates the future toast. Removing the prop now means re-introducing the exact same signature later when the toast lands. Option A is a 4-character type change.

### HYG-10 strategy (`ui-consistency-sweep.md`)
- **D-06:** **Audit + update in place, do NOT archive.** The todo has 30+ unchecked subtasks across 5 sections (compact prop rollout × 5 components, InfoTooltip rollout × 5, features.ts dead-badge cleanup × 10+, uniform-width chunks in flex-wrap layouts, PrinterSettings refresh). Honest assessment: most are still genuinely open. Phase 25's HYG-10 plan task:
  1. Audit each subtask against current code (~1–2 hr, primarily greps for `compact` prop, `InfoTooltip` usage, dead `<NewBadge feature="..." />` JSX past MAX_AGE).
  2. Check off what's actually shipped.
  3. Leave the rest open; the todo file is updated in place to reflect ground truth.
  4. **Do NOT move to `.planning/archive/`** — there is real work remaining; archiving would lose it.
  5. The todo file remains at `.planning/todos/ui-consistency-sweep.md`. HYG-10 is "closed" by leaving the todo accurate, not by deleting/archiving the todo.
- **D-06a:** Future polish phase (v1.4 or later) consumes the remaining subtasks. Optionally, the audit pass can spawn a sibling todo (`ui-consistency-sweep-v1.4.md`) for the structural items vs. the cherry-pickable JSX cleanup, but that's the executor's call — D-06 only requires "in-place update."
- **D-06b:** **Not chosen — Option B (cherry-pick easy wins into Phase 25):** rejected to keep Phase 25 scope predictable. Folding dead `<NewBadge>` JSX cleanup expands the doc plan into a JSX-edit plan; not worth it.

### PERF-06 strategy (vendor chunk classification — optional)
- **D-07:** **Include + time-box to ~30 minutes inside Plan 5.** Plan 5 (bundle) runs `npm run build` with the existing analyzer, scans the vendor bundle for any large library obviously safe to split (e.g., a one-off lib >50 KB used by exactly one route). If a clean win surfaces in ≤30 min, ship it inside Plan 5. If nothing clean surfaces, ship PERF-05 only and the Plan 5 summary explicitly notes "PERF-06 reviewed: no actionable splits within 30-min time-box; deferred to future perf-gate work" — this satisfies success criterion #12's "(Optional) Vendor chunk classification reviewed; opportunistic size reduction where the change is safe."
- **D-07a:** **Why time-box rather than defer:** PERF-06 is in scope per ROADMAP.md success criterion #12 — "reviewed" is the requirement, not "delivered a size reduction." The 30-min cap captures any free wins without forcing the plan to do something marginal just to check a box.
- **D-07b:** **Phase 11 perf-gate philosophy is the guardrail.** Phase 11 established the 300 KB gz main-chunk ceiling and the principle that vendor splitting must demonstrate a measurable win, not be done for cosmetics. Any PERF-06 split must clear the same bar: analyzer-confirmed benefit, no warnings introduced, gates stay green.

### Pre-resolved (not gray areas)
- **WHAT to build:** every success criterion is precise — file paths, exact code edits (POL-03 augmentation is literally spelled out in REQUIREMENTS.md), exact CSS goal (POL-01), exact aria-label string (A11Y-09 `aria-label="Status: {Pending|Sale|Declined}"`), exact handler shape (POL-04 `mousedown` document listener + Escape, registered/unregistered while `overflowOpen`).
- **DOC-02 verbiage:** Phase 17 D-07 explicitly scoped wording-drift OUT of closure. DOC-02 is verify-only — "if missing, add the archive-header note." Do NOT rewrite CUST-01/CUST-02 itself.
- **PERF-05 approach:** success criterion locks the `manualChunks` strategy (route all `react-*` packages into `react-vendor`). Plan executor decides exact match pattern (regex vs explicit list) — both acceptable, executor's discretion.

### Claude's Discretion
- **HYG-05 exact comment text** — executor decides the one-line comment wording explaining why `image5.png` is absent. Must capture: (1) it was retired, (2) which phase retired it (grep git history), (3) why if recoverable from commit message. If the why is lost, "retired in v1.x screenshot refresh — image asset no longer in repo" is acceptable.
- **POL-03 file location** — executor picks `src/pdf/jspdf-augment.d.ts` (separate file) vs. co-located inside `generateQuotePdf.ts`. Recommendation: separate `.d.ts` file is cleaner (auto-discovered by TS, no top-of-file noise in the executable module), but co-located is fine if the augmentation stays under 10 lines.
- **PERF-06 split decisions inside the time-box** — executor decides which (if any) vendor splits to ship based on the analyzer output, gated by Phase 11's philosophy.
- **HYG-10 audit completeness** — executor decides depth of grep audit per subtask. Recommendation: spot-check 1–2 representative components for each rule (compact, InfoTooltip, dead NewBadge), then mark the related subtasks based on the pattern. Do not gate on exhaustive line-by-line audit.
- **Plan 3 commit ordering** — within Plan 3 (JobsManager hygiene + HYG-05), executor decides order of atomic commits. Suggested: HYG-05 first (one-line comment, trivial), then A11Y-09 (aria-label + Declined-pill contrast tweak), then POL-04 (outside-click handler), then HYG-04 (prop optionality), then HYG-01 (slot deletion — biggest diff, do last so the prior commits are reviewed against stable baseline).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 25 scope sources
- `.planning/ROADMAP.md` §"Phase 25" — locked goal, all 12 success criteria, plan estimate (~5 plans), wave guidance
- `.planning/REQUIREMENTS.md` — full text of each requirement (DOC-01, DOC-02, HYG-01, HYG-04, HYG-05, HYG-10, PERF-05, PERF-06, POL-01, POL-02, POL-03, POL-04, A11Y-09); POL-03 has the exact `declare module 'jspdf'` augmentation block
- `.planning/PROJECT.md` — milestone v1.3 framing (hardening-only, no new user-facing features); v1.2 SHIPPED collapsed section gives context on what landed
- `.planning/STATE.md` — current phase counter, velocity table, Phase 24 completion record

### v1.2 audit / debt sources (closure targets)
- `.planning/v1.2-CODE-AUDIT.md` — closes items #13 (POL-04), #14 (POL-03), #22 (A11Y-09)
- `.planning/v1.2-TECH-DEBT.md` — closes H1 (HYG-01), H4 (HYG-04), H5 (HYG-05), H12 (HYG-10), D6 (DOC-02), D7 (DOC-01), D10 (POL-01), D11 (POL-02), D12 (PERF-05), D13 (PERF-06)
- `.planning/milestones/v1.2-REQUIREMENTS.md` — DOC-01 target file: Traceability table rows for TAGS-01 + TAGS-04 to flip from `Pending (outstanding-pending-...)` to `Complete`; DOC-02 target: archive header CUST-01/CUST-02 wording-drift note

### Prior phase context (carried-forward conventions)
- `.planning/phases/24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryo/24-CONTEXT.md` — Phase 24 precedent: bundled-plan-with-atomic-commits pattern, `gsd-sdk query commit` helper usage, no-`--no-verify` rule. Also documents Phase 25 deferred items explicitly (POL-03, POL-04 — confirmed our scope)
- `.planning/phases/18-tauri-fs-scope-fix/18-CONTEXT.md` — atomic commit pattern (4 commits in 1 plan), Tauri/Cargo lockfile churn handling (not relevant to Phase 25 since no Tauri changes scoped)

### Affected surfaces (executor file targets)
**Doc plan (P1) targets:**
- `.planning/milestones/v1.2-REQUIREMENTS.md` — DOC-01 (Traceability table flips) + DOC-02 (archive-header verify/add)
- `.planning/todos/ui-consistency-sweep.md` — HYG-10 (audit + update in place; do NOT move to archive)
- `.planning/todos/customer-csv-template-download.md` — POL-02 marks this closed + archives it on completion (per ROADMAP success criterion #7)

**Customer-UI plan (P2) targets:**
- `src/components/CustomerLibrary.tsx` — POL-01 CSS centering for "Last used" with action buttons
- `src/components/CustomerCsvImportModal.tsx` — POL-02 template-download button
- `src/utils/csvHelpers.ts` (or equivalent) — POL-02 new `generateSampleCustomerCsv()` helper (mirrors existing `generateSampleCsv` for materials/printers — grep for the existing helper to match the shape)

**JobsManager plan (P3) targets:**
- `src/components/JobsManager.tsx` — HYG-01 (lines 772, 803, 834, 978–980, 1628, 1650, 1746 — slot deletion); HYG-04 (line 2085 — drop no-op arg); POL-04 (QuoteRow overflow menu — useEffect mousedown + Escape, gated on `overflowOpen`); A11Y-09 (QuoteStatusPill aria-label + Declined-pill contrast)
- `src/components/PrintQuoteModal.tsx` — HYG-04 (lines 36, 51, 283 — prop optional + `?.()` invocation)
- `src/components/ImageCarousel.tsx` — HYG-05 (one-line comment explaining `image5.png` absence)

**PDF plan (P4) targets:**
- `src/pdf/jspdf-augment.d.ts` — NEW file (or co-located inside `generateQuotePdf.ts` — executor's call), with the exact augmentation from REQUIREMENTS.md POL-03
- `src/pdf/generateQuotePdf.ts` — remove `(doc as any).lastAutoTable.finalY` cast; let TS see the augmented type

**Bundle plan (P5) targets:**
- `vite.config.ts` — PERF-05 `manualChunks` change (route `react-*` packages explicitly into `react-vendor`)
- `package.json` (read-only) — feeds PERF-06 vendor classification scan

### Convention refs (workflow + project standards)
- `~/CLAUDE.md` (project) — desktop release process, port pinning, `tsc -b` requirement, no `--no-verify`
- `/Users/marcusdickinson/CLAUDE.md` (global) — `tsc -b` for TS verification, atomic commits, scripts go in `scripts/`
- `.planning/codebase/STRUCTURE.md` — surface layout (where each touched file lives)
- `.planning/codebase/STACK.md` — React 18 + Vite + jspdf + jspdf-autotable + Dexie versions (relevant for POL-03 module augmentation)
- `.planning/codebase/TESTING.md` — vitest config + project test conventions (POL-04 should have a test for outside-click handler; A11Y-09 may warrant a contrast assertion if there's an a11y test harness)
- `~/.claude/get-shit-done/workflows/plan-phase.md` — defines downstream planner agent behavior

### Workflow refs
- `$HOME/.claude/get-shit-done/workflows/plan-phase.md` — planner reads CONTEXT.md to produce per-plan task breakdown
- `$HOME/.claude/get-shit-done/references/scout-codebase.md` — codebase-map selection guide (already consulted)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`generateSampleCsv()` helper** (for materials/printers — grep `src/utils/csvHelpers.ts` and `src/components/CsvImportModal.tsx` for exact location) is the template for POL-02's new `generateSampleCustomerCsv()`. Copy the shape, swap the schema for Customer fields, mirror the download-trigger UI in CustomerCsvImportModal from the existing CsvImportModal's template button (if present) or build by analogy.
- **InfoTooltip primitive** (`src/components/`) — relevant for HYG-10 audit pass (count usages, identify components still missing it per the sweep todo's section 2).
- **`<NewBadge>` component + `features.ts` registry** — relevant for HYG-10 audit's dead-JSX section. Use the registry's `NEW_FEATURE_MAX_AGE_DAYS` (14d) to detect entries that can never render again.
- **`gsd-sdk query commit` helper** — Phase 18 + Phase 24 precedent. Use for every commit in this phase, with the standard footer.
- **Phase 18 `checkpoint:human-verify` pattern** — NOT needed for Phase 25. Every item here is small enough to verify automatically; no Tauri/desktop manual UAT in scope.

### Established Patterns
- **No `--no-verify`** — every commit runs hooks. Phase 18 + 24 followed this without exception; Phase 25 follows it too.
- **`tsc -b` over `tsc --noEmit`** — TypeScript verification command. Vercel uses `tsc -b && vite build`; local verification must match. Critical for POL-03 — the module augmentation must compile cleanly under `tsc -b`.
- **Atomic commits per task** — one commit per logical change inside a plan. Plan 3 is the densest example (5 atomic commits in a single plan if executor follows D-03/Plan-3 ordering suggestion).
- **No scope creep** — Phase 24's "Deferred Ideas" section explicitly placed POL-03 + POL-04 in Phase 25. Discussion confirmed no folding-in of other v1.4+ items. The HYG-04 toast wiring is the temptation here — leave it deferred.
- **Doc-only plan parallel-safety** — Phase 24 wave 1 paralleled 4 `/gsd:validate-phase` runs on doc-only files. Phase 25 Plan 1 (DOC + HYG-10) follows the same model — pure `.planning/` edits, parallel-safe with any code plan.
- **NEW badge requirement (project memory)** — Phase 25 ships NO new user-facing features. Do NOT add `features.ts` entries or `<NewBadge>` JSX. This is hardening, not feature work.

### Integration Points
- **No cross-plan file contention** — verified by surface listing. Plan 1 touches only `.planning/**`; Plan 2 touches `CustomerLibrary.tsx` + `CustomerCsvImportModal.tsx` + `csvHelpers.ts`; Plan 3 touches `JobsManager.tsx` + `PrintQuoteModal.tsx` + `ImageCarousel.tsx`; Plan 4 touches `generateQuotePdf.ts` + new `jspdf-augment.d.ts`; Plan 5 touches `vite.config.ts`. Single wave is safe.
- **Phase 22 future collision (informational, not blocking):** if Phase 22 lands before Phase 25 (it shouldn't per dependency order, but D-00 accepts the inverted order), the JobsManager extractions may move HYG-01 / HYG-04 / POL-04 / A11Y-09 surfaces into `<RecordSaleModal>` / `<SaleRow>` / `useCustomerPicker` / extracted QuoteRow. Plan 3 executor must re-target to the extracted file in that case. Today (D-00 ordering) Phase 25 is first — Phase 22 starts from a slot-free baseline.
- **PERF-05 + PERF-06 share the same file** — `vite.config.ts manualChunks`. Plan 5 is one plan, one file, two commits (one for PERF-05's circular-chunk fix; one for PERF-06's classification result, even if the result is "no actionable split, noted in summary").
- **A11Y-09 contrast check** — Declined-pill text on `bg-slate-700` needs WCAG AA 3:1. Use a contrast-checker tool (e.g., WebAIM API or local `chroma-js` if installed) or sample with `npm run dev` + browser DevTools' contrast panel. Capture the measured ratio in the plan summary for audit traceability.
- **POL-04 test harness** — `vitest` + RTL is the existing test stack. POL-04's outside-click handler is testable with `fireEvent.mouseDown(document.body)` and `fireEvent.keyDown(window, { key: 'Escape' })` patterns common in the rest of the suite.

</code_context>

<specifics>
## Specific Ideas

- **HYG-10 audit deliverable shape** — the audit task should produce a one-line summary per subtask (e.g., `- [x] CostCalculator compact — verified at lines 412–438`) for the items confirmed done, and leave the still-open subtasks untouched with a brief `<!-- audited 2026-05-25: still open -->` HTML comment so a future reader sees the audit date without reading git blame.
- **HYG-04 future-toast comment** — when removing the no-op at `JobsManager.tsx:2085`, do NOT carry the "could trigger a toast in a future plan" comment forward into the new optional-prop site. The optional prop itself is self-documenting; the comment was load-bearing only because the prop was required. If the toast intent matters, drop it in `.planning/todos/` as `quote-created-toast.md`, not as a JSX comment.
- **POL-02 todo closure** — `.planning/todos/customer-csv-template-download.md` is marked closed AND moved to `.planning/todos/completed/` (the existing archive directory — see `ls .planning/todos/`), not deleted. Pattern matches existing completed-todo handling.
- **HYG-05 commit-history grep** — to find why `image5.png` was retired, executor should `git log --all --oneline -- public/image5.png src/assets/screenshots/image5.png` (and any other plausible paths). If the file was renamed/replaced, the comment captures the replacement: `// image5.png replaced by imageNew.png in <commit-sha> — kept as 1-5 carousel via index gap`. If purely deleted with no replacement, the comment is briefer: `// image5.png removed in <commit-sha> — carousel now skips index 5`.
- **POL-03 verification** — after adding the module augmentation, run `tsc -b` and confirm the `(doc as any)` cast removal compiles. Also run `npm run build` to confirm Vite/Rollup doesn't choke on the `.d.ts` file path (if co-located vs. separate `.d.ts`, both should work, but `tsc -b` catches subtleties early).
- **PERF-05 verification** — after the `manualChunks` change, `npm run build` must emit NO chunk-graph warnings. Capture the build log in the plan summary to prove the warning is gone (success criterion #11 explicitly requires "no chunk-graph warnings").

</specifics>

<deferred>
## Deferred Ideas

- **HYG-04 Option C — wire actual "Quote created" toast** — Needs toast primitive design first (no shared toast component exists today; would mean designing the primitive + wiring). Scope creep for hardening phase. v1.4+ candidate; add to backlog if not already there.
- **Full ui-consistency-sweep execution** — the 30+ subtasks in `.planning/todos/ui-consistency-sweep.md` are real work, not closure work. Phase 25 only audits + updates in place (D-06). Executing the sweep is its own future phase (or v1.4 polish bucket).
- **Dead `<NewBadge>` JSX cleanup as Phase 25 in-scope** — Considered (HYG-10 Option B). Rejected to keep Phase 25 scope predictable; the cleanup belongs in the future ui-consistency-sweep execution phase.
- **HYG-01 Option A — derive at parent** — Rejected (D-02a) because there's no async window where the indicator would actually fire. Reserved as escape hatch if Phase 25 user-testing surfaces a real "I didn't know my click registered" UX bug.
- **Async PDF generation flow** — If/when the PDF flow becomes async (chunked render, off-main-thread work, server-side rendering), HYG-01's deleted slot needs to come back. Not in scope today.
- **Phase 26 (UI consistency sweep follow-through)** — Considered as HYG-10 Option C. Not committed; revisit at v1.4 planning.
- **Splitting Plan 5 (PERF-05 vs PERF-06)** — Could ship as 2 plans. Bundled because both touch `vite.config.ts` exclusively and the time-box for PERF-06 may produce no-op (in which case the second commit is just the summary update).
- **Re-pin or upgrade jspdf / jspdf-autotable while we're at it** — Out of scope; POL-03 only does the type augmentation, not a dep bump. Any version churn is its own future plan.
- **Toast primitive design** — Mentioned twice (HYG-04 deferred + future toast wiring); v1.4 backlog candidate. Don't lose this — toasts are a recurring need (POL-02 might want one for "Template downloaded", future quote-created flow wants one, error states want one).

</deferred>

---

*Phase: 25-doc-hygiene-polish-bundle-health*
*Context gathered: 2026-05-25*
