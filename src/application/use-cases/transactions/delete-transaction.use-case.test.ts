import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteTransactionUseCase } from './delete-transaction.use-case';
import { createMockTransactionRepo } from '@/src/test/mocks/transaction-repository.mock';
import type { Transaction } from '@/src/domain/entities/transaction';
import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    date: new Date('2024-03-15'),
    description: 'Supermercado',
    merchant: 'Lider',
    amount: -15000,
    currency: 'CLP',
    bank: '',
    accountType: '',
    isInstallment: false,
    notes: null,
    reviewStatus: 'pending',
    transactionType: 'expense',
    origin: 'manual',
    accountingMonth: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DeleteTransactionUseCase', () => {
  let repo: ITransactionRepository;
  let useCase: DeleteTransactionUseCase;

  beforeEach(() => {
    repo = createMockTransactionRepo([makeTransaction()]);
    useCase = new DeleteTransactionUseCase(repo);
  });

  it('deletes a transaction owned by the user', async () => {
    await useCase.execute('tx-1', 'user-1');
    expect(await repo.findById('tx-1')).toBeNull();
  });

  it('throws when the transaction does not exist', async () => {
    await expect(useCase.execute('tx-missing', 'user-1')).rejects.toThrow('Transaction not found');
  });

  it('throws Forbidden and does not delete when owned by another user', async () => {
    await expect(useCase.execute('tx-1', 'other-user')).rejects.toThrow('Forbidden');
    expect(await repo.findById('tx-1')).not.toBeNull();
  });
});
