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
  statementId?: string | null;
}

export interface UpdateTransactionDTO {
  categoryId?: string;
  merchant?: string;
  amount?: number;
  notes?: string | null;
  date?: string;
  description?: string;
}

export interface TransactionFiltersDTO {
  categoryId?: string;
  statementId?: string;
  bank?: string;
  from?: string;
  to?: string;
  search?: string;
  isInstallment?: boolean;
  minInstallmentTotal?: number;
  maxInstallmentTotal?: number;
}

export interface TransactionResponseDTO {
  id: string;
  userId: string;
  statementId?: string | null;
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
}
