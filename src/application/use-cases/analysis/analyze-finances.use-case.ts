import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { FinancialAnalysisService, FinancialAnalysisResult } from '@/src/infrastructure/ai/financial-analysis.service';

function toMonthStr(t: { date: Date }) {
  return `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export class AnalyzeFinancesUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly analysisService: FinancialAnalysisService
  ) {}

  async execute(
    userId: string,
    filters: { statementId?: string; month?: string }
  ): Promise<FinancialAnalysisResult> {
    const now = new Date();
    let transactions;
    let period: string;

    if (filters.statementId) {
      transactions = await this.transactionRepo.findByUserId(userId, { statementId: filters.statementId });
      const months = transactions.map(toMonthStr).sort();
      period = months.length > 0 ? `${months[0]} al ${months[months.length - 1]}` : 'período desconocido';
    } else if (filters.month) {
      const [y, m] = filters.month.split('-').map(Number);
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      transactions = await this.transactionRepo.findByUserId(userId, { from, to });
      period = filters.month;
    } else {
      const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      transactions = await this.transactionRepo.findByUserId(userId, { from: sixMonthsAgo });
      period = 'últimos 6 meses';
    }

    const categoryMap = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount >= 0) continue;
      categoryMap.set(t.categoryId, (categoryMap.get(t.categoryId) ?? 0) + Math.abs(t.amount));
    }
    const topCategories = Array.from(categoryMap.entries())
      .map(([categoryId, total]) => ({ categoryId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return this.analysisService.analyze(transactions, topCategories, period);
  }
}
