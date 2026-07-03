---
phase: 24
slug: nyquist-contracts-phase-13-visual-uat-phase-18-review-carryover
mapped: 2026-05-25
mapper: gsd-pattern-mapper
---

# Phase 24 — Pattern Map

**Mapped:** 2026-05-25
**Files to be created/modified:** 7 total (4 new VALIDATION.md docs, 1 VERIFICATION.md edit, 2 code-edit targets + 4 dep-bump-co-modified files)
**Analogs found:** 6 / 7 strong matches; 1 file (`17-VALIDATION.md`) is a derivative of the same template as the other three — no separate analog needed.

> **Scope note:** Phase 24 is a doc-mostly hygiene phase. Of the 11 files that get touched, **9 are markdown artifacts** generated/edited by `/gsd:validate-phase` workflow tooling or surgical doc patches. Only 2 files are real code edits (`generateQuotePdf.ts:337` and `generateQuotePdf.test.ts:519-524`), plus 4 co-modified dep files (`Cargo.toml`, `Cargo.lock`, `package.json`, `package-lock.json`) where the "pattern" is byte-perfect version-string replacement, not a code analog.
>
> **Pattern map is therefore weighted toward:** (a) the `/gsd:validate-phase` workflow shape itself (handled internally by tooling, not the planner's code), (b) the `checkpoint:human-verify` XML template from Phase 18, and (c) the surgical-edit-with-grep-acceptance pattern for the WR-01/03 changes.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` (NYQ-01: existing draft → audit-update) | doc / validation-contract | doc edit (frontmatter flag flip + append audit section) | Itself (in-place audit, State A) | exact (same file, evolved state) |
| `.planning/phases/15-tags-search-quick-duplicate/15-VALIDATION.md` (NYQ-02: new) | doc / validation-contract | doc create (State B reconstruction) | `.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` + `$HOME/.claude/get-shit-done/templates/VALIDATION.md` | template-derived |
| `.planning/phases/15.1-customer-library/15.1-VALIDATION.md` (NYQ-03: new) | doc / validation-contract | doc create (State B reconstruction) | Same as NYQ-02 | template-derived |
| `.planning/phases/17-…/17-VALIDATION.md` (NYQ-04: new, trivial) | doc / validation-contract | doc create (minimum-viable, all gates pre-existing) | Same as NYQ-02 — minimum-viable variant per RESEARCH §1 | template-derived (trivial fill) |
| `.planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md` (NYQ-05: status flip + appended UAT-closure section) | doc / verification-report | doc edit (frontmatter `human_needed → passed` + append UAT-Closure section) | Itself (existing structure; only adds new section + 4 new frontmatter fields) | exact (same file, evolved state) |
| `src/pdf/generateQuotePdf.ts:337` (WR-03 substring tightening) | utility / defensive error matcher | request-response (synchronous string match inside catch block) | `src/pdf/generateQuotePdf.ts:337` itself (single-character delta — `includes('forbidden path')` → `startsWith('forbidden path:')`) | exact (in-place tightening) |
| `src/pdf/generateQuotePdf.test.ts:519-524` (WR-01 test collapse) | test / vitest mock-driven async assertion | request-response (single mock invocation, single assertion) | `src/pdf/generateQuotePdf.test.ts:527-535` (the sibling "passes through unrelated writeFile errors unchanged" test — already uses single-invocation pattern with a single combined `toThrow` assertion) | sibling-test match (same describe block, same setup) |
| `src-tauri/Cargo.toml` (WR-02 dep bump) | config / Rust crate manifest | doc edit (version string replacement) | Phase 18's `src-tauri/Cargo.lock` regen pattern — atomic-commit-per-dep-bump | role-match (same project, Phase 18 was the immediate predecessor that established the pattern) |
| `src-tauri/Cargo.lock` (WR-02 churn artifact) | config / Rust lockfile | auto-regen on `cargo check` / `npm run tauri build` | Phase 18 `18-01-PLAN.md` artifact entry (lines 34–36) — declared as expected multi-line diff | exact (same regen mechanism) |
| `package.json` (WR-02 re-pin) | config / npm manifest | doc edit (version string replacement) | Phase 18 set the current `^2.10.1` pin — this WR plan flips it to `^2.11.0` | exact (same line, same pin field) |
| `package-lock.json` (WR-02 churn artifact) | config / npm lockfile | auto-regen on `npm install` | Phase 18 regen pattern | exact (same regen mechanism) |

---

## Pattern Assignments

### NYQ-01..04 — `*-VALIDATION.md` docs (Wave 1, 4 plans)

**Role:** doc / validation-contract (Nyquist compliance artifact per `$HOME/.claude/get-shit-done/workflows/validate-phase.md`)
**Data flow:** State A (NYQ-01 — `13-VALIDATION.md` exists as draft, audit + flip flags + append audit section) or State B (NYQ-02/03/04 — file does not exist, reconstruct from SUMMARYs using the template).

**Pattern source #1 — Existing draft as the State A reference shape:**
`.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` lines 1–8 (frontmatter — the flags NYQ-01 flips):

```yaml
---
phase: 13
slug: tax-model-ui-sweep
status: draft               # NYQ-01 flips to: passed
nyquist_compliant: false    # NYQ-01 flips to: true
wave_0_complete: false      # NYQ-01 flips to: true
created: 2026-05-21
---
```

`.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` lines 16–25 (Test Infrastructure table — the shape every reconstructed file uses):

```markdown
## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 |
| **Config file** | `vitest.config.ts` (repo root, existing) |
| **Quick run command** | `npx vitest run src/utils/costCalc.test.ts src/utils/taxResolution.test.ts` |
| **Full suite command** | `npm run test` (alias for `vitest run`) |
| **Build verification** | `npm run build` (runs `tsc -b && vite build` — per CLAUDE.md) |
| **Estimated runtime** | ~3–6 seconds (quick), ~10–15 seconds (full) |
```

`.planning/phases/13-tax-model-ui-sweep/13-VALIDATION.md` lines 42–60 (Per-Task Verification Map — the row shape; NYQ-02/03/04 reconstruct similar rows from their respective SUMMARYs):

```markdown
| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-XX-NN | XX | N | TAX-05 | — | n/a | unit | `npx vitest run src/utils/costCalc.test.ts -t "rate is 0"` | ❌ W0 | ⬜ pending |
| 13-XX-NN | XX | N | UI-08 | — | n/a | grep | `node scripts/check-compact-coverage.cjs` | ❌ W0 (script) or grep | ⬜ pending |
```

> NYQ-01 flips each ⬜ pending row to ✅ existing / ✅ shipped against the green test suite, then appends a `## Validation Audit 2026-05-25` section. NYQ-02/03/04 build similar tables from scratch.

**Pattern source #2 — Workflow template:**
`$HOME/.claude/get-shit-done/templates/VALIDATION.md` — the canonical shape `/gsd:validate-phase` uses to write State B files. The planner does NOT inline this template in the plan; the workflow handles it. The plan body only needs to specify which target phase and what `<acceptance_criteria>` the produced file must satisfy.

**Pattern application notes per plan:**

- **NYQ-01 (Phase 13, State A):** The 20-row Per-Task Map in `13-VALIDATION.md:42-100` is already populated. The workflow's gap analysis returns zero MISSING tests (per `13-VERIFICATION.md:30` — "Score: 6/6 truths verified" + "All tests pass | npm test | 6 files, 92 tests passed | PASS"). Outcome: workflow flips the three frontmatter flags + appends `## Validation Audit 2026-05-25` section.
- **NYQ-02 (Phase 15, State B):** No file exists. Workflow reconstructs from 12 SUMMARYs in `.planning/phases/15-tags-search-quick-duplicate/`.
- **NYQ-03 (Phase 15.1, State B):** No file exists. Workflow reconstructs from 5 SUMMARYs in `.planning/phases/15.1-customer-library/`.
- **NYQ-04 (Phase 17, State B trivial):** Per RESEARCH §1, the minimum-viable shape — Wave 0 Requirements section reads "None — existing 8-gate build chain (`package.json:8`) + `scripts/assert-no-static-pdf-import.mjs` cover all Phase 17 requirements." Per-Task Map has one row per declared requirement (PDF-04, D-01..03) each pointing at `automated_command: "npm run build"` with `file_exists: ✅ existing`.

**Commit pattern (per `gsd-sdk` convention, established Phase 18):**

```bash
gsd-sdk query commit "docs(phase-24): {N}-VALIDATION.md — Nyquist compliance ({NYQ-XX})" \
  --files ".planning/phases/{target-phase-dir}/{padded}-VALIDATION.md"
```

---

### NYQ-05 — `13-VERIFICATION.md` UAT closure (Wave 2, 1 plan)

**Role:** doc / verification-report (existing artifact gets new section + frontmatter fields)
**Data flow:** doc edit + 2 human smoke-tests that gate the edit.

**Pattern source — Existing 13-VERIFICATION.md structure (the file edits itself):**

`.planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md` lines 1–7 (frontmatter — NYQ-05 mutates):

```yaml
---
phase: 13-tax-model-ui-sweep
verified: 2026-05-21T13:35:00Z
status: human_needed        # NYQ-05 flips to: passed
score: 6/6 must-haves verified
overrides_applied: 0
---
```

After NYQ-05, the frontmatter gains 3 new fields (per RESEARCH §4 lines 476–487):

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

**Pattern source — Existing 8-item "Human Verification Required" section** (`13-VERIFICATION.md` lines 100–168) defines the 8 items that NYQ-05 closes. Items 3–8 (lines 122–167) get rubber-stamped in a single block; items 1+2 are smoke-tested per CONTEXT.md D-04/D-04b.

**Appended section template (per RESEARCH §4 lines 493–514 — locked phrasing):**

```markdown
## UAT Closure (Phase 24 NYQ-05) — 2026-05-25

The 8 deferred visual UAT items above are formally closed per Phase 24 NYQ-05 with the following disposition:

### Smoke-Tested (2 items)

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Default Tax Rate field in Settings — render + IndexedDB persistence … | PASS | Verified manually in `npm run dev` on 2026-05-25: … |
| 2 | Per-job Tax Rate input round-trip — set on save, reads back on reopen … | PASS | Verified manually in `npm run dev` on 2026-05-25: … |

### Rubber-Stamped — In-Prod Evidence (6 items)

Items 3 (Tax row hides at 0%), 4 (Fallback chain tooltip provenance), 5 (4-column Set Financial Targets grid), 6 (NewBadge `default-tax-rate` renders without pushing siblings), 7 (stale NewBadge sites no longer render), and 8 (UI-08 compact width visual consistency):

**In-prod validated since 2026-05-21 across phases 14, 15, 15.1, 16, and 17 with zero bug reports — formally accepted as passed per Phase 24 NYQ-05.**

The phases stacked on top of Phase 13 (Phase 14: Customer block on Sale + Etsy helper; Phase 15: Tags + search + duplicate; Phase 15.1: Customer Library; Phase 16: PDF generation; Phase 17: PDF-04 / Rollup circular chunk + tax rounding parity) all exercised these visual surfaces during their own UAT cycles, and no regressions were reported by the user across the 2026-05-21 → 2026-05-25 in-prod window.

**Phase 13 visual contract is now formally closed.**
```

**Smoke-test surface citations (executor performs these in `npm run dev` on port 4173, not Tauri):**

- Smoke Test 1 surfaces (Default Tax Rate field): `src/components/SettingsModal.tsx:264-301` — `<Input value={userProfile.defaultTaxRate ?? ''} onChange={onUserProfileChange} />` with `<NewBadge feature="default-tax-rate" />` at line 267.
- Smoke Test 2 surfaces (Per-job Tax Rate round-trip): `src/components/CostCalculator.tsx:129` (state declare, `useState(() => editingJob?.taxRate)`), `1232-1256` (Input JSX in the 4th `md:grid-cols-4` column), `549-550` + `578-579` (persistence in update + create branches of `handleSaveJob`).

**Commit pattern:**

```bash
gsd-sdk query commit "docs(phase-24): close Phase 13 UAT — 2 smoke + 6 rubber-stamp (NYQ-05)" \
  --files ".planning/phases/13-tax-model-ui-sweep/13-VERIFICATION.md"
```

---

### WR-03 — `src/pdf/generateQuotePdf.ts:337` (Wave 3, bundled WR plan, Task 1)

**Role:** utility / defensive error matcher (a single string-match inside a `catch` branch)
**Data flow:** request-response (synchronous match against `err.message`)

**Analog:** **the file itself** at the exact line. This is a one-character delta with no role-comparable analog elsewhere in the codebase — there is no other "defensive string matcher in a catch branch" in 3DCoster's tree. The pattern to copy is the file's own existing structure; the change is `includes(...)` → `startsWith('...:')`.

**Current state (`src/pdf/generateQuotePdf.ts:330-345`):**

```typescript
  const buffer = doc.output('arraybuffer');
  try {
    await writeFile(savePath, new Uint8Array(buffer));
  } catch (err) {
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
  }
}
```

**Replacement (the single line 337 change, with one comment line added to document the anchoring rationale per RESEARCH §5 lines 552–567):**

```typescript
    // Tauri fs plugin scope-denial error format: "forbidden path: {pathbuf}"
    // Source: plugins-workspace/v2/plugins/fs/src/error.rs — PathForbidden variant.
    // Anchored to the trailing colon to exclude false-positive matches on errors
    // that contain the substring elsewhere (e.g., "operation not permitted on forbidden path component").
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().startsWith('forbidden path:')) {
```

**Ground-truth lock (per RESEARCH §5 lines 569–576):** The upstream Rust source format is anchored at start with literal colon-space — `plugins-workspace` `plugins/fs/src/error.rs`:

```rust
#[error("forbidden path: {0}")]
PathForbidden(PathBuf),
```

`startsWith('forbidden path:')` is the correct tightening.

**Grep acceptance criteria (per RESEARCH §5 lines 638–640):**

```bash
grep -c "startsWith('forbidden path:')" src/pdf/generateQuotePdf.ts   # → 1
grep -c "includes('forbidden path')" src/pdf/generateQuotePdf.ts      # → 0
```

---

### WR-01 — `src/pdf/generateQuotePdf.test.ts:510-525` (Wave 3, bundled WR plan, Task 1)

**Role:** test / vitest mock-driven async assertion
**Data flow:** request-response (single mock invocation, single assertion)

**Analog: the sibling test in the same `describe('writeFile error mapping')` block at lines 527-535** — this test already uses the collapsed pattern (one `generateQuotePdf()` invocation, one `toThrow` assertion). WR-01 brings the "forbidden path" test into structural parity with this sibling.

**Sibling-analog excerpt (`src/pdf/generateQuotePdf.test.ts:527-535`):**

```typescript
it('passes through unrelated writeFile errors unchanged', async () => {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const fakePath = '/Users/x/Desktop/foo.pdf';
  vi.mocked(save).mockResolvedValue(fakePath);
  vi.mocked(writeFile).mockRejectedValue(new Error('disk full'));

  await expect(generateQuotePdf(makeQuote())).rejects.toThrow(/disk full/);
});
```

> Note: single mock pair, single `generateQuotePdf()` invocation inside one `await expect(...).rejects.toThrow(...)`. WR-01 mirrors this exact shape.

**Mocking scaffold (shared across the entire `describe('writeFile error mapping')` block — `generateQuotePdf.test.ts:7-12` and `499-508`):**

```typescript
// Top-of-file hoisted mocks (lines 7-12):
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
}));

// describe-block setup/teardown (lines 500-508):
describe('writeFile error mapping', () => {
  beforeEach(() => {
    vi.stubGlobal('__IS_TAURI__', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
```

**Current state of the test being collapsed (`src/pdf/generateQuotePdf.test.ts:510-525`):**

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

> The bug per `18-REVIEW.md` WR-01: two `generateQuotePdf()` invocations against a single `mockRejectedValue` is sticky-mock fragile.

**Replacement (collapse to single invocation with combined regex, per RESEARCH §5 lines 603–616):**

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

**Why the combined regex is tighter:** The savePath echo must appear at a specific position right after `Cannot save to "`, not anywhere in the message. The em-dash literal `—` (U+2014) is preserved from `generateQuotePdf.ts:339`.

**Grep acceptance criteria:**

```bash
# Pre-WR-01: 2 toThrow in this test; post-WR-01: 1 toThrow (sibling tests at line 527+537 unaffected)
# Confirms collapse landed and didn't break the unrelated sibling tests
grep -c 'rejects.toThrow' src/pdf/generateQuotePdf.test.ts          # was 3, becomes 2
npx vitest run src/pdf/generateQuotePdf.test.ts                     # exit 0 (28 tests still pass)
```

**Cross-reference safety (per RESEARCH §5 lines 626–633):** `grep -n "forbidden path\|this location is restricted" src/pdf/generateQuotePdf.test.ts` returns lines 510 (test name string literal — unchanged), 516 (mock arg — unchanged), and 520 (the assertion regex being collapsed). The other two tests in the block (527, 537) use unrelated assertions. **Edit is surgical; no other test references the collapsed regex.**

---

### WR-02 — Tauri 2.11.x bump (Wave 3, bundled WR plan, Task 2)

**Role:** config / dep manifest edits + auto-regen lockfiles
**Data flow:** doc edit (version strings) + `npm install` + `cargo check` regen

**Analog: Phase 18's atomic-dep-bump pattern** — Phase 18 set the current `@tauri-apps/api: ^2.10.1` pin in `package.json:39` and produced a multi-line `Cargo.lock` diff. WR-02 is the symmetric "bump forward" operation that re-aligns the JS-side pin with the Rust-side crate.

**Pattern source — Phase 18's `18-01-PLAN.md` artifact declarations (lines 30–42):**

```yaml
  artifacts:
    - path: "src-tauri/Cargo.lock"
      provides: "Refreshed lockfile including tauri-plugin-fs and tauri-plugin-dialog (currently missing — declared in Cargo.toml but never resolved)"
      contains: "tauri-plugin-fs"
    - path: "src/pdf/generateQuotePdf.ts"
      provides: "Defensive try/catch around writeFile that detects `forbidden path` and re-throws an actionable Error.message"
      contains: "forbidden path"
```

> The "provides + contains" artifact declaration shape is the planner's convention. WR-02's plan should declare similar entries for `Cargo.toml` (`contains: 'tauri = "2.11"'`), `package.json` (`contains: '"@tauri-apps/api": "^2.11.0"'`), and the two lockfiles (`contains: tauri 2.11.x markers`).

**Current state to edit:**

`src-tauri/Cargo.toml:12`:

```toml
[dependencies]
tauri = { version = "2", features = [] }   # bump to "2.11"
```

`package.json:39`:

```json
"@tauri-apps/api": "^2.10.1",   // re-pin to "^2.11.0"
```

**Verification chain (per RESEARCH §5 lines 768–773 + §"Quick-Reference" Wave 3 task 2):**

```bash
cd src-tauri && cargo check && cd ..               # exit 0
npm run tauri build                                # exit 0
find node_modules/@tauri-apps -path '*/node_modules/*/api/package.json' | wc -l    # returns 0 (dedup confirmed)
find node_modules/@tauri-apps -name package.json | wc -l                            # returns 6 (was 8 pre-bump)
```

**Conditional fallback (per RESEARCH §3 lines 313–360, only fires on Task 2 verify failure):** see "Shared Pattern — checkpoint:human-verify" below.

**Commit pattern (Phase 18 atomic-commit-per-task convention):**

```bash
gsd-sdk query commit "chore(deps): bump tauri crate to 2.11.x + @tauri-apps/api ^2.11.0 (WR-02)" \
  --files "src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json"
```

---

## Shared Patterns

### `checkpoint:human-verify` XML shape (Phase 18 → reused as Wave 3 Task 3 conditional fallback)

**Source:** `.planning/phases/18-tauri-fs-scope-fix/18-01-PLAN.md:244-315` — read verbatim. Phase 18's Task 3 proved this pattern end-to-end (executed against UAT-A through UAT-D with the resume-signal correctly routing the orchestrator's continuation agent).

**Apply to:** Wave 3 bundled WR plan, as the **conditional** Task 3 fallback (per CONTEXT.md `<specifics>` — fires ONLY if Task 2's `cargo check` / `npm run tauri build` exits non-zero). The plan must NOT include this as a routine happy-path task — RESEARCH §2 lines 242–250 is the decisive evidence that routine UAT-A re-run is **not** required (zero `fs:*` / `dialog:` / capability-ACL semantic changes in 2.11.x).

**Template anatomy (planner pastes this shape verbatim, swapping content):**

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <name>Task N: …</name>
  <files>(no file modifications — runtime/decision-only checkpoint)</files>
  <read_first>
    - {prior-task SUMMARY-equivalent or RESEARCH file with the options}
    - {files the prior task modified (current state)}
  </read_first>
  <what-built>
    {one-paragraph context for what's at the checkpoint — fed to the orchestrator's
    continuation agent so it knows what to do after the human signals}
  </what-built>
  <action>
    The developer (user) performs the following — Claude does NOT execute these steps.
    {numbered concrete steps the HUMAN performs}
  </action>
  <verify>
    <human-check>{the literal condition the human attests to}</human-check>
  </verify>
  <acceptance_criteria>
    {same shape as auto tasks but written from the human's perspective}
  </acceptance_criteria>
  <done>
    {what has been confirmed by the time the checkpoint releases}
  </done>
  <resume-signal>
    Type "{token}" if {condition}. If {alternate condition}, type "{alt-token}" instead.
    If neither path is acceptable, describe the situation and stop — the plan needs a
    different recovery strategy.
  </resume-signal>
</task>
```

**Concrete fallback wording for WR-02 (per RESEARCH §3 lines 313–360):** the `<resume-signal>` accepts `"rollback"` (revert all WR-02 edits to pre-task state) or `"accept-dual-copy"` (revert only `Cargo.toml`/`Cargo.lock`, keep `@tauri-apps/api` re-pin, add docs entry). **No silent strategy-switching** per CONTEXT.md `<specifics>` — the executor cannot quietly fall back to strategy (a) plugin-downgrade (rejected by D-05a) or strategy (c) (only as documented escape hatch with user consent).

**Wiring note (novel to Phase 24, per RESEARCH §2 line 261):** The fallback is a `checkpoint:human-verify` task tagged conceptually as `gate="conditional"`, documented as "only invoked if the prior task's verify fails." The plan body expresses this as a `<verification>` rule rather than always-present task. Phase 18 used checkpoints unconditionally; Phase 24 introduces conditional firing. The gsd-executor's checkpoint orchestration handles this correctly because `<resume-signal>` routes return-to-workflow regardless of whether the prior task succeeded or failed.

---

### Atomic-commit-per-task (Phase 18 → Wave 3 bundled WR plan)

**Source:** Phase 18 shipped 4 atomic commits inside its 3-task plan (per CONTEXT.md `<code_context>` "Established Patterns" + `git log` evidence in the recent commits list).

**Apply to:** Wave 3 bundled WR plan — one commit per WR or one commit per task (executor's call per CONTEXT.md D-06 discretion note).

**Recommended split (per RESEARCH §5 "Cross-Cutting Templates" lines 783–793):**

```bash
# Task 1 — WR-01 + WR-03 combined (small TS edits, low-risk, one commit)
gsd-sdk query commit "fix(pdf): tighten forbidden-path match + collapse double-invocation test (WR-01 + WR-03)" \
  --files "src/pdf/generateQuotePdf.ts src/pdf/generateQuotePdf.test.ts"

# Task 2 — WR-02 (dep bump, high-churn lockfile, one commit)
gsd-sdk query commit "chore(deps): bump tauri crate to 2.11.x + @tauri-apps/api ^2.11.0 (WR-02)" \
  --files "src-tauri/Cargo.toml src-tauri/Cargo.lock package.json package-lock.json"
```

**Hooks invariant (per project CLAUDE.md):** No `--no-verify` on any commit. Pre-commit hooks run unconditionally — Phase 18 followed this without exception. Apply to all 6 Phase 24 plans.

---

### Doc-commit message convention (`docs(phase-N):` prefix)

**Source:** Recent commit log (per `git log` in this branch's state):

```
0e0249c docs(state): record phase 24 context session
0258d41 docs(24): capture phase context
670287b docs(roadmap): fold Phase 18 review WR-01/02/03 into Phase 24
d5267b7 docs(phase-18): complete phase execution
7d3e0f5 docs(18): add code review report
```

**Apply to:** Wave 1 NYQ-01..04 commits, Wave 2 NYQ-05 commit. Use `docs(phase-24):` prefix for all 5 doc-edit commits, matching the established project convention.

```bash
docs(phase-24): {N}-VALIDATION.md — Nyquist compliance ({NYQ-XX})
docs(phase-24): close Phase 13 UAT — 2 smoke + 6 rubber-stamp (NYQ-05)
```

Wave 3 uses `fix(pdf):` / `chore(deps):` prefixes (code edits, not docs).

---

### `tsc -b` not `tsc --noEmit` (project CLAUDE.md global rule)

**Source:** project CLAUDE.md — "Use `tsc -b` (not `tsc --noEmit`) for TypeScript verification" and `package.json:8` build chain (`... && tsc -b && vite build && ...`).

**Apply to:** Wave 3 WR plan acceptance criteria. The TypeScript verification step is `npx tsc -b`, never `--noEmit`. The full project gate is `npm run build` which invokes the 8-gate chain.

```bash
npx tsc -b           # exit 0
npm run build        # the 8-gate chain — exit 0
```

---

### Dev server port 4173 (project CLAUDE.md)

**Source:** `vite.config.ts` (port pinned) + project CLAUDE.md "Always use port 4173".

**Apply to:** Wave 2 NYQ-05 smoke-test executor steps. Before starting `npm run dev`, kill any pre-existing server on 4173 per global CLAUDE.md "Kill all dev servers before starting a new one." For NYQ-05 the dev server is the web app (port 4173) **not** `tauri:dev` — the smoke-test surfaces (Default Tax Rate field + Per-job Tax Rate) are IndexedDB-backed web flows that work identically in the web app and the desktop wrapper. Using `npm run dev` avoids the Rust rebuild cycle.

---

## No Analog Found

| File | Role | Data Flow | Reason | Planner Guidance |
|------|------|-----------|--------|------------------|
| (none) | — | — | — | Every Phase 24 file has either an exact-self analog (in-place edits), a Phase 18 / Phase 13 doc-shape analog, or a sibling-test analog. No file needs fallback to RESEARCH.md generic patterns. |

> **Footnote on the apparent "no-analog" candidate `17-VALIDATION.md`:** The Phase 17 trivial-case file appears at first glance to need a fresh pattern source (Phase 17 has nothing meaningfully new to validate — all 4 declared requirements lean on pre-existing global guards). It is NOT actually no-analog: it shares the State B reconstruction shape with NYQ-02/03, just at the minimum-viable extreme. Per RESEARCH §1 lines 127–135, the template + the "Wave 0 Requirements: None — existing 8-gate build chain covers all phase requirements" line is the entire delta. No new pattern needed.

---

## Metadata

**Analog search scope:**
- `.planning/phases/13-tax-model-ui-sweep/` (VALIDATION.md + VERIFICATION.md — both read in full)
- `.planning/phases/18-tauri-fs-scope-fix/18-01-PLAN.md` (lines 1–90 frontmatter + Task 3 checkpoint at 244–315)
- `src/pdf/generateQuotePdf.ts` (lines 325–345 — the WR-03 edit site + surrounding catch block)
- `src/pdf/generateQuotePdf.test.ts` (lines 1–60 + 499–547 — the mock scaffold + the entire `writeFile error mapping` describe block including the sibling-analog test at 527–535)
- `src-tauri/Cargo.toml` (full file, 26 lines)
- `package.json` (full file, 63 lines — for the `@tauri-apps/api: ^2.10.1` pin location)
- `git log` (5 most recent commits — for commit-message convention)

**Files scanned:** 7
**Pattern extraction date:** 2026-05-25
**Analog match quality summary:**
- Exact (same file, evolved state): 4 files (`13-VALIDATION.md`, `13-VERIFICATION.md`, `generateQuotePdf.ts:337`, `package.json`)
- Sibling-test match (same describe block): 1 file (`generateQuotePdf.test.ts`)
- Template-derived (workflow + Phase 13 reference): 3 files (`15-VALIDATION.md`, `15.1-VALIDATION.md`, `17-VALIDATION.md`)
- Phase 18 atomic-bump precedent: 3 files (`Cargo.toml`, `Cargo.lock`, `package-lock.json`)

**Key cross-cutting patterns identified:**
1. **`/gsd:validate-phase` workflow tooling owns the State A/B file generation** — Phase 24 plans 1–4 are thin wrappers that invoke the workflow and verify the artifact; the planner does not duplicate the template inline.
2. **Phase 18's `checkpoint:human-verify` XML shape is the canonical fallback gate** — reused conditionally for Wave 3 Task 3 (build-failure recovery), not as a routine post-bump step.
3. **Sibling-test parity drives the WR-01 collapse** — the structurally simpler "passes through unrelated writeFile errors unchanged" test at lines 527–535 is the target shape; bringing the "forbidden path" test into parity removes the sticky-mock fragility.
4. **`docs(phase-24):` commit prefix for markdown-only commits, `fix(pdf):` / `chore(deps):` for code/dep commits** — matches the project's commit-message convention as seen in recent `git log`.

---

*Phase: 24-nyquist-contracts-phase-13-visual-uat-phase-18-review-carryover*
*Mapped: 2026-05-25 by gsd-pattern-mapper*
