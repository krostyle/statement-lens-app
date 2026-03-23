import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { TransactionFiltersDTO, TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';

export interface PaginatedTransactionsDTO {
  data: TransactionResponseDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
      statementId: filters?.statementId,
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
      search: filters?.search,
      isInstallment: filters?.isInstallment,
    };

    const [transactions, total] = await Promise.all([
      this.transactionRepo.findByUserId(userId, {
        ...baseFilters,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.transactionRepo.countByUserId(userId, baseFilters),
    ]);

    return {
      data: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        statementId: t.statementId,
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
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
