# 3DCoster Feature Roadmap

---

## Deployment Guide (Hosted PWA)

### Initial Setup (One-Time)

#### Option A: Vercel (Recommended - Easiest)

1. **Push code to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/3dcoster.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "New Project"
   - Import your `3dcoster` repository
   - Framework preset: Vite (auto-detected)
   - Click "Deploy"

3. **Custom Domain (Optional)**
   - In Vercel dashboard → Project Settings → Domains
   - Add your domain (e.g., `3dcoster.app`)
   - Update DNS records as instructed

#### Option B: Netlify

1. **Push code to GitHub** (same as above)

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com) and sign in with GitHub
   - Click "Add new site" → "Import an existing project"
   - Select your repository
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Click "Deploy"

#### Option C: GitHub Pages (Free, No Account Needed)

1. **Update vite.config.ts** - Add base path:
   ```ts
   export default defineConfig({
     base: '/3dcoster/',  // Must match repo name
     // ... rest of config
   })
   ```

2. **Create GitHub Actions workflow** at `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm ci
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

3. **Enable GitHub Pages**
   - Repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `gh-pages` / `/ (root)`

### Deploying Updates

**Automatic (Recommended):**
All three options auto-deploy when you push to `main`:
```bash
git add .
git commit -m "Add new feature"
git push origin main
# Deployment happens automatically in ~1-2 minutes
```

**Manual (Vercel CLI):**
```bash
npm run build
vercel --prod
```

### How Updates Reach Users

The PWA service worker handles this automatically:

1. User opens the app
2. Service worker checks for new version in background
3. If update found, downloads silently
4. Next time user opens app, they get the new version
5. No action required from the user

**Note:** For critical updates, you can modify `vite.config.ts` to prompt users:
```ts
VitePWA({
  registerType: 'prompt',  // Shows "Update available" notification
  // ...
})
```

### User Installation Flow

1. User visits your URL (e.g., `https://3dcoster.vercel.app`)
2. Chrome/Edge shows install icon in address bar
3. User clicks "Install"
4. App appears in Applications folder / Start Menu
5. Works offline, data persists in IndexedDB

---

## Current State (v1.0)

### Core Features
- Material cost calculation (filament by gram)
- Electricity cost calculation
- Printer depreciation with customizable recovery period
- Nozzle wear tracking
- Labor costs (prep + post-processing time)
- Failure rate adjustment
- Model/STL cost amortization
- Shipping cost calculation (local pickup, dropoff, carriers)
- Marketplace fee calculation (Etsy, Facebook, Kijiji)
- Break-even analysis with fixed vs per-unit cost separation
- Sales tracking with per-sale shipping/marketplace options
- Job management (create, edit, delete)
- Multiple printer support with individual tracking
- PWA support (installable, works offline)

---

## Priority Matrix

All features scored by **Impact (1-5)** / **Effort (1-5)** = **Priority Score**. Higher score = do first.

### DO NOW — High impact, low effort (Score 2.0+)

| # | Feature | Tier | Impact | Effort | Score | Why |
|---|---------|------|--------|--------|-------|-----|
| 1 | Tax/VAT on selling price | Free | 4 | 1 | 4.0 | Single field + multiply. Every seller needs this. |
| 2 | Quick duplicate job | Free | 4 | 1 | 4.0 | Clone button + prefill form. Huge time saver. |
| 3 | Customer details on quotes | Free | 3 | 1 | 3.0 | Add name/email/phone fields to job. Simple schema change. *Audit 2026-05-19: `Sale.customerName` already exists ([types.ts:184](src/types.ts:184)); remaining work = add email/phone and attach to `PrintJob`, not just Sale.* |
| 4 | Printer maintenance budget | Free | 3 | 1 | 3.0 | Single cost field per printer. Crosslink has it. *Audit 2026-05-19: alerts ship via [MaintenanceAlertModal.tsx](src/components/MaintenanceAlertModal.tsx); the service-cost field on `PrinterInstance` is the missing piece.* |
| 5 | Support material waste % | Free | 3 | 1 | 3.0 | Single percentage field. Quick win. |
| 7 | Bed adhesion consumables | Free | 2 | 1 | 2.0 | Add-on cost field. Trivial. |
| 8 | Empty states with CTAs | Free | 3 | 1.5 | 2.0 | Illustrations + copy for blank screens. Polish. |
| 9 | Inconsistent styling pass | Free | 3 | 1.5 | 2.0 | Already flagged by users. Use existing ui/ components. |
| 10 | Default profit margin setting | Free | 3 | 1 | 3.0 | Replace hardcoded 30% with user-configurable default. Currently set in CostCalculator.tsx:118. |
| 11 | Etsy ToS compliance helper | Free | 3 | 1 | 3.0 | Per-job origin/license field + third-party-STL flag + compliance attestation export. Time-sensitive after Etsy's June 2025 "original design only" rule. Pure whitespace — no competitor touches this. *(Source: SWOT, 2026-05-18)* |
| 12 | Schedule-C / COGS exporter | Free | 4 | 1.5 | 2.7 | IRS-shaped bookkeeper report (US Schedule C COGS) generated from existing sales + material consumption. Etsy/Craftybase forums asking for this weekly. We're the only tool with the underlying data. *(Source: SWOT, 2026-05-18)* |

### ✅ SHIPPED (was DO NEXT)

| Feature | Shipped | Evidence |
|---------|---------|----------|
| JSON full backup / restore — was #32 | 2026-06-12 (in `[Unreleased]`) | [backupExport.ts](src/utils/backupExport.ts) / [backupRestore.ts](src/utils/backupRestore.ts) / [BackupRestoreSection.tsx](src/components/BackupRestoreSection.tsx) — Settings → Data tab. Replace-all restore in one atomic transaction; whole-file validation with prototype-pollution rejection; explicit per-store Date rehydration (DATE_FIELDS); full reload after restore so boot reconciles re-run. Serialization layer doubles as the future cloud-sync foundation. |
| Export to CSV (jobs + sales + assets) — was #6 | 2026-06-12 (in `[Unreleased]`) | [jobsExport.ts](src/utils/jobsExport.ts) (`generateJobsExportCsv`, `generateSalesExportCsv`); assets export wired in [AssetLibrary.tsx](src/components/AssetLibrary.tsx). Exports respect active filter/search with record count on the button; snapshot currency preserved verbatim; formula-injection guarded via `sanitizeCsvCell`. XLSX deliberately skipped — CSV opens natively in Excel/Sheets/Numbers; SheetJS is heavy with licensing churn. |
| G-code import | v1.0 milestone | [gcodeParser.ts](src/utils/gcodeParser.ts), [GcodeImport.tsx](src/components/GcodeImport.tsx) — multi-slicer (Prusa, Bambu, Cura, IdeaMaker, OrcaSlicer, SuperSlicer) |
| Multi-material prints | v1.0 milestone | `PrintJob.filaments: FilamentUsage[]` ([types.ts:146](src/types.ts:146)); add/remove rows in [CostCalculator.tsx:89-99](src/components/CostCalculator.tsx:89) |
| Default profit margin setting | 2026-05-18 | UserProfile field + SettingsModal Pricing tab |

### DO NEXT — High impact, moderate effort (Score 1.0-1.9)

| # | Feature | Tier | Impact | Effort | Score | Why |
|---|---------|------|--------|--------|-------|-----|
| 13 | Printable/PDF quote | Free | 5 | 3 | 1.7 | Bridges calc → customer. Needs PDF lib (jsPDF). |
| 14 | Editable tags on saved jobs | Free | 3 | 2 | 1.5 | Max 6 tags/job. Drives filter + search in Jobs view. Schema field + tag editor UI + filter chips. |
| 15 | Multi-color/AMS purge waste | Free | 3 | 2 | 1.5 | Growing Bambu AMS user base. Moderate UI work. *Audit 2026-05-19: 3MF parser ingests multi-filament data but purge/flush volume isn't priced — confirmed outstanding.* |
| 16 | Dark mode | Free | 3 | 2 | 1.5 | Already dark-ish. Needs proper theming + toggle. *Audit 2026-05-19: no theme context, hardcoded slate-900; commented-out `// theme?:` in [types.ts:313](src/types.ts:313) suggests prior intent.* |
| 17 | Slicer bridge (Orca/Bambu) | Free | 4 | 3 | 1.3 | Post-process script for OrcaSlicer + Bambu Studio: one-click "send sliced job to 3DCoster" with time/weight pre-filled. Strategic hedge against slicer-native cost models. *(Source: SWOT, 2026-05-18)* |
| 18 | ROI calculator | Free | 4 | 3 | 1.3 | Unique — no competitor has this. New page + projection math. |
| 19 | Batch pricing | Free | 3 | 2.5 | 1.2 | Volume discount tiers. Moderate calc logic. |
| 20 | Material inventory tracking | Free | 3 | 2.5 | 1.2 | Stock levels, deduction on job, alerts. New data model. *Audit 2026-05-19: `Asset.unitsPerPackage`/`lifespanUnits` exist; remaining work = current stock + deduction + low-stock alerts.* |
| 21 | Skeleton loading states | Free | 2 | 2 | 1.0 | Component shells. Nice polish. |
| 22 | Performance optimization | Free | 3 | 3 | 1.0 | Bundle splitting, virtualization. *Audit 2026-05-19: route lazy-loading done ([main.tsx:10-15](src/main.tsx:10)); remaining = `manualChunks` in vite.config and list virtualization for jobs/assets.* |
| 23 | Unit tests for calcs | Free | 3 | 3 | 1.0 | Critical for confidence as features grow. *Audit 2026-05-19: vitest infra exists, one test ([threeMfParser.test.ts](src/utils/threeMfParser.test.ts)); remaining = tests for cost calculation logic in CostCalculator.* |
| 24 | Accounting CSV export | Free | 2 | 2 | 1.0 | QBO/Wave format. Niche but straightforward. (See #12 for Schedule-C specifically.) |
| 30 | Print troubleshooting helper | Free | 3 | 2 | 1.5 | Symptom → likely cause → fix (stringing, warping, layer shift, under-extrusion). Pure client-side knowledge base. Sticky + SEO. Pairs with #29. *(Source: Print3D Studios competitive analysis, 2026-06-08)* |
| 29 | Filament guide / comparison | Free | 3 | 2.5 | 1.2 | Per-material traits, temps, recommended settings, "which filament for this job" — built on the filament + density data we already own. Print3D's version is only ~46 entries; easy to out-depth. *(Source: Print3D Studios competitive analysis, 2026-06-08)* |
| 33 | PDF sales report | Free | 3 | 2.5 | 1.2 | Monthly/yearly sales summary as a designed PDF *document*: totals, revenue by marketplace, fees, profit. For tax records and loan applications. Explicitly NOT a format option on the CSV export buttons — CSV is data, PDF is a document; a format picker would add a decision to every export. Reuses the already-lazy-loaded jsPDF chunk. Pairs with #12 Schedule-C and #24 accounting export. *(Source: export-format UX review, 2026-06-12)* |

### DO LATER — High effort or niche impact (Score <1.0)

| # | Feature | Tier | Impact | Effort | Score | Why |
|---|---------|------|--------|--------|-------|-----|
| 25 | Resin/SLA support | Free | 4 | 4 | 1.0 | Entire new cost model. Different consumables, different math. |
| 26 | Historical analytics | Free | 4 | 4 | 1.0 | Time-series data, charts, new DB schema. Big project. |
| 27 | E2E tests | Free | 2 | 3 | 0.7 | Playwright/Cypress setup. Important but not user-facing. |
| 28 | STL file analysis | Free | 3 | 5 | 0.6 | Requires 3D geometry parsing in browser. Complex. |
| 31 | G-code analysis view | Free | 2 | 3 | 0.7 | Layer/toolpath/stat inspection on top of the existing G-code parser. We already parse for import; inspection is an extension but niche. *(Source: Print3D Studios competitive analysis, 2026-06-08)* |

### Free / Paid Line — Guiding Principle

> **Free for the person. Paid when the tool wears your brand to your customers, or works while you sleep.**

The core application — cost calculation, jobs, sales tracking, multi-printer fleet, all cost factors, records-keeping, tax compliance helpers, polish — stays free forever. Paid is reserved for four axes:

1. **White-label branding** on customer-facing outputs (free version always available with a small "Made with 3DCoster" footer)
2. **Hosted infrastructure** (cloud sync, embeddable widgets, shareable links, email delivery, customer portal)
3. **Live integrations** with marketplaces, accounting, printers (CSV exports stay free)
4. **Automation, AI, and multi-user** (workflow rules, photo-to-quote, team collaboration)

See "Paid Tiers" section near the bottom of this doc for the full tier breakdown. Reference: [Free/Paid line research, 2026-05-19](#).

#### Free/Pro feature model — "floor & ceiling" (decided 2026-06-12)

The split is **not two lists of features**. Every capability has a **free self-service floor** (you do it, runs locally on your data) and a **Pro ceiling** (the tool does it for you, on our infra, or wears your brand). **No capability is fully locked away — everyone gets a working version free; Pro removes the manual/local limits.** This monetizes without gutting the free wedge.

| Capability | Free floor (self-service, local) | Pro ceiling (automated / hosted / branded) |
|---|---|---|
| Quotes | PDF with "Made with 3DCoster" footer | White-label (logo, no footer), email delivery, customer portal |
| Inventory *(in dev)* | Manual stock, deduct-on-job, on-screen low-stock flag | Email/push low-stock alerts, auto-reorder, supplier sync, multi-location |
| Sales reports *(in dev)* | Generate + download PDF/CSV for any range | Scheduled auto-email, send-to-accountant, branded |
| Accounting | CSV export (Schedule-C / QBO-Wave) you file | Live QuickBooks/Wave API sync |
| Shipping | Manual carrier-rate calculator | Live rates + printable labels |
| Marketplace | Fee math + per-channel target pricing | Live order sync (auto-pulls Etsy orders) |
| Data portability | Backup / restore (shipped free) | Cloud sync / multi-device |

**Paid-only exceptions** (no meaningful free floor): AI photo-to-quote (compute cost — maybe N free trials), team/multi-user (multi-seat), live-API integrations (recurring cost + backend). Note backup/restore is the free floor *under* cloud sync — the pattern already works.

**Design rule (every free feature we build):** architect the floor so the Pro ceiling bolts on as an **additive layer, not a rewrite** — e.g. reports = `aggregate() -> render()` so scheduled/emailed/branded delivery wraps the same core; inventory = a stock model an alerts/reorder service can subscribe to later. Every free feature is then also a Pro foundation, and we never give away value we can't upsell on top of.

**Resolves the earlier free/paid question:** PDF sales report and material inventory tracking **ship free** (their floors); their automation/hosted layers become Pro hooks later. Still TBD: marketing *wording* (deferred), and whether any single floor is too generous (current lean: keep a free manual version of everything, including live-rate shipping).

> **⚠ OPEN QUESTION (raised 2026-06-12, unresolved):** The principle above keeps tax helpers, CSV exports, and sales tracking *free*. In conversation the founder voiced a sharper line — *"free for individuals, paid for business"* — which would move self-service business features (sales reports, tax/accounting exports, shop inventory) to paid. These two framings diverge, and sales tracking + the Jobs totals bar already shipped free, so the line needs sharpening, not just a slogan. **(SUPERSEDED 2026-06-12 by the Free/Pro floor/ceiling model above — PDF report + inventory ship free as floors; only marketing wording remains open. Original note kept for context.)**
>
> **Craftybase** ([craftybase.com](https://craftybase.com), maker inventory + bookkeeping, ~$19–59/mo) is the competitor benchmark for the **paid/business tier**, NOT for the free `/features` calculator comparison (apples-to-oranges — keep it off that table). Framing: free tier = "a better print calculator than Prusa/LayerMath/3DPrintForce"; paid tier = "a lighter, 3D-native alternative to Craftybase." Run a proper Craftybase analysis before positioning against it (we currently have ~none).

### PAID TIER BUILD ORDER

Build in phases. Each phase unlocks the next. P1 = highest-leverage paywall + foundation.

| Phase | Feature | Tier | Axis | Notes |
|-------|---------|------|------|-------|
| **P1** | White-label PDF quotes | Pro | Branding | The Stimalo line. Peak willingness-to-pay moment. Free PDF stays available with footer. |
| **P1** | Cloud sync (Supabase) | Pro | Hosted infra | Foundation for any cross-device or hosted feature. |
| **P1** | Email delivery of quotes | Pro | Hosted infra | Our SMTP sends on user's behalf. |
| **P2** | Shareable hosted quote links | Pro | Hosted + branding | Public URL with cost breakdown view. |
| **P2** | Slicer bridge (Orca/Bambu, if backend-required) | Pro | Automation | Falls to FREE if a pure client-side post-process script suffices. |
| **P3** | Embeddable customer quote widget | Biz | Hosted + branding | KEY DIFFERENTIATOR. Tied to user's real calcs. |
| **P3** | Order mgmt with Etsy/Shopify/Square sync | Biz | Live integration | Live API sync. |
| **P3** | Live accounting sync (Xero/QuickBooks) | Biz | Live integration | CSV/Schedule-C export stays free. |
| **P4** | Customer portal | Biz | Hosted + branding | Branded order tracking page. |
| **P4** | Customer self-serve quoting & booking | Biz | Hosted + customer-facing | Public intake form on our infra. |
| **P4** | AI photo-to-quote | Biz | AI inference | GPU cost recovery. |
| **P5** | Printer integration & monitoring | Ent | Live integration | Real-time fleet status. |
| **P5** | Workflow automation (When/Then) | Ent | Automation | Background rule engine. |
| **P5** | Team collaboration (roles, mentions) | Ent | Multi-user | Multi-user requires backend. |
| **P6** | API access + webhooks | Ent | Infra exposure | REST + webhooks. |
| **P5** | Sync health dashboard | Biz | 2 | 2 | 1.0 | Status indicators, logs. Important for trust. |
| **P5** | Accounting integration | Biz | 3 | 4 | 0.8 | QuickBooks/Xero APIs. Ongoing maintenance cost. |
| **P6** | Printer monitoring | Ent | 4 | 5 | 0.8 | Hardware integration. Very complex. |
| **P6** | Workflow automation | Ent | 4 | 5 | 0.8 | Visual "When/Then" builder. High effort, high wow. |
| **P6** | Team collaboration | Ent | 3 | 4 | 0.8 | Multi-user, roles, comments. Needs auth system. |
| **P7** | Calendar/scheduling | Ent | 3 | 3 | 1.0 | Calendar view + conflict detection. |
| **P7** | AI features | Ent | 3 | 5 | 0.6 | ML models. Needs significant historical data first. |
| **P7** | API access | Ent | 2 | 3 | 0.7 | REST API + docs. Niche audience. |

---

## Priority 1: Historical Analytics & Predictive Algorithms

### Data to Track Over Time
- **Cost Changes**
  - Gas price history (for dropoff calculations)
  - Electricity rate changes
  - Filament price fluctuations by brand/type
  - Shipping carrier rate changes (UPS, FedEx, Purolator, USPS)

- **Sales Patterns**
  - Sales by day of week
  - Sales by time of year (holiday seasons, back-to-school, etc.)
  - Sales by marketplace
  - Sales by product category/type
  - Customer repeat rate

- **Operational Metrics**
  - Print success/failure rate trends
  - Time between prints
  - Printer utilization rates
  - Material consumption velocity

### Predictive Features
- **Busy period detection**: Identify seasonal trends and notify when to stock up
- **Price optimization**: Suggest pricing based on historical sell-through rates
- **Cost forecasting**: Project future costs based on trends
- **Inventory alerts**: Predict when to reorder filament based on usage patterns
- **Break-even projections**: Estimate time to break-even based on sales velocity

### Visualization
- Dashboard with charts (cost trends, sales over time)
- Profit/loss timeline
- Marketplace performance comparison
- Printer ROI tracking

---

## Free Tier Backlog (Open Source)

These features enhance the core cost calculator and remain free forever.

### Data Import/Export
- [ ] **Export to CSV/Excel** - Export job history, sales, and calculations
- [ ] **Import from slicer (G-code)** - Parse G-code for print time and filament weight estimates. Nearly every competitor supports this. *(Source: Competitor research, Feb 2026)*
- [ ] **STL file analysis** - Auto-extract volume for cost estimation (complex)

### Additional Cost Factors
- [ ] **Printer maintenance/service budget** - Separate line item for general maintenance costs (belt replacement, lubrication, cleaning supplies, etc.) beyond nozzle wear. Crosslink tracks this as a flat "Service costs" field per printer. *(Source: Crosslink Sheet, Feb 2026)*
- [ ] **Support material waste %** - Configurable waste factor for support structures
- [ ] **Bed adhesion consumables** - Quick-add for glue sticks, tape, etc.
- [ ] **Multi-material prints** - Support for prints using multiple filaments
- [ ] **Resin printing support** - Different cost model for SLA/MSLA printers (ml-based pricing, resin tank lifespan, FEP replacement, UV curing electricity). High priority — large segment of the market currently unsupported. *(Source: Competitor research, Feb 2026)*
- [ ] **Multi-color/AMS purge waste** - Calculate purge tower waste for multi-color prints (Bambu AMS, Prusa MMU). Growing use case with AMS popularity. *(Source: Competitor research, Feb 2026)*
- [ ] **Tax/VAT on selling price** - Add configurable sales tax or VAT percentage to final pricing. Common feature in competitors. *(Source: Competitor research, Feb 2026)*

### UX Improvements
- [ ] **Quick duplicate job** - Clone existing job with modifications
- [ ] **Batch pricing** - Discount calculations for volume orders
- [ ] **Customer details on quotes** - Attach customer name/contact info to individual print jobs for quoting purposes. Crosslink includes customer name, address, email per quote. *(Source: Crosslink Sheet, Feb 2026)*
- [ ] **Printable/PDF quote** - Generate a professional PDF quote from any job calculation to share with customers. High priority — closes the gap between calculating a cost and communicating it. *(Source: Competitor research, Feb 2026)*
- [ ] **ROI calculator** - "Should I buy this printer?" analysis: compare expected revenue vs purchase + operating costs over time. Unique feature — no competitor offers this. *(Source: Competitor research, Feb 2026)*
- [ ] **Dark mode** - First-class dark theme (not just inverted colors). Signals premium, modern tool. *(Source: UX research, Feb 2026)*
- [ ] **Empty states with CTAs** - Every blank screen should guide users (illustration + action + brief explanation). *(Source: UX research, Feb 2026)*
- [ ] **Skeleton loading states** - Show content structure while loading for perceived speed. *(Source: UX research, Feb 2026)*
- [ ] **Default profit margin setting** - User-configurable default profit margin % for new jobs (currently hardcoded to 30% in CostCalculator.tsx). Open questions: global vs per-printer scope, apply to existing jobs or new only, where to expose the setting. *(Discussion needed before implementation)*
- [ ] **Editable tags on saved jobs** - Free-text tags (max 6 per job) to drive filter + search in the Jobs view. Schema: `tags: string[]` on PrintJob. UI: chip editor on job detail + filter chip bar above the jobs list. *(User-requested, 2026-05-18)*
- [ ] **Etsy ToS compliance helper** - Per-job origin/license field (own design / licensed / third-party STL), compliance attestation export. Time-sensitive after Etsy's June 2025 "original design only" rule. No competitor touches this. *(Source: SWOT, 2026-05-18)*
- [ ] **Slicer bridge (Orca/Bambu)** - Post-process script for OrcaSlicer + Bambu Studio that pushes weight/time/filament selection to 3DCoster as a pre-filled new job. Hedge against slicer-native cost math. Multi-year unmet request on Bambu forums. *(Source: SWOT, 2026-05-18)*

### Material & Inventory (Free Tier)
- [ ] **Material inventory tracking** - Track filament stock levels with low-stock alerts. Predict reorder timing based on usage velocity. *(Source: Competitor research, Feb 2026)*

### Knowledge & Guidance (Free Tier)

Closes in-lane gaps vs Print3D Studios while staying "for the person." Best shipped as a paired "Knowledge" surface — highest-fit, highest-SEO of the competitor gaps. *(Source: Print3D Studios competitive analysis, 2026-06-08)*

- [ ] **Filament guide / comparison** - Per-material traits, print temps, recommended settings, pros/cons, and "which filament for this job." Built on the filament + density data already in the app. Print3D's guide is ~46 filaments; our Bambu catalog alone is 39 with full pricing — we can out-depth it easily.
- [ ] **Print troubleshooting helper** - Symptom → likely cause → fix knowledge base (stringing, warping, layer shift, under-extrusion, adhesion). Pure client-side, no backend. Sticky and SEO-friendly; pairs naturally with the filament guide and the content blog.
- [ ] **G-code analysis view** - Layer/toolpath/stat inspection on top of the existing G-code parser. Lower priority (niche) — we already parse G-code for import; this surfaces it.

> **Out of scope (don't chase):** cloud slicer, file converters (SVG/DXF/STL→STEP), model/file library. Off-moat commodity utilities; file storage would also force a hosted/paid surface for no strategic gain. *(Print3D Studios competitive analysis, 2026-06-08)*

### Integrations (Free Tier)
- [ ] **Slicer integration** - Pull data from PrusaSlicer, Bambu Studio, Cura
- [ ] **Accounting export** - QuickBooks/Wave compatible CSV exports
- [ ] **Schedule-C / COGS exporter** - US-tax-specific report from existing sales + material consumption. IRS Schedule C line-item shape, bookkeeper-friendly CSV. Distinct from QBO/Wave export (which is system-integration; this is tax-prep). *(Source: SWOT, 2026-05-18)*

---

## Competitor Comparison Reference

### Cost Calculators (Free Tier Competitors)

| Feature | 3DCoster | Crosslink | Omni | Prusa | Fabbaloo | MakerShop | Xometry |
|---------|----------|-----------|------|-------|----------|-----------|---------|
| Material cost | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Electricity | ✅ | ✅ | ✅ | - | ✅ | - | - |
| Depreciation | ✅ | ✅ | - | - | ✅ | ✅ | - |
| Nozzle wear | ✅ | - | - | ✅ | - | - | - |
| Labor/time | ✅ | ✅ | ✅ | - | - | ✅ | - |
| Failure rate | ✅ | ✅ | - | - | - | - | - |
| Post-processing | ✅ | ✅ | - | ✅ | - | ✅ | - |
| Model cost | ✅ | - | - | - | - | - | - |
| Shipping | ✅ | ✅ (flat) | - | - | - | - | - |
| Marketplace fees | ✅ | - | - | - | - | - | - |
| Break-even | ✅ | - | - | - | - | - | - |
| Sales tracking | ✅ | - | - | - | - | - | - |
| Multi-printer | ✅ | - | - | - | - | ✅ | - |
| Multi-currency | ✅ (18) | EUR only | - | - | - | - | - |
| Customer on quote | - | ✅ | - | - | - | - | - |
| Maintenance budget | - | ✅ | - | - | - | - | - |
| Material density | ✅ | ✅ | - | - | - | - | - |
| Resin/SLA support | - | - | - | - | - | - | ✅ |
| G-code import | - | - | - | - | - | - | - |
| Tax/VAT | - | - | - | - | - | - | - |
| PDF quote | - | - | - | - | - | - | - |
| STL upload | - | - | - | - | - | ✅ | ✅ |
| Excel export | - | N/A | - | - | - | - | ✅ |
| Offline/PWA | ✅ | N/A | - | - | - | - | - |

### Business/ERP Platforms (Paid Tier Competitors)

| Feature | 3DCoster (planned) | SimplyPrint | 3DPrinterOS | Layers.app | DigiFabster | MTNEARZ |
|---------|-------------------|-------------|-------------|------------|-------------|---------|
| Cost calculation | ✅ (core) | Basic | Basic | - | ✅ | - (manual) |
| Order management | Planned | ✅ | ✅ | ✅ | ✅ | ✅ |
| Customer portal | Planned | - | - | ✅ | ✅ | - |
| Printer monitoring | Planned | ✅ | ✅ | - | - | - |
| Quote widget | Planned | - | - | - | ✅ | - |
| Invoicing | Planned | - | - | ✅ | ✅ | - |
| Marketplace sync | Planned | - | - | - | - | ✅ (Square) |
| Expense tracking | Planned | - | - | - | - | ✅ |
| Workflow automation | Planned | ✅ | - | - | - | - |
| COGS from real calcs | ✅ (unique) | - | - | - | - | - |
| Multi-currency | ✅ (18) | - | - | - | ✅ | - |
| Offline support | ✅ | - | - | - | - | - |

### Key Analyses

**Crosslink (Feb 2026)**: Single-user EUR-only Google Sheets quoting tool. 3DCoster covers everything it does plus significantly more (marketplace fees, break-even, multi-currency, multi-printer instances, nozzle wear, model licensing, packaging materials). Two gaps (maintenance budget, customer on quote) tracked in free tier backlog.

**Market Landscape (Feb 2026)**: 92 startups in 3D print management software (26 funded, 12 at Series A+). Most focus on printer management, not business management. Few have modern UX. Client portals are basic or nonexistent. The biggest gap is UX, not features — winning on design is a viable strategy. *(Source: Tracxn, competitor research)*

**3DCoster's Unique Position**: No competitor starts from cost calculation and builds up. Everyone else starts from printer management (SimplyPrint, 3DPrinterOS) or order management (Layers, MTNEARZ). 3DCoster can offer quotes and invoices powered by REAL calculated costs — a defensible differentiator.

**Print3D Studios (2026-06-08)**: Cloud-first "maker workspace + community + content + affiliate" ecosystem (12-surface feature stack, account-required). Breadth-first where we're depth-first. Their calculator is a subset of ours; their own social-proof numbers ("9+ models," "46+ filaments") reveal a mile-wide, inch-deep, early-stage product, and the whole product is behind a login wall (depth unverifiable; Order Management still "coming soon"). They are *ahead* of us on **go-to-market** — community (Discord), SEO content/blog, and affiliate-shop monetization — not on product depth. Three in-lane feature gaps worth closing (filament guide, troubleshooting helper, G-code analysis view, all Free). Off-moat features to ignore (cloud slicer, file converters, model library). Our paid differentiators (marketplace sync, real-cost quote widget, accounting, white-label) remain uncontested by this competitor. Full writeup: [docs/superpowers/ideas/2026-06-08-print3dstudios-competitive-analysis.md](superpowers/ideas/2026-06-08-print3dstudios-competitive-analysis.md).

---

## Growth / Go-To-Market

> The biggest gap vs Print3D Studios is **not features — it's that they have a growth engine and we don't.** Our product is deeper; our go-to-market is thinner. These levers narrow the *perceived* gap and (for the affiliate shop) fund the free tier without a paywall. *(Source: Print3D Studios competitive analysis, 2026-06-08)*

| Lever | Effort | Why it matters | Notes |
|-------|--------|----------------|-------|
| **Community (Discord)** | Low | A moat + acquisition + retention flywheel we completely lack; competitors lead with it | Start a Discord, link from app footer + landing; seed with changelog + feedback |
| **Content / SEO blog** | Med (ongoing) | How makers *find* tools like this; we're invisible beyond `/changelog` | Maker guides (pricing, filament choice, troubleshooting) — feeds the free Knowledge features |
| **Affiliate shop** | Low | **No-paywall revenue** that funds the free tier; ties to the filament library ("recommended filament/printers"); we currently have zero revenue | Near-term revenue experiment — independent of the paid-tier backend buildout |

**Landing-page polish** (marketing surface only — the app is fine): bigger/bolder hero type, segment-based "choose your path" (sellers / beginners / fleets), visible social proof, a live dashboard data-viz mockup. *(Source: Print3D Studios competitive analysis, 2026-06-08)*

---

## Technical Debt & Maintenance
- [ ] Add unit tests for cost calculations
- [ ] Add E2E tests for critical flows
- [ ] Performance optimization for large job lists
- [ ] Database migration strategy for schema changes

---

## User Feedback (v1.1)

### Positive
- Users love the printer cost recovery feature

### Issues Reported
- [x] **Mobile view is horrible** - fixed in v1.1.2 (hamburger menu, scrollable tabs, card views, touch targets, iOS zoom prevention)
- [ ] **Inconsistent styling** - elements vary across the app, needs styling pass
- [ ] **Performance optimization needed** - app needs optimization pass

---

## UI/UX Improvement Plan

### Research Summary (2025-2026 Best Practices)

Based on research from [UXPin](https://www.uxpin.com/studio/blog/responsive-design-best-practices/), [UIDesignz](https://uidesignz.com/blogs/mobile-ui-design-best-practices), [SPDLoad](https://spdload.com/blog/mobile-app-ui-ux-design-trends/), and [F9 Finance](https://www.f9finance.com/dashboard-design-best-practices/):

#### Mobile-First Principles
1. **Start at 320px** - Design for smallest viewport first, scale up
2. **Touch targets minimum 44-48px** - Apple recommends 44x44, Google 48x48
3. **Thumb-friendly zones** - Critical actions within easy thumb reach
4. **Bottom navigation** - Move key actions to bottom bar on mobile
5. **Progressive disclosure** - Show only what's necessary, reveal on demand

#### Layout & Visual Hierarchy
1. **Card-based layouts** - Consistent treatment for all data modules
2. **KPIs top-left** - Eye naturally starts there
3. **3-5 color palette max** - 1 primary, 1-2 secondary, 1 accent, neutrals
4. **Consistent spacing system** - Don't mix p-4 and p-6 randomly
5. **Clear visual hierarchy** - Font sizes/weights guide attention

#### Financial/Calculator Dashboard Patterns
1. **Summary cards as entry points** - Click to expand/drill down
2. **Filters for dimensions** - Date range, category, printer, etc.
3. **Line charts for trends** - Keep simple, label axes, no 3D
4. **Color-coded status** - At-a-glance understanding
5. **Skeleton screens** - Show structure while loading

#### Component Consistency
1. **Input fields** - Same height, padding, border radius everywhere
2. **Buttons** - Primary, secondary, ghost variants defined once
3. **Cards** - Consistent title position, padding, shadows
4. **Spacing scale** - Use Tailwind's scale consistently (4, 6, 8, not random)

### Implementation Priorities

#### Phase 1: Site Structure & Navigation
- [ ] **Add site footer** with links to:
  - FAQs
  - Roadmap / What's New
  - Knowledge Base / Help
  - Privacy Policy / Terms
  - Version number
  - Social links (GitHub, Discord?)
- [ ] Create placeholder pages for footer links
- [ ] Consider help/support modal or page

#### Phase 2: Design System Consistency
- [ ] Define color palette tokens (primary, secondary, accent, semantic)
- [ ] Create consistent input component styles
- [ ] Standardize button variants (primary, secondary, ghost, danger)
- [ ] Define card component with consistent padding/shadows
- [ ] Create consistent section headers

#### Phase 3: Dashboard Improvements
- [ ] Add skeleton loading states
- [ ] Implement collapsible sections for mobile
- [ ] Add summary cards with drill-down capability
- [ ] Improve data visualization (charts for trends)

#### Phase 4: Performance Optimization
- [ ] Lazy load heavy components
- [ ] Implement virtualization for long lists (jobs, assets)
- [ ] Code-split by route/tab
- [ ] Optimize bundle size (currently 514KB, target <300KB)
- [ ] Add loading states and skeleton screens

#### Phase 5: Mobile Responsiveness
- [ ] Audit all components for mobile breakpoints
- [ ] Add `flex-col sm:flex-row` patterns for stacked layouts
- [ ] Implement bottom navigation for mobile
- [ ] Ensure touch targets are 44px minimum
- [ ] Test on actual devices (iPhone SE, iPhone 14, iPad)

### Recommended Component Libraries

For consistent, accessible Tailwind components:
- **[Flowbite](https://flowbite.com/)** - Free, MIT licensed, good mobile patterns
- **[Tailwind Plus](https://tailwindcss.com/plus)** - Official Tailwind components (paid)
- **[Uiverse](https://uiverse.io/cards)** - Open-source card gallery
- **[TW Elements](https://tw-elements.com/)** - Free Bootstrap-like components

### Key Breakpoints (Tailwind)
```
sm: 640px   // Landscape phones, small tablets
md: 768px   // Tablets
lg: 1024px  // Small laptops
xl: 1280px  // Desktops
2xl: 1536px // Large screens
```

### Mobile-First Class Pattern
```tsx
// Stack on mobile, row on tablet+
className="flex flex-col sm:flex-row"

// Full width on mobile, half on tablet+
className="w-full md:w-1/2"

// Hide on mobile, show on desktop
className="hidden lg:block"

// Padding that scales
className="p-4 md:p-6 lg:p-8"
```

---

## Paid Tiers: Business Management Platform

### Guiding Principle

**Free for the person. Paid when the tool wears your brand to your customers, or works while you sleep.**

The core application is free forever — calculator, jobs, sales tracking, multi-printer fleet, all cost factors, records-keeping, tax compliance helpers, dark mode, polish. Every future improvement to the calculator itself is free.

The four axes that warrant a paid tier:

1. **White-label branding** — your logo and colors on outputs that go to your customers (PDF quotes, hosted quote links, customer portal). Free users get the same outputs with a small "Made with 3DCoster" footer. *This is the highest-leverage paywall — sellers are at peak willingness-to-pay when sending a quote to a customer, and the footer is organic marketing.*
2. **Hosted infrastructure** — cloud sync, embeddable widgets, shareable URLs, email delivery, customer portal. Anything that runs on our servers and incurs ongoing cost.
3. **Live integrations** — real API connections to marketplaces (Etsy / Shopify / Square), accounting (Xero / QuickBooks), printers (network monitoring). CSV exports stay free.
4. **Automation, AI, and multi-user** — work done in the background (workflow rules, monitoring), AI inference (photo-to-quote, forecasting), team collaboration (multi-user roles).

*(Source: Free/Paid line research 2026-05-19 — Stimalo, Printforge, Obsidian, Cal.com, Tailscale all converge on this principle.)*

### Strategic Positioning

**Key competitive insight**: No competitor starts from cost calculation and builds up into business management. Everyone else starts from printer management or order management. 3DCoster's unique position is that quotes and invoices can be powered by REAL calculated costs — nobody else does this. This is a defensible differentiator.

**Target market gap**: The "Small 3D Printing Business" segment (1-25 printers, $1K-$50K/mo revenue, selling on Etsy/Shopify/local) is significantly underserved. Enterprise tools (AMFG, Materialise) are too expensive and complex. Spreadsheets and free calculators don't scale. *(Source: ERP competitor research, Feb 2026)*

**Pricing benchmark**: Stimalo (closest analog) is €5.99/mo for white-label PDFs + analytics. Printforge starts $9 AUD/mo. DigiFabster starts $49/mo. We can sit at the lower end ($5-9/mo Pro) because the core stays free — Pro is pure professional polish.

**Context**: User feedback (Ken Pauley, Jan 2026) suggested integrating full order management similar to his "MTNEARZ Business Manager" tool. Market research (Feb 2026) confirmed this gap across 15+ competitors including SimplyPrint, 3DPrinterOS, AstroPrint, Layers.app, DigiFabster, and Phasio.

---

### Pro Tier (~$5-9/month)
*Target: Individual makers who want to look professional to their customers.*

- **White-label PDF quotes**
  - Your logo, business name, and colors in the header
  - Removes the "Made with 3DCoster" footer
  - The first natural paywall: peak willingness-to-pay at the moment of sending a quote

- **Cloud sync & multi-device**
  - Sync jobs, settings, assets, and history across web + desktop
  - Automatic backups
  - Requires backend (Supabase)

- **Email delivery of quotes**
  - Send PDF quotes directly from 3DCoster via our SMTP
  - Customer reply-to your email
  - Optional: sent / opened tracking

- **Shareable hosted quote links**
  - Public URL (e.g. `quotes.3dcoster.app/<your-shop>/q/123`)
  - Interactive cost breakdown view in browser
  - Lighter than PDF; better for revisions and accept/decline workflows

---

### Business Tier (~$19-29/month)
*Target: Active sellers integrating with marketplaces and operating customer-facing.*

- **Embeddable Customer Quote Widget** (KEY DIFFERENTIATOR)
  - Embed on your own website (Shopify / Wix / Squarespace / static)
  - Customer selects material, size, quantity → instant quote powered by your real cost model
  - No competitor offers this — quotes tied to actual calculated costs *(Source: ERP competitor research, Feb 2026)*

- **Order Management with marketplace sync**
  - Live API sync with Square, Shopify, Etsy
  - Status pipeline (Open → Printing → Shipped → Delivered → Paid)
  - Deep link back to source platform *(Source: MTNEARZ screenshots, Feb 2026)*
  - Kanban board view for order pipeline *(Source: UX research, Feb 2026)*
  - Product catalog sync (Square/Shopify) with 3DCoster job linkage

- **Live Accounting Integration**
  - QuickBooks / Xero / Wave live sync
  - Auto-categorized expenses, tax-ready reporting
  - (Note: free CSV/Schedule-C exports remain available — this tier adds live API sync.)

- **Customer Portal**
  - Branded client-facing order tracking page
  - Visual progress: Order Placed → Printing → Post-Processing → Ready
  - Customer self-serve order lookup by ID/email *(Source: UX research, Feb 2026)*

- **Customer Self-Serve Quoting & Booking**
  - Public intake page on our infra
  - Customer requests quote without an account
  - Calendly-style pickup/dropoff booking with conflict detection
  - Buffer time between jobs for bed prep

- **AI Photo-to-Quote**
  - Customer sends a photo of what they want
  - Vision model estimates weight / time / material
  - Auto-priced through your cost model
  - GPU inference cost recovery

- **Fulfillment**
  - Carrier API integration (label printing, tracking numbers)
  - Fulfillment state machine separate from order status (Proposed → Shipped → Delivered) *(Source: MTNEARZ screenshots, Feb 2026)*

- **Sync & Integration Health Dashboard** *(Source: MTNEARZ screenshots, Feb 2026)*
  - API connection status indicators
  - Last sync timestamp + record count
  - Sync audit log / history

---

### Enterprise Tier (~$99+/month)
*Target: Print farms and service bureaus with 10+ printers and staff.*

- **Printer Integration & Monitoring**
  - Real-time printer status in dashboard
  - Auto-capture print time from network-connected printers
  - Algorithmic job routing to available printers
  - Gantt-view print queue management *(Source: UX research, Feb 2026)*

- **Workflow Automation**
  - Visual "When/Then" rule builder (no code)
  - Example: "When order status → Printing, email customer"
  - Template automations + automation history log *(Source: UX research, Feb 2026)*

- **Team Collaboration**
  - Multi-user access with roles (Owner / Operator / Sales)
  - @mentions and threaded comments on jobs
  - Activity feed per job (who changed what, when)
  - Handoff notes between workflow stages *(Source: UX research, Feb 2026)*

- **API Access**
  - REST API for custom integrations
  - Webhook support for external automation

---

### What's NOT paid (clarifying the line)

Earlier drafts of this roadmap labeled the following as Pro tier features. Under the 2026-05-19 free/paid line revision, **all of these are now FREE** because they are "for the person":

- **Customer details on a job** (name, email, phone) — records-keeping, not a CRM
- **Job history + search + filters** — your own data, local
- **Templates & presets** — your own patterns and shortcuts
- **Expense tracking** — your own bookkeeping (distinct from live accounting sync)
- **Local KPI dashboard / cost trends over time** — your own data, no external surface
- **Schedule-C / COGS exporter + accounting CSV** — personal tax compliance
- **Material inventory tracking** — records of what you have
- **PDF quote with "Made with 3DCoster" footer** — basic professional output for everyone
- **Etsy ToS compliance helper** — personal compliance, time-sensitive
- **ROI calculator, historical analytics, dark mode, polish** — calculator + UX improvements stay free per the public promise
- **All cost-model enhancements** (resin/SLA, AMS purge waste, support waste %, bed adhesion, etc.) — the calculator itself is free forever

---

### Why Paid Tiers
- Ongoing infrastructure cost (cloud sync, hosted widgets, email delivery)
- Third-party API maintenance (Etsy / Shopify / Square / Xero / QBO change frequently)
- AI inference costs (vision model, forecasting)
- Support cost for business-critical workflows

### Implementation Notes
- Free tier remains 100% local-first / offline-capable. Building a paid tier never compromises the free experience.
- Paid features require a backend — Supabase planned (auth + Postgres + edge functions)
- Build order: P1 (white-label PDF + cloud sync + email delivery) is the highest-leverage starting point — solo makers paying for professional polish, single SKU
- Mobile experience becomes critical at Business tier (customer portal, quote widget)
- Validate Pro tier demand before building Business tier infrastructure

---

## Developer Documentation

For development workflow, release process, UI components, and technical details, see:
**`.claude/CLAUDE.md`**
