/** Shape returned by all /api/snapshot/* endpoints and consumed by the tracking UI. */
export interface SnapshotTransaction {
  id: string;                                          // Transaction.id (real DB UUID)
  date: string;                                        // "YYYY-MM-DD"
  description: string;
  merchant: string;
  amount: number;                                      // negative = expense, positive = income/credit
  transactionType: 'expense' | 'income' | 'transfer';
  categoryId: string;
  categoryName: string;
  source: 'checking' | 'credit_card';                 // maps to Transaction.accountType
  bank: string;
}
