# Phase 26: v1.3 cleanup — flip VALIDATION.md statuses, sync REQUIREMENTS.md checkboxes, customer-import modal parity — Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Pre-tag cleanup pass for the v1.3 Hardening milestone. Closes documentation-state lag and one UI polish parity item discovered by the 2026-05-28 audit refresh (verdict: `tech_debt`, no blockers). This is the LAST phase of v1.3 before `/gsd:complete-milestone v1.3` archives and tags.

**In scope (4 tracks):**
1. **VALIDATION.md status flips (Phases 18, 20, 22, 22.1)** — frontmatter fields `status`, `nyquist_compliant`, `wave_0_complete` updated to reflect verified-after-the-fact reality
2. **VALIDATION.md backfill (Phases 19, 23, 24, 25)** — create from template for the 4 missing phases; mark `nyquist_compliant: true` since all 4 phases have `status: passed` VERIFICATION.md
3. **REQUIREMENTS.md checkbox sync** — DATA-07 + PERF-08 traceability rows flipped to `[x]` / `Complete`
4. **Customer Import modal layout parity** — `CustomerCsvImportModal.tsx` template-download block moves above the upload zone with a `👥 Customer template` emoji prefix, matching the asset import modal pattern

**Out of scope (deferred):**
- Customer CSV export feature (Phase 21 SC#5 gap) — user deprioritized 2026-05-28; backlog item
- VoiceOver UAT for Phase 19 — deferred to v1.4+ per Phase 19 VERIFICATION (structural a11y complete)
- Phase 04 / Phase 09 `human_needed` VERIFICATION.md — pre-v1.3 (v1.0/v1.1 era), not a v1.3 blocker
- Phase 15 / 17 / 20 open CONTEXT.md `open_questions` — phases shipped successfully despite open questions; questions are stale planning artifacts, not blockers

</domain>

<decisions>
## Implementation Decisions

### VALIDATION.md flip semantics (D-01 through D-04)

- **D-01:** **`status` field** — flip from current value (`pending` for Phase 18, `draft` for Phases 20/22/22.1) to **`passed`**. This is the canonical "verified" value matching VERIFICATION.md vocabulary.
- **D-02:** **`nyquist_compliant` field** — flip from `false` (or absent) to **`true`** for Phase 20, 22, 22.1. Phase 18 already has `nyquist_compliant: true` — leave that one as-is, only adjust `status` + `wave_0_complete`.
- **D-03:** **`wave_0_complete` field — semantic match, flip to `true`** — Even though these phases did not formally run a Nyquist Wave 0 fail-first test suite upfront, all must-haves are verified after the fact. Flipping `wave_0_complete: true` keeps the milestone audit from re-flagging these as Nyquist-incomplete. Acknowledged historical drift: "verified retroactively" is treated as semantically equivalent to "passed Wave 0".
- **D-04:** **Validation map content** — do NOT rewrite the existing per-task validation maps in the 4 existing VALIDATION.md files. Only flip the 3 frontmatter fields. If a map row is missing evidence text, leave as-is — this phase is mechanical frontmatter editing, not full Nyquist authoring.

### VALIDATION.md backfill scope (D-05, D-06)

- **D-05:** **Backfill targets** — create `19-VALIDATION.md`, `23-VALIDATION.md`, `24-VALIDATION.md`, `25-VALIDATION.md` using the standard Nyquist template (`$HOME/.claude/get-shit-done/templates/VALIDATION.md` if available; otherwise the shape used by existing 18/20/21/22/22.1 VALIDATION.md). All four start with frontmatter `status: passed`, `nyquist_compliant: true`, `wave_0_complete: true` since their VERIFICATION.md is `passed` and the audit found no integration gaps.
- **D-06:** **Per-Task Map depth** — minimum one row per phase requirement ID pulled from VERIFICATION.md's "Observable Truths" or "Score" table. Cite the VERIFICATION evidence column verbatim. Do NOT re-execute verification work — this is backfill documentation only. The map is a thin pointer back to existing VERIFICATION.md content, not a new audit.

### REQUIREMENTS.md sync (D-07, D-08)

- **D-07:** **Checkbox flips** — DATA-07 + PERF-08 traceability rows: change leading `- [ ]` → `- [x]` AND traceability table column `Not started` → `Complete`. Cite Phase 22.1 SUMMARY.md as evidence in commit message.
- **D-08:** **Scope of REQUIREMENTS.md edits** — ONLY touch DATA-07 and PERF-08. Do not audit other rows. (REQUIREMENTS.md gets archived by `/gsd:complete-milestone v1.3` after this phase ships, so any other lag will be captured in the v1.3 archive snapshot.)

### Customer Import modal parity (D-09, D-10, D-11)

- **D-09:** **Layout reorder** — In `src/components/CustomerCsvImportModal.tsx`, move the `{/* Template download */}` block (currently rendered AFTER the upload-zone div) to render BEFORE the upload zone. Mirror the order in `src/components/CsvImportModal.tsx` (template at top, dropzone below).
- **D-10:** **Emoji prefix — `👥` (multiple people)** — Button label changes from `Customer template` to `👥 Customer template`. Rationale: CSV import is a bulk operation; 👥 reinforces multiple-customers semantic. Matches the icon weight of `📦 Materials template` / `🖨️ Printers template` in the asset modal.
- **D-11:** **No other CustomerCsvImportModal changes** — Do NOT add dedup-mode parity, do NOT redesign the upload-zone styling, do NOT add an emoji to other modal text. Layout reorder + button label only. The `CustomerCsvImportModal.test.tsx` SC#2 tests (Phase 23) may need the button-label selector updated.

### Test impact (D-12)

- **D-12:** **Test updates** — Only one test file impact expected: `src/components/CustomerCsvImportModal.test.tsx` may have a selector matching the button label `Customer template`. Update to match the new label `👥 Customer template`. All 6 SC#2 tests must still pass. `npx tsc -b` must still pass. No other test files should need changes.

### Claude's Discretion

- Plan structure (1 plan covering all 4 tracks vs 2-4 plans grouped by file type) — researcher/planner picks based on overlap. Files modified are non-overlapping across tracks, so parallel waves are possible.
- VALIDATION.md template body for backfilled phases (19, 23, 24, 25) — researcher picks the closest analog from existing VALIDATION.md files in the project. Acceptable: copy from `22.1-VALIDATION.md` as the most recent template instance.
- Exact commit message conventions per track — follow existing 3DCoster patterns (`docs(26-NN): ...`, `chore(26-NN): ...`).

### Folded Todos

- **`.planning/todos/pending/customer-import-modal-parity.md`** — Folded into D-09, D-10, D-11. Will move to `.planning/todos/completed/` when Phase 26 closes. Original problem (asset modal vs customer modal layout drift discovered during Phase 21 UAT on 2026-05-28) is exactly the scope of track 4.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth for the cleanup scope

- `.planning/v1.3-MILESTONE-AUDIT.md` — Defines the tech_debt items this phase closes. Verdict 2026-05-28: `tech_debt`, 53/53 reqs satisfied, no blockers, just doc-state lag.
- `.planning/todos/pending/customer-import-modal-parity.md` — The UI polish gap discovered during Phase 21 UAT on 2026-05-28. Defines track 4 acceptance criteria.

### Files to edit (track 1: VALIDATION.md flips)

- `.planning/phases/18-tauri-fs-scope-fix/18-VALIDATION.md` — flip `status: pending` → `passed`, `wave_0_complete: false` → `true`. Leave `nyquist_compliant: true` as-is.
- `.planning/phases/20-dexie-atomicity-audit/20-VALIDATION.md` — flip `status: draft` → `passed`, `nyquist_compliant: false` → `true`, `wave_0_complete: false` → `true`.
- `.planning/phases/22-jobsmanager-decomposition-perf/22-VALIDATION.md` — same triple flip as Phase 20.
- `.planning/phases/22.1-break-even-formula-reconciliation/22.1-VALIDATION.md` — same triple flip as Phase 20.

### Files to create (track 2: VALIDATION.md backfill)

- `.planning/phases/19-modal-primitive-a11y-migration/19-VALIDATION.md` — new file.
- `.planning/phases/23-test-coverage-hardening/23-VALIDATION.md` — new file.
- `.planning/phases/24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryo/24-VALIDATION.md` — new file.
- `.planning/phases/25-doc-hygiene-polish-bundle-health/25-VALIDATION.md` — new file.

### VERIFICATION.md files to mine for backfill content (track 2)

- `.planning/phases/19-modal-primitive-a11y-migration/19-VERIFICATION.md` — pull A11Y-01..A11Y-08 + HYG-09 observable truths.
- `.planning/phases/23-test-coverage-hardening/23-VERIFICATION.md` — pull TEST-01..TEST-06 observable truths.
- `.planning/phases/24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryo/24-VERIFICATION.md` — pull NYQ-01..NYQ-05 observable truths.
- `.planning/phases/25-doc-hygiene-polish-bundle-health/25-VERIFICATION.md` — pull POL-01..POL-04, A11Y-09, DOC-01, DOC-02, HYG-01/04/05/10, PERF-05/06 observable truths.

### Files to edit (track 3: REQUIREMENTS sync)

- `.planning/REQUIREMENTS.md` — checkbox + traceability flip for DATA-07 and PERF-08 only.

### Files to edit (track 4: Customer Import modal parity)

- `src/components/CustomerCsvImportModal.tsx` — lines ~297-315 (template-download block) move above the upload zone; button label changes.
- `src/components/CustomerCsvImportModal.test.tsx` — selector update if it matches button label literally.

### Pattern source for track 4 (read-only — DO NOT edit)

- `src/components/CsvImportModal.tsx` — lines 235-260 — the asset import modal's template-block layout that we're matching.

### Template source for track 2 (read-only)

- `$HOME/.claude/get-shit-done/templates/VALIDATION.md` (if exists) OR `.planning/phases/22.1-break-even-formula-reconciliation/22.1-VALIDATION.md` (closest in-repo analog) — structure for the 4 backfilled files.

### Project conventions

- `CLAUDE.md` (root) + `.claude/CLAUDE.md` — 3DCoster conventions (port 4173, NEW badge rules, atomic commits, scripts folder, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/CsvImportModal.tsx` (Asset import) — template-block layout pattern Phase 26 mirrors for customers; emoji-prefixed `<Button>` instances at lines 243-251
- `generateSampleCustomerCsv()` (`src/utils/csvHelpers.ts:70`) + `downloadCsv()` helpers — already wired to `CustomerCsvImportModal.tsx:305`; layout fix does NOT change their call signatures
- Existing VALIDATION.md files in Phase 20/22/22.1/18 — structural template for the 4 backfilled files

### Established Patterns
- VALIDATION.md frontmatter shape: `status` + `nyquist_compliant` + `wave_0_complete` + per-task map below — applied consistently across existing 4 VALIDATION.md files
- REQUIREMENTS.md traceability table: `| REQ-ID | Phase | Severity | Status |` — Phase 26 only touches the Status column for 2 rows
- Customer modal styling: `bg-slate-700/50 rounded-lg p-3` wrapper around the template section — match exactly when reordering

### Integration Points
- `CustomerCsvImportModal.tsx` is rendered inside `CustomerLibrary.tsx` — layout change is internal to the modal, no parent changes needed
- VALIDATION.md edits are pure-documentation — no code paths affected; `npm test` should remain 466/466 passing
- REQUIREMENTS.md edit affects only the planning artifact; will be archived by `/gsd:complete-milestone v1.3` after Phase 26 ships

</code_context>

<specifics>
## Specific Ideas

- The asset modal at `CsvImportModal.tsx:243-251` is the EXACT visual reference for track 4. Two-button row vs single-button row is fine — the structural similarity (template block above upload zone, emoji prefix, same blue underline link styling) is what matters.
- For backfilled VALIDATION.md files (track 2), the v1.3 audit body already enumerates per-phase requirement coverage. The audit IS the source of truth for "which REQ-IDs each phase satisfied" — the per-task map can cite "see v1.3-MILESTONE-AUDIT.md §requirements" as evidence rather than re-deriving.
- Phase 18's `wave_0_complete: false` is technically accurate (no Wave 0 fail-first ran) but D-03 says flip to `true` for semantic consistency with the rest of v1.3.

</specifics>

<deferred>
## Deferred Ideas

- **Customer CSV export feature** — Phase 21 SC#5 specified a UAT for customer CSV export with formula-injection protection, but the export feature was never built. User explicitly deprioritized on 2026-05-28: "I don't care if there is a customer export function right now". When it's needed, the new export must route through `sanitizeCsvCell` at the Papa.unparse boundary per Phase 21 D-02.
- **VoiceOver UAT for Phase 19** — A11Y screen-reader confirmation deferred to v1.4+. Structural a11y is complete per Phase 19 VERIFICATION.
- **Phase 04 / Phase 09 `human_needed` VERIFICATION** — pre-v1.3 carryover (v1.0/v1.1 era). Address in v1.4 retro pass if at all.
- **Phase 15 / 17 / 20 CONTEXT.md `open_questions`** — phases shipped successfully; stale planning-time artifacts, not blockers.

### Reviewed Todos (not folded)

None — only `customer-import-modal-parity.md` matched the phase scope and it was folded into D-09/D-10/D-11.

</deferred>

---

*Phase: 26-v1-3-cleanup-flip-validation-md-statuses-sync-requirements-m*
*Context gathered: 2026-05-28*
