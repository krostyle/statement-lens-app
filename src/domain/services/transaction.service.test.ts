import { describe, it, expect } from 'vitest';
import {
  calculateTotalExpenses,
  groupByMonth,
  getTopMerchants,
  detectSubscriptions,
} from './transaction.service';
import type { Transaction } from '../entities/transaction';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    userId: 'user1',
    categoryId: 'cat1',
    date: new Date('2024-03-15'),
    description: 'Test',
    merchant: 'Merchant A',
    amount: -1000,
    currency: 'CLP',
    isInstallment: false,
    installmentNum: null,
    installmentTotal: null,
    statementId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('calculateTotalExpenses', () => {
  it('sums absolute values of negative transactions', () => {
    const txs = [makeTransaction({ amount: -500 }), makeTransaction({ amount: -300 })];
    expect(calculateTotalExpenses(txs)).toBe(800);
  });

  it('ignores credits (positive amounts)', () => {
    const txs = [makeTransaction({ amount: -500 }), makeTransaction({ amount: 200 })];
    expect(calculateTotalExpenses(txs)).toBe(500);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotalExpenses([])).toBe(0);
  });
});

describe('groupByMonth', () => {
  it('groups expenses by YYYY-MM key', () => {
    const txs = [
      makeTransaction({ amount: -100, date: new Date('2024-01-10') }),
      makeTransaction({ amount: -200, date: new Date('2024-01-20') }),
      makeTransaction({ amount: -300, date: new Date('2024-02-05') }),
    ];
    const result = groupByMonth(txs);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ month: '2024-01', total: 300 });
    expect(result[1]).toEqual({ month: '2024-02', total: 300 });
  });

  it('excludes credits from grouping', () => {
    const txs = [makeTransaction({ amount: 500 }), makeTransaction({ amount: -100, date: new Date('2024-03-01') })];
    const result = groupByMonth(txs);
    expect(result).toHaveLength(1);
  });
});

describe('getTopMerchants', () => {
  it('returns merchants sorted by total spend descending', () => {
    const txs = [
      makeTransaction({ merchant: 'A', amount: -100 }),
      makeTransaction({ merchant: 'A', amount: -200 }),
      makeTransaction({ merchant: 'B', amount: -500 }),
    ];
    const result = getTopMerchants(txs);
    expect(result[0].merchant).toBe('B');
    expect(result[0].total).toBe(500);
    expect(result[1].merchant).toBe('A');
    expect(result[1].total).toBe(300);
    expect(result[1].count).toBe(2);
  });

  it('respects limit parameter', () => {
    const txs = Array.from({ length: 5 }, (_, i) =>
      makeTransaction({ merchant: `Merchant ${i}`, amount: -(i + 1) * 100 })
    );
    const result = getTopMerchants(txs, 3);
    expect(result).toHaveLength(3);
  });
});

describe('detectSubscriptions', () => {
  it('detects merchants with same amount appearing 2+ times', () => {
    const txs = [
      makeTransaction({ merchant: 'Netflix', amount: -1500 }),
      makeTransaction({ merchant: 'Netflix', amount: -1500 }),
      makeTransaction({ merchant: 'Spotify', amount: -500 }),
    ];
    const result = detectSubscriptions(txs);
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe('Netflix');
    expect(result[0].occurrences).toBe(2);
  });

  it('does not flag merchants with only 1 occurrence', () => {
    const txs = [makeTransaction({ merchant: 'Amazon', amount: -2000 })];
    expect(detectSubscriptions(txs)).toHaveLength(0);
  });
});
