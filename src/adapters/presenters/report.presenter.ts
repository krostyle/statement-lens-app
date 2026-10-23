import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import type { ReportDataDTO } from '@/src/application/use-cases/reports/get-report-data.use-case';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';
import {
  filterReportTransactions,
  groupExpenses,
  type ReportContext,
  type ReportDimension,
  type ReportFilters,
} from '@/src/domain/services/report.service';

export interface ReportModelOptions {
  comparisonDimension?: ReportDimension;
  comparisonLimit?: number;
}

export interface ComparisonRow {
  key: string;
  label: string;
  prev: number;
  current: number;
  /** Percent change vs. previous month. */
  change: number;
}

/**
 * Everything the report builder renders, derived from the raw report data + the user's
 * filters. Filters apply uniformly — to the report month, the previous month and the trend —
 * so a "Solo Santander" report stays internally consistent.
 */
export function buildReportModel(
  data: ReportDataDTO,
  filters: ReportFilters,
  opts: ReportModelOptions = {},
) {
  const { comparisonDimension = 'category', comparisonLimit = 8 } = opts;
  const ctx: ReportContext = { categories: new Map(data.categories.map((c) => [c.id, c])) };
  const fixedIds = new Set(data.categories.filter((c) => c.isFixed).map((c) => c.id));
  const excludedIds = filters.includeReimbursed
    ? new Set<string>()
    : new Set(data.categories.filter((c) => c.excludeFromBudget).map((c) => c.id));

  // Budgets follow the same scope as the spend they're compared to — otherwise a pending
  // fixed commitment from a filtered-out category would inflate the projection.
  const scopedBudgets = data.budgets.filter((b) =>
    !excludedIds.has(b.categoryId) &&
    (filters.categoryIds.length === 0 || filters.categoryIds.includes(b.categoryId)),
  );
  const budgetsByCategory = new Map(scopedBudgets.map((b) => [b.categoryId, b.amount]));

  // Budgets aren't split by bank or card, and we can't know which channel a pending fixed
  // commitment (e.g. rent paid from checking) will post to — so a channel-filtered report
  // shows no total budget and projects only from what actually posted.
  const channelFiltered = filters.banks.length > 0 || filters.sources.length > 0;
  const projectionFixedIds = channelFiltered ? new Set<string>() : fixedIds;

  const filtered = (month: string): SnapshotTransaction[] =>
    filterReportTransactions(data.transactionsByMonth[month] ?? [], filters, ctx);
  const metricsFor = (month: string, txs: SnapshotTransaction[], budgets = new Map<string, number>()) =>
    computeSnapshotMetrics(txs, budgets, month, excludedIds, projectionFixedIds);

  const current = filtered(data.month);
  const metrics = metricsFor(data.month, current, budgetsByCategory);

  const expenses = current.filter((t) => t.transactionType === 'expense');
  const income = current.filter((t) => t.transactionType === 'income' && t.amount > 0);
  const transfers = current.filter((t) => t.transactionType === 'transfer');

  const totalBudget = scopedBudgets.reduce((s, b) => s + b.amount, 0);
  const budget = totalBudget > 0 && !channelFiltered
    ? {
        total: totalBudget,
        spent: metrics.totalExpenses,
        projected: metrics.projectedMonthTotal,
        pct: Math.round((metrics.projectedMonthTotal / totalBudget) * 100),
        available: totalBudget - metrics.projectedMonthTotal,
      }
    : null;

  const categoryRows = metrics.byCategory.map((c) => ({
    ...c,
    isFixed: fixedIds.has(c.categoryId),
    isOver: c.budget !== null && c.total > c.budget,
  }));

  // ── Previous month ────────────────────────────────────────────────────────
  const prevMonth = data.months.length > 1 ? data.months[data.months.length - 2] : null;
  let comparison: {
    prevMonth: string; prevTotal: number; total: number; change: number; rows: ComparisonRow[];
  } | null = null;
  if (prevMonth) {
    const prevTxs = filtered(prevMonth);
    const prevTotal = metricsFor(prevMonth, prevTxs).totalExpenses;
    if (prevTotal > 0) {
      const sort = { sortBy: 'total' as const, dir: 'desc' as const };
      const prevGroups = new Map(groupExpenses(prevTxs, [comparisonDimension], sort, ctx).map((g) => [g.key, g]));
      const rows = groupExpenses(current, [comparisonDimension], sort, ctx)
        .map((g) => {
          const prev = prevGroups.get(g.key);
          if (!prev || prev.total <= 0) return null;
          return { key: g.key, label: g.label, prev: prev.total, current: g.total, change: ((g.total - prev.total) / prev.total) * 100 };
        })
        .filter((r): r is ComparisonRow => r !== null)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || b.current - a.current)
        .slice(0, comparisonLimit);
      comparison = {
        prevMonth,
        prevTotal,
        total: metrics.totalExpenses,
        change: ((metrics.totalExpenses - prevTotal) / prevTotal) * 100,
        rows,
      };
    }
  }

  // ── Trend + rolling savings rate ─────────────────────────────────────────
  let windowIncome = 0;
  let windowExpenses = 0;
  const trend: { month: string; total: number }[] = [];
  for (const month of data.months) {
    const m = metricsFor(month, filtered(month));
    windowIncome += m.totalIncome;
    windowExpenses += m.totalExpenses;
    if (m.totalExpenses > 0) trend.push({ month, total: m.totalExpenses });
  }
  const savingsRate6m = windowIncome > 0
    ? { rate: Math.round((1 - windowExpenses / windowIncome) * 100), months: trend.length }
    : null;
  const savingsRateMonth = metrics.totalIncome > 0
    ? Math.round((1 - metrics.totalExpenses / metrics.totalIncome) * 100)
    : null;

  return {
    ctx,
    excludedIds,
    fixedIds,
    current,
    expenses,
    income,
    transfers,
    metrics,
    budget,
    channelFiltered,
    categoryRows,
    comparison,
    trend,
    savingsRate6m,
    savingsRateMonth,
  };
}

export type ReportModel = ReturnType<typeof buildReportModel>;
