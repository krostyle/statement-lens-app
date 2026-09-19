import { describe, it, expect, vi } from 'vitest';
import { AnalyzeFinancesUseCase } from './analyze-finances.use-case';
import { createMockTransactionRepo } from '@/src/test/mocks/transaction-repository.mock';
import type { Transaction } from '@/src/domain/entities/transaction';
import type { FinancialAnalysisService, FinancialAnalysisResult } from '@/src/infrastructure/ai/financial-analysis.service';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2024-03-10'),
    description: 'Gasto',
    merchant: 'Merchant',
    amount: -1000,
    currency: 'CLP',
    bank: '',
    accountType: '',
    isInstallment: false,
    notes: null,
    reviewStatus: 'confirmed',
    transactionType: 'expense',
    origin: 'manual',
    accountingMonth: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const analysisResult: FinancialAnalysisResult = {
  summary: 'Resumen',
  topOpportunities: [],
  unusualSpending: [],
  tips: [],
};

function makeAnalysisService(): { service: FinancialAnalysisService; analyze: ReturnType<typeof vi.fn> } {
  const analyze = vi.fn().mockResolvedValue(analysisResult);
  return { service: { analyze } as unknown as FinancialAnalysisService, analyze };
}

describe('AnalyzeFinancesUseCase', () => {
  it('uses "últimos 6 meses" as the period when no month filter is given', async () => {
    const repo = createMockTransactionRepo([makeTransaction()]);
    const { service, analyze } = makeAnalysisService();
    const useCase = new AnalyzeFinancesUseCase(repo, service);

    const result = await useCase.execute('user-1', {});

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze.mock.calls[0][2]).toBe('últimos 6 meses');
    expect(result).toBe(analysisResult);
  });

  it('uses the given month as the period when filters.month is set', async () => {
    const repo = createMockTransactionRepo([makeTransaction()]);
    const { service, analyze } = makeAnalysisService();
    const useCase = new AnalyzeFinancesUseCase(repo, service);

    await useCase.execute('user-1', { month: '2024-03' });

    expect(analyze.mock.calls[0][2]).toBe('2024-03');
  });

  it('passes the top categories by net spend, sorted descending', async () => {
    const repo = createMockTransactionRepo([
      makeTransaction({ categoryId: 'cat-1', amount: -5000 }),
      makeTransaction({ categoryId: 'cat-2', amount: -20000 }),
      makeTransaction({ categoryId: 'cat-2', amount: -10000 }),
    ]);
    const { service, analyze } = makeAnalysisService();
    const useCase = new AnalyzeFinancesUseCase(repo, service);

    await useCase.execute('user-1', {});

    const topCategories = analyze.mock.calls[0][1] as { categoryId: string; total: number }[];
    expect(topCategories[0]).toEqual({ categoryId: 'cat-2', total: 30000 });
    expect(topCategories[1]).toEqual({ categoryId: 'cat-1', total: 5000 });
  });
});
