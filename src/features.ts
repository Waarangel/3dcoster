// Feature release dates for "New" badges
// Features will show a "New" badge based on two conditions:
// 1. The feature must have been released within NEW_FEATURE_MAX_AGE_DAYS
// 2. The user must have first seen it within NEW_FEATURE_SEEN_HOURS
export const featureReleases: Record<string, Date> = {
  'settings-reorg': new Date('2026-05-20'),
  'default-profit-margin': new Date('2026-05-18'),
  'model-url': new Date('2026-05-20'),
  'default-tax-rate': new Date('2026-05-21'),
  'customer-details': new Date('2026-05-21'),
  'etsy-helper': new Date('2026-05-21'),
  'customer-library': new Date('2026-05-22'),
  'pdf-quote': new Date('2026-05-23'),
  'tags': new Date('2026-05-24'),
  'search-jobs': new Date('2026-05-24'),
  'export-jobs-sales': new Date('2026-06-12'),
  'export-assets': new Date('2026-06-12'),
  'jobs-summary-totals': new Date('2026-06-12'),
  'full-backup': new Date('2026-06-12'),
  'custom-printer-model': new Date('2026-06-15'),
  // v1.8 — Inventory & Sales Reporting (dated at UAT; confirm still within the
  // 14-day window at the v1.8.0 tag in Phase 31)
  'material-inventory': new Date('2026-06-19'),
  'sales-report': new Date('2026-06-19'),
  // v2.0 Phase 39 — Cost Realism (owned here in Plan 01 to avoid a wave-2
  // parallel-write conflict; Plans 02/04 reference these keys via NewBadge)
  'log-failure': new Date('2026-07-06'),
  'maintenance-log': new Date('2026-07-06'),
  // v2.0 Phase 40 — Insight Layer (INS-01): Insights tab + target-wage Setting
  'insights-tab': new Date('2026-07-08'),
  // v2.0 Phase 40 — Insight Layer (INS-03): what-if margin simulator, reachable
  // from a JobsManager job row and from the Insights tab job picker (D-09)
  'what-if-simulator': new Date('2026-07-08'),
  // v2.0 Phase 41 — Quick-Win Features
  'reprice-alerts': new Date('2026-07-09'),
  'quote-variants': new Date('2026-07-09'),
  'spool-lifecycle': new Date('2026-07-09'),
  'tax-threshold': new Date('2026-07-09'),
  // v2.0 Phase 42 — GDPR & Onboarding (ONBD-01): first-run guided setup
  // wizard. The consent banner and legal pages are NOT features (D-CONTEXT)
  // — only the wizard itself is user-facing and gets a NEW badge.
  'onboarding-wizard': new Date('2026-07-09'),
  // v2.0 Phase 43 — Pro Backend (PRO-02): Share quote publishes a hosted,
  // maker-branded quote link a customer can Approve/Decline.
  'share-quote': new Date('2026-07-15'),
  // v2.0 Phase 44 — Sync & STL Instant Quote (SYNC-01, CONN-02). Both keys
  // owned here in Plan 01 (like Phase 39 Plan 01) so no other Wave-1 plan
  // writes features.ts. Consumed downstream via <NewBadge feature=...>:
  // the STL estimate key by the calculator import flow, the sync key by
  // the Settings Data-tab sync UI. Re-confirm both dates are still within
  // NEW_FEATURE_MAX_AGE_DAYS at the eventual v2.0 tag.
  'sync-devices': new Date('2026-07-17'),
  'stl-estimate': new Date('2026-07-17'),
  // v2.0 Phase 46 — White-label quotes (D-01..D-03): Settings → Profile
  // Branding section (Pro upload/preview/remove; free Pro-chip → bundle
  // pitch modal). One badge for the whole section, not per-path.
  'white-label-branding': new Date('2026-07-23'),
  // Add new features here with their release date
};

// Maximum age of a feature release to be eligible for "New" badge (in days)
// Features older than this will NEVER show as new, even on a fresh install
export const NEW_FEATURE_MAX_AGE_DAYS = 14;

// How long to show the badge after the user first sees the feature (in hours)
export const NEW_FEATURE_SEEN_HOURS = 36;
