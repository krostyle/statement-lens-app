import { describe, it, expect, beforeEach } from 'vitest';
import { CreateCategoryUseCase } from './create-category.use-case';
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
    createMany: async (data) => { data.forEach((d) => store.push({ id: `cat-${++idCounter}`, ...d, createdAt: new Date(), updatedAt: new Date() })); },
  };
}

describe('CreateCategoryUseCase', () => {
  let useCase: CreateCategoryUseCase;
  let repo: ICategoryRepository;

  beforeEach(() => {
    repo = createMockCategoryRepo();
    useCase = new CreateCategoryUseCase(repo);
  });

  it('creates a category and returns DTO', async () => {
    const result = await useCase.execute('user-1', {
      name: 'Viajes',
      color: '#84cc16',
      icon: 'Plane',
    });
    expect(result.name).toBe('Viajes');
    expect(result.userId).toBe('user-1');
    expect(result.isDefault).toBe(false);
  });

  it('throws when category name already exists for user', async () => {
    const existing: Category = {
      id: 'cat-existing',
      userId: 'user-1',
      name: 'Viajes',
      color: '#84cc16',
      icon: 'Plane',
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repo = createMockCategoryRepo([existing]);
    useCase = new CreateCategoryUseCase(repo);
    await expect(
      useCase.execute('user-1', { name: 'Viajes', color: '#84cc16', icon: 'Plane' })
    ).rejects.toThrow('Category with this name already exists');
  });
});
