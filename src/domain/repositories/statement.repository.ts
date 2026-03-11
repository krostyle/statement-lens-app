import type { Statement, CreateStatementInput, StatementStatus } from '../entities/statement';

export interface IStatementRepository {
  findById(id: string): Promise<Statement | null>;
  findByUserId(userId: string): Promise<Statement[]>;
  create(data: CreateStatementInput): Promise<Statement>;
  updateStatus(id: string, status: StatementStatus, errorMessage?: string): Promise<Statement>;
  delete(id: string): Promise<void>;
}
