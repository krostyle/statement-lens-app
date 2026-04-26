import type { IMonthCloseRepository } from '@/src/domain/repositories/month-close.repository';
import type { MonthClose, CreateMonthCloseInput, CategorySummary } from '@/src/domain/entities/month-close';
import { prisma } from '../prisma.client';

function mapRow(row: {
  id: string;
  userId: string;
  month: string;
  totalSpent: number;
  totalBudget: number;
  summary: unknown;
  aiSuggestions: string;
  notes: string | null;
  closedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): MonthClose {
  return {
    ...row,
    summary: row.summary as CategorySummary[],
  };
}

export class MonthClosePrismaRepository implements IMonthCloseRepository {
  async findByUserId(userId: string): Promise<MonthClose[]> {
    const rows = await prisma.monthClose.findMany({
      where: { userId },
      orderBy: { month: 'desc' },
    });
    return rows.map(mapRow);
  }

  async findById(id: string, userId: string): Promise<MonthClose | null> {
    const row = await prisma.monthClose.findFirst({ where: { id, userId } });
    return row ? mapRow(row) : null;
  }

  async create(data: CreateMonthCloseInput): Promise<MonthClose> {
    const row = await prisma.monthClose.create({
      data: {
        userId: data.userId,
        month: data.month,
        totalSpent: data.totalSpent,
        totalBudget: data.totalBudget,
        summary: data.summary as object[],
        aiSuggestions: data.aiSuggestions,
        notes: data.notes ?? null,
      },
    });
    return mapRow(row);
  }

  async update(
    id: string,
    userId: string,
    data: Partial<Pick<MonthClose, 'notes' | 'aiSuggestions'>>,
  ): Promise<MonthClose> {
    const row = await prisma.monthClose.update({
      where: { id },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.aiSuggestions !== undefined ? { aiSuggestions: data.aiSuggestions } : {}),
      },
    });
    // Verify ownership
    if (row.userId !== userId) throw new Error('Not found');
    return mapRow(row);
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.monthClose.deleteMany({ where: { id, userId } });
  }

  async existsForMonth(userId: string, month: string): Promise<boolean> {
    const count = await prisma.monthClose.count({ where: { userId, month } });
    return count > 0;
  }
}
