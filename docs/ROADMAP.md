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

## Future Enhancements (From Competitor Analysis)

### Data Import/Export
- [ ] **Export to CSV/Excel** - Export job history, sales, and calculations
- [ ] **Import from slicer** - Parse G-code for print time and filament estimates
- [ ] **STL file analysis** - Auto-extract volume for cost estimation (complex)

### Additional Cost Factors
- [ ] **Support material waste %** - Configurable waste factor for support structures
- [ ] **Bed adhesion consumables** - Quick-add for glue sticks, tape, etc.
- [ ] **Multi-material prints** - Support for prints using multiple filaments
- [ ] **Resin printing support** - Different cost model for SLA/MSLA printers

### UX Improvements
- [ ] **Quick duplicate job** - Clone existing job with modifications
- [ ] **Batch pricing** - Discount calculations for volume orders
- [ ] **Customer management** - Track repeat customers
- [ ] **Invoice generation** - Create printable/PDF invoices

### Integrations
- [ ] **Slicer integration** - Pull data from PrusaSlicer, Bambu Studio, Cura
- [ ] **Marketplace sync** - Pull sales data from Etsy API
- [ ] **Accounting export** - QuickBooks/Wave compatible exports

---

## Competitor Comparison Reference

| Feature | 3DCoster | Omni | Prusa | Fabbaloo | MakerShop | Xometry |
|---------|----------|------|-------|----------|-----------|---------|
| Material cost | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Electricity | ✅ | ✅ | - | ✅ | - | - |
| Depreciation | ✅ | - | - | ✅ | ✅ | - |
| Nozzle wear | ✅ | - | ✅ | - | - | - |
| Labor/time | ✅ | ✅ | - | - | ✅ | - |
| Failure rate | ✅ | - | - | - | - | - |
| Post-processing | ✅ | - | ✅ | - | ✅ | - |
| Model cost | ✅ | - | - | - | - | - |
| Shipping | ✅ | - | - | - | - | - |
| Marketplace fees | ✅ | - | - | - | - | - |
| Break-even | ✅ | - | - | - | - | - |
| Sales tracking | ✅ | - | - | - | - | - |
| Multi-printer | ✅ | - | - | - | ✅ | - |
| STL upload | - | - | - | - | ✅ | ✅ |
| Excel export | - | - | - | - | - | ✅ |
| Offline/PWA | ✅ | - | - | - | - | - |

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
- [ ] **Mobile view is horrible** - entire site needs mobile-first redesign
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

## Future Monetization: ERP/Business Management Tier (Paid)

### Context
User feedback (Ken Pauley, Jan 2026) suggested integrating full order management functionality similar to his "MTNEARZ Business Manager" tool. This would transform 3DCoster from a cost calculator into a full 3D print business ERP system.

### Core Features (Priced Tier)
- **Order Management**
  - Sync with Square, Shopify, Etsy APIs
  - Order status tracking (Open, Completed, Canceled, Draft)
  - Customer information management
  - Order search and filtering

- **Financials Per Order**
  - Auto-populate COGS from 3DCoster calculations
  - Gross Sales, Tax, Platform Fees, Net Sales
  - Shipping Cost, Fully Landed Cost
  - Gross Profit, Net Profit, Margins per order

- **Line Item Tracking**
  - Products per order with materials/colors
  - Link to 3DCoster job calculations
  - Inventory deduction

- **Fulfillment**
  - Print packing slip generation
  - Carrier integration
  - Tracking number management

- **Dashboard & Reporting**
  - Total orders, YTD, quarterly, last 30 days
  - Revenue reports
  - Profit margin analysis
  - Best-selling products

### Why Paid Tier
- Significantly more complex (API integrations, order state management)
- Ongoing maintenance for third-party API changes
- Server costs for syncing (if cloud-based)
- Target audience: high-volume sellers (100+ orders/month)

### Pricing Considerations
- Free tier: 3DCoster core (cost calculator) - unlimited
- Pro tier: ERP features - $X/month or $X/year
- Consider usage-based (orders/month) vs flat rate

### Implementation Notes
- Would require backend for API auth and order syncing
- Consider Supabase or similar for quick MVP
- Mobile app would become more valuable at this scale

---

## Developer Documentation

For development workflow, release process, UI components, and technical details, see:
**`.claude/CLAUDE.md`**
