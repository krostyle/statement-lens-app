import { describe, it, expect } from 'vitest';
import { UpsertBudgetUseCase } from './upsert-budget.use-case';
import { createMockBudgetRepo } from '@/src/test/mocks/budget-repository.mock';
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

describe('UpsertBudgetUseCase', () => {
  it('creates a budget for a category owned by the user', async () => {
    const catRepo = createMockCategoryRepo([makeCategory()]);
    const useCase = new UpsertBudgetUseCase(createMockBudgetRepo(), catRepo);

    const result = await useCase.execute('user-1', 'cat-1', 150000, '2024-03');

    expect(result.categoryId).toBe('cat-1');
    expect(result.monthlyAmount).toBe(150000);
    expect(result.month).toBe('2024-03');
  });

  it('updates the amount when a budget already exists for that category/month', async () => {
    const catRepo = createMockCategoryRepo([makeCategory()]);
    const budgetRepo = createMockBudgetRepo();
    const useCase = new UpsertBudgetUseCase(budgetRepo, catRepo);

    await useCase.execute('user-1', 'cat-1', 100000, '2024-03');
    const result = await useCase.execute('user-1', 'cat-1', 200000, '2024-03');

    expect(result.monthlyAmount).toBe(200000);
    expect(await budgetRepo.findByUserId('user-1', '2024-03')).toHaveLength(1);
  });

  it('throws when the category does not exist', async () => {
    const useCase = new UpsertBudgetUseCase(createMockBudgetRepo(), createMockCategoryRepo([]));

    await expect(useCase.execute('user-1', 'cat-missing', 100000, '2024-03')).rejects.toThrow(
      'Category not found'
    );
  });

  it('throws when the category belongs to another user', async () => {
    const catRepo = createMockCategoryRepo([makeCategory({ userId: 'other-user' })]);
    const useCase = new UpsertBudgetUseCase(createMockBudgetRepo(), catRepo);

    await expect(useCase.execute('user-1', 'cat-1', 100000, '2024-03')).rejects.toThrow('Category not found');
  });
});
