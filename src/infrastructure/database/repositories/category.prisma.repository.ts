import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@/src/domain/entities/category';
import { prisma } from '../prisma.client';

type PrismaCategory = {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string | null;
  type: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toCategory(c: PrismaCategory): Category {
  return {
    ...c,
    type: c.type === 'needs' || c.type === 'wants' ? c.type : null,
  };
}

export class CategoryPrismaRepository implements ICategoryRepository {
  async findById(id: string): Promise<Category | null> {
    const c = await prisma.category.findUnique({ where: { id } });
    return c ? toCategory(c) : null;
  }

  async findByUserId(userId: string): Promise<Category[]> {
    const rows = await prisma.category.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toCategory);
  }

  async findByUserIdAndName(userId: string, name: string): Promise<Category | null> {
    const c = await prisma.category.findUnique({ where: { userId_name: { userId, name } } });
    return c ? toCategory(c) : null;
  }

  async create(data: CreateCategoryInput): Promise<Category> {
    const c = await prisma.category.create({ data });
    return toCategory(c);
  }

  async update(id: string, data: UpdateCategoryInput): Promise<Category> {
    const c = await prisma.category.update({ where: { id }, data });
    return toCategory(c);
  }

  async delete(id: string): Promise<void> {
    await prisma.category.delete({ where: { id } });
  }

  async createMany(data: CreateCategoryInput[]): Promise<void> {
    await prisma.category.createMany({ data });
  }
}
