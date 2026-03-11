import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { CreateTransactionDTO, TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';

export class CreateTransactionUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository
  ) {}

  async execute(userId: string, dto: CreateTransactionDTO): Promise<TransactionResponseDTO> {
    const category = await this.categoryRepo.findById(dto.categoryId);
    if (!category || category.userId !== userId) throw new Error('Category not found');

    const transaction = await this.transactionRepo.create({
      userId,
      categoryId: dto.categoryId,
      date: new Date(dto.date),
      description: dto.description,
      merchant: dto.merchant,
      amount: dto.amount,
      currency: dto.currency ?? 'CLP',
      isInstallment: dto.isInstallment ?? false,
      installmentNum: dto.installmentNum ?? null,
      installmentTotal: dto.installmentTotal ?? null,
      statementId: dto.statementId ?? null,
    });

    return {
      id: transaction.id,
      userId: transaction.userId,
      statementId: transaction.statementId,
      categoryId: transaction.categoryId,
      date: transaction.date.toISOString(),
      description: transaction.description,
      merchant: transaction.merchant,
      amount: transaction.amount,
      currency: transaction.currency,
      isInstallment: transaction.isInstallment,
      installmentNum: transaction.installmentNum,
      installmentTotal: transaction.installmentTotal,
      notes: transaction.notes,
    };
  }
}
