import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { UpdateTransactionInput } from '@/src/domain/entities/transaction';

export class BulkUpdateTransactionsUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(
    userId: string,
    ids: string[],
    update: UpdateTransactionInput,
  ): Promise<number> {
    if (ids.length === 0) return 0;

    // Validate that categoryId belongs to the user before applying
    if (update.categoryId) {
      const categories = await this.categoryRepo.findByUserId(userId);
      const valid = categories.some((c) => c.id === update.categoryId);
      if (!valid) throw new Error('Categoría no válida');
    }

    // The repository scopes the WHERE clause to userId, so arbitrary IDs
    // from the client cannot affect another user's transactions.
    // When only reviewStatus is being set (bulk confirm), skip category validation.
    return this.transactionRepo.updateMany(ids, userId, update);
  }
}
