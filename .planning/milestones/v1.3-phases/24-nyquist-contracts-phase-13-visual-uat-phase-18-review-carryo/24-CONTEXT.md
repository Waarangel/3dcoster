# Phase 24: Nyquist contracts + Phase 13 visual UAT + Phase 18 review carryover - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A doc-mostly hygiene phase that closes three independent debt batches with no new user-facing features:

1. **Nyquist contracts (NYQ-01..04)** — author/complete `*-VALIDATION.md` for phases 13, 15, 15.1, 17 via `/gsd:validate-phase` per phase. Phase 13 already has a draft VALIDATION.md (`status: draft, nyquist_compliant: false, wave_0_complete: false`) that needs flag-flipping. Phases 15, 15.1, 17 have no VALIDATION.md yet.

2. **Phase 13 visual UAT closure (NYQ-05)** — close out the 8 deferred visual UAT items recorded in `13-VERIFICATION.md` so its `status` flips from `human_needed` → `passed`. The phase has been in production since 2026-05-21 with 4+ subsequent phases stacked on top and zero bug reports — this is largely a formality.

3. **Phase 18 review carryover (WR-01/02/03)** — single bundled hygiene plan addressing the three Phase 18 code review warnings (see `phases/18-tauri-fs-scope-fix/18-REVIEW.md`):
   - **WR-01**: sticky-mock fragility in `src/pdf/generateQuotePdf.test.ts:519` — collapse the forbidden-path test to one `generateQuotePdf()` invocation with a combined regex
   - **WR-02**: `@tauri-apps/api` version skew — bump Rust `tauri` crate to 2.11.x + re-pin `@tauri-apps/api` to `^2.11.0`
   - **WR-03**: loose substring match in `src/pdf/generateQuotePdf.ts:337` — change `includes('forbidden path')` to `startsWith('forbidden path:')`

**Not in scope (redirected to other phases):** any new user-facing feature; POL-01..04 (Phase 25); other dep bumps beyond the WR-02 chain; revisiting the dual-`@tauri-apps/api`-copy via npm dedupe (rejected in favor of bumping); refactoring beyond audit findings.

</domain>

<decisions>
## Implementation Decisions

### Plan Structure & Wave Layout
- **D-01:** Phase 24 ships **6 plans total**, grouped into 3 waves (locked during the ROADMAP edit that folded WR-01/02/03 into Phase 24):
  - **Wave 1 (parallel, 4 plans):** `/gsd:validate-phase 13` (NYQ-01), `/gsd:validate-phase 15` (NYQ-02), `/gsd:validate-phase 15.1` (NYQ-03), `/gsd:validate-phase 17` (NYQ-04)
  - **Wave 2 (1 plan):** Phase 13 visual UAT closure (NYQ-05). Runs after wave 1 because it writes to `13-VERIFICATION.md` which NYQ-01's validate-phase may also touch.
  - **Wave 3 (1 plan):** WR-01/02/03 hygiene plan (bundled — not three separate plans, deliberately). Runs last because it contains the conditional manual UAT (see D-05).
- **D-02:** The WR plan is bundled (one commit per WR is fine inside it) rather than three separate plans. Bundling is cheaper to ship and the three changes are causally related to Phase 18.

### NYQ-04 (Phase 17 validation) shape
- **D-03:** NYQ-04 is a **standalone parallel plan**, not folded into NYQ-01..03. Even if `/gsd:validate-phase 17` audit finds nothing material (the goal cites the existing 8-gate build chain + `scripts/assert-no-static-pdf-import.mjs` as evidence of triviality), the resulting `17-VALIDATION.md` is a permanent artifact that documents inheritance of the global guards. Symmetric with NYQ-01..03; no scope-mixing inside one plan.

### Phase 13 visual UAT rigor (NYQ-05)
- **D-04:** **Smoke-test 2 items + rubber-stamp the other 6.** The two manually-tested items are:
  1. Default Tax Rate field in Settings → render + persist across modal close/reopen + full app reload (IndexedDB round-trip)
  2. Per-job Tax Rate input round-trip — set on save, reads back on reopen from `editingJob?.taxRate`
- **D-04a:** The other 6 items (Tax row hides at 0%, NewBadge rendering + timing, 4-column Set Financial Targets grid layout, compact inputs sweep across 5 components, InfoTooltip placement, persistence after page reload via different paths) flip to `passed` with an **explicit in-prod evidence note** in the updated `13-VERIFICATION.md`: *"In-prod validated since 2026-05-21 across phases 14, 15, 15.1, 16, 17 with zero bug reports — formally accepted as passed per Phase 24 NYQ-05."*
- **D-04b:** The two smoke-tested items are picked because they exercise real IndexedDB persistence (the only items where a silent regression could hide in surfaces low-traffic enough to escape in-prod use).

### WR-02 (Tauri dep dedupe)
- **D-05:** **Strategy (b): bump Rust `tauri` crate to 2.11.x + re-pin `@tauri-apps/api` to `^2.11.0`.** Treats 2.11.x as the new floor for both JS and Rust sides; collapses the two `@tauri-apps/api` copies in the bundle to one. Triggers another Cargo.lock churn (multi-line diff like Phase 18 had).
- **D-05a:** Strategy (a) — bumping plugin-fs/plugin-dialog to 2.10.x-compatible versions — was rejected as unlikely-to-exist (plugins move forward, not back).
- **D-05b:** Strategy (c) — accept dual-copy + document — was rejected as wasteful (leaves bundle bloat in place).

### WR-02 regression UAT (Claude's discretion)
- **D-06:** **Conditional UAT — gated on research findings.** The planner's research step reads the tauri 2.11.x changelog and release notes. If the changelog touches `fs:*` permissions, dialog plugin behavior, or capability ACL resolution semantics, the WR plan includes a re-run of Phase 18 UAT-A (PDF save to `~/Desktop` in `npm run tauri:dev`) as a blocking `checkpoint:human-verify` task. If the changelog is pure bug fixes / unrelated areas, skip the manual UAT and trust the test suite + `npm run tauri build` exit code.
- **Rationale:** Phase 18's UAT-D Result A finding ("the audit's mechanistic bug WAS real") teaches us that manual UAT on Tauri capability/dialog plumbing surfaces real bugs that automated tests miss. But we shouldn't run a 5-minute manual UAT on every routine dep bump — gate it to actual risk signals. This sets the pattern for future Tauri dep bump plans.

### Claude's Discretion
- **D-06 (above) — Conditional UAT trigger** — user said "you decide." Decision recorded above.
- **Phase 13 UAT note format** — exact wording of the rubber-stamp note in 13-VERIFICATION.md is the executor's call as long as it captures the 4-day + 5-phase in-prod evidence and explicitly cites Phase 24 NYQ-05 as the formal close.
- **WR plan task order** — executor decides whether to land WR-01/03 (small TS edits) before or after the WR-02 dep bump within the bundled plan. Recommended order: WR-01 + WR-03 first (low-risk, fast feedback), then WR-02 (high-churn). If the WR-02 conditional UAT triggers, it gates the plan completion regardless of order.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 24 scope sources
- `.planning/ROADMAP.md` §"Phase 24" — locked goal, success criteria 1-8, plan estimate (~6 plans), wave dependencies
- `.planning/REQUIREMENTS.md` §"Nyquist (NYQ)" — NYQ-01..05 with traceback to TECH-DEBT D1..D5
- `.planning/v1.2-TECH-DEBT.md` D1..D5 — original tech-debt entries that NYQ-01..05 close
- `.planning/v1.2-CODE-AUDIT.md` — broader audit context (Phase 24 closes no CODE-AUDIT items directly; only TECH-DEBT)

### Phase 18 carryover sources
- `.planning/phases/18-tauri-fs-scope-fix/18-REVIEW.md` — **source of truth for WR-01, WR-02, WR-03.** Full finding text, file:line citations, three remediation options for WR-02.
- `.planning/phases/18-tauri-fs-scope-fix/18-01-SUMMARY.md` — context on the `@tauri-apps/api` 2.10.1 pin (Rule-1 bug-fix deviation during Phase 18) and UAT-D Result A finding (why manual Tauri UAT matters)
- `.planning/phases/18-tauri-fs-scope-fix/18-01-PLAN.md` — Phase 18's `checkpoint:human-verify` pattern + `resume-signal` block (reuse for the WR-02 conditional UAT if it triggers)
- `.planning/phases/18-tauri-fs-scope-fix/18-RESEARCH.md` — Tauri 2 fs capability research (relevant if WR-02's 2.11.x changelog touches fs:scope semantics)

### Phase 13 UAT sources
- `.planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md` — **source of truth for the 8 deferred visual UAT items.** Each item has Test/Expected/Why-human structure. NYQ-05 updates this file.
- `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` — current state: `status: draft, nyquist_compliant: false, wave_0_complete: false`. NYQ-01 flips these flags.
- `.planning/phases/13-tax-model-ui-sweep/13-PLAN.md` (and individual plan SUMMARYs) — for VALIDATION coverage cross-reference

### Tauri dep bump targets (WR-02)
- `src-tauri/Cargo.toml` — current `tauri = "2.10"` declaration; bump to `"2.11"` (or whatever is current in the 2.11.x line at research time)
- `src-tauri/Cargo.lock` — will churn substantially on the bump (expect ≥50-line diff, similar to Phase 18's lockfile refresh)
- `package.json` — current `"@tauri-apps/api": "^2.10.1"` pin (Phase 18 set this); re-pin to `"^2.11.0"`
- `package-lock.json` — will refresh
- `node_modules/@tauri-apps/plugin-fs/package.json` + `node_modules/@tauri-apps/plugin-dialog/package.json` — current peerDeps/deps; research step confirms 2.11.x resolves to a single api copy

### WR-01 / WR-03 fix targets
- `src/pdf/generateQuotePdf.ts:337` — WR-03: change `msg.toLowerCase().includes('forbidden path')` to `msg.toLowerCase().startsWith('forbidden path:')`
- `src/pdf/generateQuotePdf.test.ts:519-524` — WR-01: collapse double-invocation in forbidden-path test to single call with combined regex
- `src/pdf/generateQuotePdf.test.ts` `describe('writeFile error mapping')` block — context for the WR-01 edit

### Workflow refs
- `$HOME/.claude/get-shit-done/workflows/validate-phase.md` — defines what `/gsd:validate-phase X` does; planner reads this to understand the per-NYQ plan shape (wave 0 contract authoring, sampling, nyquist_compliant flip)
- `.planning/codebase/TESTING.md` — vitest config + project test conventions (relevant for WR-01 test edit)
- `.planning/codebase/STACK.md` — Tauri + Rust dep landscape (relevant for WR-02 research)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 18 `checkpoint:human-verify` pattern** — established in `18-01-PLAN.md` (Task 3) with full `<resume-signal>` block. Reuse verbatim for the WR-02 conditional UAT if it triggers; the gsd-executor orchestrator already handles the checkpoint return + continuation-agent dispatch correctly (validated end-to-end in Phase 18 execution).
- **`generateQuotePdf.test.ts` mocking scaffold** — the `vi.mock('@tauri-apps/plugin-fs')` + `vi.mock('@tauri-apps/plugin-dialog')` + `vi.stubGlobal('__IS_TAURI__', true)` pattern in the `writeFile error mapping` describe block is the template for the WR-01 collapsed test.
- **`/gsd:validate-phase` workflow** — produces VALIDATION.md with the wave-0 contract structure already exemplified by `13-VALIDATION.md` (draft form). NYQ-02/03/04 inherit this shape.
- **Phase 18 SDK commit helper** — `gsd-sdk query commit "msg" --files ...` was used 4+ times in Phase 18 with consistent footer formatting; WR plan can reuse without re-deriving.

### Established Patterns
- **No `--no-verify`** — per project CLAUDE.md, hooks run on every commit. Phase 18 followed this without exception; Phase 24 follows the same rule.
- **`tsc -b` over `tsc --noEmit`** — per global CLAUDE.md, full project references build is the verification command (Vercel uses `tsc -b && vite build`). Applies to WR-01/03 plan.
- **Atomic commits per task** — Phase 18 shipped 4 atomic commits inside a single 3-task plan. WR plan should do the same: one commit per WR if executed serially inside the bundled plan, or one commit covering all three if the executor decides to bundle the edits (low-risk; WR-01/03 are tiny and WR-02 is its own large diff).
- **Cargo.lock diff is expected on Tauri dep churn** — Phase 18 surfaced this pattern explicitly. WR-02 will produce a similar diff; not a deviation, just a one-time cost.

### Integration Points
- **`13-VERIFICATION.md` is the single file NYQ-01 and NYQ-05 both touch.** NYQ-01 (in wave 1) writes the `wave_0_complete: true` flag flip via `/gsd:validate-phase 13`; NYQ-05 (in wave 2) flips `status: human_needed → passed` after the smoke-test + rubber-stamp note. Sequencing is enforced via the wave boundary.
- **No Cargo.lock conflict risk** — only the WR plan (wave 3) touches Cargo.lock. The wave 1 doc-audit plans and wave 2 UAT plan modify only `.planning/**` files; no contention.
- **Test suite stays green throughout** — all changes are net-additive (NYQ docs) or surgical (WR-01 collapses tests but tests still pass; WR-02 bumps deps but contract is preserved; WR-03 tightens a regex but the existing test verifies the actionable message still surfaces). The Phase 18 post-merge gate (272/272 tests passing) is the baseline.

</code_context>

<specifics>
## Specific Ideas

- **Phase 13 UAT note exact intent**: the rubber-stamp note must explicitly enumerate the phases that stacked on top of Phase 13 (14, 15, 15.1, 16, 17) and the in-prod date range (2026-05-21 → 2026-05-25). This is institutional honesty about what was eye-checked vs. inferred — not a vague "looks fine to me."
- **WR-02 changelog research must be cited verbatim in the plan** — the planner's research step should include a `<changelog_findings>` block with direct quotes from the tauri 2.11.x release notes (with URL) so the conditional-UAT trigger decision is auditable later. This is the same pattern Phase 18 used for the dialog plugin auto-allow finding (`commands.rs:281-289` citation).
- **WR-02 fallback path** — if the tauri 2.11.x bump fails (e.g., breaks `cargo check` or `npm run tauri build`), the WR plan's fallback is NOT to switch to strategy (c) silently; the planner should require an explicit user checkpoint to choose between rolling back the bump entirely or accepting the dual-copy as a documented escape hatch. We made a clean decision here — don't let executor improvisation undo it.

</specifics>

<deferred>
## Deferred Ideas

- **WR-02 strategy (a)** — bump plugin-fs/plugin-dialog to 2.10.x-compatible versions. Rejected (plugins move forward, not back); not re-considered unless strategy (b) blocks.
- **WR-02 strategy (c)** — accept dual-copy with `npm dedupe` semantics + docs. Rejected as wasteful; reserved as documented escape hatch only if strategy (b) fails per <specifics> fallback note.
- **POL-03 (jspdf module augmentation)** — replaces `(doc as any).lastAutoTable.finalY` cast in `generateQuotePdf.ts` with a `declare module 'jspdf'` augmentation. Adjacent to WR-03 (same file) but explicitly Phase 25 scope per REQUIREMENTS.md. Don't fold in — Phase 25 is the polish batch.
- **POL-04 (overflow menu outside-click handler)** — Phase 25, not 24.
- **Splitting the bundled WR plan into 3 separate plans** — considered during ROADMAP edit, user chose "Apply as shown" (bundled). Not revisited.
- **Full re-test of all 8 Phase 13 UAT items** — rejected in favor of smoke-test-2 + rubber-stamp-6 (D-04). Available as escape hatch if smoke tests surface anything unexpected.
- **Standalone "Tauri dep bump" phase** — considered briefly during ROADMAP edit (would let WR-02 live alone in its own phase with its own UAT). Folded into Phase 24 instead because the bump is small and bundling with WR-01/03 keeps the Phase 18 review carryover atomic.

</deferred>

---

*Phase: 24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryover*
*Context gathered: 2026-05-25*
