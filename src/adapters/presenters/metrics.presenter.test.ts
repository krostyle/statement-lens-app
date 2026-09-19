import { describe, it, expect } from 'vitest';
import { buildMetrics } from './metrics.presenter';
import type { Transaction } from '@/src/domain/entities/transaction';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2024-03-15'),
    description: 'Gasto',
    merchant: 'Lider',
    amount: -10000,
    currency: 'CLP',
    bank: '',
    accountType: '',
    isInstallment: false,
    notes: null,
    reviewStatus: 'confirmed',
    transactionType: 'expense',
    origin: 'manual',
    accountingMonth: '2024-03',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('buildMetrics', () => {
  it('computes current/previous totals and percent change', () => {
    const currentTxs = [makeTransaction({ amount: -20000 })];
    const previousTxs = [makeTransaction({ amount: -10000 })];

    const result = buildMetrics({
      currentTxs,
      previousTxs,
      currentPeriod: '2024-03',
      scopeTxs: [...currentTxs, ...previousTxs],
      filterMode: 'month',
    });

    expect(result.currentMonthTotal).toBe(20000);
    expect(result.previousMonthTotal).toBe(10000);
    expect(result.percentChange).toBe(100);
  });

  it('percentChange is 0 when the previous period has no spend', () => {
    const result = buildMetrics({
      currentTxs: [makeTransaction({ amount: -20000 })],
      previousTxs: [],
      currentPeriod: '2024-03',
      scopeTxs: [],
      filterMode: 'month',
    });

    expect(result.percentChange).toBe(0);
  });

  it('computes dailyAverage using the number of days in the given period', () => {
    // March 2024 has 31 days
    const result = buildMetrics({
      currentTxs: [makeTransaction({ amount: -31000 })],
      previousTxs: [],
      currentPeriod: '2024-03',
      scopeTxs: [],
      filterMode: 'month',
    });

    expect(result.dailyAverage).toBe(1000);
  });

  it('returns a null savingsRate when there is no income', () => {
    const result = buildMetrics({
      currentTxs: [makeTransaction({ amount: -10000 })],
      previousTxs: [],
      currentPeriod: '2024-03',
      scopeTxs: [],
      filterMode: 'month',
    });

    expect(result.totalIncome).toBe(0);
    expect(result.savingsRate).toBeNull();
  });

  it('computes savingsRate from income vs. expenses', () => {
    const currentTxs = [
      makeTransaction({ amount: -30000, transactionType: 'expense' }),
      makeTransaction({ amount: 100000, transactionType: 'income' }),
    ];
    const result = buildMetrics({
      currentTxs,
      previousTxs: [],
      currentPeriod: '2024-03',
      scopeTxs: [],
      filterMode: 'month',
    });

    expect(result.totalIncome).toBe(100000);
    expect(result.savingsRate).toBe(70);
  });

  it('sorts topCategories by net spend descending', () => {
    const currentTxs = [
      makeTransaction({ categoryId: 'cat-1', amount: -5000 }),
      makeTransaction({ categoryId: 'cat-2', amount: -20000 }),
    ];
    const result = buildMetrics({
      currentTxs,
      previousTxs: [],
      currentPeriod: '2024-03',
      scopeTxs: [],
      filterMode: 'month',
    });

    expect(result.topCategories[0]).toEqual({ categoryId: 'cat-2', total: 20000 });
    expect(result.topCategories[1]).toEqual({ categoryId: 'cat-1', total: 5000 });
  });

  it('preserves the requested filterMode', () => {
    const result = buildMetrics({
      currentTxs: [],
      previousTxs: [],
      currentPeriod: '2024-03',
      scopeTxs: [],
      filterMode: 'default',
    });

    expect(result.filterMode).toBe('default');
  });
});
