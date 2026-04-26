import type { Transaction } from '@/src/domain/entities/transaction';
import {
  calculateTotalExpenses,
  groupByMonth,
  getTopMerchants,
  detectSubscriptions,
} from '@/src/domain/services/transaction.service';

export type MetricsFilterMode = 'default' | 'month';

export interface MetricsDTO {
  filterMode: MetricsFilterMode;
  currentMonthTotal: number;
  previousMonthTotal: number;
  percentChange: number;
  dailyAverage: number;
  topCategories: { categoryId: string; total: number }[];
  monthlyTrend: { month: string; total: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
  subscriptions: { merchant: string; amount: number; occurrences: number }[];
}

export function buildMetrics(params: {
  /** Transactions for the current period (used for KPI totals). */
  currentTxs: Transaction[];
  /** Transactions for the previous period (used for comparison KPI). */
  previousTxs: Transaction[];
  /** Label for the current period (YYYY-MM). */
  currentPeriod: string;
  /** All transactions in scope for trend chart, merchants, categories. */
  scopeTxs: Transaction[];
  filterMode: MetricsFilterMode;
}): MetricsDTO {
  const { currentTxs, previousTxs, currentPeriod, scopeTxs, filterMode } = params;

  const currentMonthTotal = calculateTotalExpenses(currentTxs);
  const previousMonthTotal = calculateTotalExpenses(previousTxs);
  const percentChange =
    previousMonthTotal === 0
      ? 0
      : ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;

  const [y, m] = currentPeriod.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dailyAverage = currentMonthTotal / daysInMonth;

  const monthlyTrend = groupByMonth(scopeTxs);

  // categories & merchants → always scoped to the selected period
  const analysisTxs = currentTxs;

  const categoryMap = new Map<string, number>();
  for (const t of analysisTxs) {
    if (t.amount >= 0) continue;
    categoryMap.set(t.categoryId, (categoryMap.get(t.categoryId) ?? 0) + Math.abs(t.amount));
  }
  const topCategories = Array.from(categoryMap.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);

  return {
    filterMode,
    currentMonthTotal,
    previousMonthTotal,
    percentChange,
    dailyAverage,
    topCategories,
    monthlyTrend,
    topMerchants: getTopMerchants(analysisTxs),
    subscriptions: detectSubscriptions(scopeTxs),
  };
}
