import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteCategoryUseCase } from './delete-category.use-case';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
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
    delete: async (id) => { const idx = store.findIndex((c) => c.id === id); store.splice(idx, 1); },
    createMany: async () => {},
  };
}

const customCategory: Category = {
  id: 'cat-custom',
  userId: 'user-1',
  name: 'Custom',
  color: '#aaaaaa',
  icon: 'Star',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultCategory: Category = {
  id: 'cat-default',
  userId: 'user-1',
  name: 'Alimentación',
  color: '#f97316',
  icon: 'ShoppingCart',
  isDefault: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DeleteCategoryUseCase', () => {
  it('deletes a non-default category successfully', async () => {
    const repo = createMockCategoryRepo([{ ...customCategory }]);
    const useCase = new DeleteCategoryUseCase(repo);
    await expect(useCase.execute('cat-custom', 'user-1')).resolves.toBeUndefined();
  });

  it('throws when category not found', async () => {
    const repo = createMockCategoryRepo([]);
    const useCase = new DeleteCategoryUseCase(repo);
    await expect(useCase.execute('cat-999', 'user-1')).rejects.toThrow('Category not found');
  });

  it('throws when category belongs to different user', async () => {
    const repo = createMockCategoryRepo([{ ...customCategory }]);
    const useCase = new DeleteCategoryUseCase(repo);
    await expect(useCase.execute('cat-custom', 'other-user')).rejects.toThrow('Forbidden');
  });

  it('deletes a default category successfully', async () => {
    const repo = createMockCategoryRepo([{ ...defaultCategory }]);
    const useCase = new DeleteCategoryUseCase(repo);
    await expect(useCase.execute('cat-default', 'user-1')).resolves.toBeUndefined();
  });
});
