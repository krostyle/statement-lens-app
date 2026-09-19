import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { Budget, CreateBudgetInput } from '@/src/domain/entities/budget';

/** In-memory IBudgetRepository for use-case unit tests. */
export function createMockBudgetRepo(existing: Budget[] = []): IBudgetRepository {
  const store: Budget[] = [...existing];
  let idCounter = 0;

  return {
    findByUserId: async (userId, month) =>
      store.filter((b) => b.userId === userId && (month === undefined || b.month === month)),
    upsert: async (data: CreateBudgetInput) => {
      const found = store.find(
        (b) => b.userId === data.userId && b.categoryId === data.categoryId && b.month === data.month
      );
      if (found) {
        found.monthlyAmount = data.monthlyAmount;
        found.updatedAt = new Date();
        return found;
      }
      const budget: Budget = { id: `budget-${++idCounter}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      store.push(budget);
      return budget;
    },
    delete: async (userId, categoryId, month) => {
      const idx = store.findIndex((b) => b.userId === userId && b.categoryId === categoryId && b.month === month);
      if (idx >= 0) store.splice(idx, 1);
    },
  };
}
