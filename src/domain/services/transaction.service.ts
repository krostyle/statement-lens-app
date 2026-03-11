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

export function calculateTotalExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

export function groupByMonth(transactions: Transaction[]): MonthlySpend[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const key = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
  }
  return Array.from(map.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function getTopMerchants(transactions: Transaction[], limit = 10): MerchantSpend[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const entry = map.get(t.merchant) ?? { total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    map.set(t.merchant, entry);
  }
  return Array.from(map.entries())
    .map(([merchant, data]) => ({ merchant, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
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
