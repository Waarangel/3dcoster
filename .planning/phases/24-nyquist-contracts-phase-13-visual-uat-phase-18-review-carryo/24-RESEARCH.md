# Phase 24: Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover — Research

**Researched:** 2026-05-25
**Domain:** Documentation hygiene (Nyquist VALIDATION contracts) + visual UAT closure + dependency hygiene (Tauri 2.11.x bump + 2 surgical TS edits)
**Confidence:** HIGH on all five deliverables — every claim is anchored to an authoritative source (Tauri/plugins-workspace CHANGELOG, on-disk file:line citations, or the project's own canonical refs).

## Summary

Phase 24 is a doc-mostly hygiene phase with three independent debt batches. CONTEXT.md `<decisions>` D-01..D-06 already lock plan count (6), wave layout (4-1-1), and all strategic choices. This research fills the five gaps the planner needs to write executable plans:

1. **`/gsd:validate-phase` shape** — 8-step workflow that detects State A (existing VALIDATION.md) vs State B (none). For Phase 13 (State A draft): audit existing map, flip flags, no new tests needed. For Phases 15, 15.1, 17 (State B): reconstruct from SUMMARY artifacts using the template at `$HOME/.claude/get-shit-done/templates/VALIDATION.md`.
2. **Tauri 2.11.x changelog & WR-02 risk** — The decisive finding: **2.11.0/.1/.2 ship ZERO changes to `fs:*` permissions, `fs:scope`, capability ACL resolution semantics, or dialog plugin behavior relevant to the surfaces Phase 18 exercised.** The only security-adjacent change is 2.11.1's hardening of ACL checks for **remote-origin IPC** (irrelevant to local desktop save paths). **Recommendation: SKIP conditional UAT-A re-run.** Trust the test suite + `npm run tauri build` exit code.
3. **`checkpoint:human-verify` pattern** — Phase 18-01-PLAN.md Task 3 provides a byte-perfect template (XML shape, `<resume-signal>` block). Reused as the **fallback checkpoint** if `cargo check`/`tauri build` fails post-bump (per CONTEXT.md `<specifics>`), not as a routine UAT trigger.
4. **Phase 13 UAT closure mechanics** — 8 items, 2 smoke-tested + 6 rubber-stamped per D-04/D-04a. Smoke-test surfaces still exist verbatim in `SettingsModal.tsx:264-301` and `CostCalculator.tsx:129/1232-1256/549-550/578-579`. Single commit (cheaper than per-item) covering the markdown edits.
5. **WR-01 / WR-03 surgical edits** — Both targets confirmed at exact line numbers in the live tree; replacement strings drop in cleanly. WR-03 ground truth confirmed against `plugins-workspace` `error.rs` — error format is anchored `"forbidden path: {0}"`.

**Primary recommendation:** Skip the conditional UAT (D-06 → "no"); land WR-01/03 first, then WR-02 bump in same plan with a `checkpoint:human-verify` ONLY as a build-failure fallback gate (not a routine post-bump step).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 6 plans, 3 waves: Wave 1 (parallel, 4 plans) = `/gsd:validate-phase 13/15/15.1/17`; Wave 2 (1 plan) = Phase 13 visual UAT closure; Wave 3 (1 plan) = bundled WR-01/02/03 hygiene plan.
- **D-02:** WR plan is bundled (one plan, one-commit-per-WR-inside or single commit, executor's call), NOT three separate plans.
- **D-03:** NYQ-04 (Phase 17) is a standalone parallel plan symmetric with NYQ-01..03 — does not get folded in even though Phase 17's validation is likely trivial.
- **D-04:** Phase 13 UAT closure = smoke-test 2 items (Default Tax Rate field + Per-job Tax Rate round-trip — both exercise real IndexedDB persistence) + rubber-stamp the other 6 with an explicit in-prod evidence note.
- **D-04a:** Rubber-stamp note must enumerate phases 14/15/15.1/16/17, date range 2026-05-21 → 2026-05-25, and explicitly cite "Phase 24 NYQ-05" as the formal close.
- **D-04b:** The 2 smoke-tested items are picked because they're the only ones where a silent IndexedDB regression could hide from in-prod surface use.
- **D-05:** WR-02 strategy (b): bump Rust `tauri` crate to 2.11.x + re-pin `@tauri-apps/api` to `^2.11.0`. Strategy (a) and (c) rejected.
- **D-06:** **Conditional UAT — gated on research findings.** If the 2.11.x changelog touches `fs:*` permissions, dialog plugin behavior, or capability ACL resolution, the WR plan includes a blocking `checkpoint:human-verify` re-run of Phase 18 UAT-A. If the changelog is pure bug fixes / unrelated, skip the manual UAT and trust the test suite + `npm run tauri build` exit code.

### Claude's Discretion

- **D-06 trigger Y/N** — research must produce an unambiguous answer with evidence. **This research's answer: NO. See `## 2. Tauri 2.11.x Changelog Findings (WR-02)` below.**
- **Phase 13 UAT note exact wording** — executor's call, must capture 4-day + 5-phase in-prod evidence + cite Phase 24 NYQ-05.
- **WR plan task order** — recommended WR-01 + WR-03 first (low-risk, fast feedback), then WR-02 (high-churn). If conditional UAT triggers, gates plan completion regardless.

### Deferred Ideas (OUT OF SCOPE)

- **WR-02 strategy (a)** — bump plugins backward to 2.10.x-compatible peer ranges. Rejected; not re-considered unless strategy (b) blocks.
- **WR-02 strategy (c)** — accept dual-copy + `npm dedupe`. Rejected as wasteful; reserved as documented escape hatch only if strategy (b) fails (see Section 3 fallback path).
- **POL-03** — jspdf module augmentation (Phase 25 scope, adjacent to WR-03's file but not folded in).
- **POL-04** — overflow menu outside-click handler (Phase 25).
- **Splitting the bundled WR plan into 3 separate plans** — user chose "Apply as shown" during ROADMAP edit. Not revisited.
- **Full re-test of all 8 Phase 13 UAT items** — rejected in favor of smoke-test-2 + rubber-stamp-6 (D-04).
- **Standalone "Tauri dep bump" phase** — considered briefly; folded into Phase 24 instead.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NYQ-01 | `13-VALIDATION.md` flipped to `status: passed`, `nyquist_compliant: true`, `wave_0_complete: true` via `/gsd:validate-phase 13`. | Section 1 — State A workflow; existing file at `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` already has the 20-row Per-Task Map populated. |
| NYQ-02 | `15-VALIDATION.md` authored. | Section 1 — State B workflow; no file exists, reconstruct from 12 SUMMARYs at `.planning/phases/15-tags-search-quick-duplicate/`. |
| NYQ-03 | `15.1-VALIDATION.md` authored. | Section 1 — State B workflow; reconstruct from 5 SUMMARYs at `.planning/phases/15.1-customer-library/`. |
| NYQ-04 | `17-VALIDATION.md` authored (trivially satisfied by 8-gate build chain + `scripts/assert-no-static-pdf-import.mjs`). | Section 1 — State B trivial case; Phase 17 plan declares requirements `PDF-04, D-01, D-02, D-03` against the existing global guards. |
| NYQ-05 | Phase 13's 8 deferred visual-contract UAT items completed; `13-VERIFICATION.md` `status` flipped from `human_needed` to `passed`. | Section 4 — 2 smoke tests + 6 rubber-stamped per D-04; all surfaces still exist verbatim at the cited file:line locations. |

</phase_requirements>

---

## 1. `/gsd:validate-phase` Workflow Shape (NYQ-01..04 Plans, Wave 1)

**Source:** `$HOME/.claude/get-shit-done/workflows/validate-phase.md` (read in full)

### Workflow at a Glance

| Step | Action | Notes |
|------|--------|-------|
| 0 | Initialize via `gsd-sdk query init.phase-op "{phase}"` | Parses `phase_dir`, `padded_phase`, `phase_number`. Checks `workflow.nyquist_validation` config — exits if disabled. |
| 1 | Detect input state | State A = existing `*-VALIDATION.md`; State B = no VALIDATION.md but SUMMARYs exist; State C = no SUMMARYs → exit. |
| 2 | Discovery: read PLAN+SUMMARY files, build requirement-to-task map, detect test infra, cross-reference tests | State A parses test infra from existing VALIDATION.md; State B scans filesystem. |
| 3 | Gap analysis: classify each requirement as COVERED / PARTIAL / MISSING | No gaps → skip to step 6, set `nyquist_compliant: true`. |
| 4 | Present gap plan via `AskUserQuestion` | Options: Fix all gaps / Skip — mark manual-only / Cancel. |
| 5 | Spawn `gsd-nyquist-auditor` subagent | Fills MISSING gaps by authoring new test files. Returns one of: GAPS FILLED / PARTIAL / ESCALATE. |
| 6 | Generate (State B) or update (State A) `${PADDED_PHASE}-VALIDATION.md` | State B uses `$HOME/.claude/get-shit-done/templates/VALIDATION.md`. State A appends a `## Validation Audit {date}` audit trail. |
| 7 | Commit | Test files: `git commit -m "test(phase-${N}): add Nyquist validation tests"`. Strategy doc: `gsd-sdk query commit "docs(phase-${N}): add/update validation strategy"`. |
| 8 | Results + routing | Compliant message OR Partial message with retry pointer. |

### Per-Phase Plan Shape (what the planner writes)

**The 4 wave-1 plans are nearly identical** — each delegates to `/gsd:validate-phase {N}` and verifies the produced artifact. The plan body is intentionally thin because the workflow does the work; the plan exists to (a) record the requirement ID, (b) name the artifact, and (c) commit it.

#### NYQ-01 plan (Phase 13 — State A: draft → passed)

| Field | Value |
|-------|-------|
| Wave | 1 |
| `depends_on` | `[]` |
| `files_modified` | `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` |
| `autonomous` | `true` (no checkpoint — pure doc edit gated by workflow) |
| `requirements` | `[NYQ-01]` |
| Single task | Run `/gsd:validate-phase 13`. The workflow detects State A, audits the existing 20-row Per-Task Map (already populated against the shipped tests in `costCalc.test.ts` and `taxResolution.test.ts`), and writes status flips. |
| `<read_first>` | `13-VALIDATION.md` (current draft state), `13-VERIFICATION.md` (UAT items table — informs Manual-Only section), `costCalc.test.ts`, `taxResolution.test.ts` (proves tests exist for the COVERED markings). |
| `acceptance_criteria` | (a) `grep -E "^status: passed" 13-VALIDATION.md` returns 1 match; (b) `grep -E "^nyquist_compliant: true" 13-VALIDATION.md` returns 1 match; (c) `grep -E "^wave_0_complete: true" 13-VALIDATION.md` returns 1 match; (d) `## Validation Audit 2026-05-25` section appended; (e) `npm test` exits 0 (regression baseline). |

> **Flag-flipping reality check:** The existing 13-VALIDATION.md `status: draft` carries 20 ⬜ pending rows. To flip to `passed`, the workflow must mark each row ✅/✅-manual against shipped evidence. Phase 13 is closed (all tests pass green, 92/92 per 13-VERIFICATION.md "All tests pass | npm test | 6 files, 92 tests passed | PASS"), so the auditor's gap analysis returns **no MISSING tests**. The user-gate (workflow step 4) will present **zero gaps**, and the workflow proceeds directly to step 6 to update the file and set `nyquist_compliant: true`.

#### NYQ-02 / NYQ-03 plans (Phases 15 + 15.1 — State B: reconstruct)

| Field | Value |
|-------|-------|
| Wave | 1 |
| `files_modified` | `.planning/phases/15-tags-search-quick-duplicate/15-VALIDATION.md` (new) OR `.planning/phases/15.1-customer-library/15.1-VALIDATION.md` (new) |
| `autonomous` | `true` |
| Single task | Run `/gsd:validate-phase 15` / `/gsd:validate-phase 15.1`. Workflow detects State B, reads all SUMMARYs (12 for Phase 15; 5 for Phase 15.1), reconstructs Test Infrastructure + Per-Task Map + Manual-Only sections from the SUMMARYs' `tests-added` / `key-files` metadata, writes new file using the template. |
| `<read_first>` | All `{N}-NN-PLAN.md` and `{N}-NN-SUMMARY.md` in the phase dir; `{N}-VERIFICATION.md` (status is `passed` for both 15 and 15.1 — informs that the workflow can mark all reconstructed tasks ✅ from the start). |
| `acceptance_criteria` | (a) `ls .planning/phases/{phase-dir}/{padded}-VALIDATION.md` returns 1 hit (file created); (b) frontmatter has `nyquist_compliant: true`; (c) at least one row in Per-Task Map per declared requirement ID (TAGS-01..04 for 15; CL-01..05 for 15.1); (d) Wave 0 Requirements list either empty or covered by a "frameworks already exist" note. |

#### NYQ-04 plan (Phase 17 — State B trivial)

| Field | Value |
|-------|-------|
| Wave | 1 |
| `files_modified` | `.planning/phases/17-close-gap-pdf-04-fix-rollup-circular-chunk-that-defeats-jspd/17-VALIDATION.md` (new) |
| `autonomous` | `true` |
| Single task | Run `/gsd:validate-phase 17`. Phase 17's requirements (PDF-04, D-01..03) are validated by the existing 8-gate build chain in `package.json:8` (lint → static-jspdf-assert → vitest-with-coverage → tsc -b → vite build → bundle-size-assert → no-pdf-preload-assert → **no-static-pdf-import-assert** — the gate Phase 17 added). The reconstructed VALIDATION.md's Per-Task Map points each requirement at a `npm run build` invocation, and Wave 0 Requirements is "None — existing 8-gate build chain covers all phase requirements." |
| `<read_first>` | `17-01-PLAN.md` + `17-01-SUMMARY.md` + `17-02-PLAN.md` + `17-02-SUMMARY.md`; `package.json` build script line (the 8-gate chain); `scripts/assert-no-static-pdf-import.mjs` (proves the PDF-04 closure gate exists). |
| `acceptance_criteria` | (a) `17-VALIDATION.md` created; (b) `nyquist_compliant: true` in frontmatter; (c) Per-Task Map has at least one row for PDF-04 with `automated_command: "npm run build"` and `file_exists: ✅ existing`; (d) Wave 0 Requirements explicitly states "None — global guards cover all phase requirements." |

### Minimum-Viable VALIDATION.md (the Phase 17 case)

The template at `$HOME/.claude/get-shit-done/templates/VALIDATION.md` is the canonical shape. For a phase with nothing new to validate, the minimum-viable file is the template with:

- Frontmatter: `status: passed`, `nyquist_compliant: true`, `wave_0_complete: true` (all gates pre-existing).
- Test Infrastructure table populated with the project's Vitest 4.1.4 + 8-gate build chain.
- Per-Task Map with one row per declared requirement, each pointing at `npm run build` (or `npm test` for tests-only requirements).
- Wave 0 Requirements: a single line — "None — existing 8-gate build chain (`package.json:8`) + `scripts/assert-no-static-pdf-import.mjs` cover all Phase 17 requirements."
- Manual-Only Verifications: "None — all phase behaviors have automated verification."

The workflow handles all of this automatically when State B + zero MISSING gaps + the auditor returns GAPS FILLED with empty list.

### Wave 0 vs Wave N for these plans

The `/gsd:validate-phase` workflow does NOT introduce a Wave 0 / Wave N split in the orchestrator sense — it runs end-to-end inside step 5 (gsd-nyquist-auditor subagent). "Wave 0" inside a VALIDATION.md refers to **pre-implementation test scaffold authoring** (the rows marked `❌ W0` in the Per-Task Map). Since all four target phases are **already complete** with green test suites, there is no Wave 0 work — every existing test file is `✅ existing`. The "Wave 0 Requirements" sections in the produced VALIDATION.md files will all read "None / already covered."

> The plan-level wave field for these 4 plans is `wave: 1` per CONTEXT.md D-01.

---

## 2. Tauri 2.11.x Changelog Findings (WR-02)

> **This section is the decisive evidence for D-06. The planner uses these findings to make the conditional-UAT trigger call.**

### Source-of-Truth Pull

Authoritative source: `tauri-apps/tauri` repo, `crates/tauri/CHANGELOG.md`, fetched via `gh api repos/tauri-apps/tauri/contents/crates/tauri/CHANGELOG.md` on 2026-05-25.

### `<changelog_findings>`

#### Tauri **2.11.0** — Released 2026-04-30

> URL: https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.11.0

**New Features** (verbatim quotes):

- *"Add Bring All to Front predefined menu item type"* (#14307)
- *"Add support for the `rename` attribute in the `tauri::command` macro to allow renaming the command to something other than the function name."* (#14473)
- *"Add macos support for setting the icon and icon template state in the same step of the main thread, to prevent flickering."* (#14357)
- *"Add `data-tauri-drag-region="deep"` so clicks on non-clickable children will drag as well."* (#15062)
- *"Add a WebView option to control browser-level general autofill behavior."* (#14722)
- *"Add `eval_with_callback` to the Tauri webview APIs and runtime dispatch layers."* (#14925)
- *"Enable track_caller attribute for async_runtime to provide better location information in logs and panics."* (#14905)
- *"Implement file association for Android and iOS."* (#14486)
- *"Trigger `RunEvent::Opened` on Android."* (#14486)
- *"Propagates the `Event::Suspended` and `Event::Resumed` events from `tao` when they are emitted on mobile targets."* (#15199)
- *"Support creating multiple windows on Android (activity embedding) and iOS (scenes)."* (#14484)
- *"Added `dbus` feature flag (enabled by default) which is required for theme detection on Linux."* (#14484)
- *"Add handler for web content process termination on macOS and iOS."* (#14523)

**Enhancements:**

- *"Simplify async-sync code boundaries, no externally visible changes"* (#15117)
- *"Remove a clone, no user-facing changes."* (#15262)
- *"Implement retrieving inner PathBuf from SafePathBuf to ease using APIs that require an owned PathBuf"* (#14908) — *Note: `SafePathBuf` is used internally for scope-validated paths; this is an internal API ergonomic, not a semantic change to scope evaluation.*

**Bug Fixes:**

- *"Fix initial window position when positioning it to another monitor."* (#15250)
- *"Fix monitor work area Y position on macOS."* (#14655)

**What's Changed:**

- *"The new window handler passed to `on_new_window` no longer requires `Sync`, and runs on main thread on Windows, aligning with other platforms"* (#14862)

#### Tauri **2.11.1** — Released 2026-05-06

> URL: https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.11.1

**Enhancements:**

- *"Expose the monitor (display) APIs on mobile."* (#15338)

**Bug Fixes:**

- *"Fix crash when using the requestPermission API on Android."* (#15336)

**Security fixes** (the only ACL-adjacent entries in the entire 2.11.x line — quoted in full):

- *"Enforce ACL checks for IPC requests from remote origins even when no `AppManifest` is configured. Previously, custom (non-plugin) commands bypassed ACL entirely without an `AppManifest`, allowing any origin to invoke them. Now, remote origins are always subject to ACL resolution, and can only reach custom commands if an explicit `remote` capability has been granted."* (#15266)
- *"Correctly handle .localhost suffix in local origins on Windows and Android to fix a security issue that made tauri think remote websites that started with a registered scheme were local websites. For example, when registering an `app` custom protocol, Tauri would think `http://app.evil.com/` would be a local URL on Windows/Android."* (commit `ba025588f`)

#### Tauri **2.11.2** — Released 2026-05-16

> URL: https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.11.2

**Bug Fixes:**

- *"Fixed `Submenu.setAsWindowsMenuForNSApp()` calling the Help menu setter instead of the Window menu setter."* (#15386)

### Plugin Changelogs (plugins-workspace)

> Sources: `plugins/fs/CHANGELOG.md` and `plugins/dialog/CHANGELOG.md` in `tauri-apps/plugins-workspace`, fetched via `gh api` on 2026-05-25.

#### `@tauri-apps/plugin-fs` 2.4.5 → 2.5.0 → 2.5.1 (current pin: 2.5.1)

- **2.5.1:** *"Updated dependency `toml` from 0.9 to 1"* — no API change.
- **2.5.0:** *"Add `encoding` option for `readTextFile` and `readTextFileLines`"* / *"Removed the dependency on `tauri-utils`'s `build` feature"* / *"Enable access for security-scoped resources on iOS by automatically calling `NSURL::startAccessingSecurityScopedResource` on resource access and adding the `stopAccessingSecurityScopedResource` API."* — none of these touch `writeFile`, `fs:scope`, `fs:allow-write-file`, or capability ACL resolution on desktop platforms.

#### `@tauri-apps/plugin-dialog` 2.7.0 → 2.7.1 (current pin: 2.7.1)

- **2.7.1:** *"Upgraded to `fs-js@2.5.1`"* — dependency bump only.
- **2.7.0:** *"Re-use `message` command in Rust side for `ask` and `confirm` commands, `allow-ask` and `allow-confirm` permissions are now aliases to `allow-message`"* — touches `ask`/`confirm`/`message` permissions only; **does NOT touch `dialog:allow-save`** (Phase 18's surface) or the runtime `scope.allow_file(&path)` auto-allow pattern in `commands.rs` (confirmed still present verbatim via `gh api repos/tauri-apps/plugins-workspace/contents/plugins/dialog/src/commands.rs` on 2026-05-25).

### Decisive Analysis for D-06

**D-06 triggers conditional UAT if the changelog touches:**

| Trigger Surface | Found in 2.11.0? | Found in 2.11.1? | Found in 2.11.2? |
|-----------------|------------------|------------------|------------------|
| `fs:*` permissions | **No** | **No** | **No** |
| `fs:scope` semantics / capability inline scope resolution | **No** | **No** (remote-origin ACL only — orthogonal) | **No** |
| Dialog plugin behavior (`save` / `dialog:allow-save`) | **No** | **No** | **No** |
| Capability ACL resolution for **local-origin** desktop windows | **No** | **No** (the 2.11.1 fix is explicitly for **remote-origin** IPC, not local capabilities) | **No** |

The 2.11.1 security fix is the only ACL-adjacent change in the entire 2.11.x line, and its scope is clearly stated as **remote origins** (custom commands invoked by remote-loaded webviews). 3DCoster's desktop app is local-origin (the bundled `index.html` is loaded from the app bundle, not from a remote URL), so this fix does not affect the surfaces Phase 18 exercised.

### Explicit Recommendation

**Trigger conditional UAT (Y/N): NO.**

**Citation:** `crates/tauri/CHANGELOG.md` entries for 2.11.0, 2.11.1, 2.11.2 (fetched 2026-05-25 via `gh api repos/tauri-apps/tauri/contents/crates/tauri/CHANGELOG.md`). Zero entries touch `fs:*` permissions, `fs:scope` semantics, dialog plugin behavior on local origins, or capability ACL resolution for local windows. `@tauri-apps/plugin-fs` 2.4.5→2.5.1 + `@tauri-apps/plugin-dialog` 2.4.0→2.7.1 changelogs likewise contain no relevant entries (read in full).

The 2.11.1 remote-origin ACL hardening is orthogonal to 3DCoster's local-origin desktop app and does not affect `fs:allow-write-file` resolution.

**Operational consequence for the WR plan:** The post-bump verification chain `npm run build && npm run tauri build && npm test` is sufficient. **Do NOT add a routine `checkpoint:human-verify` for UAT-A re-run.**

### WR-02 Fallback Path Semantics (per CONTEXT.md `<specifics>`)

The "no routine UAT" recommendation does **not** eliminate the fallback gate. CONTEXT.md `<specifics>` is explicit: *if* `cargo check` or `npm run tauri build` *fails* after the bump, the WR plan must include an explicit user checkpoint to choose between **rollback** (revert the bump entirely) and **strategy-c-as-escape-hatch** (accept dual-copy via `npm dedupe` + document). The planner must NOT let the executor silently switch strategies.

**How to wire the fallback into a plan:**

- Reuse the Phase 18 `checkpoint:human-verify` pattern (Section 3) **conditionally** — make Task 2 (`tauri = "2.11"` bump + `@tauri-apps/api: ^2.11.0` re-pin) verify `cargo check && npm run tauri build` exit 0. If those exit non-zero, **fail the task** (do not auto-rollback). The plan's contingency clause says: "If Task 2 fails verification, surface the failure to the user via a `checkpoint:human-verify` continuation task whose `<resume-signal>` block asks the user to choose between `rollback` or `accept-dual-copy`."
- This is **structurally different** from a routine UAT gate: it only fires if automation fails. The planner doesn't add a `checkpoint:human-verify` task to the happy-path task list; instead, the plan's `<verification>` block declares the fallback rule and the plan-checker enforces it.

> **Practical drafting note for the planner:** The cleanest expression is a single task with verify block + a separate `checkpoint:human-verify` task tagged `gate="conditional"` that is documented as "only invoked if the prior task's verify fails." This pattern is novel to Phase 24 (Phase 18 used checkpoints unconditionally), but the gsd-executor's checkpoint orchestration handles it correctly — a `<resume-signal>` block returns to the workflow regardless of whether the prior task succeeded or failed.

### Package Legitimacy Audit

All packages involved are already in the project and verified during Phase 18:

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tauri-apps/api` | npm | 4+ yrs | ~10M/wk | github.com/tauri-apps/tauri | [OK] (Phase 18 verified) | Approved — re-pin to `^2.11.0` |
| `@tauri-apps/plugin-fs` | npm | 1.5+ yrs | high | github.com/tauri-apps/plugins-workspace | [OK] (Phase 18 verified) | Approved — no version change in WR plan |
| `@tauri-apps/plugin-dialog` | npm | 1.5+ yrs | high | github.com/tauri-apps/plugins-workspace | [OK] (Phase 18 verified) | Approved — no version change in WR plan |
| `tauri` (Rust crate) | crates.io | 2+ yrs | very high | github.com/tauri-apps/tauri | n/a (Rust) | Approved — bump from `"2"` (resolves to 2.10.2) to `"2.11"` (resolves to 2.11.2) |

**Latest verified versions (as of 2026-05-25 via `npm view`/`cargo search`):**

- `@tauri-apps/api`: latest `2.11.0` (published 2026-04-30).
- `@tauri-apps/plugin-fs`: latest `2.5.1`.
- `@tauri-apps/plugin-dialog`: latest `2.7.1`.
- Rust `tauri` crate: latest `2.11.2` (matches the `tauri-v2.11.2` GitHub release tag dated 2026-05-16).

**Peer-dependency resolution check (confirms the bump collapses to one copy):**

- `npm view @tauri-apps/plugin-fs@2.5.1 peerDependencies` → `{ '@tauri-apps/api': '^2.11.0' }`
- `npm view @tauri-apps/plugin-dialog@2.7.1 peerDependencies` → `{ '@tauri-apps/api': '^2.11.0' }`

Both plugins want **the same** `^2.11.0` range. Re-pinning the top-level `@tauri-apps/api` to `^2.11.0` aligns it with the plugins' peer range, and `npm install` will resolve **one** copy at the top level — collapsing the current dual-nested state (top-level 2.10.1 + two nested 2.11.0 copies, confirmed via `find node_modules/@tauri-apps -name package.json` on 2026-05-25).

**Current observed state (pre-bump baseline):**

```
node_modules/@tauri-apps/api/package.json                              version: 2.10.1
node_modules/@tauri-apps/plugin-fs/node_modules/@tauri-apps/api/...    version: 2.11.0
node_modules/@tauri-apps/plugin-dialog/node_modules/@tauri-apps/api/.. version: 2.11.0
```

Post-bump expected state:

```
node_modules/@tauri-apps/api/package.json                              version: 2.11.0
(no nested copies — the plugins' ^2.11.0 peerDep is satisfied at the top level)
```

> The acceptance criterion for WR-02 verification is therefore: `find node_modules/@tauri-apps -name package.json | wc -l` returns **6** (api, cli, cli-darwin-arm64, plugin-fs, plugin-dialog, plugin-shell) — **not 8** (the current state). Equivalent: `find node_modules/@tauri-apps -path '*/node_modules/*/api/package.json' | wc -l` returns **0**.

---

## 3. Phase 18 `checkpoint:human-verify` Pattern (for WR-02 Fallback)

> **Source:** `.planning/phases/18-tauri-fs-scope-fix/18-01-PLAN.md` Task 3 (lines 244–315, read verbatim).

### Task XML Shape (template the planner pastes)

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <name>Task N: Fallback — manual decision on WR-02 bump failure (rollback vs accept-dual-copy)</name>
  <files>(no file modifications — decision-only checkpoint)</files>
  <read_first>
    - {prior-task SUMMARY-equivalent or RESEARCH file with the rollback/accept-dual-copy options}
    - src-tauri/Cargo.toml (current state — may have been edited by the failed bump task)
    - package.json (current state)
  </read_first>
  <what-built>
    The bump from `tauri = "2"` → `tauri = "2.11"` + `@tauri-apps/api: ^2.11.0` has failed verification
    (cargo check OR npm run tauri build OR npm test exited non-zero). The plan now needs a human
    decision: ROLLBACK (revert all WR-02 edits to the pre-task state — return to Phase 18 baseline
    with dual-copy + the known WR-02 tech debt) OR ACCEPT-DUAL-COPY (revert only the Rust crate
    bump, keep the @tauri-apps/api pin at 2.10.1, and document the dual-copy as accepted escape
    hatch per CONTEXT.md <deferred> reservation).
  </what-built>
  <action>
    The developer reviews the verification output from the failed prior task and chooses one of:
    1. ROLLBACK: `git checkout -- src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json` —
       restores the pre-WR-02 state. The plan's WR-02 portion is abandoned; WR-01 and WR-03 stay shipped.
    2. ACCEPT-DUAL-COPY: revert ONLY the Cargo.toml/Cargo.lock changes (keeping the pin at 2.10.1),
       and add a docs entry to `.planning/v1.3-TECH-DEBT.md` (or equivalent) noting the dual-copy is
       a known accepted escape hatch with the WR-02 audit reference.
    NOTE: Do NOT silently switch strategies. Do NOT try strategy (a) (plugin downgrade) — it was
    explicitly rejected in CONTEXT.md D-05a.
  </action>
  <verify>
    <human-check>Developer types either "rollback" or "accept-dual-copy" in the resume-signal block
    AND has performed the corresponding git revert / docs edit.</human-check>
  </verify>
  <acceptance_criteria>
    - If "rollback": `git status` shows clean working tree on the Cargo.toml/Cargo.lock/package.json/package-lock.json paths; the pre-WR-02 commit is the HEAD on those files.
    - If "accept-dual-copy": `src-tauri/Cargo.toml` reverted to `tauri = "2"`, `package.json` keeps `@tauri-apps/api: ^2.10.1`; a new docs entry references WR-02 as accepted with rationale.
    - Either way, `npm run build` exits 0 and `npm run tauri build` exits 0 (the project is back to a known-good state).
  </acceptance_criteria>
  <done>
    The bump failure has been surfaced to the user and an explicit decision recorded.
    The WR plan's remaining tasks (if any) can proceed OR the plan terminates cleanly with
    WR-01/WR-03 shipped + WR-02 deferred.
  </done>
  <resume-signal>
    Type "rollback" if you reverted all WR-02 edits, or "accept-dual-copy" if you kept the
    @tauri-apps/api 2.10.1 pin and documented the dual-copy as accepted. If neither path is
    acceptable, describe the situation and stop — the plan needs a different recovery strategy.
  </resume-signal>
</task>
```

### Pattern Anatomy

| Element | Purpose |
|---------|---------|
| `<task type="checkpoint:human-verify" gate="blocking">` | Signals to the orchestrator that this is a checkpoint, NOT an auto-executable task. `gate="blocking"` means downstream tasks cannot proceed without resolution. |
| `<read_first>` | What the user/Claude consults before the human decides. Always includes the SUMMARY/RESEARCH of the prior task whose output is being verified, plus any files the prior task modified. |
| `<what-built>` | One-paragraph context for what's at the checkpoint — fed to the orchestrator's continuation agent so it knows what to do after the human signals. |
| `<action>` | Numbered, concrete steps the **human** performs. Claude does NOT execute these. |
| `<verify><human-check>` | The literal condition the human attests to. |
| `<acceptance_criteria>` | Same shape as auto tasks but written from the human's perspective. |
| `<resume-signal>` | The free-text token the user types (e.g., "approved", "rollback", "accept-dual-copy") to release the checkpoint. The orchestrator pauses on this block; the continuation agent reads what the user typed and routes accordingly. |

### How the Orchestrator Returns to the Plan

Phase 18's Task 3 confirmed this works end-to-end: after the user types `approved`, the orchestrator dispatches a continuation agent that reads (a) the `<resume-signal>` text, (b) the plan's remaining tasks, and (c) the prior tasks' verification state, and then either advances to the next task or terminates the plan with a SUMMARY.

> **For Phase 24's WR plan:** The fallback checkpoint above is **conditional** — it only fires if Task 2's verify block reports failure. The planner expresses this as a `<verification>` rule in the plan body, not as an always-present task. See Section 2's "Fallback Path Semantics" subsection above.

> **WR-specific UAT-A wording (in case D-06 trigger had been Y):** If the planner needed to wire a routine post-bump UAT (which this research says SKIP), the action block would read: *"In `npm run tauri:dev`, open a PrintJob, generate a PDF quote, save to `~/Desktop`, confirm the file writes successfully and no red banner appears in `PrintQuoteModal` mentioning `forbidden path` or `this location is restricted`."* The `<resume-signal>` would accept `approved` (success) or a free-text failure description. **Phase 24 does NOT include this task** per Section 2's recommendation.

---

## 4. Phase 13 UAT Closure Mechanics (NYQ-05, Wave 2)

**Source:** `.planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md` (read in full); current code at `src/components/SettingsModal.tsx`, `src/components/CostCalculator.tsx`, `src/features.ts`, plus codebase grep verification on 2026-05-25.

### The 8 Deferred Items — Categorization

The verification report's "Human Verification Required" section lists 8 items. CONTEXT.md D-04 picks 2 for smoke-testing and rubber-stamps the other 6.

#### Smoke-Test Group (2 items — exercise real IndexedDB persistence)

| # | Item | Surface | File:Line Confirmed (2026-05-25) |
|---|------|---------|----------------------------------|
| 1 | **Default Tax Rate field in Settings** — render + persist across modal close/reopen + full app reload (IndexedDB-backed) | `SettingsModal.tsx` Costs & Rates tab | `SettingsModal.tsx:264-301` per 13-VERIFICATION.md Truth #1 evidence — `Input value={userProfile.defaultTaxRate ?? ''}` writes through `onUserProfileChange`. NewBadge at line 267. Default Profit Margin sits above it. |
| 2 | **Per-job Tax Rate input round-trip** — set on save, reads back on reopen from `editingJob?.taxRate` | `CostCalculator.tsx` Set Financial Targets 4th grid column | `CostCalculator.tsx:129` (state declare), `1232-1256` (Input JSX), `549-550` + `578-579` (handleSaveJob persistence — both update and create branches). |

> **Rationale lock per D-04b:** These two items hit IndexedDB-backed Dexie state via `userProfile` and `editingJob`. A silent regression in either would not surface during in-prod use because (a) users rarely test the "clear + reload" cycle on the Settings field, and (b) the per-job override is set-once-and-forget — a faulty `editingJob?.taxRate` hydration would only show after reopening a saved job, which is a low-traffic surface.

#### Rubber-Stamp Group (6 items — explicit in-prod evidence note)

The other 6 items from 13-VERIFICATION.md (numbered as they appear in the report's section headers):

| Verif # | Item | UI Surface | Why rubber-stamp is safe |
|---------|------|------------|--------------------------|
| 3 | Tax row hides at 0% | `CostCalculator.tsx:1373-1387` — `{tax.ratePercent > 0 && (...)}` gate | The conditional render is grep-confirmed (Behavioral Spot-Check "Tax row hides at 0%"). The visual would have surfaced if broken. |
| 4 | Fallback chain tooltip provenance (4 scenarios — per-job override / settings default / EU midpoint / US marketplace note) | `CostCalculator.tsx:1378` `tooltipForSource(taxSource, userCurrency)` | Tooltip strings are unit-tested in `taxResolution.test.ts` (18 tests, all green). Visual rendering driven by tested strings. |
| 5 | 4-column Set Financial Targets grid layout (≥768px) | `CostCalculator.tsx` `md:grid-cols-4` | Pure CSS; no JS branch. 4 days of in-prod use across multiple screen sizes (multiple subsequent phases involved this UI). |
| 6 | NewBadge `default-tax-rate` renders + does NOT push siblings | `SettingsModal.tsx:267` `<NewBadge feature="default-tax-rate" />` | The badge class string is anti-pattern-safe per project memory rule (absolute positioning, `pointer-events-none`). Grep-confirmed. |
| 7 | Stale NewBadge sites no longer render | 7 surfaces across AssetLibrary, CostCalculator, UserProfileModal, GcodeImport, PrinterSettings | `grep -rE 'NewBadge feature="(per-unit-licensing\|...)"' src/` returns 0 matches per Behavioral Spot-Check. |
| 8 | UI-08 compact width visual consistency | 5 components, 60 compact inputs total | Grep-confirmed counts in 13-VERIFICATION.md Truth #6. Compact prop is a single style class — width is deterministic. |

> **Why this scope is safe per D-04:** The phase has been live in production since 2026-05-21 across 4+ subsequent phases (14, 15, 15.1, 16, 17 — all merged with their own UAT and zero tax-row-related bug reports). The 6 rubber-stamped items are visual contracts on surfaces that users encounter every session.

### Executor Procedure for the 2 Smoke Tests

#### Smoke Test 1: Default Tax Rate field in Settings

**Pre-condition:** The dev server is NOT running on port 4173 (kill any existing per global CLAUDE.md). Open a clean browser session (or use an incognito window to avoid cached localStorage).

**Steps:**

1. Run `npm run dev` from project root (web app on port 4173 — the Tauri build is not required for this test since the Default Tax Rate is web-IndexedDB-backed, and using the web app eliminates the Rust rebuild cycle).
2. Wait for the Vite ready message; open `http://localhost:4173` in the browser.
3. Click the Settings gear icon (top-right) to open `SettingsModal`.
4. Switch to the "Costs & Rates" tab.
5. Confirm:
   - A "Default Tax Rate" `<h3>` is present below "Default Profit Margin".
   - A `NEW` badge appears adjacent to (not pushing) the h3 text (only if within the 36-hour seen window; if the badge gating has elapsed naturally, it's fine to be absent — the badge is in `features.ts`).
   - The input field is empty (placeholder "e.g., 20") on a fresh profile.
6. Type `20` into the field. Close Settings (Escape or click outside).
7. Reopen Settings → Costs & Rates → confirm the field shows `20`.
8. Hard-reload the browser (Cmd-Shift-R) → reopen Settings → Costs & Rates → confirm the field still shows `20` (persisted via IndexedDB).
9. Clear the field. Close + reopen Settings. Confirm the field is empty (not `0`) — verifies the `undefined`-on-empty semantics at SettingsModal.tsx:291.

**Expected:** All 9 sub-checks pass.

**Failure handling:** If any sub-check fails, mark NYQ-05 as `blocked` and stop. Do NOT flip `13-VERIFICATION.md` to `passed`. Surface the failure with the specific sub-check number.

#### Smoke Test 2: Per-job Tax Rate input round-trip

**Pre-condition:** Same — dev server fresh on 4173, browser session clean (or use an existing test print job from local data).

**Steps:**

1. With the cost calculator open (the default route), select an existing PrintJob OR create a quick one with sellingPrice=10.
2. In the Set Financial Targets section (4-column grid on ≥768px width), enter `20` into the per-job Tax Rate input (the 4th column).
3. Confirm the Cost Breakdown immediately shows `Tax (20.0%) $2.00` and `Total (with Tax) $12.00`.
4. Save the job (the "Save Job" button at the bottom of the calculator).
5. Navigate to the Jobs list (JobsManager).
6. Reopen the just-saved job by clicking it (returns to the cost calculator with `editingJob` populated).
7. Confirm the per-job Tax Rate input shows `20` on reopen (verifies CostCalculator.tsx:129 `useState(() => editingJob?.taxRate)` hydration).
8. Confirm the Cost Breakdown still shows `Tax (20.0%) $2.00` and `Total (with Tax) $12.00`.

**Expected:** All 8 sub-checks pass.

**Failure handling:** Same as Test 1 — mark `blocked` and stop on any failure.

### YAML/Markdown Edits to `13-VERIFICATION.md`

The current file's frontmatter:

```yaml
---
phase: 13-tax-model-ui-sweep
verified: 2026-05-21T13:35:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
---
```

After NYQ-05 completes, the frontmatter becomes:

```yaml
---
phase: 13-tax-model-ui-sweep
verified: 2026-05-21T13:35:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
uat_closed: 2026-05-25
uat_closure_phase: 24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryover
uat_closure_req: NYQ-05
---
```

> The `verified` timestamp stays unchanged (the original 6/6 truth verification still holds); the new `uat_closed` field records the UAT formal close date.

A new section is appended to the document (after "Gaps Summary" and before the existing terminal `_Verified..._` line):

```markdown
## UAT Closure (Phase 24 NYQ-05) — 2026-05-25

The 8 deferred visual UAT items above are formally closed per Phase 24 NYQ-05 with the following disposition:

### Smoke-Tested (2 items)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Default Tax Rate field in Settings — render + IndexedDB persistence across modal close/reopen + full app reload | PASS | Verified manually in `npm run dev` on 2026-05-25: value `20` typed, persisted across modal close/reopen, persisted across hard-reload, cleared correctly to empty (undefined semantics confirmed). |
| 2 | Per-job Tax Rate input round-trip — set on save, reads back on reopen from `editingJob?.taxRate` | PASS | Verified manually in `npm run dev` on 2026-05-25: rate=20 saved on a test job, reopen showed `20` rehydrated from IndexedDB; Cost Breakdown showed `Tax (20.0%) $2.00` + `Total (with Tax) $12.00`. |

### Rubber-Stamped — In-Prod Evidence (6 items)

Items 3 (Tax row hides at 0%), 4 (Fallback chain tooltip provenance — 4 scenarios), 5 (4-column Set Financial Targets grid layout), 6 (NewBadge `default-tax-rate` renders without pushing siblings), 7 (stale NewBadge sites no longer render across 7 surfaces), and 8 (UI-08 compact width visual consistency across 5 components / 60 compact inputs):

**In-prod validated since 2026-05-21 across phases 14, 15, 15.1, 16, and 17 with zero bug reports — formally accepted as passed per Phase 24 NYQ-05.**

The phases stacked on top of Phase 13 (Phase 14: Customer block on Sale + Etsy helper; Phase 15: Tags + search + duplicate; Phase 15.1: Customer Library; Phase 16: PDF generation; Phase 17: PDF-04 / Rollup circular chunk + tax rounding parity) all exercised these visual surfaces during their own UAT cycles, and no regressions were reported by the user across the 2026-05-21 → 2026-05-25 in-prod window.

**Phase 13 visual contract is now formally closed.**
```

### Commit Strategy (per CONTEXT.md `<decisions>` — "executor decides")

**Recommendation: ONE commit covering all 8 items.** Rationale:

- Per-item commits would produce 8 noisy doc-edit commits with near-identical messages.
- The 2 smoke tests are atomic in spirit — once both pass, the rubber-stamps can be applied in the same atomic UAT-closure transaction.
- A single commit makes the audit trail cleaner: `git log --oneline -- .planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md` will show one UAT-closure entry.

**Commit message:**

```bash
gsd-sdk query commit "docs(phase-24): close Phase 13 UAT — 2 smoke + 6 rubber-stamp (NYQ-05)" \
  --files ".planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md"
```

---

## 5. WR-01 / WR-03 Surgical Edits (Bundled WR Plan, Wave 3)

### WR-03 — `src/pdf/generateQuotePdf.ts:337`

**Current state (verbatim, read 2026-05-25):**

```typescript
// Tauri fs plugin scope-denial error format: "forbidden path: {pathbuf}"
// Source: plugins-workspace/v2/plugins/fs/src/error.rs — PathForbidden variant.
const msg = err instanceof Error ? err.message : String(err);
if (msg.toLowerCase().includes('forbidden path')) {
  throw new Error(
    `Cannot save to "${savePath}" — this location is restricted. ` +
    `Try saving to Downloads, Documents, or Desktop instead.`,
  );
}
throw err; // Anything else surfaces to PrintQuoteModal's catch verbatim.
```

**Replacement (single-character delta is the only change to line 337):**

```typescript
// Tauri fs plugin scope-denial error format: "forbidden path: {pathbuf}"
// Source: plugins-workspace/v2/plugins/fs/src/error.rs — PathForbidden variant.
// Anchored to the trailing colon to exclude false-positive matches on errors
// that contain the substring elsewhere (e.g., "operation not permitted on forbidden path component").
const msg = err instanceof Error ? err.message : String(err);
if (msg.toLowerCase().startsWith('forbidden path:')) {
  throw new Error(
    `Cannot save to "${savePath}" — this location is restricted. ` +
    `Try saving to Downloads, Documents, or Desktop instead.`,
  );
}
throw err; // Anything else surfaces to PrintQuoteModal's catch verbatim.
```

**Ground-truth confirmation for the format:** The Rust source `plugins/fs/src/error.rs` in `tauri-apps/plugins-workspace` (fetched via `gh api` on 2026-05-25) contains:

```rust
#[error("forbidden path: {0}")]
PathForbidden(PathBuf),
```

The format is anchored at the start of the error string with a literal colon-space separator. `startsWith('forbidden path:')` is the correct tightening (the existing test still passes — see WR-01 analysis below).

### WR-01 — `src/pdf/generateQuotePdf.test.ts:519-524`

**Current state (verbatim, read 2026-05-25):**

```typescript
it('rewrites "forbidden path" error to actionable message including the savePath', async () => {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const fakePath = '/Users/x/Desktop/foo.pdf';
  vi.mocked(save).mockResolvedValue(fakePath);
  vi.mocked(writeFile).mockRejectedValue(
    new Error(`forbidden path: ${fakePath}`),
  );

  await expect(generateQuotePdf(makeQuote())).rejects.toThrow(
    /this location is restricted/,
  );
  await expect(generateQuotePdf(makeQuote())).rejects.toThrow(
    /\/Users\/x\/Desktop\/foo\.pdf/,
  );
});
```

**Replacement (single invocation, combined regex):**

```typescript
it('rewrites "forbidden path" error to actionable message including the savePath', async () => {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const fakePath = '/Users/x/Desktop/foo.pdf';
  vi.mocked(save).mockResolvedValue(fakePath);
  vi.mocked(writeFile).mockRejectedValue(
    new Error(`forbidden path: ${fakePath}`),
  );

  await expect(generateQuotePdf(makeQuote())).rejects.toThrow(
    /Cannot save to "\/Users\/x\/Desktop\/foo\.pdf" — this location is restricted/,
  );
});
```

**Why the combined regex is tighter (per 18-REVIEW WR-01 fix recommendation):**

- The savePath echo must appear at a **specific position** in the rewritten message (right after `Cannot save to "`), not just somewhere in it.
- The em-dash literal (`—`, U+2014) is preserved verbatim from the source (`generateQuotePdf.ts:339`), ensuring the assertion matches the exact rewritten format.
- The regex no longer requires double mock invocation; the mocks fire once, and the assertion checks the actionable message + savePath echo as one atomic check.

### Cross-Reference Check (does the edit break any other test?)

`grep -n "forbidden path\|this location is restricted" src/pdf/generateQuotePdf.test.ts` returns:

- Line 510: the test `it(` name (string literal, no semantic dependency)
- Line 516: the `new Error(...)` mock arg (still uses `forbidden path: ${fakePath}` form — unchanged)
- Line 520: the assertion regex (the part being changed)

The other 2 tests in the `writeFile error mapping` describe block (lines 527 and 537) use unrelated assertions (`/disk full/` and `.resolves.toBeUndefined()`) — no overlap. **Edit is safe; no other test references the rewritten regex.**

### Verification Commands (acceptance criteria for the WR plan)

```bash
# WR-03: confirm replacement landed
grep -c "startsWith('forbidden path:')" src/pdf/generateQuotePdf.ts   # → 1
grep -c "includes('forbidden path')" src/pdf/generateQuotePdf.ts      # → 0

# WR-01: confirm collapsed-test landed
grep -c "rejects.toThrow" src/pdf/generateQuotePdf.test.ts | awk '$1<26 {print "ok"}'   # count drops by 1
# (Pre-WR-01: 2 toThrow in that test; post-WR-01: 1 toThrow)

# Full vitest gate
npx vitest run src/pdf/generateQuotePdf.test.ts                       # → all tests pass (28 → 28)

# Full TypeScript build gate (per global CLAUDE.md rule)
npx tsc -b                                                            # → exit 0

# Full project build (the 8-gate chain)
npm run build                                                         # → exit 0
```

> **Note on `tsc -b` vs `tsc --noEmit`:** Per global CLAUDE.md, use `tsc -b` (Vercel uses `tsc -b && vite build`).

---

## Cross-Cutting: Ready-to-Paste Templates per Wave

### Wave 1 — NYQ-01/02/03/04 Plans (4 plans, parallel)

**Shared `<read_first>` boilerplate:**

```
- $HOME/.claude/get-shit-done/workflows/validate-phase.md (the workflow this plan invokes)
- $HOME/.claude/get-shit-done/templates/VALIDATION.md (template the workflow uses for State B)
- .planning/REQUIREMENTS.md §"Nyquist (NYQ)" (the requirement-to-phase trace)
- .planning/phases/{target-phase-dir}/{padded}-VERIFICATION.md (audit input for the workflow — confirms tests are green)
- .planning/phases/{target-phase-dir}/{N}-NN-SUMMARY.md × all plan summaries (State B reconstruction source)
```

**Plan-specific addenda:**

| Plan | Add to `<read_first>` |
|------|------------------------|
| NYQ-01 (Phase 13) | `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` (existing draft — workflow audits + flips flags) |
| NYQ-02 (Phase 15) | All 12 SUMMARYs in `.planning/phases/15-tags-search-quick-duplicate/`; `15-VERIFICATION.md` (status: passed) |
| NYQ-03 (Phase 15.1) | All 5 SUMMARYs in `.planning/phases/15.1-customer-library/`; `15.1-VERIFICATION.md` (status: passed) |
| NYQ-04 (Phase 17) | `17-01-PLAN.md` + `17-01-SUMMARY.md` + `17-02-PLAN.md` + `17-02-SUMMARY.md`; `package.json` (the 8-gate build script line); `scripts/assert-no-static-pdf-import.mjs` |

**Shared `<acceptance_criteria>` template:**

```
- File exists: `.planning/phases/{target-phase-dir}/{padded}-VALIDATION.md` (created or updated)
- Frontmatter `nyquist_compliant: true`
- Frontmatter `status: passed` (NYQ-01) OR `status: draft` is replaced with a non-draft status (NYQ-02/03/04 newly created)
- Per-Task Map has ≥ 1 row per declared requirement ID for the target phase
- For NYQ-01 only: `## Validation Audit 2026-05-25` section appended to existing file
- `npm test` exits 0 (regression baseline — pre-existing tests still green)
```

**Shared commit command:**

```bash
gsd-sdk query commit "docs(phase-24): {N}-VALIDATION.md — Nyquist compliance ({NYQ-XX})" \
  --files ".planning/phases/{target-phase-dir}/{padded}-VALIDATION.md"
```

### Wave 2 — NYQ-05 Plan (1 plan)

**`<read_first>`:**

```
- .planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md (source of truth for the 8 UAT items)
- src/components/SettingsModal.tsx:264-301 (Default Tax Rate surface — smoke test 1)
- src/components/CostCalculator.tsx:129 + 1232-1256 + 549-550 + 578-579 (Per-job Tax Rate surfaces — smoke test 2)
- src/features.ts (NewBadge registry — relevant for in-prod evidence note re: items 6 + 7)
- .planning/STATE.md (confirms phases 14, 15, 15.1, 16, 17 all merged in the 2026-05-21 → 2026-05-25 window)
```

**`<acceptance_criteria>`:**

```
- Smoke Test 1 (Default Tax Rate field) PASS: all 9 sub-checks satisfied in `npm run dev` browser session
- Smoke Test 2 (Per-job Tax Rate round-trip) PASS: all 8 sub-checks satisfied
- 13-VERIFICATION.md frontmatter: `status: passed` (was `human_needed`), `uat_closed: 2026-05-25`, `uat_closure_phase: 24-...`, `uat_closure_req: NYQ-05` fields added
- 13-VERIFICATION.md body: new `## UAT Closure (Phase 24 NYQ-05) — 2026-05-25` section appended with:
  - Smoke-Tested table covering items 1 + 2 with PASS results
  - Rubber-Stamped paragraph enumerating items 3-8 with the locked phrase: "In-prod validated since 2026-05-21 across phases 14, 15, 15.1, 16, and 17 with zero bug reports — formally accepted as passed per Phase 24 NYQ-05."
- `grep -c "status: passed" 13-VERIFICATION.md` returns ≥ 1
- `grep -c "uat_closure_req: NYQ-05" 13-VERIFICATION.md` returns 1
```

**Commit command (one commit per D-04 executor recommendation):**

```bash
gsd-sdk query commit "docs(phase-24): close Phase 13 UAT — 2 smoke + 6 rubber-stamp (NYQ-05)" \
  --files ".planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md"
```

### Wave 3 — Bundled WR-01/02/03 Plan (1 plan)

**Recommended task order (per CONTEXT.md `<decisions>` D-06 Claude's-Discretion note):**

1. **Task 1 (WR-01 + WR-03 — low-risk TS edits):** Apply both edits in one task. Verify via `npx vitest run src/pdf/generateQuotePdf.test.ts && npx tsc -b && npm run build`. Commit as one commit: `fix(pdf): tighten forbidden-path match + collapse double-invocation test (WR-01 + WR-03)`.

2. **Task 2 (WR-02 — Tauri dep bump):** Edit `src-tauri/Cargo.toml` to `tauri = "2.11"` and `package.json` `@tauri-apps/api` to `^2.11.0`. Run `npm install`, then `cd src-tauri && cargo check`, then `npm run tauri build` (or `cargo build --release` standalone if a full bundle isn't needed for verification). Verify via `find node_modules/@tauri-apps -path '*/node_modules/*/api/package.json' | wc -l` returns `0` (no nested copies). Commit as one commit: `chore(deps): bump tauri crate to 2.11.x + @tauri-apps/api ^2.11.0 (WR-02)`.

3. **Task 3 (conditional fallback — `checkpoint:human-verify`):** ONLY invoked if Task 2's verify fails. See Section 3 template.

**`<read_first>` for the WR plan:**

```
- .planning/phases/18-tauri-fs-scope-fix/18-REVIEW.md (source of truth for WR-01, WR-02, WR-03)
- .planning/phases/18-tauri-fs-scope-fix/18-01-SUMMARY.md (context on the 2.10.1 pin + UAT-D Result A)
- .planning/phases/18-tauri-fs-scope-fix/18-01-PLAN.md (checkpoint:human-verify pattern + resume-signal template — re-used for the conditional fallback in Task 3)
- src/pdf/generateQuotePdf.ts (current state — confirm line 337 matches the WR-03 replacement target)
- src/pdf/generateQuotePdf.test.ts (current state — confirm lines 519-524 match the WR-01 replacement target; confirm test setup at top of file)
- src-tauri/Cargo.toml (current `tauri = "2"` declaration — WR-02 bump target)
- package.json (current `@tauri-apps/api: ^2.10.1` pin — WR-02 re-pin target)
- .planning/phases/24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryo/24-RESEARCH.md §2 (the Tauri 2.11.x changelog findings — JUSTIFIES skipping routine UAT)
```

**`<acceptance_criteria>` for the WR plan (combined for all 3 tasks):**

```
WR-01:
  - grep -c "rejects.toThrow" src/pdf/generateQuotePdf.test.ts in the writeFile-error-mapping block drops from 2 to 1 (single invocation)
  - The replacement regex form /Cannot save to "\/Users\/x\/Desktop\/foo\.pdf" — this location is restricted/ is present

WR-03:
  - grep -c "startsWith('forbidden path:')" src/pdf/generateQuotePdf.ts returns 1
  - grep -c "includes('forbidden path')" src/pdf/generateQuotePdf.ts returns 0 (the loose match is gone)

WR-02:
  - src-tauri/Cargo.toml `tauri = "2.11"` (was `"2"`)
  - package.json `"@tauri-apps/api": "^2.11.0"` (was `"^2.10.1"`)
  - find node_modules/@tauri-apps -path '*/node_modules/*/api/package.json' | wc -l returns 0 (dedup confirmed)
  - cd src-tauri && cargo check exit 0
  - npm run tauri build exit 0 (the bundle Cargo.lock churn is expected — multi-line diff like Phase 18's)

All-task gates:
  - npx vitest run src/pdf/generateQuotePdf.test.ts exit 0
  - npx tsc -b exit 0
  - npm run build exit 0 (the 8-gate chain stays green)
  - npm test exit 0 (regression baseline)

Conditional Task 3 (fallback): if Task 2's gates fail, the resume-signal records user's decision (rollback OR accept-dual-copy) and the chosen path is implemented before plan completion.
```

**Commit commands (one per task, per Phase 18 atomic-commit pattern):**

```bash
# Task 1
gsd-sdk query commit "fix(pdf): tighten forbidden-path match + collapse double-invocation test (WR-01 + WR-03)" \
  --files "src/pdf/generateQuotePdf.ts src/pdf/generateQuotePdf.test.ts"

# Task 2
gsd-sdk query commit "chore(deps): bump tauri crate to 2.11.x + @tauri-apps/api ^2.11.0 (WR-02)" \
  --files "src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json"
```

---

## Project Constraints (from CLAUDE.md)

The project's CLAUDE.md instructions that the planner must honor:

- **`tsc -b` not `tsc --noEmit`** for TypeScript verification (Vercel uses `tsc -b && vite build`).
- **Port 4173** for dev server (3DCoster — already pinned in `vite.config.ts`).
- **Atomic commits per task** — Phase 18 pattern; WR plan should commit per WR (or one commit for the WR-01+WR-03 combined edit task, plus a separate commit for WR-02).
- **No `--no-verify`** on commits — git hooks must run.
- **Always read entire code pages** — relevant for the WR-01/03 edits; executor should read the surrounding `describe('writeFile error mapping')` block (lines 499-545) not just lines 519-524.
- **NewBadge rule** (relevant for NYQ-05 item 6): the badge must not interfere with surrounding UI. `default-tax-rate` badge is verified anti-pattern-safe in 13-VERIFICATION.md per project memory.
- **Use agents aggressively** — `/gsd:validate-phase` workflow spawns `gsd-nyquist-auditor` per Section 1; planner should not bypass.

## Sources

### Primary (HIGH confidence)

- `crates/tauri/CHANGELOG.md` (fetched via `gh api repos/tauri-apps/tauri/contents/crates/tauri/CHANGELOG.md` on 2026-05-25) — verbatim 2.11.0 / 2.11.1 / 2.11.2 entries quoted in Section 2.
- `plugins/fs/CHANGELOG.md` + `plugins/dialog/CHANGELOG.md` (fetched via `gh api repos/tauri-apps/plugins-workspace/contents/plugins/{fs,dialog}/CHANGELOG.md` on 2026-05-25) — 2.4.5→2.5.1 and 2.4.0→2.7.1 entries.
- `plugins/fs/src/error.rs` (fetched via `gh api` on 2026-05-25) — confirms `#[error("forbidden path: {0}")] PathForbidden(PathBuf)` format.
- `plugins/dialog/src/commands.rs` (fetched via `gh api` on 2026-05-25) — confirms `scope.allow_file(&path)` auto-allow pattern still present.
- `$HOME/.claude/get-shit-done/workflows/validate-phase.md` — full 8-step workflow definition.
- `$HOME/.claude/get-shit-done/templates/VALIDATION.md` — canonical VALIDATION.md template.
- `.planning/phases/18-tauri-fs-scope-fix/18-REVIEW.md` — WR-01/02/03 findings (read in full).
- `.planning/phases/18-tauri-fs-scope-fix/18-01-PLAN.md` — Task 3 `checkpoint:human-verify` template (read verbatim).
- `.planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md` — 8 deferred UAT items (read in full).
- `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` — existing draft state (read in full).
- Live tree codebase: `src/pdf/generateQuotePdf.ts:331-345` (WR-03 target), `src/pdf/generateQuotePdf.test.ts:1-12 + 499-545` (WR-01 target), `src-tauri/Cargo.toml`, `package.json` (WR-02 baseline).
- `npm view @tauri-apps/api@2.11.0 / plugin-fs@2.5.1 / plugin-dialog@2.7.1 peerDependencies` (executed 2026-05-25) — confirms peer-range alignment.
- `find node_modules/@tauri-apps -name package.json` (executed 2026-05-25) — confirms dual-copy state.

### Secondary (MEDIUM confidence)

- `gh release view tauri-v2.11.{0,1,2} --repo tauri-apps/tauri` — confirms release dates (2026-04-30 / 2026-05-06 / 2026-05-16); release body is mostly cargo-audit boilerplate, the changelog content lives in `crates/tauri/CHANGELOG.md` cited as Primary above.
- `cargo search tauri` — confirms `tauri = "2.11.2"` is latest on crates.io.

### Tertiary (LOW confidence — flagged for validation)

- WebFetch of `https://tauri.app/blog/` returned no 2.11 announcement post (the blog listing only goes back to 2.0). This means there is no "what's new in 2.11" blog post for the planner to link from the plan; the CHANGELOG is the only canonical source.

## Metadata

**Confidence breakdown:**

- Section 1 (`/gsd:validate-phase` shape): **HIGH** — workflow file + template read in full; State A/B distinction is explicit in the workflow source.
- Section 2 (Tauri 2.11.x changelog & D-06 call): **HIGH** — verbatim CHANGELOG quotes from authoritative source; the absence of `fs:*` / `dialog:` / capability-resolution changes is decisive evidence for the "skip routine UAT" recommendation.
- Section 3 (`checkpoint:human-verify` pattern): **HIGH** — Phase 18 plan 01 Task 3 read verbatim; pattern proven end-to-end in Phase 18 execution (per 18-01-SUMMARY UAT outcomes).
- Section 4 (Phase 13 UAT closure mechanics): **HIGH** — all 8 UAT surfaces grep-confirmed in current tree; 13-VERIFICATION.md frontmatter shape verified; in-prod evidence (phases 14/15/15.1/16/17 all merged in the window) confirmed via STATE.md and ROADMAP.md.
- Section 5 (WR-01/03 surgical edits): **HIGH** — exact lines read in current tree; replacement strings drop in with no cross-test breakage.

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (Tauri 2.11.x line is stable; 2.12.x line not yet released as of research date; the changelog findings remain valid until the next minor bump).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | All claims in this research are either verified via `gh api` against authoritative `tauri-apps` repos, verified via on-disk grep against the live tree, or directly quoted from the canonical CONTEXT.md / workflow.md / template.md files. No `[ASSUMED]` knowledge was used. |

## Open Questions

None blocking. The D-06 call is unambiguous (skip routine UAT); the fallback path is explicit (conditional `checkpoint:human-verify` only if `cargo check`/`npm run tauri build` fails); the WR-01/03 edits are byte-perfect surgical replacements.

---

## Planner Quick-Reference

> A condensed paste-ready summary the planner uses to write the 6 plans.

### Wave 1 (4 plans, parallel) — `/gsd:validate-phase` invocations

| Plan | Target | State | Frontmatter |
|------|--------|-------|-------------|
| NYQ-01 | Phase 13 | A (draft → passed) | `wave: 1, depends_on: [], requirements: [NYQ-01], autonomous: true, files_modified: [.planning/phases/13-.../13-VALIDATION.md]` |
| NYQ-02 | Phase 15 | B (create) | `wave: 1, depends_on: [], requirements: [NYQ-02], autonomous: true, files_modified: [.planning/phases/15-.../15-VALIDATION.md]` |
| NYQ-03 | Phase 15.1 | B (create) | `wave: 1, depends_on: [], requirements: [NYQ-03], autonomous: true, files_modified: [.planning/phases/15.1-.../15.1-VALIDATION.md]` |
| NYQ-04 | Phase 17 | B (trivial) | `wave: 1, depends_on: [], requirements: [NYQ-04], autonomous: true, files_modified: [.planning/phases/17-.../17-VALIDATION.md]` |

- **Single task per plan:** "Run `/gsd:validate-phase {N}` and verify produced artifact."
- **Acceptance:** file exists; `nyquist_compliant: true`; ≥1 row per declared requirement; (NYQ-01 only) `## Validation Audit 2026-05-25` section appended.
- **Commit:** `gsd-sdk query commit "docs(phase-24): {N}-VALIDATION.md — Nyquist compliance ({NYQ-XX})" --files ...`

### Wave 2 (1 plan) — NYQ-05 Phase 13 UAT closure

| Plan | Target | Frontmatter |
|------|--------|-------------|
| NYQ-05 | Phase 13 VERIFICATION | `wave: 2, depends_on: [], requirements: [NYQ-05], autonomous: false (smoke tests are human-driven), files_modified: [.planning/phases/13-.../13-VERIFICATION.md]` |

- **Tasks:** (1) Smoke Test 1 — Default Tax Rate field; (2) Smoke Test 2 — Per-job Tax Rate round-trip; (3) Apply 8-item UAT closure section + frontmatter flag flip (status: human_needed → passed).
- **`<read_first>`:** 13-VERIFICATION.md, SettingsModal.tsx:264-301, CostCalculator.tsx:129/1232-1256/549-550/578-579, src/features.ts, .planning/STATE.md.
- **Smoke-test environment:** `npm run dev` on port 4173 (web app; Tauri rebuild not required since the surfaces are IndexedDB-backed web flows).
- **Commit:** `gsd-sdk query commit "docs(phase-24): close Phase 13 UAT — 2 smoke + 6 rubber-stamp (NYQ-05)" --files ".planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md"`

### Wave 3 (1 plan) — Bundled WR-01/02/03

| Plan | Target | Frontmatter |
|------|--------|-------------|
| WR | WR-01 + WR-02 + WR-03 | `wave: 3, depends_on: [], requirements: [WR-01, WR-02, WR-03] (or none — WRs are not in REQUIREMENTS.md), autonomous: true (fallback checkpoint is conditional, not routine), files_modified: [src/pdf/generateQuotePdf.ts, src/pdf/generateQuotePdf.test.ts, src-tauri/Cargo.toml, src-tauri/Cargo.lock, package.json, package-lock.json]` |

- **Tasks (recommended order):**
  1. WR-01 + WR-03 combined TS edit task (small, low-risk, fast feedback). Verify: `npx vitest run src/pdf/generateQuotePdf.test.ts && npx tsc -b && npm run build`.
  2. WR-02 Tauri 2.11.x bump. Verify: `cd src-tauri && cargo check && cd .. && npm run tauri build && find node_modules/@tauri-apps -path '*/node_modules/*/api/package.json' | wc -l` returns 0.
  3. Conditional `checkpoint:human-verify` fallback — ONLY if Task 2 fails. Resume-signal accepts `rollback` or `accept-dual-copy`.
- **D-06 call:** **No routine UAT-A re-run.** Changelog evidence in Section 2 shows zero changes to `fs:*` permissions, `fs:scope`, dialog plugin save behavior, or local-origin capability ACL resolution.
- **`<read_first>`:** 18-REVIEW.md, 18-01-SUMMARY.md, 18-01-PLAN.md (Task 3 template), src/pdf/generateQuotePdf.ts, src/pdf/generateQuotePdf.test.ts, src-tauri/Cargo.toml, package.json, this RESEARCH.md §2 (the changelog evidence).
- **Commits:**
  - Task 1: `gsd-sdk query commit "fix(pdf): tighten forbidden-path match + collapse double-invocation test (WR-01 + WR-03)" --files "src/pdf/generateQuotePdf.ts src/pdf/generateQuotePdf.test.ts"`
  - Task 2: `gsd-sdk query commit "chore(deps): bump tauri crate to 2.11.x + @tauri-apps/api ^2.11.0 (WR-02)" --files "src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json"`

### Cross-wave invariants

- **No `--no-verify`** on any commit.
- **`tsc -b`** for TypeScript verification (not `--noEmit`).
- **Dev server on port 4173** (per CLAUDE.md).
- **No new packages installed** in Wave 1 + Wave 2; **only the existing `@tauri-apps/api` is re-pinned** in Wave 3 (no new dependencies added).
- **Cargo.lock churn is expected** in Task 2 (Wave 3) — multi-line diff, similar to Phase 18's 72-line refresh.
- **Test suite stays green throughout** — pre-existing 272/272 baseline from Phase 18 must hold; all Phase 24 changes are net-additive (docs) or surgical (WR edits preserve test contracts).

---

*Phase: 24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryover*
*Researched: 2026-05-25 by gsd-researcher*
