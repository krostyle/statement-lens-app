import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';

export class DeleteTransactionUseCase {
  constructor(private readonly transactionRepo: ITransactionRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    const transaction = await this.transactionRepo.findById(id);
    if (!transaction) throw new Error('Transaction not found');
    if (transaction.userId !== userId) throw new Error('Forbidden');
    await this.transactionRepo.delete(id);
  }
}
