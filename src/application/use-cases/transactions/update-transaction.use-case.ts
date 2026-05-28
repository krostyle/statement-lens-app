import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { UpdateTransactionDTO, TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';

export class UpdateTransactionUseCase {
  constructor(private readonly transactionRepo: ITransactionRepository) {}

  async execute(id: string, userId: string, dto: UpdateTransactionDTO): Promise<TransactionResponseDTO> {
    const transaction = await this.transactionRepo.findById(id);
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.userId !== userId) throw new Error('Forbidden');

    // If reviewStatus is not explicitly set and at least one content field changes,
    // auto-promote to 'manual' to mark that the user reviewed this transaction.
    const hasContentChange =
      dto.categoryId      !== undefined ||
      dto.merchant        !== undefined ||
      dto.description     !== undefined ||
      dto.amount          !== undefined ||
      dto.notes           !== undefined ||
      dto.date            !== undefined ||
      dto.transactionType !== undefined ||
      dto.installmentNum  !== undefined ||
      dto.installmentTotal !== undefined;

    const reviewStatus = dto.reviewStatus ?? (hasContentChange ? 'manual' : undefined);

    const updated = await this.transactionRepo.update(id, {
      ...dto,
      ...(reviewStatus ? { reviewStatus } : {}),
      date: dto.date ? new Date(dto.date) : undefined,
    });

    return {
      id: updated.id,
      userId: updated.userId,
      statementId: updated.statementId,
      categoryId: updated.categoryId,
      date: updated.date.toISOString(),
      description: updated.description,
      merchant: updated.merchant,
      amount: updated.amount,
      currency: updated.currency,
      isInstallment: updated.isInstallment,
      installmentNum: updated.installmentNum,
      installmentTotal: updated.installmentTotal,
      notes: updated.notes,
      reviewStatus: updated.reviewStatus,
      transactionType: (updated.transactionType ?? 'expense') as 'expense' | 'income' | 'transfer',
    };
  }
}
