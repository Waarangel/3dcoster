# Phase 18: Tauri fs:scope fix - Research

**Researched:** 2026-05-25
**Domain:** Tauri 2 capabilities (fs plugin scope + dialog plugin integration)
**Confidence:** HIGH for stack/API facts; MEDIUM for bug reproduction (see Summary — the audit's mechanistic claim may be incorrect)

## Summary

The v1.2 code audit (`v1.2-CODE-AUDIT.md` finding #1, CRITICAL) describes a scope-mismatch bug: `fs:scope` is allow-listed to `$DOWNLOAD/*` while `save()` lets the user navigate anywhere, so `writeFile` against `~/Desktop/foo.pdf` should be denied at runtime with `"forbidden path: ..."`. The audit was performed by code review only — there is no reproducer log, no UAT step that observed the error.

**Investigation finding that complicates the audit:** Tauri 2's dialog plugin already calls `scope.allow_file(&path)` on the returned path **inside the `save_file` command implementation** (`plugins-workspace/blob/v2/plugins/dialog/src/commands.rs:281-289` [CITED]). This means after the user picks `~/Desktop/foo.pdf` in the dialog, the fs scope is automatically extended at runtime to include that exact file, and the subsequent `writeFile` call should succeed for the remainder of the session — regardless of what the static `fs:scope` capability says. This auto-allow is corroborated by the official docs ([CITED: v2.tauri.app/plugin/persisted-scope/]: *"The selected path from a save dialog is added to the filesystem and asset protocol scopes. However, the scope change is not persisted, so the values are cleared when the application is restarted."*) and a tauri-apps discussion thread (#9195) where a user observes `readTextFile()` failing initially but succeeding after dialog interaction.

So one of three things is true:
1. **The audit's bug doesn't actually reproduce on Tauri `2.10.2` + `tauri-plugin-dialog@2.7.1`** — the auto-allow handles it correctly and the "Could not generate quote" error in the wild has a different root cause (macOS Gatekeeper unsigned-app block? jsPDF generation throwing? buffer encoding? `await save()` rejecting?).
2. **The audit's bug does reproduce in some narrow case** the auto-allow misses (e.g., on Windows with UNC paths, certain symlinked Desktop folders, or if the dialog returns a path that fails `into_path()` conversion silently).
3. **The auto-allow grants the path but does not persist across app restarts** — so if the user closes the app and reopens it expecting to overwrite the same file via writeFile-without-dialog, that would fail. But this is NOT the project's flow (every PDF write goes through `save()` first).

Regardless of which is true, REQ DESK-01 is locked and demands a fix. The fix must (a) close the audit's theoretical concern, (b) keep the security blast radius small, (c) align with Tauri 2 idioms, (d) handle the "Could not generate quote" error message better than the current generic catch.

**Primary recommendation:** Adopt **Option C (inline scope on `fs:allow-write-file`)** — change line 11 of `src-tauri/capabilities/default.json` from the bare `"fs:allow-write-file"` permission identifier and the separate `fs:scope` entry on line 12 into a single combined entry: `{ "identifier": "fs:allow-write-file", "allow": [{ "path": "$HOME/**/*" }] }`. This (a) broadens write access to anywhere under the user's home (which matches what the unscoped `save()` dialog actually allows), (b) constrains the broader scope to ONLY the `write_file` permission (other fs commands stay denied even if added in the future), (c) is a one-line diff, (d) does not depend on the auto-allow mechanism that may or may not be reliably firing. Additionally, wrap the `writeFile` call site in `generateQuotePdf.ts` with a try/catch that produces an actionable error message when the underlying error matches `"forbidden path"` (in case the bug ever does reproduce). The `tauri-plugin-persisted-scope` Rust crate is the Tauri-blessed long-term answer but adds a new dependency and is overkill for one save() flow.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capability declaration (`fs:scope`, `fs:allow-write-file`) | Tauri runtime / Rust config | — | Static ACL evaluated by Rust before invoking command handlers |
| Save dialog (user picks path) | Tauri dialog plugin (Rust) → JS bridge | Browser/Client (React calls `save()`) | Dialog plugin owns the native OS dialog and auto-allow-file on return |
| File write (bytes → disk) | Tauri fs plugin (Rust) | Browser/Client (React calls `writeFile()`) | fs plugin enforces scope check, returns `Result<(), Error>` |
| Error surfacing to user | Browser/Client (PrintQuoteModal `setError`) | — | React renders the `error` state into the red banner; no Rust UI exists here |
| Build-time capability validation | tauri-build (build-script) | — | `tauri::generate_context!()` validates JSON against `desktop-schema.json` at compile time |

## Standard Stack

### Core (already installed — no new packages)

| Library | Installed Version | Latest | Purpose | Why Standard |
|---------|-------------------|--------|---------|--------------|
| `tauri` (Rust) | 2.10.2 [VERIFIED: Cargo.lock] | 2.10.x | Capability runtime, scope evaluation | The framework — no alternative |
| `tauri-plugin-fs` (Rust) | declared `"2"` in Cargo.toml — first build will resolve to latest 2.x (likely 2.5.x) [VERIFIED: declared in `src-tauri/Cargo.toml:16`; Cargo.lock is stale and does not yet contain this crate] | 2.5.1 (May 2 2026) [VERIFIED: crates.io API] | `writeFile` Rust implementation + scope check | Official tauri-apps plugin |
| `tauri-plugin-dialog` (Rust) | declared `"2"` in Cargo.toml [VERIFIED: `src-tauri/Cargo.toml:15`; not yet in Cargo.lock] | 2.7.1 (May 2 2026) [VERIFIED: crates.io API] | `save()` Rust implementation, auto-allow side-effect | Official tauri-apps plugin |
| `@tauri-apps/plugin-fs` (JS) | 2.5.1 [VERIFIED: package.json] | 2.5.1 | JS binding for `writeFile` | Official; no alternative |
| `@tauri-apps/plugin-dialog` (JS) | 2.7.1 [VERIFIED: package.json] | 2.7.1 | JS binding for `save()` | Official; no alternative |
| `@tauri-apps/api` (JS) | 2.9.1 [VERIFIED: package.json] | 2.9.x | `path` helpers (downloadDir, homeDir) if needed | Official; no alternative |

### Supporting (NOT being added — listed for option-rejection rationale)

| Library | Why Not Add |
|---------|-------------|
| `tauri-plugin-persisted-scope` (Rust, v2.x) | Tauri-blessed for "user-picks-path → app-writes-file-and-remembers-across-restarts" workflows ([CITED: v2.tauri.app/plugin/persisted-scope/]). For Phase 18 it's overkill: the PDF flow opens the save dialog every time (no path is re-used across sessions). Adds a new Rust dependency, requires registering in `main.rs` AFTER the fs plugin (load-order constraint), and provides zero benefit for a once-per-export flow. Reconsider only if the app ever needs to remember "last save location" across restarts. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `$HOME/**/*` inline on `fs:allow-write-file` (Option C — recommended) | Bare global `"fs:scope"` with `$HOME/**/*` (Option A from audit) | Option A also works but applies the broader scope to ANY future fs command (e.g., if someone later adds `fs:allow-read-file`, reads also get `$HOME/**/*` for free). Option C constrains the broader scope to writeFile only. Defense in depth. [VERIFIED: v2.tauri.app/security/permissions/ — per-permission inline scope constrains that permission alone] |
| Static config change | Runtime `tauri-plugin-persisted-scope` | Persisted-scope is for the "remember user-chosen folders across sessions" workflow; the PDF flow has no such persistence need. |
| Broaden scope at all | Rely on dialog plugin's built-in `scope.allow_file()` auto-allow | The auto-allow IS the actual mechanism that makes the current code work in most cases [CITED: plugins-workspace/v2/plugins/dialog/src/commands.rs:281-289]. But trusting an undocumented side-effect to be the load-bearing safety net is fragile — the next dialog plugin minor bump could change it. Explicit scope is more defensible. |

### Installation

**No new packages — this is a config-only change.** The fix touches:
- `src-tauri/capabilities/default.json` (one-line edit; combine lines 11 + 12)
- `src/pdf/generateQuotePdf.ts` (defensive try/catch + actionable error message)

**Version verification commands** (for the planner to confirm at execution time):
```bash
# Confirm installed JS plugin versions match what's in package.json
npm view @tauri-apps/plugin-fs version       # expect 2.5.1+
npm view @tauri-apps/plugin-dialog version   # expect 2.7.1+
# No new install commands needed.
# After capability edit, `tauri build` will refresh Cargo.lock to include
# tauri-plugin-fs + tauri-plugin-dialog (currently missing from lockfile —
# the .json edit doesn't trigger this on its own, but `npm run tauri build`
# does as part of success criterion #4).
```

## Package Legitimacy Audit

This phase installs **zero new packages** — it edits one JSON file plus one TypeScript file. No new package surface, no slopcheck run required. For completeness, the existing packages this phase relies on are well-established:

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tauri-apps/plugin-fs` | npm | 1.5 yrs (v2.0.0 published Oct 2024) | 3.79M total (recent) | github.com/tauri-apps/plugins-workspace | OK (not run — pre-existing) | Approved (already installed) |
| `@tauri-apps/plugin-dialog` | npm | 1.5 yrs | 7.94M total | github.com/tauri-apps/plugins-workspace | OK (not run — pre-existing) | Approved (already installed) |
| `tauri-plugin-fs` | crates.io | 1.5 yrs (v2.5.1 May 2 2026) | 422k for v2.5.1 | github.com/tauri-apps/plugins-workspace | OK (not run — pre-existing) | Approved (already in Cargo.toml) |
| `tauri-plugin-dialog` | crates.io | 1.5 yrs (v2.7.1 May 2 2026) | 7.94M total downloads | github.com/tauri-apps/plugins-workspace | OK (not run — pre-existing) | Approved (already in Cargo.toml) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**New packages this phase:** none

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DESK-01 | Tauri `fs:scope` and `save()` dialog reconciled — desktop user can save a PDF anywhere the dialog allows without `writeFile` throwing a scope-denied error. Fix is one of: broaden `fs:scope` to `$HOME/**`, OR pass a `defaultPath` scoped to `$DOWNLOAD` and document the restriction. | **Recommended fix:** Option C (inline scope on `fs:allow-write-file` set to `$HOME/**/*`). See "Standard Stack" alternatives table and "Architecture Patterns" Pattern 1 below. The `defaultPath` option in the requirement language is unreliable because `defaultPath` in Tauri 2's `SaveDialogOptions` only seeds initial location — the user can still navigate anywhere [VERIFIED: v2.tauri.app/reference/javascript/dialog/ — `defaultPath?: string` description: "If it's a directory path, the dialog interface will change to that folder...". No `confined` / `restricted` / `pinned` option exists]. So the audit's option B as worded does not actually constrain user choice; it only constrains the **default** choice. |

## Architecture Patterns

### System Architecture Diagram

```
[User clicks "Create Quote" in PrintQuoteModal]
         ↓
[handleGenerateQuote → dynamic import('../pdf/generateQuotePdf')]
         ↓
[generateQuotePdf(quote) — branches on __IS_TAURI__]
         ↓ (Tauri branch only — web branch uses doc.save())
[dynamic import @tauri-apps/plugin-dialog]
         ↓
[save({ defaultPath: filename, filters: [...] })]
         ↓ ─────────── Rust side: tauri-plugin-dialog ───────────
         │             commands.rs:281-289 →
         │             scope.allow_file(returned_path)  ← AUTO-ALLOW
         │             tauri_scope.allow_file(returned_path)
         ↓
[savePath: string | null  ← user-chosen absolute path]
         ↓ (if savePath === null → user cancelled → silent return)
[dynamic import @tauri-apps/plugin-fs]
         ↓
[writeFile(savePath, Uint8Array)]
         ↓ ─────────── Rust side: tauri-plugin-fs ───────────
         │             scope check against
         │             capabilities/default.json fs:scope
         │             UNION runtime-allowed (from dialog auto-allow)
         │             → if denied: throw `Error("forbidden path: {path}")`
         ↓
[Promise<void>  OR  rejection with "forbidden path: ..."]
         ↓
[PrintQuoteModal.handleGenerateQuote try/catch]
         ↓
[setError(err.message || 'Could not generate quote.')]
         ↓
[Red banner rendered in modal body]
```

### Recommended Project Structure

No new files. Edits to existing:
```
src-tauri/
└── capabilities/
    └── default.json    ← MODIFY: collapse lines 11+12 into one inline-scoped permission
src/
└── pdf/
    └── generateQuotePdf.ts    ← MODIFY: add try/catch around writeFile (defense in depth)
```

### Pattern 1: Inline scope on permission (RECOMMENDED — Option C)

**What:** Attach an `allow` list directly to the `fs:allow-write-file` permission entry, instead of using the separate global `fs:scope`.

**When to use:** When you want to broaden one specific fs operation (writeFile) but keep all other fs operations denied by default.

**Why over Option A (global `fs:scope`):** A global `fs:scope` applies to ALL fs commands enabled in the capability [VERIFIED: tauri-apps/discussions; v2.tauri.app/security/scope/]. Today only writeFile is enabled, so Option A and Option C are functionally equivalent. But Option C is forward-defensive: if Phase 22 (or any future phase) adds `fs:allow-read-file`, the broader scope will NOT auto-grant reads. Defense in depth at zero cost.

**Example — current state (before):**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:default",
    "window-state:default",
    "dialog:allow-save",
    "fs:allow-write-file",
    { "identifier": "fs:scope", "allow": [{ "path": "$DOWNLOAD/*" }] }
  ]
}
```

**After (Option C, recommended):**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:default",
    "window-state:default",
    "dialog:allow-save",
    { "identifier": "fs:allow-write-file", "allow": [{ "path": "$HOME/**/*" }] }
  ]
}
```

Note: line 12 (`fs:scope`) is **removed entirely** — its job is now done inline on line 11. Net diff: −1 line, −0 dependencies.

**Glob syntax verification:** `$HOME/**/*` is the recursive form. The bare `$HOME/*` only matches direct children of `$HOME` (one level deep). The default Tauri 2 glob options set `require_literal_leading_dot: true` (since Tauri 2.0.0-alpha.2+ — fix for GHSA-6mv3-wm7j-h4w5) [VERIFIED: GitHub security advisory], which means `$HOME/**/*` does NOT match dotfile/dotfolder contents like `~/.ssh/id_rsa` or `~/.config/secrets`. So the security blast radius of `$HOME/**/*` excludes:
- `~/.ssh/*` (SSH keys)
- `~/.config/*` (most app configs)
- `~/.aws/*`, `~/.gnupg/*`, browser profile internals (which live under dotfolders on most platforms)
- macOS Library is `~/Library/...` (no leading dot) — IS reachable, but ~/Library is also exactly where macOS apps legitimately write user data.

### Pattern 2: Defensive error mapping for `"forbidden path: …"` (DEFENSE IN DEPTH)

**What:** Wrap the `writeFile` call in `generateQuotePdf.ts` with a try/catch that detects the scope-denial error string and surfaces actionable advice instead of the generic "Could not generate quote."

**When to use:** Belt-and-braces alongside Pattern 1. If a future capability edit accidentally re-narrows the scope, the user sees "PDF could not be saved to {path} — this location is restricted. Try saving to Downloads instead." rather than the cryptic generic error.

**Example:**
```typescript
// Source: src/pdf/generateQuotePdf.ts (modify lines 320-332)
const { save } = await import('@tauri-apps/plugin-dialog');
const { writeFile } = await import('@tauri-apps/plugin-fs');

const savePath = await save({
  defaultPath: filename,
  filters: [{ name: 'PDF', extensions: ['pdf'] }],
});

if (!savePath) return;

const buffer = doc.output('arraybuffer');
try {
  await writeFile(savePath, new Uint8Array(buffer));
} catch (err) {
  // Tauri fs plugin throws `Error("forbidden path: {path}")` on scope denial.
  // Source: plugins-workspace/v2/plugins/fs/src/error.rs:PathForbidden variant.
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.toLowerCase().includes('forbidden path')) {
    throw new Error(
      `Cannot save to "${savePath}" — this location is outside the app's permitted save area. ` +
      `Try saving to Downloads, Documents, or Desktop instead.`
    );
  }
  throw err;  // re-throw anything else unchanged so PrintQuoteModal's catch still works
}
```

The re-thrown Error message lands in `PrintQuoteModal.tsx:287` (`setError(err instanceof Error ? err.message : 'Could not generate quote.')`) and renders into the red banner verbatim. No PrintQuoteModal edit needed.

### Anti-Patterns to Avoid

- **Anti-pattern: Add `tauri-plugin-persisted-scope` for this fix.** The persisted-scope plugin solves a different problem — remembering user-picked folders across app restarts so subsequent fs ops without re-prompting still work. The PDF flow opens `save()` every time; there's nothing to persist. Adding a Rust dependency for a problem we don't have is yak shaving.
- **Anti-pattern: Rely on the dialog plugin's `scope.allow_file()` auto-allow as the only mechanism.** It does work today [VERIFIED: dialog/src/commands.rs:281-289], but trusting an undocumented side-effect to be load-bearing is fragile. Explicit static scope is defensible in review and unaffected by future plugin minor bumps.
- **Anti-pattern: Use `defaultPath: $DOWNLOAD` and document the restriction (audit's "Option B" verbatim).** `defaultPath` doesn't pin the dialog — the user can still navigate anywhere [VERIFIED: v2.tauri.app/reference/javascript/dialog/ — only `title`, `filters`, `defaultPath`, `canCreateDirectories` exist on `SaveDialogOptions`; no pinning option]. So "document the restriction" would be documenting a constraint that doesn't actually exist. The user could still pick Desktop and hit the same error.
- **Anti-pattern: Use `$HOME/*` (single asterisk).** Only matches direct children of `$HOME`, not nested paths like `~/Desktop/foo.pdf` or `~/Documents/Invoices/foo.pdf`. The bug stays unfixed.
- **Anti-pattern: Use `$HOME/**` (no trailing `/*`).** Matches directories but not necessarily file paths in all glob implementations. The Tauri-docs-example pattern is `$APPDATA/**/*` — follow the documented pattern: `$HOME/**/*`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Allow user-picked save path" | Custom Rust command that bypasses scope | The built-in `dialog:allow-save` + fs scope | Tauri's scope system is the security boundary; bypass = CVE waiting to happen |
| Path normalization / canonicalization before writeFile | Manual `path.resolve()` in JS | Pass the raw string from `save()` directly to `writeFile` | The Rust side handles platform-specific canonicalization (Windows UNC strip, macOS Library expansion); doing it in JS first risks double-encoding |
| Scope-denial detection regex | `err.match(/permission|denied|forbidden|disallowed/)` | Substring check `err.message.includes('forbidden path')` | The Rust error format is fixed: `#[error("forbidden path: {0}")] PathForbidden(PathBuf)` [VERIFIED: fs/src/error.rs]. Don't over-engineer; one exact substring is enough. |
| "Pin the save dialog to a directory" | Custom dialog filter or repeated prompt loops | Accept that Tauri 2's `save()` cannot be pinned; broaden scope instead | The API does not support directory pinning. Working around it client-side creates worse UX than Option C. |

**Key insight:** Tauri's capability system is declarative and intentionally restrictive. The right fix is almost always "edit the capability JSON" — not "add JS workarounds" or "add another plugin." For Phase 18 specifically, the ENTIRE fix fits on one JSON line.

## Runtime State Inventory

> Phase 18 is a config edit, NOT a rename/refactor/migration. This section is conceptually skippable per the workflow rules. For completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schemas/keys/IDs change. Existing PDFs on disk are not affected. | none |
| Live service config | None — no external services. | none |
| OS-registered state | None — Tauri capability is bundled into the .app/.exe at build time, not registered with the OS. | none (a new desktop build will be pushed via the standard release flow per `.claude/CLAUDE.md` if a version bump accompanies this fix) |
| Secrets/env vars | None — no env vars or secrets touched. | none |
| Build artifacts | The Tauri build embeds the capability JSON into the binary. Existing v1.3.1 builds on user machines retain the OLD `$DOWNLOAD/*` scope; this is unavoidable until users update. UpdateBanner will surface the next release. | If a release is cut, the `.claude/CLAUDE.md` release checklist (three version files) applies. Phase 18 alone does NOT require a version bump — that's a separate decision in discuss-phase. |

## Common Pitfalls

### Pitfall 1: `$HOME/*` vs `$HOME/**/*` glob confusion

**What goes wrong:** Developer writes `$HOME/*` thinking it means "anywhere under home." Saves to `~/Desktop/foo.pdf` still fail; user thinks the fix didn't work.

**Why it happens:** `$HOME/*` matches only direct children of `$HOME` (one path segment deep). `$HOME/Desktop` matches, but `$HOME/Desktop/foo.pdf` doesn't.

**How to avoid:** Always use `$HOME/**/*` for recursive write access. The Tauri docs' canonical example is `$APPDATA/**/*` — mirror that pattern.

**Warning signs:** UAT step "save to ~/Desktop" still throws "forbidden path".

### Pitfall 2: Stale Cargo.lock not regenerated on first build after capability change

**What goes wrong:** `npm run tauri build` regenerates Cargo.lock to include `tauri-plugin-fs` and `tauri-plugin-dialog` (currently missing from `src-tauri/Cargo.lock`). The lockfile diff can be large (transitive deps) and may surprise the planner expecting a small diff.

**Why it happens:** `Cargo.lock` was last updated May 18 2026; Cargo.toml was last touched May 23 2026 when the dialog/fs plugins were added but no `cargo build` was run in the worktree since.

**How to avoid:** The planner should expect Cargo.lock changes in the same commit as the JSON edit, OR explicitly run `cargo build` inside `src-tauri/` before the JSON edit so the lockfile diff is isolated to its own commit. The Phase 18 task list should include a "verify Cargo.lock regenerated" verification step OR explicitly schedule a lockfile-refresh commit.

**Warning signs:** PR shows ~50+ lines of Cargo.lock diff mingled with the 1-line JSON change; reviewers can't easily see the substantive edit.

### Pitfall 3: Audit's bug doesn't reproduce — Phase 18 closes nothing observable

**What goes wrong:** Developer ships the JSON edit, runs UAT, picks Desktop, the write succeeds. They cannot tell whether the fix worked or whether the bug never reproduced in the first place. False sense of validation.

**Why it happens:** The dialog plugin's `scope.allow_file()` auto-allow [VERIFIED: dialog/src/commands.rs:281-289] already makes the current `$DOWNLOAD/*` scope sufficient for the in-session save flow. The audit was theory-based, not reproducer-based.

**How to avoid:** UAT script must include a **negative control**: temporarily revert the JSON change, run the app, pick Desktop, observe whether the error actually occurs in the current codebase. If it doesn't, the audit's framing was wrong and this phase becomes "preventive hardening + better error message" rather than "bug fix." Either outcome closes DESK-01, but doc the finding honestly in the verification phase.

**Warning signs:** Phase 18 completes, UAT "passes," but the "Could not generate quote" error reports from real users never stop. → The real bug is elsewhere (jsPDF error, Gatekeeper unsigned-app block, etc.).

### Pitfall 4: Per-permission inline scope syntax typo silently parsed as deny-all

**What goes wrong:** Typo in `{ "identifier": "fs:allow-write-file", "allow": [{ "path": "$HOME/**/*" }] }` — e.g., spelling `"allows"` instead of `"allow"`, or putting the path string at top level instead of inside `{ "path": ... }`. The capability validator accepts it (extra keys are ignored, missing optional keys default to empty), and the resulting effective scope is empty = all writes denied.

**Why it happens:** The capability JSON schema validation surfaces unknown identifiers but is lenient on scope-shape mismatches.

**How to avoid:** After the edit, run `cargo build` inside `src-tauri/` (or `npm run tauri build`) — the build will fail at the schema-validation step if the structure is wrong. Additionally the UAT step exercises the actual flow end-to-end.

**Warning signs:** Build succeeds, but EVERY save attempt now fails with "forbidden path" — even Downloads.

## Code Examples

### Example 1 — final state of `src-tauri/capabilities/default.json` (Option C)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:default",
    "window-state:default",
    "dialog:allow-save",
    { "identifier": "fs:allow-write-file", "allow": [{ "path": "$HOME/**/*" }] }
  ]
}
```
Source pattern: [VERIFIED: v2.tauri.app/security/permissions/ — `PermissionEntry` extended form with `identifier` + `allow` + `deny`]

### Example 2 — defensive try/catch in `src/pdf/generateQuotePdf.ts`

```typescript
// Source: src/pdf/generateQuotePdf.ts — modify lines 330-332.
// The if (!savePath) return early stays as-is on line 328.

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
      `Try saving to Downloads, Documents, or Desktop instead.`
    );
  }
  throw err;  // Anything else surfaces to PrintQuoteModal's catch verbatim.
}
```

The re-thrown Error.message propagates through `PrintQuoteModal.tsx:287` (`setError(err instanceof Error ? err.message : 'Could not generate quote.')`) directly into the red banner UI. No PrintQuoteModal.tsx changes needed.

### Example 3 — UAT manual script (executable by a human)

```
Setup:
  1. Run: npm run tauri:dev
  2. App opens. Create or open any PrintJob.
  3. Click "Generate Quote" (opens PrintQuoteModal).
  4. Fill: Name = "UAT-DESK01", click "Create Quote".

UAT-A (Desktop):
  5. Save dialog opens. Navigate to ~/Desktop.
  6. Filename auto-fills (e.g., Quote-Q-NNNN-uat-desk01.pdf).
  7. Click Save.
  EXPECT: dialog closes; ~/Desktop/Quote-Q-NNNN-uat-desk01.pdf exists.
  FAIL CONDITION: red banner appears in PrintQuoteModal with any error.

UAT-B (Documents):
  8. Repeat: pick "Documents" folder.
  EXPECT: file written successfully.

UAT-C (Downloads — regression baseline):
  9. Repeat: pick "Downloads" folder.
  EXPECT: file written successfully (this worked before the fix; must still work).

UAT-D (Negative control — verify error path):
  10. Quit the app.
  11. Temporarily edit capabilities/default.json: change "$HOME/**/*" to "$DOWNLOAD/*".
  12. Run npm run tauri:dev again.
  13. Repeat steps 1-6 (pick Desktop).
  EXPECT: red banner shows "Cannot save to /Users/.../Desktop/Quote-... — this location is restricted. Try saving to Downloads, Documents, or Desktop instead."
  THIS VERIFIES: (a) the audit's bug IS reproducible when scope is narrow, and (b) the new error message lands correctly.
  Then revert the JSON, restart, confirm UAT-A passes again.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri 1 `tauri.allowlist.fs.scope` in `tauri.conf.json` | Tauri 2 capability files in `src-tauri/capabilities/*.json` with explicit permission identifiers | Tauri 2.0 stable (Oct 2024) | The project is already on Tauri 2 — no migration needed |
| Tauri 1 unscoped `writeFile` allowed if listed in allowlist | Tauri 2: must enable `fs:allow-write-file` permission AND optionally scope it | Tauri 2.0 stable | Project already migrated; this phase refines the existing capability |
| Pre-2.0.0-alpha.2: `$HOME/*.key` matched `$HOME/.ssh/secret.key` (glob over leading dots) | Post-2.0.0-alpha.2: `require_literal_leading_dot: true` — `$HOME/**/*` does NOT match dotfiles | GHSA-6mv3-wm7j-h4w5 (2024) | The project runs Tauri 2.10.2, so `$HOME/**/*` is safe wrt dotfile leakage [VERIFIED] |
| Manual `scope.allow_file()` calls in custom Rust to extend scope at runtime | Built into `tauri-plugin-dialog`'s `save_file` command since the v2 line | Tauri 2 dialog plugin v2.0 release | This auto-allow is the actual reason the current code "mostly works" — see Summary |

**Deprecated/outdated:**
- Tauri 1 docs (v1.tauri.app/v1/api/js/fs/) and any blog post referencing `tauri.allowlist.fs` — DO NOT consult; the API and JSON structure are completely different in Tauri 2.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The audit-reported "Could not generate quote" error is genuinely caused by `fs:scope` denial (i.e., the user reported it after picking a non-Downloads location). | Summary | If A1 is wrong, Phase 18 may close DESK-01 without addressing the user-visible bug. Discuss-phase should ask whether anyone has a reproducer log. The defensive try/catch in Pattern 2 mitigates this — at minimum the error message becomes actionable. |
| A2 | macOS Gatekeeper "app is damaged" issue (documented in `.claude/CLAUDE.md`) is NOT related to the writeFile flow — it blocks app launch, not file-write inside a launched app. | Summary | Low risk: Gatekeeper rejection happens before any JS runs. If a user manages to launch the app, Gatekeeper is out of the picture for subsequent writes. |
| A3 | `defaultPath` accepting an absolute path string (the user's chosen filename) is correct and won't break the existing flow. | Pattern 1 | None — line 324 of `generateQuotePdf.ts` already does this and works in shipped builds; the audit doesn't suggest it's broken. |
| A4 | The capability JSON schema validator (run by `tauri-build` at compile time) will reject malformed inline-scope syntax. | Pitfall 4 | If A4 is wrong, the misconfigured capability silently denies all writes. Mitigation: the UAT script's negative control (UAT-D) catches this. |
| A5 | Auto-allow `scope.allow_file(&path)` in `tauri-plugin-dialog@2.7.1` is still present (read from current `v2` branch source). | Summary | If the project pins to a tauri-plugin-dialog version where this was removed, the audit's bug becomes reliably reproducible AND Option C becomes load-bearing. Either way the recommended fix still works. |
| A6 | Phase 18 does not need a version bump and release. | Runtime State Inventory | This is a discuss-phase decision. The audit explicitly classifies this CRITICAL — there's a case for cutting a release to push the fix to existing desktop users, but that's a project-level call, not a research call. |

## Open Questions (RESOLVED)

1. **Has anyone reproduced the audit's bug in practice?** **RESOLVED → UAT-D will answer at execution.** Plan 18-01 Task 3 includes an explicit negative-control step (revert capability change via `git stash`, re-run UAT, observe failure or non-failure). Result A (failure observed) confirms the audit was real; Result B (no failure) confirms the fix is preventive hardening. Either way DESK-01 is closed; the outcome is recorded in `18-SUMMARY.md` for institutional knowledge.

2. **Should Phase 18 trigger a version bump + release?** **RESOLVED → bundle with the v1.3 milestone.** v1.3 Hardening is a coherent unit; releasing 8 separate `v1.3.x` desktop builds (one per phase) would over-notify users and dilute the release narrative. Phase 18 ships into the v1.3 release at milestone close (`/gsd:complete-milestone v1.3`). If a real exploitable case emerges before v1.3 ships, this can be revisited and a standalone `v1.3.x` desktop release cut.

3. **Does the project want a regression guard (e.g., grep gate) on `default.json`?** **RESOLVED → defer to Phase 25 polish batch.** Out of scope for Phase 18 (one-line fix); will be considered as a candidate hygiene item in Phase 25's "Doc + hygiene + polish + bundle health" plan. `tauri-build`'s existing schema validation provides the baseline.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | `npm run tauri:dev`, `npm run tauri build`, regenerating Cargo.lock | Required (likely available on dev machine per existing Tauri shipping history — v1.3.1 was built and released) | per `.claude/CLAUDE.md` 3DCoster shipped Tauri builds via GitHub Actions | — (without Rust the UAT cannot run; the planner must verify on the dev machine) |
| Node.js + npm | `npm run build`, `npm run tauri:dev`, `npm run tauri build` | Required | per package.json — no specific engines field, project uses Vite 7 + Vitest 4 (Node 20+ implicit) | — |
| `@tauri-apps/cli` | `tauri:dev` and `tauri build` scripts | ✓ installed | `^2.9.6` [VERIFIED: package.json devDeps] | — |
| GitHub Actions (release flow) | If Phase 18 triggers a release | ✓ configured per `.github/workflows/release.yml` (mentioned in `.claude/CLAUDE.md`) | — | Manual local builds possible |
| macOS app for UAT-A (Desktop folder test) | Manual UAT script | Available on dev machine (project README/CLAUDE both reference macOS Gatekeeper considerations → macOS is a primary dev platform) | — | Run UAT on Windows or Linux instead — the bug & fix are cross-platform |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 [VERIFIED: package.json devDeps] |
| Config file | `vite.config.ts` (Vitest reads it directly per `defineConfig`'s `test:` block convention) — actual config not read; trusted from `npm run test` existing |
| Quick run command | `npm run test` (`vitest run`) |
| Full suite command | `npm run build` (includes `vitest run --coverage` per package.json line 8) |
| Manual UAT | `npm run tauri:dev` — no automated Tauri test framework in this repo |
| Build-time validation | `npm run tauri build` — schema-validates the capability JSON via `tauri-build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DESK-01 (a) | Capability JSON parses without error; `tauri-build` schema validation passes | build-time | `cd src-tauri && cargo check` OR `npm run tauri build` | ✅ (build script exists) |
| DESK-01 (b) | `generateQuotePdf` catches `"forbidden path: …"` and surfaces the actionable message | unit (vitest, mocked) | `npm run test -- generateQuotePdf` | ✅ existing `src/pdf/generateQuotePdf.test.ts` covers `generateQuotePdfBytes`; new test for the catch branch needed |
| DESK-01 (c) | Manual UAT: pick Desktop/Documents/Downloads, file is written | manual | `npm run tauri:dev` + UAT script (see Code Examples #3) | manual-only — no Tauri WebDriver test infrastructure exists in this repo, and standing one up for a one-line config fix is grossly disproportionate |
| DESK-01 (d) | Build pipeline green: `npm run build && npm run tauri build` exits 0 | integration | `npm run build && npm run tauri build` | ✅ |

### Sampling Rate

- **Per task commit:** `npm run test -- generateQuotePdf` (~2-5s — runs only PDF tests)
- **Per wave merge:** `npm run build` (full vitest + tsc + vite build + asset-size gates)
- **Phase gate:** `npm run build && npm run tauri build` (forces Cargo/Rust path); manual UAT script (~3 minutes for a human)

### Wave 0 Gaps

- [ ] `src/pdf/generateQuotePdf.test.ts` — extend with a new `describe('writeFile error mapping')` block that mocks `@tauri-apps/plugin-fs.writeFile` to throw `new Error('forbidden path: /Users/x/Desktop/foo.pdf')` and asserts the caught-and-rethrown message includes `"this location is restricted"`. Estimated +15 lines, vi.mock pattern.
- [ ] No new test files needed — existing infrastructure covers everything else.
- [ ] No framework install needed — Vitest is already wired up.

**Note on Tauri integration testing:** Tauri 2 supports WebDriver-based e2e testing via `tauri-driver` + `webdriverio`. Standing this up for Phase 18 alone is disproportionate (estimated 1-2 days setup vs. 30 minutes for the fix itself). The manual UAT script with the negative control (UAT-D in Code Examples #3) is the appropriate validation. If/when a future phase adds WebDriver tests, the Phase 18 UAT script becomes the first automated case.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Tauri capability/permission system — already in place; this phase refines a capability declaration. |
| V2 Authentication | no | No user auth in this app (local-first, single user). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | yes (filesystem access control) | Tauri 2 fs scope = capability-based access control. Option C constrains broadened scope to one specific operation (writeFile) — defense in depth. |
| V5 Input Validation | yes (path validation) | The user-picked path from `save()` is treated as untrusted input by Tauri's scope check. Inline scope on `fs:allow-write-file` is the validation boundary. |
| V6 Cryptography | no | No crypto in this phase. |
| V7 Error Handling | yes | Pattern 2 (defensive try/catch with actionable message) implements V7.4.1 (handle errors securely without leaking sensitive info) — the rewritten error includes the user-chosen filename (already known to the user) but not internal paths or stack traces. |
| V12 File Operations | yes | This phase IS about file ops. Standard controls: scope-restricted writes, no arbitrary path concatenation, no symlink traversal exposure (handled by Tauri's `require_literal_leading_dot: true` + Rust-side canonicalization). |

### Known Threat Patterns for Tauri 2 desktop apps writing user-chosen files

| Pattern | STRIDE | Standard Mitigation | Status in this phase |
|---------|--------|---------------------|---------------------|
| Scope bypass via dotfile glob (GHSA-6mv3-wm7j-h4w5) | Information Disclosure / Tampering | Tauri 2's `require_literal_leading_dot: true` default | Mitigated by Tauri runtime version 2.10.2 [VERIFIED] |
| Path traversal via `..` in user input | Tampering | Rust-side path canonicalization in fs plugin; scope check uses canonicalized path | Mitigated by fs plugin (out of phase scope) |
| Symlink-following write outside scope | Tampering | Tauri scope check resolves symlinks before evaluating | Mitigated by fs plugin |
| Overly broad scope grant (audit's concern reversed: `$HOME/**/*` may be too permissive) | Information Disclosure | Constrain to per-permission inline scope (Option C); revisit narrowing in a future phase if scope creep is observed | Option C narrows blast radius vs Option A; further narrowing (e.g., `$DOWNLOAD/**/* + $DESKTOP/**/* + $DOCUMENT/**/*`) is possible but adds maintenance for marginal benefit |
| User-facing error leaks absolute path | Information Disclosure | Acceptable here — the user just chose the path themselves; echoing it back is not new disclosure | N/A — user authored the path |
| Capability JSON tampering at runtime | Tampering | Capability is embedded in the binary at build time; runtime tampering requires binary modification (out of scope for app-level controls) | Out of scope |

## Sources

### Primary (HIGH confidence)

- **`src-tauri/capabilities/default.json`** (project file, lines 1-14) — current capability declaration verified.
- **`src-tauri/Cargo.toml`** (project file, lines 11-16) — Tauri 2.x + plugin versions declared.
- **`src-tauri/Cargo.lock`** (project file, awk-parsed) — tauri 2.10.2, tauri-build 2.5.5, tauri-utils 2.8.2 resolved.
- **`package.json`** (project file, lines 20-24, 36-46) — JS plugin versions: @tauri-apps/plugin-dialog 2.7.1, @tauri-apps/plugin-fs 2.5.1, @tauri-apps/api 2.9.1, @tauri-apps/cli 2.9.6.
- **`src/pdf/generateQuotePdf.ts`** (project file, lines 310-332) — current Tauri save+write flow verified end-to-end.
- **`src/components/PrintQuoteModal.tsx`** (project file, lines 285-291) — error handling: `setError(err instanceof Error ? err.message : 'Could not generate quote.')` confirmed; re-thrown Error.message propagates verbatim.
- **`plugins-workspace/blob/v2/plugins/dialog/src/commands.rs:281-289`** [CITED via WebFetch] — confirmed: `save_file` command calls `s.allow_file(&path)?;` and `tauri_scope.allow_file(&path)?;` BEFORE returning the path to JS. This is the auto-allow mechanism.
- **`plugins-workspace/blob/v2/plugins/fs/src/error.rs`** [CITED via WebFetch] — confirmed error variant: `#[error("forbidden path: {0}")] PathForbidden(PathBuf)`. The string `"forbidden path: …"` is what JS receives.
- **`plugins-workspace/blob/v2/plugins/persisted-scope/src/lib.rs`** [CITED via WebFetch] — confirmed: this plugin only listens for `fs::Event::PathAllowed` and persists granted scopes; it does NOT itself grant scope from dialog returns.
- **crates.io API** — `tauri-plugin-fs` 2.5.1 published May 2 2026, 422k downloads for that version, owner tauri-bot. `tauri-plugin-dialog` 2.7.1 same date, 7.94M total downloads.

### Secondary (MEDIUM confidence — official docs)

- [Tauri 2 — File System plugin](https://v2.tauri.app/plugin/file-system/) — fs:scope syntax, path tokens, glob patterns. Page-published May 13 2026.
- [Tauri 2 — Dialog plugin](https://v2.tauri.app/plugin/dialog/) — save() basic usage; does not document the auto-allow side effect.
- [Tauri 2 — Dialog JS reference](https://v2.tauri.app/reference/javascript/dialog/) — SaveDialogOptions = `{ title?, filters?, defaultPath?, canCreateDirectories? }` only. Confirms no pinning option exists.
- [Tauri 2 — Persisted Scope plugin](https://v2.tauri.app/plugin/persisted-scope/) — clarifies that dialog selections extend scope but don't persist across restarts (which is why persisted-scope exists for use-cases that need persistence).
- [Tauri 2 — Capability reference](https://v2.tauri.app/reference/acl/capability/) — confirms PermissionEntry supports `{ identifier, allow, deny }` extended form for per-permission inline scope.
- [Tauri 2 — Permissions](https://v2.tauri.app/security/permissions/) — explains scope precedence and per-command vs global scopes.
- [GHSA-6mv3-wm7j-h4w5 advisory](https://github.com/tauri-apps/tauri/security/advisories/GHSA-6mv3-wm7j-h4w5) — confirms `require_literal_leading_dot: true` is default in Tauri 2.0.0-alpha.2+, so `$HOME/**/*` does NOT match `~/.ssh/*` etc.

### Tertiary (LOW confidence — needs validation if load-bearing)

- [tauri-apps discussion #9195](https://github.com/tauri-apps/tauri/discussions/9195) — anecdotal report of `readTextFile()` failing initially then succeeding after dialog interaction. Supports the auto-allow narrative but isn't authoritative.
- [tauri/issues/12704](https://github.com/tauri-apps/tauri/issues/12704) — "Uncaught forbidden path error when using writeFile from @tauri-apps/plugin-fs" — unrelated configuration (writeFile to AppLocalData), shows the error string is real, doesn't reproduce our exact scenario.
- [tauri/issues/9205](https://github.com/tauri-apps/tauri/issues/9205) — fs:scope deserialization bug on macOS-specific paths; from Tauri 2.0.0-beta.11; unlikely to affect current 2.10.2 but flagged in case of unexpected schema errors during build.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against crates.io/npm and the project's own Cargo.toml/package.json.
- Architecture (fix patterns): HIGH for the syntactic choice (inline scope vs global), HIGH for `$HOME/**/*` glob semantics, MEDIUM for "this fix actually closes the user-visible bug" because the audit's bug repro is theoretical.
- Pitfalls: HIGH — three of four pitfalls are mechanically verifiable; pitfall #3 (audit-doesn't-reproduce) is the honest LOW-confidence note about whether DESK-01 closes a real-world symptom or just a theoretical exposure.
- Validation Architecture: HIGH for the test framework facts, HIGH for the manual UAT design (the negative-control UAT-D step is the load-bearing assertion), MEDIUM-LOW for skipping automated Tauri e2e (justified, but a deliberate gap).
- Security Domain: HIGH — directly mapped to ASVS V4/V5/V7/V12; Tauri scope IS the access control boundary.

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (Tauri 2 is on a regular release cadence — `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` ship roughly monthly; re-verify scope syntax and dialog auto-allow source if more than 30 days elapse before execution).
