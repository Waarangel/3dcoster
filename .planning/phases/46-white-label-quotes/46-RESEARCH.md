# Phase 46: White-label quotes - Research

**Researched:** 2026-07-22
**Domain:** Client-side PDF image embedding (jsPDF), Supabase email-OTP auth on a Tauri desktop webview, client-side image processing, hosted-snapshot branding
**Confidence:** MEDIUM-HIGH (codebase-verified for the PDF/hosted-page/entitlement plumbing; MEDIUM on the Tauri-desktop-auth pieces where community sources disagree)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Branding scope**
- D-01: Logo + business name. White-label = maker logo (new upload) + existing `UserProfile.name`, on both the PDF and the hosted page. Not a full brand kit — no accent colors, no custom contact block this phase.
- D-02: Logo is Pro-only. Logo rendering + footer removal ship as one Pro white-label package. Free tier stays exactly as today.
- D-03: Settings → Branding section is the single management home (logo upload + preview, alongside the existing business-name field). Not managed in the quote modal.
- D-04: Logo + name render together on the quote header (logo above/beside the existing business-name text block; both always render). No layout branching for logo-replaces-name.

**Pro gating & lapse**
- D-05: Automatic when Pro — no toggle. Footer disappears and logo renders as soon as `isProStatus` is true (active + past_due). No "include 3DCoster footer" switch.
- D-06: Lapse reverts fully, keeps the data. On canceled/signed-out: footer returns, logo stops rendering on NEW PDFs; uploaded logo stays stored locally for instant restore on re-subscribe.
- D-07: Cached entitlement wins offline. Last-known-good entitlement applies when Supabase is unreachable.
- D-08: Desktop Pro auth ships in this phase (scope expansion). Mechanism: email OTP code entry — same Supabase email flow delivers a 6-digit code typed into the desktop app. NO custom-protocol deep-link, no per-OS protocol registration. Session persistence mechanism on desktop is research territory.

**Hosted page depth**
- D-09: Hosted powered-by stays until a logo is set. Publishing while Pro but with no logo configured keeps the "Powered by 3DCoster" footer; once a logo is uploaded, new publishes are fully white-label.
- D-10: PDF and hosted page deliberately differ. PDF: footer gone for ANY Pro user. Hosted page: powered-by until logo set. Do not "align" them.
- D-11: White-label bakes into the frozen publish snapshot. Logo + footer state are part of the snapshot at publish time. Already-live links never change.
- D-12: Hosted page keeps its current design minus 3DCoster marks. No neutral-document restyle, no maker accent color — swap in logo + name, drop the powered-by line.

**Free-user upsell surface**
- D-13: Branding section visible to all, Pro-chipped. Free users see the section with the logo slot behind a Pro chip; interacting opens the Pro pitch modal. Mirrors Share-quote D-10.
- D-14: One pitch modal, full Pro story. Extend `ProPitchModal` to present the Pro bundle (hosted quote links + white-label), shown from both entry points.
- D-15: All three marketing flips in-phase: (a) two /features "Coming" pills flip to shipped Pro pills; (b) /pricing's Pro card gains white-label; (c) white-label entries come OFF /roadmap.

### Claude's Discretion
- Logo image constraints: accepted formats, size cap, client-side downscale/compression strategy, preview UX
- Logo delivery to the hosted page: data-URL embedded in the publish snapshot vs a storage mechanism (weigh row size vs infra; snapshot embedding is the frozen-snapshot-consistent default)
- Logo storage locally (Dexie field/blob shape on UserProfile or a dedicated store) + backup/restore + file-sync inclusion (follow additive-schema + backupSchema conventions)
- Desktop OTP UI shape (where the code-entry field lives in the existing SignInModal flow) and desktop session persistence mechanism (research-informed)
- Exact PDF header layout with logo (positioning, max dimensions on the page)
- NEW-badge registration per `src/features.ts` conventions
- ProPitchModal copy for the bundle pitch
- Whether the approval-notification email needs any branding touch (only if trivially cheap)

### Deferred Ideas (OUT OF SCOPE)
- Full brand kit (accent color, custom contact block, themed hosted page)
- Neutral/light "document" restyle of the hosted page
- Per-quote white-label choice at publish (superseded by the logo-set rule, D-09)
- Deep-link desktop auth (`3dcoster://`)
- Approval-email branding (unless trivially cheap)
</user_constraints>

<phase_requirements>
## Phase Requirements

No phase requirement IDs are mapped in REQUIREMENTS.md for Phase 46 (it is a post-v2.0-roadmap addition — Phases 46-51 were appended 2026-07-22 as a founder launch-scope expansion and have not yet been folded into REQUIREMENTS.md's traceability table). The phase's obligations are instead fully specified by 46-CONTEXT.md's locked decisions (D-01 through D-15) above — the planner should treat those as the requirement set for this phase, and the phase goal text from ROADMAP.md §Phase 46 as the acceptance bar: *"Pro users can present quotes under their own brand — white-label PDF quotes and a white-label hosted quote page (maker's brand only, no 3DCoster powered-by footer) — flipping the first two /features 'Coming' pills to shipped."*
</phase_requirements>

## Summary

Phase 46 is almost entirely a codebase-extension phase, not a new-technology phase. Every one of its three real subsystems — the jsPDF quote engine, the `api/q/[token].ts` hosted-page renderer, and the Supabase Pro-auth stack — already exists and already has the exact seam this phase needs to extend (the header already renders `businessName`, the hosted snapshot type already has an optional `businessName` field, `usePublishedQuote`'s publish payload already spreads business identity into the snapshot). The one genuinely new piece of engineering is D-08's scope expansion: enabling Supabase auth on the Tauri desktop build, which today is **fully gated off** (`supabase` is `null` at the module level whenever `__IS_TAURI__` is true — see `src/lib/supabaseClient.ts`). That gate removal is a bigger change than "add OTP UI" — it also requires wiring `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` into the desktop release build (currently **absent** from `.github/workflows/release.yml`) and adding `https://*.supabase.co` to Tauri's own CSP `connect-src` (currently **absent** from `src-tauri/tauri.conf.json`). Both are concrete, verified gaps, not speculation.

For the logo itself, the strong recommendation is **zero new npm/Cargo dependencies**. Store the logo as a base64 data-URL string on `UserProfile` (a plain JSON-serialized settings row in Dexie already — no schema bump, no `backupSchema.ts` change, syncs for free through the existing settings-merge path). Resize/compress it client-side with the native Canvas API (`drawImage` + `toDataURL`), the same approach every comparable library (Compressorjs, browser-image-compression) wraps internally — for a single small logo image, the vanilla version is simpler than importing a library for it. Feed the resulting data URL straight into `jsPDF.addImage()` (already imported) and into the hosted-page HTML as an `<img src="...">` (the existing `escapeHtml`/CSP infrastructure needs one addition: **strict `data:image/(png|jpeg|webp);base64,` allowlisting** before that string is ever interpolated into an `<img src>` — this is a real XSS vector if skipped, see Security Domain).

For desktop session persistence (D-08's open research question), the evidence points to the **simplest option being sufficient**: Tauri's WebView (WKWebView / WebView2 / WebKitGTK) persists `localStorage` across app restarts by default, in the same way supabase-js already persists sessions on the web build (T-43-09's accepted disposition). No new Tauri plugin (`tauri-plugin-stronghold`, `tauri-plugin-keyring`) is needed to hit an acceptable security bar for a single-local-user desktop app — those plugins exist and are viable, but add real complexity (password-derived vault unlocking for Stronghold; a community-maintained native-keychain binding for Keyring) for a marginal gain over what the OS-level file-permission-protected WebView storage already provides, and would be inconsistent with the project's own accepted web disposition for the identical threat model.

**Primary recommendation:** No new dependencies. Reuse jsPDF's existing `addImage`/`getImageProperties`, a vanilla Canvas resize helper, the existing Supabase `signInWithOtp`/`verifyOtp` pair (same API call already used for the web magic link — only the auth email TEMPLATE needs a `{{ .Token }}` addition), and Tauri's already-persistent WebView `localStorage`. The two real infrastructure gaps to close are: (1) desktop build env vars for Supabase, and (2) Tauri CSP `connect-src` for `*.supabase.co`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Logo upload, resize/compress, preview | Browser / Client (web) + Frontend Server-equivalent WebView (desktop) | — | Pure client-side image processing (Canvas API); never touches a backend. Runs identically in both shells. |
| Logo + business-name storage | Database / Storage (Dexie/IndexedDB, on-device) | — | Additive field on the existing `UserProfile` settings row — same tier as `name` today. |
| White-label PDF render | Browser / Client (jsPDF, in-process) | — | `generateQuotePdf.ts` is a pure client-side generator; no server involvement, mirrors the existing footer/header logic. |
| White-label hosted page render | API / Backend (Vercel Serverless Function, `api/q/[token].ts`) | CDN / Static (response headers only, `no-store`) | Server-rendered HTML per request; already owns all branding/footer logic for the hosted page. |
| Publish snapshot assembly (logo joins payload) | Browser / Client (`usePublishedQuote.ts`) → API / Backend (Supabase insert) | Database / Storage (Supabase Postgres `hosted_quotes.snapshot` jsonb) | Snapshot is built client-side, written via Supabase client SDK, stored server-side — same tier split as the existing `businessName`/`variantsSnapshot` fields. |
| Pro entitlement gate (D-05/D-06/D-07) | Browser / Client (`useEntitlement.ts`, reads own row via RLS) | Database / Storage (`entitlements` table, webhook-written) | Unchanged — this phase only adds NEW callers of the existing hook/gate, not new gate logic. |
| Desktop Pro auth (D-08, OTP) | Browser / Client-equivalent (Tauri WebView, `useProAuth.ts`) | API / Backend (Supabase Auth `signInWithOtp`/`verifyOtp`) | Same auth tier as web sign-in — the only change is which UI collects the credential (code field vs. clicking a link) and where the session persists (WebView `localStorage` vs. browser `localStorage`). |
| Marketing flips (/features, /pricing, /roadmap) | Frontend Server-equivalent (static marketing pages, client-rendered) | — | Pure content/copy changes, no new architecture. |

## Standard Stack

### Core (all already installed — no `npm install` needed)

| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jspdf` | 4.2.1 [VERIFIED: npm registry — already a direct dependency, confirmed via `npm view jspdf version`] | PDF generation, including `addImage`/`getImageProperties` for the logo | Already the project's PDF engine (`src/pdf/generateQuotePdf.ts`); no reason to add a second PDF/image library |
| `@supabase/supabase-js` | 2.110.8 [VERIFIED: npm registry — already installed at 2.110.5 in package.json; `npm view` confirms 2.110.8 is current] | `auth.signInWithOtp` (already used) + `auth.verifyOtp` (new call, same SDK) for the desktop OTP code path | Already the project's only auth/backend SDK |
| Browser Canvas API (`HTMLCanvasElement`, `drawImage`, `toDataURL`) | Native (no package) | Client-side logo resize/downscale + re-encode to PNG/JPEG | Zero new dependency; every comparable compression library (Compressorjs, browser-image-compression) is a thin wrapper over this exact API — for a single small logo upload, wrapping it directly is simpler than adding a library |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tauri WebView `localStorage` (native, no Cargo plugin) | N/A | Persist the Supabase session on desktop, exactly as the web build already does | Recommended default for D-08 — see "Alternatives Considered" |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla Canvas resize | `browser-image-compression` (npm, [ASSUMED] — not verified against an authoritative source, only WebSearch training-adjacent results; `npm view browser-image-compression version` returns `2.0.2` but this alone does NOT confer VERIFIED status per the package-provenance rule) | Adds a dependency (~28KB) for functionality that is a ~30-line canvas helper for this phase's single-image use case. Only worth it if future phases need EXIF-aware rotation, worker-thread offload for large batch uploads, or multi-format edge-case handling — none apply to a single small logo upload. Recommend NOT installing it. |
| Tauri WebView `localStorage` (persisted automatically) | `tauri-plugin-stronghold` (official, encrypted vault) | Stronger encryption-at-rest, but requires a password-derived vault key (UX friction: either prompt the user for a vault password, or derive one from a fixed app secret which defeats the purpose) and a new Cargo dependency + Rust-side wiring. Overkill for a single OAuth-style session token in a single-local-user desktop app that already accepts the equivalent risk on web (T-43-09). |
| Tauri WebView `localStorage` | `tauri-plugin-keyring` (community-maintained, native OS keychain) | True OS-keychain storage (macOS Keychain / Windows Credential Manager / Linux Secret Service), but two competing community forks exist (`charlesportwoodii/tauri-plugin-keyring`, `HuakunShen/tauri-plugin-keyring`) with no official Tauri-team package — a supply-chain risk for a project that otherwise keeps its Rust dependency surface minimal (see `src-tauri/Cargo.toml`: only official `tauri-plugin-*` crates today). Revisit only if desktop Pro usage grows and a formal security review flags localStorage-on-desktop as insufficient. |
| `signInWithOtp` + a NEW dedicated "send code" email template | Reusing the SAME "Magic Link" email template for both flows | A single shared template must render BOTH `{{ .ConfirmationURL }}` (web click-through) AND `{{ .Token }}` (desktop code-entry) — community reports (see Pitfalls) disagree on whether both variables reliably work together in one template. A dedicated second template avoids the ambiguity but Supabase's free/default auth email system does not cleanly support "two templates for the same underlying OTP type" without extra Auth Hook complexity. Recommend: modify the shared Magic Link template to include both variables, and REQUIRE a live send-and-verify test against the actual Supabase project at plan/implementation time before relying on it (see Pitfall 2). |

**Installation:** None required — no new `npm install` or `cargo add` for this phase's Core/Supporting stack.

## Package Legitimacy Audit

**No new external packages are recommended for this phase.** All required functionality is covered by already-installed dependencies (`jspdf`, `@supabase/supabase-js`) plus native browser/WebView APIs (Canvas, `localStorage`). The Package Legitimacy Gate protocol is therefore N/A — there is nothing to check against `gsd-tools query package-legitimacy check`.

If the planner or an implementation task later decides `browser-image-compression` (or any other image-processing package) IS worth adding despite the recommendation above, it MUST run the Package Legitimacy Gate before that install and add a `checkpoint:human-verify` task, per the standard protocol — the entry above (`npm view` result 2.0.2) is `[ASSUMED]`, not cleared for use.

**Packages removed due to [SLOP] verdict:** none (no packages proposed)
**Packages flagged as suspicious [SUS]:** none (no packages proposed)

## Architecture Patterns

### System Architecture Diagram — Logo upload → render (both surfaces)

```
┌─────────────────────────┐
│ Settings → Branding      │  (NEW UI, D-03)
│ section (web + desktop)  │
└───────────┬──────────────┘
            │ user selects an image file (<input type="file"> — precedent:
            │ GcodeImport.tsx / CsvImportModal.tsx raw-html pattern)
            ▼
┌─────────────────────────┐
│ Client-side validate      │  MIME sniff via Image() load (not just file.type),
│ (format + size cap)       │  reject SVG / anything that fails to decode as an image
└───────────┬──────────────┘
            ▼
┌─────────────────────────┐
│ Canvas resize/compress    │  drawImage → bounding-box scale → toDataURL('image/png'
│ (native Canvas API)       │  or 'image/jpeg', quality)
└───────────┬──────────────┘
            ▼
┌─────────────────────────┐
│ UserProfile.logoDataUrl   │  additive optional field, stored via existing
│ (Dexie settings row)      │  setUserProfile() — no schema bump, no backupSchema.ts
│                            │  change (already inside the JSON-serialized blob)
└──┬─────────────────────┬─┘
   │                      │
   │ (D-05 gate: isProStatus)                (D-11: joins publish snapshot)
   ▼                      ▼
┌──────────────┐   ┌──────────────────────────┐
│ generateQuote │   │ usePublishedQuote.publish │
│ Pdf.ts header │   │  → hosted_quotes.snapshot │
│ + footer      │   │  (Supabase, jsonb)        │
│ (jsPDF        │   └────────────┬──────────────┘
│  addImage)    │                ▼
└──────────────┘   ┌──────────────────────────┐
                    │ api/q/[token].ts          │  D-09: footer stays until a
                    │  renders <img src="data:  │  logo IS set; D-11: frozen at
                    │  image/...;base64,...">   │  publish time, never re-reads
                    │  (STRICT allowlist first) │  UserProfile after publish
                    └──────────────────────────┘
```

### System Architecture Diagram — Desktop Pro auth (D-08)

```
┌───────────────────┐
│ Tauri desktop app   │  __IS_TAURI__ === true
│ SignInModal (web-   │  today gates supabase = null at MODULE level
│ only today, D-12)   │  (src/lib/supabaseClient.ts)
└─────────┬──────────┘
          │ THIS PHASE: gate flips to "real client on desktop too"
          ▼
┌───────────────────────────┐     ┌─────────────────────────────┐
│ buildClient() constructs    │────▶│ VITE_SUPABASE_URL/ANON_KEY   │
│ a real SupabaseClient on    │     │ MUST be baked into desktop    │
│ desktop (currently only     │     │ build — release.yml currently │
│ built for web)              │     │ does NOT inject these (GAP)   │
└─────────┬───────────────────┘     └─────────────────────────────┘
          │
          ▼
┌───────────────────────────┐
│ signInWithOtp({ email })    │  SAME call as web (useProAuth.signInWithEmail) —
│ Supabase sends ONE email    │  no new backend logic
│ with {{ .ConfirmationURL }} │
│ AND {{ .Token }} (template  │
│ change required — see       │
│ Pitfall 2)                  │
└─────────┬───────────────────┘
          ▼
┌───────────────────────────┐
│ NEW: OTP code-entry field   │  desktop-only UI addition to SignInModal
│ (6-digit input)             │  (or a desktop-specific variant)
└─────────┬───────────────────┘
          ▼
┌───────────────────────────┐
│ verifyOtp({ email, token,   │  NEW call — not used anywhere in the codebase yet
│ type: 'email' })            │
└─────────┬───────────────────┘
          ▼
┌───────────────────────────┐
│ Session persisted to Tauri  │  Tauri WebView localStorage persists across
│ WebView localStorage        │  restarts by default (WKWebView/WebView2/
│ (RECOMMENDED — no new       │  WebKitGTK all confirmed) — mirrors the web
│ plugin)                     │  build's T-43-09 accepted disposition
└─────────┬───────────────────┘
          ▼
┌───────────────────────────┐
│ useEntitlement() reads own  │  UNCHANGED logic — same hook, now also called
│ row via RLS → isProStatus   │  from desktop once supabase !== null
└───────────────────────────┘
```

### Recommended Project Structure (delta only — no new top-level folders)

```
src/
├── components/
│   ├── settings/ (or wherever Settings sub-sections live today — see
│   │   UserProfileModal.tsx for the existing business-name field's home)
│   │   └── BrandingSection.tsx     # NEW — logo upload/preview + Pro chip (D-03/D-13)
│   └── pro/
│       ├── SignInModal.tsx         # EXTEND — desktop OTP code field (D-08)
│       └── ProPitchModal.tsx       # EXTEND — bundle copy (D-14)
├── hooks/
│   └── usePublishedQuote.ts        # EXTEND — logo joins the publish snapshot (D-11)
├── pdf/
│   └── generateQuotePdf.ts         # EXTEND — logo in header, conditional footer (D-05)
├── utils/
│   └── imageResize.ts              # NEW — canvas-based downscale/compress helper
├── lib/
│   └── supabaseClient.ts           # EXTEND — remove/adjust the __IS_TAURI__ → null gate
└── types.ts                        # EXTEND — UserProfile.logoDataUrl?: string

api/
└── q/[token].ts                    # EXTEND — render logo + D-09 conditional footer

src-tauri/
└── tauri.conf.json                 # EXTEND — connect-src gains *.supabase.co (GAP, required)

.github/workflows/
└── release.yml                     # EXTEND — inject VITE_SUPABASE_URL/ANON_KEY (GAP, required)
```

### Pattern 1: jsPDF logo embedding with explicit format (avoids the "UNKNOWN file type" bug)
**What:** Pass the image format explicitly to `addImage()` rather than relying on jsPDF's magic-byte auto-detection, and use `getImageProperties()` to compute a bounding-box-preserving scale.
**When to use:** Any time the PDF header renders the maker's logo.
**Example:**
```typescript
// Source: jsPDF module-addImage docs (https://rawgit.com/MrRio/jsPDF/master/docs/module-addImage.html)
// [CITED: jsPDF addImage docs] — format param avoids a documented "does not
// support files of type 'UNKNOWN'" failure mode in some jsPDF versions when
// auto-detection is relied on (github.com/parallax/jsPDF/issues/1899).
function renderLogo(doc: jsPDF, logoDataUrl: string, x: number, y: number, maxW: number, maxH: number): number {
  // logoDataUrl is a data: URL produced by our own canvas resize step, so we
  // KNOW the mime type — extract it rather than trusting jsPDF's sniffing.
  const mimeMatch = /^data:image\/(png|jpeg|webp);base64,/.exec(logoDataUrl);
  if (!mimeMatch) return y; // defensive: never render an unrecognised payload
  const format = mimeMatch[1].toUpperCase() as 'PNG' | 'JPEG' | 'WEBP';

  const props = doc.getImageProperties(logoDataUrl); // { width, height } in px
  const scale = Math.min(maxW / props.width, maxH / props.height, 1);
  const w = props.width * scale;
  const h = props.height * scale;

  doc.addImage(logoDataUrl, format, x, y, w, h);
  return y + h;
}
```

### Pattern 2: Canvas-based logo resize/compress (no new dependency)
**What:** Downscale an uploaded image to a bounding box and re-encode, entirely client-side.
**When to use:** Immediately after file selection in the Branding section, before storing to `UserProfile`.
**Example:**
```typescript
// Source: MDN Canvas API (drawImage, toDataURL) — standard pattern also used
// internally by Compressorjs/browser-image-compression. [CITED: MDN Canvas docs]
async function resizeImageToDataUrl(
  file: File,
  maxDim: number,
  outputMime: 'image/png' | 'image/jpeg',
  quality = 0.85,
): Promise<string> {
  const bitmap = await createImageBitmap(file); // throws on non-image/corrupt input — this IS the format validation step
  const scale = Math.min(maxDim / bitmap.width, maxDim / bitmap.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(outputMime, quality);
}
```

### Pattern 3: Supabase email-OTP verify (desktop code entry)
**What:** Exchange a 6-digit code (delivered in the same email as the existing magic link) for a session, without following a link.
**When to use:** Desktop `SignInModal` OTP step (D-08).
**Example:**
```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-verifyotp
// [CITED: supabase.com/docs/reference/javascript/auth-verifyotp]
const { data: { session }, error } = await supabase.auth.verifyOtp({
  email,        // same email the user typed into signInWithOtp()
  token: code,  // the 6-digit string the user typed in
  type: 'email',
});
if (error) {
  // Common cases: expired token, wrong code, too many attempts (Supabase
  // rate-limits OTP verification attempts per token).
}
```

### Anti-Patterns to Avoid
- **Relying on jsPDF's automatic format detection for the logo:** documented failure mode (`UNKNOWN` file type) in some versions — always pass the format explicitly (Pattern 1).
- **Interpolating `logoDataUrl` into the hosted-page HTML without a strict allowlist check:** treat it exactly like the React Security guidance on unsafe URL schemes (`javascript:`/`data:` in `href`/`src`) — a `data:` URL IS the desired mechanism here, but the prefix and payload must be validated, not trusted blindly (see Security Domain).
- **Adding a new Tauri Cargo plugin (Stronghold/Keyring) before confirming the simple localStorage approach is insufficient:** adds Rust-side complexity and (for Keyring) an unvetted community dependency for a threat model the project has already accepted on web (T-43-09).
- **Storing the logo as a Dexie `Blob`/binary field:** `BackupData` (backupSchema.ts) flattens everything through `JSON.stringify` — a `Blob` cannot round-trip through that without new base64-encode/decode plumbing. A string data-URL field avoids inventing that plumbing entirely, since it already IS a JSON-safe string.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resize/compress | A custom multi-format encoder or a hand-rolled JPEG quality search loop | The browser's native Canvas `toDataURL(mime, quality)` (Pattern 2) | It already implements exactly this; anything more elaborate (progressive JPEG, format auto-selection heuristics) is out of scope for a single small logo upload |
| Auth session storage on desktop | A hand-rolled encrypted file store or an ad-hoc device-fingerprint token scheme | Tauri WebView's built-in `localStorage` persistence (already what supabase-js does by default) | Reinventing session storage risks a WORSE security posture than the platform default, and duplicates work supabase-js already does correctly |
| OTP code delivery/verification | A custom "generate + email + verify" 6-digit code system | Supabase's built-in `signInWithOtp`/`verifyOtp` (already partially wired via the existing magic-link flow) | Supabase already generates, rate-limits, expires, and verifies OTP codes server-side; hand-rolling this duplicates real security-sensitive logic (timing-safe comparison, expiry, replay protection) for zero benefit |
| Detecting whether an uploaded file is really an image | Sniffing magic bytes manually | `createImageBitmap(file)` (throws/rejects on non-image or corrupt input) — see Pattern 2 | The browser's own image decoder is a stronger, already-audited validator than a hand-rolled magic-byte check, and it's the same code path that will actually render the file |

**Key insight:** Every "new" piece of Phase 46 is a thin extension of an already-solved problem in this codebase or platform. The temptation to add a compression library, a new Tauri secure-storage plugin, or a bespoke OTP system should be resisted — each of those already has a good-enough native/existing answer, and each addition would be new attack surface or new dependency-maintenance burden for a phase whose founder estimate was "days."

## Common Pitfalls

### Pitfall 1: jsPDF `addImage` throws on unrecognised format when auto-detection fails
**What goes wrong:** Calling `doc.addImage(dataUrl, ...)` without an explicit format argument can throw "does not support files of type 'UNKNOWN'" for certain image byte patterns, due to a documented typo/limitation in jsPDF's `getImageFileTypeByImageData` fallback logic.
**Why it happens:** jsPDF tries to sniff the format from magic bytes when no format is given; the fallback-to-nominated-format path has a known bug in some versions.
**How to avoid:** Always pass the format explicitly (Pattern 1) — since our own canvas resize step controls the output MIME type, we always know it in advance.
**Warning signs:** A PDF generation error specifically mentioning "UNKNOWN" during logo rendering, especially for PNG logos with unusual color profiles.

### Pitfall 2: One shared Supabase email template must serve TWO delivery mechanisms
**What goes wrong:** The existing web magic-link flow and the new desktop OTP flow both originate from the SAME `signInWithOtp()` API call and the SAME Supabase "Magic Link" email template. To support both, that template needs BOTH `{{ .ConfirmationURL }}` (web) and `{{ .Token }}` (desktop) present — but community reports (GitHub Discussions) describe cases where the `{{ .Token }}` value did not verify successfully when both variables were included in one template, while Supabase's own docs only document the single-purpose case (template has `{{ .Token }}` alone → OTP-only mode).
**Why it happens:** Email OTP and Magic Link share the same underlying auth flow/token in Supabase's implementation; the "add both variables" approach is a documented technique but not a guaranteed-supported one, and template rendering edge cases are under-documented.
**How to avoid:** Before relying on this, send a real test email against the live Supabase project (not a staging assumption) with a template containing both variables, and confirm `verifyOtp` actually succeeds with the delivered `{{ .Token }}` value. Do this AT PLAN TIME or as an early implementation task, not as an assumption baked into the plan — it is currently the single highest-uncertainty item in this phase. If it does NOT work reliably, the fallback is to programmatically extract the token from the confirmation URL's query string client-side documentation is not settled either way) or accept a slightly different UX (e.g., a distinct-looking "your code is below the link" template section that Supabase happens to render correctly).
**Warning signs:** `verifyOtp` returning "Token has expired or is invalid" immediately after a fresh email arrives with a code that looks well-formed.

### Pitfall 3: Desktop build currently has NO Supabase env vars and NO Supabase CSP origin
**What goes wrong:** Even after code changes to `supabaseClient.ts` remove the `__IS_TAURI__ → null` gate, the desktop build will still silently degrade to `supabase = null` because `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are not present in the GitHub Actions build environment (`.github/workflows/release.yml`'s "Build frontend with Tauri flag" step only sets `TAURI_ENV_PLATFORM`). Separately, even with the env vars present, any Supabase network call from the desktop WebView will be blocked by Tauri's OWN CSP (`src-tauri/tauri.conf.json`'s `security.csp.connect-src`), which today lists only `api.github.com`, `cdn.jsdelivr.net`, the two FX API hosts, and `formspree.io` — no `*.supabase.co`.
**Why it happens:** Phase 43 (D-12) deliberately scoped Pro to web-only, so neither of these was ever wired for desktop.
**How to avoid:** Two concrete, required changes: (1) add `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (sourced from the same GitHub repo secrets already used for the web Vercel deploy) as `env:` entries on the "Build frontend with Tauri flag" step in `release.yml`; (2) add `https://*.supabase.co` to `connect-src` in `src-tauri/tauri.conf.json`'s `security.csp`. Both should be verified against a real local `tauri dev`/`tauri build` run, not just code-reviewed — this is exactly the kind of gap the existing `e2e/free-floor-no-network.spec.ts` pattern was designed to catch on web.
**Warning signs:** Desktop OTP sign-in silently no-ops (status stays `unavailable`), or browser devtools (if attached to the WebView) shows CSP violation errors for `supabase.co` requests.

### Pitfall 4: `logoDataUrl` interpolated into hosted-page HTML without validation is a stored-XSS vector
**What goes wrong:** `api/q/[token].ts` builds HTML via string interpolation (see `renderHostedQuotePage`, `pageShell`). If a future `snapshot.logoDataUrl` string is inserted into an `<img src="${snapshot.logoDataUrl}">` tag without validating its prefix, a snapshot containing `src="javascript:..."` or a malformed value breaking out of the `src="..."` attribute (e.g., embedded `"` characters) becomes a self-inflicted-but-still-real XSS surface on a page the maker's OWN customers view.
**Why it happens:** The existing `escapeHtml()` helper escapes text content, but `src="${value}"` needs attribute-value escaping AND scheme allowlisting — two different concerns, and it's easy to only apply one.
**How to avoid:** Before ever writing `logoDataUrl` into the publish snapshot (client-side, in `usePublishedQuote.ts`) AND again before rendering it server-side (in `api/q/[token].ts`), validate with a strict regex: `/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/`. Reject (omit the logo, degrade gracefully — same pattern the hosted page already uses for a missing `businessName`) rather than render anything that doesn't match. This mirrors the project's own React Security guidance on unsafe URL schemes almost exactly — `data:` URLs are exactly the case that guidance warns needs explicit validation, and here we're intentionally using the scheme, which makes the allowlist even more load-bearing.
**Warning signs:** None visible in normal operation — this is a defense-in-depth requirement, not something that will show up in a manual test unless specifically probed. Flag this for the D-17-style security review this project runs before major releases.

### Pitfall 5: A worktree with an in-flight change to `generateQuotePdf.ts` may exist
**What goes wrong:** `git worktree list` shows `.claude/worktrees/cool-kowalevski-9831d4` (branch `claude/cool-kowalevski-9831d4`) checked out at `f94bc1d` — the same commit currently on `main`'s recent history — with its own copy of `src/pdf/generateQuotePdf.test.ts`. It appears stale/in-sync with `main` rather than actively diverging, but per this project's own working-style precedent ("Coordinate with spawned agents"), any plan touching `generateQuotePdf.ts` should confirm that worktree isn't mid-session before starting parallel work.
**Why it happens:** GSD/agent sessions can leave worktrees behind after completing.
**How to avoid:** `git worktree list` + check the branch's last commit/status before starting Phase 46 execution; clean up if abandoned, coordinate if live.
**Warning signs:** Merge conflicts in `generateQuotePdf.ts` that don't correspond to anything in the Phase 46 plan.

## Code Examples

### Conditional footer render (D-05/D-06 pattern, mirrors existing quote-variants conditional branches)
```typescript
// Source: existing src/pdf/generateQuotePdf.ts renderFooter() — pattern to extend
// [VERIFIED: read directly from the current codebase]
function renderFooter(doc: jsPDF, isWhiteLabel: boolean): void {
  if (isWhiteLabel) return; // D-05: footer disappears automatically when Pro
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setFont(FONT_ID, 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Made with 3DCoster — 3dcoster.com', MARGIN_LEFT, pageHeight - 30);
  doc.setTextColor(0, 0, 0);
}
```

### Hosted-page powered-by rule (D-09: stays until a logo IS set — different rule than the PDF)
```typescript
// Source: existing api/q/[token].ts pageShell() footer — pattern to extend
// [VERIFIED: read directly from the current codebase]
function footerHtml(hasLogo: boolean): string {
  // D-09/D-10: unlike the PDF (any Pro user loses the footer), the hosted
  // page keeps "Powered by 3DCoster" until the maker has actually set a
  // logo — this is DELIBERATELY a different rule from the PDF's D-05 rule.
  if (hasLogo) return '';
  return '<p class="footer">Powered by <a href="https://3dcoster.com">3DCoster</a></p>';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Web-only Pro tier (`__IS_TAURI__` → `supabase = null` on desktop) | Desktop also gets a real Supabase client, gated to auth-only surfaces (not necessarily hosted-quote publishing — see Open Questions) | This phase (D-08), reversing Phase 43's D-12 web-first scoping | Desktop app's bundle now includes `@supabase/supabase-js` (previously dead-code-eliminated per the `IS_TAURI` compile-time check) and makes its first-ever network calls beyond the GitHub releases check |
| Magic-link-only sign-in | Magic-link (web) + OTP-code (desktop), same underlying Supabase call | This phase | The shared auth email template becomes dual-purpose — see Pitfall 2 |

**Deprecated/outdated:** Nothing in this phase deprecates prior work — it is purely additive to Phase 43's Pro backend and Phase 41's Quote Variants PDF engine.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tauri's WebView (WKWebView/WebView2/WebKitGTK) persists `localStorage` across app restarts for a single-window app like 3DCoster's desktop build, making it a sufficient session-persistence mechanism without a new secure-storage plugin | Standard Stack, Architecture Patterns (desktop auth diagram), Don't Hand-Roll | If wrong (e.g. platform-specific persistence gaps beyond the documented Linux multi-window caveat, which does not apply here), desktop Pro users would need to re-authenticate every app launch — an annoying but non-catastrophic failure mode, not a security regression. Verify with a real `tauri build` + relaunch test on at least macOS and Windows before committing to "no new plugin." |
| A2 | Including both `{{ .ConfirmationURL }}` and `{{ .Token }}` in the same Supabase "Magic Link" email template will reliably deliver a working OTP code alongside the working magic link | Common Pitfalls (Pitfall 2), Alternatives Considered | If wrong, D-08's "same Supabase email flow" premise breaks and the plan needs either a second template (via Supabase Auth Hooks, more complex) or a different code-delivery mechanism entirely. This is the single highest-uncertainty item in this phase's research — MUST be live-tested against the actual Supabase project before implementation relies on it. |
| A3 | A base64 data-URL string (not a `Blob`) is the right storage shape for the logo on `UserProfile`, given the existing settings-row JSON-serialization mechanism and `backupSchema.ts`'s flat-array/JSON contract | Architecture Patterns, Anti-Patterns | Low risk — verified directly against `src/db/database.ts` (userProfile stored as `JSON.stringify` under a `settings` row) and `backupSchema.ts` (already flattens everything to JSON-safe values). If wrong, would need a schema migration + Dexie version bump instead of a trivial additive field. |
| A4 | `browser-image-compression`'s registry version (2.0.2) reported by `npm view` — mentioned only as a rejected alternative, not a recommendation | Alternatives Considered | None — this package is explicitly NOT recommended for installation; the version number is informational only for the "why not" comparison. |
| A5 | Desktop scope for D-08 is "enable Pro auth/entitlement so the white-label PDF works," NOT necessarily "enable hosted-quote publishing (`ShareQuoteButton`) on desktop" — `ShareQuoteButton.tsx` currently has its own independent `if (__IS_TAURI__) return null` gate (D-12, Phase 43) that CONTEXT.md does not explicitly say to remove | Open Questions | If the planner assumes hosted-quote publishing also becomes available on desktop without confirming this, scope could silently balloon beyond the "days" estimate implied by the phase goal (which only mentions PDF + hosted-page BRANDING, not desktop PUBLISHING). Needs an explicit decision, not an assumption. |

**If this table is empty:** N/A — table is populated; several claims genuinely need confirmation before/during planning.

## Open Questions

1. **Does D-08 require `ShareQuoteButton` (hosted-quote publishing) to also work on desktop, or only sign-in + entitlement (so the locally-generated white-label PDF works)?**
   - What we know: `ShareQuoteButton.tsx` has its own independent `if (__IS_TAURI__) return null` gate dating to Phase 43's D-12 (web-first). CONTEXT.md's canonical refs flag "audit existing web-only gates from 43-03" but doesn't say which gates flip.
   - What's unclear: Whether a desktop Pro user should be able to click "Share quote" and get a hosted link, or whether that stays a web-only action even for a signed-in desktop Pro user (who could still open 3dcoster.com in a real browser to do it).
   - Recommendation: Default to the narrower scope (desktop gets auth + entitlement + white-label PDF only; `ShareQuoteButton` stays gated) unless the founder/context confirms otherwise — this matches the phase's stated goal text (PDF + hosted-page BRANDING, not desktop PUBLISHING) and keeps the "days" estimate plausible. Flag this explicitly for `/gsd-discuss-phase` follow-up or planner judgment if not already resolved.

2. **Will the dual-purpose email template (Pitfall 2) actually work, or does desktop OTP need its own delivery path?**
   - What we know: Supabase's official docs describe the single-purpose case (`{{ .Token }}` alone → OTP mode) clearly; the dual-variable case is community-reported and contested.
   - What's unclear: Whether this specific Supabase project's mail rendering handles both variables correctly — this is empirically testable but not yet tested.
   - Recommendation: Make "send a live test email with both variables and confirm `verifyOtp` succeeds" an early, gating task in the plan — not something deferred to a later verification pass, since it changes the whole desktop OTP UX if it doesn't work.

3. **Logo size/dimension caps** — left to Claude's discretion in CONTEXT.md; this research recommends (not locked): max upload 5MB before processing, client-side downscale to a ~480px bounding box, PNG output when source has an alpha channel else JPEG at ~0.85 quality, informational (non-blocking) warning if the final data URL still exceeds ~150KB. These numbers are a reasoned starting point, not externally sourced data — the planner/founder should treat them as adjustable defaults, not requirements.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `jspdf` | PDF logo embedding | ✓ | 4.2.1 | — |
| `@supabase/supabase-js` | Desktop OTP auth | ✓ | 2.110.8 | — |
| Browser Canvas API / `createImageBitmap` | Logo resize | ✓ (native, all supported browsers + Tauri WebViews) | — | — |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in desktop CI build | Desktop Supabase client construction | ✗ | — | **No fallback — this is a required infrastructure change** (Pitfall 3); without it, desktop OTP sign-in silently stays unavailable |
| `*.supabase.co` in Tauri CSP `connect-src` | Desktop Supabase network calls | ✗ | — | **No fallback — required infrastructure change** (Pitfall 3) |

**Missing dependencies with no fallback:**
- Desktop build env vars for Supabase (release.yml)
- Tauri CSP `connect-src` addition for `*.supabase.co` (tauri.conf.json)

**Missing dependencies with fallback:**
- None — the two gaps above are both hard blockers for D-08, not softly-degradable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (unit/integration) + Playwright (E2E, `playwright.config.ts`) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `npm run test -- src/pdf/generateQuotePdf.test.ts` (or the relevant single file) |
| Full suite command | `npm run test` (vitest run) + `npx playwright test` for E2E |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-05 | Free-tier PDF keeps footer; Pro PDF drops it | unit | `npm run test -- src/pdf/generateQuotePdf.test.ts` | ✅ (extend existing file) |
| D-04 | Logo + name render together on PDF header | unit | `npm run test -- src/pdf/generateQuotePdf.test.ts` | ✅ (extend existing file) |
| D-09 | Hosted page keeps powered-by until a logo is set | unit/integration | new test file needed | ❌ Wave 0 — `api/q/[token].ts` has NO existing test file at all (only `api/webhooks/paddle.test.ts` exists under `api/`) |
| D-11 | Logo bakes into frozen snapshot at publish time | unit | `npm run test -- src/hooks/usePublishedQuote.test.ts` | ✅ (extend existing file) |
| D-08 | Desktop OTP sign-in flow (code entry → session) | unit + manual | `npm run test -- src/hooks/useProAuth.test.ts` for the `verifyOtp` call shape; the actual live-email round-trip (Pitfall 2) is **manual-only** — no automated test can send/read a real email | ✅ hook test exists; manual step required regardless |
| D-13 | Free users see Pro-chipped Branding section, opens pitch modal | unit | new test file for the Branding section component | ❌ Wave 0 — component doesn't exist yet |
| Free-floor guarantee | Signed-out desktop free user still makes zero unnecessary Supabase network calls | E2E | Extend `e2e/free-floor-no-network.spec.ts` pattern, OR a desktop-specific equivalent if Playwright can't drive the Tauri WebView (verify at plan time) | ⚠️ Existing spec covers WEB only; desktop has no equivalent automated guard today |

### Sampling Rate
- **Per task commit:** targeted `npm run test -- <changed test file>`
- **Per wave merge:** `npm run test` (full vitest suite)
- **Phase gate:** Full suite green + `npx playwright test` (at least the free-floor and consent-gate specs) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `api/q/[token].test.ts` — does not exist today; needed to cover D-09/D-11/D-12 hosted-page branding logic without relying on manual browser checks
- [ ] New component test file for the Branding section (D-03/D-13)
- [ ] Confirm whether Playwright can meaningfully exercise the Tauri desktop WebView for an automated free-floor-style guard, or whether that verification stays manual for this phase (worth deciding explicitly rather than silently skipping)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth (`signInWithOtp`/`verifyOtp`) — unchanged auth mechanism, new call added to the SAME provider already in use; no new auth system |
| V3 Session Management | Yes | Desktop: Tauri WebView `localStorage` persistence, mirroring the web build's accepted T-43-09 disposition (see Assumption A1) |
| V4 Access Control | Yes | `isProStatus`/RLS-scoped `entitlements` read — unchanged, only new call sites (desktop) using the existing gate |
| V5 Input Validation | Yes | Logo file validation (format via `createImageBitmap` decode success, not extension/MIME-string trust) + **strict data-URL prefix allowlist** before the logo string is ever interpolated into hosted-page HTML (Pitfall 4) |
| V6 Cryptography | No | No new cryptographic operations — Supabase and the browser handle all relevant crypto (TLS, OTP token generation) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored/reflected XSS via `data:` URL in an HTML `src` attribute (`api/q/[token].ts` string-interpolates HTML) | Tampering / Elevation of Privilege | Strict regex allowlist on the `logoDataUrl` value (`^data:image\/(png\|jpeg\|webp);base64,[A-Za-z0-9+/]+=*$`) applied BOTH at publish-write time (client) and render time (server), rejecting/omitting on any mismatch — same discipline the project's own `escapeHtml()` already applies to text fields, extended to this attribute-value + scheme case |
| Malformed/oversized image causing memory exhaustion during client-side processing | Denial of Service (local, client-side only) | Enforce the upload size cap BEFORE calling `createImageBitmap`/canvas processing (Open Question 3's recommended 5MB pre-cap) |
| Desktop CSP misconfiguration exposing broader network access than intended | Information Disclosure | Scope the new `connect-src` addition to `https://*.supabase.co` exactly (mirrors the existing web `vercel.json` wildcard scoping rationale already documented in `docs/DATA-FLOW-INVENTORY.md`) — do not add a broader wildcard |
| Logo data increasing the hosted quote page's response payload size (already `Cache-Control: no-store`, so no NEW CDN-cache PII exposure, but does increase per-request bytes served) | (Not a STRIDE security threat — a performance/cost note) | Keep the compressed logo small (Open Question 3's ~150KB soft cap) so `api/q/[token].ts` responses stay fast on every view (already uncached by design) |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `src/pdf/generateQuotePdf.ts` — current header/footer/render pipeline
- `api/q/[token].ts` — current hosted-page renderer, `HostedSnapshot` type, footer logic
- `src/hooks/usePublishedQuote.ts` — publish snapshot assembly, entitlement gate call site
- `src/hooks/useEntitlement.ts` — `isProStatus` vocabulary
- `src/hooks/useProAuth.ts`, `src/components/pro/SignInModal.tsx`, `src/lib/supabaseClient.ts` — current auth flow, the `__IS_TAURI__` gate
- `src/components/pro/ProPitchModal.tsx`, `src/components/pro/ShareQuoteButton.tsx` — Pro-chip/pitch-modal pattern to mirror
- `src/types.ts` (`UserProfile`, `Quote`), `src/utils/backupSchema.ts` — storage/backup contract
- `src/roadmap.ts`, `src/pages/FeaturesPage.tsx` (ComingCell, lines ~483-497) — marketing flip targets
- `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `.github/workflows/release.yml` — desktop build/CSP/CI gaps (Pitfall 3)
- `docs/DATA-FLOW-INVENTORY.md`, `docs/PRO-SECURITY-REVIEW.md` — prior security/privacy posture to not regress
- `package.json` (`npm view jspdf version` → 4.2.1, `npm view @supabase/supabase-js version` → 2.110.8) [VERIFIED: npm registry]

### Secondary (MEDIUM confidence — WebSearch, cross-referenced with official docs where possible)
- [jsPDF addImage documentation](https://rawgit.com/MrRio/jsPDF/master/docs/module-addImage.html) [CITED]
- [jsPDF GitHub issue #1899 — "UNKNOWN" file type bug](https://github.com/parallax/jsPDF/issues/1899) [CITED]
- [Supabase docs: Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) [CITED]
- [Supabase docs: JavaScript verifyOtp reference](https://supabase.com/docs/reference/javascript/auth-verifyotp) [CITED]
- [Tauri v2 Store plugin docs](https://v2.tauri.app/plugin/store/) [CITED]
- [Tauri v2 Stronghold plugin docs](https://v2.tauri.app/plugin/stronghold/) [CITED]

### Tertiary (LOW confidence — community discussion, WebSearch only, flagged for validation)
- GitHub Discussion on Supabase magic-link + OTP token in the same email template [ASSUMED/contested — see Pitfall 2, requires live verification]
- `browser-image-compression` npm package details (rejected alternative only) [ASSUMED]
- `tauri-plugin-keyring` (two competing community forks) maintenance status [ASSUMED — not recommended for use]
- Tauri WebView localStorage cross-restart persistence behavior (Assumption A1) [ASSUMED — recommend a real local verification pass before relying on it for the plan]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every recommended piece is either already installed and verified via `npm view`, or a native browser/WebView API requiring no installation
- Architecture: HIGH for the PDF/hosted-page/publish-snapshot extension points (directly read from source); MEDIUM for the desktop-auth infrastructure gaps (verified as gaps, but the exact remediation — env var wiring, CSP entry — is straightforward and low-risk once identified)
- Pitfalls: MEDIUM — Pitfalls 1, 3, 4, 5 are codebase-verified or well-documented; Pitfall 2 (the shared email template) is the one genuinely open technical risk in this phase and needs live verification, not just research

**Research date:** 2026-07-22
**Valid until:** 30 days (stable stack, no fast-moving dependencies; re-verify the Supabase email-template behavior and Tauri WebView persistence claims empirically at plan/implementation time regardless of this window, since both are marked [ASSUMED]/contested)
