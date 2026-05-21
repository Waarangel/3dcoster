# Domain Pitfalls — v1.2 Quote-to-Customer

**Domain:** Adding tax/VAT, customer PII, tag-search, lazy PDF, quick duplicate, Etsy helper, and UI sweep to an existing local-first React 19 + Dexie v4 + react-window v2 + Tauri 2 app with a 300 KB gz main-chunk gate
**Researched:** 2026-05-20
**Confidence:** HIGH — all pitfalls grounded in source-file reading + verified external sources

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or silent incorrect prices.

---

### Pitfall C-01: Tax applied to wrong base (tax on profit instead of tax on subtotal)

**What goes wrong:**
`calculateCost` produces `subtotal` (per-unit variable cost only — filament + electricity + materials + labor) and `failureAdjusted` (subtotal after failure multiplier), but also exposes `printerDepreciation` and `nozzleWear` as separate fixed-cost fields. The "total customer pays" is currently composed outside `calculateCost` in the component (sellingPrice). If tax is inserted before the failure multiplier or applied to the wrong base the tax line will not match what the customer is quoted.

**Correct order of operations for 3DCoster:**
```
subtotal (per-unit variable cost)
→ failureAdjusted = subtotal × failureMultiplier
→ + depreciation + nozzleWear   (fixed, not per-unit)
→ = trueUnitCost
→ sellingPrice = trueUnitCost / (1 − profitMargin)
→ taxAmount = sellingPrice × taxRate          ← tax is LAST, on the sell price
→ customerPrice = sellingPrice + taxAmount
```

Tax must go on the selling price, not on the cost subtotal. Applying tax to `subtotal` instead of `sellingPrice` understates the tax line. Applying tax to `failureAdjusted` but before adding depreciation/nozzle understates the taxable base by those fixed costs.

**Warning sign:** Test `calculateTax(100, 0.15)` returns `15.00`. Then test `customerPrice = sellingPrice + taxAmount` against `subtotal * rate` — they must diverge when depreciation > 0 (which they correctly should; tax is on price, not cost).

**Prevention:** The existing `it.todo('tax/VAT applies after subtotal — activates in v1.2')` in `costCalc.test.ts` is the right hook. Activate it with assertions that verify: (a) taxAmount = `round2(sellingPrice × rate)`, (b) customerPrice = `sellingPrice + taxAmount`, and (c) the tax line does NOT equal `subtotal × rate` when depreciation/nozzle are non-zero (regression guard on the correct base).

**Owner phase:** Tax/VAT phase (Phase 12 or wherever tax lands)

---

### Pitfall C-02: Floating-point rounding producing off-by-one-cent tax lines

**What goes wrong:**
JavaScript IEEE 754: `(1.005).toFixed(2)` returns `"1.00"` in some engines (not `"1.01"`). More concretely: `12.50 * 0.23 = 2.8750000000000004` — displayed as `$2.88` via naive `toFixed(2)` but `2.875` rounds to `2.88` correctly. The dangerous case is `12.85 * 0.15 = 1.9275000000000002` which `toFixed(2)` rounds as `1.93`, while `total - subtotal` gives `1.92` or `1.93` depending on intermediate precision — these two methods can disagree by one cent.

The existing codebase uses raw floating-point throughout `costCalc.ts` (no decimal library). This works acceptably for cost display (`.toFixed(2)` on the final number only). Adding a tax line that is also displayed separately and must add up to the total adds a second derived number that must round consistently.

**Prevention:**
- Compute `taxAmount = Math.round(sellingPrice * rate * 100) / 100` (integer-centime rounding, not `toFixed`).
- Compute `customerPrice = sellingPrice + taxAmount` (never `sellingPrice * (1 + rate)` and round — this produces a different result when `sellingPrice` has precision).
- Do NOT derive tax by subtraction (`total - sellingPrice`). Always derive it from `sellingPrice * rate`, then add.
- `costCalc.test.ts` edge cases to add: `rate=0.23, sellingPrice=12.50` (expect `taxAmount=2.88`); `rate=0.25, sellingPrice=1.00` (expect `0.25`); `rate=0.0` (expect `0`); `rate=1.0` (100% tax — exists in some jurisdictions as luxury tax).

**Warning sign:** Tax line and `customerPrice - sellingPrice` disagree on any test input.

**Owner phase:** Tax/VAT phase

---

### Pitfall C-03: PDF lazy chunk prefetched by Vite's modulePreload, killing the 300 KB win

**What goes wrong:**
Vite injects `<link rel="modulepreload">` tags into `index.html` for every dynamic import it resolves at build time. A `const PdfButton = React.lazy(() => import('./PdfExport'))` that also `import()`s jspdf inside it will still get a `modulepreload` link generated for the jspdf chunk — the browser fetches it speculatively at page load, restoring the parse cost that lazy-loading was supposed to defer. The 300 KB gz gate in `scripts/assert-bundle-size.mjs` only checks `index-*.js`; the PDF chunk sits in a separate file and is not measured by the gate. The gate passes but the user downloads the PDF library anyway.

**Prevention:**
- Add `build: { modulePreload: false }` to `vite.config.ts` OR use the `resolveDependencies` fine-grained API to exclude the pdf chunk from preload. Simpler: `modulePreload: { polyfill: false }` only removes the polyfill, not the preload links — that is insufficient. The full `modulePreload: false` removes link tags.
- Alternatively: trigger the PDF import only on explicit user click, using a ref-guarded import that only runs once. Browsers do not prefetch imports that are dynamically constructed at runtime (string-computed paths), but Vite's static analysis catches `import('./PdfExport')` and generates a preload regardless.
- Validate: after build, check `dist/index.html` for `modulepreload` links pointing at the PDF chunk name. If present, the lazy strategy is broken.
- The `assert-bundle-size.mjs` gate should be extended to also check the PDF chunk is absent from `index.html` modulepreload links, or a separate `scripts/assert-no-pdf-preload.mjs` check.

**Warning sign:** Running `grep -r "modulepreload" dist/index.html` after build shows a link referencing the pdf chunk.

**Owner phase:** PDF quote phase

---

### Pitfall C-04: Quick duplicate carries over `id`, `createdAt`, and customer PII — three distinct failure modes

**What goes wrong:**
A naive `{ ...job }` duplicate then `db.jobs.add(copy)` fails immediately with Dexie's unique-constraint violation on `id`. A developer fixes the `id` first, then later discovers the `createdAt` is wrong (duplicate shows as "created" at the original date), and later still discovers the customer name/email/address was copied silently.

These are three separate bugs that require three explicit decisions:

| Field | Correct behavior | Risk if inherited |
|---|---|---|
| `id` | New `crypto.randomUUID()` | DB constraint crash |
| `createdAt` | `new Date()` | Wrong sort order in JobsManager |
| `updatedAt` | `new Date()` | Misleading "last edited" |
| `customer` (name/email/address) | `undefined` | PII leak — customer appears on a quote for a different customer |
| `taxRate` (per-job override) | `undefined` or Settings default | Wrong jurisdiction rate on the new job |
| `copiesSold` | `0` | Phantom sales on the new job's break-even tracking |
| Quote number / job reference | Generate fresh | Collision if user ever cross-references |

**Prevention:** Define an explicit `duplicateJob(source: PrintJob): PrintJob` function with an allowlist (not a blocklist) — only copy the fields that should carry over: `name` (with "Copy of" prefix), `filaments`, `printTimeHours`, `printerInstanceId`, `modelCost`, `modelCostPerUnit`, `authorMinPrice`, `modelUrl`, `prepTimeMinutes`, `postProcessingMinutes`, `materialsUsed`, `failureRate`, `sellingPrice`, `notes`, `tags`. Reset everything else to neutral defaults. Unit-test the function explicitly with an assertion that `duplicate.customer === undefined`.

**Warning sign:** Duplicate operation with a job that has `customer: { name: 'Alice' }` — inspect the duplicate and assert customer is undefined.

**Owner phase:** Quick duplicate phase

---

### Pitfall C-05: Dexie downgrade — older web/PWA opens v6 database without v6 declarations

**What goes wrong:**
A user upgrades the PWA (auto-update via `workbox: { registerType: 'autoUpdate' }`), gets Dexie v6 schema with `tags` and `customer` fields. They then open the app in a second tab that hasn't refreshed yet (still running v5 code). The v5 Dexie instance opens the database and finds version 6 — it throws `VersionError: The requested version (5) is less than the existing version (6)`. The second tab shows a blank white screen or an uncaught exception. This is not data loss, but it is a hard crash for the user.

Separately: a Tauri desktop user who rolled back to an older app build has the same problem permanently until they reinstall.

**Prevention:**
- Add a `versionchange` event listener via `db.on('versionchange', () => window.location.reload())` — this triggers when another tab upgrades the DB and tells the current tab to reload.
- The PWA already uses `registerType: 'autoUpdate'` in `vite.config.ts`, which calls `skipWaiting` automatically. Add the corresponding `clients.claim()` in the service worker and a `controllerchange` listener that reloads the page. Together these ensure all tabs switch to the new version atomically.
- Upgrade functions in Dexie run **once per client, on the first open after the version bump** — not on every open. This is correct and safe. However, if the upgrade function throws, the DB open fails and the entire app breaks. Wrap upgrade mutations in try/catch within the `.upgrade()` callback and log errors.

**Warning sign:** Console shows `VersionError` or `IDBVersionChangeEvent` in an open tab after deploying.

**Owner phase:** Dexie migration phase (whichever phase adds v6 schema)

---

## Moderate Pitfalls

---

### Pitfall M-01: Region VAT table staleness — user gets wrong rate with no warning

**What goes wrong:**
Bundling a static JSON rate table (e.g., `{ "DE": 0.19, "SK": 0.20, ... }`) without a `lastUpdated` timestamp means Slovakia's rate is 20% in the bundle but legally 23% as of January 2025. The user prices a quote at 20% VAT and under-collects. Worse: the user has no way to tell the rate is stale.

Concrete rate changes that will make any 2024-era table wrong:
- Slovakia: 20% → 23% (Jan 2025)
- Estonia: 22% → 24% (Jul 2025)
- Romania: 19% → 21% (Aug 2025)

**Prevention:**
- Embed a `rateAsOf: "YYYY-MM-DD"` field per country entry (not a single global date — countries change at different times).
- Display "VAT rate as of [date]" in the UI wherever the rate appears. This is a legal protection for the user: they can see the rate may be stale and verify.
- Add an inline note: "Rates are estimates. Verify with your tax authority before issuing invoices."
- When a country is missing from the table, do not silently fall back to 0%. Show "No rate on file — enter manually" and require the user to input a rate. 0% VAT being the fallback for an unknown country is a silent pricing error.
- The region table is small enough (~50 entries, ~3 KB) to ship inline in the main chunk — do not lazy-load it. Lazy-loading the tax table would block the tax UI on first render.

**Warning sign:** Country selector saves successfully but the tax line shows $0.00 for a country that has VAT.

**Owner phase:** Tax/VAT phase

---

### Pitfall M-02: Virtualized list cache stale after tag filter applied

**What goes wrong:**
The existing `useDynamicRowHeight` uses `key: selectedJobId ?? ''` to invalidate the height cache when selection changes (Phase 11 fix, per `JobsManager.tsx:464-467`). When a tag filter is applied, `jobs` prop changes (new subset), but `selectedJobId` may be unchanged — the cache still holds heights from the full list, indexed by old row positions. Row N in the filtered list may be a different job than row N was in the unfiltered list, but the cache returns a stale height. The row renders at the wrong height until the user scrolls past and triggers a remeasure.

Additionally: if the user has job #47 selected (expanded, tall) and applies a filter that removes that job from the list, `selectedJobId` still holds the now-invisible job's ID. The UI shows no expanded row but the cache key is non-null, so `useDynamicRowHeight` still operates in "something is expanded" mode.

**Prevention:**
- The `key` passed to `useDynamicRowHeight` must encode both the selected job AND the active filter/search state. A cheap composite: `key: \`${selectedJobId ?? ''}::${filterTagKey}::${searchQuery}\`` resets the cache whenever any of these change.
- When the filter changes, also call `setSelectedJobId(null)` if the currently-selected job is no longer in the filtered list: `useEffect(() => { if (selectedJobId && !filteredJobs.find(j => j.id === selectedJobId)) setSelectedJobId(null); }, [filteredJobs])`.
- Add an empty-state guard: when `filteredJobs.length === 0` (filter matches nothing), render the empty state rather than `<List rowCount={0}>` — react-window with rowCount=0 can produce a zero-height container that breaks the layout.

**Warning sign:** After filtering, some job cards visually overlap or show collapsed height for what should be an expanded card.

**Owner phase:** Tags + search phase

---

### Pitfall M-03: Tag input parsing produces degenerate tags

**What goes wrong:**
Users type comma-separated tags: `"Etsy, ,functional,,ETSY"`. A naive `input.split(',').map(t => t.trim())` produces `["Etsy", "", "functional", "", "ETSY"]`. Empty strings saved to `tags[]` cause filter chips to render as blank buttons. Duplicate-by-case `ETSY` and `Etsy` are treated as different tags, so filtering by `Etsy` misses items tagged `ETSY`.

**Prevention:**
- Parse function: `input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)`.
- Deduplicate: `[...new Set(parsed)]`.
- Max-tag guard: cap at a reasonable number (e.g., 20). Without a cap, a paste of a comma-dense string creates hundreds of tags that blow up the chip row and the DB record size.
- When rendering filter chips, derive the tag list from `Array.from(new Set(jobs.flatMap(j => j.tags ?? [])))` — this automatically normalizes case-insensitive if all tags were lowercased on save.
- Rename detection: if a user renames a saved tag (via a future tag management UI), existing jobs still hold the old tag string. v1.2 ships no tag rename feature, so document this as a known limitation.

**Warning sign:** Filter chip bar shows blank chips, or searching for a tag returns fewer results than expected due to case mismatch.

**Owner phase:** Tags + search phase

---

### Pitfall M-04: Dexie v6 upgrade migration correctness — required fields need defaults

**What goes wrong:**
Adding `tags` and `customer` to `PrintJob` in the TypeScript type without a migration that backfills existing records means every v1.0/v1.1 job loaded from DB has `job.tags === undefined`. Code that does `job.tags.includes('etsy')` throws `TypeError: Cannot read properties of undefined`. This is not Dexie's fault — Dexie stores only what was put; it does not materialize missing optional fields.

The v5 → v6 upgrade in `database.ts` must explicitly set defaults:
```typescript
db.version(6).stores({ /* same indexes + tags field */ }).upgrade(tx => {
  return tx.table('jobs').toCollection().modify(job => {
    if (!Array.isArray(job.tags)) job.tags = [];
    // customer intentionally NOT defaulted — undefined is correct for old jobs
  });
});
```

For 5000+ jobs, `toCollection().modify()` runs in a single IndexedDB transaction. This is generally fine (IndexedDB transactions have no timeout), but on low-power devices it will block the DB for 0.5–2 seconds. Users will see the skeleton loading state for slightly longer on first open after upgrade — this is acceptable, but do not add unrelated work inside the upgrade callback.

**Prevention:**
- Always write the upgrade function before writing the TypeScript type. The type contract must match what the DB actually stores.
- Tag every access of `job.tags` with `?? []`: `(job.tags ?? []).includes(tag)`. This makes pre-migration data safe even if the upgrade function is somehow delayed.
- Add a Vitest test that constructs a PrintJob without `tags` and passes it through the tag filter logic — it must not throw.

**Warning sign:** TypeError in the console after deploy referencing `tags.includes` or `customer.name`.

**Owner phase:** Dexie migration phase

---

### Pitfall M-05: PDF font loading fails in Tauri (file:// protocol, WKWebView on macOS)

**What goes wrong:**
jspdf's `addFont` via `fetch('/fonts/MyFont.ttf')` works in a browser (served over HTTP). In Tauri on macOS, the webview is WKWebView (WebKit, not Chromium). The app origin is `tauri://localhost` (Tauri 2) and font files served from the asset bundle use the `asset://` protocol or `tauri://` scheme. A relative `fetch('/fonts/MyFont.ttf')` may return a CORS error or 404 depending on how Tauri's `asset` scope is configured.

The safe cross-runtime approach is to bundle the font as a base64 string in the PDF chunk itself (not a separate fetch). jspdf supports `doc.addFileToVFS('font.ttf', base64string)`. A TTF for Latin-only text (e.g., a subset of Roboto) is ~30–60 KB base64, acceptable inside the lazy PDF chunk. This eliminates the network/protocol dependency entirely.

**Prevention:**
- Bundle font as a base64 string in the PDF module. Use a build-time script or a Vite `?raw` + base64 encode at build to produce the constant.
- Do not use `doc.setFont('helvetica')` — the 14 built-in PDF fonts do not support non-ASCII characters (euro sign €, accented characters, etc.) that appear in customer addresses or product names.
- Test the PDF export path in `npm run tauri:dev`, not just the web dev server. The two protocols differ in Tauri 2.

**Warning sign:** PDF generates correctly on web but shows boxes for non-ASCII characters in Tauri desktop, or the export button silently fails in Tauri (font fetch throws, uncaught promise rejection).

**Owner phase:** PDF quote phase

---

### Pitfall M-06: Customer PII in IndexedDB — no "forget me" story, duplicate leaks PII

**What goes wrong:**
IndexedDB in a browser is stored under the origin's site data. For the web app, it lives in the browser's profile directory. For Tauri on macOS, it lives in `~/Library/WebKit/<bundle-id>/WebsiteData/IndexedDB/`. After a Tauri app uninstall on macOS, this directory is NOT cleaned up by default — a user who uninstalls 3DCoster still has their IndexedDB (including customer names, emails, addresses) on disk. On Windows it lives in `%AppData%\...\WebView2\...` under the bundle ID, and is similarly not cleaned by a default NSIS uninstall.

Additionally: if Quick Duplicate copies `customer` (see C-04), a user creating a duplicate job for a different customer and forgetting to clear the customer fields sends the wrong customer's name on the PDF quote.

**Prevention:**
- Add "Wipe all customer data" to Settings → Privacy. This is a single Dexie `jobs.toCollection().modify(j => { delete j.customer; })` operation.
- Add a "Export my data" button (JSON dump of all jobs) in the same section. This is the GDPR "data portability" gesture for EU users.
- Tauri uninstaller: add a Tauri `beforeExit` or the NSIS `[UninstallRun]` section to clear the WebView data directory. This is a Tauri-side concern, not a v1.2 React concern, but flag it in the phase so it is not forgotten.
- Document in the FAQ/privacy policy: "Customer data is stored only on your device and is never transmitted. Use Settings → Privacy → Wipe Customer Data to remove it."
- The Quick Duplicate function (C-04) must explicitly reset `customer: undefined`.

**Warning sign:** JSON export of a duplicated job still contains the original customer's email.

**Owner phase:** Customer PII phase; Tauri uninstaller is a separate future task to flag.

---

## Minor Pitfalls

---

### Pitfall m-01: Etsy ToS helper rules hard-coded and immediately stale

**What goes wrong:**
Etsy updated its Creativity Standards on June 10, 2025, removing the allowance for 3D-printed items using third-party templates — a significant policy shift. An Etsy ToS helper that embeds rules as static strings becomes actively misleading within weeks. If a user relies on the helper to confirm compliance and Etsy has since changed the rule, the seller risks account suspension.

**Prevention:**
- Never display a static list of rules as "you are compliant if you meet these." Display it as "as of [date] — verify at etsy.com/legal/creativity."
- Add a prominent disclaimer: "Etsy's policies change. This checklist is a reminder, not legal advice. Always check Etsy's current Seller Policy before listing."
- Store the `policySummaryAsOf` date as a constant in the source file (not config) so it is visible in a code review when updating.
- Limit the checklist to genuinely stable rules (e.g., "Is this your original design?") rather than procedural rules that change.
- Link directly to `https://www.etsy.com/legal/creativity/` rather than summarizing the content inline.

**Warning sign:** The date shown in the UI is more than 3 months old; any policy item says something about permitted template use.

**Owner phase:** Etsy helper phase

---

### Pitfall m-02: Main chunk bloat — region table or PDF lib leaking into main chunk via manualChunks

**What goes wrong:**
The `vite.config.ts` `manualChunks` function currently routes all `node_modules` not matched by react or dexie into a generic `vendor` chunk. If a PDF library is imported anywhere in the main app (even indirectly via a utility file that is not behind a `React.lazy`), it lands in `vendor`, which is eagerly loaded. The region VAT table, if implemented as a large JSON import at the module level of `CostCalculator.tsx` or `db/database.ts`, will also land in the main chunk.

Rough bundle-size context (from search results; MEDIUM confidence — verify at bundlephobia):
- `jspdf`: ~348 KB uncompressed (est. ~120–150 KB gz) — will blow the 300 KB main-chunk gate if it lands there
- `pdf-lib`: smaller than jspdf (est. ~50–80 KB gz) — still adds budget pressure if main-chunk is already near 300 KB
- Region VAT table (50 countries, ~3 KB JSON): safe inline
- Tag-filter logic (pure JS, no deps): safe inline

**Prevention (per feature):**
| Feature | Inline vs Lazy | Rationale |
|---|---|---|
| Region VAT table (JSON, ~3 KB) | Inline | Needed at form render; trivially small |
| PDF library (jspdf / pdf-lib) | Lazy — dynamic `import()` behind a button click | 120-350 KB gz; only needed on export |
| Tag filter logic | Inline | Pure JS, negligible size |
| Customer PII form fields | Inline | Just HTML inputs; no new deps |
| Etsy checklist | Inline | Static content; no deps |

- Run `npm run analyze` (the rollup-plugin-visualizer mode already in `vite.config.ts`) after adding each new import to catch regressions before the CI gate does.
- The `assert-bundle-size.mjs` gate at 300 KB catches the main chunk but does NOT catch the vendor chunk growing. Add a secondary check on the vendor chunk if concerns arise.

**Warning sign:** `vite build` passes but `npm run analyze` shows the PDF lib in the `index-*.js` treemap or the `vendor` chunk.

**Owner phase:** PDF quote phase (gating concern); Tags/customer phases (watch imports)

---

### Pitfall m-03: Scroll position not reset after filter applied in virtualized list

**What goes wrong:**
A user is scrolled to position 2000px in the jobs list (job #47 visible). They type a search query. The `jobs` prop changes to a 3-item filtered list, but react-window's internal `scrollOffset` is still 2000px — all three filtered rows are above the visible viewport. The list appears empty. Scrolling up reveals the results.

**Prevention:**
- Keep a ref to the `List` component instance (`listRef = useRef<FixedSizeList>(null)`) and call `listRef.current?.scrollTo(0)` inside the same effect/handler that updates `filteredJobs`. In react-window v2 with `useDynamicRowHeight`, the ref is on the `List` element.
- Alternatively: use a React `key` on the `<List>` element that encodes the active filter. Changing the key unmounts/remounts the List, resetting scroll to 0. This is heavier but simpler: `<List key={filterKey} ...>`.

**Warning sign:** After typing in the search box, the list appears to show zero results until the user scrolls up.

**Owner phase:** Tags + search phase

---

### Pitfall m-04: Tax compound bug — "tax on tax" for US sales tax states with marketplace facilitator laws

**What goes wrong:**
In the US, 45 states have marketplace facilitator laws that make Etsy responsible for collecting and remitting sales tax — the seller does NOT add a separate tax line on their quote to the customer. If the region table includes US state rates and the seller applies them on top of Etsy's collected tax, the customer sees a double-tax line.

**Prevention:**
- For the US, the region table should show `taxRate: 0` with a note: `taxNote: "Etsy/marketplace collects sales tax in most US states. Check your state's nexus rules."`. Do not bundle per-state rates — it is unnecessary complexity for a small seller tool and the rates change frequently.
- The per-job override allows a power user to add a rate if they sell direct (non-marketplace), covering the edge case.
- For Canada (GST/HST/PST), include federal + common provincial rates but note that some provinces have separate PST administered separately from HST.

**Warning sign:** US user reports their quote shows a tax line when selling through Etsy.

**Owner phase:** Tax/VAT phase

---

### Pitfall m-05: PDF generation blocking the main thread on large/complex quotes

**What goes wrong:**
jspdf runs synchronously on the main thread. For a quote with a large text description, many line items, or an embedded image (e.g., a filament swatch or logo), generation can block the UI for 200–800 ms. On a low-end device this freezes the button animation and may cause the browser to mark the page as unresponsive.

**Prevention:**
- For v1.2 scope (simple quote: job summary + tax + customer details), generation time should be under 100 ms and is acceptable on the main thread. Flag this as a known limitation to revisit if image embedding is added.
- Add a loading state on the "Download PDF" button (disabled + spinner) before the `await import(...)` and during generation. This prevents double-clicks and gives user feedback.
- pdf-lib (if chosen instead of jspdf) is also synchronous but tends to produce smaller output. The web worker path for jspdf throws `ReferenceError: window is not defined` (jspdf requires DOM access) — do not attempt to offload to a worker without verifying the specific library supports it.

**Warning sign:** The "Download" button visually sticks for 0.5+ seconds before the save dialog appears.

**Owner phase:** PDF quote phase

---

## Phase-Specific Warnings Summary

| Phase topic | Likely pitfall | Mitigation |
|---|---|---|
| Tax / VAT (Phase 12) | C-01: tax on wrong base | Activate `it.todo` in costCalc.test.ts first; assert tax = `round2(sellingPrice × rate)` |
| Tax / VAT (Phase 12) | C-02: floating-point cent drift | Use `Math.round(x * 100) / 100`, never `toFixed` for intermediate values |
| Tax / VAT (Phase 12) | M-01: stale region table | Embed `rateAsOf` per country; show date in UI; fallback to "enter manually" not 0% |
| Tax / VAT (Phase 12) | m-04: US double-tax | US entry = 0% with marketplace facilitator note |
| Customer PII | C-04: duplicate carries PII | Use allowlist `duplicateJob()` function; unit-test `customer === undefined` |
| Customer PII | M-06: no forget-me story | "Wipe customer data" in Settings; document Tauri uninstall gap |
| Tags + search | M-02: stale height cache after filter | `key` must encode filter + selectedJobId; clear selectedJobId if filtered out |
| Tags + search | M-03: degenerate tag strings | `split(',').map(trim).map(toLowerCase).filter(Boolean)` + `Set` dedup + max-count guard |
| Tags + search | m-03: no scroll reset after filter | `listRef.current?.scrollTo(0)` or `key` on `<List>` when filter changes |
| PDF quote | C-03: lazy chunk prefetched | `build: { modulePreload: false }` or assertion in CI that pdf chunk has no preload link |
| PDF quote | M-05: font CORS in Tauri | Bundle font as base64 inside the lazy PDF module; test in `tauri:dev` not just browser |
| PDF quote | m-02: lib leaks into main chunk | No PDF import outside the lazy boundary; `npm run analyze` after each commit |
| PDF quote | m-05: main-thread freeze | Loading state on button; acceptable for v1.2 scope; no worker for jspdf |
| Quick duplicate | C-04: id/PII/copiesSold reset | Explicit allowlist function; Vitest unit test |
| Dexie migration | M-04: missing defaults on upgrade | `upgrade()` sets `tags: []`; all tag access uses `?? []` guard |
| Dexie migration | C-05: version downgrade crash | `db.on('versionchange', reload)`; PWA `controllerchange` reload |
| Etsy helper | m-01: stale ToS rules | Hard-code `policySummaryAsOf` date; link to Etsy legal page; disclaimer |
| UI sweep | m-02: new imports grow main chunk | `npm run analyze` after every import addition before merge |

---

## Sources

- [jspdf NPM package page / bundlephobia references](https://www.npmjs.com/package/jspdf) (bundle size ~348 KB uncompressed; MEDIUM confidence — verify with `npm run analyze`)
- [jspdf font/non-ASCII issue tracker](https://github.com/parallax/jsPDF/issues/2677) — confirmed 14 built-in fonts are ASCII-only
- [jspdf web worker issue](https://github.com/parallax/jsPDF/issues/2605) — confirmed window reference prevents worker use
- [Vite modulePreload disable discussion](https://github.com/vitejs/vite/discussions/8617) — confirmed preload links generated for dynamic imports
- [Vite manualChunks and lazy loading issue](https://github.com/vitejs/vite/issues/5189) — confirmed chunks can load eagerly if dependency exists at module level
- [Dexie versionchange event docs](https://dexie.org/docs/Dexie/Dexie.on.versionchange) — confirmed reload-on-versionchange pattern
- [Dexie downgrade issue #1599](https://github.com/dexie/Dexie.js/issues/1599) — confirmed VersionError on lower-version open of higher-version DB
- [Dexie Version.upgrade() docs / wiki](https://github.com/dexie/Dexie.js/wiki/Version.upgrade()) — confirmed upgrade runs once per version bump, not every open
- [react-window VariableSizeList cache issue #202](https://github.com/bvaughn/react-window/issues/202) — confirmed cache does not auto-invalidate on data change
- [Etsy Creativity Standards update June 2025](https://www.etsy.com/legal/creativity/) — confirmed policy changed June 10 2025 to require original design
- [Etsy 3D printing policy change coverage](https://www.tomshardware.com/3d-printing/etsy-cracks-down-on-3d-printed-products-new-rules-exclude-many-3d-printed-items-from-listings) — confirmed scope of June 2025 change
- [VAT rate changes 2025](https://www.vatai.com/blog/2025-vat-rates-in-europe-country-rates-changes) — Slovakia +3%, Estonia +2%, Romania +2% in 2025
- [JavaScript floating-point tax rounding](https://www.robinwieruch.de/javascript-rounding-errors/) — confirmed `toFixed` is unreliable for intermediate computation
- [Tauri WebView on macOS uses WKWebView](https://v2.tauri.app/reference/webview-versions/) — not Chromium; asset protocol differs
- [Tauri IndexedDB / persistent state](https://aptabase.com/blog/persistent-state-tauri-apps) — data stored under OS app data path, not cleaned on uninstall
- [Tauri font loading CORS issue #6815](https://github.com/tauri-apps/tauri/issues/6815) — confirmed web font fetch failures in Tauri app context
