import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';

export interface BudgetResponseDTO {
  id: string;
  categoryId: string;
  month: string;
  monthlyAmount: number;
}

export class ListBudgetsUseCase {
  constructor(private readonly budgetRepo: IBudgetRepository) {}

  async execute(userId: string, month: string): Promise<BudgetResponseDTO[]> {
    const budgets = await this.budgetRepo.findByUserId(userId, month);
    return budgets.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      month: b.month,
      monthlyAmount: b.monthlyAmount,
    }));
  }
}
