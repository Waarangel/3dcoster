// Feature release dates for "New" badges
// Features will show a "New" badge based on two conditions:
// 1. The feature must have been released within NEW_FEATURE_MAX_AGE_DAYS
// 2. The user must have first seen it within NEW_FEATURE_SEEN_HOURS
export const featureReleases: Record<string, Date> = {
  'per-unit-licensing': new Date('2026-01-24'),
  'author-min-price': new Date('2026-01-24'),
  'marketplace-fees': new Date('2026-01-20'),
  'shipping-calculator': new Date('2026-01-15'),
  'settings-modal': new Date('2026-01-25'),
  'configurable-marketplace-fees': new Date('2026-01-25'),
  'custom-carriers': new Date('2026-01-25'),
  'custom-marketplaces': new Date('2026-01-25'),
  'multi-currency': new Date('2026-01-25'),
  'distance-units': new Date('2026-01-25'),
  'packaging-materials': new Date('2026-01-25'),
  'csv-import': new Date('2026-02-14'),
  'gcode-import': new Date('2026-02-14'),
  // Add new features here with their release date
};

// Maximum age of a feature release to be eligible for "New" badge (in days)
// Features older than this will NEVER show as new, even on a fresh install
export const NEW_FEATURE_MAX_AGE_DAYS = 14;

// How long to show the badge after the user first sees the feature (in hours)
export const NEW_FEATURE_SEEN_HOURS = 36;
