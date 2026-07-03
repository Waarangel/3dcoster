# Feature Research — v2.0 Cost-Truth & Insight Engine

**Domain:** 3D printing cost calculator / maker business tool — adding decision-analytics, lifecycle tracking, and hosted Pro tier
**Researched:** 2026-07-03
**Confidence:** HIGH for feature behavior patterns (competitor first-hand + deep domain); MEDIUM for tax thresholds (jurisdiction-specific, may drift); MEDIUM for STL volume estimation (library maturity varies); LOW for local-network sync complexity (CRDT + Dexie pairing is novel territory)

---

## Feature Landscape

This file covers the **nine feature domains** requested for v2.0 scoping, plus the launch-bundle items (onboarding, GDPR, redesign). For each domain: table stakes vs differentiators vs anti-features, real-world reference tools, dependency on existing 3DCoster features, and implementation complexity.

---

## 1. Empirical Failure-Cost Engine

**What users expect:** failure rate already exists as a static "% of jobs I expect to fail" in v1.9. The empirical version means the tool *learns* your actual rate from a log of real failures and folds the derived scrap cost into true cost automatically — no manual percentage-guessing.

**Reference tools:** FilamentCalcs failure-rate calculator (stateless, aggregate only); spreadsheet-on-Etsy "6-in-1 print log bundles"; SlicePrice3D (none); 3DPrintQuote has a failure-rate buffer input but no log. The only real-world data models are OctoPrint + Moonraker slicer logs and hand-kept spreadsheets. No competitor currently does per-printer × material empirical rates in a cost calculator.

**Observed user behavior:** makers track failures on paper or in a notes app — "marked success or fail, one line per print." They want to understand whether Printer B fails more than Printer A on flexible materials, but have no tooling for it today.

**Failure rate benchmarks (MEDIUM confidence):** <5% = excellent; 5–10% = typical hobbyist; 10–20% = calibration issue; >20% = systemic problem. Commercial print farms run 2–4%.

**Cost math:** true_failure_cost = material_cost × (1 / (1 - failure_rate) - 1). At 10% failure, every successful print carries 11% extra cost. This multiplier should replace the existing static failure_rate field when empirical data is available.

### Table Stakes (within this feature)

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Log a failure against a saved job (% completion, reason) | Without a log there is nothing to derive rates from | LOW | Requires a new `failureEvents` Dexie store; links to PrintJob |
| Derived failure rate per printer (aggregate) | Most basic useful output; beats static guess | LOW | Computed from failureEvents grouped by printerId |
| Fold derived rate into true cost automatically | This is the entire point of the feature | MEDIUM | Replace static `failureRatePercent` with a resolver that uses empirical data when available, static config as fallback |
| Show scrap cost as a line item | Users want to see what failures are costing them | LOW | Derived from true_cost - cost_without_failure |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| Per-printer × per-material failure rate (segmented) | "My Bambu P1S fails 2% on PLA but 18% on TPU" — actionable insight no competitor offers | MEDIUM | Requires grouping failureEvents by (printerId, materialId); need sufficient data density to be meaningful |
| Failure reason taxonomy (adhesion / warping / clog / power / model) | Enables targeted fixing, not just tracking | LOW | Enum field on failureEvent; shown in a breakdown chart |
| "This job at your empirical rate costs X more than at 0% failure" | Makes the cost of poor printer calibration visceral | LOW | Display-time calculation on job detail |
| Feed spool lifecycle: failures on wet filament → moisture flag | Cross-feature link to spool tracking | MEDIUM | Requires spool→failure correlation |

### Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Automatic failure detection via OctoPrint/Klipper plugin | Sounds like zero-friction logging | Requires self-hosted server, network access, breaks offline-first, complex auth; very small % of 3DCoster users run OctoPrint | Manual log with a one-tap "mark as failed" button on job rows is 90% of the value |
| Failure prediction / ML scoring | "Tell me which jobs will fail" | Insufficient data density for any individual user; the model would be wildly unreliable | Show the empirical rate and benchmarks; let the user draw conclusions |
| Requiring a failure reason to submit | Completeness seems good | Adds friction; many failures don't have clear reasons; users stop logging | Make reason optional with quick-pick presets |

**Dependencies on existing features:** PrintJob (job ID for linking), printer catalog (printer ID for segmentation), material catalog (material ID for segmentation), stock ledger (scrap filament can feed stockEvents). Feeds: true hourly wage (failure cost changes hourly economics); reprice alerts (failure rate change → margin erosion alert).

---

## 2. True Hourly Wage / Product Profitability Ranking + Printer Payback/ROI Tracker + What-If Margin Simulator

These three features are grouped because they share a data layer: jobs × sales × costs × time. They form the "decisions" cluster of the Cost-Truth engine.

### True Hourly Wage

**What users expect:** the existing labor cost field is cost to the buyer. True hourly wage is what the *seller* nets after all costs, per hour of their time spent. SlicePrice3D surfaces "printer profit/hr" in their pricing tier display. 3dprintpricecalculator.com models "owner pay" as a separate cost line.

**Pattern:** (selling_price - all_costs) / total_labor_hours_on_job = maker's effective hourly rate. Aggregate across all jobs in a period → effective hourly rate for the period. Compare to a target wage set in Settings.

| Sub-feature | Table Stake? | Complexity | Notes |
|-------------|-------------|------------|-------|
| Per-job effective hourly rate | Table stake for this feature | LOW | Formula: (sale_price - true_cost) / labor_hours |
| Period aggregate (monthly / quarterly) | Differentiator | LOW | Roll up from jobs with sales in the period |
| Target hourly wage gap ("you're earning $X vs your $Y target") | Differentiator | LOW | Requires a target_hourly_wage in UserProfile settings |
| Product profitability ranking (all saved products, sorted by net profit per hour) | Strong differentiator — shows which SKUs are worth making | MEDIUM | Requires consistent product-title grouping across saved jobs; fuzzy-match needed |

### Printer Payback / ROI Tracker

**What users expect:** "Has my Bambu P1S paid for itself yet?" GrandpaCAD's business calculator shows cumulative cash flow vs break-even. Markforged's Eiger has a full ROI dashboard for enterprise. For maker tools, the pattern is: purchase price ÷ net profit per job × jobs completed = payback timeline.

**Reference tool:** GrandpaCAD 3D Printing Business Calculator tracks 24-month ROI, cumulative cash flow, break-even timing, operating margin. SprintRay ROI Calculator for dental. These are prospective (future modeling); 3DCoster's version should be *retrospective* ("it paid for itself on 2026-03-14") plus prospective remaining payback.

| Sub-feature | Table Stake? | Complexity | Notes |
|-------------|-------------|------------|-------|
| Printer purchase price field (if not already stored) | Required | LOW | Add to printer settings; already partially exists via depreciation |
| Cumulative net profit from that printer (from job history) | Required | MEDIUM | Requires jobs to be linked to specific printer; existing jobs may not have a printer FK |
| Break-even date (actual if crossed, projected if not) | Table stake for this feature | MEDIUM | Requires enough print history to project rate |
| "This printer paid for itself" milestone notification | Differentiator | LOW | One-time toast/notification when break-even is crossed |
| Printer profit/hr display (complement to true hourly wage) | Differentiator — borrowed from SlicePrice3D | LOW | Jobs/time per printer |

### What-If Margin Simulator

**What users expect:** sensitivity analysis — change one input (filament price, labor rate, selling price, marketplace fee) and instantly see the effect on margin and break-even quantity. 3dprintpricecalculator.com does this implicitly by having a live-updating calculator. Excel data tables are the spreadsheet analog.

**Pattern:** expose sliders or editable fields for the main cost variables on a saved job view; re-compute margin/break-even in real time. Show the delta from the current job's saved values.

| Sub-feature | Table Stake? | Complexity | Notes |
|-------------|-------------|------------|-------|
| Live margin/break-even re-computation from editable inputs | Table stake for this feature | LOW | The calculator already does this for unsaved jobs; this extends it to a "sandbox" view on a saved job |
| "Save as new scenario" | Differentiator | LOW | Copy job with scenario suffix |
| Side-by-side comparison (current vs scenario) | Differentiator | MEDIUM | UI layout work |
| Volume break-even (quantity needed at this price to cover fixed costs) | Strong differentiator | LOW | Formula: fixed_cost / contribution_margin_per_unit |

**Anti-features (all three features):**

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Forecasting future sales | No data basis; 3DCoster tracks what you've sold, not what you will sell | Show trailing period trend, not prediction |
| "Are you profitable enough?" judgment score | Patronizing; different users have different goals | Show the number; let the user evaluate it |
| Requiring all jobs to have a printer assigned before enabling ROI | Would block the feature for all historical data | Use unassigned jobs in the aggregate; per-printer requires the link |

**Dependencies:** all jobs + sales data (existing), printer catalog (existing), labor hours on jobs (existing field). True hourly wage requires labor_hours to be populated — a significant data-quality dependency.

---

## 3. Filament-Price → Catalog Reprice Alerts

**What users expect:** when the price of a filament changes in the asset library, the user expects to know which saved products now have margins below their target. camelcamelcamel does this for Amazon products. filamentpricetracker.com monitors 12,080 active filament listings across 264 brands. No 3D printing cost calculator competitor currently does this in-tool.

**Pattern:** user updates a filament's price per kg in the asset library → the tool scans saved jobs using that material and flags those where new true_cost > break_even or where margin < threshold. SlicePrice3D has "low-stock product + filament reorder alerts" but not margin-impact alerts.

**Typical user experience:** update filament price, see a toast: "7 products now under your 30% margin threshold. Review?" → click through to a list of affected jobs with new vs old margin displayed.

### Table Stakes

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Alert on material price update: "N products affected" | Core promise of the feature | LOW | Triggered in the asset library save handler; scan saved jobs using that materialId |
| List of affected jobs with old vs new margin | Without this the alert is useless | MEDIUM | Requires re-computing cost for each affected job using new price; true_cost is partially stored at save time |
| One-click "update selling price to restore margin" | Saves time vs manual job-by-job edit | MEDIUM | Apply the inverse: new_price = new_true_cost / (1 - target_margin) |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| Manual "paste a price" for external tracking (e.g. today's Bambu sale price) | Lets users respond to competitor promotions without live scraping | LOW | Just a price-override input in the asset library |
| Threshold configuration per material (alert me when margin drops below X%) | Personalizes alerts vs global default | LOW | Field on material record or in Settings |
| Price history sparkline on material card | Shows trend; "this filament goes on sale every 6 weeks" | MEDIUM | Store price change timestamps in a priceHistory array on the material record |

### Anti-Features

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Live price scraping from Amazon/Bambu/Polymaker | Marketplace ToS risk; fragile scrapers; DECLINED by founder | Manual paste-a-price with visual instructions |
| Email notifications for price drops | Requires backend + account | In-app notification on next open |
| Push notifications (desktop/mobile) | Notification fatigue; requires permissions | Badge counter on the Materials tab |

**Dependencies:** asset library / material catalog (existing), saved jobs with material references (existing), break-even calculation (existing), target margin setting in UserProfile (existing default profit margin field).

---

## 4. Instant-Quote Share Link

**What users expect:** 3DPrintQuote ships this as a Pro feature: branded link → customer picks variant, approves/declines, dashboard updates. Xometry/Craftcloud/NEXT 3DP all offer online quoting. For the free floor: a shareable link that renders the quote in-browser, no customer account required, no approval tracking.

**STL browser volume estimation:** iamRapid runs fully in-browser ("your model never leaves your device") using client-side STL parsing. NEXT 3DP's quote tool also analyzes STL in-browser. The approach: parse STL binary/ASCII → compute signed volume via divergence theorem → multiply by material density for weight estimate. Libraries: `@threedtwo/stl-parser`, `three.js` STL loader, or `wasm`-compiled OpenVDB for voxelization. This is technically well-established (MEDIUM confidence on library stability).

**Free floor vs Pro ceiling:**
- **Free floor (local, no backend):** generate a PDF quote (already exists) + encode the quote data in a long URL or as a downloadable HTML file the customer opens. No hosted page, no approval tracking, no real-time status.
- **Pro ceiling (requires backend):** hosted page at `3dcoster.com/q/abc123`, customer can approve/decline, maker's dashboard updates. This is the backend-pivot anchor for the Pro tier.

**Quote Variants (borrow from 3DPrintQuote):** one PDF with multiple quantity/material options (1pc/10pc/50pc, resin vs PETG), each a full price snapshot. Customer picks the variant. This works fully offline — strong free-floor differentiator.

### Table Stakes

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Shareable quote as downloadable HTML or PDF link | Minimum sharable artifact; PDF already exists | LOW | Wrap existing PDF quote in a "share" flow; HTML export is the alternative for interactivity |
| Quote Variants (multiple qty/material options in one PDF) | 3DPrintQuote has this; strong expected pattern for B2B | MEDIUM | Extend the PDF generation to include multiple scenario rows |
| STL upload → volume/weight estimate (client-side) | Expected by users who see Xometry/NEXT3DP do it | HIGH | Client-side WASM STL parser; compute volume; multiply by density → weight → feed into calculator |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| Hosted approval link (Pro) | Customer clicks approve → maker gets notified | VERY HIGH | Requires backend, auth, webhook/email; Pro-tier only |
| Branded quote page (Pro) | Maker's logo/colors on customer-facing page | HIGH | Pro tier; requires hosted page template |
| 3D model preview in quote PDF | "Here's what you're quoting" thumbnail | MEDIUM | Three.js WebGL screenshot → embedded image in PDF |

### Anti-Features

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Customer-facing account creation | Kills the "no account for customer" differentiator that 3DPrintQuote markets | Approval token in URL only |
| Auto-pricing from STL without maker review | STL weight ≠ actual slicer output (supports, infill, orientation all matter) | STL estimate → pre-fills the form → maker reviews before sending |
| Requiring STL for every quote | Most quotes are manually entered; STL is an optional accelerant | STL upload remains optional at top of calculator |

**Dependencies:** existing PDF quote (v1.2), customer library (existing), quote variants need a new Dexie `QuoteVariant` model. STL parsing is net-new JS dependency (WASM or pure JS). Hosted approval requires a backend (Pro tier only).

---

## 5. Spool Lifecycle / Moisture Tracking

**What users expect:** Spoolman (Donkie/Spoolman, MIT, self-hosted, SQLite/Postgres) is the reference: it tracks manufacturer, material, color, remaining weight, and spool location. It supports custom fields (including humidity via Home Assistant integration). Key fields observed in Spoolman's data model: `first_used`, `last_used`, `location`, `archived` flag, and custom_fields for humidity/sensor data.

**What actually predicts wet filament:** opened_date + material hygroscopicity class. Nylon absorbs moisture in 4–8 hours at 50% RH; PETG absorbs in 12–24 hours; PLA is relatively resistant. No tool currently gives the user a "risk level" based on opened date + material type + ambient humidity — that's a gap.

**FilaMan** (filaman.app) focuses on live weight tracking via ESP32 scale + RFID; does not track moisture or opened date in its documented feature set.

### Table Stakes

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Opened date on spool | Every maker who dries filament needs to know when they opened it | LOW | Add `openedAt` timestamp to material/spool record in Dexie |
| Location field (dry-box A, shelf, drawer) | Spoolman users expect this; needed to find the spool | LOW | Free-text or enum |
| Archived / empty flag | "This spool is gone" | LOW | Boolean; filter out of active inventory |
| Days-open counter on material card | Derived from openedAt; instant visual cue | LOW | Computed at render time |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| Moisture risk indicator by material type + days open | "This Nylon has been open 12 days — consider drying before use" | MEDIUM | Encode hygroscopicity class per material type (Nylon=HIGH, PETG=MEDIUM, PLA=LOW, TPU=MEDIUM); threshold rules per class |
| Drying log (date dried, method, duration) | Closes the loop on whether the spool is still considered "dry" | LOW | dryingEvents array on spool record |
| Link failed prints to "suspected wet filament" | Feeds failure-cost engine with a cause | MEDIUM | Optional tag on failureEvent; spool lookup by job's material |
| Last-used date + "stale stock" alert | "This PVA hasn't been used in 90 days" | LOW | Derived from lastUsedAt field |

### Anti-Features

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Integration with humidity sensor hardware | Requires IoT setup; breaks offline-first; only power users have sensors | Manual humidity log field (optional) |
| Automatic drying schedule / reminders | Notification infrastructure needed; overkill for v2.0 | Show risk level in UI; user decides |
| Replacing the existing material catalog with spool tracking | They serve different purposes — catalog is for cost, spool is for lifecycle | Lifecycle fields bolt onto the existing material record |

**Dependencies:** material catalog / asset library (existing). The "link failures to wet filament" sub-feature requires the failure-cost engine (Feature 1).

---

## 6. Hobby → Business Tax-Threshold Tracker

**What users expect:** a dashboard that shows how close the user is to the threshold where their hobby becomes a taxable business, with jurisdiction-specific thresholds. No current 3D printing tool does this. The closest analog: tax-filing tools (TurboTax, GoSimpleTax) that ask hobby-vs-business questions but don't track live revenue progression.

**Jurisdiction thresholds (MEDIUM confidence — regulations change):**

| Jurisdiction | Threshold | Notes |
|--------------|-----------|-------|
| UK | £1,000 gross revenue / year (Trading Allowance) | Changing to £3,000 in 2029; platform reporting triggers at £1,700 after fees |
| US | No fixed dollar threshold; IRS uses 9 "badges of trade"; profit in 3 of 5 years = presumed business | Hobby expenses not deductible post-TCJA 2018; Schedule C if deemed a business |
| Germany (Kleinunternehmer) | €25,000 prior year turnover (was €22k); if expected to exceed €100k current year → must register VAT | Small business VAT exemption (Umsatzsteuerbefreiung) |
| Australia | No fixed threshold; intent + commercial character; GST registration mandatory at AUD 75,000 turnover | ATO uses "are you carrying on a business?" test |
| Canada | No fixed threshold; CRA looks at reasonable expectation of profit + commercial activity | HST registration mandatory at CAD 30,000 in 4 rolling quarters |

**What makers actually want:** a running total of sales this calendar/tax year vs their jurisdiction threshold, with a progress bar and a "you hit your threshold on [date]" milestone.

### Table Stakes

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Jurisdiction selector (UK / US / DE / AU / CA / Other) | Without this, thresholds are meaningless | LOW | Settings field; defaults to detected region |
| Running year-to-date revenue total (from sales data) | Already derivable from existing sales records | LOW | Aggregate sale_price from sales in current tax year |
| Threshold progress bar with % and amount remaining | The core UX | LOW | Simple computed display |
| "You may have crossed a threshold" alert | Most important output | LOW | Notification when running total crosses threshold |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| Tax year vs calendar year awareness (UK April, AU July, US/DE January) | Getting this wrong gives wrong totals | MEDIUM | Tax year start/end per jurisdiction |
| Disclaimer + "consult a tax professional" | Required for legal safety; builds trust | LOW | Non-negotiable; this is NOT tax advice |
| Multi-year trend (last 3 years revenue) | Useful for US "3-of-5 years profit" rule | MEDIUM | Requires sales data across years |
| Platform-reported amounts note (UK: Etsy reports after £1,700 fees) | Users ask about this | LOW | Informational callout |

### Anti-Features

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Giving actual tax advice ("you owe £X") | Legal liability; not qualified to give tax advice | "You may be approaching the threshold where registration is required. Consult a qualified accountant." |
| Auto-filing integration | Completely out of scope; requires backend + accounting integration | Link to jurisdiction's official guidance page |
| Tracking all jurisdictions simultaneously | Confusing for single-jurisdiction users | Single jurisdiction setting; "are you selling into multiple countries?" prompt |
| Income tax bracket modeling | Complex, US-centric, requires sensitive income data 3DCoster doesn't have | Point users to 3dprintpricecalculator.com's income-tax feature which does this well |

**Dependencies:** sales records with dates (existing), currency settings (existing — tax year totals must be in home currency), UserProfile for jurisdiction setting (new field).

---

## 7. Guided First-Run Onboarding

**What users expect:** SlicePrice3D has a 5-step Quick Start wizard. Calibration tools (Teaching Tech 3D Printer Calibration) use step-by-step flows. The onboarding wizard UX pattern: break complex setup into sequential steps, add data upfront to reduce time to first value, answer what the user hasn't yet asked.

**The cold-start problem in 3DCoster:** a new user lands on the calculator and sees empty dropdowns for printer and filament. The correct first action is Settings → add a printer → add a filament → come back. This is a dead end that every new user hits. This is Audit Tier 3.1, the longest-standing UX debt.

**Wizard flow recommendation (from competitor observation + UX patterns):**
1. Welcome + role (hobbyist / Etsy seller / small business)
2. Add your first printer (name + purchase price + hourly rate)
3. Add your first filament (type + brand + cost per kg)
4. Optional: set your target margin / target hourly wage
5. "You're ready — calculate your first print cost"

### Table Stakes

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Trigger on truly-empty state (no printers AND no materials) | Wizard should not appear for returning users | LOW | Check Dexie on first load |
| Linear step flow with back/skip | Industry-standard wizard UX | LOW | Steps component; not a modal — full-screen or prominent panel |
| Dismiss / "skip setup" permanently | Power users who want to do it manually must not be forced through | LOW | Persist skip flag; don't re-show |
| "You can change all of this in Settings" reassurance | Reduces form anxiety | LOW | Copy on each step |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| Role-based defaults (hobbyist / Etsy / business) | SlicePrice3D does this with channel presets; sets margin target, electricity rate defaults | MEDIUM | Short role-selector step; adjust defaults accordingly |
| Smart catalog pre-selection ("Start with Bambu P1S + Bambu PLA Basic?") | Reduces friction to first print enormously | LOW | Show top-3 catalog printers/materials as quick-add tiles |
| Animated progress indicator | Motivates completion; widely expected in modern onboarding | LOW | Step dots or progress bar |
| First-print celebration (confetti / milestone) after first saved job | Retention hook; ties the user to a success moment | LOW | One-time trigger on first job save |

### Anti-Features

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Making the wizard mandatory / blocking the app | Power users leave immediately | Always-visible skip; wizard is a guide, not a gate |
| Asking for data the user can't answer (overhead, marketing costs) | SlicePrice3D's biggest UX complaint is asking beginners unanswerable questions | Defer overhead/advanced fields to Settings; wizard covers only the core trio: printer + filament + margin |
| More than 5 steps | Abandonment rate increases sharply beyond 5 | Maximum 5 steps; optional fields get an "advanced" expander |
| Re-showing the wizard when settings are cleared / reset | Annoying for experienced users who did a factory reset | Only trigger on the fully-empty state, never on reset |

**Dependencies:** printer catalog + material catalog (existing), UserProfile settings (existing), empty-state detection from Dexie (existing empty-state components). No new schema needed for a basic wizard; role-based defaults need a `userRole` field in UserProfile.

---

## 8. Time-of-Use Electricity Modeling

**What users expect:** peak/off-peak tariff schedules that let users assign prints to off-peak windows and calculate a lower electricity cost. The NREL Utility Rate Database (URDB) covers US utilities. Enphase, SCE, and Palmetto apps all let users input their TOU schedule and see per-hour cost. No 3D printing calculator competitor currently models TOU.

**Pattern:** user defines 1–3 time bands (e.g., off-peak 10pm–7am, peak 7am–9pm, super-peak 4pm–9pm on weekdays). Print start time + print duration → which bands does the print fall in → weighted electricity rate. The calculator then uses the weighted rate instead of a flat rate.

**Typical TOU structures:**
- 2-band (peak/off-peak) — most residential plans
- 3-band (peak/off-peak/super-peak) — California SCE TOU-D, Octopus Energy GO (UK)
- Seasonal variants (summer/winter peak windows differ) — adds complexity

### Table Stakes

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Define peak/off-peak rate bands in Settings | Without this, TOU can't be used | LOW | Up to 3 bands with time ranges + rate per kWh |
| Print start time input on calculator | Needed to know which band the print falls in | LOW | Time picker; optional; defaults to "any time" = flat rate |
| Weighted electricity cost calculation | Core computation | MEDIUM | For a 14-hour print starting at 8pm: 2h peak + 12h off-peak = weighted rate |
| Show TOU vs flat-rate comparison | Motivates setup of TOU | LOW | "If you print off-peak: saves $0.34" |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| "Best time to start this print" recommendation | Shift-printing guidance; unique in category | MEDIUM | Given print duration, compute cheapest start time in the next 24h |
| Seasonal schedule (summer/winter variants) | Needed for accurate annual modeling | MEDIUM | Two schedule configs with a date-range switcher |
| Carbon intensity overlay (grid-carbon score) | Eco-conscious users; aligns with PERF-11's "green print" angle | HIGH | Requires CO2 grid intensity data source (Electricity Maps API); LOW priority |

### Anti-Features

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Auto-detecting tariff from zip code / postcode | Requires live API + location permission + utility-specific parsing | User enters their rate bands manually from their bill; one-time setup |
| Showing exact cost by hour of day for a year | Overkill; requires full schedule simulation | Show the weighted cost for the specific job's duration |
| Replacing the flat electricity rate | Some users don't have TOU tariffs | TOU is an optional layer on top of flat rate; flat rate remains the default |

**Dependencies:** electricity rate setting in UserProfile (existing), print duration input on calculator (existing), new TOU schedule data structure in UserProfile settings. This is a self-contained feature with no cross-feature dependencies.

---

## 9. Abrasive Wear + Maintenance Amortization

**What users expect:** the app already has a "maintenance/service budget" concept and 500h maintenance alerts. The v2.0 version makes this a full amortization model: log maintenance events, allocate their cost over subsequent jobs, and surface per-job maintenance cost as a line item.

**Real-world data:** brass nozzles last 50–100 hours with abrasive filaments; hardened steel 1,000+ hours. A $15 hardened steel nozzle at 1,000 hours = $0.015/hr nozzle amortization. PETG nozzle cost: ~$2 per 200 hours = $0.01/hr. These are meaningful costs for abrasive-heavy shops but rounding error for standard PLA users.

**Reference tools:** SimplyPrint's print farm manager has a maintenance profile per printer (total maintenance events, downtime, task history, parts consumed). No maker-level cost calculator includes event-level maintenance amortization.

**Pattern:** maintenance event log (date, cost, category, odometer at time) → amortized cost per hour → added to job's electricity/depreciation line item category.

### Table Stakes

| Sub-feature | Why Expected | Complexity | Notes |
|-------------|--------------|------------|-------|
| Maintenance event log per printer (date, cost, type) | Without events there is nothing to amortize | LOW | New `maintenanceEvents` Dexie store; extends existing 500h alert concept |
| Cumulative maintenance cost display per printer | "This printer has cost $340 in maintenance" | LOW | Aggregate from maintenanceEvents |
| Amortized maintenance cost per print hour | The cost engineering output | MEDIUM | total_maintenance_cost / total_print_hours → per-hour rate; factored into job cost |
| Nozzle type field on printer (brass / hardened steel / ruby) | Enables per-material nozzle surcharge | LOW | Enum on printer record; nozzle replacement cost / expected life hours |

### Differentiators

| Sub-feature | Value Proposition | Complexity | Notes |
|-------------|-------------------|------------|-------|
| Material-driven nozzle surcharge ("abrasive surcharge") | Carbon fiber, glow-in-dark, metal-fill should carry a nozzle surcharge | MEDIUM | If material.isAbrasive = true AND printer.nozzleType = brass → add surcharge; define abrasive flag per material type |
| "Next maintenance due" countdown | Extension of existing 500h alert; now cost-aware | LOW | Projected date based on average daily print hours |
| Maintenance cost trend (are repairs getting more expensive?) | Aging printer signal | LOW | Chart of cumulative maintenance cost over time |

### Anti-Features

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Auto-detecting nozzle wear from print quality metrics | Requires computer vision / OctoPrint integration; not feasible local-first | Manual nozzle replacement event with cost input |
| Distinguishing routine vs corrective maintenance in the amortization model | Too fine-grained for most users | Single maintenance cost pool; user can add notes |
| Making maintenance amortization mandatory for all jobs | Adds cost complexity for users who don't track maintenance | Opt-in feature; if no events logged, the existing flat "maintenance budget" field applies |

**Dependencies:** printer catalog (existing, needs nozzle type field), material catalog (existing, needs isAbrasive flag), existing 500h maintenance alert logic (extends it). Feeds: true-cost line items (maintenance cost per job), printer ROI tracker (maintenance cost reduces printer ROI).

---

## 10. Launch Bundle: GDPR / Cookie Consent + Privacy Policy + Terms

**What users expect:** any tool that stores user data on a backend, runs analytics (Vercel Analytics currently), or serves EU users needs: (1) a cookie consent banner with granular, revocable consent; (2) a GDPR-compliant privacy policy; (3) terms of service. The Pro tier backend makes GDPR non-optional.

**2026 enforcement reality:** GDPR enforcement is active (France CNIL €150M SHEIN fine). Google Consent Mode v2 is mandatory for EU Google Analytics traffic. Consent must be prior, granular, and revocable.

**Technical implementation:** `react-cookie-consent` (npm, simple) or `react-cookie-manager` (cookiekit-io, more granular) or CookieHub (SaaS). For 3DCoster, Vercel Analytics counts as analytics tracking → needs consent for EU users. The free-tier web app already uses Vercel Analytics without consent banners.

| Sub-feature | Table Stake? | Complexity | Notes |
|-------------|-------------|------------|-------|
| Cookie consent banner (analytics category, essential category) | Required for EU compliance | LOW | `react-cookie-consent` or equivalent; gates Vercel Analytics consent |
| Granular consent (accept all / essential only / manage) | Required by GDPR; "accept all" only is not compliant | LOW | Three-option pattern: Accept All, Reject Non-Essential, Manage |
| Revocation pathway (change consent in footer) | GDPR right to withdraw consent | LOW | "Cookie settings" link in footer |
| EU-compliant privacy policy (GDPR-specific disclosures) | Legal requirement when storing any PII | MEDIUM | Template + lawyer review; cover: data collected, retention, rights, contact |
| Terms of service | Required for paid tier | MEDIUM | Standard SaaS ToS template + customization |
| Consent-gated Vercel Analytics | Analytics must not fire before consent | LOW | Wrap Analytics component in consent check |

**Anti-Features:**

| Anti-Feature | Why Problematic | Alternative |
|--------------|-----------------|-------------|
| Cookie wall (block access until consent given) | Illegal in EU (DPA guidance); user-hostile | Show banner; allow use with essential cookies only |
| Storing consent in a third-party SaaS without a DPA | Creates a GDPR sub-processor issue | Store consent preference in localStorage (first-party, no PII) |
| Using consent for marketing/retargeting before Pro launch | Premature; no ad network yet | Consent categories: Essential + Analytics only at launch |

---

## 11. CostCalculator God-Component Split + PERF-11 + Tab-in-URL Routing (Foundation)

These are architectural prerequisites, not user features, but they unblock almost everything in v2.0.

**CostCalculator God-component split (Audit 6.1):** CostCalculator.tsx at ~1,690 LOC is where PERF-11 (pricing dep-trim desynced profit/margin) lives. The correct fix requires splitting the component first. v2.0 adds new cost lines (failure amortization, TOU electricity, maintenance amortization) that will make the God component worse if not split first.

**Tab-in-URL routing:** currently `/app` is a single route; tab selection is in-memory state. Browser Back exits the app rather than going back to the previous tab. Makers who link to "the quotes tab" can't. Competitor SlicePrice3D uses tab-in-URL routing.

| Sub-feature | Why Needed | Complexity |
|-------------|------------|------------|
| CostCalculator split into Calculator / CostSummary / FilamentSection / PricingSection | Unblocks PERF-11 fix and all new cost lines | HIGH |
| PERF-11 done right (pricing useEffect dep fix within the split) | Was reverted in v1.9 as a regression risk without the split | MEDIUM once parent is split |
| `/app/calculator`, `/app/jobs`, `/app/quotes`, etc. | Makes tabs linkable; fixes browser Back | MEDIUM |

---

## Feature Dependencies

```
Foundation (CostCalculator split + tab-in-URL)
    └──unblocks──> all new cost lines on Calculator
                       └──includes──> TOU electricity (Feature 8)
                       └──includes──> Maintenance amortization (Feature 9)
                       └──includes──> PERF-11 (pricing dep fix)

Failure-cost engine (Feature 1)
    └──requires──> failureEvents Dexie store (new)
    └──enhances──> True hourly wage (Feature 2) — failure cost changes hourly economics
    └──can feed──> Spool lifecycle (Feature 5) — wet filament failure correlation
    └──can trigger──> Reprice alerts (Feature 3) — failure rate change → margin alert

Printer payback / ROI tracker (Feature 2b)
    └──enhanced by──> Maintenance amortization (Feature 9) — maintenance reduces ROI

Reprice alerts (Feature 3)
    └──requires──> material price updates propagating to saved jobs (already partial)
    └──enhanced by──> Failure-cost engine — failure rate change also triggers repricing

Instant-quote share link (Feature 4)
    └──requires for free floor──> existing PDF quote (v1.2 ✓)
    └──requires for Pro hosted──> backend infrastructure (new, large)
    └──enhanced by──> Quote Variants — multi-option PDF

Spool lifecycle (Feature 5)
    └──bolts onto──> material catalog (existing ✓)
    └──can feed──> Failure-cost engine (Feature 1)

Tax threshold tracker (Feature 6)
    └──requires──> sales records with dates (existing ✓)
    └──requires──> home currency setting (existing ✓)
    └──new field──> jurisdiction in UserProfile

Guided onboarding (Feature 7)
    └──requires──> empty-state detection from Dexie (existing ✓)
    └──no new schema needed for basic wizard

TOU electricity (Feature 8)
    └──requires──> CostCalculator split (Foundation) to add a new cost line cleanly
    └──requires──> print start time input (new field on calculator)

Maintenance amortization (Feature 9)
    └──requires──> maintenanceEvents Dexie store (extends existing 500h alert)
    └──requires──> printer nozzle type + isAbrasive on material (new fields)
    └──feeds──> Printer ROI tracker (Feature 2b)

GDPR / cookie consent (Feature 10 — Launch Bundle)
    └──must ship before──> any backend/Pro tier goes live
    └──gates──> Vercel Analytics (existing, currently unconsented for EU)

Hosted Pro tier
    └──requires──> GDPR compliance (Feature 10) first
    └──enables──> Instant-quote hosted approval page (Feature 4 Pro ceiling)
```

---

## MVP Recommendation for v2.0

### Wave 1 — Free-floor insight, build on existing data, lowest risk

These work with data users already have and don't need new data-entry habits:

- [ ] **Guided first-run onboarding (Feature 7)** — highest UX ROI; fixes the longest-standing user pain; no new schema; delivers immediate value to every new user
- [ ] **Reprice alerts (Feature 3, basic)** — low complexity; big moment of value when filament prices rise; builds on existing material + job data
- [ ] **Printer payback / ROI (Feature 2b, basic)** — retrospective P&L from existing job history; motivating "it paid for itself" milestone; low build cost

### Wave 2 — New tracking habits + deeper cost engine

These require users to log new data (failures, maintenance events):

- [ ] **Failure-cost engine (Feature 1)** — the flagship differentiator; requires new logging habit; worth a prominent onboarding prompt
- [ ] **True hourly wage + product profitability ranking (Feature 2a)** — depends on consistent labor_hours data; survey existing jobs to see coverage
- [ ] **TOU electricity (Feature 8)** — narrow audience (users with TOU tariffs); high value for that segment; requires CostCalculator split (Foundation)
- [ ] **Maintenance amortization (Feature 9)** — narrow audience (high-volume, abrasive-materials users); extends existing 500h alert concept

### Wave 3 — Big swings + compliance + launch

- [ ] **Spool lifecycle / moisture tracking (Feature 5)** — nice UX addition; depends on whether users actually want this over other features
- [ ] **Tax threshold tracker (Feature 6)** — high value for the hobbyist-to-business transition segment; requires jurisdiction data accuracy
- [ ] **STL instant-quote free floor (Feature 4a)** — high-complexity client-side STL parsing; worth doing if the volume estimate accuracy is good enough
- [ ] **Quote variants (Feature 4, borrow from 3DPrintQuote)** — strong differentiator; purely additive to existing PDF quote; medium complexity
- [ ] **What-if margin simulator (Feature 2c)** — lower priority than the other Features 2 components; useful but not essential
- [ ] **GDPR / cookie consent + Privacy Policy + ToS (Feature 10)** — must ship before hosted Pro goes live; can be done independently of other features
- [ ] **Hosted Pro tier + instant-quote approval page (Feature 4 Pro)** — the major backend pivot; highest complexity; gates the paid revenue path

### Foundation (prerequisite, not user-visible)

- [ ] **CostCalculator God-component split + PERF-11 + tab-in-URL** — do this first in v2.0; everything else in the cost engine builds on a healthy CostCalculator

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Guided onboarding | HIGH | LOW | P1 |
| CostCalculator split + PERF-11 + tab-in-URL | HIGH (foundation) | HIGH | P1 |
| Reprice alerts (basic) | HIGH | LOW | P1 |
| Printer ROI tracker (basic) | HIGH | LOW | P1 |
| Failure-cost engine | HIGH | MEDIUM | P1 |
| GDPR / cookie consent | HIGH (compliance) | LOW | P1 (before Pro launch) |
| True hourly wage + product ranking | HIGH | MEDIUM | P2 |
| TOU electricity | MEDIUM (targeted) | MEDIUM | P2 |
| Maintenance amortization | MEDIUM (targeted) | MEDIUM | P2 |
| Quote variants (multi-option PDF) | MEDIUM | MEDIUM | P2 |
| Tax threshold tracker | MEDIUM | LOW | P2 |
| Spool lifecycle / moisture tracking | MEDIUM | LOW | P2 |
| What-if margin simulator | MEDIUM | LOW | P2 |
| STL instant-quote (client-side) | HIGH (if accurate) | HIGH | P2 |
| Hosted Pro tier + approval page | HIGH (revenue) | VERY HIGH | P3 (backend pivot) |
| Currency expansion 18 → 50+ | MEDIUM | LOW | P2 (quick win) |
| Marketing-site redesign (Cost-Truth Dark) | HIGH (brand) | MEDIUM | P1 (before Pro launch) |

---

## Competitor Feature Analysis

| Feature | SlicePrice3D (free, cloud) | 3DPrintQuote (€9.90/mo, cloud) | 3DCoster v2.0 Approach |
|---------|---------------------------|-------------------------------|------------------------|
| Failure rate | Static input, no log | Failure-rate buffer input | Empirical log → derived rate → auto-fold |
| Printer ROI | Printer profit/hr in tier display | Not seen | Retrospective P&L from job history |
| Reprice alerts | Low-stock alerts (not margin) | Not seen | Material price change → affected jobs list |
| Quote share link | Quote with online approval | Hosted approval link (Pro) | Free: PDF/HTML export; Pro: hosted approval |
| Spool lifecycle | Filament reorder alerts (stock) | Not seen | Opened date + moisture risk + drying log |
| Tax threshold | None | None | YTD revenue vs jurisdiction threshold |
| First-run onboarding | 5-step Quick Start wizard | Not seen | 5-step wizard; role-based defaults |
| TOU electricity | None | None | User-defined bands + weighted rate |
| Maintenance amortization | None | None | Event log + per-hour rate + nozzle surcharge |
| GDPR compliance | Cloud account; unclear | EU-based; presumably compliant | Consent banner + privacy policy + ToS |
| What-if simulator | Channel presets (partial) | Not seen | Editable sandbox on saved job |
| Quote variants | Not seen | Multi-variant PDF (Pro) | Multi-variant PDF (free floor) |
| STL volume estimate | Not seen | Not seen | Client-side WASM parser → weight estimate |

---

## Sources

- [Spoolman GitHub (Donkie/Spoolman)](https://github.com/Donkie/Spoolman) — spool data model fields
- [Spoolman REST API v1](https://donkie.github.io/Spoolman/) — API schema reference
- [FilamentCalcs Failure Rate Calculator](https://filamentcalcs.com/tools/failure-rate-calculator) — failure rate formulas + benchmarks
- [GrandpaCAD 3D Printing Business Calculator](https://grandpacad.com/en/tools/3d-printing-business-calculator) — printer ROI + payback modeling
- [Filament Price Tracker](https://filamentpricetracker.com/) — 12,080 listings, real-time price monitoring
- [iamRapid STL Analysis](https://iamrapid.com/tools/stl-analysis/) — client-side STL volume/geometry analysis
- [NEXT 3DP Instant STL Quote](https://www.next3dp.com/3d-printing-quote) — browser-based STL quoting approach
- [SimplyPrint Printer Maintenance](https://simplyprint.io/blog/introducing-printer-maintenance/) — fleet maintenance tracking patterns
- [UK Trading Allowance — GOV.UK via Simply Business](https://www.simplybusiness.co.uk/knowledge/business-tax/side-hustle-tax/) — £1,000 threshold + 2029 change
- [Kleinunternehmer Germany — Accountable](https://www.accountable.de/en/blog/kleinunternehmer-limit/) — €25k/€100k 2025 thresholds
- [AU Hobby vs Business — ATO](https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/turning-a-hobby-into-income-you-might-be-in-business) — intent-based; $75k GST threshold
- [Eleken Wizard UI Pattern](https://www.eleken.co/blog-posts/wizard-ui-pattern-explained) — onboarding wizard UX best practices
- [NREL URDB TOU Visualizer](https://electricrates.org/tools/tou-visualizer/) — TOU rate structure patterns
- [Enphase TOU Explainer](https://enphase.com/blog/homeowners/time-of-use-rates-explained) — peak/off-peak modeling
- [MatterHackers Nozzle Comparison](https://www.matterhackers.com/news/3d-printer-nozzle-comparison-guide) — brass vs hardened steel wear rates
- [GDPR Cookie Consent 2026 — Consenteo](https://www.consenteo.com/knowledge-hub/GDPR/gdpr_cookie_consent_2026) — 2026 compliance requirements
- [react-cookie-consent npm](https://www.npmjs.com/package/react-cookie-consent) — React cookie consent implementation
- Project memory files: `project_competitor_sliceprice3d.md`, `project_competitor_3dprintquote.md`, `project_competitor_calculator_only_rivals.md`, `project_v2_vision.md`

---

*Feature research for: 3DCoster v2.0 Cost-Truth & Insight Engine*
*Researched: 2026-07-03*
