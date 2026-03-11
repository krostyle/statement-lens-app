import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { CategoryResponseDTO } from '@/src/application/dtos/category.dto';

export class ListCategoriesUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(userId: string): Promise<CategoryResponseDTO[]> {
    const categories = await this.categoryRepo.findByUserId(userId);
    return categories.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      color: c.color,
      icon: c.icon,
      isDefault: c.isDefault,
    }));
  }
}
