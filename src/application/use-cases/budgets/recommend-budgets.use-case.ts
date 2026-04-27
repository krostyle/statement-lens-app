import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { UserProfilePrismaRepository } from '@/src/infrastructure/database/repositories/user-profile.prisma.repository';
import type { BudgetRecommendationService } from '@/src/infrastructure/ai/budget-recommendation.service';

export interface BudgetRecommendationDTO {
  categoryId: string;
  categoryName: string;
  avgMonthlySpend: number;   // shown in dialog: typical spend (outlier-trimmed)
  currentBudget: number | null;
  recommendedAmount: number;
  reason: string;
  trend: 'over' | 'under' | 'none';
}

function roundTo1000(n: number): number {
  return Math.max(1000, Math.round(n / 1000) * 1000);
}

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Computes a representative monthly spend robust to outlier months.
 *
 * - activeMonths = months in the 6-month window that had spending > 0
 * - Sporadic (<=2 active): amortise the total over 12 months (annual expense / 12)
 * - Regular (>=3 active): check for an outlier max month (>2.5× the trimmed avg)
 *   → if found, drop the max month and use the trimmed avg
 *   → otherwise, use the plain 6-month avg
 */
function typicalMonthlySpend(
  totalSpend: number,
  monthAmounts: number[], // all months where spend > 0 (1..6 entries)
  windowMonths: number,   // always 6
): { typical: number; sporadic: boolean } {
  const activeMonths = monthAmounts.length;

  if (activeMonths === 0) return { typical: 0, sporadic: true };

  // ── Sporadic (1-2 active months out of 6) ─────────────────────────────
  if (activeMonths <= 2) {
    // Spread the total across 12 months so one exceptional trip doesn't inflate
    // the monthly suggestion (e.g. $468k trip → $39k/month budget)
    return { typical: totalSpend / 12, sporadic: true };
  }

  // ── Regular (3+ active months) ────────────────────────────────────────
  const avg6 = totalSpend / windowMonths;
  const maxMonth = Math.max(...monthAmounts);
  const withoutMaxTotal = totalSpend - maxMonth;
  const withoutMaxAvg = withoutMaxTotal / (windowMonths - 1); // avg of remaining 5 months

  // If the max month is more than 2.5× the average without it → clear outlier
  if (withoutMaxAvg > 0 && maxMonth > 2.5 * withoutMaxAvg) {
    return { typical: withoutMaxAvg, sporadic: false };
  }

  return { typical: avg6, sporadic: false };
}

export class RecommendBudgetsUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly budgetRepo: IBudgetRepository,
    private readonly userProfileRepo: UserProfilePrismaRepository,
    private readonly budgetRecommendationService: BudgetRecommendationService
  ) {}

  async execute(userId: string): Promise<BudgetRecommendationDTO[]> {
    const now = new Date();
    // 6-month window (instead of 3) to better detect sporadic vs regular spending
    const WINDOW_MONTHS = 6;
    const from = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - WINDOW_MONTHS,
      1,
    ));

    const [transactions, categories, budgets, user] = await Promise.all([
      this.transactionRepo.findByUserId(userId, { from }),
      this.categoryRepo.findByUserId(userId),
      this.budgetRepo.findByUserId(userId),
      this.userProfileRepo.findById(userId),
    ]);

    const monthlyIncome = user?.monthlyIncome ?? null;

    // ── Group net spend by category → month ───────────────────────────────
    // monthlyMap[categoryId][YYYY-MM] = net signed amount that month
    // (negative = net expense, positive = returns more than purchases)
    const monthlyMap = new Map<string, Map<string, number>>();
    for (const t of transactions) {
      if (t.amount === 0) continue;
      const mk = getMonthKey(new Date(t.date));
      if (!monthlyMap.has(t.categoryId)) monthlyMap.set(t.categoryId, new Map());
      const catMap = monthlyMap.get(t.categoryId)!;
      catMap.set(mk, (catMap.get(mk) ?? 0) + t.amount);
    }

    if (monthlyMap.size === 0) return [];

    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.monthlyAmount]));
    const categoryMap = new Map(categories.map((c) => [c.id, { name: c.name, type: c.type ?? null }]));

    // ── Build input per category ───────────────────────────────────────────
    const input = Array.from(monthlyMap.entries())
      .filter(([catId]) => categoryMap.has(catId))
      .map(([catId, byMonth]) => {
        // Only months where net is negative are actual expense months
        const monthAmounts = Array.from(byMonth.values())
          .filter((net) => net < 0)
          .map((net) => Math.abs(net));
        const totalSpend = monthAmounts.reduce((s, v) => s + v, 0);
        const { typical, sporadic } = typicalMonthlySpend(totalSpend, monthAmounts, WINDOW_MONTHS);
        return {
          categoryId: catId,
          name: categoryMap.get(catId)!.name,
          type: categoryMap.get(catId)!.type as 'needs' | 'wants' | null,
          avgSpend: typical,           // robust typical monthly spend
          totalSpend,
          activeMonths: monthAmounts.length,
          sporadic,
          currentBudget: budgetMap.get(catId) ?? null,
        };
      })
      .filter((i) => i.totalSpend > 0);

    if (input.length === 0) return [];

    // ── Claude classifies categories and writes reasons ────────────────────
    const classifications = await this.budgetRecommendationService.classify(
      input.map((i) => ({
        categoryId: i.categoryId,
        name: i.name,
        avgSpend: i.avgSpend,
        currentBudget: i.currentBudget,
        type: i.type,
        sporadic: i.sporadic,
        activeMonths: i.activeMonths,
      })),
      monthlyIncome,
    );

    // ── 50/30/20 totals (based on typical spend, not raw) ─────────────────
    const needsTypicalTotal = input
      .filter((i) => classifications.find((c) => c.categoryId === i.categoryId)?.bucket === 'needs')
      .reduce((s, i) => s + i.avgSpend, 0);

    const wantsTypicalTotal = input
      .filter((i) => classifications.find((c) => c.categoryId === i.categoryId)?.bucket === 'wants')
      .reduce((s, i) => s + i.avgSpend, 0);

    return classifications.map((c) => {
      const item = input.find((i) => i.categoryId === c.categoryId);
      if (!item) return null;

      // Trend is based on typical spend vs current budget
      let trend: 'over' | 'under' | 'none';
      if (!item.currentBudget) {
        trend = 'none';
      } else if (item.avgSpend > item.currentBudget) {
        trend = 'over';
      } else {
        trend = 'under';
      }

      // ── Amount recommendation ────────────────────────────────────────────
      //
      // Two strictly separate paths — no arbitrary reduction percentages:
      //
      // A) Income defined → anchor everything to 50/30/20.
      //    proportional = category's fair share of the needs or wants bucket.
      //    Cap at typical spend so we never suggest MORE than they actually spend.
      //    For under-budget: also cap at current budget (don't inflate what works).
      //
      // B) No income → reflect historical reality, no invented reductions.
      //    "over" / "under": keep existing budget (they set a target, don't change it).
      //    "none": use typical spend as the baseline (what they actually spend).
      //    Sporadic "none": typical is already amortised (total/12), use it directly.
      let recommendedAmount: number;

      if (monthlyIncome && monthlyIncome > 0) {
        // ── Path A: 50/30/20 ─────────────────────────────────────────────
        const bucketRate   = c.bucket === 'needs' ? 0.5 : 0.3;
        const bucketBudget = monthlyIncome * bucketRate;
        const bucketTotal  = c.bucket === 'needs' ? needsTypicalTotal : wantsTypicalTotal;
        const proportional = bucketTotal > 0
          ? (item.avgSpend / bucketTotal) * bucketBudget
          : item.avgSpend;

        if (trend === 'under') {
          // Budget is already working — keep it, but show if 50/30/20 says less
          recommendedAmount = roundTo1000(Math.min(item.currentBudget!, proportional));
        } else {
          // Over budget or no budget → aim for proportional share, never exceed typical
          recommendedAmount = roundTo1000(Math.min(item.avgSpend, proportional));
        }
      } else {
        // ── Path B: no income — historical baseline only ──────────────────
        if (trend === 'over' || trend === 'under') {
          // User already set a budget — respect it, don't change it
          recommendedAmount = roundTo1000(item.currentBudget!);
        } else {
          // No budget set — suggest what they actually spend (amortised if sporadic)
          recommendedAmount = roundTo1000(item.avgSpend);
        }
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
