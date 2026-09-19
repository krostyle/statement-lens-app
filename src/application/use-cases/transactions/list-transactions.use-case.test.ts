import { describe, it, expect } from 'vitest';
import { ListTransactionsUseCase } from './list-transactions.use-case';
import { createMockTransactionRepo } from '@/src/test/mocks/transaction-repository.mock';
import type { Transaction } from '@/src/domain/entities/transaction';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2024-03-15'),
    description: 'Supermercado',
    merchant: 'Lider',
    amount: -15000,
    currency: 'CLP',
    bank: '',
    accountType: '',
    isInstallment: false,
    notes: null,
    reviewStatus: 'pending',
    transactionType: 'expense',
    origin: 'manual',
    accountingMonth: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ListTransactionsUseCase', () => {
  it('paginates results and returns totals + summary', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeTransaction({ id: `tx-${i}`, amount: -1000 * (i + 1) })
    );
    const repo = createMockTransactionRepo(rows);
    const useCase = new ListTransactionsUseCase(repo);

    const result = await useCase.execute('user-1', undefined, 1, 2);

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.totalPages).toBe(3);
    expect(result.summary.count).toBe(5);
  });

  it('scopes results to the requesting user', async () => {
    const repo = createMockTransactionRepo([
      makeTransaction({ id: 'tx-1', userId: 'user-1' }),
      makeTransaction({ id: 'tx-2', userId: 'other-user' }),
    ]);
    const useCase = new ListTransactionsUseCase(repo);

    const result = await useCase.execute('user-1');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('tx-1');
  });

  it('returns an empty page with zeroed summary when there is no data', async () => {
    const repo = createMockTransactionRepo([]);
    const useCase = new ListTransactionsUseCase(repo);

    const result = await useCase.execute('user-1');

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.summary).toEqual({ expenses: 0, income: 0, count: 0 });
  });
});
