import type { ICategoryRepository } from '@/src/domain/repositories/category.repository';
import type { UpdateCategoryDTO, CategoryResponseDTO } from '@/src/application/dtos/category.dto';

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(id: string, userId: string, dto: UpdateCategoryDTO): Promise<CategoryResponseDTO> {
    const category = await this.categoryRepo.findById(id);
    if (!category) throw new Error('Category not found');
    if (category.userId !== userId) throw new Error('Forbidden');

    const updated = await this.categoryRepo.update(id, dto);

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      color: updated.color,
      icon: updated.icon,
      type: updated.type,
      isDefault: updated.isDefault,
    };
  }
}
