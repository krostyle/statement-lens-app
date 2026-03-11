import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUseCase } from './register.use-case';
import type { IUserRepository } from '@/src/domain/repositories/user.repository';
import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { User } from '@/src/domain/entities/user';
import type { Category, CreateCategoryInput } from '@/src/domain/entities/category';
import { DEFAULT_CATEGORIES } from '@/src/domain/services/category.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashed',
    name: 'Test User',
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockUserRepo(existingUser: User | null = null): IUserRepository {
  const store: User[] = existingUser ? [existingUser] : [];
  return {
    findById: async (id) => store.find((u) => u.id === id) ?? null,
    findByEmail: async (email) => store.find((u) => u.email === email) ?? null,
    findByResetToken: async () => null,
    create: async (data) => {
      const user = makeUser({ ...data, id: 'user-new' });
      store.push(user);
      return user;
    },
    updatePassword: async (id, pw) => store.find((u) => u.id === id)!,
    setResetToken: async (id) => store.find((u) => u.id === id)!,
  };
}

function createMockCategoryRepo(): ICategoryRepository & { created: CreateCategoryInput[] } {
  const created: CreateCategoryInput[] = [];
  return {
    created,
    findById: async () => null,
    findByUserId: async () => [],
    findByUserIdAndName: async () => null,
    create: async (data) => ({ id: 'cat-1', ...data, createdAt: new Date(), updatedAt: new Date() } as Category),
    update: async () => ({} as Category),
    delete: async () => {},
    createMany: async (data) => { created.push(...data); },
  };
}

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let categoryRepo: ReturnType<typeof createMockCategoryRepo>;

  beforeEach(() => {
    categoryRepo = createMockCategoryRepo();
    useCase = new RegisterUseCase(createMockUserRepo(), categoryRepo);
  });

  it('creates a new user and returns id and email', async () => {
    const result = await useCase.execute({
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    });
    expect(result.email).toBe('new@example.com');
    expect(result.id).toBeTruthy();
  });

  it('throws when email is already registered', async () => {
    const existing = makeUser({ email: 'dupe@example.com' });
    useCase = new RegisterUseCase(createMockUserRepo(existing), categoryRepo);
    await expect(
      useCase.execute({ email: 'dupe@example.com', password: 'pass', name: 'User' })
    ).rejects.toThrow('Email already registered');
  });

  it('seeds default categories for new user', async () => {
    await useCase.execute({ email: 'new@example.com', password: 'pass123', name: 'User' });
    expect(categoryRepo.created).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(categoryRepo.created.every((c) => c.isDefault)).toBe(true);
  });
});
