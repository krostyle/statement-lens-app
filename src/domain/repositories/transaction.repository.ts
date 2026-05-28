import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from '../entities/transaction';

export interface TransactionFilters {
  categoryId?: string;
  statementId?: string;
  bank?: string;
  from?: Date;
  to?: Date;
  search?: string;
  isInstallment?: boolean;
  minInstallmentTotal?: number;
  maxInstallmentTotal?: number;
  reviewStatus?: string;
  transactionType?: string;
  sortBy?: 'date' | 'amount';
  sortDir?: 'asc' | 'desc';
  skip?: number;
  take?: number;
}

export interface ITransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByUserId(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;
  countByUserId(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Promise<number>;
  findByStatementId(statementId: string): Promise<Transaction[]>;
  findInstallmentGroup(userId: string, merchant: string, installmentTotal: number, currentId: string): Promise<Transaction[]>;
  create(data: CreateTransactionInput): Promise<Transaction>;
  createMany(data: CreateTransactionInput[]): Promise<void>;
  update(id: string, data: UpdateTransactionInput): Promise<Transaction>;
  updateMany(ids: string[], userId: string, data: UpdateTransactionInput): Promise<number>;
  confirmAllPending(userId: string): Promise<number>;
  delete(id: string): Promise<void>;
}
