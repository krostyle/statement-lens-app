import type { Budget, CreateBudgetInput } from '../entities/budget';

export interface IBudgetRepository {
  findByUserId(userId: string, month?: string): Promise<Budget[]>;
  upsert(data: CreateBudgetInput): Promise<Budget>;
  delete(userId: string, categoryId: string, month: string): Promise<void>;
}
