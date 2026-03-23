import type { ITransactionRepository, TransactionFilters } from '@/src/domain/repositories/transaction.repository';
import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from '@/src/domain/entities/transaction';
import { prisma } from '../prisma.client';
import { Prisma } from '@prisma/client';

function buildWhere(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.statementId) where.statementId = filters.statementId;
  if (filters?.from || filters?.to) {
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
    const results = await prisma.transaction.findMany({
      where: buildWhere(userId, filters),
      orderBy: { date: 'desc' },
      skip: filters?.skip,
      take: filters?.take,
    });
    return results as Transaction[];
  }

  async countByUserId(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Promise<number> {
    return prisma.transaction.count({ where: buildWhere(userId, filters) });
  }

  async findByStatementId(statementId: string): Promise<Transaction[]> {
    return prisma.transaction.findMany({ where: { statementId } }) as Promise<Transaction[]>;
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

  async delete(id: string): Promise<void> {
    await prisma.transaction.delete({ where: { id } });
  }
}
