import type { Transaction } from '@/src/domain/entities/transaction';
import type { SnapshotTransaction } from '@/src/domain/entities/snapshot';

/** Converts a Transaction record to the SnapshotTransaction shape expected by the tracking UI. */
export function txToSnapshot(
  tx: Transaction,
  categoryNameMap: Map<string, string>,
): SnapshotTransaction {
  return {
    id:              tx.id,
    date:            tx.date.toISOString().slice(0, 10),
    description:     tx.description,
    merchant:        tx.merchant,
    amount:          tx.amount,
    transactionType: tx.transactionType as SnapshotTransaction['transactionType'],
    categoryId:      tx.categoryId,
    categoryName:    categoryNameMap.get(tx.categoryId) ?? 'Otros',
    source:          (tx.accountType as 'checking' | 'credit_card') || 'credit_card',
    bank:            tx.bank,
  };
}

/** Month date range for use in repository queries. */
export function monthRange(month: string): { from: Date; to: Date } {
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const to   = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  return { from, to };
}
