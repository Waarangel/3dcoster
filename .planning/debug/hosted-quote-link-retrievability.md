# Debug Session: Hosted-Quote Link Retrievability (Phase 46 UAT test 6, gap G-46-6R)

**Date:** 2026-07-23
**Type:** Missing UI affordance (design gap), not a crash. Cross-platform; worse on desktop.
**Truth:** After publishing, the hosted-quote link must stay retrievable — copyable on demand from the quote row, not only from a transient toast.
**Actual (verbatim):** "Share Quote shows and it generates a quote link, which shows up in toast for about 3 seconds then disappears. I have no idea where the link is, or how to get to it in the future."

---

## 1. Symptom decomposition

Two distinct failures hide inside the one report:

1. **Immediately after publish** — the ONLY surfaces for the URL are (a) a best-effort clipboard write and (b) a toast that auto-dismisses after 5 s. The toast content is plain text; there is no "Copy" control on it and no hover-pause on the timer.
2. **Returning later to an already-published quote** — NO UI anywhere renders or copies the persisted URL. The row shows a text-only "Live link" badge and the ShareQuoteButton toggles to "Unpublish". The link is genuinely unrecoverable from the app without destroying it (unpublish + republish mints a NEW token per D-13, invalidating the URL the customer already received).

## 2. PRIMARY root cause — `publishedUrl` is persisted but has ZERO read sites

The data layer does the right thing. `usePublishedQuote.ts:160-168` writes the URL onto the local Quote (Dexie) at publish time:

```ts
const publishedUrl = `https://3dcoster.com/q/${token}`;
await updateQuote({
  ...quote,
  publishedUrl,
  publishedAt: new Date(),
  publishStatus: 'published',
  hostedToken: token,
  hostedExpiresAt: options?.expiresAt,
});
```

But a repo-wide grep for `publishedUrl` (excluding tests) returns exactly:
- `src/types.ts:428` — the type declaration (doc comment at :427 even says "Stays set after unpublish … it isn't forgotten")
- `src/hooks/usePublishedQuote.ts:160,163,170` — the write + return

**No component ever reads `quote.publishedUrl`.** Same for a `3dcoster.com/q` display grep — the URL literal exists only at the construction site. The prior debug session (`.planning/debug/desktop-share-quote-parity.md` §3, line 59) already noted this in passing: "`publishedUrl` on the Quote is not rendered as a link anywhere (`types.ts:428` is the only other reference)."

What the UI actually renders for a published quote:

- **JobsManager row** (`src/components/JobsManager.tsx:317-321`): a `<span>` badge reading "Live link" — plain text, not an anchor, no copy action, no tooltip with the URL.
- **ShareQuoteButton** (`src/components/pro/ShareQuoteButton.tsx:103-120`): when `quote.publishStatus === 'published'` the single button renders **"Unpublish" only** (:116). There is no "Copy link" / "Open link" secondary action in either mount site (JobsManager.tsx:345, :395; PrintQuoteModal.tsx:620 footer).
- **PrintQuoteModal** edit view: same ShareQuoteButton, nothing else link-related.

So the design's only link surfaces are the one-shot clipboard write and the 5-second toast — exactly what 46-10-SUMMARY leaned on ("the existing toast-with-full-URL clipboard fallback already gives desktop parity"). That fallback was assessed for *parity of publishing*, not for *retrievability of the link*, which was never in scope of any phase.

## 3. Contributing factor A — toast is transient by design, with no escape hatch

- `ShareQuoteButton.tsx:80` and `:82` call `toast.success(...)` with **no `duration` option**, so `DEFAULT_TOAST_DURATION = 5000` ms applies (`src/components/ui/toast/types.ts:27`; timer set at `ToastProvider.tsx:30-35`). User-perceived "about 3 seconds" ≈ the 5 s default.
- `ToastViewport.tsx` has **no hover-pause**: the `setTimeout` in ToastProvider runs regardless of pointer position, so a user who spots the URL and moves the mouse to it can still lose it mid-selection. The toast content is a plain string inside `<div className="min-w-0">{toast.content}</div>` (:62) — no anchor, no copy button.
- `duration: 0` (persistent toast) exists in the API but is not used here.

## 4. Contributing factor B — desktop clipboard: unreliable AND lies on one failure mode

`ShareQuoteButton.tsx:74-89`:

```ts
const url = await publish(quote);
try {
  await navigator.clipboard?.writeText(url);
  toast.success(`Quote published — link copied to your clipboard: ${url}`);
} catch {
  toast.success(`Quote published: ${url}`);
}
```

Two distinct failure modes on Tauri (macOS WKWebView / Linux WebKitGTK):

1. **`navigator.clipboard` is `undefined`** → the optional chain makes the whole expression `undefined`; `await undefined` resolves (does not throw) → the SUCCESS toast claims "link copied to your clipboard" **when nothing was copied**. This is a silent false positive, not just a fallback.
2. **`navigator.clipboard` exists but `writeText` rejects** (WebKit permission/user-activation quirks) → `catch` fires → fallback toast shows the raw URL with no "copied" claim. This matches the user's report on the Tauri dev build (their toast contained the link; had the copy claim been believed-and-true they'd have the URL in the clipboard).

No `tauri-plugin-clipboard-manager` is installed (`src-tauri/Cargo.toml` plugin list: shell, window-state, dialog, fs, persisted-scope — confirmed in prior debug session §4; my grep of Cargo.toml/tauri.conf.json/capabilities/package.json for "clipboard" found nothing). So there is no native-clipboard fallback path on desktop.

**Web vs desktop:** on web (secure context, user-gesture click) `navigator.clipboard.writeText` almost always succeeds, so the user at least holds the link in the clipboard once — but the PRIMARY cause is identical on web: the moment the clipboard is overwritten or the session ends, the link is unreachable from the UI. The desktop clipboard flakiness merely makes the missing affordance impossible to miss.

## 5. Why "just publish again" is not a workaround

- The button for a published quote offers only "Unpublish" (`ShareQuoteButton.tsx:116`).
- Republishing mints a **new** `crypto.randomUUID()` token and inserts a new `hosted_quotes` row (`usePublishedQuote.ts:129,155,160`) — D-13 "frozen once published; the revision path is unpublish → regenerate → publish again (new URL)". The customer-held link would 404 (`unpublish` flips the row to `unpublished`, :182-186).
- So recovering the link via re-publish destroys the link that was already sent. Genuinely unrecoverable.

## 6. Hypotheses considered and outcome

| Hypothesis | Verdict | Evidence |
|---|---|---|
| URL not persisted locally at all | REJECTED | `usePublishedQuote.ts:161-168` writes `publishedUrl` + `hostedToken` to the Quote in Dexie |
| URL persisted but never surfaced in any UI | **CONFIRMED — PRIMARY** | zero read sites for `publishedUrl`; row shows text badge + Unpublish only |
| Toast too short / non-interactive | CONFIRMED — contributing | 5000 ms default, no duration override, no hover-pause, plain-text content |
| Desktop WKWebView clipboard failure → only toast shows link | CONFIRMED — contributing, with a twist | two failure modes; the `clipboard === undefined` mode shows a FALSE "copied" toast (`?.` + `await undefined` never throws) |
| Web unaffected | REJECTED | clipboard usually works on web, but retrievability gap is identical; web is one clipboard-overwrite away from the same dead end |

## 7. Evidence log

- Read in full: `src/components/pro/ShareQuoteButton.tsx`, `src/hooks/usePublishedQuote.ts`, `src/components/ui/toast/ToastProvider.tsx`, `ToastViewport.tsx`, `types.ts` (toast), `JobsManager.tsx:230-402` (QuoteRow), `PrintQuoteModal.tsx:590-640` (footer mount).
- `grep -rn "publishedUrl" src/` (non-test) → types.ts:428 + usePublishedQuote.ts only. No renderer.
- `grep -rn "3dcoster.com/q" src/` (non-test) → construction site only.
- `grep -rn clipboard src/ src-tauri/` → sole call site ShareQuoteButton.tsx:79; no Tauri clipboard plugin anywhere.
- Quote fields: `types.ts:427-440` (`publishedUrl`, `publishedAt`, `publishStatus`, `hostedToken`, `hostedExpiresAt`).
- Prior session `.planning/debug/desktop-share-quote-parity.md` §3 corroborates: no clipboard plugin; `publishedUrl` never rendered; `shell:default` capability with `allow-open` already granted for a future "open hosted page" action (pattern: `UpdateBanner.tsx:70-83` dynamic `import('@tauri-apps/plugin-shell')` → `open(url)` with `window.open` fallback).

## 8. Conclusion

PRIMARY: the hosted-quote URL is durably persisted on the Quote (`publishedUrl`, `hostedToken`) but **no UI component ever reads it back** — the published state renders only a text "Live link" badge and an "Unpublish" button, so the sole link surfaces are a one-shot clipboard write and a 5-second plain-text toast. Contributing: (a) desktop WKWebView clipboard is unreliable and the `navigator.clipboard?.writeText` optional-chain produces a **false "copied to clipboard" toast** when the API is absent; (b) the toast auto-dismisses in 5 s with no hover-pause, no copy control, and no persistent variant used. The gap exists on web too; desktop's clipboard flakiness just removes the only mitigation.

## 9. Fix direction (for the gap-closure planner — NOT implemented here)

- Surface `quote.publishedUrl` persistently wherever `publishStatus === 'published'`: e.g. an icon "Copy link" action (shared `IconButton` per the project's icon-button convention, with `aria-label="Copy link for {label}"`) next to the "Live link" badge and/or in ShareQuoteButton's published state (Unpublish + Copy link pair); optionally an "Open" action using the existing `plugin-shell` pattern on desktop.
- Fix the false-positive copy claim: only show "copied to your clipboard" when `navigator.clipboard?.writeText` actually ran (guard `if (navigator.clipboard) … else fallback`), and consider `tauri-plugin-clipboard-manager` for a reliable desktop copy.
- Toast: keep the toast, but with a real copy affordance and/or `duration: 0`/longer duration for this message — the toast should be a courtesy, never the system of record.
- Companion tests: `ShareQuoteButton.test.tsx` currently pins the toast-only behavior; extend for the new affordance and the corrected copy-claim logic.
