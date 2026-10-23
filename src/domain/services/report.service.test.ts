import { describe, it, expect } from 'vitest';
import {
  filterReportTransactions,
  dimensionOf,
  groupExpenses,
  sortTransactions,
  sliceByDimension,
  DEFAULT_REPORT_FILTERS,
  type ReportContext,
  type ReportFilters,
} from './report.service';
import type { SnapshotTransaction } from '../entities/snapshot';

function tx(overrides: Partial<SnapshotTransaction> = {}): SnapshotTransaction {
  return {
    id: 'tx-1',
    date: '2026-10-05',
    description: 'Compra',
    merchant: 'Lider',
    amount: -10000,
    transactionType: 'expense',
    categoryId: 'cat-food',
    categoryName: 'Alimentación',
    source: 'credit_card',
    bank: 'santander',
    ...overrides,
  };
}

const ctx: ReportContext = {
  categories: new Map([
    ['cat-food', { id: 'cat-food', name: 'Alimentación', isFixed: false, excludeFromBudget: false }],
    ['cat-rent', { id: 'cat-rent', name: 'Arriendo', isFixed: true, excludeFromBudget: false }],
    ['cat-extra', { id: 'cat-extra', name: 'Tarjeta adicional', isFixed: false, excludeFromBudget: true }],
  ]),
};

const filters = (overrides: Partial<ReportFilters> = {}): ReportFilters => ({ ...DEFAULT_REPORT_FILTERS, ...overrides });

describe('filterReportTransactions', () => {
  it('keeps everything except reimbursed categories with default filters', () => {
    const txs = [
      tx({ id: 'a' }),
      tx({ id: 'b', categoryId: 'cat-extra' }),
      tx({ id: 'c', transactionType: 'income', amount: 500000 }),
    ];
    expect(filterReportTransactions(txs, filters(), ctx).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('includes reimbursed categories when asked', () => {
    const txs = [tx({ id: 'a' }), tx({ id: 'b', categoryId: 'cat-extra' })];
    const result = filterReportTransactions(txs, filters({ includeReimbursed: true }), ctx);
    expect(result.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('filters every transaction type by bank and source', () => {
    const txs = [
      tx({ id: 'a', bank: 'santander', source: 'credit_card' }),
      tx({ id: 'b', bank: 'falabella', source: 'credit_card' }),
      tx({ id: 'c', bank: 'santander', source: 'checking' }),
      tx({ id: 'd', bank: 'falabella', transactionType: 'income', amount: 1000 }),
    ];
    const result = filterReportTransactions(txs, filters({ banks: ['santander'], sources: ['credit_card'] }), ctx);
    expect(result.map((t) => t.id)).toEqual(['a']);
  });

  it('applies category, search and minimum amount only to expenses', () => {
    const txs = [
      tx({ id: 'a', categoryId: 'cat-food', merchant: 'Lider', amount: -50000 }),
      tx({ id: 'b', categoryId: 'cat-food', merchant: 'Jumbo', amount: -50000 }),
      tx({ id: 'c', categoryId: 'cat-food', merchant: 'Lider Express', amount: -900 }),
      tx({ id: 'd', categoryId: 'cat-rent', merchant: 'Lider', amount: -50000 }),
      tx({ id: 'e', transactionType: 'income', amount: 100, categoryId: 'cat-x', merchant: 'Sueldo' }),
    ];
    const result = filterReportTransactions(
      txs,
      filters({ categoryIds: ['cat-food'], search: 'lider', minAmount: 1000 }),
      ctx,
    );
    expect(result.map((t) => t.id)).toEqual(['a', 'e']);
  });

  it('search matches the description too, ignoring case and accents', () => {
    const txs = [tx({ id: 'a', merchant: 'X', description: 'Farmacia Ahumada' }), tx({ id: 'b' })];
    expect(filterReportTransactions(txs, filters({ search: 'ÁHUMADA' }), ctx).map((t) => t.id)).toEqual(['a']);
  });

  it('drops returns when includeReturns is false', () => {
    const txs = [tx({ id: 'a' }), tx({ id: 'b', amount: 3000 })];
    expect(filterReportTransactions(txs, filters({ includeReturns: false }), ctx).map((t) => t.id)).toEqual(['a']);
  });
});

describe('dimensionOf', () => {
  it('labels each dimension in plain Spanish', () => {
    const t = tx({ date: '2026-10-16', categoryId: 'cat-rent', categoryName: 'Arriendo', bank: 'liderbci', source: 'checking' });
    expect(dimensionOf(t, 'merchant', ctx)).toEqual({ key: 'Lider', label: 'Lider' });
    expect(dimensionOf(t, 'category', ctx)).toEqual({ key: 'cat-rent', label: 'Arriendo' });
    expect(dimensionOf(t, 'bank', ctx)).toEqual({ key: 'liderbci', label: 'LiderBCI' });
    expect(dimensionOf(t, 'source', ctx)).toEqual({ key: 'checking', label: 'Cuenta corriente' });
    expect(dimensionOf(t, 'nature', ctx)).toEqual({ key: 'fixed', label: 'Gastos fijos' });
    expect(dimensionOf(t, 'week', ctx)).toEqual({ key: 'w3', label: 'Días 15–21' });
  });

  it('falls back for missing bank, category and merchant', () => {
    const t = tx({ bank: '', categoryName: '', merchant: '', description: 'PAGO EN LINEA' });
    expect(dimensionOf(t, 'bank', ctx).label).toBe('Sin banco');
    expect(dimensionOf(t, 'category', ctx).label).toBe('Sin asignar');
    expect(dimensionOf(t, 'merchant', ctx).label).toBe('PAGO EN LINEA');
    expect(dimensionOf(tx({ date: '2026-10-31' }), 'week', ctx).label).toBe('Días 29–31');
  });
});

describe('groupExpenses', () => {
  const txs = [
    tx({ id: '1', merchant: 'Lider', amount: -30000, bank: 'santander' }),
    tx({ id: '2', merchant: 'Lider', amount: -10000, bank: 'falabella' }),
    tx({ id: '3', merchant: 'Lider', amount: 5000, bank: 'santander' }), // return
    tx({ id: '4', merchant: 'Jumbo', amount: -15000, bank: 'santander' }),
    tx({ id: '5', merchant: 'Sueldo', amount: 900000, transactionType: 'income' }),
    tx({ id: '6', merchant: 'Pago TC', amount: -200000, transactionType: 'transfer' }),
  ];

  it('nets returns into each group and ignores non-expense rows', () => {
    const groups = groupExpenses(txs, ['merchant'], { sortBy: 'total', dir: 'desc' }, ctx);
    expect(groups.map((g) => [g.label, g.total, g.count])).toEqual([
      ['Lider', 35000, 2],
      ['Jumbo', 15000, 1],
    ]);
    expect(groups[0].share).toBeCloseTo(35000 / 50000);
    expect(groups[0].transactions.map((t) => t.id)).toEqual(['1', '2', '3']);
  });

  it('nests a second dimension with its own totals and shares of the grand total', () => {
    const groups = groupExpenses(txs, ['bank', 'merchant'], { sortBy: 'total', dir: 'desc' }, ctx);
    expect(groups.map((g) => [g.label, g.total])).toEqual([
      ['Santander', 40000],
      ['Falabella', 10000],
    ]);
    expect(groups[0].children.map((c) => [c.label, c.total])).toEqual([
      ['Lider', 25000],
      ['Jumbo', 15000],
    ]);
    expect(groups[0].children[0].share).toBeCloseTo(25000 / 50000);
  });

  it('sorts groups by label, count or total in either direction', () => {
    const byLabel = groupExpenses(txs, ['merchant'], { sortBy: 'label', dir: 'asc' }, ctx);
    expect(byLabel.map((g) => g.label)).toEqual(['Jumbo', 'Lider']);
    const byCount = groupExpenses(txs, ['merchant'], { sortBy: 'count', dir: 'asc' }, ctx);
    expect(byCount.map((g) => g.label)).toEqual(['Jumbo', 'Lider']);
    const byTotalAsc = groupExpenses(txs, ['merchant'], { sortBy: 'total', dir: 'asc' }, ctx);
    expect(byTotalAsc.map((g) => g.label)).toEqual(['Jumbo', 'Lider']);
  });

  it('sorts week groups in calendar order when sorting by label', () => {
    const weekly = [tx({ id: 'a', date: '2026-10-20' }), tx({ id: 'b', date: '2026-10-02' }), tx({ id: 'c', date: '2026-10-30' })];
    const groups = groupExpenses(weekly, ['week'], { sortBy: 'label', dir: 'asc' }, ctx);
    expect(groups.map((g) => g.label)).toEqual(['Días 1–7', 'Días 15–21', 'Días 29–31']);
  });

  it('returns an empty list when there are no expenses', () => {
    expect(groupExpenses([tx({ transactionType: 'income', amount: 1 })], ['merchant'], { sortBy: 'total', dir: 'desc' }, ctx)).toEqual([]);
  });
});

describe('sortTransactions', () => {
  const txs = [
    tx({ id: 'a', date: '2026-10-03', amount: -500, merchant: 'Zara' }),
    tx({ id: 'b', date: '2026-10-09', amount: -9000, merchant: 'Apple' }),
    tx({ id: 'c', date: '2026-10-01', amount: 2000, merchant: 'Lider' }),
  ];

  it('sorts by date, spend amount or merchant without mutating the input', () => {
    expect(sortTransactions(txs, 'date', 'desc').map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(sortTransactions(txs, 'amount', 'desc').map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(sortTransactions(txs, 'merchant', 'asc').map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(txs.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('sliceByDimension', () => {
  it('folds everything past the slice limit into "Otros"', () => {
    const txs = ['A', 'B', 'C', 'D', 'E'].map((m, i) => tx({ id: m, merchant: m, amount: -(5 - i) * 1000 }));
    const slices = sliceByDimension(txs, 'merchant', ctx, 3);
    expect(slices.map((s) => [s.label, s.total])).toEqual([
      ['A', 5000],
      ['B', 4000],
      ['Otros', 6000],
    ]);
    expect(slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });

  it('leaves out groups whose returns cancel their purchases', () => {
    const txs = [tx({ id: 'a', merchant: 'A', amount: -1000 }), tx({ id: 'b', merchant: 'B', amount: -1000 }), tx({ id: 'c', merchant: 'B', amount: 1000 })];
    expect(sliceByDimension(txs, 'merchant', ctx).map((s) => s.label)).toEqual(['A']);
  });
});
