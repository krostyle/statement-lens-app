import { describe, it, expect } from 'vitest';
import { GetReportDataUseCase } from './get-report-data.use-case';
import { createMockTransactionRepo } from '@/src/test/mocks/transaction-repository.mock';
import { createMockCategoryRepo } from '@/src/test/mocks/category-repository.mock';
import { createMockBudgetRepo } from '@/src/test/mocks/budget-repository.mock';
import type { Transaction } from '@/src/domain/entities/transaction';
import type { Category } from '@/src/domain/entities/category';
import type { Budget } from '@/src/domain/entities/budget';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2026-10-05T00:00:00Z'),
    description: 'Supermercado',
    merchant: 'Lider',
    amount: -15000,
    currency: 'CLP',
    bank: 'santander',
    accountType: 'credit_card',
    isInstallment: false,
    reviewStatus: 'auto',
    transactionType: 'expense',
    origin: 'tracking',
    accountingMonth: '2026-10',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const category: Category = {
  id: 'cat-1', userId: 'user-1', name: 'Alimentación', color: '#000', icon: null, type: null,
  isDefault: true, excludeFromBudget: false, isFixed: true, createdAt: new Date(), updatedAt: new Date(),
};

const budget = (overrides: Partial<Budget>): Budget => ({
  id: 'b-1', userId: 'user-1', categoryId: 'cat-1', month: '2026-10', monthlyAmount: 200000,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
});

function build(txs: Transaction[], budgets: Budget[] = []) {
  return new GetReportDataUseCase(
    createMockTransactionRepo(txs),
    createMockCategoryRepo([category, { ...category, id: 'cat-other', userId: 'user-2' }]),
    createMockBudgetRepo(budgets),
  );
}

describe('GetReportDataUseCase', () => {
  it('returns null when the month has no tracking data', async () => {
    const useCase = build([makeTx({ accountingMonth: '2026-09' })]);
    expect(await useCase.execute('user-1', '2026-10')).toBeNull();
  });

  it('returns a six-month window ending at the report month, oldest first', async () => {
    const useCase = build([
      makeTx({ id: 'oct', accountingMonth: '2026-10' }),
      makeTx({ id: 'sep', accountingMonth: '2026-09', date: new Date('2026-09-10T00:00:00Z') }),
      makeTx({ id: 'apr', accountingMonth: '2026-04' }), // outside the window
      makeTx({ id: 'other-user', userId: 'user-2', accountingMonth: '2026-10' }),
    ]);

    const result = await useCase.execute('user-1', '2026-10');

    expect(result?.month).toBe('2026-10');
    expect(result?.months).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(result?.transactionsByMonth['2026-10'].map((t) => t.id)).toEqual(['oct']);
    expect(result?.transactionsByMonth['2026-09'].map((t) => t.id)).toEqual(['sep']);
    expect(result?.transactionsByMonth['2026-05']).toEqual([]);
  });

  it('maps transactions to the snapshot shape with category names', async () => {
    const result = await build([makeTx()]).execute('user-1', '2026-10');
    expect(result?.transactionsByMonth['2026-10'][0]).toMatchObject({
      id: 'tx-1', date: '2026-10-05', merchant: 'Lider', amount: -15000,
      categoryName: 'Alimentación', source: 'credit_card', bank: 'santander',
    });
  });

  it('includes only the user categories and the report month budgets', async () => {
    const result = await build([makeTx()], [
      budget({ id: 'b-oct' }),
      budget({ id: 'b-sep', month: '2026-09', monthlyAmount: 1 }),
    ]).execute('user-1', '2026-10');

    expect(result?.categories).toEqual([
      { id: 'cat-1', name: 'Alimentación', isFixed: true, excludeFromBudget: false },
    ]);
    expect(result?.budgets).toEqual([{ categoryId: 'cat-1', amount: 200000 }]);
  });

  it('crosses the year boundary correctly', async () => {
    const result = await build([makeTx({ accountingMonth: '2026-02' })]).execute('user-1', '2026-02');
    expect(result?.months).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
