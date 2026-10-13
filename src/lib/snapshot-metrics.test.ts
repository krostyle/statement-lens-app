import { describe, it, expect } from 'vitest';
import { computeSnapshotMetrics } from './snapshot-metrics';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

function makeTx(overrides: Partial<SnapshotTransaction> = {}): SnapshotTransaction {
  return {
    id: `tx-${Math.random()}`,
    date: '2024-03-10',
    description: 'Compra',
    merchant: 'Lider',
    amount: -10000,
    transactionType: 'expense',
    categoryId: 'cat-1',
    categoryName: 'Alimentación',
    source: 'credit_card',
    bank: 'santander',
    ...overrides,
  };
}

describe('computeSnapshotMetrics', () => {
  it('sums expenses and income, and computes daily average / projection', () => {
    const metrics = computeSnapshotMetrics(
      [makeTx({ amount: -30000, date: '2024-03-01' }), makeTx({ amount: 500000, transactionType: 'income' })],
      new Map(),
      '2024-01', // closed month → daysElapsed === daysInMonth (31)
    );

    expect(metrics.totalExpenses).toBe(30000);
    expect(metrics.totalIncome).toBe(500000);
    expect(metrics.daysInMonth).toBe(31);
    expect(metrics.daysElapsed).toBe(31);
    expect(metrics.dailyAverage).toBe(Math.round(30000 / 31));
    expect(metrics.projectedMonthTotal).toBe(Math.round((30000 / 31) * 31));
  });

  it('groups by category with budget comparison', () => {
    const metrics = computeSnapshotMetrics(
      [
        makeTx({ categoryId: 'cat-1', categoryName: 'Alimentación', amount: -20000 }),
        makeTx({ categoryId: 'cat-1', categoryName: 'Alimentación', amount: -10000 }),
        makeTx({ categoryId: 'cat-2', categoryName: 'Transporte', amount: -5000 }),
      ],
      new Map([['cat-1', 25000]]),
      '2024-01',
    );

    const cat1 = metrics.byCategory.find((c) => c.categoryId === 'cat-1')!;
    expect(cat1.total).toBe(30000);
    expect(cat1.budget).toBe(25000);
    expect(cat1.pctOfBudget).toBe(120);

    const cat2 = metrics.byCategory.find((c) => c.categoryId === 'cat-2')!;
    expect(cat2.budget).toBeNull();
    expect(cat2.pctOfBudget).toBeNull();
  });

  it('groups by merchant, flagging mixed categories with an empty categoryName', () => {
    const metrics = computeSnapshotMetrics(
      [
        makeTx({ merchant: 'Lider', categoryId: 'cat-1', categoryName: 'Alimentación', amount: -10000 }),
        makeTx({ merchant: 'Lider', categoryId: 'cat-2', categoryName: 'Hogar', amount: -5000 }),
      ],
      new Map(),
      '2024-01',
    );

    const lider = metrics.byMerchant.find((m) => m.merchant === 'Lider')!;
    expect(lider.total).toBe(15000);
    expect(lider.count).toBe(2);
    expect(lider.categoryName).toBe('');
  });

  it('excludes a category from totalExpenses/dailyAverage/projection when flagged, but keeps it in byCategory and byMerchant', () => {
    const txs = [
      makeTx({ categoryId: 'cat-own', categoryName: 'Alimentación', merchant: 'Lider', amount: -10000 }),
      makeTx({ categoryId: 'cat-amorcito', categoryName: 'Mi Amorcito', merchant: 'Falabella', amount: -90000 }),
    ];

    const metrics = computeSnapshotMetrics(txs, new Map(), '2024-01', new Set(['cat-amorcito']));

    expect(metrics.totalExpenses).toBe(10000);
    expect(metrics.dailyAverage).toBe(Math.round(10000 / 31));

    const amorcito = metrics.byCategory.find((c) => c.categoryId === 'cat-amorcito')!;
    expect(amorcito.total).toBe(90000);
    const byMerchant = metrics.byMerchant.find((m) => m.merchant === 'Falabella')!;
    expect(byMerchant.total).toBe(90000);
  });

  it('nets a return/credit note (positive amount) against purchases in the same category', () => {
    const metrics = computeSnapshotMetrics(
      [
        makeTx({ categoryId: 'cat-amorcito', categoryName: 'Mi Amorcito', merchant: 'Falabella', amount: -1435756 }),
        makeTx({ categoryId: 'cat-amorcito', categoryName: 'Mi Amorcito', merchant: 'Falabella', amount: 365896 }),
      ],
      new Map(),
      '2024-01',
    );

    expect(metrics.totalExpenses).toBe(1069860);
    const amorcito = metrics.byCategory.find((c) => c.categoryId === 'cat-amorcito')!;
    expect(amorcito.total).toBe(1069860);
  });

  it('drops a category entirely when its returns fully offset its purchases (net >= 0)', () => {
    const metrics = computeSnapshotMetrics(
      [
        makeTx({ categoryId: 'cat-1', amount: -10000 }),
        makeTx({ categoryId: 'cat-1', amount: 15000 }), // return exceeds the purchase
      ],
      new Map(),
      '2024-01',
    );

    expect(metrics.totalExpenses).toBe(0);
    expect(metrics.byCategory.find((c) => c.categoryId === 'cat-1')).toBeUndefined();
  });

  it('nets a return/credit note against the same merchant, floored at 0', () => {
    const metrics = computeSnapshotMetrics(
      [
        makeTx({ merchant: 'Falabella', categoryId: 'cat-1', amount: -50000 }),
        makeTx({ merchant: 'Falabella', categoryId: 'cat-1', amount: 20000 }),
      ],
      new Map(),
      '2024-01',
    );

    const falabella = metrics.byMerchant.find((m) => m.merchant === 'Falabella')!;
    expect(falabella.total).toBe(30000);
    expect(falabella.count).toBe(1); // only the purchase counts as an occurrence
  });

  it('omits a merchant entirely when its returns fully offset its purchases', () => {
    const metrics = computeSnapshotMetrics(
      [
        makeTx({ merchant: 'Falabella', amount: -10000 }),
        makeTx({ merchant: 'Falabella', amount: 10000 }),
      ],
      new Map(),
      '2024-01',
    );

    expect(metrics.byMerchant.find((m) => m.merchant === 'Falabella')).toBeUndefined();
  });

  it('with no excludedCategoryIds given, behaves exactly as before', () => {
    const metrics = computeSnapshotMetrics(
      [makeTx({ categoryId: 'cat-1', amount: -10000 })],
      new Map(),
      '2024-01',
    );
    expect(metrics.totalExpenses).toBe(10000);
  });
});
