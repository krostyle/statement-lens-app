import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { FinancialAnalysisService, FinancialAnalysisResult } from '@/src/infrastructure/ai/financial-analysis.service';
import { netSpendByCategory } from '@/src/domain/services/transaction.service';

export class AnalyzeFinancesUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly analysisService: FinancialAnalysisService
  ) {}

  async execute(
    userId: string,
    filters: { month?: string }
  ): Promise<FinancialAnalysisResult> {
    const now = new Date();
    let transactions;
    let period: string;

    if (filters.month) {
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

    // Net spend by category: positive amounts (returns/credit notes) offset purchases
    const spendMap = netSpendByCategory(transactions);
    const topCategories = Array.from(spendMap.entries())
      .map(([categoryId, total]) => ({ categoryId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return this.analysisService.analyze(transactions, topCategories, period);
  }
}
