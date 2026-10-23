import type { SnapshotTransaction } from '../entities/snapshot';

/**
 * Pure logic behind the interactive report builder: filtering, grouping (up to N nested
 * dimensions), sorting and chart slices. Expenses follow the same netting convention as
 * computeSnapshotMetrics — a return (expense with positive amount) reduces its group's total.
 */

export type ReportDimension = 'merchant' | 'category' | 'bank' | 'source' | 'nature' | 'week';
export type SortDir = 'asc' | 'desc';
export type GroupSortBy = 'total' | 'label' | 'count';
export type TransactionSortBy = 'date' | 'amount' | 'merchant';

export interface ReportCategoryInfo {
  id: string;
  name: string;
  isFixed: boolean;
  excludeFromBudget: boolean;
}

export interface ReportContext {
  categories: Map<string, ReportCategoryInfo>;
}

export interface ReportFilters {
  /** Empty = every bank. Applies to all transaction types. */
  banks: string[];
  /** Empty = every source. Applies to all transaction types. */
  sources: SnapshotTransaction['source'][];
  /** Empty = every category. Expenses only. */
  categoryIds: string[];
  /** Case/accent-insensitive match on merchant or description. Expenses only. */
  search: string;
  /** Minimum absolute amount; 0 = no minimum. Expenses only. */
  minAmount: number;
  /** When false, returns/credit notes are dropped and totals become gross spend. */
  includeReturns: boolean;
  /** When false, categories flagged excludeFromBudget (fully reimbursed) are left out. */
  includeReimbursed: boolean;
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  banks: [],
  sources: [],
  categoryIds: [],
  search: '',
  minAmount: 0,
  includeReturns: true,
  includeReimbursed: false,
};

export const BANK_LABELS: Record<string, string> = {
  santander: 'Santander',
  falabella: 'Falabella',
  bci: 'BCI',
  bancoestado: 'BancoEstado',
  liderbci: 'LiderBCI',
};

export const SOURCE_LABELS: Record<SnapshotTransaction['source'], string> = {
  credit_card: 'Tarjeta de crédito',
  checking: 'Cuenta corriente',
};

export const DIMENSION_LABELS: Record<ReportDimension, string> = {
  merchant: 'Comercio',
  category: 'Categoría',
  bank: 'Banco',
  source: 'Medio de pago',
  nature: 'Fijo / variable',
  week: 'Semana del mes',
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function bankLabel(bank: string): string {
  return BANK_LABELS[bank] ?? (bank || 'Sin banco');
}

export function filterReportTransactions(
  txs: SnapshotTransaction[],
  filters: ReportFilters,
  ctx: ReportContext,
): SnapshotTransaction[] {
  const query = fold(filters.search.trim());
  return txs.filter((t) => {
    if (filters.banks.length > 0 && !filters.banks.includes(t.bank)) return false;
    if (filters.sources.length > 0 && !filters.sources.includes(t.source)) return false;
    if (t.transactionType !== 'expense') return true;

    if (!filters.includeReimbursed && ctx.categories.get(t.categoryId)?.excludeFromBudget) return false;
    if (!filters.includeReturns && t.amount > 0) return false;
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(t.categoryId)) return false;
    if (filters.minAmount > 0 && Math.abs(t.amount) < filters.minAmount) return false;
    if (query && !fold(`${t.merchant} ${t.description}`).includes(query)) return false;
    return true;
  });
}

function weekOf(date: string): { key: string; label: string } {
  const day = Number(date.slice(8, 10));
  const week = Math.min(Math.floor((day - 1) / 7) + 1, 5);
  const start = (week - 1) * 7 + 1;
  const end = week === 5 ? 31 : start + 6;
  return { key: `w${week}`, label: `Días ${start}–${end}` };
}

export function dimensionOf(
  t: SnapshotTransaction,
  dim: ReportDimension,
  ctx: ReportContext,
): { key: string; label: string } {
  switch (dim) {
    case 'merchant': {
      const name = t.merchant || t.description;
      return { key: name, label: name };
    }
    case 'category':
      return { key: t.categoryId, label: t.categoryName || 'Sin asignar' };
    case 'bank':
      return { key: t.bank, label: bankLabel(t.bank) };
    case 'source':
      return { key: t.source, label: SOURCE_LABELS[t.source] ?? t.source };
    case 'nature':
      return ctx.categories.get(t.categoryId)?.isFixed
        ? { key: 'fixed', label: 'Gastos fijos' }
        : { key: 'variable', label: 'Gastos variables' };
    case 'week':
      return weekOf(t.date);
  }
}

export interface ReportGroup {
  key: string;
  label: string;
  /** Net spend (purchases minus returns), rounded. */
  total: number;
  /** Number of purchases (returns are not counted). */
  count: number;
  /** total / grand total of the whole grouped set (0..1). */
  share: number;
  dimension: ReportDimension;
  children: ReportGroup[];
  /** Every expense in the group, newest first. */
  transactions: SnapshotTransaction[];
}

export interface GroupSort {
  sortBy: GroupSortBy;
  dir: SortDir;
}

const spendOf = (txs: SnapshotTransaction[]) => -txs.reduce((s, t) => s + t.amount, 0);

function compareGroups(a: ReportGroup, b: ReportGroup, sort: GroupSort): number {
  const sign = sort.dir === 'asc' ? 1 : -1;
  let primary = 0;
  if (sort.sortBy === 'total') primary = a.total - b.total;
  else if (sort.sortBy === 'count') primary = a.count - b.count;
  else {
    // Week keys (w1..w5) are already in calendar order; labels like "Días 15–21" are not.
    const ak = a.dimension === 'week' ? a.key : a.label;
    const bk = b.dimension === 'week' ? b.key : b.label;
    primary = ak.localeCompare(bk, 'es', { numeric: true, sensitivity: 'base' });
  }
  if (primary !== 0) return primary * sign;
  return b.total - a.total || a.label.localeCompare(b.label, 'es');
}

function buildGroups(
  txs: SnapshotTransaction[],
  dims: ReportDimension[],
  sort: GroupSort,
  ctx: ReportContext,
  grandTotal: number,
): ReportGroup[] {
  const [dim, ...rest] = dims;
  if (!dim) return [];
  const buckets = new Map<string, { label: string; txs: SnapshotTransaction[] }>();
  for (const t of txs) {
    const { key, label } = dimensionOf(t, dim, ctx);
    const bucket = buckets.get(key) ?? { label, txs: [] };
    bucket.txs.push(t);
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .map(([key, { label, txs: groupTxs }]) => {
      const total = Math.round(spendOf(groupTxs));
      return {
        key,
        label,
        total,
        count: groupTxs.filter((t) => t.amount < 0).length,
        share: grandTotal > 0 ? total / grandTotal : 0,
        dimension: dim,
        children: buildGroups(groupTxs, rest, sort, ctx, grandTotal),
        transactions: sortTransactions(groupTxs, 'date', 'desc'),
      };
    })
    .sort((a, b) => compareGroups(a, b, sort));
}

/** Groups expense transactions by one or more nested dimensions. Non-expense rows are ignored. */
export function groupExpenses(
  txs: SnapshotTransaction[],
  dims: ReportDimension[],
  sort: GroupSort,
  ctx: ReportContext,
): ReportGroup[] {
  const expenses = txs.filter((t) => t.transactionType === 'expense' && t.amount !== 0);
  return buildGroups(expenses, dims, sort, ctx, spendOf(expenses));
}

/** Returns a sorted copy. 'amount' sorts by spend (a purchase of 9.000 ranks above a return). */
export function sortTransactions(
  txs: SnapshotTransaction[],
  by: TransactionSortBy,
  dir: SortDir,
): SnapshotTransaction[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...txs].sort((a, b) => {
    let primary = 0;
    if (by === 'date') primary = a.date.localeCompare(b.date);
    else if (by === 'amount') primary = -a.amount - -b.amount;
    else primary = (a.merchant || a.description).localeCompare(b.merchant || b.description, 'es', { sensitivity: 'base' });
    return primary * sign || b.date.localeCompare(a.date);
  });
}

export interface ReportSlice {
  key: string;
  label: string;
  total: number;
  share: number;
}

export const OTHER_SLICE_KEY = '__other__';

/** Top-N slices of net spend by one dimension; the tail is folded into a single "Otros" slice. */
export function sliceByDimension(
  txs: SnapshotTransaction[],
  dim: ReportDimension,
  ctx: ReportContext,
  maxSlices = 7,
): ReportSlice[] {
  const groups = groupExpenses(txs, [dim], { sortBy: 'total', dir: 'desc' }, ctx).filter((g) => g.total > 0);
  const total = groups.reduce((s, g) => s + g.total, 0);
  const toSlice = (key: string, label: string, value: number): ReportSlice => ({
    key, label, total: value, share: total > 0 ? value / total : 0,
  });
  if (groups.length <= maxSlices) return groups.map((g) => toSlice(g.key, g.label, g.total));
  const head = groups.slice(0, maxSlices - 1).map((g) => toSlice(g.key, g.label, g.total));
  const rest = groups.slice(maxSlices - 1).reduce((s, g) => s + g.total, 0);
  return [...head, toSlice(OTHER_SLICE_KEY, 'Otros', rest)];
}
