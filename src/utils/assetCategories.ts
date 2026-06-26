import type { AssetCategory, BuiltInCategory } from '../types';

// The categories 3DCoster ships defaults for. Anything else is a user-created
// custom category (we have no default seed to restore it to).
export const BUILT_IN_CATEGORIES: readonly BuiltInCategory[] = [
  'filament',
  'consumable',
  'finishing',
  'tool',
  'packaging',
  'printer',
];

// True for a user-created custom category (one we ship no defaults for).
export function isCustomCategory(category: AssetCategory): boolean {
  return !BUILT_IN_CATEGORIES.includes(category as BuiltInCategory);
}

// Assets a "reset materials to defaults" MUST preserve: printers (reset on their
// own track, and custom printers are already preserved there) and any custom-category
// asset. Wiping a custom category on a material reset would silently destroy data the
// user created in a category we cannot re-seed — the data-loss bug fixed in v1.9.
export function isPreservedOnMaterialReset(category: AssetCategory): boolean {
  return category === 'printer' || isCustomCategory(category);
}
