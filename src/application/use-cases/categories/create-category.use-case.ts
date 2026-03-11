import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { CreateCategoryDTO, CategoryResponseDTO } from '@/src/application/dtos/category.dto';

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(userId: string, dto: CreateCategoryDTO): Promise<CategoryResponseDTO> {
    const existing = await this.categoryRepo.findByUserIdAndName(userId, dto.name);
    if (existing) throw new Error('Category with this name already exists');

    const category = await this.categoryRepo.create({
      userId,
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
      isDefault: false,
    });

    return {
      id: category.id,
      userId: category.userId,
      name: category.name,
      color: category.color,
      icon: category.icon,
      isDefault: category.isDefault,
    };
  }
}
