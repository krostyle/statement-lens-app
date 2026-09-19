import { describe, it, expect, vi } from 'vitest';
import { FinancialChatUseCase } from './financial-chat.use-case';
import { createMockTransactionRepo } from '@/src/test/mocks/transaction-repository.mock';
import { createMockCategoryRepo } from '@/src/test/mocks/category-repository.mock';
import { createMockBudgetRepo } from '@/src/test/mocks/budget-repository.mock';
import type { Transaction } from '@/src/domain/entities/transaction';
import type { Category } from '@/src/domain/entities/category';
import type { Budget } from '@/src/domain/entities/budget';
import type { UserProfilePrismaRepository, UserProfile } from '@/src/infrastructure/database/repositories/user-profile.prisma.repository';
import type { FinancialChatService, FinancialContext } from '@/src/infrastructure/ai/financial-chat.service';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2024-03-10'),
    description: 'Gasto',
    merchant: 'Lider',
    amount: -5000,
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

const category: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Alimentación',
  color: '#f97316',
  icon: 'ShoppingCart',
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeUserProfileRepo(monthlyIncome: number | null): UserProfilePrismaRepository {
  return {
    findById: async (): Promise<UserProfile | null> => ({ clerkId: 'user-1', monthlyIncome }),
  } as unknown as UserProfilePrismaRepository;
}

function makeChatService(): { service: FinancialChatService; streamChat: ReturnType<typeof vi.fn> } {
  const streamChat = vi.fn().mockReturnValue(new ReadableStream());
  return { service: { streamChat } as unknown as FinancialChatService, streamChat };
}

describe('FinancialChatUseCase', () => {
  it('builds context with income, spend by category, and recent expenses', async () => {
    const { service, streamChat } = makeChatService();
    const useCase = new FinancialChatUseCase(
      createMockTransactionRepo([makeTransaction()]),
      createMockCategoryRepo([category]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(1500000),
      service,
    );

    await useCase.execute('user-1', [{ role: 'user', content: 'Hola' }]);

    expect(streamChat).toHaveBeenCalledTimes(1);
    const context = streamChat.mock.calls[0][1] as FinancialContext;
    expect(context.monthlyIncome).toBe(1500000);
    expect(context.spendByCategory).toEqual([{ name: 'Alimentación', total: 5000, budget: undefined }]);
    expect(context.recentTransactions).toEqual([
      { date: '2024-03-10', merchant: 'Lider', amount: 5000, category: 'Alimentación' },
    ]);
    expect(context.currentMonthSnapshot).toBeUndefined();
  });

  it('includes budget alongside spend when a budget exists for the category', async () => {
    const { service, streamChat } = makeChatService();
    const budget: Budget = {
      id: 'b-1',
      userId: 'user-1',
      categoryId: 'cat-1',
      month: '2024-03',
      monthlyAmount: 20000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const useCase = new FinancialChatUseCase(
      createMockTransactionRepo([makeTransaction()]),
      createMockCategoryRepo([category]),
      createMockBudgetRepo([budget]),
      makeUserProfileRepo(null),
      service,
    );

    await useCase.execute('user-1', []);

    const context = streamChat.mock.calls[0][1] as FinancialContext;
    expect(context.spendByCategory[0].budget).toBe(20000);
    expect(context.monthlyIncome).toBeUndefined();
  });

  it('omits currentMonthSnapshot when there are no tracking transactions for the current month', async () => {
    const { service, streamChat } = makeChatService();
    const useCase = new FinancialChatUseCase(
      createMockTransactionRepo([]),
      createMockCategoryRepo([]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(null),
      service,
    );

    await useCase.execute('user-1', []);

    const context = streamChat.mock.calls[0][1] as FinancialContext;
    expect(context.currentMonthSnapshot).toBeUndefined();
  });

  it('returns the stream produced by the chat service', async () => {
    const { service } = makeChatService();
    const useCase = new FinancialChatUseCase(
      createMockTransactionRepo([]),
      createMockCategoryRepo([]),
      createMockBudgetRepo([]),
      makeUserProfileRepo(null),
      service,
    );

    const result = await useCase.execute('user-1', []);

    expect(result).toBeInstanceOf(ReadableStream);
  });
});
