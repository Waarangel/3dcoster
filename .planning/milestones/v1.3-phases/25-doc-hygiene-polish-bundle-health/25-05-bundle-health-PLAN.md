---
phase: 25-doc-hygiene-polish-bundle-health
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - vite.config.ts
autonomous: true
requirements: [PERF-05, PERF-06]
must_haves:
  truths:
    - "`npm run build` emits ZERO chunk-graph warnings — the `Circular chunk: vendor -> react-vendor -> vendor` warning is gone (PERF-05)"
    - "vite.config.ts manualChunks routes all `react-*` packages (react, react-dom, react-router, react-router-dom, react-window, @remix-run/router) into the `react-vendor` chunk explicitly (PERF-05)"
    - "PERF-06 vendor classification reviewed within ~30-minute time-box per D-07 (include + time-box to ~30 minutes inside Plan 5); the plan summary documents either (a) the actionable split shipped + measured benefit, OR (b) no actionable splits found within time-box — D-07a justifies time-boxing over deferring; D-07b enforces Phase 11 perf-gate philosophy as the guardrail"
    - "Phase 11 perf-gate philosophy preserved (D-07b) — any PERF-06 split must show analyzer-confirmed benefit, no warnings introduced, gates stay green"
    - "Plan scope follows D-01 (5 plans, surface-grouped, single wave, parallel-safe — this plan owns vite.config.ts only) and D-01b (atomic commit per PERF item; no --no-verify; gsd-sdk query commit helper)"
  artifacts:
    - path: "vite.config.ts"
      provides: "Updated manualChunks routing `react-*` packages → `react-vendor`"
      contains: "react-router"
  key_links:
    - from: "vite.config.ts manualChunks function"
      to: "Rollup chunk graph"
      via: "explicit `id.includes('/react-router')` etc. matchers"
      pattern: "react-router\\|react-window\\|@remix-run"
---

<objective>
Bundle health batch — close PERF-05 (Rollup `Circular chunk: vendor -> react-vendor -> vendor` warning) and review PERF-06 (vendor chunk classification) within a strict 30-minute time-box per 25-CONTEXT.md D-07.

Purpose:
- **PERF-05** (REQUIREMENTS.md line 76): Rollup is emitting a `Circular chunk: vendor -> react-vendor -> vendor` warning because `react-router-dom`, `react-router`, `@remix-run/router`, and `react-window` fall into the `vendor` fallback in `vite.config.ts` `manualChunks` (lines 101–135), but their transitive imports point back at core React packages already in `react-vendor`. Fix: expand the `react-vendor` catch to claim all `react-*` packages explicitly. Choice between regex form and explicit-OR-chain — both acceptable per CONTEXT.md "Pre-resolved" note; executor's discretion. Closes [TECH-DEBT D12].
- **PERF-06** (REQUIREMENTS.md line 77): Vendor chunk classification reviewed — explicitly OPTIONAL per the requirement ("reviewed" is the bar, not "delivered a size reduction"). Per D-07 + D-07a + D-07b: time-box to ~30 min inside this plan; if a clean win surfaces under Phase 11's perf-gate philosophy (analyzer-confirmed benefit, no warnings introduced, gates stay green), ship it; otherwise the second commit is a summary-only "PERF-06 reviewed — no actionable splits within 30-min time-box; deferred to future perf-gate work." Closes [TECH-DEBT D13].

Both PERF items share `vite.config.ts` exclusively — single plan, single file, 2 atomic commits (one for PERF-05, one for PERF-06 — even if PERF-06 is review-only with no code change, the second commit captures the time-box outcome via the plan summary). This pattern matches 25-CONTEXT.md Integration Points note: "PERF-05 + PERF-06 share the same file — Plan 5 is one plan, one file, two commits."

Phase 11 perf-gate philosophy is the guardrail (D-07b): the 300 KB gz main-chunk ceiling and the principle that vendor splitting must demonstrate a measurable win. Any PERF-06 split must clear that bar.

Output: 2 atomic commits + `npm run build` clean with zero chunk-graph warnings + the build log captured in the plan summary as proof.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md
@.planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md
@vite.config.ts
@package.json

<interfaces>
<!-- Extracted from 25-PATTERNS.md + vite.config.ts read 2026-05-25 -->

Current `manualChunks` function (vite.config.ts lines 101–135):
```typescript
manualChunks(id) {
  if (id.includes('/src/utils/') || id.includes('vite/preload-helper.js')) {
    return 'utils';
  }
  if (id.includes('/src/pdf/') || id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
    return 'pdf';
  }
  if (id.includes('node_modules')) {
    if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
    if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
    return 'vendor';
  }
}
```

The `react-vendor` rule at line 131 catches only `/react/` and `/react-dom/`. `react-router-dom`, `react-router`, `react-window`, and `@remix-run/router` ALL fall through to the `'vendor'` fallback at line 133 — and these packages transitively import core React, creating the `vendor -> react-vendor -> vendor` cycle.

Critical ordering constraint (lines 95–100 already document this): the `pdf` check at line 127 MUST come BEFORE the `node_modules` block (so jspdf doesn't land in `vendor` and defeat lazy-loading). The new react-router etc. catches must stay INSIDE the `node_modules` guard and AFTER the pdf check — do not reorder.

Two acceptable PERF-05 implementations per 25-PATTERNS.md (executor's discretion):

OPTION A — Explicit OR chain (verbose, readable):
```typescript
if (id.includes('/react/') || id.includes('/react-dom/')
  || id.includes('/react-router') || id.includes('/react-window')
  || id.includes('/@remix-run/')) {
  return 'react-vendor';
}
```

OPTION B — Single regex (compact):
```typescript
if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|react-window|@remix-run)\//.test(id)) {
  return 'react-vendor';
}
```

Note: `react-router-dom` is covered by the prefix `react-router` substring match in Option A (since `/react-router-dom/` contains `/react-router`), so no separate `react-router-dom` entry needed. In Option B, listing both is harmless (redundant but explicit).

PERF-06 review process (time-boxed, per D-07):
1. Run `npm run build -- --mode analyze` (the visualizer plugin loads conditionally per line 71 of vite.config.ts).
2. Inspect `dist/stats.html` for the vendor chunk composition.
3. Identify any single library >50 KB used by exactly one route (e.g., a one-off lib in `vendor` that could split out cleanly).
4. If a clean candidate emerges: add a matcher above the `return 'vendor'` fallback; re-run analyzer; confirm benefit.
5. If nothing clean surfaces in 30 minutes: STOP; PERF-06 is satisfied by the review itself per requirement wording ("reviewed; opportunistic size reduction where the change is safe").
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: PERF-05 — expand react-vendor manualChunks to claim all react-* packages</name>
  <files>vite.config.ts</files>
  <read_first>
    - vite.config.ts (FULL FILE — confirm current `manualChunks` function structure at lines 101–135; confirm lines 95–100 comment block about ordering rationale; confirm line 131 is `if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';`)
    - package.json (read `dependencies` block — confirm which `react-*` packages are actually installed: react, react-dom, react-router-dom, react-router, react-window, @remix-run/router are the expected v1.2 set; if additional `react-*` packages are present, include them in the matcher)
    - .planning/REQUIREMENTS.md (PERF-05 line 76 — locked goal: route all `react-*` packages into `react-vendor`; build emits no chunk-graph warnings)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`vite.config.ts — PERF-05` section — two implementation options spelled out)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (D-07b — Phase 11 perf-gate philosophy: analyzer-confirmed benefit, no warnings introduced)
  </read_first>
  <action>
    Per PERF-05 + 25-PATTERNS.md, edit `vite.config.ts` `manualChunks` function (around line 131):

    STEP 1 — Pre-flight: confirm the list of installed `react-*` packages:
    `grep -E '"(react|@remix-run)[^"]*":' package.json`
    Expected output: `react`, `react-dom`, `react-router-dom`, `react-router` (transitive dep of react-router-dom), `react-window`, and `@remix-run/router` (transitive). The grep MAY show packages not in the expected set — if so, include them in the matcher to be safe.

    STEP 2 — Replace the existing line 131 catch:
    BEFORE:
    `if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';`

    AFTER (Option A — explicit OR chain, RECOMMENDED for readability):
    ```typescript
    if (id.includes('/react/') || id.includes('/react-dom/')
      || id.includes('/react-router') || id.includes('/react-window')
      || id.includes('/@remix-run/')) {
      return 'react-vendor';
    }
    ```

    Note: `react-router-dom` is covered by `/react-router` substring (paths contain `/react-router-dom/` which includes `/react-router`). Verify after the build that no `react-router-dom` files leak into `vendor`.

    Alternatively use Option B — regex form (executor's discretion):
    ```typescript
    if (/\/node_modules\/(react|react-dom|react-router(-dom)?|react-window|@remix-run\/router)\//.test(id)) {
      return 'react-vendor';
    }
    ```

    Both options are acceptable per 25-PATTERNS.md. The regex form is more compact but harder to scan — the OR-chain is the recommended default.

    STEP 3 — Add a comment block ABOVE the changed line referencing PERF-05 + Phase 25 (per 25-PATTERNS.md "Critical ordering constraint" note: "add a note referencing PERF-05 Phase 25"):
    ```typescript
    // PERF-05 (Phase 25): explicitly route ALL react-* packages and @remix-run/router
    // into react-vendor. Previously only /react/ + /react-dom/ were caught, leaving
    // react-router-dom + react-window + @remix-run/router to fall through to the
    // vendor fallback — their transitive imports of core React then created the
    // `Circular chunk: vendor -> react-vendor -> vendor` Rollup warning. Catching
    // all react-* upfront breaks the cycle.
    ```

    STEP 4 — Critical ordering check: this catch MUST stay INSIDE the `if (id.includes('node_modules'))` block AND AFTER the `pdf` check above it (per the existing line 95–100 comment block — do NOT reorder).

    STEP 5 — Verify the build:
    `npm run build 2>&1 | tee /tmp/25-05-perf05-build.log`
    Confirm:
    - Exit code 0
    - ZERO chunk-graph warnings in the log (especially: the previous `Circular chunk: vendor -> react-vendor -> vendor` warning is gone)
    - Capture the last 30 lines of the build log in the plan summary (REQUIREMENTS.md PERF-05: "Build emits no chunk-graph warnings" — the proof goes in the summary).

    STEP 6 — Confirm no regression in chunk content:
    `ls -lh dist/assets/`
    The `react-vendor-*.js` chunk should be LARGER (now contains react-router etc.). The `vendor-*.js` chunk should be SMALLER (no longer claims the react-* libs). The `pdf-*.js` chunk size unchanged (PDF lazy-load preserved). The `utils-*.js` chunk size unchanged.

    Commit message focus: `fix(25-05): route all react-* packages to react-vendor chunk (PERF-05)`.
  </action>
  <verify>
    <automated>grep -E "react-router|react-window|@remix-run" vite.config.ts | head -3 && npm run build > /tmp/25-05-perf05-verify.log 2>&1; CIRCULAR=$(grep -cE "Circular chunk.*vendor.*react-vendor.*vendor" /tmp/25-05-perf05-verify.log); echo "Circular warnings: $CIRCULAR (expected: 0)"; test "$CIRCULAR" = "0" && echo "PERF-05 pass: no circular chunk warnings"</automated>
  </verify>
  <done>
    `grep -E "react-router|react-window|@remix-run" vite.config.ts` returns ≥ 1 match in the manualChunks function; `npm run build` exits 0 and emits ZERO `Circular chunk` warnings; `react-vendor-*.js` chunk in `dist/assets/` is larger than its pre-edit size (proves react-router etc. moved into it); commit landed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: PERF-06 — vendor chunk classification review (30-min time-box)</name>
  <files>vite.config.ts</files>
  <read_first>
    - vite.config.ts (FULL FILE — post-Task-1 state)
    - package.json (read `dependencies` — full list of installed libs, to identify any 50+ KB single-route candidates for splitting)
    - .planning/REQUIREMENTS.md (PERF-06 line 77 — OPTIONAL; "reviewed; opportunistic size reduction where the change is safe")
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-CONTEXT.md (D-07 + D-07a + D-07b — time-box to ~30 min; Phase 11 perf-gate philosophy is the guardrail)
    - .planning/phases/25-doc-hygiene-polish-bundle-health/25-PATTERNS.md (`PERF-06 review process` in interfaces block)
  </read_first>
  <action>
    Per PERF-06 + D-07 (time-boxed to ~30 min):

    STEP 1 — Start a wall-clock timer (executor self-times via "now" + 30 min target). If unable to self-time, mark the start time in the plan summary scratch and check elapsed at decision points.

    STEP 2 — Run the analyzer build:
    `npm run build -- --mode analyze 2>&1 | tee /tmp/25-05-perf06-analyze.log`
    This loads the `rollup-plugin-visualizer` (per vite.config.ts line 71) and emits `dist/stats.html`.

    STEP 3 — Open `dist/stats.html` (or read the bundle composition from the analyzer log) and identify the largest contributors to the `vendor` chunk. For each library >50 KB:
    - Is it used by exactly one route or component? (grep the codebase for imports of the library)
    - Could it be lazy-loaded behind a dynamic `import()` like the PDF chunk? (only if its consumer is itself lazy-loaded)
    - Would splitting it produce a new chunk that's loaded only when its consumer runs? (analyzer benefit check)

    STEP 4 — Decision tree:

    BRANCH A (clean candidate found in ≤30 min):
    - Add a matcher above the `return 'vendor'` fallback in `manualChunks`. Example:
      ```typescript
      if (id.includes('/some-large-lib/')) {
        return 'some-large-lib';
      }
      ```
    - Re-run `npm run build` (without `--mode analyze`); confirm:
      - Exit 0
      - No new chunk-graph warnings
      - Main chunk size still under Phase 11's 300 KB gz ceiling
      - The new chunk is loaded only by the route(s) that consume it (not eagerly preloaded)
    - Document the split in the plan summary: library name, old vendor size, new chunk size, gz total impact.
    - Commit the change as Task 2's commit: `perf(25-05): split <lib> from vendor chunk (PERF-06)`.

    BRANCH B (no clean candidate, or candidate found but does not clear Phase 11 perf-gate):
    - Do NOT edit `vite.config.ts` further.
    - Commit a no-code-change marker via the plan summary documentation alone — Task 2 becomes a summary-only commit landing the plan summary update that captures the review outcome.
    - Per D-07a + REQUIREMENTS.md PERF-06 wording ("reviewed; opportunistic size reduction where the change is safe"), "reviewed" is the requirement — no code change is required to close PERF-06 if no actionable split is identified.
    - The commit captures: "PERF-06 reviewed: no actionable splits within 30-min time-box; deferred to future perf-gate work." (The commit is still made — it touches the plan-summary file `.planning/phases/25-doc-hygiene-polish-bundle-health/25-05-SUMMARY.md` which is created at plan completion anyway. Use that as the commit's payload OR an empty commit `git commit --allow-empty -m "..."` is acceptable if the summary file lands as part of Task 1.)

    STEP 5 — Hard time-box: if 30 minutes elapses and the analyzer scan is still unfinished, STOP. Document the truncation in the plan summary (e.g., "Time-boxed scan reviewed N of M vendor libs; deferred remaining N candidates to future perf-gate work"). Do NOT extend the time-box without user sign-off — per D-07a the cap captures free wins, it is not a target.

    STEP 6 — Phase 11 perf-gate philosophy check (D-07b):
    - If any split was made, confirm the main-chunk gz size remains under 300 KB.
    - Confirm zero new Rollup warnings.
    - If the split would break either gate, REVERT the change and document the rejection in the plan summary.

    Commit message focus (Branch A): `perf(25-05): split <lib> from vendor chunk (PERF-06)`.
    Commit message focus (Branch B): `chore(25-05): document PERF-06 vendor review outcome — no actionable splits in time-box`.
  </action>
  <verify>
    <automated>npm run build > /tmp/25-05-perf06-final.log 2>&1 && CHUNK_WARN=$(grep -cE "Circular chunk|chunk graph" /tmp/25-05-perf06-final.log); echo "Chunk warnings: $CHUNK_WARN (expected: 0)"; test "$CHUNK_WARN" = "0" && ls -lh dist/assets/*.js | tail -10 && echo "PERF-06 pass: build clean + chunk inventory captured"</automated>
  </verify>
  <done>
    `npm run build` exits 0 with zero chunk-graph warnings; `dist/assets/` chunk inventory is captured in the plan summary; PERF-06 outcome documented (either a shipped split with measured benefit, or a "no actionable splits in time-box" summary line); commit landed via `gsd-sdk query commit` (no `--no-verify`). Main chunk gz size still under Phase 11's 300 KB ceiling.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build-time only | `vite.config.ts` is a build-time configuration file. Edits affect chunk topology, not runtime behavior. No user-input surface, no new dependency added. |
| chunk-graph routing | The `manualChunks` function maps module IDs (filesystem paths under `node_modules/`) to chunk names. Cannot be influenced by user input — paths come from Rollup's resolution of installed package contents. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25-05-01 | Tampering | `manualChunks` regex/matcher | accept | Matchers operate on filesystem paths from Rollup's module-resolver. No user-input flow. Worst case: misrouting a package between chunks causes a build warning OR a runtime ChunkLoadError on first import — caught immediately by `npm run build`'s success criterion (zero warnings) + manual UAT (page loads without console error). |
| T-25-05-02 | Denial of service | Bundle bloat from misrouted chunk | mitigate | Phase 11 perf-gate philosophy enforced via D-07b: main chunk gz size remains under 300 KB; any PERF-06 split must clear the analyzer-benefit bar. Build verification in `<verify>` confirms gates stay green. |
| T-25-05-03 | Information disclosure | Build output contains chunk topology | accept | Chunk filenames + sizes are public — they ship to the browser as-is. No secrets in the chunk-graph. The split itself doesn't expose any code that wasn't already in the bundle. |
| T-25-05-SC | Tampering | npm/pip/cargo installs | mitigate | N/A — no package installs in this plan. RESEARCH.md Package Legitimacy Audit table not required. Note: `rollup-plugin-visualizer` is already installed (vite.config.ts line 5) — its use in `--mode analyze` is unchanged. |

**ASVS Level 1** — build-time config edit with no user-input surface. Block threshold: HIGH severity (none present).
</threat_model>

<verification>
- `grep -E "react-router|react-window|@remix-run" vite.config.ts` returns ≥ 1 match in the manualChunks block
- `npm run build` exits 0
- `grep -cE "Circular chunk|chunk graph" /tmp/25-05-perf06-final.log` returns `0` (PERF-05's locked goal: build emits no chunk-graph warnings — per REQUIREMENTS.md line 76)
- `dist/assets/react-vendor-*.js` chunk is larger than its pre-edit baseline (informational — measure both before + after in the plan summary using `du -h dist/assets/react-vendor-*.js`)
- `dist/assets/vendor-*.js` chunk is smaller than its pre-edit baseline (react-* libs moved out)
- Main chunk gz size remains under Phase 11's 300 KB ceiling (check `du -h dist/assets/index-*.js` or the analyzer report — capture in summary)
- PDF chunk size unchanged (lazy-load preserved — sanity check that PERF-05/06 edits did not regress Phase 17 PDF-04 closure)
- 2 atomic commits via `gsd-sdk query commit`; no `--no-verify`
- Build log captured in `.planning/phases/25-doc-hygiene-polish-bundle-health/25-05-SUMMARY.md` as proof of PERF-05's "no chunk-graph warnings" success criterion
</verification>

<success_criteria>
- PERF-05 closed: `vite.config.ts manualChunks` claims `react`, `react-dom`, `react-router*`, `react-window`, `@remix-run/router` for `react-vendor`; `npm run build` emits ZERO chunk-graph warnings (no `Circular chunk: vendor -> react-vendor -> vendor`)
- PERF-06 reviewed: 30-min time-box honored; outcome documented in plan summary (either shipped split with measured benefit + analyzer evidence, OR "no actionable splits — deferred" with the review log captured)
- `tsc -b` exits 0 (sanity — even though no .ts file is touched, the project's standard verification)
- `npm run build` exits 0; main chunk gz size still under Phase 11's 300 KB ceiling; PDF chunk still lazy-loaded
- 2 atomic commits landed (PERF-05 + PERF-06 — even if PERF-06 commit is a summary-only documentation commit)
- No `features.ts` entries added; no `<NewBadge>` JSX added
</success_criteria>

<output>
Create `.planning/phases/25-doc-hygiene-polish-bundle-health/25-05-SUMMARY.md` on completion. Capture:
1. The exact `manualChunks` diff (before/after) for PERF-05
2. The last 30 lines of the post-PERF-05 `npm run build` log, including the confirmation no `Circular chunk` warnings appear
3. Pre-edit and post-edit chunk sizes for `react-vendor-*.js`, `vendor-*.js`, `pdf-*.js`, `utils-*.js`, and `index-*.js` (gz where available) — proves the split moved bytes in the expected direction without regressing PDF lazy-load
4. Main chunk gz size with explicit comparison to Phase 11's 300 KB ceiling
5. PERF-06 outcome — Branch A (shipped split): library name, old vendor size, new chunk size, analyzer screenshot reference if generated, justification under Phase 11's perf-gate philosophy. Branch B (no actionable split): the 30-min scan summary (which libs were considered, why each was rejected, what was deferred to future perf-gate work)
6. Confirmation of "no chunk-graph warnings" (REQUIREMENTS.md PERF-05 success criterion #11 — locked acceptance bar)
</output>
</content>
</invoke>