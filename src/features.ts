// Feature release dates for "New" badges
// Features will show a "New" badge for 14 days after release
export const featureReleases: Record<string, Date> = {
  'per-unit-licensing': new Date('2026-01-24'),
  'author-min-price': new Date('2026-01-24'),
  'marketplace-fees': new Date('2026-01-20'),
  'shipping-calculator': new Date('2026-01-15'),
  // Add new features here with their release date
};

// How long features are considered "new" (in days)
export const NEW_FEATURE_DAYS = 14;
