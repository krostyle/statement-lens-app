import type { Budget, CreateBudgetInput } from '../entities/budget';

export interface IBudgetRepository {
  findByUserId(userId: string): Promise<Budget[]>;
  upsert(data: CreateBudgetInput): Promise<Budget>;
  delete(userId: string, categoryId: string): Promise<void>;
}
