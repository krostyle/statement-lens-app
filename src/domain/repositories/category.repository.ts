import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../entities/category';

export interface ICategoryRepository {
  findById(id: string): Promise<Category | null>;
  findByUserId(userId: string): Promise<Category[]>;
  findByUserIdAndName(userId: string, name: string): Promise<Category | null>;
  create(data: CreateCategoryInput): Promise<Category>;
  update(id: string, data: UpdateCategoryInput): Promise<Category>;
  delete(id: string): Promise<void>;
  createMany(data: CreateCategoryInput[]): Promise<void>;
}
