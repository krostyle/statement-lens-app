import { describe, it, expect } from 'vitest';
import { ListBudgetsUseCase } from './list-budgets.use-case';
import { createMockBudgetRepo } from '@/src/test/mocks/budget-repository.mock';
import type { Budget } from '@/src/domain/entities/budget';

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    month: '2024-03',
    monthlyAmount: 100000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ListBudgetsUseCase', () => {
  it('returns budgets for the user scoped to the given month', async () => {
    const repo = createMockBudgetRepo([
      makeBudget({ id: 'b-1', userId: 'user-1', month: '2024-03' }),
      makeBudget({ id: 'b-2', userId: 'user-1', month: '2024-04' }),
      makeBudget({ id: 'b-3', userId: 'other-user', month: '2024-03' }),
    ]);
    const useCase = new ListBudgetsUseCase(repo);

    const result = await useCase.execute('user-1', '2024-03');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b-1');
  });

  it('returns an empty array when there are no budgets for that month', async () => {
    const repo = createMockBudgetRepo([]);
    const useCase = new ListBudgetsUseCase(repo);

    const result = await useCase.execute('user-1', '2024-03');

    expect(result).toEqual([]);
  });
});
