import type { ITransactionRepository, TransactionFilters, TransactionSummary } from '@/src/domain/repositories/transaction.repository';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from '@/src/domain/entities/transaction';
import { prisma } from '../prisma.client';
import { Prisma } from '@prisma/client';

function buildWhere(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.bank) where.bank = filters.bank;
  if (filters?.accountType !== undefined) where.accountType = filters.accountType;
  if (filters?.origin !== undefined) where.origin = filters.origin;
  if (filters?.accountingMonth) {
    const from = new Date(`${filters.accountingMonth}-01T00:00:00.000Z`);
    const to   = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    // Tracking rows: match by accountingMonth field.
    // Manual / legacy rows: match by date falling in the same calendar month.
    where.OR = [
      { accountingMonth: filters.accountingMonth },
      { accountingMonth: '', date: { gte: from, lt: to } },
    ];
  } else if (filters?.from || filters?.to) {
    where.date = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters?.search) {
    where.OR = [
      { merchant: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters?.isInstallment !== undefined) where.isInstallment = filters.isInstallment;
  if (filters?.reviewStatus) where.reviewStatus = filters.reviewStatus;
  if (filters?.transactionType) where.transactionType = filters.transactionType;
  if (filters?.minInstallmentTotal !== undefined || filters?.maxInstallmentTotal !== undefined) {
    where.installmentTotal = {
      ...(filters.minInstallmentTotal !== undefined ? { gte: filters.minInstallmentTotal } : {}),
      ...(filters.maxInstallmentTotal !== undefined ? { lte: filters.maxInstallmentTotal } : {}),
    };
  }
  return where;
}

export class TransactionPrismaRepository implements ITransactionRepository {
  async findById(id: string): Promise<Transaction | null> {
    return prisma.transaction.findUnique({ where: { id } }) as Promise<Transaction | null>;
  }

  async findByUserId(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
    const sortBy  = filters?.sortBy  ?? 'date';
    const sortDir = filters?.sortDir ?? 'desc';
    const results = await prisma.transaction.findMany({
      where: buildWhere(userId, filters),
      orderBy: { [sortBy]: sortDir },
      skip: filters?.skip,
      take: filters?.take,
    });
    return results as Transaction[];
  }

  async countByUserId(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Promise<number> {
    return prisma.transaction.count({ where: buildWhere(userId, filters) });
  }

  async aggregateByUserId(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Promise<TransactionSummary> {
    const byType = await prisma.transaction.groupBy({
      by: ['transactionType'],
      where: buildWhere(userId, filters),
      _sum: { amount: true },
      _count: { id: true },
    });

    let expenses = 0;
    let income = 0;
    let count = 0;

    for (const row of byType) {
      const sum = row._sum.amount ?? 0;
      count += row._count.id;
      if (row.transactionType === 'income') income += sum;
      else if (row.transactionType === 'expense') expenses += sum; // negative value
      // transfers excluded from financial totals
    }

    return { expenses, income, count };
  }

  async findInstallmentGroup(userId: string, merchant: string, installmentTotal: number, currentId: string): Promise<Transaction[]> {
    // Fetch all cuotas for this merchant+total combination
    const candidates = await prisma.transaction.findMany({
      where: { userId, merchant, installmentTotal, isInstallment: true },
      orderBy: { date: 'asc' },
    }) as Transaction[];

    // Fast path: if there are at most installmentTotal rows there can only be one group
    if (candidates.length <= installmentTotal) return candidates;

    // Detect multiple purchases: build connected components.
    // Two cuotas are "adjacent" if their installmentNum values differ by 1
    // AND their dates are at most 45 days apart (one billing cycle).
    const MS_PER_DAY = 86_400_000;
    const MAX_GAP_MS = 45 * MS_PER_DAY;

    const groups: Transaction[][] = [];
    const assigned = new Set<string>();

    for (const tx of candidates) {
      if (assigned.has(tx.id)) continue;

      const group: Transaction[] = [tx];
      assigned.add(tx.id);

      // Expand group greedily until no new neighbors are found
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of candidates) {
          if (assigned.has(candidate.id)) continue;
          const isNeighbor = group.some((g) => {
            const numDiff = Math.abs((g.installmentNum ?? 0) - (candidate.installmentNum ?? 0));
            const dateDiff = Math.abs(g.date.getTime() - candidate.date.getTime());
            return numDiff === 1 && dateDiff <= MAX_GAP_MS;
          });
          if (isNeighbor) {
            group.push(candidate);
            assigned.add(candidate.id);
            changed = true;
          }
        }
      }

      groups.push(group);
    }

    // Return the group that contains the transaction being edited
    return groups.find((g) => g.some((t) => t.id === currentId)) ?? candidates;
  }

  async create(data: CreateTransactionInput): Promise<Transaction> {
    return prisma.transaction.create({ data }) as Promise<Transaction>;
  }

  async createMany(data: CreateTransactionInput[]): Promise<void> {
    await prisma.transaction.createMany({ data });
  }

  async update(id: string, data: UpdateTransactionInput): Promise<Transaction> {
    return prisma.transaction.update({ where: { id }, data }) as Promise<Transaction>;
  }

  async updateMany(ids: string[], userId: string, data: UpdateTransactionInput): Promise<number> {
    const result = await prisma.transaction.updateMany({
      where: { id: { in: ids }, userId },
      data,
    });
    return result.count;
  }

  async confirmAllPending(userId: string): Promise<number> {
    const result = await prisma.transaction.updateMany({
      where: { userId, reviewStatus: 'pending' },
      data: { reviewStatus: 'confirmed' },
    });
    return result.count;
  }

  async delete(id: string): Promise<void> {
    await prisma.transaction.delete({ where: { id } });
  }

  async deleteManyByIds(ids: string[], userId: string): Promise<number> {
    const result = await prisma.transaction.deleteMany({
      where: { id: { in: ids }, userId },
    });
    return result.count;
  }

  async findTrackingByMonth(userId: string, month: string): Promise<Transaction[]> {
    const from = new Date(`${month}-01T00:00:00.000Z`);
    const to   = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    // Prefer accountingMonth when set; fall back to date range for legacy rows
    const results = await prisma.transaction.findMany({
      where: {
        userId,
        origin: 'tracking',
        OR: [
          { accountingMonth: month },
          { accountingMonth: '', date: { gte: from, lt: to } },
        ],
      },
      orderBy: { date: 'asc' },
    });
    return results as Transaction[];
  }

  async findTrackingMonths(userId: string): Promise<string[]> {
    const rows = await prisma.transaction.findMany({
      where: { userId, origin: 'tracking' },
      select: { date: true, accountingMonth: true },
      orderBy: { date: 'desc' },
    });
    // Use accountingMonth when set; fall back to date month for legacy rows
    const months = [...new Set(rows.map((r) => r.accountingMonth || r.date.toISOString().slice(0, 7)))];
    return months;
  }

  async createManyAndReturn(data: CreateTransactionInput[]): Promise<Transaction[]> {
    const results = await prisma.transaction.createManyAndReturn({ data });
    return results as Transaction[];
  }

  async deleteManyTracking(userId: string, month?: string, bank?: string, accountType?: string): Promise<void> {
    const dateFilter = month
      ? (() => {
          const from = new Date(`${month}-01T00:00:00.000Z`);
          const to   = new Date(from);
          to.setUTCMonth(to.getUTCMonth() + 1);
          return { gte: from, lt: to };
        })()
      : undefined;
    await prisma.transaction.deleteMany({
      where: {
        userId,
        origin: 'tracking',
        ...(dateFilter   ? { date: dateFilter } : {}),
        ...(bank         ? { bank }             : {}),
        ...(accountType  ? { accountType }      : {}),
      },
    });
  }
}
