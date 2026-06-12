import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { TransactionFiltersDTO, TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';

export interface TransactionSummaryDTO {
  expenses: number;
  income: number;
  count: number;
}

export interface PaginatedTransactionsDTO {
  data: TransactionResponseDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: TransactionSummaryDTO;
}

export class ListTransactionsUseCase {
  constructor(private readonly transactionRepo: ITransactionRepository) {}

  async execute(
    userId: string,
    filters?: TransactionFiltersDTO,
    page = 1,
    pageSize = 25
  ): Promise<PaginatedTransactionsDTO> {
    const baseFilters = {
      categoryId: filters?.categoryId,
      bank: filters?.bank,
      accountingMonth: filters?.accountingMonth,
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
      search: filters?.search,
      isInstallment: filters?.isInstallment,
      minInstallmentTotal: filters?.minInstallmentTotal,
      maxInstallmentTotal: filters?.maxInstallmentTotal,
      reviewStatus: filters?.reviewStatus,
      transactionType: filters?.transactionType,
      sortBy: filters?.sortBy,
      sortDir: filters?.sortDir,
    };

    const [transactions, total, summary] = await Promise.all([
      this.transactionRepo.findByUserId(userId, {
        ...baseFilters,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.transactionRepo.countByUserId(userId, baseFilters),
      this.transactionRepo.aggregateByUserId(userId, baseFilters),
    ]);

    return {
      data: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        bank: t.bank ?? '',
        accountType: t.accountType ?? '',
        categoryId: t.categoryId,
        date: t.date.toISOString(),
        description: t.description,
        merchant: t.merchant,
        amount: t.amount,
        currency: t.currency,
        isInstallment: t.isInstallment,
        installmentNum: t.installmentNum,
        installmentTotal: t.installmentTotal,
        notes: t.notes,
        reviewStatus: t.reviewStatus,
        transactionType: (t.transactionType ?? 'expense') as 'expense' | 'income' | 'transfer',
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary,
    };
  }
}
