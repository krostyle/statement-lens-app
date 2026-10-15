import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES, getExcludedCategoryIds, getFixedCategoryIds } from './category.service';
import type { Category } from '../entities/category';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Alimentación',
    color: '#f97316',
    icon: 'ShoppingCart',
    isDefault: false,
    excludeFromBudget: false,
    isFixed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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

describe('getExcludedCategoryIds', () => {
  it('returns the ids of categories flagged excludeFromBudget', () => {
    const categories = [
      makeCategory({ id: 'cat-1', excludeFromBudget: false }),
      makeCategory({ id: 'cat-amorcito', excludeFromBudget: true }),
    ];
    expect(getExcludedCategoryIds(categories)).toEqual(new Set(['cat-amorcito']));
  });

  it('returns an empty set when no category is flagged', () => {
    expect(getExcludedCategoryIds([makeCategory()])).toEqual(new Set());
  });
});

describe('getFixedCategoryIds', () => {
  it('returns the ids of categories flagged isFixed', () => {
    const categories = [
      makeCategory({ id: 'cat-1', isFixed: false }),
      makeCategory({ id: 'cat-arriendo', isFixed: true }),
    ];
    expect(getFixedCategoryIds(categories)).toEqual(new Set(['cat-arriendo']));
  });

  it('returns an empty set when no category is flagged', () => {
    expect(getFixedCategoryIds([makeCategory()])).toEqual(new Set());
  });
});
