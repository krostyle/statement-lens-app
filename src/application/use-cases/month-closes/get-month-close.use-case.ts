import type { IMonthCloseRepository } from '@/src/domain/repositories/month-close.repository';
import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { MonthClose, CategorySummary } from '@/src/domain/entities/month-close';
import { netSpendByCategory } from '@/src/domain/services/transaction.service';

/**
 * Returns a MonthClose with summary, totalSpent and totalBudget recomputed
 * from live transaction and budget data. Only aiSuggestions, notes and
 * closedAt are kept from the stored snapshot.
 *
 * This means category re-assignments, edits or new transactions are always
 * reflected without needing to recreate the close.
 */
export class GetMonthCloseUseCase {
  constructor(
    private readonly monthCloseRepo: IMonthCloseRepository,
    private readonly budgetRepo: IBudgetRepository,
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(id: string, userId: string): Promise<MonthClose | null> {
    const mc = await this.monthCloseRepo.findById(id, userId);
    if (!mc) return null;

    return this.enrich(mc, userId);
  }

  /** Recomputes the numeric summary for an existing MonthClose record. */
  async enrich(mc: MonthClose, userId: string): Promise<MonthClose> {
    const [y, m] = mc.month.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    const [transactions, budgets, categories] = await Promise.all([
      this.transactionRepo.findByUserId(userId, { from, to }),
      this.budgetRepo.findByUserId(userId, mc.month),
      this.categoryRepo.findByUserId(userId),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const spendMap = netSpendByCategory(transactions);

    const summary: CategorySummary[] = budgets.map((b) => {
      const spent = spendMap.get(b.categoryId) ?? 0;
      const difference = b.monthlyAmount - spent;
      const isOverBudget = spent > b.monthlyAmount;
      const percentUsed =
        b.monthlyAmount > 0 ? Math.round((spent / b.monthlyAmount) * 100) : 0;
      return {
        categoryId: b.categoryId,
        categoryName: categoryMap.get(b.categoryId) ?? b.categoryId,
        budgeted: b.monthlyAmount,
        spent,
        difference,
        isOverBudget,
        percentUsed,
      };
    });

    const totalSpent = summary.reduce((sum, s) => sum + s.spent, 0);
    const totalBudget = summary.reduce((sum, s) => sum + s.budgeted, 0);

    return { ...mc, summary, totalSpent, totalBudget };
  }
}
