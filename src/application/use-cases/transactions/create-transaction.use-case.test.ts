import { describe, it, expect, beforeEach } from 'vitest';
import { CreateTransactionUseCase } from './create-transaction.use-case';
import type { ITransactionRepository } from '@/src/domain/repositories/transaction.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { Transaction, CreateTransactionInput } from '@/src/domain/entities/transaction';
import type { Category, CreateCategoryInput } from '@/src/domain/entities/category';

let idCounter = 0;

function createMockCategoryRepo(existing: Category[] = []): ICategoryRepository {
  const store: Category[] = [...existing];
  return {
    findById: async (id) => store.find((c) => c.id === id) ?? null,
    findByUserId: async (userId) => store.filter((c) => c.userId === userId),
    findByUserIdAndName: async (userId, name) =>
      store.find((c) => c.userId === userId && c.name === name) ?? null,
    create: async (data: CreateCategoryInput) => {
      const cat: Category = { id: `cat-${++idCounter}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      store.push(cat);
      return cat;
    },
    update: async (id, data) => {
      const cat = store.find((c) => c.id === id)!;
      Object.assign(cat, data);
      return cat;
    },
    delete: async () => {},
    createMany: async () => {},
  };
}

function createMockTransactionRepo(): ITransactionRepository {
  const store: Transaction[] = [];
  return {
    findById: async (id) => store.find((t) => t.id === id) ?? null,
    findByUserId: async (userId) => store.filter((t) => t.userId === userId),
    findByStatementId: async (statementId) => store.filter((t) => t.statementId === statementId),
    create: async (data: CreateTransactionInput) => {
      const tx: Transaction = {
        id: `tx-${++idCounter}`,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      store.push(tx);
      return tx;
    },
    createMany: async () => {},
    update: async (id, data) => {
      const tx = store.find((t) => t.id === id)!;
      Object.assign(tx, data);
      return tx;
    },
    delete: async () => {},
  };
}

const category: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Alimentación',
  color: '#f97316',
  icon: 'ShoppingCart',
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;

  beforeEach(() => {
    useCase = new CreateTransactionUseCase(
      createMockTransactionRepo(),
      createMockCategoryRepo([{ ...category }])
    );
  });

  it('creates a transaction and returns DTO', async () => {
    const result = await useCase.execute('user-1', {
      categoryId: 'cat-1',
      date: '2024-03-15',
      description: 'Supermercado Lider',
      merchant: 'Lider',
      amount: -15000,
      currency: 'CLP',
    });
    expect(result.merchant).toBe('Lider');
    expect(result.amount).toBe(-15000);
    expect(result.currency).toBe('CLP');
    expect(result.isInstallment).toBe(false);
  });

  it('throws when category does not belong to user', async () => {
    await expect(
      useCase.execute('other-user', {
        categoryId: 'cat-1',
        date: '2024-03-15',
        description: 'Test',
        merchant: 'Test',
        amount: -1000,
      })
    ).rejects.toThrow('Category not found');
  });

  it('throws when category id does not exist', async () => {
    await expect(
      useCase.execute('user-1', {
        categoryId: 'cat-nonexistent',
        date: '2024-03-15',
        description: 'Test',
        merchant: 'Test',
        amount: -1000,
      })
    ).rejects.toThrow('Category not found');
  });
});
