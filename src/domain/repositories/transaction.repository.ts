import type { Transaction, CreateTransactionInput, UpdateTransactionInput } from '../entities/transaction';

export interface TransactionSummary {
  /** Sum of expense-type amounts (negative value, e.g. -500000) */
  expenses: number;
  /** Sum of income-type amounts (positive value) */
  income: number;
  /** Total number of matching transactions */
  count: number;
}

export interface TransactionFilters {
  categoryId?: string;
  bank?: string;
  accountType?: string;
  origin?: string;
  /** When set, overrides from/to: shows tracking txs by accountingMonth + other txs by date in same month */
  accountingMonth?: string;
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
  aggregateByUserId(userId: string, filters?: Omit<TransactionFilters, 'skip' | 'take'>): Promise<TransactionSummary>;
  findInstallmentGroup(userId: string, merchant: string, installmentTotal: number, currentId: string): Promise<Transaction[]>;
  /** Returns all origin='tracking' transactions for a given YYYY-MM month. */
  findTrackingByMonth(userId: string, month: string): Promise<Transaction[]>;
  /** Returns distinct YYYY-MM months that have origin='tracking' transactions, descending. */
  findTrackingMonths(userId: string): Promise<string[]>;
  create(data: CreateTransactionInput): Promise<Transaction>;
  createMany(data: CreateTransactionInput[]): Promise<void>;
  /** Like createMany but returns the inserted records. */
  createManyAndReturn(data: CreateTransactionInput[]): Promise<Transaction[]>;
  update(id: string, data: UpdateTransactionInput): Promise<Transaction>;
  updateMany(ids: string[], userId: string, data: UpdateTransactionInput): Promise<number>;
  confirmAllPending(userId: string): Promise<number>;
  delete(id: string): Promise<void>;
  deleteManyByIds(ids: string[], userId: string): Promise<number>;
  /**
   * Deletes origin='tracking' transactions.
   * - If month is provided, scoped to that YYYY-MM date range.
   * - If month is omitted, deletes all for userId+bank+accountType (used when re-uploading a full source).
   */
  deleteManyTracking(userId: string, month?: string, bank?: string, accountType?: string): Promise<void>;
}
