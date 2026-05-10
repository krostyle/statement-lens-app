import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function daysElapsed(month: string): number {
  const today = new Date();
  const [y, m] = month.split('-').map(Number);
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  if (!isCurrentMonth) return daysInMonth(month);
  return today.getDate();
}

export function computeSnapshotMetrics(
  allTxs: SnapshotTransaction[],
  budgetsByCategory: Map<string, number>,
  month: string,
) {
  const expenses = allTxs.filter((t) => t.transactionType === 'expense' && t.amount < 0);
  const income   = allTxs.filter((t) => t.transactionType === 'income'  && t.amount > 0);

  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome   = income.reduce((s, t) => s + t.amount, 0);

  const elapsed   = daysElapsed(month);
  const total     = daysInMonth(month);
  const dailyAvg  = elapsed > 0 ? totalExpenses / elapsed : 0;
  const projected = Math.round(dailyAvg * total);

  // By merchant
  const merchantMap = new Map<string, { total: number; count: number; categoryName: string; sources: Set<string> }>();
  for (const t of expenses) {
    const e = merchantMap.get(t.merchant) ?? { total: 0, count: 0, categoryName: t.categoryName, sources: new Set<string>() };
    e.total += Math.abs(t.amount);
    e.count += 1;
    e.sources.add(t.source);
    merchantMap.set(t.merchant, e);
  }
  const byMerchant = Array.from(merchantMap.entries())
    .map(([merchant, { total, count, categoryName, sources }]) => ({
      merchant,
      total: Math.round(total),
      count,
      categoryName,
      source: sources.size > 1 ? 'mixed' : (Array.from(sources)[0] ?? 'credit_card') as 'checking' | 'credit_card' | 'mixed',
    }))
    .sort((a, b) => b.total - a.total);

  // By category — with budget comparison
  const catMap = new Map<string, { name: string; total: number }>();
  for (const t of expenses) {
    const e = catMap.get(t.categoryId) ?? { name: t.categoryName, total: 0 };
    e.total += Math.abs(t.amount);
    catMap.set(t.categoryId, e);
  }
  const byCategory = Array.from(catMap.entries())
    .map(([categoryId, { name, total }]) => {
      const budget = budgetsByCategory.get(categoryId) ?? null;
      return {
        categoryId,
        categoryName: name,
        total: Math.round(total),
        pctOfTotal:   totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
        budget,
        pctOfBudget:  budget ? Math.round((total / budget) * 100) : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    totalExpenses:       Math.round(totalExpenses),
    totalIncome:         Math.round(totalIncome),
    dailyAverage:        Math.round(dailyAvg),
    projectedMonthTotal: projected,
    daysElapsed:         elapsed,
    daysInMonth:         total,
    byMerchant,
    byCategory,
  };
}
