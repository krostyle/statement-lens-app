import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES } from './category.service';

describe('DEFAULT_CATEGORIES', () => {
  it('contains at least 10 categories', () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThanOrEqual(10);
  });

  it('each category has name, color, and icon', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      expect(cat.name).toBeTruthy();
      expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(cat.icon).toBeTruthy();
    }
  });

  it('names are unique', () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes Alimentación and Transporte', () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);
    expect(names).toContain('Alimentación');
    expect(names).toContain('Transporte');
  });
});
