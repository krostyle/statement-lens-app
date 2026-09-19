import { describe, it, expect } from 'vitest';
import { ListCategoriesUseCase } from './list-categories.use-case';
import { createMockCategoryRepo } from '@/src/test/mocks/category-repository.mock';
import type { Category } from '@/src/domain/entities/category';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Alimentación',
    color: '#f97316',
    icon: 'ShoppingCart',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ListCategoriesUseCase', () => {
  it('returns only categories belonging to the user, mapped to DTO', async () => {
    const repo = createMockCategoryRepo([
      makeCategory({ id: 'cat-1', userId: 'user-1', name: 'Alimentación' }),
      makeCategory({ id: 'cat-2', userId: 'user-1', name: 'Transporte' }),
      makeCategory({ id: 'cat-3', userId: 'other-user', name: 'Otro' }),
    ]);
    const useCase = new ListCategoriesUseCase(repo);

    const result = await useCase.execute('user-1');

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name).sort()).toEqual(['Alimentación', 'Transporte']);
    expect(result.every((c) => c.userId === 'user-1')).toBe(true);
  });

  it('returns an empty array when the user has no categories', async () => {
    const repo = createMockCategoryRepo([]);
    const useCase = new ListCategoriesUseCase(repo);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([]);
  });
});
