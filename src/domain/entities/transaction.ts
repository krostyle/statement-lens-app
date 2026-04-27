export type ReviewStatus = 'pending' | 'auto' | 'confirmed' | 'manual';

export interface Transaction {
  id: string;
  userId: string;
  statementId?: string | null;
  categoryId: string;
  date: Date;
  description: string;
  merchant: string;
  amount: number;
  currency: string;
  isInstallment: boolean;
  installmentNum?: number | null;
  installmentTotal?: number | null;
  notes?: string | null;
  reviewStatus: ReviewStatus;
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
  | 'statementId'
> & { reviewStatus?: ReviewStatus };

export type UpdateTransactionInput = Partial<
  Pick<Transaction, 'categoryId' | 'merchant' | 'amount' | 'notes' | 'date' | 'description' | 'reviewStatus'>
>;
