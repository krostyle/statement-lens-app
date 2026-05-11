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

  // By merchant — categoryName is empty string when transactions have mixed categories
  const merchantMap = new Map<string, {
    total: number; count: number;
    categoryName: string; categoryId: string; mixedCategories: boolean;
    sources: Set<string>; banks: Set<string>;
  }>();
  for (const t of expenses) {
    const e = merchantMap.get(t.merchant);
    if (!e) {
      merchantMap.set(t.merchant, {
        total: Math.abs(t.amount), count: 1,
        categoryName: t.categoryName, categoryId: t.categoryId, mixedCategories: false,
        sources: new Set([t.source]),
        banks: new Set([(t as { bank?: string }).bank ?? 'santander']),
      });
    } else {
      e.total += Math.abs(t.amount);
      e.count += 1;
      if (e.categoryId !== t.categoryId) e.mixedCategories = true;
      e.sources.add(t.source);
      e.banks.add((t as { bank?: string }).bank ?? 'santander');
    }
  }
  const byMerchant = Array.from(merchantMap.entries())
    .map(([merchant, { total, count, categoryName, mixedCategories, sources, banks }]) => ({
      merchant,
      total: Math.round(total),
      count,
      categoryName: mixedCategories ? '' : categoryName,
      source: sources.size > 1 ? 'mixed' : (Array.from(sources)[0] ?? 'credit_card') as 'checking' | 'credit_card' | 'mixed',
      banks: Array.from(banks),
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
