import type { IStatementRepository } from '@/src/domain/repositories/statement.repository';
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';

export class ListStatementsUseCase {
  constructor(private readonly statementRepo: IStatementRepository) {}

  async execute(userId: string): Promise<StatementResponseDTO[]> {
    const statements = await this.statementRepo.findByUserId(userId);
    return statements.map((s) => ({
      id: s.id,
      userId: s.userId,
      bank: s.bank,
      month: s.month,
      fileName: s.fileName,
      s3Url: s.s3Url,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}
