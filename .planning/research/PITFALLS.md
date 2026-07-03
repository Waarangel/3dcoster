# Domain Pitfalls — v2.0 Cost-Truth & Insight

**Domain:** Adding a first backend, GDPR legal layer, STL-volume instant quotes, God-component refactor, file-based sync, onboarding wizard, tab-URL routing, and 11 cost/insight features to a shipped local-first React + Dexie/IndexedDB + Tauri app with a free-forever promise and EU user base.
**Researched:** 2026-07-03
**Confidence:** HIGH for pitfalls grounded in project history (PERF-11 regression, marketplace-fee FX bug, versionchange crash, seedState data-loss); MEDIUM for backend/GDPR/STL-volume findings (verified against official sources + enforcement records).

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, pricing errors visible to customers, regulatory fines, or breaking the free-forever promise.

---

### Pitfall C-01: Free Floor Accidentally Requires an Account

**What goes wrong:**
The moment a backend is wired in, it is tempting to gate every Pro feature behind a login wall and then quietly let the login state leak into free features. The specific risk for 3DCoster: if the hosted quote-page check, the instant-quote share link, or the file-based sync is architected so that anonymous users get a degraded silent failure instead of a graceful local-only experience, existing free users effectively lose features they already have. This is the single fastest way to destroy the trust the free-forever promise has built.

**Why it happens:**
Auth middleware added at the router level gates all routes, not just Pro ones. Supabase RLS policies written for authenticated users don't have a corresponding anon-user path. The sync flow calls a backend endpoint on startup without checking whether the user is logged in first.

**How to avoid:**
Treat "unauthenticated" as a first-class, fully-functional state. Every feature must be designed with two flows: local-only (no backend call) and authenticated (backend call). The backend call should be additive, never a prerequisite. Specifically: the instant-quote share link has a free-floor path (in-browser-only, no hosted page) and a Pro path (hosted with custom domain). The two must be branching code paths, not the same code path with the non-Pro branch returning an error.

**Warning signs:**
- Any call to a backend API endpoint occurs before checking `userIsLoggedIn`
- A free-tier user sees a "Login required" error on a feature that existed in v1.9
- The `supabase.auth.getUser()` result is awaited in the main app render path before the calculator loads

**Phase to address:** Backend foundation phase — the auth architecture must define anonymous vs. authenticated flows before any feature is built on top of it.

---

### Pitfall C-02: Data-Model Drift Between Dexie and Postgres

**What goes wrong:**
The local Dexie schema evolves via numbered migrations that run per-device. The Postgres schema evolves via SQL migrations run centrally. When a new field is added (e.g., `failureCostEngine.perPrinterRates`), it gets a Dexie migration on the client and a Postgres migration on the server — but they are not coordinated. A user who syncs after being offline for 2 weeks may push data that has a client schema newer than the server expects, or pull data that has a server schema newer than their client. The sync engine silently drops unknown fields or throws a 400.

**Why it happens:**
Local-first developers think of local and remote schemas as one thing. They are not. Dexie migrations run lazily on first open; Postgres migrations run eagerly on deploy. The two are never in lock-step for a user who is offline during a server deploy.

**How to avoid:**
Schema versioning must be explicit in the sync protocol. The sync payload should carry `clientSchemaVersion`. The server must reject syncs from clients whose schema version is below the server's minimum supported version and return a clear error with an upgrade prompt — not a silent data drop. During development, maintain a canonical `SCHEMA_CHANGELOG.md` that tracks Dexie version → Postgres migration → sync protocol version as a triple. Never advance one without advancing all three in the same PR.

**Warning signs:**
- A field added in a Dexie migration has no corresponding Postgres column added in the same PR
- The sync payload format has no version field
- Integration tests only test the happy path with matching client and server schema versions

**Phase to address:** Backend foundation phase — before any sync is built.

---

### Pitfall C-03: PERF-11 Repeating — Pricing State Desync During God-Component Split

**What goes wrong:**
This already happened in v1.9. PERF-11 (trimming `useEffect` deps to `[trueCost, lastEdited]`) passed all 744 Vitest tests but desynced profit/margin on consecutive same-field edits. The fix was to revert rather than repair because the correct fix requires the full CostCalculator split. The v2.0 split of the ~1500-line CostCalculator into sub-components re-opens exactly this failure mode, but at larger scale: hoisting state into a context or splitting effects across component boundaries will create new stale-closure and stale-ref opportunities that contract tests cannot detect.

The failure mode: a `useEffect` that recomputes derived pricing state (sellingPrice, margin, profit) fires with a stale snapshot of one of its inputs because the dep array was manually curated to avoid excessive re-renders. The component renders correct-looking values in isolation (tests pass) but stale values when two fields change in rapid succession.

**Why it happens:**
Source-contract tests assert input → output on individual functions. They cannot detect that the React rendering cycle has read a stale closure of `trueCost` from two renders ago. Only read-the-code review and human UAT on consecutive keystrokes catch this.

**How to avoid:**
1. Write output-equivalence tests before splitting: for N representative inputs, assert that `[trueCost, sellingPrice, profit, margin, breakEven]` from the split component match the pre-split component byte-for-byte. Run these on every PR touching pricing state.
2. Use `useReducer` instead of multiple `useState` + `useEffect` chains for pricing state. A reducer is a pure function; the transition is synchronous and not subject to stale-closure issues.
3. Enforce `react-hooks/exhaustive-deps` at error level (not warn) for any `useEffect` that reads pricing state — the ESLint rule catches what code review misses.
4. Do the split in phases: extract UI rendering first (pure presentational components with no state), then hoist state into a single context/reducer, then add the new pricing features (PERF-11 done right) on top of the clean architecture.

**Warning signs:**
- Any `// eslint-disable-next-line react-hooks/exhaustive-deps` in pricing effects added during the split
- A dep array that omits a value read inside the effect (even if it "feels" stable)
- Human UAT that skips the "type two fields rapidly" interaction

**Phase to address:** CostCalculator God-component split phase. This is the highest-risk code change in the entire milestone.

---

### Pitfall C-04: Consent Banner That Is Itself Non-Compliant

**What goes wrong:**
Adding a GDPR consent banner to satisfy regulators while making the banner itself non-compliant is the most common mistake. Concrete violations with real fines attached:

- **Reject-all parity failure (most common):** Accept button is primary/filled; Reject is a plain text link or requires navigating to a settings sub-page. France's CNIL fined Google €150 million (Sept 2025) and €200 million (again Sept 2025) specifically for this. Honda was fined $632,500 for a two-click reject vs one-click accept.
- **Pre-ticked boxes:** The CJEU ruled definitively that pre-checked consent checkboxes are invalid. Vercel Analytics loaded without explicit consent would be a violation for EU users.
- **Consent wall:** Blocking access to the calculator until the user accepts. This violates "freely given" consent.
- **Dark pattern contrast:** Accept button is high-contrast; Reject is low-contrast or grey. Visually asymmetric buttons are now explicitly documented as a violation.

For 3DCoster specifically: Vercel Analytics is not GDPR-compliant by default. It requires IP anonymization configured, a Data Processing Agreement with Vercel, and explicit consent from EU users before the analytics script fires.

**Why it happens:**
Developers copy a template banner that has an "Accept All" button and a "Settings" link, thinking that surfaces a reject path. The Settings sub-page that requires three more clicks to reject is non-compliant even if a reject path technically exists.

**How to avoid:**
The banner must have:
- "Accept All" and "Reject All" at identical visual weight on the first layer (same button style, same size, same position level)
- Rejecting must take exactly one click — the same as accepting
- No non-essential scripts (analytics, third-party embeds) fire until explicit consent is received
- Consent is stored and sent as a signal to the analytics provider; re-shown if consent expires or user clears data
- Granular categories (strictly necessary / analytics / marketing) — even if only one non-essential category exists today, the infrastructure needs to support adding more

**Warning signs:**
- Vercel Analytics fires page-view events before the user has clicked Accept
- The banner has "Accept All" and "Manage Cookies" but no direct "Reject All" on the first layer
- Console shows analytics network requests on first page load before any user interaction

**Phase to address:** GDPR/legal foundation phase — must be complete before any backend that processes EU user data goes live. Do not deploy the backend without the banner.

---

### Pitfall C-05: Privacy Policy That Doesn't Match Actual Processing

**What goes wrong:**
Writing a privacy policy from a template, then adding Vercel Analytics, a Supabase backend, and a hosted quote page without updating the policy to reflect what is actually collected. GDPR's accountability principle requires the organisation to demonstrate compliance, not merely declare it. Research shows 46% of apps have inconsistency between policy declarations and actual data collection behaviour.

For 3DCoster's specific v2.0 data flows:
- Vercel Analytics: IP-derived location, device info, referrer (requires disclosure)
- Supabase: email/auth token for Pro users (requires disclosure of retention, deletion rights, subprocessors)
- Hosted quote pages: customer name, email, address, price — these are third-party personal data for GDPR purposes. The seller is the data controller; 3DCoster (as the platform) is the data processor. This relationship requires a Data Processing Agreement between 3DCoster and its Pro users.
- File-based sync (Dropbox/Drive integration): if 3DCoster writes to a user's Drive account, the data may transit Google/Dropbox infrastructure — requires disclosure

**Why it happens:**
Legal pages are written once at launch and never revisited as features ship.

**How to avoid:**
Maintain a "Data Flow Inventory" (a simple table: what data, who collects it, where it goes, how long it's retained, legal basis). Update it as a PR checklist item every time a new data flow is added. The privacy policy is generated from the inventory, not written independently.

**Warning signs:**
- A new API endpoint collects data that is not listed in the privacy policy
- The privacy policy says "we do not use third-party analytics" while Vercel Analytics is active
- The hosted quote page stores customer PII in Supabase with no mention in the policy

**Phase to address:** GDPR/legal foundation phase.

---

### Pitfall C-06: Hosted Quote Page Leaks Customer PII via Predictable URLs

**What goes wrong:**
A hosted quote page at `3dcoster.com/q/12345` where `12345` is a sequential integer, a short hash, or a UUID predictable from context leaks customer names, addresses, email addresses, and quote amounts to anyone who guesses or enumerates the URL. Quote pages contain customer PII (name, email, delivery address) and financial data (itemized costs, total price). A leaked URL is a GDPR data breach.

**Why it happens:**
Sequential IDs are the default in most database primary key schemes. Developers think "it's just a number, no one will guess it." At 1000 active Pro users each generating 10 quotes, the space is 10,000 IDs — trivially enumerable.

**How to avoid:**
- Quote share links must use cryptographically random tokens of at least 128 bits (UUID v4 or equivalent, never sequential). The token is the only key — no sequential ID should appear in the URL.
- Quote pages must not be indexed by search engines (`X-Robots-Tag: noindex` or `<meta name="robots" content="noindex">`).
- Consider quote expiry: hosted quote pages should expire after 30 days (configurable by the seller) and return 404 after expiry.
- The hosted page must not cache in Vercel's CDN without a `Vary: Cookie` or token-based cache key, or any customer's quote could be served to another user from the edge cache.

**Warning signs:**
- Quote URL contains a number that increments by 1 between quotes
- `curl -I https://3dcoster.com/q/[id]` returns `X-Robots-Tag: index`
- The Supabase RLS policy for the `quotes` table allows SELECT without token authentication

**Phase to address:** Instant-quote share link phase (Pro backend).

---

### Pitfall C-07: STL Volume Estimation Producing Wildly Wrong Instant Quotes

**What goes wrong:**
The in-browser STL volume estimate is the foundation of the instant-quote free floor. It will produce meaningless numbers — and undercut makers' actual prices — in three common situations:

1. **Non-manifold / non-watertight meshes:** The signed-tetrahedron volume method (the correct algorithm, same math slicers use) requires a closed, manifold mesh. Meshes with holes, duplicate vertices, inverted normals, or self-intersections return garbage volume. Community STL files from Thingiverse/Printables frequently have these defects.

2. **Units ambiguity:** STL files have no embedded unit declaration. A file modelled in inches produces a volume 16.4× larger than the same model in mm. Most common CAD tools export in mm; some (Fusion 360 by default, older SolidWorks exports) output in inches. A 1-inch cube appears as a 16,387 mm³ cube, producing a filament-weight estimate 16× too high and a quote 10–20× too expensive.

3. **Infill assumption:** Volume calculators return solid volume. A real print at 15% infill uses ~0.15× the solid volume in filament. If the instant quote uses solid volume as the filament proxy without applying the infill factor, the estimated filament weight is 5–7× too high. A user quoting a vase at 15% infill would be quoted the price of a solid brick of plastic.

The consequence is not just inaccuracy — it is undercutting. A maker who uses the instant quote to set their price and gets a 2× overestimate charges less than they need to. A maker who gets a 5× underestimate (from a tiny manifold-broken mesh) prices below cost.

**Why it happens:**
The volume library returns a number; the developer treats that number as the filament proxy without validation or disclaimers.

**How to avoid:**
- Use Three.js `STLLoader` + the signed-tetrahedron volume summation on the buffer geometry. After loading, check `geometry.boundingBox` — if any dimension is implausibly large (> 500 mm for consumer printing) or implausibly small (< 0.1 mm), warn that the unit assumption may be wrong and ask the user to confirm mm vs. inches.
- Add a mesh integrity check: compute the ratio of vertices to faces. If the ratio is far outside the range for a manifold mesh, surface a warning: "This file may have mesh errors. Volume estimate may be inaccurate."
- Expose an "infill %" input on the instant quote flow. The volume estimate is `solidVolume × (infill/100)` for infill calculation and `solidVolume × shellFraction` for perimeters — but for the MVP, just multiply by the user's chosen infill.
- Never present the instant quote as a final price. Label it explicitly as an estimate with ±accuracy band. The user's saved G-code-based cost calculation remains the source of truth.

**Warning signs:**
- A test STL known to weigh 15g of PLA is estimated at 2.5g or 120g
- No unit-detection or warning logic in the STL parsing code
- The infill % input is absent and solid volume is used directly as filament proxy

**Phase to address:** Instant-quote share link phase. Must be resolved before the free-floor path ships.

---

### Pitfall C-08: File-Based Sync Data Corruption and Multi-Tab Races

**What goes wrong:**
File-based sync (Dropbox/Google Drive) works by exporting the full Dexie database to a JSON file and importing it on another device. The failure modes are:

1. **Partial write + sync:** Dropbox/Drive syncs while the write is in progress. The remote file is a truncated JSON. The second device imports a broken file, destroying data.
2. **Multi-tab write race:** Two browser tabs are open on the same machine. Tab A exports and writes. Tab B (unaware of Tab A's write) also exports and writes 3 seconds later. Tab B's export snapshot pre-dates Tab A's last save; the Tab B file wins on the next sync and rolls back Tab A's changes.
3. **Dexie `versionchange` during import:** If the user imports a file generated by a different schema version (e.g., they exported from v1.9, then imported into v2.0), missing fields are silently dropped. The app loads but data is incomplete. This is a forward-migration problem: the import must run the same Dexie upgrade logic as a regular version bump.
4. **IndexedDB storage limit:** Safari limits IndexedDB to 1 GB per origin. At scale (many jobs with G-code attachments), users may hit the quota without warning. The JSON export of a large database becomes multi-MB; Dropbox/Drive sync of multi-MB files on mobile is slow and expensive.

This project already experienced the versionchange crash (fixed in v1.2 with `db.on('versionchange', reload)`). File-based sync re-opens a version of the same problem via import.

**Why it happens:**
File-based sync looks simple: just JSON export/import. The edge cases are invisible until a user loses data.

**How to avoid:**
- Write atomically: generate the full JSON in memory, then write as a single operation. Never stream-write to a cloud file. Prefer writing to a temp file and atomically renaming it.
- Include a schema version in the export JSON. On import, check that the schema version matches the current Dexie version. If it doesn't, run a migration pass on the imported data before writing to IndexedDB.
- Lock multi-tab writes: before export, acquire a BroadcastChannel lock signal. Other tabs must observe the lock and queue their exports.
- Add a conflict detection checksum: the export file includes a hash of the previous export's content. On import, if the hash doesn't match the local state's hash, surface a "Conflict detected — which version to keep?" UI rather than silently overwriting.
- Never auto-import without user confirmation if a conflict is detected.

**Warning signs:**
- The export/import format has no schema version field
- The import function does not check schema version before writing
- Two-tab export test (open two tabs, save in both, export in both) produces two files with the same content rather than the last-one-wins or a conflict warning

**Phase to address:** File-based sync phase. If the conflict detection complexity is underestimated, this phase needs its own research spike before planning.

---

## Moderate Pitfalls

Mistakes that cause user confusion, bad data, or compliance gaps without rising to the level of data loss or fines.

---

### Pitfall M-01: Onboarding Wizard That Blocks Returning Users

**What goes wrong:**
A first-run onboarding wizard that fires on every cold start (e.g., after clearing localStorage, after a PWA reinstall) forces a returning user who already has 50 saved jobs to sit through "Welcome to 3DCoster — let's set up your first printer." Worse: if the wizard writes to the same Dexie stores that the import flow uses (e.g., seeding a default printer), it can overwrite a returning user's existing data if the "returning user" check fails.

The returning-user check failing is more likely than it sounds. The `isFirstRun` flag lives in `localStorage`. A user who clears browser storage (common in EU privacy-conscious users), uses a private/incognito window, or reinstalls the PWA loses the flag. The wizard fires again. If the wizard then seeds a "Bambu X1C" default printer because no printers exist in IndexedDB (also cleared), that is correct. But if IndexedDB was not cleared (separate storage from localStorage), the wizard seeds a duplicate printer.

**Why it happens:**
The first-run flag is stored separately from the actual data, so the two can get out of sync.

**How to avoid:**
- Store the "has completed onboarding" flag in Dexie (on the `UserProfile` row), not in localStorage. localStorage is cleared independently of IndexedDB. IndexedDB is the source of truth for user state.
- The wizard entry check: `await db.userProfile.get(1)` → if `userProfile.onboardingCompleted === true`, skip wizard entirely.
- The wizard must have a "Skip — I know what I'm doing" path on every step that dismisses without writing anything.
- Wizard steps that write data (e.g., "Add your first printer") must check whether that data already exists before writing.

**Warning signs:**
- The onboarding skip button is absent or hidden
- `isFirstRun` is stored in `localStorage` instead of Dexie
- The wizard writes a default printer without checking `db.printers.count() === 0` first

**Phase to address:** Guided first-run onboarding phase.

---

### Pitfall M-02: Tab-in-URL Routing Breaking PWA start_url and Back Navigation

**What goes wrong:**
Adding URL-based tab routing (e.g., `/app/calculator`, `/app/jobs`, `/app/reports`) changes the app's URL structure. This breaks three things:

1. **PWA `start_url`:** The PWA manifest has `"start_url": "/"`. Users who installed the PWA before v2.0 now have a bookmark/home screen icon that opens `/`, which redirects to `/app/calculator`. Users who had the calculator mid-job open at `/app` will find their Back button navigates to `/` (outside the app) instead of doing nothing or staying in-app.
2. **Service worker navigation fallback:** The service worker's fetch handler currently intercepts all navigation requests and serves `index.html` (SPA fallback). When URLs change to include `/app/calculator`, the service worker must be updated to also match the new routes, or users on cached old service workers will see 404 on hard reload.
3. **Tauri deep links:** Tauri desktop uses `tauri://localhost/app` as the base URL. Deep-linking to `/app/jobs` works in the browser but may not work in Tauri without configuring `tauri.conf.json` `allowlist.http.allowedUrls` or the v2 security policy. A blank screen in Tauri on a tab link is a silent failure.

**Why it happens:**
URL routing in SPAs looks like a pure frontend concern. It is not — it touches the service worker, the PWA manifest, the Tauri security config, and any bookmarks/home screen icons that existing users have.

**How to avoid:**
- Update `start_url` in the manifest to the new canonical entry point (e.g., `/app`).
- Add all new route patterns to the service worker's `precacheAndRoute` or navigation fallback list.
- Test all routes in Tauri with `tauri dev` before shipping. Specifically test that `history.pushState` to a new route does not produce a blank screen.
- Keep a backward-compat redirect: `/` → `/app` so existing PWA installs still work.
- Use `@tauri-apps/plugin-window-state` or equivalent to restore the last active tab on desktop restart rather than always opening to the default tab.

**Warning signs:**
- No update to `manifest.webmanifest` start_url when routes change
- Hard reload at `/app/jobs` returns 404 rather than the SPA
- Tauri desktop shows blank screen when navigating to a non-root route

**Phase to address:** Tab-in-URL routing foundation phase — this must be completed before any feature is built on the new URL structure.

---

### Pitfall M-03: Backend Cost Blowup at Solo Scale

**What goes wrong:**
Supabase free tier caps at 500 MB database. Two hundred Pro users each with 500 jobs and 10 customer records comfortably fits inside 500 MB. But hosted quote pages, if they cache STL files or quote PDFs in Supabase Storage, can exhaust the storage budget rapidly. The Supabase Pro plan at $25/month adds 8 GB storage — but without a spend cap, realtime channels and database connections can add up. Railway's per-resource billing (CPU, RAM, bandwidth, storage) has no fixed ceiling.

Separately: a bug in a background job (e.g., a failed sync retry loop) can issue thousands of Supabase reads per minute, consuming the free tier's 500 MB data cap in minutes.

**Why it happens:**
Solo founders focus on feature development, not cost instrumentation. The first spike arrives as a surprise invoice.

**How to avoid:**
- Enable Supabase's spend cap by default. Set a hard budget alert at $50/month.
- Do not store STL files or PDF binaries in Supabase Storage for the MVP. Store only quote metadata (JSON). The STL stays local; the hosted quote page renders from the stored metadata + the client's in-browser STL.
- Instrument every backend function with a rate limit. Sync calls from a single user must be rate-limited to prevent retry storms.
- Set up Vercel and Supabase billing alerts at 50% and 90% of budget before launch.

**Warning signs:**
- No spend cap set in Supabase dashboard
- No rate limiting on sync or quote creation endpoints
- Supabase Storage is used to store binary files rather than metadata-only JSON

**Phase to address:** Backend foundation phase.

---

### Pitfall M-04: Failure-Cost Engine Changing Every Displayed Price

**What goes wrong:**
Folding failure cost into `trueCost` as a new cost component (rather than the current failure-rate multiplier approach) will change every displayed price for every existing saved job. A user who saved a job at $18.50 opens it after the v2.0 update and sees $21.00. They don't know why. If the change is not communicated and not opt-in (or at least explained), users will assume the app has a bug and their existing pricing is wrong — or worse, they will re-quote existing customers at the new higher price.

This project already has the pattern: the marketplace-fee FX correction in v1.9 changed displayed margins. The lesson was that derived-field changes must ship with a one-time reconcile helper and a visible explanation.

**Why it happens:**
Cost-model improvements are treated as bug fixes (transparent to the user) rather than as pricing-model changes (visible to the user).

**How to avoid:**
- Treat any change that alters a displayed price on a saved job as a schema migration requiring a reconcile helper and a changelog entry.
- For the failure-cost engine specifically: add a `failureCostModelVersion` field to `UserProfile`. When the engine changes from multiplier to additive cost, bump the version and show a one-time banner: "Your cost calculations have been updated to include per-printer failure cost data. Previously saved jobs may show different prices."
- The banner must link to a Help article explaining the change.
- Provide a "use previous model" toggle in Settings for at least one release cycle to let users compare.

**Warning signs:**
- A cost model change has no corresponding Dexie migration or reconcile helper
- No changelog entry for the pricing change
- No UI indication to the user that their saved job prices may have changed

**Phase to address:** Failure-cost engine phase.

---

### Pitfall M-05: Scope Collapse — Backend Blocks Everything

**What goes wrong:**
The v2.0 milestone bundles a God-component refactor, 11 new features, a first backend, a GDPR legal layer, a marketing redesign, and an onboarding wizard in one release. The natural sequencing trap is to start with the backend (because several features depend on it) and then find that the backend takes 3× longer than estimated. Everything that depends on the backend (hosted quote pages, Pro tier, instant-quote link, file sync) blocks. The 11 features that do not require a backend (failure-cost engine, time-of-use electricity, true hourly wage, what-if simulator, spool lifecycle, tax threshold tracker) also stall because the team is firefighting the backend.

A second form of scope collapse: the CostCalculator split and PERF-11 (done right) is a prerequisite for the new pricing features (failure cost folded in, time-of-use modelling). If the split is the first phase and it takes longer than expected, every feature that touches the calculator is blocked.

**Why it happens:**
The milestone is sequenced foundation → insight features → backend crescendo, which is correct. But the foundation (split + routing) is underestimated because it looks like "just refactoring" but is actually the highest-risk change in the codebase.

**How to avoid:**
- Set time-boxes on foundation phases. If the CostCalculator split is not complete in 3 phases, ship what is done as Phase A and continue in Phase B, rather than blocking all insight features.
- The backend is the crescendo — it does not need to be complete for any free-floor feature to ship. The instant-quote share link free floor is entirely in-browser (no backend). The failure-cost engine is local. The true hourly wage is local. These can ship on their own without waiting for backend.
- Design every free-floor feature to work in isolation first, then add the Pro hosted layer on top. This enables incremental shipping even if the backend is delayed.
- Define a "shippable MVP within the milestone" that excludes the backend but includes at least 5 of the 11 insight features. This is the fallback plan if scope threatens the milestone.

**Warning signs:**
- The first phase is "backend foundation" and every other phase is blocked on it
- Week 3 of the milestone and the backend is still not deployed
- Free-floor features like failure-cost engine are blocked on Pro backend being ready

**Phase to address:** Roadmap sequencing — this is a planning pitfall, not a code pitfall.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single auth check at the top of the backend router | Simpler code | All routes require login — free features break for unauthenticated users | Never for this project |
| Storing `isFirstRun` in localStorage | Simple | Out-of-sync with IndexedDB; wizard fires on storage clear | Never — use Dexie |
| Sequential IDs for share link URLs | Easy to debug | Enumerable — GDPR breach risk | Never for PII-bearing pages |
| Vercel Analytics without consent | Zero setup | GDPR violation for EU users | Never when EU users are present |
| Solid volume as filament proxy in STL quotes | Simple formula | 3–7× overestimate without infill factor | Never — multiply by infill always |
| Privacy policy written once, never updated | Fast to ship | Policy diverges from actual processing — accountability violation | Never |
| `useEffect` dep-array manual curation in pricing effects | Fewer re-renders | Stale closures = silent pricing regression (PERF-11 already proved this) | Never in pricing effects |
| Schema migration for Dexie without matching Postgres migration | One less file | Data model drift during sync | Never — migrate both in same PR |

---

## Integration Gotchas

Common mistakes when connecting to external services or new subsystems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth | Requiring auth for free-floor features | Auth is additive — all free features have a no-auth code path |
| Supabase RLS | Writing policies only for authenticated roles | Also write explicit `anon` role policies; test with `supabase.auth.signOut()` |
| Vercel Analytics | Loading before consent | Gate analytics initialization behind consent callback; use Vercel's `va.track()` API only post-consent |
| Dropbox/Drive sync | Writing directly to cloud file | Write to a temp local file first; atomic rename; include schema version in export |
| STL parsing (Three.js) | Trusting `BufferGeometry.volume()` without validation | Check for non-manifold indicators; warn on implausible bounding box dimensions |
| Dexie import from JSON file | No schema version check | Read `schemaVersion` from JSON; run migration logic before writing to IndexedDB |
| Hosted quote pages | Using CDN caching with user-specific PII | Set `Cache-Control: private, no-store` on quote page responses; never cache PII at edge |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full Dexie DB into memory for sync export | Fast for 50 jobs; slow for 5000 | Stream export by table; paginate if > 1000 rows per table | ~500+ jobs on low-memory device |
| Supabase realtime on every row change | Works in dev with 2 users | Each active connection costs; realtime is push-based but connections are not free | > 50 concurrent Pro users |
| STL file parsed synchronously in the UI thread | Small STL < 5 MB fine | Large STL (> 20 MB, complex geometry) freezes UI for 2–5s | STL > 10 MB |
| `db.liveQuery()` subscription on the full jobs table in the reporting component | Fine at 50 jobs | At 5000 jobs, the subscription re-fires the entire aggregate on every job change | > 500 jobs in the reports date range |
| No spend cap on Supabase | Works until it doesn't | Set spend cap on day 1; set billing alert at 50% | First unexpected traffic spike |

---

## Security Mistakes

Domain-specific security issues for this project.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Share link token derived from job ID (not random) | Enumerable URLs — customer PII exposed | UUID v4 token, cryptographically random, stored separately from job ID |
| Quote page served without `noindex` | Search engine indexes customer PII | `X-Robots-Tag: noindex` on all `/q/*` routes |
| Supabase service key used client-side | Full DB access from browser | Only use `supabase.anon` key client-side; service key server-side only |
| STL file parsed without size/complexity limits | Zip-bomb / memory exhaustion via large STL | Reject STL files > 50 MB; abort parsing if triangle count > 5M; already have 3MF guards — extend to STL |
| Dexie export includes auth tokens or API keys stored by mistake | Credentials in sync file | Never store secrets in Dexie; audit export output before shipping sync feature |
| Backend endpoint accepts sync payloads without schema validation | Malformed data corrupts server DB | Validate every sync payload against a JSON Schema before writing to Postgres |

---

## UX Pitfalls

Common user experience mistakes for this specific domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Instant-quote result presented without accuracy caveats | User sets price too low (volume error) or too high (infill error); loses sales or money | Always show "Estimated ±X%" and link to G-code-based calculation for final pricing |
| Failure-cost model changes prices with no explanation | User thinks the app is broken; re-quotes customers at wrong price | One-time migration banner explaining the change; link to help article |
| Onboarding wizard with no skip on every step | Returning users or power users are trapped in beginner content | "Skip setup" link visible on every wizard step, not just the first |
| Consent banner as the first thing a new user sees | Kills the moment of product discovery | Show the calculator first; consent banner is a non-blocking notice below the fold, or a bottom bar — never a blocking modal over the app |
| Pro features shown with a paywall before the user has experienced the free value | Feels like a bait-and-switch | Pro upsell surfaces contextually (e.g., "Share this quote" → "Upgrade for a hosted link") — never as the first impression |
| "Spool moisture tracker" with no explanation of why it matters | Users skip the feature | Contextual copy: "Wet filament prints worse and costs more. Track spool storage to flag moisture risk." |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces — learned from v1.x history.

- [ ] **GDPR consent banner:** Has "Accept All" and "Reject All" at equal visual weight on the first layer (not a link to a settings sub-page). Vercel Analytics does not fire until Accept is clicked. Tested: Reject → check Network tab → no analytics request.
- [ ] **Privacy policy:** Explicitly names Vercel Analytics, Supabase, and any other processors. Includes data subject rights (access, deletion, portability) and a contact email. Updated every time a new data flow is added.
- [ ] **Hosted quote page share link:** Token is a UUID v4 (or 128-bit random). URL is not guessable from any sequential ID. Page returns `noindex`. Page has expiry. RLS policy verified with a logged-out request.
- [ ] **STL volume estimate:** Tested with a known-weight file. Has unit-detection warning (mm vs. inches). Has infill input. Has accuracy disclaimer in the UI.
- [ ] **CostCalculator split:** Output-equivalence tests pass for 10 representative inputs (old component vs. new component, same numbers). `react-hooks/exhaustive-deps` at error level. Human UAT: type two pricing fields in rapid succession.
- [ ] **Onboarding wizard:** Skip button on every step. "Has completed onboarding" stored in Dexie `UserProfile`, not `localStorage`. Wizard does not overwrite existing data.
- [ ] **File-based sync:** Export includes `schemaVersion`. Import checks `schemaVersion` before writing. Multi-tab test: export from Tab A and Tab B simultaneously → one wins, no corruption, or conflict is surfaced.
- [ ] **Backend free-floor check:** Sign out of Supabase. Open the calculator. Confirm it loads and saves locally without any 401 or 403.
- [ ] **Spend caps:** Supabase spend cap enabled. Vercel spend cap enabled. Billing alert at 50% of budget configured. Confirmed in dashboard before first Pro user.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Free floor requires account (ships) | HIGH | Emergency patch to remove auth check from free routes; deploy immediately; public announcement |
| Consent banner non-compliant (post-launch) | MEDIUM | Remove non-essential scripts immediately; redeploy compliant banner within 24h; document incident; consult GDPR counsel if complaint received |
| Share link URL is sequential (discovered pre-launch) | LOW | Migrate to UUID v4 tokens before launch; no user impact |
| Share link URL is sequential (discovered post-launch) | HIGH | Rotate all tokens; notify affected Pro users; log as GDPR breach if customer PII was accessible |
| STL quote wildly wrong (unit error) | MEDIUM | Add unit-detection warning in next patch; add disclaimer to all existing instant quotes; no data loss |
| CostCalculator split introduces pricing regression | HIGH | Revert split (git revert); release as a patch; redo the split with output-equivalence tests — same as PERF-11 but with more safeguards |
| Failure-cost model changes prices silently | MEDIUM | Ship a one-time reconcile banner + help article in next patch; document in CHANGELOG |
| Supabase cost spike | LOW-MEDIUM | Enable spend cap immediately; identify runaway query; fix and redeploy; review with Supabase billing dashboard |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| C-01: Free floor requires account | Backend foundation | Sign out of Supabase; confirm calculator loads and saves locally |
| C-02: Data-model drift Dexie↔Postgres | Backend foundation | Schema changelog triple (Dexie version, Postgres migration, sync protocol version) reviewed on every PR |
| C-03: Pricing state desync during God-component split | CostCalculator split phase | Output-equivalence tests; `react-hooks/exhaustive-deps` at error; human UAT rapid-typing |
| C-04: Non-compliant consent banner | GDPR/legal foundation | Network tab shows no analytics on page load before consent; Reject takes 1 click; equal button weight |
| C-05: Privacy policy diverges from actual processing | GDPR/legal foundation | Data flow inventory table reviewed against policy on every PR adding a data flow |
| C-06: Hosted quote PII via predictable URL | Instant-quote Pro phase | Verify token is UUID v4; `curl` logged-out request returns 403; `noindex` header present |
| C-07: STL volume wrong (units/infill/manifold) | Instant-quote free-floor phase | Known-weight STL test; unit-detection warning visible; infill input present; disclaimer in UI |
| C-08: File sync data corruption | File-based sync phase | Simultaneous two-tab export test; schema version in export; version-mismatch import shows warning |
| M-01: Onboarding blocks returning users | First-run onboarding phase | Stored in Dexie `UserProfile.onboardingCompleted`; skip on every step; does not overwrite existing data |
| M-02: Tab-URL routing breaks PWA/Tauri | Tab-URL routing phase | PWA manifest `start_url` updated; all routes serve SPA from service worker; Tauri deep-link test |
| M-03: Backend cost blowup | Backend foundation | Spend cap enabled; billing alert at 50%; no binary files in Supabase Storage MVP |
| M-04: Failure-cost model changes displayed prices | Failure-cost engine phase | One-time reconcile banner; changelog entry; `failureCostModelVersion` in UserProfile |
| M-05: Scope collapse — backend blocks everything | Roadmap sequencing | Every free-floor feature designed to work without backend; shippable MVP defined before development starts |

---

## Sources

**Project history (HIGH confidence — directly observed):**
- PERF-11 regression: dep-array trim desynced profit/margin; caught by release-diff review, not 819 tests (v1.9 RELEASE REVIEW)
- Marketplace-fee FX bug: fees were USD-hardcoded, ~150× wrong for JPY (v1.9 AUDIT)
- Dexie `versionchange` multi-tab white-screen crash (v1.2 Phase 12)
- Asset-library reset data-loss: scoped reset cleared all materials silently (v1.9 UAT)
- seedState re-seeding bug: deleted defaults reappeared on every reload (v1.9 AUDIT)

**GDPR enforcement (HIGH confidence — official enforcement records):**
- [CNIL fines Google €150M for cookie rejection friction (2022)](https://www.cnil.fr/en/use-cookies-cnil-fines-google-150-million-euros-and-facebook-60-million-euros)
- [CNIL fines Google €200M (September 2025)](https://seresa.io/blog/privacy-compliance/dark-patterns-in-your-consent-banner-could-cost-you-millions)
- [SHEIN fined €150M for cookies firing post-reject (September 2025)](https://seresa.io/blog/privacy-compliance/dark-patterns-in-your-consent-banner-could-cost-you-millions)
- [Honda fined $632,500 for two-click reject vs one-click accept (California CPPA)](https://seresa.io/blog/privacy-compliance/dark-patterns-in-your-consent-banner-could-cost-you-millions)
- [GDPR pre-ticked boxes invalid — CJEU ruling](https://www.termsfeed.com/blog/gdpr-no-pre-ticked-boxes-cookies/)
- [Vercel Analytics GDPR compliance guide](https://webeyez.com/insights/guides/is-vercel-analytics-gdpr-compliant)
- [Vercel DPF certification](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf)

**Local-first architecture (MEDIUM confidence — verified against official RxDB docs and Dexie issue tracker):**
- [RxDB downsides of offline-first: storage limits, conflict resolution, auth complexity](https://rxdb.info/downsides-of-offline-first.html)
- [Dexie.js versionchange documentation](https://dexie.org/docs/Dexie/Dexie.on.versionchange)
- [Dexie.js Syncable for Google Drive/Dropbox — developer confirms multi-client sync to a single file is not the right approach](https://github.com/dfahlander/Dexie.js/issues/545)

**STL volume estimation (MEDIUM confidence — verified against Three.js forum and iamRapid docs):**
- [Three.js forum: signed-tetrahedron volume method for STL](https://discourse.threejs.org/t/help-load-stl-files-ascii-or-binary-to-calculate-volume-and-dimensions/5284)
- [Non-manifold mesh impact on volume: "does not have a well defined inside or outside"](https://github.com/mikedh/trimesh/issues/1183)
- [Volume calculator assumes solid part; infill factor must be applied separately](https://iamrapid.com/tools/export-cc/)
- [Hubs.com: non-manifold, holes, inverted normals, degenerate triangles cause STL errors](https://www.hubs.com/knowledge-base/fixing-most-common-stl-file-errors/)

**Backend cost (MEDIUM confidence — Supabase pricing page + community reports):**
- [Supabase pricing: free tier 500 MB, Pro $25/month, spend cap available](https://supabase.com/pricing)
- [Railway: per-resource billing, no fixed ceiling, no spending cap on by default](https://designrevision.com/blog/saas-hosting-compared)

**React stale closures (HIGH confidence — React official docs + ESLint plugin):**
- [TkDodo: Hooks, Dependencies and Stale Closures](https://tkdodo.eu/blog/hooks-dependencies-and-stale-closures)
- [Kent C. Dodds: 5 React Hooks Pitfalls](https://kentcdodds.com/blog/react-hooks-pitfalls)

---
*Pitfalls research for: v2.0 Cost-Truth & Insight — adding first backend, GDPR layer, STL instant quotes, God-component split, file sync, and onboarding to a shipped local-first product*
*Researched: 2026-07-03*
