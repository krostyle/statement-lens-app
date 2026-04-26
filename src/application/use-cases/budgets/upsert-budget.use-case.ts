import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { BudgetResponseDTO } from './list-budgets.use-case';

export class UpsertBudgetUseCase {
  constructor(
    private readonly budgetRepo: IBudgetRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(
    userId: string,
    categoryId: string,
    monthlyAmount: number,
    month: string,
  ): Promise<BudgetResponseDTO> {
    const category = await this.categoryRepo.findById(categoryId);
    if (!category || category.userId !== userId) {
      throw new Error('Category not found');
    }
    const budget = await this.budgetRepo.upsert({ userId, categoryId, month, monthlyAmount });
    return {
      id: budget.id,
      categoryId: budget.categoryId,
      month: budget.month,
      monthlyAmount: budget.monthlyAmount,
    };
  }
}
