import type { Transaction } from '@/src/domain/entities/transaction';
import type { TransactionResponseDTO } from '@/src/application/dtos/transaction.dto';

export function toTransactionDTO(t: Transaction): TransactionResponseDTO {
  return {
    id: t.id,
    userId: t.userId,
    statementId: t.statementId,
    categoryId: t.categoryId,
    date: t.date.toISOString(),
    description: t.description,
    merchant: t.merchant,
    amount: t.amount,
    currency: t.currency,
    isInstallment: t.isInstallment,
    installmentNum: t.installmentNum,
    installmentTotal: t.installmentTotal,
    notes: t.notes,
  };
}
