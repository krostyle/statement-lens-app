import type { IStatementRepository } from '@/src/domain/repositories/statement.repository';
import type { Statement, CreateStatementInput, StatementStatus } from '@/src/domain/entities/statement';
import { prisma } from '../prisma.client';

export class StatementPrismaRepository implements IStatementRepository {
  async findById(id: string): Promise<Statement | null> {
    const s = await prisma.statement.findUnique({ where: { id } });
    return s as Statement | null;
  }

  async findByUserId(userId: string): Promise<Statement[]> {
    const statements = await prisma.statement.findMany({
      where: { userId },
      orderBy: { month: 'desc' },
    });
    return statements as Statement[];
  }

  async create(data: CreateStatementInput): Promise<Statement> {
    const s = await prisma.statement.create({ data: { ...data, status: 'pending' } });
    return s as Statement;
  }

  async updateStatus(id: string, status: StatementStatus, errorMessage?: string): Promise<Statement> {
    const s = await prisma.statement.update({
      where: { id },
      data: { status, ...(errorMessage !== undefined ? { errorMessage } : { errorMessage: null }) },
    });
    return s as Statement;
  }

  async delete(id: string): Promise<void> {
    await prisma.statement.delete({ where: { id } });
  }
}
