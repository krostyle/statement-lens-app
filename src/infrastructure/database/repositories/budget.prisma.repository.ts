import type { IBudgetRepository } from '@/src/domain/repositories/budget.repository';
import type { Budget, CreateBudgetInput } from '@/src/domain/entities/budget';
import { prisma } from '../prisma.client';

export class BudgetPrismaRepository implements IBudgetRepository {
  async findByUserId(userId: string, month?: string): Promise<Budget[]> {
    return prisma.budget.findMany({
      where: { userId, ...(month ? { month } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsert(data: CreateBudgetInput): Promise<Budget> {
    return prisma.budget.upsert({
      where: {
        userId_categoryId_month: {
          userId: data.userId,
          categoryId: data.categoryId,
          month: data.month,
        },
      },
      update: { monthlyAmount: data.monthlyAmount },
      create: data,
    });
  }

  async delete(userId: string, categoryId: string, month: string): Promise<void> {
    await prisma.budget.delete({
      where: {
        userId_categoryId_month: { userId, categoryId, month },
      },
    });
  }
}
