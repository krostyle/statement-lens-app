import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { UserProfilePrismaRepository } from '@/src/infrastructure/database/repositories/user-profile.prisma.repository';

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

function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function typicalMonthlySpend(
  totalSpend: number,
  monthAmounts: number[],
  windowMonths: number,
): { typical: number; sporadic: boolean } {
  const activeMonths = monthAmounts.length;
  if (activeMonths === 0) return { typical: 0, sporadic: true };

  if (activeMonths <= 2) {
    return { typical: totalSpend / 12, sporadic: true };
  }

  const avg6 = totalSpend / windowMonths;
  const maxMonth = Math.max(...monthAmounts);
  const withoutMaxTotal = totalSpend - maxMonth;
  const withoutMaxAvg = withoutMaxTotal / (windowMonths - 1);

  if (withoutMaxAvg > 0 && maxMonth > 2.5 * withoutMaxAvg) {
    return { typical: withoutMaxAvg, sporadic: false };
  }

  return { typical: avg6, sporadic: false };
}

function classifyBucket(type: string | null): 'needs' | 'wants' {
  return type === 'needs' ? 'needs' : 'wants';
}

function buildReason(
  bucket: 'needs' | 'wants',
  sporadic: boolean,
  trend: 'over' | 'under' | 'none',
  hasIncome: boolean,
): string {
  if (sporadic) return 'Gasto esporádico; monto distribuido como reserva mensual.';
  if (!hasIncome) {
    if (trend === 'over') return 'Superas tu propio presupuesto; recomendado basado en historial real.';
    if (trend === 'under') return 'Dentro de tu presupuesto actual; se mantiene.';
    return 'Sin presupuesto previo; basado en historial real de gasto.';
  }
  const label = bucket === 'needs' ? 'necesidades (50%)' : 'gustos (30%)';
  if (trend === 'over') return `Excede la cuota de ${label} según tu sueldo.`;
  if (trend === 'under') return `Dentro de la cuota de ${label}; se mantiene.`;
  return `Asignado a ${label} según regla 50/30/20.`;
}

export class RecommendBudgetsUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly budgetRepo: IBudgetRepository,
    private readonly userProfileRepo: UserProfilePrismaRepository,
  ) {}

  async execute(userId: string): Promise<BudgetRecommendationDTO[]> {
    const now = new Date();
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
    const hasIncome = !!monthlyIncome && monthlyIncome > 0;

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

    const input = Array.from(monthlyMap.entries())
      .filter(([catId]) => categoryMap.has(catId))
      .map(([catId, byMonth]) => {
        const monthAmounts = Array.from(byMonth.values())
          .filter((net) => net < 0)
          .map((net) => Math.abs(net));
        const totalSpend = monthAmounts.reduce((s, v) => s + v, 0);
        const { typical, sporadic } = typicalMonthlySpend(totalSpend, monthAmounts, WINDOW_MONTHS);
        return {
          categoryId: catId,
          name: categoryMap.get(catId)!.name,
          type: categoryMap.get(catId)!.type,
          avgSpend: typical,
          totalSpend,
          activeMonths: monthAmounts.length,
          sporadic,
          currentBudget: budgetMap.get(catId) ?? null,
        };
      })
      .filter((i) => i.totalSpend > 0);

    if (input.length === 0) return [];

    // Classify locally using Category.type — no AI call needed
    const classified = input.map((i) => ({ ...i, bucket: classifyBucket(i.type) }));

    const needsTypicalTotal = classified
      .filter((i) => i.bucket === 'needs')
      .reduce((s, i) => s + i.avgSpend, 0);
    const wantsTypicalTotal = classified
      .filter((i) => i.bucket === 'wants')
      .reduce((s, i) => s + i.avgSpend, 0);

    return classified.map((item) => {
      let trend: 'over' | 'under' | 'none';
      if (!item.currentBudget) {
        trend = 'none';
      } else if (item.avgSpend > item.currentBudget) {
        trend = 'over';
      } else {
        trend = 'under';
      }

      let recommendedAmount: number;

      if (hasIncome) {
        const bucketRate = item.bucket === 'needs' ? 0.5 : 0.3;
        const bucketBudget = monthlyIncome! * bucketRate;
        const bucketTotal = item.bucket === 'needs' ? needsTypicalTotal : wantsTypicalTotal;
        const proportional = bucketTotal > 0
          ? (item.avgSpend / bucketTotal) * bucketBudget
          : item.avgSpend;

        if (trend === 'under') {
          recommendedAmount = roundTo1000(Math.min(item.currentBudget!, proportional));
        } else {
          recommendedAmount = roundTo1000(Math.min(item.avgSpend, proportional));
        }
      } else {
        if (trend === 'over' || trend === 'under') {
          recommendedAmount = roundTo1000(item.currentBudget!);
        } else {
          recommendedAmount = roundTo1000(item.avgSpend);
        }
      }

      return {
        categoryId: item.categoryId,
        categoryName: item.name,
        avgMonthlySpend: Math.round(item.avgSpend),
        currentBudget: item.currentBudget,
        recommendedAmount,
        reason: buildReason(item.bucket, item.sporadic, trend, hasIncome),
        trend,
      };
    });
  }
}
