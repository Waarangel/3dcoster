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
