import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';
import type { ReportCategoryInfo } from '@/src/domain/services/report.service';
import { txToSnapshot } from '@/src/lib/snapshot-utils';

export const REPORT_WINDOW_MONTHS = 6;

export interface ReportDataDTO {
  /** Report month, 'YYYY-MM'. */
  month: string;
  /** The window ending at `month`, oldest first (always REPORT_WINDOW_MONTHS entries). */
  months: string[];
  /** Tracking transactions per accounting month; every month in `months` has a key. */
  transactionsByMonth: Record<string, SnapshotTransaction[]>;
  categories: ReportCategoryInfo[];
  /** Budgets of the report month. */
  budgets: { categoryId: string; amount: number }[];
}

function monthWindow(month: string, size: number): string[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: size }, (_, i) => {
    const d = new Date(Date.UTC(y, m - size + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/**
 * Raw material for the interactive report builder. Everything derived (filters, grouping,
 * metrics) is computed client-side so the builder can re-slice without refetching.
 */
export class GetReportDataUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly budgetRepo: IBudgetRepository,
  ) {}

  async execute(userId: string, month: string): Promise<ReportDataDTO | null> {
    const months = monthWindow(month, REPORT_WINDOW_MONTHS);
    const [txsPerMonth, categories, budgets] = await Promise.all([
      Promise.all(months.map((m) => this.transactionRepo.findTrackingByMonth(userId, m))),
      this.categoryRepo.findByUserId(userId),
      this.budgetRepo.findByUserId(userId, month),
    ]);

    if (txsPerMonth[months.length - 1].length === 0) return null;

    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
    const transactionsByMonth: Record<string, SnapshotTransaction[]> = {};
    months.forEach((m, i) => {
      transactionsByMonth[m] = txsPerMonth[i].map((tx) => txToSnapshot(tx, categoryNameMap));
    });

    return {
      month,
      months,
      transactionsByMonth,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        isFixed: c.isFixed,
        excludeFromBudget: c.excludeFromBudget,
      })),
      budgets: budgets.map((b) => ({ categoryId: b.categoryId, amount: b.monthlyAmount })),
    };
  }
}
