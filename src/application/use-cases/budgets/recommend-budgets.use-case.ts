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

function roundTo1000(n: number): number {
  return Math.max(1000, Math.round(n / 1000) * 1000);
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
    const categoryMap = new Map(categories.map((c) => [c.id, { name: c.name, type: c.type ?? null }]));

    const input = Array.from(spendMap.entries())
      .filter(([catId]) => categoryMap.has(catId))
      .map(([catId, totalSpend]) => ({
        categoryId: catId,
        name: categoryMap.get(catId)!.name,
        type: categoryMap.get(catId)!.type as 'needs' | 'wants' | null,
        avgSpend: totalSpend / 3,
        currentBudget: budgetMap.get(catId) ?? null,
      }));

    if (input.length === 0) return [];

    // Claude classifies categories and provides reasons only
    const classifications = await this.budgetRecommendationService.classify(input, monthlyIncome);

    // Server-side amount calculation with strict savings rules
    const needsAvgTotal = input
      .filter((i) => classifications.find((c) => c.categoryId === i.categoryId)?.bucket === 'needs')
      .reduce((sum, i) => sum + i.avgSpend, 0);

    const wantsAvgTotal = input
      .filter((i) => classifications.find((c) => c.categoryId === i.categoryId)?.bucket === 'wants')
      .reduce((sum, i) => sum + i.avgSpend, 0);

    return classifications.map((c) => {
      const item = input.find((i) => i.categoryId === c.categoryId);
      if (!item) return null;

      // Determine trend
      let trend: 'over' | 'under' | 'none';
      if (!item.currentBudget) {
        trend = 'none';
      } else if (item.avgSpend > item.currentBudget) {
        trend = 'over';
      } else {
        trend = 'under';
      }

      // Base savings-oriented recommendation
      let base: number;
      if (trend === 'over') {
        base = item.avgSpend * 0.70; // 30% reduction mandatory
      } else if (trend === 'under') {
        base = item.currentBudget!; // keep current budget, never inflate
      } else {
        base = item.avgSpend * 0.85; // 15% savings buffer for new categories
      }

      // Apply 50/30/20 ceiling if income is set — take the more aggressive (lower) value
      let recommendedAmount: number;
      if (monthlyIncome && monthlyIncome > 0) {
        const bucketBudget = c.bucket === 'needs' ? monthlyIncome * 0.5 : monthlyIncome * 0.3;
        const bucketAvgTotal = c.bucket === 'needs' ? needsAvgTotal : wantsAvgTotal;
        const proportional =
          bucketAvgTotal > 0 ? (item.avgSpend / bucketAvgTotal) * bucketBudget : base;
        recommendedAmount = roundTo1000(Math.min(base, proportional));
      } else {
        recommendedAmount = roundTo1000(base);
      }

      return {
        categoryId: item.categoryId,
        categoryName: item.name,
        avgMonthlySpend: Math.round(item.avgSpend),
        currentBudget: item.currentBudget,
        recommendedAmount,
        reason: c.reason,
        trend,
      };
    }).filter(Boolean) as BudgetRecommendationDTO[];
  }
}
