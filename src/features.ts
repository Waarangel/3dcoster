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
  // Add new features here with their release date
};

// Maximum age of a feature release to be eligible for "New" badge (in days)
// Features older than this will NEVER show as new, even on a fresh install
export const NEW_FEATURE_MAX_AGE_DAYS = 14;

// How long to show the badge after the user first sees the feature (in hours)
export const NEW_FEATURE_SEEN_HOURS = 36;
