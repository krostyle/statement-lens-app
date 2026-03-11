import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';

export interface BudgetResponseDTO {
  id: string;
  categoryId: string;
  monthlyAmount: number;
}

export class ListBudgetsUseCase {
  constructor(private readonly budgetRepo: IBudgetRepository) {}

  async execute(userId: string): Promise<BudgetResponseDTO[]> {
    const budgets = await this.budgetRepo.findByUserId(userId);
    return budgets.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      monthlyAmount: b.monthlyAmount,
    }));
  }
}
