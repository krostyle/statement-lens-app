export interface CreateTransactionDTO {
  categoryId: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  currency?: string;
  isInstallment?: boolean;
  installmentNum?: number | null;
  installmentTotal?: number | null;
  bank?: string;
}

export interface UpdateTransactionDTO {
  categoryId?: string;
  merchant?: string;
  amount?: number;
  notes?: string | null;
  date?: string;
  description?: string;
  reviewStatus?: 'pending' | 'auto' | 'confirmed' | 'manual';
  transactionType?: 'expense' | 'income' | 'transfer';
  installmentNum?: number | null;
  installmentTotal?: number | null;
}

export interface TransactionFiltersDTO {
  categoryId?: string;
  bank?: string;
  /** 'checking' | 'credit_card' */
  accountType?: string;
  /** YYYY-MM — overrides from/to when set */
  accountingMonth?: string;
  from?: string;
  to?: string;
  search?: string;
  isInstallment?: boolean;
  minInstallmentTotal?: number;
  maxInstallmentTotal?: number;
  reviewStatus?: string;
  transactionType?: string;
  sortBy?: 'date' | 'amount';
  sortDir?: 'asc' | 'desc';
}

export interface TransactionResponseDTO {
  id: string;
  userId: string;
  /** Source bank ('santander' | ...); '' = unknown/manual entry */
  bank: string;
  /** 'checking' | 'credit_card' | '' */
  accountType: string;
  categoryId: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  currency: string;
  isInstallment: boolean;
  installmentNum?: number | null;
  installmentTotal?: number | null;
  notes?: string | null;
  reviewStatus: 'pending' | 'auto' | 'confirmed' | 'manual';
  transactionType: 'expense' | 'income' | 'transfer';
}
