export type ReviewStatus = 'pending' | 'auto' | 'confirmed' | 'manual';
export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  categoryId: string;
  date: Date;
  description: string;
  merchant: string;
  amount: number;
  currency: string;
  /** Source bank ('santander' | 'falabella' | ...); '' = unknown/manual entry */
  bank: string;
  isInstallment: boolean;
  installmentNum?: number | null;
  installmentTotal?: number | null;
  notes?: string | null;
  reviewStatus: ReviewStatus;
  transactionType: TransactionType;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateTransactionInput = Pick<
  Transaction,
  | 'userId'
  | 'categoryId'
  | 'date'
  | 'description'
  | 'merchant'
  | 'amount'
  | 'currency'
  | 'isInstallment'
  | 'installmentNum'
  | 'installmentTotal'
> & { bank?: string; reviewStatus?: ReviewStatus; transactionType?: TransactionType };

export type UpdateTransactionInput = Partial<
  Pick<Transaction, 'categoryId' | 'merchant' | 'amount' | 'notes' | 'date' | 'description' | 'reviewStatus' | 'transactionType' | 'installmentNum' | 'installmentTotal'>
>;
