import { describe, it, expect } from 'vitest';
import { RecommendBudgetsUseCase } from './recommend-budgets.use-case';
import { createMockTransactionRepo } from '@/src/test/mocks/transaction-repository.mock';
import { createMockCategoryRepo } from '@/src/test/mocks/category-repository.mock';
import { createMockBudgetRepo } from '@/src/test/mocks/budget-repository.mock';
import type { Transaction } from '@/src/domain/entities/transaction';
import type { Category } from '@/src/domain/entities/category';
import type { Budget } from '@/src/domain/entities/budget';
import type { UserProfilePrismaRepository, UserProfile } from '@/src/infrastructure/database/repositories/user-profile.prisma.repository';

function monthsAgo(n: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 15));
}

function makeUserProfileRepo(monthlyIncome: number | null): UserProfilePrismaRepository {
  return {
    findById: async (): Promise<UserProfile | null> => ({ clerkId: 'user-1', monthlyIncome }),
  } as unknown as UserProfilePrismaRepository;
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    userId: 'user-1',
    categoryId: 'cat-1',
    date: monthsAgo(1),
    description: 'Gasto',
    merchant: 'Merchant',
    amount: -100000,
    currency: 'CLP',
    bank: '',
    accountType: '',
    isInstallment: false,
    notes: null,
    reviewStatus: 'confirmed',
    transactionType: 'expense',
    origin: 'manual',
    accountingMonth: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const needsCategory: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Alimentación',
  color: '#f97316',
  icon: 'ShoppingCart',
  type: 'needs',
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RecommendBudgetsUseCase', () => {
  it('returns an empty array when there are no transactions', async () => {
    const useCase = new RecommendBudgetsUseCase(
      createMockTransactionRepo([]),
      createMockCategoryRepo([needsCategory]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(null),
    );

    expect(await useCase.execute('user-1')).toEqual([]);
  });

  it('ignores transactions whose category no longer exists', async () => {
    const useCase = new RecommendBudgetsUseCase(
      createMockTransactionRepo([makeTransaction({ categoryId: 'cat-deleted' })]),
      createMockCategoryRepo([needsCategory]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(null),
    );

    expect(await useCase.execute('user-1')).toEqual([]);
  });

  it('without income: recommends based on typical spend and marks trend "none" with no existing budget', async () => {
    const transactions = [
      makeTransaction({ date: monthsAgo(1), amount: -50000 }),
      makeTransaction({ date: monthsAgo(2), amount: -50000 }),
      makeTransaction({ date: monthsAgo(3), amount: -50000 }),
    ];
    const useCase = new RecommendBudgetsUseCase(
      createMockTransactionRepo(transactions),
      createMockCategoryRepo([needsCategory]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(null),
    );

    const [result] = await useCase.execute('user-1');

    expect(result.categoryId).toBe('cat-1');
    expect(result.trend).toBe('none');
    expect(result.currentBudget).toBeNull();
    expect(result.recommendedAmount).toBeGreaterThan(0);
  });

  it('without income: when over an existing budget, recommends keeping the current budget amount', async () => {
    const transactions = [
      makeTransaction({ date: monthsAgo(1), amount: -200000 }),
      makeTransaction({ date: monthsAgo(2), amount: -200000 }),
      makeTransaction({ date: monthsAgo(3), amount: -200000 }),
    ];
    const budget: Budget = {
      id: 'b-1',
      userId: 'user-1',
      categoryId: 'cat-1',
      month: '2024-03',
      monthlyAmount: 50000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const useCase = new RecommendBudgetsUseCase(
      createMockTransactionRepo(transactions),
      createMockCategoryRepo([needsCategory]),
      createMockBudgetRepo([budget]),
      makeUserProfileRepo(null),
    );

    const [result] = await useCase.execute('user-1');

    expect(result.trend).toBe('over');
    expect(result.recommendedAmount).toBe(50000);
  });

  it('treats a category with only one active month as sporadic', async () => {
    const useCase = new RecommendBudgetsUseCase(
      createMockTransactionRepo([makeTransaction({ date: monthsAgo(1), amount: -120000 })]),
      createMockCategoryRepo([needsCategory]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(null),
    );

    const [result] = await useCase.execute('user-1');

    expect(result.reason).toContain('esporádico');
    // totalSpend / 12 rounded to nearest 1000
    expect(result.recommendedAmount).toBe(10000);
  });

  it('with income: caps the recommendation using the 50/30/20 bucket allocation', async () => {
    const transactions = [
      makeTransaction({ date: monthsAgo(1), amount: -800000 }),
      makeTransaction({ date: monthsAgo(2), amount: -800000 }),
      makeTransaction({ date: monthsAgo(3), amount: -800000 }),
    ];
    const useCase = new RecommendBudgetsUseCase(
      createMockTransactionRepo(transactions),
      createMockCategoryRepo([needsCategory]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(1000000),
    );

    const [result] = await useCase.execute('user-1');

    // Single "needs" category absorbs the whole 50% bucket (500,000), which is below avgSpend.
    expect(result.recommendedAmount).toBeLessThanOrEqual(500000);
    expect(result.reason).toContain('necesidades');
  });
});
