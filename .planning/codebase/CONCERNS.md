# Codebase Concerns

**Analysis Date:** 2026-04-13

---

## Tech Debt

**Marketplace fee logic duplicated across two components:**
- Issue: Fee calculation exists independently in `src/components/CostCalculator.tsx` (lines 258–289) and again in `src/components/JobsManager.tsx` (lines 63–72). The two copies diverge — `JobsManager` uses a flat `0.45` fixed fee for Etsy, while `CostCalculator` uses `0.25 + 0.20` itemised. Additionally, `JobsManager` omits Etsy offsite ad, eBay, Amazon Handmade, and all custom marketplaces entirely.
- Files: `src/components/CostCalculator.tsx`, `src/components/JobsManager.tsx`
- Impact: Sales recorded in JobsManager calculate incorrect marketplace fees for Etsy (off by $0.00 due to numeric coincidence but logic differs), and custom marketplaces configured in Settings are silently ignored when recording a sale.
- Fix approach: Extract a shared `calculateMarketplaceFee(price, marketplace, fees)` utility function in `src/utils/` and call it from both components, passing the `MarketplaceFees` config.

**Available shipping methods duplicated across two components:**
- Issue: The list of available shipping methods is built independently in `CostCalculator` (lines 292–327) and `JobsManager` (lines 31–46). JobsManager has a simplified, incomplete list — it omits DHL, Royal Mail, Australia Post, Canada Post (even for CAD users), and all custom carriers.
- Files: `src/components/CostCalculator.tsx`, `src/components/JobsManager.tsx`
- Impact: When recording a sale, users in CAD cannot select Canada Post or Purolator. Custom carriers configured in Settings never appear in the Record Sale form.
- Fix approach: Extract a `getAvailableShippingMethods(currency, customCarriers)` helper in `src/utils/` and use it in both components.

**`FILAMENT_DENSITY` constant defined twice:**
- Issue: `1.24 g/cm³` is hardcoded as a module-level constant in `src/components/CostCalculator.tsx` (line 27) and also appears as both a function default and hardcoded fallback in `src/utils/gcodeParser.ts` (lines 50, 62, 72).
- Files: `src/components/CostCalculator.tsx`, `src/utils/gcodeParser.ts`
- Impact: Minor inconsistency risk if one is ever updated. The calculator always uses PLA density for nozzle wear volume regardless of the selected filament type.
- Fix approach: Export the constant and density lookup from `src/utils/gcodeParser.ts` and import into `CostCalculator`.

**`_getPrinterName` dead code in JobsManager:**
- Issue: A helper `_getPrinterName` is declared and then immediately suppressed with `void _getPrinterName` in `src/components/JobsManager.tsx` (lines 157–163).
- Files: `src/components/JobsManager.tsx`
- Impact: Dead code — no functional consequence, but increases noise.
- Fix approach: Delete the function and its suppression line, or use it in the job list display.

**`debug console.log` left in production code:**
- Issue: `console.log('Auto-selecting printer:', ...)` at line 171 of `src/components/CostCalculator.tsx` fires on normal user sessions whenever the printer selection auto-corrects.
- Files: `src/components/CostCalculator.tsx`
- Impact: Leaks internal state info in browser console for every user session.
- Fix approach: Remove the log statement.

**`printers` legacy table persists in DB schema:**
- Issue: `db.version(2)` and later versions define both a `printers` table and a `materials` table for printer assets. Printer data now lives in `materials` (category = `'printer'`), but the empty `printers` table is never removed from the schema and `EntityTable<PrinterConfig, 'id'>` is still declared on the db object in `src/db/database.ts` (line 13).
- Files: `src/db/database.ts`
- Impact: The orphaned `printers` store exists in every user's IndexedDB. Any new migration must carry it forward forever unless explicitly dropped. The TypeScript declaration implies it is usable, which can cause confusion.
- Fix approach: Add a new db version that drops the `printers` store (Dexie allows omitting old stores in newer versions to drop them), and remove the `printers` EntityTable declaration.

**`useDatabase.ts` runs multiple sequential DB migrations synchronously on startup:**
- Issue: The `init()` function in `useAssets()` (lines 14–63 of `src/hooks/useDatabase.ts`) performs up to 4 separate `db.materials` queries serially to detect what migrations to run. This runs on every mount.
- Files: `src/hooks/useDatabase.ts`
- Impact: Each check adds latency on cold start, especially on slow devices. On first install, all 4 branches run.
- Fix approach: Track completed migrations in the `settings` table (a `'migrations-run'` key) and run them only once.

---

## Known Bugs

**Filament nozzle wear uses PLA density regardless of filament type:**
- Symptoms: The volume-based nozzle wear calculation `volumeCm3 = filamentGrams / FILAMENT_DENSITY` in `CostCalculator.tsx` always divides by 1.24 (PLA). For a high-density filament like carbon fiber (1.3–1.6 g/cm³), the volume and therefore nozzle wear will be overestimated.
- Files: `src/components/CostCalculator.tsx` (line 356)
- Trigger: Select any non-PLA filament with high density (e.g., PLA-CF, PETG-CF, PA6-CF).
- Workaround: None for user.

**Break-even calculation in JobsManager uses only `modelCost`, not total fixed costs:**
- Symptoms: `getBreakEvenInfo` in `src/components/JobsManager.tsx` (line 87) calculates break-even as `job.modelCost / profitPerUnit`. `CostCalculator` correctly uses total fixed costs (depreciation + nozzle wear + model cost) when saving the job. JobsManager only considers model cost, so the break-even number displayed in the job list will be lower than what was shown in the calculator.
- Files: `src/components/JobsManager.tsx` (lines 87–104)
- Trigger: Any job with a printer that has depreciation or nozzle wear configured.
- Workaround: None — the discrepancy is silent.

**`tauri.conf.json` `devUrl` is hardcoded to port 4173, but `npm run dev` uses port 5173:**
- Symptoms: `tauri dev` attempts to connect to `http://localhost:4173` (Vite preview port) rather than `http://localhost:5173` (Vite dev server port).
- Files: `src-tauri/tauri.conf.json` (line 7)
- Trigger: Running `npm run tauri:dev` without also running `vite preview` first.
- Workaround: Run `npm run preview` alongside `tauri dev`, or change `devUrl` to `http://localhost:5173`.

**`Analytics` component placed outside `ErrorBoundary` in `main.tsx`:**
- Symptoms: If `Analytics` throws during render, there is no error boundary to catch it — the app crashes to a blank screen rather than the friendly error UI.
- Files: `src/main.tsx` (line 99)
- Trigger: Vercel Analytics SDK error on load (rare, but possible in offline/restricted environments).
- Workaround: None.

---

## Security Considerations

**Tauri CSP is disabled (`"csp": null`):**
- Risk: No Content Security Policy is enforced in the desktop app. A malicious G-code file with injected script content that somehow makes it into the DOM would not be blocked.
- Files: `src-tauri/tauri.conf.json` (line 18)
- Current mitigation: The app has no backend, no user auth, and no external data rendering that would expose XSS surfaces in practice.
- Recommendations: Define an explicit restrictive CSP once Tauri 2 CSP configuration is stable. At minimum, disallow `unsafe-eval` and `unsafe-inline` for scripts.

**No input validation or sanitisation on G-code file parsing:**
- Risk: `src/utils/gcodeParser.ts` reads arbitrary file content via `FileReader` and applies regex against the raw text. A specially crafted file could cause denial-of-service via catastrophic backtracking (regex ReDoS) on certain patterns.
- Files: `src/utils/gcodeParser.ts`, `src/components/GcodeImport.tsx`
- Current mitigation: Only numeric values extracted from matches are used; no content is rendered as HTML.
- Recommendations: Add a file size limit check before parsing (e.g., warn and abort above 50 MB), and review regexes for ReDoS exposure.

**GitHub Releases API called with no authentication (rate limited at 60 req/hour per IP):**
- Risk: In shared network environments (e.g., offices, schools), the unauthenticated rate limit may be exhausted by multiple users, causing silent update check failures.
- Files: `src/components/UpdateBanner.tsx` (line 37)
- Current mitigation: Failures are caught and silently ignored.
- Recommendations: Low priority — acceptable for current scale. Could add a `localStorage` cache of the last check timestamp to avoid re-checking within 1 hour.

---

## Performance Bottlenecks

**`CostCalculator` has 25+ independent `useState` declarations with 20+ dependencies in a single `useEffect` for sessionStorage persistence:**
- Problem: Every keystroke across any of the 20+ form fields triggers the persistence `useEffect` (lines 97–132 of `CostCalculator.tsx`), which JSON-serialises the entire form state and writes to sessionStorage.
- Files: `src/components/CostCalculator.tsx` (lines 53–132)
- Cause: Component is too large and monolithic (1,334 lines). All state lives at the top level with one mega-effect.
- Improvement path: Debounce the sessionStorage write (e.g., 300ms), or use `useReducer` to consolidate state into a single object that can be set atomically.

**`useAssets()` causes all asset-consuming components to re-render on any single asset change:**
- Problem: `useLiveQuery(() => db.materials.toArray())` in `useDatabase.ts` returns the full materials array. Any add/update/delete to any asset triggers a full re-render cascade through `App.tsx` down to `CostCalculator`, `AssetLibrary`, `PrinterSettings`, and `JobsManager`.
- Files: `src/hooks/useDatabase.ts` (line 9), `src/App.tsx` (lines 44–54)
- Cause: Single shared live query returning all assets.
- Improvement path: Split into category-scoped queries where possible, or use `useMemo` to isolate downstream consumers.

---

## Fragile Areas

**DB migration detection uses a specific known asset ID as a sentinel:**
- Files: `src/hooks/useDatabase.ts` (line 45)
- Why fragile: `db.materials.get('bambu-pla-sparkle')` is used to detect whether the Bambu catalog has been added. If `bambu-pla-sparkle` is ever renamed, deleted by a user, or removed from the catalog data, every existing user will be re-seeded with the entire Bambu catalog on next launch.
- Safe modification: Migrate this pattern to a settings key (e.g., `migrations-run: ['bambu-catalog-v1']`) that is set atomically after the migration runs.
- Test coverage: No automated tests exist.

**`PrintJob.costPerUnit` is snapshot-frozen at save time and never recalculated:**
- Files: `src/hooks/useDatabase.ts` (line 437), `src/components/CostCalculator.tsx` (line 512)
- Why fragile: If a user changes their electricity rate, labor rate, or filament price after saving a job, the stored `costPerUnit` goes stale. `JobsManager` displays the old value without any indication it may be out of date.
- Safe modification: Either recalculate on-the-fly when displaying the job, or add a `costCalculatedAt` timestamp and display a staleness warning.
- Test coverage: None.

**`selectedInstanceId` validation logic appears in three separate places:**
- Files: `src/components/CostCalculator.tsx` (lines 58–65, 168, 490)
- Why fragile: The guard `printerInstances.some(p => p.id === stored)` is repeated and slightly different in the `useState` initialiser, the auto-select `useEffect`, and the `handleSaveJob` validation. Drift between these checks could allow a stale or empty instance ID to reach the save path.
- Safe modification: Centralise into a `getValidInstanceId(stored, instances)` helper.
- Test coverage: None.

**`id` generation uses `Date.now()` for both jobs and sales:**
- Files: `src/components/CostCalculator.tsx` (line 524), `src/components/JobsManager.tsx` (line 113)
- Why fragile: `job-${Date.now()}` and `sale-${Date.now()}` are not collision-safe if two records are created within the same millisecond (e.g., rapid automated testing, bulk import). IndexedDB `add()` will throw on duplicate keys.
- Safe modification: Use `crypto.randomUUID()` which is available in all supported environments (modern browsers + Tauri WebView).
- Test coverage: None.

---

## Scaling Limits

**IndexedDB — single-device, no sync:**
- Current capacity: Effectively unlimited for local use (browser quota, typically 60%+ of available disk).
- Limit: All data is local to one browser/device. There is no export-on-change, sync, or backup. A browser data clear or OS reinstall permanently deletes all jobs and sales history.
- Scaling path: A manual JSON export/import exists. No cloud sync is planned per `src/types.ts` AppSettings comments.

**G-code parser loads entire file into memory as a string:**
- Current capacity: Works well for typical slicer output (1–20 MB).
- Limit: Very large multi-part G-code files (100+ MB) will cause noticeable UI freeze since parsing runs synchronously on the main thread.
- Scaling path: Move parsing to a Web Worker or add a file size cap with a user-visible warning.

---

## Dependencies at Risk

**`react` and `react-dom` at `^19.2.0`:**
- Risk: React 19 was released in December 2024 and is still early in ecosystem adoption. Some third-party libraries may have incompatibilities.
- Impact: `dexie-react-hooks` `^4.2.0` is compatible, but future library additions should verify React 19 support.
- Migration plan: No immediate action needed — monitor ecosystem.

**`vite` at `^7.2.4` and `tailwindcss` at `^4.1.18`:**
- Risk: Both are very recent major versions (Vite 7 and Tailwind v4). Community plugins and documentation are still catching up.
- Impact: If a plugin for PWA (`vite-plugin-pwa ^1.2.0`) has not fully tested Vite 7 compatibility, build failures are possible after minor upgrades.
- Migration plan: Pin minor versions in CI if upgrade-triggered failures appear.

---

## Test Coverage Gaps

**No test files exist anywhere in the project:**
- What's not tested: All calculation logic, all DB migration code, all G-code parsing, all currency/distance utilities, all UI component rendering.
- Files: Entire `src/` directory — no `*.test.*` or `*.spec.*` files found.
- Risk: Silent regressions in cost calculation formulas, database migrations, and G-code parsing. These are the core value of the app.
- Priority: High — especially for `src/utils/gcodeParser.ts`, `src/utils/currency.ts`, `src/hooks/useDatabase.ts` migration logic, and the pricing interlink logic in `src/components/CostCalculator.tsx` (lines 550–572).

---

*Concerns audit: 2026-04-13*
