---
phase: 18-tauri-fs-scope-fix
reviewed: 2026-05-25T11:48:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src-tauri/capabilities/default.json
  - src/pdf/generateQuotePdf.ts
  - src/pdf/generateQuotePdf.test.ts
  - package.json
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-25T11:48:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 18 closes DESK-01 by:

1. Collapsing `fs:allow-write-file` + global `fs:scope: $DOWNLOAD/*` into a single per-permission inline scope `fs:allow-write-file` allow-listed to `$HOME/**/*` (Option C from RESEARCH).
2. Wrapping `writeFile` in `generateQuotePdf.ts` with a try/catch that rewrites `"forbidden path"` Rust errors into an actionable banner message while passing through unrelated errors unchanged.
3. Pinning `@tauri-apps/api` to `^2.10.1` so npm-resolved JS API matches the Rust crate `tauri 2.10.2`, unblocking `npm run tauri build`.

The capability syntax is correct, the glob form (`$HOME/**/*` recursive, dotfile-protected by `require_literal_leading_dot: true`) is correct, and the runtime catch correctly preserves the original error for non-scope failures. The information-disclosure surface is acceptable — the echoed path is user-authored via the save dialog and no stack frames leak.

However, three quality issues warrant action before milestone close:

- **WR-01** (most consequential): the test for the `forbidden path` rewrite calls `generateQuotePdf(makeQuote())` twice via two separate `expect().rejects.toThrow()` calls. Because the underlying `save`/`writeFile` mocks are configured with `mockResolvedValue`/`mockRejectedValue` (sticky), this works today — but the test will silently degrade to false-positive if anyone migrates to `mockResolvedValueOnce` later. It also masks an undetected issue: under the current `vi.mocked(save).mockResolvedValue(fakePath)` setup, the second `generateQuotePdf` invocation re-uses the same mocked `save` resolution by accident, which is non-idiomatic.
- **WR-02**: The `@tauri-apps/api` version skew between top-level `2.10.1` (your pin) and nested `2.11.0` (installed under each plugin to satisfy their `^2.11.0` dep) is now embedded in `package-lock.json`. Two copies of `@tauri-apps/api` ship in the bundle. Functionally fine today, but a latent risk to flag for the v1.3 hardening sweep.
- **WR-03**: `msg.toLowerCase().includes('forbidden path')` is over-permissive. Any unrelated Error whose message happens to contain the lowercase substring `"forbidden path"` (e.g., a future Rust error like "operation forbidden: path traversal detected" or a user-facing string in a notes field that leaks into an error) would be misclassified as a scope denial. The Rust error format is fixed (`"forbidden path: {pathbuf}"`) so a slightly stricter check is essentially free.

Three Info items cover quality nits (commented-out reasoning blocks, magic numbers in the layout helpers that are unrelated to this diff but visible in the reviewed file).

## Warnings

### WR-01: Sticky-mock pattern in writeFile error mapping tests is fragile

**File:** `src/pdf/generateQuotePdf.test.ts:519-524`

**Issue:** Both assertions in the `'rewrites "forbidden path" error...'` test call `generateQuotePdf(makeQuote())` inside `expect().rejects.toThrow(...)`:

```ts
await expect(generateQuotePdf(makeQuote())).rejects.toThrow(
  /this location is restricted/,
);
await expect(generateQuotePdf(makeQuote())).rejects.toThrow(
  /\/Users\/x\/Desktop\/foo\.pdf/,
);
```

Each `await expect(...).rejects.toThrow(...)` re-invokes the function, meaning `save()` and `writeFile()` are called twice. This works today because `vi.mocked(save).mockResolvedValue(fakePath)` and `vi.mocked(writeFile).mockRejectedValue(...)` are sticky — they return the configured value on every call. But:

1. **Brittle to refactor:** Anyone switching to `mockResolvedValueOnce` (the typical Vitest idiom for "I want explicit per-call control") would silently break test #2 — `save()` returns `undefined` on the second call, `generateQuotePdf` early-returns at `if (!savePath) return;`, the assertion `rejects.toThrow(...)` fails with "Expected promise to reject, but it resolved" — but only on this one branch of one test.
2. **Wasted setup:** The test exercises the same code path twice when one invocation would suffice. It also makes mock-call counts non-obvious to a reader skimming the test.

**Fix:** Invoke `generateQuotePdf` once, capture the rejection, then assert both properties on the same error:

```ts
const fakePath = '/Users/x/Desktop/foo.pdf';
vi.mocked(save).mockResolvedValue(fakePath);
vi.mocked(writeFile).mockRejectedValue(
  new Error(`forbidden path: ${fakePath}`),
);

await expect(generateQuotePdf(makeQuote())).rejects.toThrow(
  expect.objectContaining({
    message: expect.stringMatching(
      /this location is restricted.*\/Users\/x\/Desktop\/foo\.pdf/s,
    ),
  }),
);
```

Or simpler — match a combined regex on one rejection:

```ts
await expect(generateQuotePdf(makeQuote())).rejects.toThrow(
  /Cannot save to "\/Users\/x\/Desktop\/foo\.pdf" — this location is restricted/,
);
```

This both halves the mock setup and tightens the assertion (the savePath echo must appear at a specific position in the rewritten message, not just somewhere in it).

---

### WR-02: `@tauri-apps/api` version skew — two copies ship after the pin

**File:** `package.json:39`

**Issue:** The pin `"@tauri-apps/api": "^2.10.1"` correctly aligns the JS API with the Rust `tauri 2.10.2` crate, unblocking the build. But `@tauri-apps/plugin-fs@2.5.1` and `@tauri-apps/plugin-dialog@2.7.1` BOTH declare `@tauri-apps/api: ^2.11.0` as a runtime dependency (not a peer dep). npm satisfies this by installing `@tauri-apps/api@2.11.0` nested inside each plugin's `node_modules`:

```
node_modules/@tauri-apps/api/package.json                            → 2.10.1 (top-level, your pin)
node_modules/@tauri-apps/plugin-fs/node_modules/@tauri-apps/api      → 2.11.0 (nested, plugin's dep)
node_modules/@tauri-apps/plugin-dialog/node_modules/@tauri-apps/api  → 2.11.0 (nested, plugin's dep)
```

Effect:
- The bundle will contain **two copies** of `@tauri-apps/api` (Vite's dedupe handles the same package name + same export shape but two physical files). This adds ~few KB to the lazy-loaded pdf chunk and is mildly confusing during PDF chunk inspection.
- When user code (anywhere outside the plugins) imports from `@tauri-apps/api`, it gets `2.10.1`. When the plugins call into their own bundled `@tauri-apps/api`, they get `2.11.0`. The two API surfaces are ABI-compatible at minor-version differences but not formally guaranteed.

This is a knock-on of the Rust crate `tauri 2.10.2` being one minor behind the latest plugin minors. The phase context acknowledges this; the fix is correct for unblocking `tauri build`, but the resulting drift in `package-lock.json` is worth recording.

**Fix:** Either:

1. **Acceptable status quo (recommended for v1.3):** Document the version skew in the phase summary; flag it as tech debt for a future "bump Rust tauri crate to 2.11.x + plugins" cleanup phase. The functional impact is nil.
2. **Tighter pin:** Use `npm overrides` to force `@tauri-apps/api` to `2.10.1` everywhere (including nested), so the plugins use the same physical copy. Caveat: plugins built against 2.11.0 may rely on 2.11-only types/exports (`Channel`, new `invoke` overloads), so this risks runtime breakage and would need a smoke test in `npm run tauri:dev` before committing:
   ```json
   "overrides": {
     "@tauri-apps/api": "2.10.1"
   }
   ```
3. **Bump the Rust side:** Update `src-tauri/Cargo.toml` `tauri = "2.11"` (and rebuild Cargo.lock) so the JS API can return to `^2.11.0`. This is the long-term clean fix but it's a different phase's work.

Given the context note that this skew is pre-existing and blocking the build was the urgent issue, option 1 is right for now — but it must not be lost.

---

### WR-03: `forbidden path` substring match is too loose

**File:** `src/pdf/generateQuotePdf.ts:337`

**Issue:**

```ts
if (msg.toLowerCase().includes('forbidden path')) {
```

This matches anywhere in the message text. The Rust error format from `plugins-workspace/v2/plugins/fs/src/error.rs` is fixed at `"forbidden path: {pathbuf}"` (with the colon and the pathbuf, anchored at the start of the error string). The current loose match would also fire on:

- A future Tauri/Rust error like `"operation not permitted on forbidden path component"` (unlikely but defensible against).
- A user-supplied notes or terms field whose content happens to flow into an error message containing the substring (very unlikely — notes go into the PDF body, not error messages — but the principle stands).
- A third-party plugin that someone might add later that uses similar verbiage.

The cost of a tighter check is one extra character (`:`) and a starts-with check:

**Fix:**

```ts
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  // Tauri fs plugin scope-denial format is fixed:
  //   #[error("forbidden path: {0}")] PathForbidden(PathBuf)
  // Source: plugins-workspace/v2/plugins/fs/src/error.rs.
  // Match the exact prefix (case-insensitive) so unrelated errors that happen
  // to contain the substring elsewhere don't get rewritten.
  if (msg.toLowerCase().startsWith('forbidden path:')) {
    throw new Error(
      `Cannot save to "${savePath}" — this location is restricted. ` +
      `Try saving to Downloads, Documents, or Desktop instead.`,
    );
  }
  throw err;
}
```

If you want to be extra robust to future Tauri error-string evolution (e.g., a prefix like `"fs: forbidden path: ..."`), keep the substring form but anchor it to the colon: `includes('forbidden path:')`. Either way, requiring the trailing colon excludes the false-positive class while keeping the test working as-written (`forbidden path: ${fakePath}` matches).

## Info

### IN-01: Save dialog filter allows non-`.pdf` extensions through

**File:** `src/pdf/generateQuotePdf.ts:323-326`

**Issue:** The `save()` filter `[{ name: 'PDF', extensions: ['pdf'] }]` only affects what's *visible* in the file picker; it does not enforce that the returned path ends in `.pdf`. On macOS the user can type `foo.txt` into the filename field and the dialog will return it. The current code then writes the PDF bytes to `foo.txt`, producing a file the OS thinks is text but is actually a PDF — surprising for the user.

This is pre-existing behavior, not introduced by Phase 18, but it's adjacent to the changed surface and worth noting.

**Fix (optional, low priority):** After `save()` returns, normalize the extension:

```ts
let savePath = await save({ defaultPath: filename, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
if (!savePath) return;
if (!savePath.toLowerCase().endsWith('.pdf')) {
  savePath = `${savePath}.pdf`;
}
```

This matches what `doc.save(filename)` does on the web branch (browser always saves with the literal filename including the `.pdf` from `buildFilename`).

---

### IN-02: Filename slug fallback can produce double-dash quote numbers

**File:** `src/pdf/generateQuotePdf.ts:262-266`

**Issue:** `buildFilename` returns `Quote-${qNum}-${slug}.pdf` when slug is non-empty, `Quote-${qNum}.pdf` otherwise. `formatQuoteNumber(42)` returns `Q-0042`, so the final filename is `Quote-Q-0042-myslug.pdf` or `Quote-Q-0042.pdf`. The triple-tokened `Quote-Q-0042` (two hyphens between two stems) is visually awkward — could be `Q-0042-myslug.pdf` for cleaner display. Style-only.

This is pre-existing, not introduced by Phase 18. Flagged because it's adjacent to the changed surface.

**Fix (style, no behavior change):**

```ts
return slug ? `${qNum}-${slug}.pdf` : `${qNum}.pdf`;
```

---

### IN-03: `_buildDoc` test-only export friction

**File:** `src/pdf/generateQuotePdf.ts:276-289`

**Issue:** `_buildDoc` is private (underscore prefix, not exported), so the test file can only assert against the post-`output('arraybuffer')` bytes via `generateQuotePdfBytes`. This forces tests to use the CMap-decoding `pdfExtractText` helper (lines 94-129 of the test file) instead of asserting on the structured document object directly. That helper is 35 lines of regex + CMap parsing that has nothing to do with the function under test — it's necessary infrastructure given the design choice, but worth flagging as a quality observation: if more PDF tests get added, consider exporting `_buildDoc` with an internal-only marker (e.g., a `__test__` re-export module) so future tests can assert on the jsPDF document tree directly.

Pre-existing, not introduced by Phase 18.

---

### IN-04: `dialog:allow-save` permission identifier should match the plugin's documented permission shape for clarity

**File:** `src-tauri/capabilities/default.json:10`

**Issue:** The capability uses the bare string `"dialog:allow-save"` (denoting the permission identifier without inline scope). This is correct — `dialog:allow-save` has no scope-able paths, only an enabled/disabled toggle. No fix needed. Flagged here only to confirm the file was reviewed line-by-line and the reviewer affirmatively considered whether dialog needed scope (it doesn't).

**Fix:** None. This is a no-op finding to make the review's coverage of the capability file explicit.

---

_Reviewed: 2026-05-25T11:48:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
