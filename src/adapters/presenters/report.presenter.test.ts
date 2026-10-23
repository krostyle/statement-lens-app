import { describe, it, expect } from 'vitest';
import { buildReportModel } from './report.presenter';
import { DEFAULT_REPORT_FILTERS } from '@/src/domain/services/report.service';
import type { ReportDataDTO } from '@/src/application/use-cases/reports/get-report-data.use-case';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

let seq = 0;
function tx(overrides: Partial<SnapshotTransaction> = {}): SnapshotTransaction {
  return {
    id: `tx-${++seq}`,
    date: '2024-03-05',
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

const MONTHS = ['2023-10', '2023-11', '2023-12', '2024-01', '2024-02', '2024-03'];

function data(byMonth: Partial<Record<string, SnapshotTransaction[]>>, extra: Partial<ReportDataDTO> = {}): ReportDataDTO {
  return {
    month: '2024-03',
    months: MONTHS,
    transactionsByMonth: Object.fromEntries(MONTHS.map((m) => [m, byMonth[m] ?? []])),
    categories: [
      { id: 'cat-food', name: 'Alimentación', isFixed: false, excludeFromBudget: false },
      { id: 'cat-rent', name: 'Arriendo', isFixed: true, excludeFromBudget: false },
      { id: 'cat-extra', name: 'Tarjeta adicional', isFixed: false, excludeFromBudget: true },
    ],
    budgets: [],
    ...extra,
  };
}

describe('buildReportModel', () => {
  it('compares the budget against the projection, including a pending fixed commitment', () => {
    const model = buildReportModel(
      data({ '2024-03': [tx({ amount: -100000 })] }, {
        budgets: [
          { categoryId: 'cat-food', amount: 200000 },
          { categoryId: 'cat-rent', amount: 500000 },
        ],
      }),
      DEFAULT_REPORT_FILTERS,
    );

    // March 2024 is a closed month: projection = posted spend + rent not yet posted.
    expect(model.budget).toEqual({
      total: 700000,
      spent: 100000,
      projected: 600000,
      pct: 86,
      available: 100000,
    });
  });

  it('leaves reimbursed categories out of totals unless asked to include them', () => {
    const d = data({ '2024-03': [tx({ amount: -10000 }), tx({ categoryId: 'cat-extra', categoryName: 'Tarjeta adicional', amount: -90000 })] });

    expect(buildReportModel(d, DEFAULT_REPORT_FILTERS).metrics.totalExpenses).toBe(10000);
    expect(buildReportModel(d, { ...DEFAULT_REPORT_FILTERS, includeReimbursed: true }).metrics.totalExpenses).toBe(100000);
  });

  it('flags fixed and over-budget categories in the category rows', () => {
    const model = buildReportModel(
      data({ '2024-03': [tx({ amount: -250000 }), tx({ categoryId: 'cat-rent', categoryName: 'Arriendo', amount: -500000 })] }, {
        budgets: [{ categoryId: 'cat-food', amount: 200000 }],
      }),
      DEFAULT_REPORT_FILTERS,
    );

    expect(model.categoryRows.map((r) => [r.categoryName, r.isFixed, r.isOver])).toEqual([
      ['Arriendo', true, false],
      ['Alimentación', false, true],
    ]);
  });

  it('separates income, transfers and expenses (returns included) for the tables', () => {
    const model = buildReportModel(
      data({ '2024-03': [
        tx({ id: 'buy' }),
        tx({ id: 'ret', amount: 3000 }),
        tx({ id: 'sal', transactionType: 'income', amount: 900000 }),
        tx({ id: 'pay', transactionType: 'transfer', amount: -200000 }),
      ] }),
      DEFAULT_REPORT_FILTERS,
    );

    expect(model.expenses.map((t) => t.id).sort()).toEqual(['buy', 'ret']);
    expect(model.income.map((t) => t.id)).toEqual(['sal']);
    expect(model.transfers.map((t) => t.id)).toEqual(['pay']);
  });

  it('compares against the previous month by the chosen dimension', () => {
    const model = buildReportModel(
      data({
        '2024-02': [tx({ date: '2024-02-03', amount: -10000 }), tx({ date: '2024-02-04', merchant: 'Jumbo', amount: -20000 })],
        '2024-03': [tx({ amount: -15000 }), tx({ merchant: 'Jumbo', amount: -10000 }), tx({ merchant: 'Nuevo', amount: -1000 })],
      }),
      DEFAULT_REPORT_FILTERS,
      { comparisonDimension: 'merchant' },
    );

    expect(model.comparison?.prevMonth).toBe('2024-02');
    expect(model.comparison?.prevTotal).toBe(30000);
    expect(model.comparison?.total).toBe(26000);
    expect(model.comparison?.change).toBeCloseTo(-13.33, 1);
    expect(model.comparison?.rows.map((r) => [r.label, r.prev, r.current, Math.round(r.change)])).toEqual([
      ['Lider', 10000, 15000, 50],
      ['Jumbo', 20000, 10000, -50],
    ]);
  });

  it('has no comparison when the previous month had no spend', () => {
    expect(buildReportModel(data({ '2024-03': [tx()] }), DEFAULT_REPORT_FILTERS).comparison).toBeNull();
  });

  it('builds the trend and rolling savings rate from months with data, respecting filters', () => {
    const d = data({
      '2024-01': [tx({ date: '2024-01-03', amount: -40000 }), tx({ date: '2024-01-03', bank: 'falabella', amount: -99000 })],
      '2024-03': [tx({ amount: -60000 }), tx({ transactionType: 'income', amount: 400000 })],
    });

    const model = buildReportModel(d, { ...DEFAULT_REPORT_FILTERS, banks: ['santander'] });

    expect(model.trend).toEqual([
      { month: '2024-01', total: 40000 },
      { month: '2024-03', total: 60000 },
    ]);
    expect(model.savingsRate6m).toEqual({ rate: 75, months: 2 });
  });

  it('drops the total budget and pending fixed commitments when filtering by bank or source', () => {
    // Budgets aren't split by bank/card, and a pending rent paid from checking must not
    // inflate a credit-card-only projection.
    const model = buildReportModel(
      data({ '2024-03': [tx({ amount: -100000 })] }, {
        budgets: [{ categoryId: 'cat-food', amount: 200000 }, { categoryId: 'cat-rent', amount: 500000 }],
      }),
      { ...DEFAULT_REPORT_FILTERS, sources: ['credit_card'] },
    );

    expect(model.budget).toBeNull();
    expect(model.metrics.projectedMonthTotal).toBe(100000);
  });

  it('scopes the total budget to the selected categories', () => {
    const model = buildReportModel(
      data({ '2024-03': [tx()] }, {
        budgets: [{ categoryId: 'cat-food', amount: 100000 }, { categoryId: 'cat-rent', amount: 500000 }],
      }),
      { ...DEFAULT_REPORT_FILTERS, categoryIds: ['cat-food'] },
    );

    expect(model.budget?.total).toBe(100000);
  });
});
