import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from '../entities/transaction';

export interface TransactionFilters {
  categoryId?: string;
  statementId?: string;
  from?: Date;
  to?: Date;
  search?: string;
  isInstallment?: boolean;
  minInstallmentTotal?: number;
  maxInstallmentTotal?: number;
  skip?: number;
  take?: number;
}

export interface ITransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByUserId(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;
  countByUserId(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Promise<number>;
  findByStatementId(statementId: string): Promise<Transaction[]>;
  create(data: CreateTransactionInput): Promise<Transaction>;
  createMany(data: CreateTransactionInput[]): Promise<void>;
  update(id: string, data: UpdateTransactionInput): Promise<Transaction>;
  delete(id: string): Promise<void>;
}
