import { describe, it, expect } from 'vitest';
import { BulkUpdateTransactionsUseCase } from './bulk-update-transactions.use-case';
import { createMockTransactionRepo } from '@/src/test/mocks/transaction-repository.mock';
import { createMockCategoryRepo } from '@/src/test/mocks/category-repository.mock';
import type { Transaction } from '@/src/domain/entities/transaction';
import type { Category } from '@/src/domain/entities/category';

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random()}`,
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

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Alimentación',
    color: '#f97316',
    icon: 'ShoppingCart',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BulkUpdateTransactionsUseCase', () => {
  it('returns 0 without touching the repo when ids is empty', async () => {
    const txRepo = createMockTransactionRepo([makeTransaction({ id: 'tx-1' })]);
    const useCase = new BulkUpdateTransactionsUseCase(txRepo, createMockCategoryRepo());

    const count = await useCase.execute('user-1', [], { reviewStatus: 'confirmed' });

    expect(count).toBe(0);
  });

  it('updates only transactions owned by the user', async () => {
    const txRepo = createMockTransactionRepo([
      makeTransaction({ id: 'tx-1', userId: 'user-1', reviewStatus: 'pending' }),
      makeTransaction({ id: 'tx-2', userId: 'other-user', reviewStatus: 'pending' }),
    ]);
    const useCase = new BulkUpdateTransactionsUseCase(txRepo, createMockCategoryRepo());

    const count = await useCase.execute('user-1', ['tx-1', 'tx-2'], { reviewStatus: 'confirmed' });

    expect(count).toBe(1);
    expect((await txRepo.findById('tx-1'))?.reviewStatus).toBe('confirmed');
    expect((await txRepo.findById('tx-2'))?.reviewStatus).toBe('pending');
  });

  it('throws when categoryId does not belong to the user', async () => {
    const txRepo = createMockTransactionRepo([makeTransaction({ id: 'tx-1' })]);
    const catRepo = createMockCategoryRepo([makeCategory({ id: 'cat-1', userId: 'user-1' })]);
    const useCase = new BulkUpdateTransactionsUseCase(txRepo, catRepo);

    await expect(
      useCase.execute('user-1', ['tx-1'], { categoryId: 'cat-nonexistent' })
    ).rejects.toThrow('Categoría no válida');
  });

  it('applies a valid categoryId update', async () => {
    const txRepo = createMockTransactionRepo([makeTransaction({ id: 'tx-1', categoryId: 'cat-1' })]);
    const catRepo = createMockCategoryRepo([
      makeCategory({ id: 'cat-1', userId: 'user-1' }),
      makeCategory({ id: 'cat-2', userId: 'user-1', name: 'Transporte' }),
    ]);
    const useCase = new BulkUpdateTransactionsUseCase(txRepo, catRepo);

    const count = await useCase.execute('user-1', ['tx-1'], { categoryId: 'cat-2' });

    expect(count).toBe(1);
    expect((await txRepo.findById('tx-1'))?.categoryId).toBe('cat-2');
  });
});
