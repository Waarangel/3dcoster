---
phase: 18-tauri-fs-scope-fix
plan: 01
subsystem: desktop
tags: [tauri, capability, fs-scope, pdf, error-handling, vitest]

# Dependency graph
requires: []
provides:
  - "Tauri fs:allow-write-file inline-scoped to $HOME/**/* (Desktop, Documents, Downloads, anywhere under home)"
  - "Defensive try/catch in generateQuotePdf.ts: forbidden-path error surfaces actionable banner instead of generic failure"
  - "Unit test coverage for writeFile error-mapping branch (3 new tests in describe('writeFile error mapping'))"
  - "Cargo.lock refreshed with tauri-plugin-fs v2.5.0 + tauri-plugin-dialog v2.7.0"
  - "Empirical confirmation that DESK-01 audit bug was REAL and REPRODUCIBLE (UAT-D Result A)"
affects: [desktop, pdf-generation, capability-acl]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-permission inline scope on Tauri 2 capability entries (Option C) — keeps scope narrowed to a single command; preferred over global fs:scope"
    - "Forbidden-path substring detection in try/catch: err.message.toLowerCase().includes('forbidden path') maps to actionable re-throw"
    - "@tauri-apps/api version pinned to match Rust crate minor version (avoid minor-version mismatch build failures)"

key-files:
  created: []
  modified:
    - src-tauri/capabilities/default.json
    - src-tauri/Cargo.lock
    - src/pdf/generateQuotePdf.ts
    - src/pdf/generateQuotePdf.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Option C (per-permission inline scope on fs:allow-write-file) chosen over Option A (global fs:scope broadening) — scopes the write access to the writeFile command only, defense-in-depth against future fs:allow-read-file additions"
  - "glob form $HOME/**/* confirmed correct per RESEARCH Pattern 1 — matches nested paths; $HOME/* (direct children only) would re-introduce the bug"
  - "@tauri-apps/api pinned to 2.10.1 to align with Rust crate 2.10.2; pre-existing minor-version mismatch was blocking the build"
  - "UAT-D Result A: audit's mechanistic bug IS real and reproducible — Task 1 was the load-bearing fix, NOT just preventive hardening"

patterns-established:
  - "Tauri capability: use per-permission inline allow list over global fs:scope — eliminates ACL ambiguity and limits blast radius"
  - "writeFile error mapping: detect forbidden-path via substring check on Tauri's fixed error format from error.rs PathForbidden variant"

requirements-completed: [DESK-01]

# Metrics
duration: 85min
completed: 2026-05-25
---

# Phase 18 Plan 01: Tauri fs:scope Fix Summary

**Per-permission inline-scoped fs:allow-write-file ($HOME/**/*) closes DESK-01 — UAT-D Result A confirms the audit's Desktop-save bug was real and reproducible; defensive try/catch maps forbidden-path errors to an actionable red banner**

## Performance

- **Duration:** ~85 min (Tasks 1+2 executed, then checkpoint:human-verify for UAT, UAT performed and signed off same session)
- **Started:** 2026-05-25T~10:00Z (approximate)
- **Completed:** 2026-05-25T~11:45Z (post-UAT sign-off)
- **Tasks:** 3 (Task 1: capability + build; Task 2: defensive catch + tests; Task 3: manual UAT)
- **Files modified:** 6

## Accomplishments

- Closed DESK-01 (CRITICAL): desktop users can now save PDFs to Desktop, Documents, Downloads, and anywhere under `$HOME` — the save dialog no longer silently rejects paths outside `$DOWNLOAD/*`
- UAT-D Result A confirmed: the audit's mechanistic claim was correct and empirically validated — the Desktop-save failure DOES reproduce when the scope is reverted to `$DOWNLOAD/*`, meaning Task 1 (the broader inline scope) was the load-bearing fix
- Task 2's defensive catch branch fires correctly: the actionable red banner message (including the user's chosen path and "this location is restricted" advice) appears instead of the generic "Could not generate quote."
- 3 new unit tests added to `generateQuotePdf.test.ts` (25 → 28 tests): forbidden-path mapping, unrelated-error pass-through, cancelled-dialog silent resolve

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace fs:scope with inline-scoped fs:allow-write-file (Option C)** - `f6b790b` (fix)
2. **Task 2: Defensive try/catch around writeFile with unit-test coverage** - `589f774` (feat)
3. **Task 3: Manual UAT checkpoint (STATE mid-plan update)** - `e14732a` (chore)

**Plan metadata:** (this commit — docs: complete plan 18-01)

## Files Created/Modified

- `src-tauri/capabilities/default.json` — Permissions array collapsed from 6 to 5 entries; bare `"fs:allow-write-file"` + separate `{ "identifier": "fs:scope", "allow": [{ "path": "$DOWNLOAD/*" }] }` replaced by single inline-scoped entry `{ "identifier": "fs:allow-write-file", "allow": [{ "path": "$HOME/**/*" }] }`
- `src-tauri/Cargo.lock` — First-time resolution of tauri-plugin-fs v2.5.0 + tauri-plugin-dialog v2.7.0 (were declared in Cargo.toml but never resolved); +71/-1 lines (72-line diff)
- `src/pdf/generateQuotePdf.ts` — try/catch wrapping `await writeFile(savePath, ...)`: detects `forbidden path` substring, re-throws `Cannot save to "${savePath}" — this location is restricted. Try saving to Downloads, Documents, or Desktop instead.`; unrelated errors re-thrown unchanged
- `src/pdf/generateQuotePdf.test.ts` — New `describe('writeFile error mapping')` block with 3 tests; vi.mock hoisted to top-level per Vitest best practice; uses `vi.stubGlobal('__IS_TAURI__', true)` in beforeEach
- `package.json` — `@tauri-apps/api` pinned to `2.10.1` (deviation fix; see below)
- `package-lock.json` — Updated lockfile reflecting the pin

## Decisions Made

- **Option C chosen** (per-permission inline scope on `fs:allow-write-file`) rather than the simpler Option A (global `fs:scope` broadening). Inline scope limits write-surface expansion to the writeFile command only — future addition of `fs:allow-read-file` won't inherit the broad `$HOME/**/*` scope accidentally.
- **glob form `$HOME/**/*`** confirmed correct per RESEARCH Pattern 1. `$HOME/*` (direct children) would only allow files directly in the home folder, re-introducing the Desktop bug. `$HOME/**` (without trailing `/*`) drops file leaves in some implementations. `$HOME/**/*` is the documented idiomatic form.
- **UAT-D Result A outcome** recorded as institutional knowledge: the audit's mechanistic claim was real, not theoretical. The load-bearing mechanism was the Tauri capability ACL (Task 1), not `tauri-plugin-dialog`'s runtime `scope.allow_file()` auto-allow. The auto-allow did NOT absorb the bug in practice.

## Task 1 Outcomes: Capability Change

**Pre-fix `src-tauri/capabilities/default.json` permissions array (6 entries):**
```json
"permissions": [
  "core:default",
  "shell:default",
  "window-state:default",
  "dialog:allow-save",
  "fs:allow-write-file",
  { "identifier": "fs:scope", "allow": [{ "path": "$DOWNLOAD/*" }] }
]
```

**Post-fix (5 entries):**
```json
"permissions": [
  "core:default",
  "shell:default",
  "window-state:default",
  "dialog:allow-save",
  { "identifier": "fs:allow-write-file", "allow": [{ "path": "$HOME/**/*" }] }
]
```

Key facts:
- `jq '.permissions | length' default.json` → `5` (was 6)
- `grep -c '"identifier": "fs:allow-write-file"'` → `1`
- `grep -c '"path": "$HOME/**/*"'` → `1`
- `grep -c '"identifier": "fs:scope"'` → `0` (global scope entry fully removed)
- `cargo check` → exit 0 (schema validation via tauri-build)
- `npm run tauri build` → exit 0 (full pipeline: vite build + Rust build + bundle)
- Cargo.lock diff: 72 lines changed (+71/-1) — first resolution of tauri-plugin-fs v2.5.0 + tauri-plugin-dialog v2.7.0

## Task 2 Outcomes: Defensive try/catch + Unit Tests

- Test count: 25 → 28 (+3 tests in `describe('writeFile error mapping')`)
- Test 1: `writeFile` throws `forbidden path: /Users/x/Desktop/foo.pdf` → `generateQuotePdf` rejects with message containing both `this location is restricted` AND the savePath `/Users/x/Desktop/foo.pdf`
- Test 2: `writeFile` throws `disk full` → original error propagates unchanged (no rewrite of non-forbidden-path errors)
- Test 3: `save()` returns `null` (dialog cancelled) → `generateQuotePdf` resolves silently, `writeFile` never called
- `npx vitest run src/pdf/generateQuotePdf.test.ts` → 28 tests pass, 0 failures
- `npx tsc -b` → exit 0 (no type errors)
- `npm run build` → exit 0 (full gate: lint + vitest + tsc -b + vite build + bundle-size assertion)

## Task 3 Outcomes: Manual UAT

| Flow | Location | Result | Notes |
|------|----------|--------|-------|
| UAT-A | `~/Desktop` | PASS | PDF written successfully; no error banner; file renders valid in PDF viewer |
| UAT-B | `~/Documents` | PASS | PDF written successfully; no error banner |
| UAT-C | `~/Downloads` | PASS | Regression baseline — still works; fix did not break Downloads-scoped path |
| UAT-D | `~/Desktop` (with scope reverted to `$DOWNLOAD/*`) | Result A | Red banner appeared with actionable message |

**UAT-D Result A — Institutional Finding:**

UAT-D was performed by temporarily editing `src-tauri/capabilities/default.json` back to the pre-fix state (`"$HOME/**/*"` → `"$DOWNLOAD/*"`), rebuilding via `npm run tauri:dev`, and attempting to save a PDF to `~/Desktop`.

**Result A was observed.** The red banner appeared inside `PrintQuoteModal` with the exact actionable message produced by Task 2's catch branch:

> `Cannot save to "/Users/{developer}/Desktop/Quote-Q-NNNN-uat-desk01.pdf" — this location is restricted. Try saving to Downloads, Documents, or Desktop instead.`

This confirms three things simultaneously:
1. **The audit's mechanistic claim (DESK-01) was real and reproducible** — without the broader `$HOME/**/*` scope, a Desktop save does in fact fail with a Tauri `forbidden path` error. This was NOT absorbed by `tauri-plugin-dialog`'s runtime `scope.allow_file()` auto-allow.
2. **Task 1 (the capability edit) was the load-bearing fix** — the error only disappears when the inline `$HOME/**/*` scope is present.
3. **Task 2's catch branch fires correctly and produces the actionable message** — the user sees the specific path that was rejected plus advice to use Downloads, Documents, or Desktop — not the generic "Could not generate quote."

**Post-UAT-D revert:** `src-tauri/capabilities/default.json` was restored to the post-Task-1 state (`$HOME/**/*`). `git diff src-tauri/capabilities/default.json` showed zero changes. A final UAT-A re-run after revert confirmed Desktop save still works.

**DESK-01 is now closed. v1.2-CODE-AUDIT.md Finding #1 is empirically validated — the bug was real and the fix is load-bearing.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @tauri-apps/api pinned to 2.10.1 to unblock build**

- **Found during:** Task 1 (running `npm run tauri build` to validate the capability change)
- **Issue:** `npm run tauri build` failed before any code edits were made. The pre-existing `package.json` specified `@tauri-apps/api: "^2.9.1"` but `npm install` had resolved it to `2.11.0`. The installed npm package version (2.11.0) did not align with the Rust tauri crate minor version (2.10.2), causing a build-time compatibility error. This was a pre-existing version drift — not introduced by the capability edit.
- **Fix:** Pinned `@tauri-apps/api` to exactly `2.10.1` in `package.json` (minor-version aligned with Rust crate `2.10.2`). `npm install` was re-run to update `package-lock.json`. `npm run tauri build` then exited 0.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm run tauri build` exit 0 after pin; confirmed the version is a compatible pairing (2.10.x npm + 2.10.x Rust).
- **Committed in:** `f6b790b` (bundled with Task 1 because the pin was a precondition for the build verification that is part of Task 1's acceptance criteria)

---

**Total deviations:** 1 auto-fixed (Rule 1 — pre-existing bug preventing build; no scope creep)
**Impact on plan:** The pin is a correctness fix for a pre-existing mismatch. It unblocks the Task 1 build gate and is self-contained. No plan tasks were skipped or altered.

## Issues Encountered

- Pre-existing `@tauri-apps/api` version drift blocked the initial `npm run tauri build` call. Resolved via Rule 1 pin (see Deviations). No other issues encountered.
- Cargo.lock refresh produced a 72-line diff (plan estimated ~50 lines) due to transitive dependencies of tauri-plugin-fs v2.5.0 and tauri-plugin-dialog v2.7.0. This is within expected range for two plugin crates and is a one-time refresh (the plugins were already declared in Cargo.toml but had never been resolved).

## DESK-01 Requirement Traceability

| Requirement | Status | Evidence |
|-------------|--------|----------|
| DESK-01: Desktop users can save PDFs to Desktop, Documents, and Downloads | CLOSED | UAT-A, UAT-B, UAT-C all PASS |
| DESK-01 must_have: no generic "Could not generate quote" on scope denial | CLOSED | UAT-D Result A: actionable message observed |
| DESK-01 must_have: change does not broaden surface for other Tauri commands | VERIFIED | Inline scope on fs:allow-write-file only; no other permissions touched |
| DESK-01 must_have: full build chain green | VERIFIED | `npm run build && npm run tauri build` exit 0 |

## User Setup Required

None — no external service configuration required. The fix is a build-time capability change embedded in the desktop bundle.

## Next Phase Readiness

- Phase 18 is complete. DESK-01 is the only Phase 18 requirement; it is now closed.
- Phase 19 (Modal primitive + a11y migration) is ready to start — no dependencies on Phase 18.
- Phases 20, 21, 24 are also independent and can start in parallel.
- No blockers or concerns from this phase.

---
*Phase: 18-tauri-fs-scope-fix*
*Completed: 2026-05-25*
