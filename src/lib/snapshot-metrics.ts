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

/**
 * @param excludedCategoryIds Categories whose spend is always fully reimbursed (e.g. an
 *   additional card holder's purchases) — excluded from totalExpenses/dailyAverage/projection,
 *   but still shown in full in byCategory and byMerchant.
 */
export function computeSnapshotMetrics(
  allTxs: SnapshotTransaction[],
  budgetsByCategory: Map<string, number>,
  month: string,
  excludedCategoryIds: Set<string> = new Set(),
) {
  // Returns/credit notes (positive amounts) net against purchases — same convention as the
  // domain's netSpendByCategory/getTopMerchants — instead of being ignored outright.
  const expenseTxs = allTxs.filter((t) => t.transactionType === 'expense' && t.amount !== 0);
  const income     = allTxs.filter((t) => t.transactionType === 'income'  && t.amount > 0);

  const categoryNets = new Map<string, number>();
  const categoryNames = new Map<string, string>();
  for (const t of expenseTxs) {
    categoryNets.set(t.categoryId, (categoryNets.get(t.categoryId) ?? 0) + t.amount);
    if (!categoryNames.has(t.categoryId)) categoryNames.set(t.categoryId, t.categoryName);
  }

  const totalExpenses = Array.from(categoryNets.entries())
    .filter(([categoryId, net]) => net < 0 && !excludedCategoryIds.has(categoryId))
    .reduce((s, [, net]) => s + Math.abs(net), 0);
  const totalIncome   = income.reduce((s, t) => s + t.amount, 0);

  const elapsed   = daysElapsed(month);
  const total     = daysInMonth(month);
  const dailyAvg  = elapsed > 0 ? totalExpenses / elapsed : 0;
  const projected = Math.round(dailyAvg * total);

  // By merchant — categoryName is empty string when transactions have mixed categories.
  // A return/credit note reduces that merchant's running total (floored at 0, same as getTopMerchants).
  const merchantMap = new Map<string, {
    total: number; count: number;
    categoryName: string; categoryId: string; mixedCategories: boolean;
    sources: Set<string>; banks: Set<string>;
  }>();
  for (const t of expenseTxs) {
    const e = merchantMap.get(t.merchant) ?? {
      total: 0, count: 0,
      categoryName: t.categoryName, categoryId: t.categoryId, mixedCategories: false,
      sources: new Set<string>(), banks: new Set<string>(),
    };
    if (t.amount < 0) {
      e.total += Math.abs(t.amount);
      e.count += 1;
    } else {
      e.total = Math.max(0, e.total - t.amount);
    }
    if (e.categoryId !== t.categoryId) e.mixedCategories = true;
    e.sources.add(t.source);
    e.banks.add((t as { bank?: string }).bank ?? 'santander');
    merchantMap.set(t.merchant, e);
  }
  const byMerchant = Array.from(merchantMap.entries())
    .filter(([, { total }]) => total > 0)
    .map(([merchant, { total, count, categoryName, mixedCategories, sources, banks }]) => ({
      merchant,
      total: Math.round(total),
      count,
      categoryName: mixedCategories ? '' : categoryName,
      source: sources.size > 1 ? 'mixed' : (Array.from(sources)[0] ?? 'credit_card') as 'checking' | 'credit_card' | 'mixed',
      banks: Array.from(banks),
    }))
    .sort((a, b) => b.total - a.total);

  // By category — with budget comparison. A category whose returns fully offset its
  // purchases (net >= 0) is dropped, matching the domain's netSpendByCategory.
  const byCategory = Array.from(categoryNets.entries())
    .filter(([, net]) => net < 0)
    .map(([categoryId, net]) => {
      const categoryTotal = Math.abs(net);
      const budget = budgetsByCategory.get(categoryId) ?? null;
      return {
        categoryId,
        categoryName: categoryNames.get(categoryId) ?? '',
        total: Math.round(categoryTotal),
        pctOfTotal:   totalExpenses > 0 ? Math.round((categoryTotal / totalExpenses) * 100) : 0,
        budget,
        pctOfBudget:  budget ? Math.round((categoryTotal / budget) * 100) : null,
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
