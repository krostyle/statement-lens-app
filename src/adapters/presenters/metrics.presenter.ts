import type { Transaction } from '@/src/domain/entities/transaction';
import {
  calculateTotalExpenses,
  calculateTotalIncome,
  groupByMonth,
  getTopMerchants,
  detectSubscriptions,
  netSpendByCategory,
} from '@/src/domain/services/transaction.service';

export type MetricsFilterMode = 'default' | 'month';

export interface MetricsDTO {
  filterMode: MetricsFilterMode;
  currentMonthTotal: number;
  previousMonthTotal: number;
  percentChange: number;
  dailyAverage: number;
  totalIncome: number;
  savingsRate: number | null;
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
  // netSpendByCategory nets returns/credit-notes against purchases per category
  const categoryNets = netSpendByCategory(currentTxs);
  const topCategories = Array.from(categoryNets.entries())
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);

  const totalIncome = calculateTotalIncome(currentTxs);
  const savingsRate =
    totalIncome > 0 ? Math.round((1 - currentMonthTotal / totalIncome) * 100) : null;

  return {
    filterMode,
    currentMonthTotal,
    previousMonthTotal,
    percentChange,
    dailyAverage,
    totalIncome,
    savingsRate,
    topCategories,
    monthlyTrend,
    topMerchants: getTopMerchants(currentTxs),
    subscriptions: detectSubscriptions(scopeTxs),
  };
}
