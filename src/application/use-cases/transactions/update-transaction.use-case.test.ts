import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateTransactionUseCase } from './update-transaction.use-case';
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
    installmentNum: null,
    installmentTotal: null,
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

describe('UpdateTransactionUseCase', () => {
  let repo: ITransactionRepository;
  let useCase: UpdateTransactionUseCase;

  beforeEach(() => {
    repo = createMockTransactionRepo([makeTransaction()]);
    useCase = new UpdateTransactionUseCase(repo);
  });

  it('throws when the transaction does not exist', async () => {
    await expect(useCase.execute('tx-missing', 'user-1', {})).rejects.toThrow('Transaction not found');
  });

  it('throws Forbidden when the transaction belongs to another user', async () => {
    await expect(useCase.execute('tx-1', 'other-user', { merchant: 'X' })).rejects.toThrow('Forbidden');
  });

  it('auto-promotes reviewStatus to manual when a content field changes and reviewStatus is not explicit', async () => {
    const result = await useCase.execute('tx-1', 'user-1', { merchant: 'Jumbo' });
    expect(result.merchant).toBe('Jumbo');
    expect(result.reviewStatus).toBe('manual');
  });

  it('respects an explicit reviewStatus instead of auto-promoting', async () => {
    const result = await useCase.execute('tx-1', 'user-1', { merchant: 'Jumbo', reviewStatus: 'confirmed' });
    expect(result.reviewStatus).toBe('confirmed');
  });

  it('does not change reviewStatus when no content field is updated', async () => {
    const result = await useCase.execute('tx-1', 'user-1', {});
    expect(result.reviewStatus).toBe('pending');
  });
});
