import type { IMonthCloseRepository } from '@/src/domain/repositories/month-close.repository';
import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { MonthCloseSuggestionsService } from '@/src/infrastructure/ai/month-close-suggestions.service';
import type { MonthClose, CategorySummary } from '@/src/domain/entities/month-close';
import { netSpendByCategory } from '@/src/domain/services/transaction.service';

export class CreateMonthCloseUseCase {
  constructor(
    private readonly monthCloseRepo: IMonthCloseRepository,
    private readonly budgetRepo: IBudgetRepository,
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly suggestionsService: MonthCloseSuggestionsService,
  ) {}

  async execute(userId: string, month: string): Promise<MonthClose> {
    // Validate: month not already closed
    const alreadyClosed = await this.monthCloseRepo.existsForMonth(userId, month);
    if (alreadyClosed) throw new Error('Este mes ya fue cerrado.');

    // Get transactions for the month
    const [year, mm] = month.split('-').map(Number);
    const from = new Date(year, mm - 1, 1);
    const to = new Date(year, mm, 0, 23, 59, 59, 999); // last day of month
    const transactions = await this.transactionRepo.findByUserId(userId, { from, to });
    if (transactions.length === 0) throw new Error('No hay transacciones en este mes.');

    // Get budgets for the month
    const budgets = await this.budgetRepo.findByUserId(userId, month);
    if (budgets.length === 0) throw new Error('No hay presupuestos definidos para este mes.');

    // Get categories
    const categories = await this.categoryRepo.findByUserId(userId);
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // Net spend per category: returns/credit-notes offset purchases
    // Categories with net positive (income or refunds > purchases) are excluded
    const spendMap = netSpendByCategory(transactions);

    if (spendMap.size === 0) throw new Error('No hay gastos netos en este mes.');

    // Build summary
    const summary: CategorySummary[] = budgets.map((b) => {
      const spent = spendMap.get(b.categoryId) ?? 0;
      const difference = b.monthlyAmount - spent;
      const isOverBudget = spent > b.monthlyAmount;
      const percentUsed = b.monthlyAmount > 0 ? Math.round((spent / b.monthlyAmount) * 100) : 0;
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

    // Generate AI suggestions
    const aiSuggestions = await this.suggestionsService.generate(
      month,
      totalSpent,
      totalBudget,
      summary,
    );

    return this.monthCloseRepo.create({
      userId,
      month,
      totalSpent,
      totalBudget,
      summary,
      aiSuggestions,
      notes: null,
    });
  }
}
