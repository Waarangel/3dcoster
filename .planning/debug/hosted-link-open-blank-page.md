# Debug Session — Hosted-quote link opens a blank page (UAT test 18, G-46-18)

**Date:** 2026-07-23
**Symptom:** Publishing a quote works and Copy works, but clicking the new HostedLinkActions "Open" button (or pasting the copied URL) lands on a blank page. Console: `No routes matched location "/q/f83da8d4-e8df-4d33-be95-d546ce2e2918"` (logged via React DevTools' `installHook.js`).
**Environment reported:** Desktop Tauri DEV (`npm run tauri dev`, Vite on :4173).

---

## What actually happened (event chain)

1. `usePublishedQuote.publish()` builds the canonical URL — `src/hooks/usePublishedQuote.ts:160`:
   ```ts
   const publishedUrl = `https://3dcoster.com/q/${token}`;
   ```
   This has been the construction since the hook was created in commit `f5ae58c` (43-04). It never used `window.location.origin` — Hypothesis 1 (localhost/tauri origin baked into the URL) is **disproved**. The URL itself is correct per the project's canonical-domain rule.

2. The Open button (`src/components/pro/HostedLinkActions.tsx:37-49`) does the right thing on desktop: `__IS_TAURI__` branch imports `@tauri-apps/plugin-shell` and calls `open(url)`, which launches the user's **default system browser** at the production URL (fallback `window.open(url, '_blank', 'noopener,noreferrer')`). Hypothesis 4 (WebView self-navigation) is **disproved** — the `installHook.js:1` console source is the React DevTools extension in the user's own Chrome, confirming the page opened in a real external browser.

3. The external browser hit `https://3dcoster.com/q/{token}` → apex 307s to `https://www.3dcoster.com/q/{token}` (verified live via curl 2026-07-23).

4. **Live production is still the pre-Phase-43 deployment.** v2.0 (Phases 38-46, including `api/q/[token].ts` and the current `vercel.json`) is on local main and deliberately NOT pushed (launch is a founder-driven event — see MEMORY / deploy guard). Verified live:
   ```
   curl -sI https://www.3dcoster.com/q/test-token-123
   → HTTP/2 200, content-type: text/html, last-modified: Fri, 17 Jul 2026
   → CSP has NO *.supabase.co / *.paddle.com entries  (i.e. the OLD vercel.json, pre-43-02)
   → body is the SPA index.html
   ```
   The deployed `vercel.json` still has the original catch-all SPA rewrite (`/(.*) → /`, commit `2676541`), so `/q/{token}` is served the SPA shell with HTTP 200.

5. The deployed SPA's router has **no `/q/*` route and no `*` catch-all in the web branch** — current `src/main.tsx:106-123` (web branch) declares `/app`, `/`, `/download`, `/features`, `/pricing`, `/roadmap`, `/feedback`, `/faq`, `/changelog`, `/privacy`, `/terms` and nothing else. (Only the Tauri branch has a catch-all: `main.tsx:104` `<Route path="*" element={<Navigate to="/" replace />}`.) The deployed v1.x bundle is the same shape. Result: `<Routes>` renders `null` → **blank page** + React Router's "No routes matched" warning.

So the blank page the user saw is **live production serving the old SPA for `/q/*`**, not a dev-server artifact and not a wrong-origin URL. Pasting the copied link reproduces it identically; the Tauri dev session is incidental.

---

## Root causes

### PRIMARY (what the user hit today): published links point at production, which does not yet serve the hosted-quote function
- `usePublishedQuote.ts:160` hard-codes `https://3dcoster.com/q/{token}` (correct per project rule), but the `/q/[token]` Vercel function + the `q/`-excluding rewrite exist only on unpushed local main. Until the v2.0 deploy, EVERY published link resolves to the old SPA catch-all → blank page.
- This is a launch-sequencing reality, not a URL bug — **but** it will NOT fully self-resolve on deploy because of the latent bug below.

### LATENT PRODUCTION BUG (would persist after the v2.0 deploy): no rewrite maps `/q/:token` to the function
- `vercel.json:3` — the ONLY rewrite is `{ "source": "/((?!q/|api/).*)", "destination": "/" }`. It *excludes* `/q/*` from the SPA fallback but **never routes `/q/:token` anywhere**.
- Vercel serves functions in the top-level `api/` directory at `/api/...` paths only: `api/q/[token].ts` answers at `/api/q/{token}`, **not** `/q/{token}`. There is no `middleware.ts`, no `routes`/`functions` config, nothing else (verified: repo root has no middleware; vercel.json has only `rewrites` + `headers`).
- Therefore on the v2.0 deploy, `GET /q/{token}` = no static file + no function match + no rewrite match → **Vercel platform 404 (`NOT_FOUND`)** — neither the branded page nor the branded D-16 404.
- How this slipped through: `43-VERIFICATION.md:39` marked "`/q/<token>` … reach the function router, not SPA fallback — VERIFIED" based solely on grepping the negative-lookahead pattern; the actual end-to-end check was explicitly deferred — `43-VALIDATION.md:87` has the unchecked box "`/q/[token]` real HTTP 404 + noindex + no-store on a preview deploy … Vercel Functions don't run under vite dev; needs a deployed preview", and `43-02-PLAN.md:33` itself said "verify on a preview deploy". That verification never happened, so the missing `/q/:token → /api/q/:token` rewrite was never caught.
- Note the PWA SW denylist half was done correctly (`vite.config.ts:70` `navigateFallbackDenylist: [/^\/q\//, /^\/api\//]`) — only the server-side positive mapping is missing.

### SECONDARY (the user's explicit ask): web SPA has no friendly catch-all
- `src/main.tsx:106-123` (web/`!__IS_TAURI__` branch) has no `path="*"` route → any unmatched location renders a blank page with only a console warning. The Tauri branch does have one (`main.tsx:104`). A friendly NotFound page (with a link home) is missing on web regardless of the hosted-quote outcome, and is the last-line safety net the user asked for.

### Pre-existing vs 46-11
- The bug predates plan 46-11. `ShareQuoteButton.handlePublish` (`src/components/pro/ShareQuoteButton.tsx:78-88`) has copied the exact same URL to the clipboard since 43-04; anyone pasting it got the same blank page. 46-11's Open button merely reduced friction to one click, surfacing it in UAT.

## Hypothesis scorecard
| # | Hypothesis | Verdict |
|---|---|---|
| 1 | `publishedUrl` built from `window.location.origin` (localhost/tauri origin) | **Disproved** — hard-coded canonical `https://3dcoster.com/q/{token}` since f5ae58c (usePublishedQuote.ts:160) |
| 2 | Dev-only vs production | **Refined** — today's failure IS live production (old deploy, catch-all rewrite). After the v2.0 deploy, `/q/{token}` would still fail (Vercel platform 404) because vercel.json lacks a `/q/:token → /api/q/:token` rewrite. Localhost `vite dev` additionally can never serve the function (43-VALIDATION.md:79), but that is not what the user hit — the URL never points at localhost. |
| 3 | Missing SPA catch-all | **Confirmed** — web branch of main.tsx has no `*` route; blank render on any unmatched path |
| 4 | Open handler navigates the WebView / wrong URL | **Disproved** — plugin-shell `open()` external-browser flow is correct (HostedLinkActions.tsx:39-48) |

## Live evidence (2026-07-23)
- `curl -sI https://3dcoster.com/q/test-token-123` → 307 → `https://www.3dcoster.com/q/test-token-123`
- `curl -sI https://www.3dcoster.com/q/test-token-123` → **200 text/html**, old CSP (no supabase/paddle), `last-modified: 17 Jul 2026`, body = SPA `index.html`
- `curl https://www.3dcoster.com/q/f83da8d4-e8df-4d33-be95-d546ce2e2918` (the user's actual token) → **200 text/html** (SPA shell, not the hosted page, not a 404)

## Fix direction (for the gap-closure planner — no code changed in this session)
1. **vercel.json:** add `{ "source": "/q/:token", "destination": "/api/q/:token" }` to `rewrites` (before/alongside the SPA rewrite; rewrites are non-conflicting since the SPA source excludes `q/`). Then actually run the deferred 43-VALIDATION preview-deploy check (200 for a published token, byte-identical 404 + noindex/no-store otherwise).
2. **src/main.tsx web branch:** add a lazy `path="*"` NotFound page (friendly message + link home) inside/alongside MarketingLayout — this is the user's explicit "never a blank page" requirement and also protects the interim window where production still lacks the function.
3. **Pre-launch expectation management (optional):** until v2.0 is deployed, any published link is dead-on-arrival by design. Consider a dev/UAT note or gating copy; do NOT change the canonical URL — `https://3dcoster.com/q/{token}` is correct per project rule.
