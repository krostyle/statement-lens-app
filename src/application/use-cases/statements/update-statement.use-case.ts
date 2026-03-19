import type { IStatementRepository } from '@/src/domain/repositories/statement.repository';
import type { StatementBank } from '@/src/domain/entities/statement';
import type { StatementResponseDTO } from '@/src/application/dtos/statement.dto';

export class UpdateStatementUseCase {
  constructor(private readonly statementRepo: IStatementRepository) {}

  async execute(id: string, userId: string, dto: { bank: StatementBank; month: string }): Promise<StatementResponseDTO> {
    const statement = await this.statementRepo.findById(id);
    if (!statement) throw new Error('Statement not found');
    if (statement.userId !== userId) throw new Error('Forbidden');

    const all = await this.statementRepo.findByUserId(userId);
    if (all.some((s) => s.id !== id && s.bank === dto.bank && s.month === dto.month))
      throw new Error('DuplicateStatement');

    const fileName = `${dto.bank}_${dto.month}.pdf`;
    const updated = await this.statementRepo.update(id, { bank: dto.bank, month: dto.month, fileName });

    return {
      id: updated.id,
      userId: updated.userId,
      bank: updated.bank,
      month: updated.month,
      fileName: updated.fileName,
      s3Url: updated.s3Url,
      status: updated.status,
      errorMessage: updated.errorMessage ?? undefined,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
