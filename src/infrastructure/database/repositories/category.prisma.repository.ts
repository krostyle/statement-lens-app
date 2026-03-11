import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@/src/domain/entities/category';
import { prisma } from '../prisma.client';

export class CategoryPrismaRepository implements ICategoryRepository {
  async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Category[]> {
    return prisma.category.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findByUserIdAndName(userId: string, name: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { userId_name: { userId, name } } });
  }

  async create(data: CreateCategoryInput): Promise<Category> {
    return prisma.category.create({ data });
  }

  async update(id: string, data: UpdateCategoryInput): Promise<Category> {
    return prisma.category.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.category.delete({ where: { id } });
  }

  async createMany(data: CreateCategoryInput[]): Promise<void> {
    await prisma.category.createMany({ data });
  }
}
