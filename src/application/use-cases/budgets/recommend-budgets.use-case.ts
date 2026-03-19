import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { IUserRepository } from '@/src/domain/repositories/user.repository';
import type { BudgetRecommendationService } from '@/src/infrastructure/ai/budget-recommendation.service';

export interface BudgetRecommendationDTO {
  categoryId: string;
  categoryName: string;
  avgMonthlySpend: number;
  currentBudget: number | null;
  recommendedAmount: number;
  reason: string;
  trend: 'over' | 'under' | 'none';
}

export class RecommendBudgetsUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly budgetRepo: IBudgetRepository,
    private readonly userRepo: IUserRepository,
    private readonly budgetRecommendationService: BudgetRecommendationService
  ) {}

  async execute(userId: string): Promise<BudgetRecommendationDTO[]> {
    const now = new Date();
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [transactions, categories, budgets, user] = await Promise.all([
      this.transactionRepo.findByUserId(userId, { from }),
      this.categoryRepo.findByUserId(userId),
      this.budgetRepo.findByUserId(userId),
      this.userRepo.findById(userId),
    ]);

    const monthlyIncome = user?.monthlyIncome ?? null;

    // Sum expenses (amount < 0) per category
    const spendMap = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount >= 0) continue;
      spendMap.set(t.categoryId, (spendMap.get(t.categoryId) ?? 0) + Math.abs(t.amount));
    }

    if (spendMap.size === 0) return [];

    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // Only categories with at least 1 transaction in the period
    const input = Array.from(spendMap.entries())
      .filter(([catId]) => categoryMap.has(catId))
      .map(([catId, totalSpend]) => ({
        categoryId: catId,
        name: categoryMap.get(catId)!,
        avgSpend: totalSpend / 3,
        currentBudget: budgetMap.get(catId) ?? null,
      }));

    if (input.length === 0) return [];

    const aiResults = await this.budgetRecommendationService.recommend(input, monthlyIncome);

    return aiResults.map((item) => {
      const inputItem = input.find((i) => i.categoryId === item.categoryId);
      return {
        categoryId: item.categoryId,
        categoryName: inputItem?.name ?? item.categoryId,
        avgMonthlySpend: inputItem ? Math.round(inputItem.avgSpend) : 0,
        currentBudget: inputItem?.currentBudget ?? null,
        recommendedAmount: item.recommendedAmount,
        reason: item.reason,
        trend: item.trend,
      };
    });
  }
}
