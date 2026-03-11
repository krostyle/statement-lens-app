import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateCategoryUseCase } from './update-category.use-case';
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

const baseCategory: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Alimentación',
  color: '#f97316',
  icon: 'ShoppingCart',
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UpdateCategoryUseCase', () => {
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    useCase = new UpdateCategoryUseCase(createMockCategoryRepo([{ ...baseCategory }]));
  });

  it('updates a category and returns updated DTO', async () => {
    const result = await useCase.execute('cat-1', 'user-1', { name: 'Comida', color: '#ff0000' });
    expect(result.name).toBe('Comida');
    expect(result.color).toBe('#ff0000');
  });

  it('throws when category not found', async () => {
    await expect(
      useCase.execute('cat-999', 'user-1', { name: 'X' })
    ).rejects.toThrow('Category not found');
  });

  it('throws when category belongs to different user', async () => {
    await expect(
      useCase.execute('cat-1', 'other-user', { name: 'X' })
    ).rejects.toThrow('Forbidden');
  });
});
