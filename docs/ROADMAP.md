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
| 3 | Customer details on quotes | Free | 3 | 1 | 3.0 | Add name/email/phone fields to job. Simple schema change. |
| 4 | Printer maintenance budget | Free | 3 | 1 | 3.0 | Single cost field per printer. Crosslink has it. |
| 5 | Support material waste % | Free | 3 | 1 | 3.0 | Single percentage field. Quick win. |
| 6 | Export to CSV/Excel | Free | 4 | 1.5 | 2.7 | JSON→CSV conversion. Users have asked. |
| 7 | Bed adhesion consumables | Free | 2 | 1 | 2.0 | Add-on cost field. Trivial. |
| 8 | Empty states with CTAs | Free | 3 | 1.5 | 2.0 | Illustrations + copy for blank screens. Polish. |
| 9 | Inconsistent styling pass | Free | 3 | 1.5 | 2.0 | Already flagged by users. Use existing ui/ components. |

### DO NEXT — High impact, moderate effort (Score 1.0-1.9)

| # | Feature | Tier | Impact | Effort | Score | Why |
|---|---------|------|--------|--------|-------|-----|
| 10 | Printable/PDF quote | Free | 5 | 3 | 1.7 | Bridges calc → customer. Needs PDF lib (jsPDF). |
| 11 | Multi-color/AMS purge waste | Free | 3 | 2 | 1.5 | Growing Bambu AMS user base. Moderate UI work. |
| 12 | Dark mode | Free | 3 | 2 | 1.5 | Already dark-ish. Needs proper theming + toggle. |
| 13 | ROI calculator | Free | 4 | 3 | 1.3 | Unique — no competitor has this. New page + projection math. |
| 14 | G-code import | Free | 4 | 3 | 1.3 | Parse text file for time/weight. Moderate parsing work. |
| 15 | Multi-material prints | Free | 3 | 2.5 | 1.2 | UI for multiple materials per job. Schema change. |
| 16 | Batch pricing | Free | 3 | 2.5 | 1.2 | Volume discount tiers. Moderate calc logic. |
| 17 | Material inventory tracking | Free | 3 | 2.5 | 1.2 | Stock levels, deduction on job, alerts. New data model. |
| 18 | Skeleton loading states | Free | 2 | 2 | 1.0 | Component shells. Nice polish. |
| 19 | Performance optimization | Free | 3 | 3 | 1.0 | Bundle splitting, lazy loading, virtualization. |
| 20 | Unit tests for calcs | Free | 3 | 3 | 1.0 | Critical for confidence as features grow. |
| 21 | Accounting CSV export | Free | 2 | 2 | 1.0 | QBO/Wave format. Niche but straightforward. |

### DO LATER — High effort or niche impact (Score <1.0)

| # | Feature | Tier | Impact | Effort | Score | Why |
|---|---------|------|--------|--------|-------|-----|
| 22 | Resin/SLA support | Free | 4 | 4 | 1.0 | Entire new cost model. Different consumables, different math. |
| 23 | Historical analytics | Free | 4 | 4 | 1.0 | Time-series data, charts, new DB schema. Big project. |
| 24 | Slicer integration | Free | 3 | 4 | 0.8 | Multiple slicer formats. Plugin/API work. |
| 25 | E2E tests | Free | 2 | 3 | 0.7 | Playwright/Cypress setup. Important but not user-facing. |
| 26 | STL file analysis | Free | 3 | 5 | 0.6 | Requires 3D geometry parsing in browser. Complex. |

### PAID TIER BUILD ORDER

Build in phases. Each phase unlocks the next. Phase 1 is the foundation everything else depends on.

| Phase | Feature | Tier | Impact | Effort | Score | Notes |
|-------|---------|------|--------|--------|-------|-------|
| **P1** | Cloud sync (Supabase) | Pro | 5 | 4 | 1.3 | Foundation for ALL paid features. Build first. |
| **P1** | Customer management | Pro | 4 | 2 | 2.0 | DB + CRUD. Natural extension of quote details. |
| **P1** | Job history + search | Pro | 4 | 2 | 2.0 | Already have jobs. Add persistence + filters. |
| **P2** | PDF invoicing (branded) | Pro | 4 | 3 | 1.3 | Extends free PDF quote with branding + numbering. |
| **P2** | Templates & presets | Pro | 3 | 2 | 1.5 | Save/load job configs. Good retention driver. |
| **P2** | Basic KPI dashboard | Pro | 4 | 3 | 1.3 | Revenue, margins, volume cards. First "wow" moment. |
| **P3** | Embeddable quote widget | Biz | 5 | 4 | 1.3 | KEY DIFFERENTIATOR. iframe/embed + API. |
| **P3** | Order mgmt (Etsy/Shopify) | Biz | 5 | 5 | 1.0 | API integrations. Complex but high value. |
| **P3** | Expense tracking | Biz | 3 | 2 | 1.5 | Categories + entries. Relatively simple. |
| **P4** | Financials per order | Biz | 4 | 3 | 1.3 | COGS from calcs. Auto-populate margins. |
| **P4** | Customer portal | Biz | 4 | 4 | 1.0 | Separate public-facing app. High effort, high wow. |
| **P4** | Fulfillment tracking | Biz | 3 | 3 | 1.0 | State machine + carrier integration. |
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

### Material & Inventory (Free Tier)
- [ ] **Material inventory tracking** - Track filament stock levels with low-stock alerts. Predict reorder timing based on usage velocity. *(Source: Competitor research, Feb 2026)*

### Integrations (Free Tier)
- [ ] **Slicer integration** - Pull data from PrusaSlicer, Bambu Studio, Cura
- [ ] **Accounting export** - QuickBooks/Wave compatible CSV exports

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

### Strategic Positioning

**Key competitive insight**: No competitor starts from cost calculation and builds up into business management. Everyone else starts from printer management or order management. 3DCoster's unique position is that quotes and invoices can be powered by REAL calculated costs — nobody else does this. This is a defensible differentiator.

**Target market gap**: The "Small 3D Printing Business" segment (1-25 printers, $1K-$50K/mo revenue, selling on Etsy/Shopify/local) is significantly underserved. Enterprise tools (AMFG, Materialise) are too expensive and complex. Spreadsheets and free calculators don't scale. *(Source: ERP competitor research, Feb 2026)*

**Context**: User feedback (Ken Pauley, Jan 2026) suggested integrating full order management functionality similar to his "MTNEARZ Business Manager" tool. Market research (Feb 2026) confirmed this gap across 15+ competitors including SimplyPrint, 3DPrinterOS, AstroPrint, Layers.app, DigiFabster, and Phasio.

---

### Pro Tier (~$9-15/month)
*Target: Hobby sellers doing 10-50 orders/month who've outgrown spreadsheets.*

- **Cloud Sync & Multi-Device**
  - Sync job data, settings, and history across devices
  - Automatic backups
  - Requires backend (Supabase or similar)

- **Customer Management**
  - Customer database with contact info, order history, notes
  - Repeat customer tracking and lifetime value
  - Customer details attached to quotes *(Source: Crosslink Sheet, Feb 2026)*

- **Job History & Analytics**
  - Searchable job history with filters
  - Cost trends over time (material prices, electricity rates)
  - Profit/loss per job and per customer
  - Basic KPI dashboard (revenue, margins, volume)

- **Printable/Branded Invoicing**
  - Generate PDF invoices from job calculations
  - Shop logo, payment terms, itemized costs
  - Invoice numbering and tracking

- **Templates & Presets**
  - Save common job configurations as templates
  - One-click apply for repeat orders
  - Quote templates with standard terms

---

### Business Tier (~$29-49/month)
*Target: Active sellers doing 50-200+ orders/month across multiple marketplaces.*

- **Embeddable Quote Widget** (KEY DIFFERENTIATOR)
  - Embed a cost calculator on your own website
  - Customer selects material, size, quantity → gets instant quote
  - Quote is powered by your REAL cost calculations + markup
  - No competitor offers this — quotes tied to actual calculated costs *(Source: ERP competitor research, Feb 2026)*

- **Order Management**
  - Sync with Square, Shopify, Etsy APIs
  - Order status tracking (Open, Completed, Canceled, Draft)
  - Order search, filtering, and pagination
  - Deep link back to source platform (e.g., "Open in Square") *(Source: MTNEARZ screenshots, Feb 2026)*
  - Kanban board view for order pipeline *(Source: UX research, Feb 2026)*

- **Financials Per Order**
  - Auto-populate COGS from 3DCoster calculations
  - Gross Sales, Tax, Platform Fees, Net Sales
  - Shipping Cost, Fully Landed Cost
  - Gross Profit, Net Profit, Margins per order

- **Line Item Tracking**
  - Products per order with materials/colors
  - Link to 3DCoster job calculations
  - Inventory deduction

- **Product Catalog Management** *(Source: MTNEARZ screenshots, Feb 2026)*
  - Separate product catalog (not just line items per order)
  - Sync catalog from Square/Shopify independently from order sync
  - Product ↔ 3DCoster job mapping (link a catalog item to its cost calculation)

- **Expense Tracking** *(Source: MTNEARZ screenshots, Feb 2026)*
  - Track business expenses beyond COGS (rent, tools, subscriptions, etc.)
  - Expense categorization
  - Factor into overall profitability reporting

- **Fulfillment**
  - Print packing slip generation
  - Carrier integration
  - Tracking number management
  - Fulfillment state machine separate from order status (e.g., Proposed → Shipped → Delivered) *(Source: MTNEARZ screenshots, Feb 2026)*

- **Dashboard & Reporting**
  - KPI cards: Total Orders + revenue, YTD, quarterly, last 30 days (both count AND dollar amounts) *(Source: MTNEARZ screenshots, Feb 2026)*
  - Revenue reports, profit margin analysis, best-selling products
  - Dedicated Reports tab/page *(Source: MTNEARZ screenshots, Feb 2026)*
  - 5-second rule: main insight visible immediately *(Source: UX research, Feb 2026)*

- **Customer Portal**
  - Client-facing order tracking page (branded)
  - Visual progress tracker: Order Placed → Printing → Post-Processing → Ready
  - Customer self-serve order lookup by ID/email
  - No competitor does this well for 3D print shops *(Source: UX research, Feb 2026)*

- **Accounting Integration**
  - QuickBooks / Xero / Wave sync
  - Auto-categorized expenses
  - Tax-ready reporting

- **Sync & Integration Health** *(Source: MTNEARZ screenshots, Feb 2026)*
  - API connection status indicators (green/red health dots)
  - Last sync timestamp with record count
  - Separate sync actions: Sync All Orders, Sync Last 30 Days, Sync Catalog, Refresh Dashboard
  - Sync audit log / history

---

### Enterprise Tier (~$99+/month)
*Target: Print farms and service bureaus with 10+ printers and staff.*

- **Printer Integration & Monitoring**
  - Real-time printer status in dashboard
  - Auto-capture print time from connected printers
  - Algorithmic job routing to available printers
  - Print queue management with Gantt view *(Source: UX research, Feb 2026)*

- **Workflow Automation**
  - Visual "When/Then" automation builder (no code)
  - Example: "When order status → Printing, email customer: Your order is being printed!"
  - Template automations for common scenarios
  - Automation history log *(Source: UX research, Feb 2026)*

- **Team Collaboration**
  - Multi-user access with roles
  - @mentions and threaded comments on jobs
  - Activity feed per job (who changed what, when)
  - Handoff notes between workflow stages *(Source: UX research, Feb 2026)*

- **Calendar & Scheduling**
  - Calendar view for print queue planning
  - Customer self-serve pickup booking (Calendly-style)
  - Buffer time between jobs for bed prep
  - Conflict detection (two jobs can't be on same printer) *(Source: UX research, Feb 2026)*

- **AI Features**
  - Profitability forecasting from historical data
  - Price optimization suggestions based on sell-through rates
  - Busy period detection and stock-up alerts
  - AI-powered quote generation from job descriptions *(Source: UX research, Feb 2026)*

- **API Access**
  - REST API for custom integrations
  - Webhook support for external automation

---

### Why Paid Tiers
- Significantly more complex (API integrations, order state management)
- Ongoing maintenance for third-party API changes
- Server costs for cloud sync and API proxying
- Support costs for business-critical features
- Target audience gets clear ROI: time savings + better pricing decisions

### Implementation Notes
- Requires backend for API auth, syncing, and multi-device support
- Consider Supabase for quick MVP (auth, database, edge functions)
- Mobile experience becomes critical at Business tier and above
- Start with Pro tier MVP, validate demand before building Business tier

---

## Developer Documentation

For development workflow, release process, UI components, and technical details, see:
**`.claude/CLAUDE.md`**
