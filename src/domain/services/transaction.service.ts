import type { Transaction } from '../entities/transaction';

export interface MonthlySpend {
  month: string;
  total: number;
}

export interface MerchantSpend {
  merchant: string;
  total: number;
  count: number;
}

export interface Subscription {
  merchant: string;
  amount: number;
  occurrences: number;
}

/**
 * Nets all EXPENSE transactions by category.
 * Returns only categories whose net is negative (spent more than was returned),
 * with the value already converted to a positive number representing net spend.
 *
 * Income transactions (transactionType === 'income') are excluded so salary and
 * received transfers never reduce an expense category's total.
 * Credit-card returns (transactionType === 'expense', positive amount) correctly
 * reduce the expense category they belong to.
 */
export function netSpendByCategory(transactions: Transaction[]): Map<string, number> {
  const expenseTxs = transactions.filter(
    (t) => (t.transactionType ?? 'expense') === 'expense',
  );
  const map = new Map<string, number>();
  for (const t of expenseTxs) {
    if (t.amount === 0) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  const result = new Map<string, number>();
  for (const [catId, net] of map) {
    if (net < 0) result.set(catId, Math.abs(net));
  }
  return result;
}

/**
 * Total income for the given transactions (sum of positive amounts where
 * transactionType === 'income').
 */
export function calculateTotalIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => (t.transactionType ?? 'expense') === 'income' && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function calculateTotalExpenses(transactions: Transaction[]): number {
  const nets = netSpendByCategory(transactions);
  return Array.from(nets.values()).reduce((sum, v) => sum + v, 0);
}

export function groupByMonth(transactions: Transaction[]): MonthlySpend[] {
  // Collect all transactions per month, then net by category within each month
  const byMonth = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = t.accountingMonth || `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, '0')}`;
    const arr = byMonth.get(key) ?? [];
    arr.push(t);
    byMonth.set(key, arr);
  }
  return Array.from(byMonth.entries())
    .map(([month, txs]) => {
      const nets = netSpendByCategory(txs);
      const total = Array.from(nets.values()).reduce((sum, v) => sum + v, 0);
      return { month, total };
    })
    .filter(({ total }) => total > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function getTopMerchants(transactions: Transaction[], limit = 10): MerchantSpend[] {
  // Only include expense transactions in the top merchants list
  const expenseTxs = transactions.filter(
    (t) => (t.transactionType ?? 'expense') === 'expense',
  );
  const map = new Map<string, { total: number; count: number }>();
  for (const t of expenseTxs) {
    if (t.amount === 0) continue;
    const entry = map.get(t.merchant) ?? { total: 0, count: 0 };
    if (t.amount < 0) {
      entry.total += Math.abs(t.amount);
      entry.count += 1;
    } else {
      // Return/credit note: reduce the merchant's total
      entry.total = Math.max(0, entry.total - t.amount);
    }
    map.set(t.merchant, entry);
  }
  return Array.from(map.entries())
    .map(([merchant, data]) => ({ merchant, ...data }))
    .filter(({ total }) => total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  // Subscriptions are recurring charges — only look at purchases (negative amounts)
  const map = new Map<string, number[]>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const key = `${t.merchant}:${Math.abs(t.amount)}`;
    const amounts = map.get(key) ?? [];
    amounts.push(Math.abs(t.amount));
    map.set(key, amounts);
  }
  const subscriptions: Subscription[] = [];
  for (const [key, amounts] of map.entries()) {
    if (amounts.length >= 2) {
      const [merchant, amount] = key.split(':');
      subscriptions.push({ merchant, amount: Number(amount), occurrences: amounts.length });
    }
  }
  return subscriptions.sort((a, b) => b.occurrences - a.occurrences);
}
