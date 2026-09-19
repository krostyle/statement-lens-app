import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { Category, CreateCategoryInput } from '@/src/domain/entities/category';

/** In-memory ICategoryRepository for use-case unit tests. */
export function createMockCategoryRepo(existing: Category[] = []): ICategoryRepository {
  const store: Category[] = [...existing];
  let idCounter = 0;

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
      const cat = store.find((c) => c.id === id);
      if (!cat) throw new Error('Category not found');
      Object.assign(cat, data);
      return cat;
    },
    delete: async (id) => {
      const idx = store.findIndex((c) => c.id === id);
      if (idx >= 0) store.splice(idx, 1);
    },
    createMany: async (data) => {
      data.forEach((d) => store.push({ id: `cat-${++idCounter}`, ...d, createdAt: new Date(), updatedAt: new Date() }));
    },
  };
}
