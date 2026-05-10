export interface SnapshotTransaction {
  id: string;                                          // UUID assigned at parse time
  date: string;                                        // "YYYY-MM-DD"
  description: string;
  merchant: string;
  amount: number;                                      // negative = expense, positive = income/credit
  transactionType: 'expense' | 'income' | 'transfer';
  categoryId: string;
  categoryName: string;
  source: 'checking' | 'credit_card';
  bank: string;                                        // 'santander' | 'falabella' | 'bci' | 'bancoestado' | 'liderbci'
}

export interface Snapshot {
  id: string;
  userId: string;
  month: string;
  checkingTxs: SnapshotTransaction[] | null;
  ccTxs: SnapshotTransaction[] | null;
  createdAt: Date;
  updatedAt: Date;
}
