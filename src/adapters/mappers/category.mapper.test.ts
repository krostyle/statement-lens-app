import { describe, it, expect } from 'vitest';
import { toCategoryDTO } from './category.mapper';
import type { Category } from '@/src/domain/entities/category';

describe('toCategoryDTO', () => {
  it('maps a domain Category to its response DTO, dropping timestamps', () => {
    const category: Category = {
      id: 'cat-1',
      userId: 'user-1',
      name: 'Alimentación',
      color: '#f97316',
      icon: 'ShoppingCart',
      type: 'needs',
      isDefault: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    const dto = toCategoryDTO(category);

    expect(dto).toEqual({
      id: 'cat-1',
      userId: 'user-1',
      name: 'Alimentación',
      color: '#f97316',
      icon: 'ShoppingCart',
      isDefault: true,
    });
    expect(dto).not.toHaveProperty('createdAt');
    expect(dto).not.toHaveProperty('updatedAt');
  });

  it('preserves a null icon', () => {
    const category: Category = {
      id: 'cat-1',
      userId: 'user-1',
      name: 'Otros',
      color: '#999999',
      icon: null,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(toCategoryDTO(category).icon).toBeNull();
  });
});
