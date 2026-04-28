export type StatementBank = 'santander' | 'falabella' | 'liderbci' | 'bci' | 'bancoestado';
export type StatementStatus = 'pending' | 'processing' | 'done' | 'error';
export type StatementType = 'credit_card' | 'checking';

export interface Statement {
  id: string;
  userId: string;
  bank: StatementBank;
  month: string;
  statementType: StatementType;
  fileName: string;
  s3Key: string;
  s3Url: string;
  status: StatementStatus;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStatementInput = Pick<Statement, 'userId' | 'bank' | 'month' | 'statementType' | 'fileName' | 's3Key' | 's3Url'>;
export type UpdateStatementInput = Pick<Statement, 'bank' | 'month' | 'fileName'>;
