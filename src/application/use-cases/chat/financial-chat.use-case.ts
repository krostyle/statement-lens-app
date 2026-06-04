import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { ISnapshotRepository } from '@/src/domain/repositories/snapshot.repository';
import type { UserProfilePrismaRepository } from '@/src/infrastructure/database/repositories/user-profile.prisma.repository';
import type { FinancialChatService, ChatMessage, FinancialContext, CurrentMonthSnapshot } from '@/src/infrastructure/ai/financial-chat.service';
import { netSpendByCategory } from '@/src/domain/services/transaction.service';
import { computeSnapshotMetrics } from '@/src/lib/snapshot-metrics';

export class FinancialChatUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly budgetRepo: IBudgetRepository,
    private readonly userProfileRepo: UserProfilePrismaRepository,
    private readonly snapshotRepo: ISnapshotRepository,
    private readonly chatService: FinancialChatService
  ) {}

  async execute(userId: string, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
    const context = await this.buildContext(userId);
    return this.chatService.streamChat(messages, context);
  }

  private async buildContext(userId: string): Promise<FinancialContext> {
    const now = new Date();
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const [transactions, categories, budgets, profile, snapshot] = await Promise.all([
      this.transactionRepo.findByUserId(userId, { from: sixMonthsAgo }),
      this.categoryRepo.findByUserId(userId),
      this.budgetRepo.findByUserId(userId),
      this.userProfileRepo.findById(userId),
      this.snapshotRepo.findByUserAndMonth(userId, currentMonth),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));

    const spendMap = netSpendByCategory(transactions);
    const spendByCategory = Array.from(spendMap.entries())
      .filter(([catId]) => catId != null && categoryMap.has(catId))
      .map(([catId, total]) => ({
        name: categoryMap.get(catId)!,
        total,
        budget: budgetMap.get(catId),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const recentTransactions = transactions
      .filter((t) => t.transactionType === 'expense' && t.amount < 0)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 150)
      .map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        merchant: t.merchant,
        amount: Math.abs(t.amount),
        category: t.categoryId ? (categoryMap.get(t.categoryId) ?? 'Sin categoría') : 'Sin categoría',
      }));

    let currentMonthSnapshot: CurrentMonthSnapshot | undefined;
    if (snapshot) {
      const allTxs = [
        ...(snapshot.checkingTxs ?? []),
        ...(snapshot.ccTxs ?? []),
      ];
      const metrics = computeSnapshotMetrics(allTxs, budgetMap, currentMonth);

      const snapRecentTxs = allTxs
        .filter((t) => t.transactionType === 'expense' && t.amount < 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50)
        .map((t) => ({
          date: t.date,
          merchant: t.merchant,
          amount: Math.abs(t.amount),
          category: t.categoryName || 'Sin categoría',
        }));

      currentMonthSnapshot = {
        totalExpenses: metrics.totalExpenses,
        totalIncome: metrics.totalIncome,
        daysElapsed: metrics.daysElapsed,
        daysInMonth: metrics.daysInMonth,
        projectedMonthTotal: metrics.projectedMonthTotal,
        byCategory: metrics.byCategory.map((cat) => ({
          categoryName: cat.categoryName,
          spent: cat.total,
          budget: cat.budget,
          remaining: cat.budget !== null ? cat.budget - cat.total : null,
          pctOfBudget: cat.pctOfBudget,
        })),
        recentTransactions: snapRecentTxs,
      };
    }

    return {
      monthlyIncome: profile?.monthlyIncome ?? undefined,
      currentMonth,
      spendByCategory,
      recentTransactions,
      currentMonthSnapshot,
    };
  }
}
