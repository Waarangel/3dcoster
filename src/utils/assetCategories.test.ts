import { describe, it, expect } from 'vitest';
import { isCustomCategory, isPreservedOnMaterialReset, BUILT_IN_CATEGORIES } from './assetCategories';

describe('assetCategories', () => {
  describe('isCustomCategory', () => {
    it('returns false for every built-in category', () => {
      for (const cat of BUILT_IN_CATEGORIES) {
        expect(isCustomCategory(cat)).toBe(false);
      }
    });

    it('returns true for a user-created custom category', () => {
      expect(isCustomCategory('test')).toBe(true);
      expect(isCustomCategory('resin')).toBe(true);
    });
  });

  describe('isPreservedOnMaterialReset (data-loss guard)', () => {
    it('preserves printers', () => {
      expect(isPreservedOnMaterialReset('printer')).toBe(true);
    });

    it('preserves custom-category assets (the v1.9 data-loss fix)', () => {
      expect(isPreservedOnMaterialReset('test')).toBe(true);
    });

    it('does NOT preserve built-in material categories (they reset to defaults)', () => {
      expect(isPreservedOnMaterialReset('filament')).toBe(false);
      expect(isPreservedOnMaterialReset('consumable')).toBe(false);
      expect(isPreservedOnMaterialReset('finishing')).toBe(false);
      expect(isPreservedOnMaterialReset('tool')).toBe(false);
      expect(isPreservedOnMaterialReset('packaging')).toBe(false);
    });
  });
});
