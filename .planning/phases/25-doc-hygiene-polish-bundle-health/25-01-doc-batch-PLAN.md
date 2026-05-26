---
phase: 25-doc-hygiene-polish-bundle-health
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/milestones/v1.2-REQUIREMENTS.md
  - .planning/todos/ui-consistency-sweep.md
  - .planning/todos/customer-csv-template-download.md
autonomous: true
requirements: [DOC-01, DOC-02, HYG-10]
must_haves:
  truths:
    - "v1.2 milestone Traceability table reflects ground truth — TAGS-01 + TAGS-04 read Complete (not Pending) [DOC-01]"
    - "v1.2 milestone archive header documents the CUST-01/CUST-02 wording-drift scoped-out-of-closure decision [DOC-02]"
    - "ui-consistency-sweep todo file is updated in place — confirmed-shipped subtasks checked off, still-open subtasks dated; the todo file is NOT moved to .planning/archive/ (real work remains) — D-06: audit + update in place, do NOT archive [HYG-10]"
    - "customer-csv-template-download todo is moved to .planning/todos/completed/ once Plan 25-02 ships the helper + button — POL-02 downstream side effect from D-01 (5-plan surface-grouped layout: this plan owns all .planning/ edits)"
    - "D-01b atomic-commit-per-task discipline applied (Phase 18/24 precedent); no --no-verify; gsd-sdk query commit helper used for every commit"
  artifacts:
    - path: ".planning/milestones/v1.2-REQUIREMENTS.md"
      provides: "v1.2 Traceability + archive header — DOC-01 + DOC-02 closure"
      contains: "| TAGS-01 | Phase 15 | Complete |"
    - path: ".planning/todos/ui-consistency-sweep.md"
      provides: "Audited todo with accurate ground truth (HYG-10 closure)"
      contains: "audited 2026-05-25"
  key_links:
    - from: ".planning/todos/customer-csv-template-download.md"
      to: ".planning/todos/completed/"
      via: "file move (mv)"
      pattern: "completed/customer-csv-template-download\\.md"
---

<objective>
Doc-state housekeeping batch for Phase 25 — close 3 doc-debt requirements with no code changes. Phase 25 ships NO user-facing features, so this plan ships zero `features.ts` entries and zero `<NewBadge>` JSX. All edits are pure `.planning/` markdown edits, parallel-safe with Plans 25-02 through 25-05.

Purpose:
- DOC-01: flip TAGS-01 + TAGS-04 Traceability rows from `Pending (outstanding-pending-...)` to `Complete` (Phase 15 closed gap-free; only the Traceability table never caught up — Phase 17 D-07 scoped this lag out of closure, hence Phase 25 catches it now).
- DOC-02: verify (and add if missing) an archive-header note about the CUST-01/CUST-02 wording drift that Phase 17 D-07 explicitly scoped out of closure. Verify-only — do NOT rewrite CUST-01 or CUST-02 text.
- HYG-10: audit `.planning/todos/ui-consistency-sweep.md` against current code (30+ subtasks across 5 sections); check off what's shipped; mark still-open items with `<!-- audited 2026-05-25: still open -->`; do NOT move the todo to archive (real work remains per D-06).

The POL-02 todo archival (`.planning/todos/customer-csv-template-download.md` → `.planning/todos/completed/`) is a cleanup task in this plan but is NOT a requirement listed in this plan's `requirements` field (per orchestrator note, POL-02 is canonical to Plan 25-02; the archival is a downstream side effect once the feature ships).

Output: 3 doc edits committed atomically.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md
@.planning/milestones/v1.2-REQUIREMENTS.md
@.planning/todos/ui-consistency-sweep.md
@.planning/todos/customer-csv-template-download.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: DOC-01 — flip TAGS-01 + TAGS-04 Traceability rows to Complete</name>
  <files>.planning/milestones/v1.2-REQUIREMENTS.md</files>
  <read_first>
    - .planning/milestones/v1.2-REQUIREMENTS.md (locate the Traceability table rows for TAGS-01 + TAGS-04 — current text: `| TAGS-01 | Phase 15 | Pending (outstanding-pending-gap-closure) |` at line 156, `| TAGS-04 | Phase 15 | Pending (outstanding-pending-uat) |` at line 159 — confirm before editing)
    - .planning/REQUIREMENTS.md (DOC-01 full text, line 67)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (`<canonical_refs>` section — DOC-01 target file confirmed)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`Doc-Only Surfaces (P1)` table — exact action listed)
  </read_first>
  <action>
    Per D-06 + DOC-01 (REQUIREMENTS.md line 67): edit `.planning/milestones/v1.2-REQUIREMENTS.md` to flip exactly two Traceability table rows.

    Row 1 (currently around line 156):
    BEFORE: `| TAGS-01 | Phase 15 | Pending (outstanding-pending-gap-closure) |`
    AFTER:  `| TAGS-01 | Phase 15 | Complete |`

    Row 2 (currently around line 159):
    BEFORE: `| TAGS-04 | Phase 15 | Pending (outstanding-pending-uat) |`
    AFTER:  `| TAGS-04 | Phase 15 | Complete |`

    Touch ONLY those two rows. Do not edit checkbox text (lines 49 + 52 already read `[x]`). Do not edit other Traceability rows. Do not edit the archive header note in line 8 (that's preserved verbatim as DOC-02 evidence).

    Justification: Phase 15 closed gap-free 2026-05-24 (STATE.md `[v1.2 Phase 15 verification 2026-05-24]` confirms — verdict `gaps-found` was for TAGS-02/Quick-Duplicate gaps, NOT TAGS-01 or TAGS-04). The Pending status was carried in the Traceability table only and was scoped out of Phase 17 closure (Phase 17 D-07 in `.planning/milestones/v1.2-REQUIREMENTS.md` line 8). This edit catches the doc-state lag.
  </action>
  <verify>
    <automated>grep -E "^\| TAGS-0[14] \| Phase 15 \| Complete \|$" .planning/milestones/v1.2-REQUIREMENTS.md | wc -l | grep -q "^[[:space:]]*2$" && echo "DOC-01 pass: both rows Complete"</automated>
  </verify>
  <done>
    grep returns exactly 2 matching rows; `grep -E "TAGS-0[14].*Pending" .planning/milestones/v1.2-REQUIREMENTS.md` returns 0 matches; commit landed via `gsd-sdk query commit` (no `--no-verify`).
  </done>
</task>

<task type="auto">
  <name>Task 2: DOC-02 — verify (or add) archive-header CUST-01/CUST-02 wording-drift note</name>
  <files>.planning/milestones/v1.2-REQUIREMENTS.md</files>
  <read_first>
    - .planning/milestones/v1.2-REQUIREMENTS.md (read the archive-header block at the top of file — current line 8 already contains a doc-state-quirks note but verify whether it covers CUST-01/CUST-02 wording drift specifically)
    - .planning/REQUIREMENTS.md (DOC-02 full text, line 68 — "if missing, add it. (The wording itself stays — Phase 17 D-07 explicitly scoped it out of closure.)")
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (D-decisions section — DOC-02 is verify-only; do NOT rewrite CUST-01 or CUST-02)
  </read_first>
  <action>
    Per DOC-02 (REQUIREMENTS.md line 68): the archive header at line 8 of `.planning/milestones/v1.2-REQUIREMENTS.md` currently reads:
    `> Doc-state quirks preserved verbatim below: the Traceability table rows for TAGS-01 + TAGS-04 still read \`Pending (outstanding-pending-...)\` even though the requirement checkboxes show \`[x]\` and Phase 15 closed gap-free. Phase 17 D-07 explicitly scoped this doc-state lag out of closure; left as-is in the archive.`

    DOC-02 needs an explicit mention of CUST-01/CUST-02 wording drift. Verify whether the existing note covers it. If the existing line 8 covers ONLY TAGS-01/TAGS-04 (which it appears to), append a second sentence (or new bullet line under the same blockquote `>`) to the archive header that captures the CUST-01/CUST-02 wording-drift scoping:

    Suggested addition (append to existing blockquote, NEW line right after line 8):
    `>`
    `> Likewise, the CUST-01 + CUST-02 requirement wording drifted between v1.2 Phase 14 (live-UAT-LOCKED contract D-21..D-24) and the originally-authored CUST-01/CUST-02 text above — wording was not rewritten to match the shipped contract. Phase 17 D-07 scoped this wording drift out of closure; the requirements above stay as authored, and the shipped contract is documented in 14-CONTEXT.md / 14-VERIFICATION.md instead.`

    CRITICAL constraints (D-06 + REQUIREMENTS.md POL-02 lock):
    - Do NOT rewrite CUST-01 (line 36) or CUST-02 (line 37) requirement text.
    - Do NOT alter line 8 if it already references CUST-01/CUST-02 wording drift — in that case the task is verify-only and the commit is a no-op (skip to Task 3, note no-op in plan summary).
    - The addition must be inside the same `>` blockquote that contains the existing TAGS-01/TAGS-04 note so it parses as one archive-header doc-quirk block.
  </action>
  <verify>
    <automated>grep -c "CUST-01.*CUST-02.*wording\|CUST-01 + CUST-02 requirement wording" .planning/milestones/v1.2-REQUIREMENTS.md | grep -qE "^[1-9]" && echo "DOC-02 pass: archive header references CUST-01/CUST-02 wording drift"</automated>
  </verify>
  <done>
    The archive-header blockquote in `.planning/milestones/v1.2-REQUIREMENTS.md` contains explicit mention of CUST-01/CUST-02 wording drift; CUST-01 (line 36) and CUST-02 (line 37) text is unchanged; commit landed.
  </done>
</task>

<task type="auto">
  <name>Task 3: HYG-10 — audit ui-consistency-sweep todo + update in place; archive customer-csv-template todo</name>
  <files>
    .planning/todos/ui-consistency-sweep.md,
    .planning/todos/customer-csv-template-download.md
  </files>
  <read_first>
    - .planning/todos/ui-consistency-sweep.md (FULL FILE — read all 30+ subtasks across 5 sections)
    - .planning/todos/customer-csv-template-download.md (read fully — confirm Plan 25-02 surface ships the helper + button)
    - .planning/REQUIREMENTS.md (HYG-10 line 63 — "audited against current code; either marked closed + moved to .planning/archive/ OR updated to reflect remaining work")
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (D-06 + D-06a — "Audit + update in place, do NOT archive" — locked decision)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`Doc-Only Surfaces (P1)` row 3 — exact action format)
    - $HOME/.claude/projects/-Users-marcusdickinson-Projects-3DCoster/memory/MEMORY.md (NEW badge rule + `NEW_FEATURE_MAX_AGE_DAYS = 14` cap — needed for dead-NewBadge JSX detection)
    - src/features.ts (read entries — flag any past `NEW_FEATURE_MAX_AGE_DAYS = 14 days` as dead JSX candidates per HYG-10 sweep section 3)
    - src/components/CostCalculator.tsx + src/components/JobsManager.tsx + src/components/SettingsModal.tsx (spot-check 1–2 components per category per D-06 recommendation — confirm `compact` prop, `InfoTooltip`, dead `<NewBadge>` usage)
  </read_first>
  <action>
    Per D-06 (audit-in-place, NOT archive) — Two sub-actions in this single atomic commit:

    SUB-ACTION A: Audit `.planning/todos/ui-consistency-sweep.md` against current code.

    1. Read all 5 sections of the todo (compact prop rollout, InfoTooltip rollout, features.ts dead-badge cleanup, uniform-width chunks in flex-wrap layouts, PrinterSettings refresh).

    2. For EACH subtask, perform a spot-check (per D-06 + Claude's Discretion guidance — do NOT do exhaustive line-by-line audit):
       - Compact prop subtasks → grep for `compact` prop usage in the named component (e.g., `grep -n 'compact' src/components/CostCalculator.tsx`); if found in the field the subtask names, mark `- [x]` and append `<!-- audited 2026-05-25: verified at <file>:<line-range> -->`.
       - InfoTooltip subtasks → grep for `<InfoTooltip` in the named component; if the named field has one, mark `- [x]` and append the same audit note.
       - features.ts dead-JSX subtasks → read `src/features.ts`; for each entry whose `releaseDate` is older than 14 days (`NEW_FEATURE_MAX_AGE_DAYS`, today = 2026-05-25), it CANNOT render a badge anymore — those `<NewBadge feature="..." />` JSX call sites are dead. Audit but do NOT delete them in this plan (D-06b explicitly rejected cherry-picking JSX cleanup into Phase 25); just MARK the subtask `- [x]` if the feature is confirmed past-age AND the audit note says `<!-- audited 2026-05-25: dead JSX confirmed (feature past MAX_AGE), removal deferred to future ui-consistency-sweep execution phase -->`.
       - Uniform-width / PrinterSettings subtasks → these are structural; check `src/components/PrinterSettings.tsx` once for visible movement. If unchanged, leave subtask unchecked.

    3. For every subtask that REMAINS UNCHECKED after the spot-check, append on its own next line: `<!-- audited 2026-05-25: still open -->`

    4. Do NOT add new subtasks. Do NOT delete subtasks. Do NOT move the file. The todo file remains at `.planning/todos/ui-consistency-sweep.md`.

    5. Spot-check coverage rule (per D-06 Claude's Discretion): one representative grep per rule category is sufficient — do NOT block on exhaustive review. If a category's subtask says "applies to all forms" but only 2 of 5 components are spot-checked, the executor's call to mark a single subtask checked must be defensible against the spot-check evidence.

    SUB-ACTION B: Archive `.planning/todos/customer-csv-template-download.md` (per orchestrator note + 25-CONTEXT.md `<specifics>` line 171).

    Move the file from `.planning/todos/customer-csv-template-download.md` to `.planning/todos/completed/customer-csv-template-download.md` (the existing `completed/` directory is present per `ls .planning/todos/` — confirmed in pre-read).

    Use `git mv` (NOT plain `mv` — preserves git history):
    `git mv .planning/todos/customer-csv-template-download.md .planning/todos/completed/customer-csv-template-download.md`

    Note: this archival is a downstream side effect — Plan 25-02 is responsible for shipping the actual `generateSampleCustomerCsv()` helper + template-download button (POL-02). The todo CAN be archived now even if Plan 25-02 commits in parallel in the same wave because the file move is purely a planning-doc operation with no code dependency. However, IF Plan 25-02 has not yet committed at the time this task runs, archival is conditional: defer archival until after Plan 25-02 ships, then close as a follow-up commit. (In single-wave parallel mode, both plans run in parallel — the executor may sequence the archival commit AFTER Plan 25-02's POL-02 commit to be safe. Document the chosen sequencing in the plan summary.)

    SAFEST IMPLEMENTATION: archive in this task UNCONDITIONALLY — the todo describes work that, by the time Phase 25 ships, is being done in Plan 25-02. If Plan 25-02 fails for any reason, the todo can be un-archived in a follow-up.

    COMMIT THIS TASK AS ONE ATOMIC COMMIT (D-01b) covering both sub-action A and sub-action B.
  </action>
  <verify>
    <automated>test -f .planning/todos/completed/customer-csv-template-download.md && ! test -f .planning/todos/customer-csv-template-download.md && grep -c "audited 2026-05-25" .planning/todos/ui-consistency-sweep.md | grep -qE "^[1-9]" && echo "HYG-10 pass: todo audited in place; csv-template todo archived"</automated>
  </verify>
  <done>
    `.planning/todos/ui-consistency-sweep.md` contains at least one `audited 2026-05-25` marker (either `:still open -->` or `:verified at ... -->`); the customer-csv-template-download todo exists ONLY at `.planning/todos/completed/customer-csv-template-download.md`; commit landed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none | All edits in this plan touch `.planning/` markdown files only — no user input, no executable surface, no build artifacts. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25-01-01 | Tampering | `.planning/` doc edits | accept | Internal docs; no user-input or attacker-reachable surface. Audit trail preserved via git history. |
| T-25-01-02 | Information disclosure | `.planning/` doc edits | accept | All content already public in repo; no PII introduced. |
| T-25-01-SC | Tampering | npm/pip/cargo installs | mitigate | N/A — no package installs in this plan. RESEARCH.md Package Legitimacy Audit table not required (no installs). |

**ASVS Level 1** — internal doc surface, no user input. Block threshold: HIGH severity (none present).
</threat_model>

<verification>
- `grep -E "^\| TAGS-0[14] \| Phase 15 \| Complete \|$" .planning/milestones/v1.2-REQUIREMENTS.md` returns exactly 2 lines (DOC-01)
- `grep "CUST-01.*CUST-02.*wording\|CUST-01 + CUST-02 requirement wording" .planning/milestones/v1.2-REQUIREMENTS.md` returns ≥1 line in the archive-header blockquote (DOC-02)
- `grep -c "audited 2026-05-25" .planning/todos/ui-consistency-sweep.md` ≥ 1 (HYG-10 — at minimum, the still-open subtasks are dated)
- `test -f .planning/todos/completed/customer-csv-template-download.md` exits 0; `test ! -f .planning/todos/customer-csv-template-download.md` exits 0
- Per CONTEXT.md D-01b + Phase 18/24 precedent: each task is an atomic commit via `gsd-sdk query commit`; no `--no-verify` used.
- No TypeScript/build verification needed — plan touches zero `.ts`/`.tsx` files.
</verification>

<success_criteria>
- DOC-01 closed: TAGS-01 + TAGS-04 Traceability rows read `Complete` in `.planning/milestones/v1.2-REQUIREMENTS.md`
- DOC-02 closed: archive-header blockquote references CUST-01/CUST-02 wording drift; CUST-01 + CUST-02 requirement text unchanged
- HYG-10 closed: `ui-consistency-sweep.md` reflects current code ground truth; confirmed-shipped subtasks checked; still-open subtasks dated `<!-- audited 2026-05-25: still open -->`; file remains in `.planning/todos/` (NOT archived)
- `.planning/todos/customer-csv-template-download.md` archived to `.planning/todos/completed/` via `git mv` (preserves history)
- 3 atomic commits landed via `gsd-sdk query commit`, no `--no-verify`
- No `features.ts` entries added (Phase 25 ships no user-facing features)
- No `<NewBadge>` JSX added (Phase 25 ships no user-facing features)
</success_criteria>

<output>
Create `.planning/phases/25-doc-hygiene-polish-bundle-health/25-01-SUMMARY.md` on completion. The summary must capture: (1) exact rows flipped in v1.2-REQUIREMENTS.md, (2) whether the DOC-02 archive-header note was already present (no-op case) or added (insertion line number), (3) per-section count of subtasks marked checked vs. left open in ui-consistency-sweep.md, (4) confirmation the customer-csv-template-download todo was archived via git mv, (5) any deviation from the suggested grep audit depth.
</output>
</content>
</invoke>